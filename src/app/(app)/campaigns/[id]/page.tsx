export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentClient } from "@/lib/current-client";
import { supabaseAdmin } from "@/lib/supabase-server";
import { formatDateTime, formatNumber } from "@/lib/format";
import { explainError } from "@/lib/wa-errors";
import { CAMPAIGN_LABEL, CAMPAIGN_TONE } from "@/lib/campaign-status";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Badge, Card, LinkButton, PageContainer, PageHeader, inputCls, buttonClass } from "@/components/ui";
import { cancelCampaignAction } from "../actions";

const PAGE = 50;
const FILTERS = ["all", "pending", "sent", "failed", "skipped"] as const;
const RTONE: Record<string, "green" | "amber" | "red" | "slate" | "brand"> = {
  pending: "amber", sending: "amber", sent: "brand", failed: "red", skipped: "slate", cancelled: "slate",
};

export default async function CampaignDetail({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const { client } = await getCurrentClient();
  const db = supabaseAdmin();

  const { data: c } = await db.from("campaigns").select("*").eq("id", id).eq("client_id", client!.id).maybeSingle();
  if (!c) notFound();

  const status = FILTERS.includes(sp.status as never) ? (sp.status as string) : "all";
  const q = (sp.q ?? "").replace(/[^\d+]/g, "").replace("+", "");
  const page = Math.max(1, Number(sp.page) || 1);

  let rq = db.from("campaign_recipients").select("id, phone, contact_name, status, error_message, message_id, sent_at", { count: "exact" })
    .eq("campaign_id", id);
  if (status === "pending") rq = rq.in("status", ["pending", "sending"]);
  else if (status !== "all") rq = rq.eq("status", status);
  if (q) rq = rq.ilike("phone", `%${q}%`);

  const [{ data: stats }, { data: recips, count }] = await Promise.all([
    db.rpc("campaign_stats", { p_client: client!.id }),
    rq.order("phone").range((page - 1) * PAGE, page * PAGE - 1),
  ]);
  const s = ((stats ?? []) as { campaign_id: string; pending: number; sent: number; delivered: number; read: number; failed: number; skipped: number }[])
    .find((x) => x.campaign_id === id);

  const msgIds = (recips ?? []).map((r) => r.message_id).filter(Boolean) as string[];
  const { data: msgs } = msgIds.length
    ? await db.from("messages").select("id, status, error_code, error_message, delivered_at, read_at").in("id", msgIds)
    : { data: [] };
  const mById = new Map((msgs ?? []).map((m) => [m.id, m]));

  const done = (s?.sent ?? 0) + (s?.failed ?? 0) + (s?.skipped ?? 0);
  const pct = c.total ? Math.round((done / c.total) * 100) : 0;
  const active = c.status === "running" || c.status === "scheduled";
  const qs = (o: Record<string, string | number>) =>
    "?" + new URLSearchParams({ status, ...(q ? { q } : {}), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) });
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));

  const stat = (label: string, value: number | string) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );

  return (
    <PageContainer>
      {active && <AutoRefresh />}
      <PageHeader
        back={<Link href="/campaigns" className="text-sm text-slate-500 hover:text-slate-900">← Campaigns</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{c.name} <Badge tone={CAMPAIGN_TONE[c.status]}>{CAMPAIGN_LABEL[c.status] ?? c.status}</Badge></span>}
        description={`Template ${c.template_name} · ${c.status === "scheduled" ? "starts" : "started"} ${formatDateTime(c.scheduled_at)} IST`}
        actions={
          <>
            <LinkButton href={`/api/campaigns/${id}/export`} variant="secondary">Export CSV</LinkButton>
            {active && (
              <form action={cancelCampaignAction}>
                <input type="hidden" name="id" value={id} />
                <button className={buttonClass("secondary")} type="submit">Cancel campaign</button>
              </form>
            )}
          </>
        }
      />

      {active && (
        <div className="mb-6">
          <div className="mb-1 flex justify-between text-xs text-slate-500"><span>{done} of {c.total} processed</span><span>{pct}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} /></div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stat("Total", c.total)}{stat("Waiting", s?.pending ?? 0)}{stat("Delivered", s?.delivered ?? 0)}
        {stat("Read", s?.read ?? 0)}{stat("Failed", s?.failed ?? 0)}{stat("Skipped", s?.skipped ?? 0)}
      </div>

      <Card className="!p-0">
        <form className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <select name="status" defaultValue={status} className={inputCls + " max-w-40"}>
            {FILTERS.map((f) => <option key={f} value={f}>{f === "all" ? "All recipients" : f[0].toUpperCase() + f.slice(1)}</option>)}
          </select>
          <input name="q" defaultValue={q} placeholder="Search number" className={inputCls + " max-w-52"} />
          <button className={buttonClass("secondary")} type="submit">Filter</button>
        </form>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Sent</th><th className="px-4 py-3">Delivered</th><th className="px-4 py-3">Read</th><th className="px-4 py-3">Reason</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(recips ?? []).map((r) => {
                const m = r.message_id ? mById.get(r.message_id) : undefined;
                const shown = m?.status === "failed" ? "failed" : m?.status === "read" ? "read" : m?.status === "delivered" ? "delivered" : r.status;
                const reason = m?.status === "failed" ? explainError(m.error_code, m.error_message) : r.error_message;
                const real = /^\d+$/.test(r.phone);
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3"><div className="font-medium text-slate-900">{real ? formatNumber(r.phone) : "—"}</div>{r.contact_name && <div className="text-xs text-slate-500">{r.contact_name}</div>}</td>
                    <td className="px-4 py-3"><Badge tone={shown === "delivered" || shown === "read" ? "green" : RTONE[shown] ?? "slate"}>{shown}</Badge></td>
                    <td className="px-4 py-3 text-slate-600">{r.sent_at ? formatDateTime(r.sent_at) : "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{m?.delivered_at ? formatDateTime(m.delivered_at) : "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{m?.read_at ? formatDateTime(m.read_at) : "—"}</td>
                    <td className="max-w-sm px-4 py-3 text-slate-600">{reason ?? ""}</td>
                  </tr>
                );
              })}
              {(recips ?? []).length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No recipients match.</td></tr>}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 p-4 text-sm">
            <span className="text-slate-500">Page {page} of {pages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link className={buttonClass("secondary")} href={qs({ page: page - 1 })}>Previous</Link>}
              {page < pages && <Link className={buttonClass("secondary")} href={qs({ page: page + 1 })}>Next</Link>}
            </div>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
