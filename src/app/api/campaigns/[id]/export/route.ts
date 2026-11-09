import { NextRequest, NextResponse } from "next/server";
import { getSessionClientId } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import { explainError } from "@/lib/wa-errors";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour12: false }).replace(",", "") : "";
function cell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getSessionClientId();
  if (!clientId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const db = supabaseAdmin();
  const { data: c } = await db.from("campaigns").select("name").eq("id", id).eq("client_id", clientId).maybeSingle();
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: recips } = await db.from("campaign_recipients")
    .select("phone, contact_name, status, error_message, message_id, sent_at").eq("campaign_id", id).order("phone").limit(10000);
  const ids = (recips ?? []).map((r) => r.message_id).filter(Boolean) as string[];
  const mById = new Map<string, { status: string; error_code: string | null; error_message: string | null; delivered_at: string | null; read_at: string | null }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from("messages").select("id, status, error_code, error_message, delivered_at, read_at").in("id", ids.slice(i, i + 200));
    for (const m of data ?? []) mById.set(m.id, m);
  }

  const head = ["Customer number", "Customer name", "Status", "Sent at (IST)", "Delivered at", "Read at", "Failure reason"];
  const rows = (recips ?? []).map((r) => {
    const m = r.message_id ? mById.get(r.message_id) : undefined;
    const status = m?.status === "failed" ? "failed" : m && m.status !== "sent" ? m.status : r.status;
    return [/^\d+$/.test(r.phone) ? r.phone : "", r.contact_name, status, fmt(r.sent_at), fmt(m?.delivered_at ?? null), fmt(m?.read_at ?? null),
      m?.status === "failed" ? explainError(m.error_code, m.error_message) : r.error_message].map(cell).join(",");
  });
  const csv = "﻿" + [head.map(cell).join(","), ...rows].join("\r\n");
  const safe = c.name.replace(/[^\w-]+/g, "_").slice(0, 40) || "campaign";
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="campaign-${safe}.csv"`, "Cache-Control": "no-store" },
  });
}
