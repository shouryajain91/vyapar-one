export const instant = false;

import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import { formatDateTime } from "@/lib/format";
import { Badge, Card, EmptyState, PageContainer, PageHeader } from "@/components/ui";
import { DevTabs } from "@/components/DevTabs";

export default async function ActivityPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  const db = supabaseAdmin();
  const [{ data: calls }, { data: keys }, { data: deliveries }, { data: hooks }] = await Promise.all([
    db.from("api_request_log").select("id, key_id, method, path, status, ms, error_code, created_at").eq("client_id", ctx.client_id).order("id", { ascending: false }).limit(50),
    db.from("api_keys").select("id, name").eq("client_id", ctx.client_id),
    db.from("webhook_deliveries").select("id, endpoint_id, event_type, status, attempts, last_http_status, last_error, created_at").eq("client_id", ctx.client_id).order("id", { ascending: false }).limit(30),
    db.from("webhook_endpoints").select("id, url").eq("client_id", ctx.client_id),
  ]);
  const keyName = new Map((keys ?? []).map((k) => [k.id, k.name]));
  const host = new Map((hooks ?? []).map((h) => [h.id, (() => { try { return new URL(h.url).host; } catch { return h.url; } })()]));
  const tone = (s: number) => (s < 300 ? "green" : s < 500 ? "amber" : "red");

  return (
    <PageContainer>
      <PageHeader title="Developers" description="The latest API calls and webhook deliveries, to help you debug an integration. Kept for 14 days." />
      <DevTabs active="/developers/activity" />

      <Card title="Recent API calls" className="mb-6">
        {!calls?.length ? (
          <EmptyState title="No API calls yet" description="Calls made with your keys will show up here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="py-2 pr-4">When</th><th className="py-2 pr-4">Key</th><th className="py-2 pr-4">Request</th><th className="py-2 pr-4">Result</th><th className="py-2">Time</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {calls.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap py-2 pr-4 text-slate-700">{formatDateTime(c.created_at)}</td>
                    <td className="py-2 pr-4 text-slate-700">{keyName.get(c.key_id ?? "") ?? "—"}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-slate-800">{c.method} {c.path.replace("/api", "")}</td>
                    <td className="py-2 pr-4"><Badge tone={tone(c.status)}>{c.status}</Badge>{c.error_code && <span className="ml-2 font-mono text-xs text-slate-500">{c.error_code}</span>}</td>
                    <td className="py-2 text-slate-500">{c.ms ?? "—"} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Recent webhook deliveries">
        {!deliveries?.length ? (
          <EmptyState title="No webhook deliveries yet" description="Add a webhook and use “Send test” to try it." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="py-2 pr-4">When</th><th className="py-2 pr-4">To</th><th className="py-2 pr-4">Event</th><th className="py-2 pr-4">Status</th><th className="py-2">Detail</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap py-2 pr-4 text-slate-700">{formatDateTime(d.created_at)}</td>
                    <td className="py-2 pr-4 text-slate-700">{host.get(d.endpoint_id) ?? "—"}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-slate-800">{d.event_type}</td>
                    <td className="py-2 pr-4"><Badge tone={d.status === "done" ? "green" : d.status === "failed" ? "red" : "amber"}>{d.status === "done" ? "Delivered" : d.status === "failed" ? "Gave up" : "Retrying"}</Badge></td>
                    <td className="py-2 text-xs text-slate-500">{d.last_error ?? (d.last_http_status ? `HTTP ${d.last_http_status}` : "")}{d.attempts > 1 ? ` · ${d.attempts} tries` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
