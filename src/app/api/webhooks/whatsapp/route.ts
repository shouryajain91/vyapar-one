import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";
import { STATUS_RANK } from "@/lib/wa-errors";

/**
 * GET: Meta's webhook verification handshake.
 * Called once when you register the webhook URL in the App Dashboard.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * POST: incoming messages and status updates from WhatsApp.
 * Always ack with 200 quickly; Meta retries aggressively on non-200s.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Verify the request actually came from Meta.
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifySignature(rawBody, signature)) {
    console.warn("WhatsApp webhook: invalid signature");
    return new NextResponse("Invalid signature", { status: 403 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  try {
    await processPayload(payload);
  } catch (err) {
    // Log but still ack 200 — we don't want Meta hammering retries
    // for a bug on our side. Fix and reprocess from logs if needed.
    console.error("Error processing WhatsApp webhook payload:", err);
  }

  return new NextResponse("OK", { status: 200 });
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signatureHeader)
    );
  } catch {
    return false;
  }
}

async function processPayload(payload: WhatsAppWebhookPayload) {
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

interface WhatsAppChangeValue {
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

interface WhatsAppWebhookPayload {
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value: WhatsAppChangeValue;
    }>;
  }>;
}

interface WhatsAppInboundMessage {
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
