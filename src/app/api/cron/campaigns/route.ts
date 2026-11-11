import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runCampaignBatches } from "@/lib/campaign-runner";
import { processWebhookQueue } from "@/lib/webhook-processor";
import { supabaseAdmin } from "@/lib/supabase-server";

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
  // Retry any webhook events that failed or were left behind, then send campaigns.
  const webhooks = await processWebhookQueue(50).catch((e) => ({ error: String(e) }));
  await supabaseAdmin().rpc("cleanup_webhook_events");
  const result = await runCampaignBatches(45_000);
  return NextResponse.json({ ok: true, webhooks, ...result });
}

// Called every minute by Supabase pg_cron (POST) or Vercel Cron (GET).
export const GET = handle;
export const POST = handle;
