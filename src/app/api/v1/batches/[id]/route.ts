import { NextResponse } from "next/server";
import { api, fail } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase-server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = api<{ id: string }>("read", async (_req, key, { id }) => {
  if (!UUID.test(id)) return fail(404, "not_found", "Batch not found.");
  const db = supabaseAdmin();
  const { data: c } = await db
    .from("campaigns")
    .select("id, name, status, total, created_at, completed_at")
    .eq("id", id)
    .eq("client_id", key.clientId)
    .eq("phone_number_id", key.phoneNumberId)
    .eq("source", "api")
    .maybeSingle();
  if (!c) return fail(404, "not_found", "Batch not found.");
  const { data: s } = await db.rpc("api_batch_stats", { p_client: key.clientId, p_campaign: id });
  const st = (s as Record<string, number>[] | null)?.[0] ?? {};
  return NextResponse.json({
    id: c.id,
    name: c.name,
    status: c.status === "cancelled" ? "cancelled" : c.status === "scheduled" ? "queued" : c.status, // queued | running | completed | cancelled
    total: c.total,
    created_at: c.created_at,
    completed_at: c.completed_at,
    counts: { pending: Number(st.pending ?? 0), sent: Number(st.sent ?? 0), delivered: Number(st.delivered ?? 0), read: Number(st.read ?? 0), failed: Number(st.failed ?? 0), skipped: Number(st.skipped ?? 0) },
  });
});
