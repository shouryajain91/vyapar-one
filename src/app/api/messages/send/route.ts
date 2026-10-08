import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { decrypt } from "@/lib/crypto";

const GRAPH_VERSION = "v21.0";

interface SendRequestBody {
  client_id: string;
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

  const { client_id, to, type } = body;
  if (!client_id || !to || !type) {
    return NextResponse.json(
      { error: "client_id, to, and type are required" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

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
