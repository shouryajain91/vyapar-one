import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { encrypt } from "@/lib/crypto";

const GRAPH_VERSION = "v21.0";

interface CallbackBody {
  client_id: string; // your internal client id (from the logged-in session)
  code: string; // authorization code from FB.login
  waba_id: string; // from the Embedded Signup postMessage event
  phone_number_id: string; // from the Embedded Signup postMessage event
}

export async function POST(req: NextRequest) {
  let body: CallbackBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { client_id, code, waba_id, phone_number_id } = body;
  if (!client_id || !code || !waba_id || !phone_number_id) {
    return NextResponse.json(
      { error: "client_id, code, waba_id, and phone_number_id are required" },
      { status: 400 }
    );
  }

  // Exchange the authorization code for an access token.
  const tokenUrl = new URL(
    `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`
  );
  tokenUrl.searchParams.set("client_id", process.env.META_APP_ID!);
  tokenUrl.searchParams.set("client_secret", process.env.META_APP_SECRET!);
  tokenUrl.searchParams.set("code", code);

  const tokenRes = await fetch(tokenUrl.toString());
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    console.error("Token exchange failed:", tokenData);
    return NextResponse.json(
      { error: "Failed to exchange code for token", details: tokenData },
      { status: 400 }
    );
  }

  const accessToken: string = tokenData.access_token;

  // Fetch the phone number's display name for our own records.
  let displayName: string | null = null;
  try {
    const phoneRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phone_number_id}?fields=verified_name`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const phoneData = await phoneRes.json();
    displayName = phoneData.verified_name ?? null;
  } catch (err) {
    console.warn("Could not fetch verified_name:", err);
  }

  // Register the number on the Cloud API (required before it can send/receive).
  try {
    await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phone_number_id}/register`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messaging_product: "whatsapp" }),
      }
    );
  } catch (err) {
    // Not fatal — number may already be registered. Log and continue.
    console.warn("Phone number register call failed (may be benign):", err);
  }

  // Subscribe our app to THIS WABA's webhook events. The app-level webhook
  // URL/verify-token you configure in the Meta Dashboard only tells Meta
  // where to send events for WABAs that have subscribed your app — it does
  // nothing on its own. Without this call, you'd register the number fine
  // but never actually receive incoming messages or status updates for it.
  try {
    const subRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${waba_id}/subscribed_apps`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    const subData = await subRes.json();
    if (!subRes.ok) {
      console.error("Failed to subscribe app to WABA webhooks:", subData);
    }
  } catch (err) {
    console.error("subscribed_apps call failed:", err);
  }

  const db = supabaseAdmin();
  const { error: upsertError } = await db
    .from("whatsapp_accounts")
    .upsert(
      {
        client_id,
        waba_id,
        phone_number_id,
        display_name: displayName,
        access_token_encrypted: encrypt(accessToken),
        verification_status: "connected",
      },
      { onConflict: "phone_number_id" }
    );

  if (upsertError) {
    console.error("Failed to store whatsapp_account:", upsertError);
    return NextResponse.json(
      { error: "Failed to save connection" },
      { status: 500 }
    );
  }

  await db
    .from("clients")
    .update({ status: "active" })
    .eq("id", client_id);

  return NextResponse.json({ success: true, display_name: displayName });
}
