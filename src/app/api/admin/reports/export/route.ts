import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { loadPlatformReport } from "@/lib/platform-report";
import { parseFilters } from "@/lib/reports";

function cell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  await requirePlatformAdmin(); // 404 for anyone who isn't a platform admin
  const f = parseFilters(Object.fromEntries(req.nextUrl.searchParams.entries()));
  const { rows } = await loadPlatformReport(f);
  const head = ["Business", "Contact email", "Messages sent", "Delivered", "Read", "Failed", "Received", "Last activity (UTC)"];
  const lines = rows.map((r) =>
    [r.name, r.email, r.sent, r.delivered, r.read, r.failed, r.received, r.lastActivity ?? ""].map(cell).join(",")
  );
  return new NextResponse("﻿" + [head.map(cell).join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="platform-report-${f.from}-to-${f.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
