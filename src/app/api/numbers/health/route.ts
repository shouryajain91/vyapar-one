import { NextResponse } from "next/server";
import { GRAPH_VERSION, getWaContext, graphErrorMessage, noteGraphFailure } from "@/lib/wa-context";

// Live status of the active number straight from Meta: display name review,
// quality rating and daily messaging limit.
export async function GET() {
  const ctx = await getWaContext();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const fields =
    "verified_name,display_phone_number,name_status,new_name_status,quality_rating,messaging_limit_tier,status";
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${ctx.phoneNumberId}?fields=${fields}`,
    { headers: { Authorization: `Bearer ${ctx.accessToken}` }, cache: "no-store" }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    await noteGraphFailure(ctx, data, res.status);
    return NextResponse.json({ error: graphErrorMessage(data) }, { status: 502 });
  }
  return NextResponse.json({
    verified_name: data.verified_name ?? null,
    display_phone_number: data.display_phone_number ?? null,
    name_status: data.name_status ?? null,
    new_name_status: data.new_name_status ?? null,
    quality_rating: data.quality_rating ?? null,
    messaging_limit_tier: data.messaging_limit_tier ?? null,
    status: data.status ?? null,
  });
}
