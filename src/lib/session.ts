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

/** Client row + numbers for the signed-in user, in a single database call (cached per request). */
export const getSessionContext = cache(async () => {
  const user = await getSessionUser();
  if (!user) return null;
  const { data } = await supabaseAdmin().rpc("session_context", { p_user: user.id });
  if (!data) return null;
  return data as { client_id: string; client: Record<string, unknown>; accounts: import("@/lib/wa-accounts").WaAccount[] };
});

export const getSessionClientId = cache(async () => (await getSessionContext())?.client_id ?? null);
