import { NextRequest, NextResponse } from "next/server";
import { getSessionClientId } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import { applyFilters, EXPORT_MAX, parseFilters, REPORT_COLUMNS } from "@/lib/reports";
import { explainError } from "@/lib/wa-errors";

const TZ = "Asia/Kolkata";
const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { timeZone: TZ, hour12: false }).replace(",", "") : "";

// CSV cell: quote it, and neutralise spreadsheet formulas in customer-supplied text.
function cell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const clientId = await getSessionClientId();
  if (!clientId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const f = parseFilters(sp);
  const { data } = await applyFilters(supabaseAdmin().from("messages").select(REPORT_COLUMNS), clientId, f)
    .order("created_at", { ascending: false })
    .limit(EXPORT_MAX);

  const head = ["Date & time (IST)", "Direction", "Customer number", "Customer name", "Sent from (number ID)", "Type", "Template", "Message", "Status", "Failure code", "Failure reason", "Delivered at", "Read at"];
  const rows = (data ?? []).map((m) => {
    const out = m.direction === "outbound";
    return [
      fmt(m.created_at),
      out ? "Sent" : "Received",
      out ? m.to_number : m.from_number,
      m.contact_name,
      m.phone_number_id,
      m.message_type,
      m.template_name,
      m.body,
      m.status,
      m.error_code,
      m.status === "failed" ? explainError(m.error_code, m.error_message) : "",
      fmt(m.delivered_at),
      fmt(m.read_at),
    ].map(cell).join(",");
  });

  const csv = "﻿" + [head.map(cell).join(","), ...rows].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="messages-${f.from}-to-${f.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
