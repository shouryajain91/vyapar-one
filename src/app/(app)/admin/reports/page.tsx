export const instant = false;

import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { loadPlatformReport } from "@/lib/platform-report";
import { parseFilters } from "@/lib/reports";
import { explainError } from "@/lib/wa-errors";
import { formatDateTime } from "@/lib/format";
import { Alert, Badge, Card, LinkButton, PageContainer, PageHeader, buttonClass, inputCls, labelCls } from "@/components/ui";

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

export default async function PlatformReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePlatformAdmin();
  const f = parseFilters(await searchParams);
  const { rows, totals, topReasons, error } = await loadPlatformReport(f);
  const active = rows.filter((r) => r.sent + r.received > 0).length;

  const stats = [
    { label: "Messages sent", value: totals.sent, sub: `${totals.received} received · ${active} active business${active === 1 ? "" : "es"}` },
    { label: "Delivered", value: totals.delivered, sub: `${pct(totals.delivered, totals.sent)} of sent` },
    { label: "Read", value: totals.read, sub: `${pct(totals.read, totals.sent)} of sent` },
    { label: "Failed", value: totals.failed, sub: `${pct(totals.failed, totals.sent)} of sent`, bad: totals.failed > 0 },
  ];

  return (
    <PageContainer>
      <PageHeader
        back={<Link href="/admin" className="text-sm text-brand-700 hover:underline">&larr; Platform admin</Link>}
        title="Platform report"
        description="Message totals across every business. Totals only: open a business to see its chats (that access is logged)."
        actions={<LinkButton href={`/api/admin/reports/export?from=${f.from}&to=${f.to}`} variant="secondary">Export CSV</LinkButton>}
      />
      {error && <Alert tone="error" className="mb-6">Could not load the report: {error}</Alert>}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className={`mt-1 text-3xl font-bold ${s.bad ? "text-red-600" : "text-slate-900"}`}>{s.value}</p>
            <p className="mt-1 text-xs text-slate-500">{s.sub}</p>
          </div>
        ))}
      </div>

      <Card className="mb-6">
        <form method="get" className="flex flex-wrap items-end gap-4">
          <div>
            <label className={labelCls} htmlFor="from">From</label>
            <input id="from" name="from" type="date" defaultValue={f.from} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="to">To</label>
            <input id="to" name="to" type="date" defaultValue={f.to} className={inputCls} />
          </div>
          <button type="submit" className={buttonClass("primary")}>Apply</button>
          <Link href="/admin/reports" className={buttonClass("secondary")}>Reset</Link>
        </form>
      </Card>

      {topReasons.length > 0 && (
        <Card title="Top failure reasons" description="Across all businesses in the selected period" className="mb-6">
          <ul className="divide-y divide-slate-100 text-sm">
            {topReasons.map((r) => (
              <li key={r.error_code ?? r.error_message ?? "unknown"} className="flex items-start justify-between gap-4 py-2">
                <span className="text-slate-700">
                  {explainError(r.error_code, r.error_message)}
                  {r.error_code && <span className="ml-2 text-xs text-slate-400">Code {r.error_code}</span>}
                </span>
                <Badge tone="red">{r.n}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3 text-right">Sent</th>
                <th className="px-4 py-3 text-right">Delivered</th>
                <th className="px-4 py-3 text-right">Read</th>
                <th className="px-4 py-3 text-right">Failed</th>
                <th className="px-4 py-3 text-right">Failure rate</th>
                <th className="px-4 py-3 text-right">Received</th>
                <th className="px-4 py-3">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.clientId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/${r.clientId}`} className="font-semibold text-brand-700 hover:underline">{r.name}</Link>
                    <div className="text-xs text-slate-500">{r.email}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.sent}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.delivered}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.read}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${r.failed ? "text-red-600" : ""}`}>{r.failed}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.sent && r.failed / r.sent >= 0.2 ? <Badge tone="red">{pct(r.failed, r.sent)}</Badge> : pct(r.failed, r.sent)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.received}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{r.lastActivity ? formatDateTime(r.lastActivity) : "–"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No businesses yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}
