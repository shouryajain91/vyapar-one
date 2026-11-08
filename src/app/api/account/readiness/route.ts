import { NextResponse } from "next/server";
import { GRAPH_VERSION, getWaContext, graphErrorMessage } from "@/lib/wa-context";
import { supabaseAdmin } from "@/lib/supabase-server";

interface HealthEntity {
  entity_type?: string;
  can_send_message?: string;
  errors?: Array<{ error_code?: number; error_description?: string; possible_solution?: string }>;
}

/**
 * Can this business send messages right now, and is billing set up?
 * Meta does not expose the balance or credit amount to apps, so this reports
 * what it does expose (send health, funding attached, verification) plus
 * payment failures we have actually seen on this business's own sends.
 */
export async function GET() {
  const ctx = await getWaContext();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const call = async (fields: string) => {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${ctx.wabaId}?fields=${fields}`, {
      headers: { Authorization: `Bearer ${ctx.accessToken}` },
      cache: "no-store",
    });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  };

  // Ask for everything; if Meta rejects one field, retry with the core set.
  let r = await call("health_status,primary_funding_id,status,business_verification_status,currency,whatsapp_business_manager_messaging_limit");
  if (!r.ok) r = await call("health_status,primary_funding_id,status");
  if (!r.ok) return NextResponse.json({ error: graphErrorMessage(r.data) }, { status: 502 });
  const d = r.data as {
    health_status?: { can_send_message?: string; entities?: HealthEntity[] };
    primary_funding_id?: string | null;
    status?: string;
    business_verification_status?: string;
    currency?: string;
    whatsapp_business_manager_messaging_limit?: string;
  };

  const issues = (d.health_status?.entities ?? []).flatMap((e) =>
    (e.errors ?? []).map((er) => ({
      area: e.entity_type ?? "account",
      code: er.error_code != null ? String(er.error_code) : null,
      text: er.error_description ?? "Meta reported a problem.",
      fix: er.possible_solution ?? null,
    }))
  );

  // Payment failures seen on our own sends (error 131042 = payment problem).
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const { count, data: last } = await supabaseAdmin()
    .from("messages")
    .select("created_at", { count: "exact" })
    .eq("client_id", ctx.clientId)
    .eq("error_code", "131042")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);

  const funding = d.primary_funding_id;
  return NextResponse.json({
    can_send_message: d.health_status?.can_send_message ?? null,
    issues,
    funding_attached: funding == null ? null : funding !== "" && funding !== "0",
    account_status: d.status ?? null,
    business_verification: d.business_verification_status ?? null,
    currency: d.currency ?? null,
    messaging_limit: d.whatsapp_business_manager_messaging_limit ?? null,
    recent_payment_failures: count ?? 0,
    last_payment_failure_at: last?.[0]?.created_at ?? null,
  });
}
