export const instant = false;

import Link from "next/link";
import { getCurrentClient } from "@/lib/current-client";
import { supabaseAdmin } from "@/lib/supabase-server";
import { formatDateTime } from "@/lib/format";
import { CAMPAIGN_LABEL, CAMPAIGN_TONE } from "@/lib/campaign-status";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Badge, EmptyState, LinkButton, PageContainer, PageHeader } from "@/components/ui";

interface Stat { campaign_id: string; pending: number; sent: number; delivered: number; read: number; failed: number; skipped: number }

export default async function CampaignsPage() {
  const { client } = await getCurrentClient();
  const db = supabaseAdmin();
  const [{ data: campaigns }, { data: stats }] = await Promise.all([
    db.from("campaigns").select("*").eq("client_id", client!.id).order("created_at", { ascending: false }).limit(100),
    db.rpc("campaign_stats", { p_client: client!.id }),
  ]);
  const byId = new Map<string, Stat>(((stats ?? []) as Stat[]).map((s) => [s.campaign_id, s]));
  const live = (campaigns ?? []).some((c) => c.status === "running" || c.status === "scheduled");

  return (
    <PageContainer>
      {live && <AutoRefresh everyMs={10000} />}
      <PageHeader
        title="Campaigns"
        description="Send a template to many customers at once from an Excel or CSV file, now or at a time you choose."
        actions={<LinkButton href="/campaigns/new">New campaign</LinkButton>}
      />
      {!campaigns || campaigns.length === 0 ? (
        <EmptyState title="No campaigns yet" description="Upload a spreadsheet of customers and pick an approved template to send your first campaign." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Campaign</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Starts</th>
                  <th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Delivered</th>
                  <th className="px-4 py-3 text-right">Read</th><th className="px-4 py-3 text-right">Failed</th><th className="px-4 py-3 text-right">Skipped</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((c) => {
                  const s = byId.get(c.id);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/campaigns/${c.id}`} className="font-medium text-slate-900 hover:underline">{c.name}</Link>
                        <div className="text-xs text-slate-500">{c.template_name}</div>
                      </td>
                      <td className="px-4 py-3"><Badge tone={CAMPAIGN_TONE[c.status]}>{CAMPAIGN_LABEL[c.status] ?? c.status}</Badge></td>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(c.scheduled_at)}</td>
                      <td className="px-4 py-3 text-right">{c.total}</td>
                      <td className="px-4 py-3 text-right">{s?.delivered ?? 0}</td>
                      <td className="px-4 py-3 text-right">{s?.read ?? 0}</td>
                      <td className="px-4 py-3 text-right text-red-700">{s?.failed ?? 0}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{s?.skipped ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
