import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { decrypt } from "@/lib/crypto";
import { supabaseRSC } from "@/lib/supabase-rsc";

const GRAPH_VERSION = "v21.0";

interface SendRequestBody {
  client_id?: string; // ignored: the client is taken from the login session
  to: string; // E.164 format, e.g. 919876543210
  type: "text" | "template";
  text?: string;
  template_name?: string;
  template_language?: string; // e.g. "en_US"
  template_params?: string[]; // positional {{1}}, {{2}}... body params
}

export async function POST(req: NextRequest) {
  let body: SendRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { to, type } = body;
  if (!to || !type) {
    return NextResponse.json({ error: "to and type are required" }, { status: 400 });
  }

  // Who is calling? The client always comes from the session, never the body.
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
  const client_id = appUser.client_id;

  // TODO: add per-client rate limiting here before going to production
  // with multiple real clients, so one client can't exhaust shared quota.

  const { data: account, error: accountError } = await db
    .from("whatsapp_accounts")
    .select("phone_number_id, access_token_encrypted")
    .eq("client_id", client_id)
    .single();

  if (accountError || !account) {
    return NextResponse.json(
      { error: "No connected WhatsApp account for this client" },
      { status: 404 }
    );
  }

  const accessToken = decrypt(account.access_token_encrypted);

  const payload = buildGraphPayload(to, body);

  const graphRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${account.phone_number_id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const graphData = await graphRes.json();

  if (!graphRes.ok) {
    console.error("WhatsApp send failed:", graphData);
    return NextResponse.json(
      { error: "WhatsApp API error", details: graphData },
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
    body: type === "text" ? body.text : body.template_name,
    status: "sent",
    raw_payload: payload,
  });

  return NextResponse.json({ success: true, wa_message_id: waMessageId });
}

function buildGraphPayload(to: string, body: SendRequestBody) {
  if (body.type === "text") {
    return {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: body.text ?? "" },
    };
  }

  // template
  return {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: body.template_name,
      language: { code: body.template_language ?? "en_US" },
      components: body.template_params?.length
        ? [
            {
              type: "body",
              parameters: body.template_params.map((p) => ({
                type: "text",
                text: p,
              })),
            },
          ]
        : [],
    },
  };
}
