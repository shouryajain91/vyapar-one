import { createHmac, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { supabaseAdmin } from "@/lib/supabase-server";
import { decrypt } from "@/lib/crypto";
import { raiseAlert, resolveAlert } from "@/lib/alerts";

export const EVENT_TYPES = ["message.status", "message.received"] as const;
export const newSecret = () => "whsec_" + randomBytes(24).toString("base64url");

export function sign(secret: string, timestamp: number, body: string) {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

/** Addresses a client's webhook must never be able to reach (our own network, cloud metadata, localhost). */
export function isPrivateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const l = ip.toLowerCase();
    if (l.startsWith("::ffff:")) return isPrivateAddress(l.slice(7));
    return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe8") || l.startsWith("fe9") || l.startsWith("fea") || l.startsWith("feb");
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || a >= 224;
}

/** Checks a URL typed in by a client. Returns an error message, or null when fine. */
export function validateWebhookUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "Enter a full web address, like https://example.com/hooks/whatsapp.";
  }
  if (u.protocol !== "https:") return "The address must start with https://";
  if (u.username || u.password) return "Don't put a username or password in the address.";
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return "That address isn't reachable from the internet.";
  if (isIP(host.replace(/^\[|\]$/g, "")) && isPrivateAddress(host.replace(/^\[|\]$/g, ""))) return "That address isn't reachable from the internet.";
  if (raw.length > 500) return "That address is too long.";
  return null;
}

/** Queue an event for every endpoint of this client that listens to it. Never throws. */
export async function emitEvent(clientId: string, phoneNumberId: string | null, type: string, data: Record<string, unknown>) {
  try {
    await supabaseAdmin().rpc("enqueue_client_event", { p_client: clientId, p_number: phoneNumberId, p_type: type, p_data: data });
  } catch (e) {
    console.error("emitEvent failed:", (e as Error).message);
  }
}

interface Delivery {
  id: number;
  endpoint_id: string;
  client_id: string;
  event_type: string;
  payload: Record<string, unknown>;
}
interface Endpoint {
  id: string;
  url: string;
  secret_encrypted: string;
  active: boolean;
  consecutive_failures: number;
}

async function deliverOne(d: Delivery, ep: Endpoint | undefined) {
  const db = supabaseAdmin();
  if (!ep || !ep.active) {
    await db.from("webhook_deliveries").update({ status: "failed", last_error: "This webhook is turned off.", locked_at: null }).eq("id", d.id);
    return;
  }
  let http = 0;
  let error: string | null = null;
  try {
    const url = new URL(ep.url);
    const addrs = await lookup(url.hostname, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("The address resolves to a private network.");
    const ts = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ id: `evt_${d.id}`, ...d.payload });
    const res = await fetch(url, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "VyaparOne-Webhooks/1",
        "X-VyaparOne-Event": d.event_type,
        "X-VyaparOne-Delivery": String(d.id),
        "X-VyaparOne-Signature": sign(decrypt(ep.secret_encrypted), ts, body),
      },
      body,
      signal: AbortSignal.timeout(8_000),
    });
    http = res.status;
    if (res.status < 200 || res.status >= 300) error = `Your server answered HTTP ${res.status}.`;
  } catch (e) {
    error = (e as Error).name === "TimeoutError" ? "Your server didn't answer within 8 seconds." : `Couldn't reach your server: ${(e as Error).message}`.slice(0, 250);
  }

  const { data } = await db.rpc("finish_webhook_delivery", { p_id: d.id, p_http: http || null, p_error: error });
  const r = (data as { parked: boolean; failures: number }[] | null)?.[0];
  if (!error && ep.consecutive_failures > 0) await resolveAlert(d.client_id, `webhook:${ep.id}`);
  if (r?.parked) {
    await raiseAlert({
      clientId: d.client_id,
      kind: "webhook",
      severity: "warning",
      title: "Webhook deliveries are failing",
      detail: `We couldn't deliver events to ${new URL(ep.url).host} after several tries. Check that your server is up and returns HTTP 200. Last error: ${error}`,
      key: `webhook:${ep.id}`,
    });
  }
}

/** Sends queued webhook events to clients' servers (with retries handled by the queue). */
export async function deliverWebhooks(limit = 20) {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("claim_webhook_deliveries", { p_limit: limit });
  if (error) {
    console.error("claim_webhook_deliveries failed:", error.message);
    return { delivered: 0 };
  }
  const batch = (data ?? []) as Delivery[];
  if (!batch.length) return { delivered: 0 };
  const { data: eps } = await db
    .from("webhook_endpoints")
    .select("id, url, secret_encrypted, active, consecutive_failures")
    .in("id", [...new Set(batch.map((d) => d.endpoint_id))]);
  const byId = new Map(((eps ?? []) as Endpoint[]).map((e) => [e.id, e]));

  const queue = [...batch];
  await Promise.all(
    Array.from({ length: Math.min(5, queue.length) }, async () => {
      for (let d = queue.shift(); d; d = queue.shift()) await deliverOne(d, byId.get(d.endpoint_id)).catch((e) => console.error("webhook delivery crashed", e));
    })
  );
  return { delivered: batch.length };
}
