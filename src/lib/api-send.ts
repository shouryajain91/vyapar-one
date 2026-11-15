import { supabaseAdmin } from "@/lib/supabase-server";
import { decrypt } from "@/lib/crypto";
import { normalizeNumber } from "@/lib/phone";
import { buildSendComponents, type SendableTemplate } from "@/lib/template-send";
import { explainError } from "@/lib/wa-errors";
import { isTokenError, markTokenInvalid } from "@/lib/alerts";
import { GRAPH_VERSION } from "@/lib/wa-context";
import type { ApiKeyCtx } from "@/lib/api";

export interface ApiResult {
  status: number;
  body: Record<string, unknown>;
  /** True when it's certain nothing was sent, so the same Idempotency-Key may be used again. */
  definitive: boolean;
}

const fail = (status: number, code: string, message: string, extra?: Record<string, unknown>): ApiResult => ({
  status,
  body: { error: { code, message, ...extra } },
  definitive: true,
});

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

/** Public shape of a stored message. */
export function toApiMessage(m: Record<string, unknown>) {
  const outbound = m.direction === "outbound";
  return {
    id: m.id,
    direction: m.direction,
    customer: outbound ? m.to_number : m.from_number,
    type: m.message_type,
    status: m.status,
    template: m.template_name ?? null,
    text: m.body ?? null,
    button_payload: m.button_payload ?? null,
    reference: m.reference ?? null,
    wa_message_id: m.wa_message_id ?? null,
    batch_id: m.campaign_id ?? null,
    error: m.status === "failed" ? { code: m.error_code ?? null, message: m.error_message ?? null } : null,
    created_at: m.created_at,
    delivered_at: m.delivered_at ?? null,
    read_at: m.read_at ?? null,
  };
}

export const MESSAGE_COLUMNS =
  "id, direction, from_number, to_number, message_type, body, status, error_code, error_message, template_name, reference, wa_message_id, campaign_id, button_payload, created_at, delivered_at, read_at";

