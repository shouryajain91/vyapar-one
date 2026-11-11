import { supabaseAdmin } from "@/lib/supabase-server";

export type Severity = "critical" | "warning" | "info";

/** Opens an alert (or refreshes the open one with the same key). Never throws. */
export async function raiseAlert(a: {
  clientId: string;
  phoneNumberId?: string | null;
  kind: string;
  severity: Severity;
  title: string;
  detail?: string;
  key: string;
}) {
  try {
    await supabaseAdmin().rpc("raise_alert", {
      p_client: a.clientId,
      p_number: a.phoneNumberId ?? null,
      p_kind: a.kind,
      p_severity: a.severity,
      p_title: a.title,
      p_detail: a.detail ?? null,
      p_key: a.key,
    });
  } catch (e) {
    console.error("raiseAlert failed:", (e as Error).message);
  }
}

export async function resolveAlert(clientId: string, key: string) {
  try {
    await supabaseAdmin().rpc("resolve_alert", { p_client: clientId, p_key: key });
  } catch (e) {
    console.error("resolveAlert failed:", (e as Error).message);
  }
}

/** Meta says the access token no longer works (error 190 / OAuthException). */
export function isTokenError(code: unknown, httpStatus?: number): boolean {
  return String(code) === "190" || httpStatus === 401;
}

/**
 * The customer's WhatsApp connection stopped working. Remember it, so every
 * page can ask them to reconnect, and so we stop trying to send meanwhile.
 */
export async function markTokenInvalid(clientId: string, phoneNumberId: string, message?: string) {
  try {
    const db = supabaseAdmin();
    await db
      .from("whatsapp_accounts")
      .update({ token_status: "invalid", token_error: (message ?? "").slice(0, 300) || null, token_checked_at: new Date().toISOString() })
      .eq("client_id", clientId)
      .eq("phone_number_id", phoneNumberId);
    await raiseAlert({
      clientId,
      phoneNumberId,
      kind: "token_invalid",
      severity: "critical",
      title: "WhatsApp connection expired",
      detail: "Messages can't be sent or received until you reconnect your number.",
      key: `token:${phoneNumberId}`,
    });
  } catch (e) {
    console.error("markTokenInvalid failed:", (e as Error).message);
  }
}

export async function markTokenOk(clientId: string, phoneNumberId: string) {
  await supabaseAdmin()
    .from("whatsapp_accounts")
    .update({ token_status: "ok", token_error: null, token_checked_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .eq("phone_number_id", phoneNumberId);
  await resolveAlert(clientId, `token:${phoneNumberId}`);
}
