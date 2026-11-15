import { NextResponse } from "next/server";
import { api, fail, readJson } from "@/lib/api";
import { withIdempotency } from "@/lib/api-idem";
import { sendApiMessage, toApiMessage, MESSAGE_COLUMNS } from "@/lib/api-send";
import { supabaseAdmin } from "@/lib/supabase-server";
import { normalizeNumber } from "@/lib/phone";

export const maxDuration = 60;

/** Send one message. */
export const POST = api("send", async (req, key) => {
  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  const res = await withIdempotency(req, key, parsed.body, () => sendApiMessage(key, parsed.body));
  const code = (await res.clone().json())?.error?.code;
  if (code) res.headers.set("x-error-code", code);
  return res;
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/;

/** List messages for this key's number, newest first. */
export const GET = api("read", async (req, key) => {
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "25", 10) || 25, 1), 100);
  const direction = sp.get("direction") === "inbound" ? "inbound" : "outbound";

  let q = supabaseAdmin()
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("client_id", key.clientId)
    .eq("phone_number_id", key.phoneNumberId)
    .eq("direction", direction)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  const status = sp.get("status");
  if (status) {
    if (!["sent", "delivered", "read", "failed", "received"].includes(status)) return fail(400, "invalid_request", "Unknown `status`.");
    q = q.eq("status", status);
  }
  const customer = sp.get("customer") ?? sp.get("to");
  if (customer) {
    const n = normalizeNumber(customer);
    if (!n) return fail(400, "invalid_number", "`customer` isn't a valid number.");
    q = q.eq(direction === "outbound" ? "to_number" : "from_number", n);
  }
  const reference = sp.get("reference");
  if (reference) q = q.eq("reference", reference.slice(0, 100));
  const batch = sp.get("batch_id");
  if (batch) {
    if (!UUID.test(batch)) return fail(400, "invalid_request", "`batch_id` is not valid.");
    q = q.eq("campaign_id", batch);
  }
  for (const [param, op] of [["since", "gte"], ["until", "lte"]] as const) {
    const v = sp.get(param);
    if (!v) continue;
    if (!ISO.test(v) || Number.isNaN(Date.parse(v))) return fail(400, "invalid_request", `\`${param}\` must be an ISO 8601 time, like 2026-11-15T00:00:00Z.`);
    q = q.filter("created_at", op, v);
  }
  const cursor = sp.get("cursor");
  if (cursor) {
    let at = "", id = "";
    try {
      [at, id] = Buffer.from(cursor, "base64url").toString().split("|");
    } catch {}
    if (!ISO.test(at) || !UUID.test(id)) return fail(400, "invalid_request", "`cursor` is not valid.");
    q = q.or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${id})`);
  }

  const { data, error } = await q;
  if (error) {
    console.error("list messages:", error.message);
    return fail(500, "internal_error", "Couldn't load messages.");
  }
  const rows = data ?? [];
  const page = rows.slice(0, limit);
  const last = page[page.length - 1] as { created_at: string; id: string } | undefined;
  return NextResponse.json({
    data: page.map((m) => toApiMessage(m as Record<string, unknown>)),
    next_cursor: rows.length > limit && last ? Buffer.from(`${last.created_at}|${last.id}`).toString("base64url") : null,
  });
});
