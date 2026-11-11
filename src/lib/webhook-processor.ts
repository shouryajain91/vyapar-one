import { supabaseAdmin } from "@/lib/supabase-server";
import { STATUS_RANK } from "@/lib/wa-errors";
import { classifyOptMessage } from "@/lib/optout";
import { maybeAutoReply } from "@/lib/bot-reply";
import { raiseAlert, resolveAlert } from "@/lib/alerts";

export async function processPayload(payload: WhatsAppWebhookPayload) {
  const db = supabaseAdmin();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;

      // Template approval / rejection updates arrive per WABA (entry.id),
      // not per phone number.
      if (change.field === "message_template_status_update") {
        await handleTemplateStatus(db, entry.id, value);
        continue;
      }

      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      // Find which client this number belongs to.
      const { data: account } = await db
        .from("whatsapp_accounts")
        .select("client_id")
        .eq("phone_number_id", phoneNumberId)
        .single();

      if (!account) {
        console.warn(
          `Webhook for unknown phone_number_id: ${phoneNumberId}`
        );
        continue;
      }
      const clientId = account.client_id;

      // Incoming messages
      // Customer profile names arrive in value.contacts, keyed by wa_id.
      const names = new Map<string, string>();
      for (const c of value.contacts ?? []) {
        if (c.wa_id && c.profile?.name) names.set(c.wa_id, c.profile.name.slice(0, 120));
      }

      for (const msg of value.messages ?? []) {
        // Meta re-delivers webhooks; ignore a message we already stored.
        const { data: seen } = await db.from("messages").select("id").eq("wa_message_id", msg.id).eq("client_id", clientId).maybeSingle();
        if (seen) continue;
        await db.from("messages").insert({
          client_id: clientId,
          wa_message_id: msg.id,
          direction: "inbound",
          from_number: msg.from,
          to_number: phoneNumberId,
          phone_number_id: phoneNumberId,
          contact_name: names.get(msg.from) ?? null,
          message_type: msg.type,
          body: extractBody(msg),
          status: "received",
          raw_payload: msg,
        });

        // STOP / unsubscribe: remember it so this customer is excluded from sends.
        const optAction = classifyOptMessage(extractBody(msg));
        if (optAction === "out") {
          await db.from("opt_outs").upsert(
            {
              client_id: clientId,
              phone: msg.from,
              contact_name: names.get(msg.from) ?? null,
              status: "opted_out",
              source: "keyword",
              reason_text: (extractBody(msg) ?? "").slice(0, 200),
              opted_out_at: new Date().toISOString(),
              opted_in_at: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "client_id,phone" }
          );
        } else if (optAction === "in") {
          // Only matters if they were opted out before.
          await db
            .from("opt_outs")
            .update({ status: "opted_in", opted_in_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("client_id", clientId)
            .eq("phone", msg.from)
            .eq("status", "opted_out");
        }

        // Keyword bot: reply automatically (not to STOP / START messages).
        if (!optAction) {
          await maybeAutoReply({
            clientId,
            phoneNumberId,
            customer: msg.from,
            customerName: names.get(msg.from) ?? null,
            text: extractBody(msg),
          });
        }
      }

      // Status updates for messages we sent (sent/delivered/read/failed)
      for (const status of value.statuses ?? []) {
        const { data: row } = await db
          .from("messages")
          .select("id, status")
          .eq("wa_message_id", status.id)
          .eq("client_id", clientId)
          .maybeSingle();
        if (!row) continue;

        const incoming = status.status;
        const at = status.timestamp ? new Date(Number(status.timestamp) * 1000).toISOString() : new Date().toISOString();
        const update: Record<string, unknown> = {};

        if (incoming === "failed") {
          const err = status.errors?.[0];
          update.status = "failed";
          update.error_code = err?.code != null ? String(err.code) : null;
          update.error_message =
            [err?.error_data?.details ?? err?.message ?? err?.title].filter(Boolean).join("") || null;
          if (String(err?.code) === "131042") {
            await raiseAlert({
              clientId,
              phoneNumberId,
              kind: "payment",
              severity: "critical",
              title: "Messages failing because of a payment problem",
              detail: "Add funds or fix the payment method in WhatsApp Manager, then try again.",
              key: `payment:${phoneNumberId}`,
            });
          }
        } else {
          // Webhooks can arrive out of order: never move a message backwards.
          const cur = STATUS_RANK[row.status ?? ""] ?? 0;
          const next = STATUS_RANK[incoming] ?? 0;
          if (row.status !== "failed" && next > cur) update.status = incoming;
          if (incoming === "delivered") update.delivered_at = at;
          if (incoming === "read") {
            update.read_at = at;
            update.delivered_at = update.delivered_at ?? at;
          }
        }
        if (Object.keys(update).length) await db.from("messages").update(update).eq("id", row.id);
      }
    }
  }
}

