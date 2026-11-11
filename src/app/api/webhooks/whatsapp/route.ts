import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { processWebhookQueue, type WhatsAppWebhookPayload } from "@/lib/webhook-processor";

/**
 * GET: Meta's webhook verification handshake.
 * Called once when you register the webhook URL in the App Dashboard.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * POST: incoming messages and status updates from WhatsApp.
 * Always ack with 200 quickly; Meta retries aggressively on non-200s.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Verify the request actually came from Meta.
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifySignature(rawBody, signature)) {
    console.warn("WhatsApp webhook: invalid signature");
    return new NextResponse("Invalid signature", { status: 403 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  // Store first, process after the reply: Meta gets its 200 in milliseconds and
  // nothing is lost if processing fails (it is retried by the queue).
  const { error } = await supabaseAdmin().from("webhook_events").insert({ payload });
  if (error) {
    console.error("Could not queue webhook event:", error.message);
    // 500 makes Meta re-deliver later, so the event isn't lost.
    return new NextResponse("Try again", { status: 500 });
  }
  after(() => processWebhookQueue(20).catch((e) => console.error("webhook queue run failed", e)));

  return new NextResponse("OK", { status: 200 });
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signatureHeader)
    );
  } catch {
    return false;
  }
}

