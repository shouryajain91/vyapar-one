"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionClientId } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function cancelCampaignAction(formData: FormData) {
  const clientId = await getSessionClientId();
  const id = String(formData.get("id") ?? "");
  if (!clientId || !id) redirect("/login");
  const db = supabaseAdmin();
  const { data } = await db
    .from("campaigns")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("client_id", clientId)
    .in("status", ["scheduled", "running"])
    .select("id");
  if (data?.length) {
    await db.from("campaign_recipients").update({ status: "cancelled" }).eq("campaign_id", id).eq("status", "pending");
  }
  revalidatePath(`/campaigns/${id}`);
  redirect(`/campaigns/${id}`);
}
