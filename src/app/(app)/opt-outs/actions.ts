"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionClientId } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import { normalizeNumber } from "@/lib/phone";

/** Add a customer to the do-not-message list by hand (for example, they asked by phone). */
export async function addOptOutAction(formData: FormData) {
  const clientId = await getSessionClientId();
  if (!clientId) redirect("/login");

  const phone = normalizeNumber(String(formData.get("phone") ?? ""));
  if (!phone) redirect("/opt-outs?error=" + encodeURIComponent("Enter the number with country code, like +919876543210."));
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin().from("opt_outs").upsert(
    {
      client_id: clientId,
      phone,
      status: "opted_out",
      source: "manual",
      reason_text: note,
      opted_out_at: now,
      opted_in_at: null,
      updated_at: now,
    },
    { onConflict: "client_id,phone" }
  );
  if (error) redirect("/opt-outs?error=" + encodeURIComponent("Couldn't save. Please try again."));
  revalidatePath("/opt-outs");
  redirect("/opt-outs?added=1");
}

/** The customer asked to hear from the business again. */
export async function optInAction(formData: FormData) {
  const clientId = await getSessionClientId();
  if (!clientId) redirect("/login");
  const id = String(formData.get("id") ?? "");

  const now = new Date().toISOString();
  await supabaseAdmin()
    .from("opt_outs")
    .update({ status: "opted_in", opted_in_at: now, updated_at: now })
    .eq("id", id)
    .eq("client_id", clientId); // can only touch this business's own rows
  revalidatePath("/opt-outs");
  redirect("/opt-outs");
}
