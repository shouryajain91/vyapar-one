"use server";

import { redirect } from "next/navigation";
import { supabaseRSC } from "@/lib/supabase-rsc";
import { SITE_URL } from "@/lib/site-url";

export async function forgotPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/forgot-password?error=Enter your email address");

  const supabase = await supabaseRSC();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/auth/confirm?next=/reset-password`,
  });
  if (error) console.error("resetPasswordForEmail failed:", error.message);

  // Same answer whether or not the account exists, so nobody can use this
  // form to find out which emails are registered.
  redirect("/forgot-password?sent=1");
}
