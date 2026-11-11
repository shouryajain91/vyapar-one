export const instant = false;

import { connection } from "next/server";
import { getCurrentClient } from "@/lib/current-client";
import { supabaseAdmin } from "@/lib/supabase-server";
import { formatDateTime } from "@/lib/format";
import { Badge, EmptyState, PageContainer, PageHeader, buttonClass } from "@/components/ui";
import { dismissAlertAction } from "./actions";

const TONE = { critical: "red", warning: "amber", info: "slate" } as const;

export default async function AlertsPage() {
  await connection();
  const { client } = await getCurrentClient();
  const db = supabaseAdmin();
  const [{ data: open }, { data: past }] = await Promise.all([
    db.from("alerts").select("*").eq("client_id", client!.id).is("resolved_at", null).order("created_at", { ascending: false }).limit(100),
    db.from("alerts").select("*").eq("client_id", client!.id).not("resolved_at", "is", null).order("resolved_at", { ascending: false }).limit(20),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Alerts"
        description="Problems with your WhatsApp number, templates or sending. We check every 15 minutes, and alerts clear on their own once the problem is fixed."
      />
      {!open?.length ? (
        <EmptyState title="All clear" description="No open alerts. We'll tell you here if your number's quality drops, a template is paused, or many messages start failing." />
      ) : (
        <ul className="space-y-3">
          {open.map((a) => (
            <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TONE[a.severity as keyof typeof TONE] ?? "slate"}>{a.severity}</Badge>
                    <span className="font-medium text-slate-900">{a.title}</span>
                  </div>
                  {a.detail && <p className="mt-1 text-sm text-slate-600">{a.detail}</p>}
                  <p className="mt-1 text-xs text-slate-400">Since {formatDateTime(a.created_at)}</p>
                </div>
                {a.kind === "token_invalid" ? (
                  <a href="/dashboard" className={buttonClass("primary", "sm")}>Reconnect</a>
                ) : (
                  <form action={dismissAlertAction}>
                    <button name="id" value={a.id} className={buttonClass("secondary", "sm")}>Dismiss</button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!!past?.length && (
        <>
          <h2 className="mb-2 mt-8 text-sm font-semibold text-slate-900">Recently resolved</h2>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
            {past.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5 text-slate-600">
                <span>{a.title}</span>
                <span className="text-xs text-slate-400">{formatDateTime(a.resolved_at)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageContainer>
  );
}
