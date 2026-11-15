import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { GRAPH_VERSION, getWaContext, graphErrorMessage, noteGraphFailure } from "@/lib/wa-context";

// Live status of the active number straight from Meta: display name review,
// quality rating and daily messaging limit.
export async function GET() {
  const ctx = await getWaContext();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const fields =
    "verified_name,display_phone_number,name_status,new_display_name,new_name_status,quality_rating,messaging_limit_tier,status";
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${ctx.phoneNumberId}?fields=${fields}`,
    { headers: { Authorization: `Bearer ${ctx.accessToken}` }, cache: "no-store" }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    await noteGraphFailure(ctx, data, res.status);
    return NextResponse.json({ error: graphErrorMessage(data) }, { status: 502 });
  }
  // Keep the name shown in the app in step once Meta has approved it.
  if (data.name_status === "APPROVED" && data.verified_name) {
    await supabaseAdmin()
      .from("whatsapp_accounts")
      .update({ display_name: data.verified_name })
      .eq("client_id", ctx.clientId)
      .eq("phone_number_id", ctx.phoneNumberId)
      .neq("display_name", data.verified_name);
  }
  return NextResponse.json({
    new_display_name: data.new_display_name ?? null,
    verified_name: data.verified_name ?? null,
    display_phone_number: data.display_phone_number ?? null,
    name_status: data.name_status ?? null,
    new_name_status: data.new_name_status ?? null,
    quality_rating: data.quality_rating ?? null,
    messaging_limit_tier: data.messaging_limit_tier ?? null,
    status: data.status ?? null,
  });
}
