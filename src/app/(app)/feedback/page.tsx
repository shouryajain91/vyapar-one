export const instant = false;

import Link from "next/link";
import { connection } from "next/server";
import { getCurrentClient } from "@/lib/current-client";
import { supabaseAdmin } from "@/lib/supabase-server";
import { formatDateTime, formatNumber } from "@/lib/format";
import { RANGES, feedbackRange, groupSummary, pct, quickReplyLabels, type SummaryRow } from "@/lib/feedback";
import { Card, EmptyState, LinkButton, PageContainer, PageHeader, buttonClass } from "@/components/ui";

const PAGE = 50;

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ days?: string; p?: string }> }) {
  await connection();
  const sp = await searchParams;
  const { client } = await getCurrentClient();
  const { days, from, to } = feedbackRange(sp.days);
  const page = Math.max(1, Number(sp.p) || 1);
  const db = supabaseAdmin();

  const [{ data: rows }, { data: tpls }, { data: replies }] = await Promise.all([
    db.rpc("feedback_summary", { p_client: client!.id, p_from: from, p_to: to }),
    db.from("templates").select("name, buttons").eq("client_id", client!.id),
    db.rpc("feedback_responses", { p_client: client!.id, p_from: from, p_to: to, p_limit: PAGE, p_offset: (page - 1) * PAGE }),
  ]);
  const order = new Map<string, string[]>();
  for (const t of tpls ?? []) order.set(t.name as string, quickReplyLabels(t.buttons));
  const groups = groupSummary((rows ?? []) as SummaryRow[], order);

  const list = (replies ?? []) as { replied_at: string; customer: string; customer_name: string | null; answer: string; template_name: string; campaign_name: string | null; total: number }[];
  const total = list[0] ? Number(list[0].total) : 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (o: { days?: number; p?: number }) => `/feedback?days=${o.days ?? days}${(o.p ?? 1) > 1 ? `&p=${o.p}` : ""}`;

  return (
    <PageContainer>
      <PageHeader
        title="Feedback"
        description="Answers customers tap on your feedback messages, counted for you. Create one under Templates → New template → “Start from an example”."
        actions={total > 0 ? <LinkButton href={`/api/feedback/export?days=${days}`} variant="secondary">Export CSV</LinkButton> : undefined}
      />
      <div className="mb-6 flex gap-2">
        {RANGES.map((r) => (
          <Link key={r} href={link({ days: r })} className={buttonClass(r === days ? "primary" : "secondary", "sm")}>Last {r} days</Link>
        ))}
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="No feedback yet"
          description="Send a template that has quick-reply buttons (for example the customer feedback example) and the answers will be counted here."
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <Card key={g.name} title={g.name} description={`${g.sent} sent · ${g.delivered} delivered · ${g.replies} answered (${pct(g.replies, g.delivered)}% of delivered)`}>
              <div className="space-y-6">
                {g.blocks.map((b) => (
                  <div key={b.key}>
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{b.label}</span>
                      <span className="text-xs text-slate-500">{b.sent} sent · {b.delivered} delivered · {b.replies} answered ({pct(b.replies, b.delivered)}%)</span>
                    </div>
                    <ul className="space-y-2">
                      {[...b.answers.entries()].map(([label, n]) => (
                        <li key={label} className="grid grid-cols-[7rem_1fr_6rem] items-center gap-3 text-sm">
                          <span className="truncate text-slate-700">{label}</span>
                          <span className="h-3 overflow-hidden rounded-full bg-slate-100">
                            <span className="block h-full rounded-full bg-brand-600" style={{ width: `${pct(n, b.replies)}%` }} />
                          </span>
                          <span className="text-right tabular-nums text-slate-600">{n} · {pct(n, b.replies)}%</span>
                        </li>
                      ))}
                      {b.answers.size === 0 && <li className="text-sm text-slate-500">No answers yet.</li>}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {list.length > 0 && (
        <Card title="Individual answers" className="mt-6 !p-0" >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-5 py-3">When</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Answer</th><th className="px-5 py-3">Message</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((r, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDateTime(r.replied_at)}</td>
                    <td className="px-5 py-3"><div className="font-medium text-slate-900">{formatNumber(r.customer)}</div>{r.customer_name && <div className="text-xs text-slate-500">{r.customer_name}</div>}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">{r.answer}</td>
                    <td className="px-5 py-3 text-slate-600">{r.template_name}{r.campaign_name ? ` · ${r.campaign_name}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 p-4 text-sm">
              {page > 1 ? <Link href={link({ p: page - 1 })} className="font-medium text-brand-700">← Newer</Link> : <span />}
              <span className="text-slate-500">Page {page} of {pages}</span>
              {page < pages ? <Link href={link({ p: page + 1 })} className="font-medium text-brand-700">Older →</Link> : <span />}
            </div>
          )}
        </Card>
      )}
    </PageContainer>
  );
}
