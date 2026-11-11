import { isTokenError, markTokenInvalid } from "@/lib/alerts";
import { NextRequest, NextResponse } from "next/server";
import { pickActive } from "@/lib/wa-accounts";
import { getSessionContext } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import { decrypt } from "@/lib/crypto";
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
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const db = supabaseAdmin();
  const client_id = ctx.client_id;

  // TODO: add per-client rate limiting here before going to production
  // with multiple real clients, so one client can't exhaust shared quota.

  const { active: account } = await pickActive(ctx.accounts);

  if (!account) {
    return NextResponse.json({ error: "No connected WhatsApp account for this client" }, { status: 404 });
  }
  if (account.verification_status === "pending_registration") {
    return NextResponse.json(
      { error: "Your number isn't registered yet. Finish registration on the dashboard first." },
      { status: 409 }
    );
  }

  // Never send a template to someone who asked to stop (STOP / unsubscribe).
  if (type === "template") {
    const { data: optedOut } = await db
      .from("opt_outs")
      .select("id")
      .eq("client_id", client_id)
      .eq("phone", to)
      .eq("status", "opted_out")
      .maybeSingle();
    if (optedOut) {
      return NextResponse.json(
        {
          error: "opted_out",
          message: "This customer has asked to stop receiving messages, so the template wasn't sent. You can opt them back in from the Opt-outs page if they asked to hear from you again.",
        },
        { status: 403 }
      );
    }
  }

  if (account.token_status === "invalid") {
    return NextResponse.json(
      { error: "token_expired", message: "Your WhatsApp connection has expired. Open the dashboard and tap Reconnect WhatsApp." },
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
    if (isTokenError(graphData?.error?.code, graphRes.status)) await markTokenInvalid(client_id, account.phone_number_id, graphData?.error?.message);
    console.error("WhatsApp send failed:", JSON.stringify(graphData));
    const msg: string | undefined = graphData?.error?.error_user_msg ?? graphData?.error?.message;
    // Keep a record of the failed attempt so it shows in the chat with the reason.
    await db.from("messages").insert({
      client_id,
      direction: "outbound",
      from_number: account.phone_number_id,
      phone_number_id: account.phone_number_id,
      to_number: to,
      message_type: type,
      body: storedBody,
      status: "failed",
      error_code: graphData?.error?.code != null ? String(graphData.error.code) : null,
      error_message: [msg, graphData?.error?.error_data?.details].filter(Boolean).join(" — ") || null,
      template_name: (payload as { template?: { name?: string } }).template?.name ?? null,
    raw_payload: payload,
    });
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
    phone_number_id: account.phone_number_id,
    to_number: to,
    message_type: type,
    body: storedBody,
    status: "sent",
    template_name: (payload as { template?: { name?: string } }).template?.name ?? null,
    raw_payload: payload,
  });

  return NextResponse.json({ success: true, wa_message_id: waMessageId, to });
}
