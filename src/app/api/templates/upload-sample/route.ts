import { NextRequest, NextResponse } from "next/server";
import { GRAPH_VERSION, getWaContext, graphErrorMessage } from "@/lib/wa-context";
import { SAMPLE_MAX_BYTES, SAMPLE_RULES } from "@/lib/template-validate";

/**
 * Uploads a SAMPLE file for a template's image/video/PDF header to Meta's
 * Resumable Upload API and returns the handle Meta wants in the template.
 * The sample is only what Meta's reviewers see; the real file is supplied
 * when the template is sent.
 */
export async function POST(req: NextRequest) {
  const ctx = await getWaContext();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const format = String(form?.get("format") ?? "") as keyof typeof SAMPLE_RULES;
  if (!(file instanceof File) || !SAMPLE_RULES[format]) {
    return NextResponse.json({ error: "Choose a file and header type" }, { status: 400 });
  }
  const rule = SAMPLE_RULES[format];
  if (!rule.types.includes(file.type)) {
    return NextResponse.json({ error: `For this header, upload a ${rule.label} file.` }, { status: 400 });
  }
  if (file.size > SAMPLE_MAX_BYTES) {
    return NextResponse.json(
      { error: "Sample file must be under 4 MB. A small sample is fine, you choose the real file when sending." },
      { status: 400 }
    );
  }

  const appId = process.env.META_APP_ID!;
  const bytes = Buffer.from(await file.arrayBuffer());

  // Try the client's token first, then the app token.
  const tokens = [ctx.accessToken, `${appId}|${process.env.META_APP_SECRET}`];
  let lastError = "Upload failed";

  for (const token of tokens) {
    try {
      const startUrl =
        `https://graph.facebook.com/${GRAPH_VERSION}/${appId}/uploads` +
        `?file_name=${encodeURIComponent(file.name)}&file_length=${bytes.length}` +
        `&file_type=${encodeURIComponent(file.type)}`;
      const startRes = await fetch(startUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const start = await startRes.json().catch(() => ({}));
      if (!startRes.ok || !start.id) {
        lastError = graphErrorMessage(start);
        console.error("Upload session failed:", JSON.stringify(start));
        continue;
      }

      const upRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${start.id}`, {
        method: "POST",
        headers: { Authorization: `OAuth ${token}`, file_offset: "0" },
        body: bytes,
      });
      const up = await upRes.json().catch(() => ({}));
      if (upRes.ok && up.h) {
        return NextResponse.json({ handle: up.h, name: file.name });
      }
      lastError = graphErrorMessage(up);
      console.error("Upload failed:", JSON.stringify(up));
    } catch (err) {
      console.error("Upload threw:", err);
    }
  }
  return NextResponse.json({ error: lastError }, { status: 502 });
}