/** Sends one message for an API key. Never throws on bad input; returns a status and JSON body. */
export async function sendApiMessage(key: ApiKeyCtx, input: Record<string, unknown>): Promise<ApiResult> {
  const to = normalizeNumber(String(input.to ?? ""));
  if (!to) return fail(400, "invalid_number", "`to` must be the customer's number with country code, like 919876543210.");
  const type = input.type === "text" ? "text" : input.type === "template" || input.template ? "template" : null;
  if (!type) return fail(400, "invalid_request", 'Set `type` to "template" or "text".');
  const reference = str(input.reference, 100);
  if (input.reference !== undefined && reference === undefined) return fail(400, "invalid_request", "`reference` must be a string.");

  if (!key.accessTokenEncrypted) return fail(409, "number_not_connected", "This key's WhatsApp number is no longer connected.");
  if (key.verificationStatus === "pending_registration") return fail(409, "number_not_registered", "This number isn't registered yet. Finish registration in the dashboard.");
  if (key.tokenStatus === "invalid") return fail(409, "token_expired", "The WhatsApp connection has expired. Reconnect it from the dashboard.");

  const db = supabaseAdmin();

  let payload: Record<string, unknown>;
  let storedBody: string | null;
  let templateName: string | null = null;

  if (type === "template") {
    const t = (input.template ?? {}) as Record<string, unknown>;
    const name = str(t.name, 512);
    const language = str(t.language, 20);
    if (!name || !language) return fail(400, "invalid_request", "`template.name` and `template.language` are required.");

    const { data: optedOut } = await db.from("opt_outs").select("id").eq("client_id", key.clientId).eq("phone", to).eq("status", "opted_out").maybeSingle();
    if (optedOut) return fail(422, "opted_out", "This customer opted out (STOP), so no template was sent.");

    const { data: tpl } = await db
      .from("templates")
      .select("name, language, status, body, header_format, header_text, footer, buttons")
      .eq("client_id", key.clientId)
      .eq("name", name)
      .eq("language", language)
      .maybeSingle();
    if (!tpl) return fail(404, "template_not_found", `No template "${name}" in language "${language}".`);
    if (tpl.status !== "APPROVED") return fail(422, "template_not_approved", `Template "${name}" is ${tpl.status ?? "not approved"} and can't be sent.`);

    const body = Array.isArray(t.body) ? t.body.map((v) => String(v ?? "")) : [];
    const buttons =
      t.buttons && typeof t.buttons === "object" && !Array.isArray(t.buttons)
        ? Object.fromEntries(Object.entries(t.buttons as Record<string, unknown>).slice(0, 5).map(([k, v]) => [k, String(v ?? "")]))
        : undefined;
    const link = str(t.header_media_link, 2000);
    try {
      const built = buildSendComponents(tpl as SendableTemplate, {
        body_params: body.slice(0, 20),
        header_text: str(t.header_text, 1100),
        header_media: link ? { link, filename: str(t.header_filename, 100) } : undefined,
        button_params: buttons,
      });
      payload = {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: tpl.name, language: { code: tpl.language }, components: built.components },
      };
      storedBody = built.rendered || tpl.name;
      templateName = tpl.name;
    } catch (e) {
      return fail(422, "invalid_variables", (e as Error).message);
    }
  } else {
    const text = str(input.text, 4096)?.trim();
    if (!text) return fail(400, "invalid_request", "`text` is required for text messages.");
    // Free text is only allowed while the customer's 24-hour window is open.
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: inbound } = await db
      .from("messages")
      .select("id")
      .eq("client_id", key.clientId)
      .eq("direction", "inbound")
      .eq("from_number", to)
      .eq("phone_number_id", key.phoneNumberId)
      .gte("created_at", since)
      .limit(1);
    if (!inbound?.length) {
      return fail(422, "outside_window", "Free-text messages can only be sent within 24 hours of the customer's last message. Send an approved template instead.");
    }
    payload = { messaging_product: "whatsapp", to, type: "text", text: { body: text } };
    storedBody = text;
  }

  let res: Response;
  let data: { messages?: { id: string }[]; error?: { code?: number; message?: string; error_user_msg?: string; error_data?: { details?: string } } };
  try {
    res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${key.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${decrypt(key.accessTokenEncrypted)}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25_000),
    });
    data = await res.json();
  } catch {
    return {
      status: 504,
      definitive: false,
      body: { error: { code: "delivery_unknown", message: "WhatsApp didn't answer in time, so we can't tell if the message was sent. Check GET /v1/messages?reference=… before retrying." } },
    };
  }

  const base = {
    client_id: key.clientId,
    direction: "outbound",
    from_number: key.phoneNumberId,
    phone_number_id: key.phoneNumberId,
    to_number: to,
    message_type: type,
    body: storedBody,
    template_name: templateName,
    reference: reference ?? null,
    api_key_id: key.keyId,
    raw_payload: payload,
  };

  if (!res.ok) {
    const code = data?.error?.code != null ? String(data.error.code) : null;
    if (isTokenError(code, res.status)) await markTokenInvalid(key.clientId, key.phoneNumberId, data?.error?.message);
    const reason = explainError(code, data?.error?.error_user_msg ?? data?.error?.message);
    const { data: m } = await db
      .from("messages")
      .insert({ ...base, status: "failed", error_code: code, error_message: [reason, data?.error?.error_data?.details].filter(Boolean).join(" — ") })
      .select("id")
      .single();
    const apiCode =
      isTokenError(code, res.status) ? "token_expired" : code === "130429" ? "rate_limited" : code === "131042" ? "payment_issue" : code === "131047" ? "outside_window" : "whatsapp_error";
    const status = apiCode === "token_expired" ? 409 : apiCode === "rate_limited" ? 429 : apiCode === "payment_issue" ? 402 : apiCode === "outside_window" ? 422 : 502;
    return fail(status, apiCode, reason, { whatsapp_code: code, message_id: m?.id ?? null });
  }

  const { data: m } = await db
    .from("messages")
    .insert({ ...base, wa_message_id: data.messages?.[0]?.id ?? null, status: "sent" })
    .select(MESSAGE_COLUMNS)
    .single();
  return { status: 200, definitive: true, body: m ? toApiMessage(m) : { status: "sent" } };
}
