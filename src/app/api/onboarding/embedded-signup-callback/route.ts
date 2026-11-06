import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRSC } from "@/lib/supabase-rsc";
import { supabaseAdmin } from "@/lib/supabase-server";
import { ACTIVE_NUMBER_COOKIE } from "@/lib/wa-accounts";
import { encrypt } from "@/lib/crypto";
import { generatePin, registerPhoneNumber } from "@/lib/whatsapp-register";

const GRAPH_VERSION = "v21.0";

interface CallbackBody {
  client_id?: string; // ignored: the client is always taken from the session
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

  const { code, waba_id, phone_number_id } = body;
  if (!code || !waba_id || !phone_number_id) {
    return NextResponse.json(
      { error: "code, waba_id, and phone_number_id are required" },
      { status: 400 }
    );
  }

  // The client comes from the signed-in session, never from the request body.
  const supabase = await supabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const adminDb = supabaseAdmin();
  const { data: appUser } = await adminDb
    .from("app_users")
    .select("client_id")
    .eq("user_id", user.id)
    .single();
  if (!appUser) return NextResponse.json({ error: "No client for user" }, { status: 403 });
  const client_id: string = appUser.client_id;

  // A number that already belongs to another business can't be taken over.
  const { data: existing } = await adminDb
    .from("whatsapp_accounts")
    .select("client_id")
    .eq("phone_number_id", phone_number_id)
    .maybeSingle();
  if (existing && existing.client_id !== client_id) {
    return NextResponse.json({ error: "This number is already connected to another account" }, { status: 409 });
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
  // Meta requires a 6-digit PIN; we generate one and keep it (encrypted).
  const pin = generatePin();
  let registered = false;
  try {
    registered = (await registerPhoneNumber(phone_number_id, accessToken, pin)).ok;
  } catch (err) {
    console.error("Phone number register call threw:", err);
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
        verification_status: registered ? "connected" : "pending_registration",
        registration_pin_encrypted: encrypt(pin),
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

  // Work with the number that was just connected.
  (await cookies()).set(ACTIVE_NUMBER_COOKIE, phone_number_id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({
    success: true,
    registered,
    display_name: displayName,
  });
}
