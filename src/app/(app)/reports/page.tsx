export const instant = false;

import Link from "next/link";
import { getCurrentClient } from "@/lib/current-client";
import { supabaseAdmin } from "@/lib/supabase-server";
import { applyFilters, filterQuery, PAGE_SIZE, parseFilters, REPORT_COLUMNS } from "@/lib/reports";
import { explainError } from "@/lib/wa-errors";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Badge, Card, EmptyState, LinkButton, PageContainer, PageHeader, buttonClass, inputCls, labelCls } from "@/components/ui";

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "slate" | "brand"> = {
  sent: "slate",
  delivered: "green",
  read: "brand",
  failed: "red",
  received: "slate",
};
const STATUS_LABEL: Record<string, string> = { sent: "Sent", delivered: "Delivered", read: "Read", failed: "Failed", received: "Received" };

function pct(a: number, b: number) {
  return b ? `${Math.round((a / b) * 100)}%` : "–";
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = parseFilters(await searchParams);
  const { client, whatsappAccounts } = await getCurrentClient();
  const db = supabaseAdmin();
  const clientId = client!.id;
  const base = () => db.from("messages").select("id", { count: "exact", head: true });
  // Summary ignores the status filter so the cards always show the whole picture.
  const sum = () => applyFilters(base(), clientId, f, { omitStatus: true });

  const from = (f.page - 1) * PAGE_SIZE;
  const [rowsRes, sentRes, deliveredRes, readRes, failedRes, receivedRes, failedRows] = await Promise.all([
    applyFilters(db.from("messages").select(REPORT_COLUMNS, { count: "exact" }), clientId, f)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
    sum().eq("direction", "outbound"),
    sum().eq("direction", "outbound").in("status", ["delivered", "read"]),
    sum().eq("direction", "outbound").eq("status", "read"),
    sum().eq("direction", "outbound").eq("status", "failed"),
    sum().eq("direction", "inbound"),
    applyFilters(db.from("messages").select("error_code, error_message"), clientId, f, { omitStatus: true })
      .eq("direction", "outbound")
      .eq("status", "failed")
      .limit(1000),
  ]);

  const rows = rowsRes.data ?? [];
  const total = rowsRes.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sent = sentRes.count ?? 0;
  const delivered = deliveredRes.count ?? 0;
  const read = readRes.count ?? 0;
  const failed = failedRes.count ?? 0;
  const received = receivedRes.count ?? 0;

  const reasonCounts = new Map<string, { n: number; text: string }>();
  for (const r of failedRows.data ?? []) {
    const key = r.error_code ?? r.error_message ?? "unknown";
    const cur = reasonCounts.get(key) ?? { n: 0, text: explainError(r.error_code, r.error_message) };
    cur.n++;
    reasonCounts.set(key, cur);
  }
  const topReasons = [...reasonCounts.values()].sort((a, b) => b.n - a.n).slice(0, 5);

  const stats = [
    { label: "Messages sent", value: sent, sub: `${received} received` },
    { label: "Delivered", value: delivered, sub: `${pct(delivered, sent)} of sent` },
    { label: "Read", value: read, sub: `${pct(read, sent)} of sent` },
    { label: "Failed", value: failed, sub: `${pct(failed, sent)} of sent`, bad: failed > 0 },
  ];
  const q = (page: number) => `/reports?${filterQuery(f, { page: String(page) })}`;
  const numberLabel = (id: string | null) => whatsappAccounts.find((a) => a.phone_number_id === id)?.display_name ?? "";

  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        description="Every message sent and received, with its delivery status and the reason for any failure."
        actions={<LinkButton href={`/api/reports/export?${filterQuery(f)}`} variant="secondary">Export CSV</LinkButton>}
      />

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
        <form method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelCls} htmlFor="from">From</label>
            <input id="from" name="from" type="date" defaultValue={f.from} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="to">To</label>
            <input id="to" name="to" type="date" defaultValue={f.to} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="dir">Direction</label>
            <select id="dir" name="dir" defaultValue={f.dir} className={inputCls}>
              <option value="">Sent and received</option>
              <option value="outbound">Sent by you</option>
              <option value="inbound">Received</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={f.status} className={inputCls}>
              <option value="">Any status</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="read">Read</option>
              <option value="failed">Failed</option>
              <option value="received">Received</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="type">Type</label>
            <select id="type" name="type" defaultValue={f.type} className={inputCls}>
              <option value="">Any type</option>
              <option value="text">Text</option>
              <option value="template">Template</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="document">Document</option>
              <option value="button">Button reply</option>
              <option value="interactive">Interactive</option>
            </select>
          </div>
          {whatsappAccounts.length > 1 && (
            <div>
              <label className={labelCls} htmlFor="num">Your number</label>
              <select id="num" name="num" defaultValue={f.num} className={inputCls}>
                <option value="">All numbers</option>
                {whatsappAccounts.map((a) => (
                  <option key={a.id} value={a.phone_number_id}>{a.display_name ?? a.phone_number_id}</option>
                ))}
              </select>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="q">Search</label>
            <input id="q" name="q" defaultValue={f.q} placeholder="Number, name, template or message text" className={inputCls} />
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className={buttonClass("primary")}>Apply</button>
            <Link href="/reports" className={buttonClass("secondary")}>Reset</Link>
          </div>
        </form>
      </Card>

      {topReasons.length > 0 && (
        <Card title="Why messages failed" description="In the selected period" className="mb-6">
          <ul className="divide-y divide-slate-100 text-sm">
            {topReasons.map((r) => (
              <li key={r.text} className="flex items-start justify-between gap-4 py-2">
                <span className="text-slate-700">{r.text}</span>
                <Badge tone="red">{r.n}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No messages match these filters" description="Try a wider date range or clear the filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date &amp; time</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Delivered</th>
                  <th className="px-4 py-3">Read</th>
                  {whatsappAccounts.length > 1 && <th className="px-4 py-3">Your number</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((m) => {
                  const out = m.direction === "outbound";
                  const num = out ? m.to_number : m.from_number;
                  return (
                    <tr key={m.id} className="align-top hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDateTime(m.created_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {m.contact_name && <p className="font-medium text-slate-900">{m.contact_name}</p>}
                        <p className={m.contact_name ? "text-xs text-slate-500" : "text-slate-900"}>{num ? formatNumber(num) : "–"}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{out ? "Sent" : "Received"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{m.message_type ?? "–"}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700">{m.template_name ?? "–"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{m.direction !== "outbound" ? "–" : m.campaign_id ? "Campaign" : m.bot_rule_id ? "Bot" : "Manual"}</td>
                      <td className="min-w-56 max-w-xs px-4 py-3 text-slate-700">
                        <p className="line-clamp-2 break-words" title={m.body ?? ""}>{m.body ?? "–"}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {m.status ? <Badge tone={STATUS_TONE[m.status] ?? "slate"}>{STATUS_LABEL[m.status] ?? m.status}</Badge> : "–"}
                      </td>
                      <td className="min-w-64 max-w-xs px-4 py-3 text-xs text-red-700">
                        {m.status === "failed" ? (
                          <>
                            <p>{explainError(m.error_code, m.error_message)}</p>
                            {m.error_code && <p className="mt-0.5 text-red-600/70">Code {m.error_code}</p>}
                          </>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{m.delivered_at ? formatDateTime(m.delivered_at) : "–"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{m.read_at ? formatDateTime(m.read_at) : "–"}</td>
                      {whatsappAccounts.length > 1 && (
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{numberLabel(m.phone_number_id) || "–"}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
            <span>
              {from + 1}–{Math.min(from + PAGE_SIZE, total)} of {total}
            </span>
            <span className="flex items-center gap-2">
              {f.page > 1 && <Link href={q(f.page - 1)} className={buttonClass("secondary", "sm")}>Previous</Link>}
              <span>Page {f.page} of {pages}</span>
              {f.page < pages && <Link href={q(f.page + 1)} className={buttonClass("secondary", "sm")}>Next</Link>}
            </span>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
