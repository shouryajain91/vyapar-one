import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { GRAPH_VERSION, getWaContext, graphErrorMessage, noteGraphFailure } from "@/lib/wa-context";
import { buildComponents, validateTemplate, type TemplateInput } from "@/lib/template-validate";

// Create a message template on the client's WhatsApp account (goes to Meta for review).
export async function POST(req: NextRequest) {
  const ctx = await getWaContext();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  let input: TemplateInput;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  input = {
    name: String(input.name ?? "").trim(),
    category: String(input.category ?? ""),
    language: String(input.language ?? ""),
    body: String(input.body ?? ""),
    examples: Array.isArray(input.examples) ? input.examples.map(String) : [],
    header: input.header,
    footer: input.footer ? String(input.footer) : undefined,
    buttons: Array.isArray(input.buttons) ? input.buttons : [],
  };

  const problem = validateTemplate(input);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const payload = {
    name: input.name,
    language: input.language,
    category: input.category,
    components: buildComponents(input),
  };

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${ctx.wabaId}/message_templates`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    await noteGraphFailure(ctx, data, res.status);
    console.error("Template create failed:", JSON.stringify(data));
    return NextResponse.json({ error: graphErrorMessage(data) }, { status: 400 });
  }

  const { error } = await supabaseAdmin()
    .from("templates")
    .upsert(
      {
        client_id: ctx.clientId,
        meta_template_id: data.id ?? null,
        name: input.name,
        language: input.language,
        category: data.category ?? input.category,
        status: data.status ?? "PENDING",
        body: input.body.trim(),
        header_format: input.header && input.header.format !== "NONE" ? input.header.format : null,
        header_text: input.header?.format === "TEXT" ? (input.header.text ?? "").trim() : null,
        footer: (input.footer ?? "").trim() || null,
        buttons: (input.buttons ?? []).length
          ? [...(input.buttons ?? [])].sort(
              (a, b) =>
                ({ QUICK_REPLY: 0, URL: 1, PHONE_NUMBER: 2 }[a.type] -
                  { QUICK_REPLY: 0, URL: 1, PHONE_NUMBER: 2 }[b.type])
            )
          : null,
        rejected_reason: null,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "client_id,name,language" }
    );
  if (error) console.error("Template save failed:", error);

  return NextResponse.json({ success: true, status: data.status ?? "PENDING" });
}

// Delete a template (all languages of that name) from the client's WhatsApp account.
export async function DELETE(req: NextRequest) {
  const ctx = await getWaContext();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const name = new URL(req.url).searchParams.get("name") ?? "";
  if (!/^[a-z0-9_]{1,512}$/.test(name)) {
    return NextResponse.json({ error: "Invalid template name" }, { status: 400 });
  }

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${ctx.wabaId}/message_templates?name=${encodeURIComponent(name)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${ctx.accessToken}` } }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    await noteGraphFailure(ctx, data, res.status);
    console.error("Template delete failed:", JSON.stringify(data));
    return NextResponse.json({ error: graphErrorMessage(data) }, { status: 400 });
  }

  await supabaseAdmin()
    .from("templates")
    .delete()
    .eq("client_id", ctx.clientId)
    .eq("name", name);

  return NextResponse.json({ success: true });
}
