"use server";

import { redirect } from "next/navigation";
import { supabaseRSC } from "@/lib/supabase-rsc";

const BASE = "/account/password";
const go = (q: string): never => redirect(`${BASE}?${q}`);
const err = (m: string, sent = false): never => go(`${sent ? "sent=1&" : ""}error=${encodeURIComponent(m)}`);

/** Step 1: email a one-time code to the signed-in user's own address. */
export async function sendPasswordCodeAction() {
  const supabase = await supabaseRSC();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  // The address always comes from the session, never from the form.
  const { error } = await supabase.auth.signInWithOtp({ email: user!.email!, options: { shouldCreateUser: false } });
  if (error) {
    const limited = error.status === 429 || /rate limit|too many|seconds/i.test(error.message);
    console.error("password code send failed:", error.message);
    err(limited ? "Too many codes requested. Wait a minute and try again." : "We couldn't send the code. Please try again in a minute.");
  }
  go("sent=1");
}

/** Step 2: the emailed code proves it's really them; then set the new password. */
export async function changePasswordAction(formData: FormData) {
  const token = String(formData.get("code") ?? "").replace(/\s+/g, "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  // Check the cheap things first so a typo doesn't use up the code.
  if (!/^\d{6,8}$/.test(token)) err("Enter the code from your email.", true);
  if (password.length < 8) err("Use at least 8 characters for the new password.", true);
  if (password.length > 72) err("The password can be up to 72 characters.", true);
  if (password !== confirm) err("The two passwords don't match.", true);

  const supabase = await supabaseRSC();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const { data, error: vErr } = await supabase.auth.verifyOtp({ email: user!.email!, token, type: "email" });
  if (vErr || data.user?.id !== user!.id) err("That code is wrong or has expired. Check it or ask for a new one.", true);

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    err(/different from the old/i.test(error.message) ? "Choose a password you haven't used before." : error.message, true);
  }
  go("done=1");
}
