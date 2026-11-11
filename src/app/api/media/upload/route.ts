import { NextRequest, NextResponse } from "next/server";
import { GRAPH_VERSION, getWaContext, graphErrorMessage, noteGraphFailure } from "@/lib/wa-context";
import { SAMPLE_MAX_BYTES, SAMPLE_RULES } from "@/lib/template-validate";

/**
 * Uploads the real image/video/PDF for a template header to WhatsApp and
 * returns its media id. (Limited to ~4 MB by the hosting request cap.)
 */
export async function POST(req: NextRequest) {
  const ctx = await getWaContext();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const format = String(form?.get("format") ?? "") as keyof typeof SAMPLE_RULES;
  if (!(file instanceof File) || !SAMPLE_RULES[format]) {
    return NextResponse.json({ error: "Choose a file" }, { status: 400 });
  }
  const rule = SAMPLE_RULES[format];
  if (!rule.types.includes(file.type)) {
    return NextResponse.json({ error: `Upload a ${rule.label} file.` }, { status: 400 });
  }
  if (file.size > SAMPLE_MAX_BYTES) {
    return NextResponse.json(
      { error: "File must be under 4 MB. For larger files, paste a public https link instead." },
      { status: 400 }
    );
  }

  const fd = new FormData();
  fd.append("messaging_product", "whatsapp");
  fd.append("type", file.type);
  fd.append("file", file, file.name);

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${ctx.phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ctx.accessToken}` },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    await noteGraphFailure(ctx, data, res.status);
    console.error("Media upload failed:", JSON.stringify(data));
    return NextResponse.json({ error: graphErrorMessage(data) }, { status: 502 });
  }
  return NextResponse.json({ id: data.id, name: file.name });
}
