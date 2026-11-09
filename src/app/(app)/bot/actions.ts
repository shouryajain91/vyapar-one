"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionClientId } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import { parseKeywords } from "@/lib/bot";

const MAX_RULES = 50;
const TYPES = ["contains", "exact", "starts_with", "fallback"];
const fail = (m: string): never => redirect(`/bot?error=${encodeURIComponent(m)}`);

export async function saveRuleAction(formData: FormData) {
  const clientId = await getSessionClientId();
  if (!clientId) redirect("/login");
  const db = supabaseAdmin();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const reply = String(formData.get("reply_text") ?? "").trim();
  const match = String(formData.get("match_type") ?? "contains");
  const keywords = parseKeywords(String(formData.get("keywords") ?? "")).map((k) => k.slice(0, 60));
  const cooldown = Math.min(1440, Math.max(0, Math.floor(Number(formData.get("cooldown_minutes") ?? 60)) || 0));
  const priority = Math.min(999, Math.max(1, Math.floor(Number(formData.get("priority") ?? 100)) || 100));
  let numberId: string | null = String(formData.get("phone_number_id") ?? "") || null;

  if (!name) fail("Give the rule a name.");
  if (!reply) fail("Write the reply message.");
  if (reply.length > 1000) fail("The reply can be up to 1000 characters.");
  if (!TYPES.includes(match)) fail("Choose how to match.");
  if (match !== "fallback" && keywords.length === 0) fail("Add at least one keyword.");

  if (numberId) {
    const { data: acc } = await db.from("whatsapp_accounts").select("phone_number_id").eq("client_id", clientId).eq("phone_number_id", numberId).maybeSingle();
    if (!acc) numberId = null;
  }

  const row = {
    name, reply_text: reply, match_type: match, keywords: match === "fallback" ? [] : keywords,
    cooldown_minutes: cooldown, priority, phone_number_id: numberId,
  };
  if (id) {
    await db.from("bot_rules").update(row).eq("id", id).eq("client_id", clientId);
  } else {
    const { count } = await db.from("bot_rules").select("id", { count: "exact", head: true }).eq("client_id", clientId);
    if ((count ?? 0) >= MAX_RULES) fail(`You can have up to ${MAX_RULES} rules.`);
    await db.from("bot_rules").insert({ ...row, client_id: clientId });
  }
  revalidatePath("/bot");
  redirect("/bot?saved=1");
}

export async function toggleRuleAction(formData: FormData) {
  const clientId = await getSessionClientId();
  if (!clientId) redirect("/login");
  await supabaseAdmin().from("bot_rules").update({ is_active: formData.get("active") === "1" })
    .eq("id", String(formData.get("id") ?? "")).eq("client_id", clientId);
  revalidatePath("/bot");
}

export async function deleteRuleAction(formData: FormData) {
  const clientId = await getSessionClientId();
  if (!clientId) redirect("/login");
  await supabaseAdmin().from("bot_rules").delete().eq("id", String(formData.get("id") ?? "")).eq("client_id", clientId);
  revalidatePath("/bot");
}
