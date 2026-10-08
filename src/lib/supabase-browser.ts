import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client using the public anon key.
 * Safe to import in client components. RLS policies apply.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
