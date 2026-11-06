import { cache } from "react";
import { supabaseRSC } from "@/lib/supabase-rsc";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * Per-request cached lookups. The layout and the page both need the user and
 * their client; with cache() each is fetched once per request, not once per
 * component. getClaims() verifies the session token locally when the project
 * uses asymmetric JWT keys (no network round trip), and falls back to Auth.
 */
export const getSessionUser = cache(async () => {
  const supabase = await supabaseRSC();
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  if (!c?.sub) return null;
  return { id: c.sub as string, email: (c.email as string | undefined) ?? null };
});

export const getSessionClientId = cache(async () => {
  const user = await getSessionUser();
  if (!user) return null;
  const { data } = await supabaseAdmin()
    .from("app_users")
    .select("client_id")
    .eq("user_id", user.id)
    .single();
  return (data?.client_id as string | undefined) ?? null;
});
