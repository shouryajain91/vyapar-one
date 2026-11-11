"use server";

import { revalidatePath } from "next/cache";
import { getSessionClientId } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

/** Hide an alert you've dealt with. If the problem is still there, the next check reopens it. */
export async function dismissAlertAction(formData: FormData) {
  const clientId = await getSessionClientId();
  const id = String(formData.get("id") ?? "");
  if (!clientId || !id) return;
  await supabaseAdmin()
    .from("alerts")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("client_id", clientId)
    .neq("kind", "token_invalid"); // only reconnecting clears an expired connection
  revalidatePath("/alerts");
}
