import { NextResponse } from "next/server";
import { getSessionClientId } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

function cell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  const clientId = await getSessionClientId();
  if (!clientId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data } = await supabaseAdmin()
    .from("opt_outs")
    .select("phone, contact_name, source, reason_text, opted_out_at")
    .eq("client_id", clientId)
    .eq("status", "opted_out")
    .order("opted_out_at", { ascending: false });

  const head = ["Number", "Name", "How", "Their message / note", "Opted out at (IST)"];
  const lines = (data ?? []).map((o) =>
    [
      o.phone,
      o.contact_name,
      o.source === "keyword" ? "Customer replied" : "Added manually",
      o.reason_text,
      new Date(o.opted_out_at).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour12: false }).replace(",", ""),
    ].map(cell).join(",")
  );
  return new NextResponse("﻿" + [head.map(cell).join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="opt-outs.csv"',
      "Cache-Control": "no-store",
    },
  });
}
