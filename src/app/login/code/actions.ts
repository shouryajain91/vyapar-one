"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseRSC } from "@/lib/supabase-rsc";

const EMAIL_COOKIE = "login_code_email";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Step 1: email the user a one-time code. */
export async function sendLoginCodeAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) redirect("/login/code?error=" + encodeURIComponent("Enter a valid email address"));

  const supabase = await supabaseRSC();
  // shouldCreateUser: false so this form can never create accounts.
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });

  if (error) {
    const rateLimited = error.status === 429 || /rate limit|too many|seconds/i.test(error.message);
    if (rateLimited) {
      redirect(
        "/login/code?error=" +
          encodeURIComponent("Too many codes requested. Wait a minute and try again, or log in with your password.")
      );
    }
    // Anything else (for example "no such user") gets the same screen as
    // success, so the form can't be used to find out which emails are registered.
    console.error("signInWithOtp failed:", error.message);
  }

  (await cookies()).set(EMAIL_COOKIE, email, {
    path: "/login",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 15 * 60,
  });
  redirect("/login/code?sent=1");
}

/** Step 2: check the code and sign in. */
export async function verifyLoginCodeAction(formData: FormData) {
  const token = String(formData.get("code") ?? "").replace(/\s+/g, "");
  const email = (await cookies()).get(EMAIL_COOKIE)?.value;
  if (!email) redirect("/login/code?error=" + encodeURIComponent("That took too long. Enter your email to get a new code."));
  if (!/^\d{6,8}$/.test(token)) redirect("/login/code?sent=1&error=" + encodeURIComponent("Enter the code from your email"));

  const supabase = await supabaseRSC();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    redirect("/login/code?sent=1&error=" + encodeURIComponent("That code is wrong or has expired. Check it or ask for a new one."));
  }

  (await cookies()).delete({ name: EMAIL_COOKIE, path: "/login" });
  redirect("/dashboard");
}
