import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-server";

/** Cookie holding the phone_number_id the user is currently working with. */
export const ACTIVE_NUMBER_COOKIE = "wa_active_number";

export interface WaAccount {
  id: string;
  client_id: string;
  waba_id: string;
  phone_number_id: string;
  display_name: string | null;
  access_token_encrypted: string;
  verification_status: string | null;
  registration_pin_encrypted: string | null;
  connected_at: string | null;
}

/**
 * All of a client's connected numbers (oldest first) and the one currently
 * "active". Active = the number chosen in the cookie if it still belongs to
 * this client, otherwise the first fully connected one, otherwise the first.
 */
export async function loadAccounts(
  clientId: string
): Promise<{ accounts: WaAccount[]; active: WaAccount | null }> {
  const { data } = await supabaseAdmin()
    .from("whatsapp_accounts")
    .select("*")
    .eq("client_id", clientId)
    .order("connected_at", { ascending: true });
  return pickActive((data ?? []) as WaAccount[]);
}

/** Chooses the active number from an already-loaded list. */
export async function pickActive(accounts: WaAccount[]): Promise<{ accounts: WaAccount[]; active: WaAccount | null }> {
  const chosen = (await cookies()).get(ACTIVE_NUMBER_COOKIE)?.value;
  const active =
    accounts.find((a) => a.phone_number_id === chosen) ??
    accounts.find((a) => a.verification_status === "connected") ??
    accounts[0] ??
    null;
  return { accounts, active };
}
