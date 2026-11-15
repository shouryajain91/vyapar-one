import { NextResponse } from "next/server";
import { GRAPH_VERSION, getWaContext, graphErrorMessage, noteGraphFailure } from "@/lib/wa-context";
import { cleanDisplayName, validateDisplayName } from "@/lib/display-name";

// Asks Meta to change the WhatsApp display name of the active number. Meta reviews it
// (usually 1-2 days); the result arrives by webhook and shows on the dashboard.
export async function POST(req: Request) {
  const ctx = await getWaContext();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  if (typeof body.name !== "string") return NextResponse.json({ error: "Enter the new name." }, { status: 400 });
  const name = cleanDisplayName(body.name);
  const problem = validateDisplayName(name);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${ctx.phoneNumberId}?${new URLSearchParams({ new_display_name: name })}`;
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${ctx.accessToken}` }, signal: AbortSignal.timeout(20_000) });
  } catch {
    return NextResponse.json({ error: "Couldn't reach Meta. Please try again." }, { status: 502 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    await noteGraphFailure(ctx, data, res.status);
    return NextResponse.json({ error: graphErrorMessage(data) }, { status: 502 });
  }
  return NextResponse.json({ success: true, name });
}
