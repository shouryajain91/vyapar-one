"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-server";
import { ACTIVE_NUMBER_COOKIE, loadAccounts } from "@/lib/wa-accounts";
import { supabaseRSC } from "@/lib/supabase-rsc";

export async function logoutAction() {
  const supabase = await supabaseRSC();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Switch which of the business's numbers the dashboard, inbox and templates use. */
export async function setActiveNumberAction(formData: FormData) {
  const phoneNumberId = String(formData.get("phone_number_id") ?? "");
  const supabase = await supabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabaseAdmin()
    .from("app_users")
    .select("client_id")
    .eq("user_id", user.id)
    .single();
  if (!appUser) redirect("/login");

  // Only numbers that belong to this business can be selected.
  const { accounts } = await loadAccounts(appUser.client_id);
  if (accounts.some((a) => a.phone_number_id === phoneNumberId)) {
    (await cookies()).set(ACTIVE_NUMBER_COOKIE, phoneNumberId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  revalidatePath("/", "layout");
}
