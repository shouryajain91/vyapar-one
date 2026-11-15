"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import { generateKey, SCOPES } from "@/lib/api-keys";
import { encrypt } from "@/lib/crypto";
import { EVENT_TYPES, newSecret, validateWebhookUrl, deliverWebhooks } from "@/lib/outbound-webhooks";
import type { SecretState } from "@/components/SecretForm";
import { isIP } from "node:net";

async function requireClient() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  return ctx;
}

export async function createKeyAction(_prev: SecretState, fd: FormData): Promise<SecretState> {
  const ctx = await requireClient();
  const db = supabaseAdmin();
  const name = String(fd.get("name") ?? "").trim().slice(0, 60);
  if (!name) return { error: "Give the key a name, like “Website checkout”." };
  const number = String(fd.get("phone_number_id") ?? "");
  const account = ctx.accounts.find((a) => a.phone_number_id === number);
  if (!account) return { error: "Choose one of your connected numbers." };

  const scopes = SCOPES.filter((s) => fd.getAll("scopes").includes(s));
  if (!scopes.length) return { error: "Choose at least one permission." };

  const ips = String(fd.get("ips") ?? "").split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  if (ips.length > 20 || ips.some((ip) => !isIP(ip))) return { error: "Allowed IP addresses must be valid, separated by commas (up to 20)." };

  const { count } = await db.from("api_keys").select("id", { count: "exact", head: true }).eq("client_id", ctx.client_id).is("revoked_at", null);
  if ((count ?? 0) >= 10) return { error: "You can have up to 10 active keys. Revoke one you no longer use." };

  const k = generateKey();
  const { error } = await db.from("api_keys").insert({
    client_id: ctx.client_id,
    phone_number_id: number,
    name,
    key_prefix: k.prefix,
    key_hash: k.hash,
    scopes,
    ip_allowlist: ips,
  });
  if (error) return { error: "Couldn't create the key. Please try again." };
  revalidatePath("/developers");
  return { secret: k.key, note: `This key can only send from ${account.display_name ?? number}.` };
}

export async function revokeKeyAction(fd: FormData) {
  const ctx = await requireClient();
  await supabaseAdmin()
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", String(fd.get("id") ?? ""))
    .eq("client_id", ctx.client_id)
    .is("revoked_at", null);
  revalidatePath("/developers");
}

export async function createWebhookAction(_prev: SecretState, fd: FormData): Promise<SecretState> {
  const ctx = await requireClient();
  const db = supabaseAdmin();
  const url = String(fd.get("url") ?? "").trim();
  const bad = validateWebhookUrl(url);
  if (bad) return { error: bad };
  const events = EVENT_TYPES.filter((e) => fd.getAll("events").includes(e));
  if (!events.length) return { error: "Choose at least one event." };
  const number = String(fd.get("phone_number_id") ?? "");
  if (number && !ctx.accounts.some((a) => a.phone_number_id === number)) return { error: "Choose one of your connected numbers." };

  const { count } = await db.from("webhook_endpoints").select("id", { count: "exact", head: true }).eq("client_id", ctx.client_id);
  if ((count ?? 0) >= 5) return { error: "You can have up to 5 webhooks. Delete one you no longer need." };

  const secret = newSecret();
  const { error } = await db.from("webhook_endpoints").insert({
    client_id: ctx.client_id,
    url,
    secret_encrypted: encrypt(secret),
    events,
    phone_number_id: number || null,
  });
  if (error) return { error: "Couldn't save the webhook. Please try again." };
  revalidatePath("/developers");
  return { secret, note: "Use this secret to verify the X-VyaparOne-Signature header on every request. See the docs." };
}

export async function deleteWebhookAction(fd: FormData) {
  const ctx = await requireClient();
  await supabaseAdmin().from("webhook_endpoints").delete().eq("id", String(fd.get("id") ?? "")).eq("client_id", ctx.client_id);
  revalidatePath("/developers");
}

export async function toggleWebhookAction(fd: FormData) {
  const ctx = await requireClient();
  const turnOn = fd.get("active") === "1";
  await supabaseAdmin()
    .from("webhook_endpoints")
    .update({ active: turnOn, consecutive_failures: 0 })
    .eq("id", String(fd.get("id") ?? ""))
    .eq("client_id", ctx.client_id);
  revalidatePath("/developers");
}

/** Sends a sample event to one webhook so the client can check their server. */
export async function testWebhookAction(fd: FormData) {
  const ctx = await requireClient();
  const db = supabaseAdmin();
  const id = String(fd.get("id") ?? "");
  const { data: ep } = await db.from("webhook_endpoints").select("id").eq("id", id).eq("client_id", ctx.client_id).maybeSingle();
  if (!ep) return;
  await db.from("webhook_deliveries").insert({
    endpoint_id: id,
    client_id: ctx.client_id,
    event_type: "webhook.test",
    payload: { type: "webhook.test", created_at: new Date().toISOString(), data: { message: "This is a test event from Vyapar One." } },
  });
  await deliverWebhooks(5);
  revalidatePath("/developers");
  revalidatePath("/developers/activity");
}
