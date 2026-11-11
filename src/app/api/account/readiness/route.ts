import { NextResponse } from "next/server";
import { GRAPH_VERSION, getWaContext, noteGraphFailure } from "@/lib/wa-context";
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

  // Request each field on its own. Meta only shares some of them (send health,
  // funding, verification) with apps whose business is an approved solution
  // provider, and one refused field would otherwise fail the whole request.
  const FIELDS = [
    "health_status",
    "primary_funding_id",
    "status",
    "business_verification_status",
    "currency",
    "whatsapp_business_manager_messaging_limit",
  ];
  const results = await Promise.all(
    FIELDS.map(async (field) => {
      try {
        const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${ctx.wabaId}?fields=${field}`, {
          headers: { Authorization: `Bearer ${ctx.accessToken}` },
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        return { field, ok: res.ok, data: await res.json().catch(() => ({})) };
      } catch {
        return { field, ok: false, data: {} };
      }
    })
  );
  const denied = results.find((r) => !r.ok && String((r.data as { error?: { code?: number } })?.error?.code) === "190");
  if (denied) await noteGraphFailure(ctx, denied.data as { error?: { code?: number; message?: string } });
  const unavailable = results.filter((r) => !r.ok).map((r) => r.field);
  const d = Object.assign({}, ...results.filter((r) => r.ok).map((r) => r.data)) as {
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
    unavailable,
    funding_attached: funding == null ? null : funding !== "" && funding !== "0",
    account_status: d.status ?? null,
    business_verification: d.business_verification_status ?? null,
    currency: d.currency ?? null,
    messaging_limit: d.whatsapp_business_manager_messaging_limit ?? null,
    recent_payment_failures: count ?? 0,
    last_payment_failure_at: last?.[0]?.created_at ?? null,
  });
}
