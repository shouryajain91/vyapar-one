export const instant = false;

import { getCurrentClient } from "@/lib/current-client";
import { supabaseAdmin } from "@/lib/supabase-server";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Alert, Badge, Card, EmptyState, LinkButton, PageContainer, PageHeader, buttonClass, inputCls, labelCls, hintCls } from "@/components/ui";
import { addOptOutAction, optInAction } from "./actions";

export default async function OptOutsPage({ searchParams }: { searchParams: Promise<{ error?: string; added?: string }> }) {
  const { error, added } = await searchParams;
  const { client } = await getCurrentClient();
  const db = supabaseAdmin();

  const [{ data: out }, { data: back }] = await Promise.all([
    db.from("opt_outs").select("*").eq("client_id", client!.id).eq("status", "opted_out").order("opted_out_at", { ascending: false }).limit(500),
    db.from("opt_outs").select("*").eq("client_id", client!.id).eq("status", "opted_in").order("opted_in_at", { ascending: false }).limit(20),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Opt-outs"
        description="Customers who asked to stop receiving messages. Templates are never sent to anyone on this list."
        actions={<LinkButton href="/api/opt-outs/export" variant="secondary">Export CSV</LinkButton>}
      />
      {error && <Alert tone="error" className="mb-4">{decodeURIComponent(error)}</Alert>}
      {added && <Alert tone="success" className="mb-4">Added to the opt-out list.</Alert>}

      <Alert tone="info" className="mb-6">
        A customer is added automatically when they reply <strong>STOP</strong>, <strong>UNSUBSCRIBE</strong>, <strong>QUIT</strong> or a similar
        message (or tap a Stop button on a template). They are removed again if they send <strong>START</strong>.
      </Alert>

      <Card title="Add a number manually" description="For example, a customer who asked you by phone to stop." className="mb-6">
        <form action={addOptOutAction} className="flex flex-wrap items-end gap-4">
          <div className="min-w-56 flex-1">
            <label className={labelCls} htmlFor="phone">WhatsApp number</label>
            <input id="phone" name="phone" required placeholder="+919876543210" className={inputCls} />
          </div>
          <div className="min-w-56 flex-1">
            <label className={labelCls} htmlFor="note">Note (optional)</label>
            <input id="note" name="note" maxLength={200} placeholder="Asked on call" className={inputCls} />
          </div>
          <button type="submit" className={buttonClass("primary")}>Add to list</button>
        </form>
        <p className={hintCls}>Use the full number with country code.</p>
      </Card>

      <h2 className="mb-3 text-base font-semibold text-slate-900">Opted out ({out?.length ?? 0})</h2>
      {!out || out.length === 0 ? (
        <EmptyState title="Nobody has opted out" description="When a customer replies STOP, they will show up here." />
      ) : (
        <div className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Opted out</th>
                  <th className="px-4 py-3">How</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {out.map((o) => (
                  <tr key={o.id} className="align-top hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      {o.contact_name && <p className="font-medium text-slate-900">{o.contact_name}</p>}
                      <p className={o.contact_name ? "text-xs text-slate-500" : "text-slate-900"}>{formatNumber(o.phone)}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDateTime(o.opted_out_at)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {o.source === "keyword" ? (
                        <>
                          <Badge tone="red">Customer replied</Badge>
                          {o.reason_text && <span className="ml-2 font-mono text-xs text-slate-500">&ldquo;{o.reason_text}&rdquo;</span>}
                        </>
                      ) : (
                        <>
                          <Badge tone="slate">Added by you</Badge>
                          {o.reason_text && <span className="ml-2 text-xs text-slate-500">{o.reason_text}</span>}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={optInAction}>
                        <input type="hidden" name="id" value={o.id} />
                        <button type="submit" className={buttonClass("secondary", "sm")}>Opt back in</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {back && back.length > 0 && (
        <>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Opted back in</h2>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm shadow-sm">
            {back.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="text-slate-900">{o.contact_name ? `${o.contact_name} · ` : ""}{formatNumber(o.phone)}</span>
                <span className="text-xs text-slate-500">back in {o.opted_in_at ? formatDateTime(o.opted_in_at) : ""}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageContainer>
  );
}
