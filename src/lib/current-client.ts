import { redirect } from "next/navigation";
import { getSessionClientId, getSessionUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import { loadAccounts } from "@/lib/wa-accounts";

/**
 * Resolves the logged-in user's client (tenant) record.
 * Redirects to /login if there's no session.
 * Uses the admin client for the lookup (simplest path given the
 * current RLS policies key off app_users, which this already checks).
 */
export async function getCurrentClient() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const clientId = await getSessionClientId();
  if (!clientId) redirect("/login");

  // Independent lookups run in parallel.
  const [{ data: client }, { accounts: whatsappAccounts, active: whatsappAccount }] = await Promise.all([
    supabaseAdmin().from("clients").select("*").eq("id", clientId).single(),
    loadAccounts(clientId!),
  ]);

  return { user: user!, client, whatsappAccount, whatsappAccounts };
}
