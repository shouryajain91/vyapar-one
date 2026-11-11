import { NextRequest, NextResponse } from "next/server";
import { getSessionClientId } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import { feedbackRange } from "@/lib/feedback";

const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour12: false }).replace(",", "");
function cell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const clientId = await getSessionClientId();
  if (!clientId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { from, to, days } = feedbackRange(req.nextUrl.searchParams.get("days") ?? undefined);

  const out: string[] = [["Answered at (IST)", "Customer number", "Customer name", "Answer", "Template", "Campaign"].map(cell).join(",")];
  for (let offset = 0; offset < 10000; offset += 1000) {
    const { data } = await supabaseAdmin().rpc("feedback_responses", { p_client: clientId, p_from: from, p_to: to, p_limit: 1000, p_offset: offset });
    const rows = (data ?? []) as { replied_at: string; customer: string; customer_name: string | null; answer: string; template_name: string; campaign_name: string | null }[];
    for (const r of rows) out.push([fmt(r.replied_at), r.customer, r.customer_name, r.answer, r.template_name, r.campaign_name].map(cell).join(","));
    if (rows.length < 1000) break;
  }
  return new NextResponse("﻿" + out.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="feedback-last-${days}-days.csv"`, "Cache-Control": "no-store" },
  });
}
