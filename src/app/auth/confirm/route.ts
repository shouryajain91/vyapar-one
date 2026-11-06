import { NextRequest, NextResponse } from "next/server";
import { supabaseRSC } from "@/lib/supabase-rsc";

/**
 * Landing point for password-reset links. Handles both:
 *  - ?token_hash=...&type=recovery  (links made by a platform admin)
 *  - ?code=...                      (links from the "Forgot password" email)
 * then sends the user on to `next` with a signed-in session.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  // Only allow same-site relative redirects.
  let next = searchParams.get("next") ?? "/reset-password";
  if (!next.startsWith("/") || next.startsWith("//")) next = "/reset-password";

  const supabase = await supabaseRSC();
  let failed = true;

  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
    failed = !!error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = !!error;
  }

  if (failed) {
    return NextResponse.redirect(
      new URL(
        "/forgot-password?error=" +
          encodeURIComponent("That reset link is invalid or has expired. Request a new one."),
        origin
      )
    );
  }
  return NextResponse.redirect(new URL(next, origin));
}
