import { supabaseAdmin } from "@/lib/supabase-server";
import { decrypt } from "@/lib/crypto";
import { buildSendComponents, type SendableTemplate } from "@/lib/template-send";
import { explainError } from "@/lib/wa-errors";

const GRAPH_VERSION = "v21.0";
const BATCH = 25;
const CONCURRENCY = 10;

/** Shape of campaign_recipients.vars. */
export interface RecipientVars {
  body?: string[];
  header_text?: string;
  buttons?: Record<string, string>;
}

interface Recipient {
  id: string;
  campaign_id: string;
  client_id: string;
  phone: string;
  contact_name: string | null;
  vars: RecipientVars;
}

interface Campaign {
  id: string;
  client_id: string;
  phone_number_id: string;
  template_name: string;
  template_language: string;
  header_link: string | null;
  status: string;
}

type Db = ReturnType<typeof supabaseAdmin>;

/**
 * Sends pending campaign messages until the time budget runs out.
 * Safe to run from several places at once: recipients are claimed atomically,
 * and a recipient whose send was interrupted is marked failed, never re-sent.
 */
export async function runCampaignBatches(budgetMs = 50_000) {
  const db = supabaseAdmin();
  const deadline = Date.now() + budgetMs;
  const campaigns = new Map<string, Campaign | null>();
  const templates = new Map<string, SendableTemplate | null>();
  const tokens = new Map<string, string | null>();
  let sent = 0;
  let failed = 0;
  let throttled = false;

  await db.rpc("recover_stuck_recipients");

  while (Date.now() < deadline && !throttled) {
    const { data: claimed, error } = await db.rpc("claim_campaign_recipients", { p_limit: BATCH });
    if (error) {
      console.error("claim_campaign_recipients failed:", error.message);
      break;
    }
    const batch = (claimed ?? []) as Recipient[];
    if (!batch.length) break;

    // Re-read campaigns every batch so a cancel takes effect quickly.
    campaigns.clear();
    const missing = [...new Set(batch.map((r) => r.campaign_id))].filter((id) => !campaigns.has(id));
    if (missing.length) {
      const { data } = await db.from("campaigns").select("*").in("id", missing);
      for (const id of missing) campaigns.set(id, ((data ?? []) as Campaign[]).find((c) => c.id === id) ?? null);
    }

    // Opted-out numbers in this batch, per client.
    const optedOut = new Set<string>();
    for (const clientId of new Set(batch.map((r) => r.client_id))) {
      const { data } = await db
        .from("opt_outs")
        .select("phone")
        .eq("client_id", clientId)
        .eq("status", "opted_out")
        .in("phone", batch.filter((r) => r.client_id === clientId).map((r) => r.phone));
      for (const o of data ?? []) optedOut.add(`${clientId}|${o.phone}`);
    }

    const queue = [...batch];
    const worker = async () => {
      for (;;) {
        const r = queue.shift();
        if (!r) return;
        if (throttled || Date.now() > deadline + 8_000) {
          // Give it back untouched; a later run picks it up.
          await db.from("campaign_recipients").update({ status: "pending", claimed_at: null }).eq("id", r.id);
          continue;
        }
        const outcome = await sendOne(db, r, campaigns, templates, tokens, optedOut);
        if (outcome === "sent") sent++;
        else if (outcome === "failed") failed++;
        else if (outcome === "throttled") throttled = true;
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batch.length) }, worker));
  }

  await db.rpc("complete_finished_campaigns");
  return { sent, failed, throttled };
}

type Outcome = "sent" | "failed" | "skipped" | "throttled";