async function handleTemplateStatus(
  db: ReturnType<typeof supabaseAdmin>,
  wabaId: string | undefined,
  value: WhatsAppChangeValue
) {
  const name = value.message_template_name;
  const event = value.event;
  if (!wabaId || !name || !event) return;

  const { data: account } = await db
    .from("whatsapp_accounts")
    .select("client_id")
    .eq("waba_id", wabaId)
    .maybeSingle();
  if (!account) return;

  let q = db
    .from("templates")
    .update({
      status: event,
      rejected_reason: value.reason && value.reason !== "NONE" ? value.reason : null,
      synced_at: new Date().toISOString(),
    })
    .eq("client_id", account.client_id)
    .eq("name", name);
  if (value.message_template_language) {
    q = q.eq("language", value.message_template_language);
  }
  await q;

  // Tell the business when a template stops working, and clear it when it's back.
  const lang = value.message_template_language ?? "";
  const bad = ["PAUSED", "DISABLED", "FLAGGED", "REJECTED"];
  const key = (e: string) => `tpl:${name}:${lang}:${e}`;
  if (bad.includes(event)) {
    const why: Record<string, string> = {
      PAUSED: "WhatsApp paused it because customers reported or ignored it. It can't be sent until it is reinstated.",
      DISABLED: "WhatsApp disabled it after repeated low quality. Create a new, clearer template.",
      FLAGGED: "WhatsApp flagged it for low quality. If it keeps happening it will be paused.",
      REJECTED: "WhatsApp rejected it" + (value.reason && value.reason !== "NONE" ? ` (${value.reason})` : "") + ". Edit it and submit again.",
    };
    await raiseAlert({
      clientId: account.client_id,
      kind: "template",
      severity: event === "FLAGGED" ? "warning" : "critical",
      title: `Template "${name}" is ${event.toLowerCase()}`,
      detail: why[event],
      key: key(event),
    });
  } else if (event === "APPROVED" || event === "REINSTATED") {
    for (const e of ["PAUSED", "DISABLED", "FLAGGED", "REJECTED"]) await resolveAlert(account.client_id, key(e));
  }
}

function extractBody(msg: WhatsAppInboundMessage): string | null {
  if (msg.type === "text") return msg.text?.body ?? null;
  if (msg.type === "button") return msg.button?.text ?? null;
  if (msg.type === "interactive") {
    return (
      msg.interactive?.button_reply?.title ??
      msg.interactive?.list_reply?.title ??
      null
    );
  }
  // media messages (image/audio/video/document) — store caption if present
  return (
    msg.image?.caption ??
    msg.video?.caption ??
    msg.document?.caption ??
    null
  );
}

// --- Minimal types for the parts of Meta's webhook payload we use ---

export interface WhatsAppChangeValue {
  metadata?: { phone_number_id?: string };
  messages?: WhatsAppInboundMessage[];
  contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
  statuses?: Array<{
    id: string;
    status: string;
    timestamp?: string;
    errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>;
  }>;
  // message_template_status_update fields
  event?: string;
  message_template_name?: string;
  message_template_language?: string;
  reason?: string;
}

export interface WhatsAppWebhookPayload {
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value: WhatsAppChangeValue;
    }>;
  }>;
}

export interface WhatsAppInboundMessage {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  button?: { text: string };
  interactive?: {
    button_reply?: { title: string };
    list_reply?: { title: string };
  };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { caption?: string };
}

/**
 * Processes queued webhook events. Failed events are retried with a growing
 * delay and parked as "failed" after 5 attempts. Processing is safe to repeat:
 * inbound messages are de-duplicated and status updates never move backwards.
 */
export async function processWebhookQueue(limit = 20) {
  const db = supabaseAdmin();
  let done = 0;
  let failed = 0;
  for (let round = 0; round < 5; round++) {
    const { data: events, error } = await db.rpc("claim_webhook_events", { p_limit: limit });
    if (error) {
      console.error("claim_webhook_events failed:", error.message);
      break;
    }
    if (!events?.length) break;
    for (const ev of events as { id: number; payload: WhatsAppWebhookPayload }[]) {
      try {
        await processPayload(ev.payload);
        await db.rpc("finish_webhook_event", { p_id: ev.id, p_error: null });
        done++;
      } catch (e) {
        failed++;
        console.error("webhook event failed:", ev.id, (e as Error).message);
        await db.rpc("finish_webhook_event", { p_id: ev.id, p_error: String((e as Error).message ?? e).slice(0, 500) });
      }
    }
    if (events.length < limit) break;
  }
  return { done, failed };
}
