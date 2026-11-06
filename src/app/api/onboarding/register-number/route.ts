import { NextResponse } from "next/server";
import { supabaseRSC } from "@/lib/supabase-rsc";
import { supabaseAdmin } from "@/lib/supabase-server";
import { decrypt, encrypt } from "@/lib/crypto";
import { generatePin, registerPhoneNumber } from "@/lib/whatsapp-register";

// Retries Cloud API registration for the logged-in client's number.
export async function POST() {
  const supabase = await supabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data: appUser } = await db
    .from("app_users")
    .select("client_id")
    .eq("user_id", user.id)
    .single();
  if (!appUser) {
    return NextResponse.json({ error: "No client for user" }, { status: 403 });
  }

  const { data: account } = await db
    .from("whatsapp_accounts")
    .select("id, phone_number_id, access_token_encrypted, registration_pin_encrypted")
    .eq("client_id", appUser.client_id)
    .maybeSingle();
  if (!account) {
    return NextResponse.json({ error: "Connect WhatsApp first" }, { status: 404 });
  }

  const accessToken = decrypt(account.access_token_encrypted);
  // Reuse the stored PIN if there is one, otherwise make a new one.
  const pin = account.registration_pin_encrypted
    ? decrypt(account.registration_pin_encrypted)
    : generatePin();

  const { ok, data } = await registerPhoneNumber(
    account.phone_number_id,
    accessToken,
    pin
  );

  if (!ok) {
    await db
      .from("whatsapp_accounts")
      .update({ verification_status: "pending_registration" })
      .eq("id", account.id);
    const message =
      (data as { error?: { message?: string } })?.error?.message ??
      "Meta rejected the registration";
    return NextResponse.json({ error: message, details: data }, { status: 502 });
  }

  await db
    .from("whatsapp_accounts")
    .update({
      verification_status: "connected",
      registration_pin_encrypted: encrypt(pin),
    })
    .eq("id", account.id);

  return NextResponse.json({ success: true });
}
