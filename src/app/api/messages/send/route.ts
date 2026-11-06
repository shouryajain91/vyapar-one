import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { decrypt } from "@/lib/crypto";
import { supabaseRSC } from "@/lib/supabase-rsc";
import { normalizeNumber } from "@/lib/phone";
import { buildSendComponents, type SendInput, type SendableTemplate } from "@/lib/template-send";

const GRAPH_VERSION = "v21.0";

interface SendRequestBody extends SendInput {
  client_id?: string; // ignored: the client is taken from the login session
  to: string; // customer number; digits with country code, e.g. 919876543210
  type: "text" | "template";
  text?: string;
  template_name?: string;
  template_language?: string; // e.g. "en_US"
}

export async function POST(req: NextRequest) {
  let body: SendRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type } = body;
  const to = normalizeNumber(String(body.to ?? ""));
  if (!to || !type) {
    return NextResponse.json(
      { error: "Enter the customer's number with country code, like +919876543210." },
      { status: 400 }
    );
  }

  // Who is calling? The client always comes from the session, never the body.
  const supabase = await supabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: appUser } = await db
    .from("app_users")
    .select("client_id")
    .eq("user_id", user.id)
    .single();
  if (!appUser) return NextResponse.json({ error: "No client for user" }, { status: 403 });
  const client_id = appUser.client_id;

  // TODO: add per-client rate limiting here before going to production
  // with multiple real clients, so one client can't exhaust shared quota.

  const { data: account, error: accountError } = await db
    .from("whatsapp_accounts")
    .select("phone_number_id, access_token_encrypted, verification_status")
    .eq("client_id", client_id)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: "No connected WhatsApp account for this client" }, { status: 404 });
  }
  if (account.verification_status === "pending_registration") {
    return NextResponse.json(
      { error: "Your number isn't registered yet. Finish registration on the dashboard first." },
      { status: 409 }
    );
  }

  const accessToken = decrypt(account.access_token_encrypted);

  let payload: Record<string, unknown>;
  let storedBody: string | null;

  if (type === "text") {
    payload = { messaging_product: "whatsapp", to, type: "text", text: { body: body.text ?? "" } };
    storedBody = body.text ?? null;
  } else {
    // Build from the stored, approved template, never from client-supplied structure.
    const { data: tpl } = await db
      .from("templates")
      .select("name, language, status, body, header_format, header_text, footer, buttons")
      .eq("client_id", client_id)
      .eq("name", body.template_name ?? "")
      .eq("language", body.template_language ?? "")
      .maybeSingle();
    if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    if (tpl.status !== "APPROVED") {
      return NextResponse.json(
        { error: `This template is ${tpl.status ?? "not approved"} and can't be sent yet.` },
        { status: 400 }
      );
    }

    try {
      const built = buildSendComponents(tpl as SendableTemplate, body);
      payload = {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: tpl.name,
          language: { code: tpl.language },
          components: built.components,
        },
      };
      storedBody = built.rendered || tpl.name;
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  const graphRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${account.phone_number_id}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  const graphData = await graphRes.json();

  if (!graphRes.ok) {
    console.error("WhatsApp send failed:", JSON.stringify(graphData));
    const msg: string | undefined = graphData?.error?.error_user_msg ?? graphData?.error?.message;
    return NextResponse.json(
      { error: "WhatsApp API error", message: msg, details: graphData },
      { status: graphRes.status }
    );
  }

  const waMessageId = graphData.messages?.[0]?.id ?? null;

  await db.from("messages").insert({
    client_id,
    wa_message_id: waMessageId,
    direction: "outbound",
    from_number: account.phone_number_id,
    to_number: to,
    message_type: type,
    body: storedBody,
    status: "sent",
    raw_payload: payload,
  });

  return NextResponse.json({ success: true, wa_message_id: waMessageId, to });
}
