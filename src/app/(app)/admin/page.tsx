export const instant = false;

import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { supabaseAdmin } from "@/lib/supabase-server";
import { Badge, Card, LinkButton, PageContainer, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

const PAGE_SIZE = 25;

interface Row {
  id: string; business_name: string; contact_email: string; display_name: string | null; verification_status: string | null;
  token_status: string | null; message_count: number; last_activity: string | null; open_alerts: number; total: number;
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ p?: string; q?: string }> }) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.p) || 1);
  const q = (sp.q ?? "").trim().slice(0, 60);

  const { data } = await supabaseAdmin().rpc("admin_client_list", { p_q: q || null, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE });
  const rows = (data ?? []) as Row[];
  const total = rows[0] ? Number(rows[0].total) : 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => `/admin?${new URLSearchParams({ ...(q ? { q } : {}), p: String(p) })}`;

  return (
    <PageContainer>
      <PageHeader
        title="Platform admin"
        description="Read-only view of client conversations, plus password help. Every chat you open and every reset is logged."
        actions={<LinkButton href="/admin/reports" variant="secondary">Platform report</LinkButton>}
      />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search business or email" className="block w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium">Search</button>
      </form>
      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Business</th>
                <th className="px-5 py-3">WhatsApp</th>
                <th className="px-5 py-3">Messages</th>
                <th className="px-5 py-3">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5">
                    <Link href={`/admin/${c.id}`} className="font-semibold text-brand-700 hover:underline">
                      {c.business_name}
                    </Link>
                    <div className="text-xs text-slate-500">{c.contact_email}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    {c.verification_status ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-900">{c.display_name ?? "Connected"}</span>
                        {c.token_status === "invalid" ? (
                          <Badge tone="red">Expired</Badge>
                        ) : (
                          <Badge tone={c.verification_status === "connected" ? "green" : "amber"}>
                            {c.verification_status === "connected" ? "Live" : "Pending"}
                          </Badge>
                        )}
                        {c.open_alerts > 0 && <Badge tone="amber">{c.open_alerts} alert{c.open_alerts === 1 ? "" : "s"}</Badge>}
                      </div>
                    ) : (
                      <Badge tone="slate">Not connected</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-slate-900">{c.message_count}</td>
                  <td className="px-5 py-3.5 text-slate-500">{c.last_activity ? formatDateTime(c.last_activity) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          {page > 1 ? <Link href={link(page - 1)} className="font-medium text-brand-700">← Previous</Link> : <span />}
          <span>Page {page} of {pages} · {total} businesses</span>
          {page < pages ? <Link href={link(page + 1)} className="font-medium text-brand-700">Next →</Link> : <span />}
        </div>
      )}
    </PageContainer>
  );
}
