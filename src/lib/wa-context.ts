import { supabaseRSC } from "@/lib/supabase-rsc";
import { supabaseAdmin } from "@/lib/supabase-server";
import { decrypt } from "@/lib/crypto";

export const GRAPH_VERSION = "v21.0";

export type WaContext =
  | { ok: true; clientId: string; wabaId: string; accessToken: string }
  | { ok: false; status: number; error: string };

/** Resolves the logged-in user's client and its WhatsApp account. */
export async function getWaContext(): Promise<WaContext> {
  const supabase = await supabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Not signed in" };

  const db = supabaseAdmin();
  const { data: appUser } = await db
    .from("app_users")
    .select("client_id")
    .eq("user_id", user.id)
    .single();
  if (!appUser) return { ok: false, status: 403, error: "No client for user" };

  const { data: account } = await db
    .from("whatsapp_accounts")
    .select("waba_id, access_token_encrypted")
    .eq("client_id", appUser.client_id)
    .maybeSingle();
  if (!account) return { ok: false, status: 404, error: "Connect WhatsApp first" };

  return {
    ok: true,
    clientId: appUser.client_id,
    wabaId: account.waba_id,
    accessToken: decrypt(account.access_token_encrypted),
  };
}

/** Best human-readable message from a Graph API error body. */
export function graphErrorMessage(data: unknown): string {
  const e = (data as { error?: { error_user_msg?: string; message?: string } })?.error;
  return e?.error_user_msg ?? e?.message ?? "Meta rejected the request";
}
