"use server";

import { redirect } from "next/navigation";
import { supabaseRSC } from "@/lib/supabase-rsc";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function signupAction(formData: FormData) {
  const businessName = String(formData.get("business_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!businessName || !email || !password) {
    redirect("/signup?error=missing_fields");
  }

  const supabase = await supabaseRSC();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
    { email, password }
  );

  if (signUpError || !signUpData.user) {
    redirect(
      `/signup?error=${encodeURIComponent(signUpError?.message ?? "signup_failed")}`
    );
  }

  // Use the admin client for these inserts since RLS select policies
  // require an app_users row to exist first (chicken-and-egg on signup).
  const admin = supabaseAdmin();

  const { data: client, error: clientError } = await admin
    .from("clients")
    .insert({
      business_name: businessName,
      contact_email: email,
      owner_user_id: signUpData.user!.id,
      status: "pending",
    })
    .select()
    .single();

  if (clientError || !client) {
    redirect("/signup?error=client_creation_failed");
  }

  await admin.from("app_users").insert({
    client_id: client!.id,
    user_id: signUpData.user!.id,
    email,
    role: "admin",
  });

  redirect("/dashboard");
}
