import { redirect } from "next/navigation";
import { getSessionContext, getSessionUser } from "@/lib/session";
import { pickActive } from "@/lib/wa-accounts";

/**
 * Resolves the logged-in user's client (tenant) record.
 * Redirects to /login if there's no session.
 * Uses the admin client for the lookup (simplest path given the
 * current RLS policies key off app_users, which this already checks).
 */
export async function getCurrentClient() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const { accounts: whatsappAccounts, active: whatsappAccount } = await pickActive(ctx!.accounts);
  const client = ctx!.client as { id: string; business_name?: string | null; [k: string]: unknown };
  return { user: user!, client, whatsappAccount, whatsappAccounts };
}
