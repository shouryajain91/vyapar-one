import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runHealthChecks } from "@/lib/health-check";

export const maxDuration = 60;

function authorised(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

async function handle(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await runHealthChecks(50_000)) });
}

// Called every 15 minutes by Supabase pg_cron.
export const GET = handle;
export const POST = handle;
