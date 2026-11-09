import { supabaseAdmin } from "@/lib/supabase-server";
import { decrypt } from "@/lib/crypto";
import { explainError } from "@/lib/wa-errors";
import { fillReply, pickRule, type BotRuleLike } from "@/lib/bot";

const GRAPH_VERSION = "v21.0";
const MAX_BOT_REPLIES_PER_HOUR = 5;

interface Rule extends BotRuleLike {
  name: string;
  reply_text: string;
  cooldown_minutes: number;
  phone_number_id: string | null;
}

/**
 * Sends the matching auto-reply for an inbound message, if any. Never throws:
 * a bot problem must not stop messages from being stored.
 */
export async function maybeAutoReply(opts: {
  clientId: string;
  phoneNumberId: string;
  customer: string;
  customerName: string | null;
  text: string | null;
}) {
  try {
    const { clientId, phoneNumberId, customer, text } = opts;
    if (!text?.trim()) return;
    const db = supabaseAdmin();

    const { data: rules } = await db
      .from("bot_rules")
      .select("id, name, keywords, match_type, reply_text, cooldown_minutes, priority, phone_number_id")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .or(`phone_number_id.is.null,phone_number_id.eq.${phoneNumberId}`);
    if (!rules?.length) return;
    const rule = pickRule(rules as Rule[], text);
    if (!rule) return;

    // Don't auto-reply to someone who has opted out.
    const { data: opted } = await db.from("opt_outs").select("id").eq("client_id", clientId).eq("phone", customer).eq("status", "opted_out").maybeSingle();
    if (opted) return;

    // Loop / spam guards: per-customer hourly cap and per-rule cooldown.
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await db.from("messages").select("id", { count: "exact", head: true })
      .eq("client_id", clientId).eq("to_number", customer).not("bot_rule_id", "is", null).gte("created_at", hourAgo);
    if ((count ?? 0) >= MAX_BOT_REPLIES_PER_HOUR) return;
    if (rule.cooldown_minutes > 0) {
      const since = new Date(Date.now() - rule.cooldown_minutes * 60_000).toISOString();
      const { data: recent } = await db.from("messages").select("id")
        .eq("client_id", clientId).eq("to_number", customer).eq("bot_rule_id", rule.id).gte("created_at", since).limit(1);
      if (recent?.length) return;
    }

    const { data: acc } = await db.from("whatsapp_accounts").select("access_token_encrypted")
      .eq("client_id", clientId).eq("phone_number_id", phoneNumberId).maybeSingle();
    if (!acc?.access_token_encrypted) return;

    const body = fillReply(rule.reply_text, opts.customerName).slice(0, 4000);
    const payload = { messaging_product: "whatsapp", to: customer, type: "text", text: { body } };
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${decrypt(acc.access_token_encrypted)}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => ({}));
    const code = data?.error?.code != null ? String(data.error.code) : null;
    await db.from("messages").insert({
      client_id: clientId,
      wa_message_id: res.ok ? (data.messages?.[0]?.id ?? null) : null,
      direction: "outbound",
      from_number: phoneNumberId,
      phone_number_id: phoneNumberId,
      to_number: customer,
      contact_name: opts.customerName,
      message_type: "text",
      body,
      status: res.ok ? "sent" : "failed",
      error_code: res.ok ? null : code,
      error_message: res.ok ? null : explainError(code, data?.error?.error_user_msg ?? data?.error?.message),
      bot_rule_id: rule.id,
      raw_payload: payload,
    });
  } catch (e) {
    console.error("Bot auto-reply failed:", (e as Error).message);
  }
}
