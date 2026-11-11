import { supabaseAdmin } from "@/lib/supabase-server";
import { decrypt } from "@/lib/crypto";
import { markTokenInvalid, markTokenOk, raiseAlert, resolveAlert, isTokenError } from "@/lib/alerts";

const GRAPH_VERSION = "v21.0";
const MAX_ACCOUNTS_PER_RUN = 150;
const CONCURRENCY = 5;

const QUALITY_TEXT: Record<string, string> = {
  YELLOW: "Quality dropped to Medium. Too many customers are blocking or reporting your messages. Send only to people who expect them, and use clear opt-out wording.",
  RED: "Quality dropped to Low. WhatsApp may limit or restrict this number. Pause promotional sends and review who you are messaging.",
};

/**
 * Checks every connected number against Meta (oldest check first) and the last
 * hour of sending, and opens or clears alerts. Run every 15 minutes.
 */
export async function runHealthChecks(budgetMs = 50_000) {
  const db = supabaseAdmin();
  const deadline = Date.now() + budgetMs;

  const { data: accounts } = await db
    .from("whatsapp_accounts")
    .select("client_id, phone_number_id, access_token_encrypted, token_status, quality_rating, messaging_limit_tier")
    .eq("verification_status", "connected")
    .order("quality_checked_at", { ascending: true, nullsFirst: true })
    .limit(MAX_ACCOUNTS_PER_RUN);

  const queue = [...(accounts ?? [])];
  let checked = 0;
  const worker = async () => {
    for (;;) {
      const a = queue.shift();
      if (!a || Date.now() > deadline) return;
      await checkAccount(a);
      checked++;
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  await checkFailureSpikes();
  await checkPaymentProblems();
  return { checked };
}

async function checkAccount(a: {
  client_id: string; phone_number_id: string; access_token_encrypted: string;
  token_status: string | null; quality_rating: string | null; messaging_limit_tier: string | null;
}) {
  const db = supabaseAdmin();
  let token: string;
  try {
    token = decrypt(a.access_token_encrypted);
  } catch {
    await markTokenInvalid(a.client_id, a.phone_number_id, "Stored credentials could not be read.");
    return;
  }

  let res: Response;
  let data: { quality_rating?: string; messaging_limit_tier?: string; status?: string; error?: { code?: number; message?: string } };
  try {
    res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${a.phone_number_id}?fields=quality_rating,messaging_limit_tier,status`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    data = await res.json().catch(() => ({}));
  } catch {
    return; // Meta unreachable: leave everything as it was.
  }

  if (!res.ok) {
    if (isTokenError(data?.error?.code, res.status)) await markTokenInvalid(a.client_id, a.phone_number_id, data?.error?.message);
    return;
  }
  if (a.token_status === "invalid") await markTokenOk(a.client_id, a.phone_number_id); // it works again

  const quality = data.quality_rating ?? null;
  const tier = data.messaging_limit_tier ?? null;
  await db
    .from("whatsapp_accounts")
    .update({ quality_rating: quality, messaging_limit_tier: tier, quality_checked_at: new Date().toISOString() })
    .eq("client_id", a.client_id)
    .eq("phone_number_id", a.phone_number_id);

  const qKey = `quality:${a.phone_number_id}`;
  if (quality === "YELLOW" || quality === "RED") {
    await raiseAlert({
      clientId: a.client_id, phoneNumberId: a.phone_number_id, kind: "quality",
      severity: quality === "RED" ? "critical" : "warning",
      title: `Number quality is ${quality === "RED" ? "Low" : "Medium"}`,
      detail: QUALITY_TEXT[quality], key: qKey,
    });
  } else {
    await resolveAlert(a.client_id, qKey);
  }

  const sKey = `numstatus:${a.phone_number_id}`;
  if (data.status && ["FLAGGED", "RESTRICTED", "BANNED", "DISCONNECTED", "UNVERIFIED"].includes(data.status)) {
    await raiseAlert({
      clientId: a.client_id, phoneNumberId: a.phone_number_id, kind: "number_status",
      severity: data.status === "FLAGGED" ? "warning" : "critical",
      title: `Number status: ${data.status.toLowerCase()}`,
      detail: "WhatsApp reports a problem with this number. Open WhatsApp Manager, then Phone numbers, to see what it needs.",
      key: sKey,
    });
  } else {
    await resolveAlert(a.client_id, sKey);
  }

  if (a.messaging_limit_tier && tier && a.messaging_limit_tier !== tier) {
    await raiseAlert({
      clientId: a.client_id, phoneNumberId: a.phone_number_id, kind: "tier_change", severity: "info",
      title: "Daily sending limit changed",
      detail: `Your limit moved from ${a.messaging_limit_tier} to ${tier}.`,
      key: `tier:${a.phone_number_id}:${tier}`,
    });
  }
}

async function openAlertKeys(kind: string) {
  const { data } = await supabaseAdmin().from("alerts").select("client_id, dedupe_key").eq("kind", kind).is("resolved_at", null).limit(2000);
  return data ?? [];
}

async function checkFailureSpikes() {
  const { data: spikes } = await supabaseAdmin().rpc("failure_spikes");
  const current = new Set<string>();
  for (const s of (spikes ?? []) as { client_id: string; phone_number_id: string; total: number; failed: number }[]) {
    const key = `spike:${s.phone_number_id}`;
    current.add(`${s.client_id}|${key}`);
    await raiseAlert({
      clientId: s.client_id, phoneNumberId: s.phone_number_id, kind: "failure_spike", severity: "critical",
      title: "Many messages are failing",
      detail: `${s.failed} of the last ${s.total} messages in the past hour failed. Open Reports and filter by "Failed" to see why.`,
      key,
    });
  }
  for (const o of await openAlertKeys("failure_spike")) {
    if (!current.has(`${o.client_id}|${o.dedupe_key}`)) await resolveAlert(o.client_id, o.dedupe_key);
  }
}

async function checkPaymentProblems() {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await supabaseAdmin().from("messages").select("client_id, phone_number_id").eq("error_code", "131042").gte("created_at", since).limit(1000);
  const current = new Set<string>();
  for (const m of data ?? []) if (m.phone_number_id) current.add(`${m.client_id}|payment:${m.phone_number_id}`);
  for (const o of await openAlertKeys("payment")) {
    if (!current.has(`${o.client_id}|${o.dedupe_key}`)) await resolveAlert(o.client_id, o.dedupe_key);
  }
}
