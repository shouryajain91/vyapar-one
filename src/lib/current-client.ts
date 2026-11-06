import { redirect } from "next/navigation";
import { supabaseRSC } from "@/lib/supabase-rsc";
import { supabaseAdmin } from "@/lib/supabase-server";
import { loadAccounts } from "@/lib/wa-accounts";

/**
 * Resolves the logged-in user's client (tenant) record.
 * Redirects to /login if there's no session.
 * Uses the admin client for the lookup (simplest path given the
 * current RLS policies key off app_users, which this already checks).
 */
export async function getCurrentClient() {
  const supabase = await supabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = supabaseAdmin();
  const { data: appUser } = await admin
    .from("app_users")
    .select("client_id")
    .eq("user_id", user!.id)
    .single();

  if (!appUser) {
    redirect("/login");
  }

  const { data: client } = await admin
    .from("clients")
    .select("*")
    .eq("id", appUser!.client_id)
    .single();

  // A business can have several numbers; whatsappAccount is the active one.
  const { accounts: whatsappAccounts, active: whatsappAccount } = await loadAccounts(appUser!.client_id);

  return { user, client, whatsappAccount, whatsappAccounts };
}
