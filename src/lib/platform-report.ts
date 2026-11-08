import { supabaseAdmin } from "@/lib/supabase-server";
import type { ReportFilters } from "@/lib/reports";

export interface BusinessRow {
  clientId: string;
  name: string;
  email: string | null;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  received: number;
  lastActivity: string | null;
}

/** Per-business message totals for the period, plus the platform's top failure reasons. */
export async function loadPlatformReport(f: Pick<ReportFilters, "from" | "to">) {
  const db = supabaseAdmin();
  const args = { p_from: `${f.from}T00:00:00+05:30`, p_to: `${f.to}T23:59:59.999+05:30` };
  const [stats, reasons, clients] = await Promise.all([
    db.rpc("platform_message_report", args),
    db.rpc("platform_failure_reasons", args),
    db.from("clients").select("id, business_name, contact_email"),
  ]);

  const byClient = new Map((stats.data ?? []).map((r: Record<string, unknown>) => [r.client_id as string, r]));
  const rows: BusinessRow[] = (clients.data ?? []).map((c) => {
    const s = byClient.get(c.id) as Record<string, string | number | null> | undefined;
    return {
      clientId: c.id,
      name: c.business_name,
      email: c.contact_email ?? null,
      sent: Number(s?.sent ?? 0),
      delivered: Number(s?.delivered ?? 0),
      read: Number(s?.read ?? 0),
      failed: Number(s?.failed ?? 0),
      received: Number(s?.received ?? 0),
      lastActivity: (s?.last_activity as string | null) ?? null,
    };
  });
  rows.sort((a, b) => b.sent + b.received - (a.sent + a.received));

  const totals = rows.reduce(
    (t, r) => ({
      sent: t.sent + r.sent,
      delivered: t.delivered + r.delivered,
      read: t.read + r.read,
      failed: t.failed + r.failed,
      received: t.received + r.received,
    }),
    { sent: 0, delivered: 0, read: 0, failed: 0, received: 0 }
  );
  const topReasons = (reasons.data ?? []) as { error_code: string | null; error_message: string | null; n: number }[];
  return { rows, totals, topReasons, error: stats.error?.message ?? null };
}
