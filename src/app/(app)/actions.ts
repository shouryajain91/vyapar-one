"use server";

import { redirect } from "next/navigation";
import { supabaseRSC } from "@/lib/supabase-rsc";

export async function logoutAction() {
  const supabase = await supabaseRSC();
  await supabase.auth.signOut();
  redirect("/login");
}