async function sendOne(
  db: Db,
  r: Recipient,
  campaigns: Map<string, Campaign | null>,
  templates: Map<string, SendableTemplate | null>,
  tokens: Map<string, string | null>,
  optedOut: Set<string>
): Promise<Outcome> {
  const finish = (status: string, error_message: string | null = null, message_id: string | null = null) =>
    db
      .from("campaign_recipients")
      .update({ status, error_message, message_id, sent_at: status === "sent" ? new Date().toISOString() : null })
      .eq("id", r.id);

  const camp = campaigns.get(r.campaign_id);
  if (!camp || camp.status === "cancelled") {
    await finish("cancelled");
    return "skipped";
  }
  if (optedOut.has(`${r.client_id}|${r.phone}`)) {
    await finish("skipped", "This customer opted out (STOP), so no message was sent.");
    return "skipped";
  }

  // Template (approved only), cached per campaign.
  if (!templates.has(camp.id)) {
    const { data } = await db
      .from("templates")
      .select("name, language, status, body, header_format, header_text, footer, buttons")
      .eq("client_id", camp.client_id)
      .eq("name", camp.template_name)
      .eq("language", camp.template_language)
      .maybeSingle();
    templates.set(camp.id, (data as SendableTemplate | null) ?? null);
  }
  const tpl = templates.get(camp.id);
  if (!tpl || tpl.status !== "APPROVED") {
    await finish("failed", `Template "${camp.template_name}" is ${tpl?.status ?? "missing"} and can't be sent.`);
    return "failed";
  }

  // Access token for the sending number, cached per campaign.
  if (!tokens.has(camp.id)) {
    const { data: acc } = await db
      .from("whatsapp_accounts")
      .select("access_token_encrypted")
      .eq("client_id", camp.client_id)
      .eq("phone_number_id", camp.phone_number_id)
      .maybeSingle();
    let token: string | null = null;
    try {
      token = acc?.access_token_encrypted ? decrypt(acc.access_token_encrypted) : null;
    } catch {
      token = null;
    }
    tokens.set(camp.id, token);
  }
  const token = tokens.get(camp.id);
  if (!token) {
    await finish("failed", "The sending WhatsApp number is no longer connected.");
    return "failed";
  }

  let payload: Record<string, unknown>;
  let rendered: string;
  try {
    const built = buildSendComponents(tpl, {
      body_params: r.vars?.body,
      header_text: r.vars?.header_text,
      header_media: camp.header_link ? { link: camp.header_link } : undefined,
      button_params: r.vars?.buttons,
    });
    rendered = built.rendered || tpl.name;
    payload = {
      messaging_product: "whatsapp",
      to: r.phone,
      type: "template",
      template: { name: tpl.name, language: { code: tpl.language }, components: built.components },
    };
  } catch (e) {
    await finish("failed", (e as Error).message);
    return "failed";
  }

  let res: Response;
  let data: { messages?: { id: string }[]; error?: { code?: number; message?: string; error_user_msg?: string; error_data?: { details?: string } } };
  try {
    res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${camp.phone_number_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
    data = await res.json();
  } catch {
    // Unknown whether Meta received it: never retry automatically.
    await finish("failed", "The request to WhatsApp timed out; delivery unknown. Check the chat before resending.");
    return "failed";
  }

  const base = {
    client_id: r.client_id,
    direction: "outbound",
    from_number: camp.phone_number_id,
    phone_number_id: camp.phone_number_id,
    to_number: r.phone,
    contact_name: r.contact_name,
    message_type: "template",
    body: rendered,
    template_name: tpl.name,
    campaign_id: camp.id,
    raw_payload: payload,
  };

  if (!res.ok) {
    const code = data?.error?.code != null ? String(data.error.code) : null;
    if (code === "130429") {
      // Sending too fast: put it back and stop this run.
      await db.from("campaign_recipients").update({ status: "pending", claimed_at: null }).eq("id", r.id);
      return "throttled";
    }
    const reason = explainError(code, data?.error?.error_user_msg ?? data?.error?.message);
    const { data: m } = await db
      .from("messages")
      .insert({
        ...base,
        status: "failed",
        error_code: code,
        error_message: [reason, data?.error?.error_data?.details].filter(Boolean).join(" — "),
      })
      .select("id")
      .single();
    await finish("failed", reason, m?.id ?? null);
    return "failed";
  }

  const { data: m } = await db
    .from("messages")
    .insert({ ...base, wa_message_id: data.messages?.[0]?.id ?? null, status: "sent" })
    .select("id")
    .single();
  await finish("sent", null, m?.id ?? null);
  return "sent";
}
