export const instant = false;

import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { supabaseAdmin } from "@/lib/supabase-server";
import { Badge, Card, PageContainer, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export default async function AdminPage() {
  await requirePlatformAdmin();
  const db = supabaseAdmin();

  const [{ data: clients }, { data: accounts }, { data: msgs }] = await Promise.all([
    db.from("clients").select("id, business_name, contact_email, status, created_at").order("created_at", { ascending: false }),
    db.from("whatsapp_accounts").select("client_id, display_name, verification_status"),
    db.from("messages").select("client_id, created_at"),
  ]);

  const stats = new Map<string, { count: number; last: string }>();
  for (const m of msgs ?? []) {
    const s = stats.get(m.client_id) ?? { count: 0, last: "" };
    s.count += 1;
    if (m.created_at > s.last) s.last = m.created_at;
    stats.set(m.client_id, s);
  }
  const accountByClient = new Map((accounts ?? []).map((a) => [a.client_id, a]));

  return (
    <PageContainer>
      <PageHeader
        title="Platform admin"
        description="Read-only view of client conversations, plus password help. Every chat you open and every reset is logged."
      />
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
              {(clients ?? []).map((c) => {
                const acct = accountByClient.get(c.id);
                const s = stats.get(c.id);
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/${c.id}`} className="font-semibold text-brand-700 hover:underline">
                        {c.business_name}
                      </Link>
                      <div className="text-xs text-slate-500">{c.contact_email}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      {acct ? (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-900">{acct.display_name ?? "Connected"}</span>
                          <Badge tone={acct.verification_status === "connected" ? "green" : "amber"}>
                            {acct.verification_status === "connected" ? "Live" : "Pending"}
                          </Badge>
                        </div>
                      ) : (
                        <Badge tone="slate">Not connected</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-900">{s?.count ?? 0}</td>
                    <td className="px-5 py-3.5 text-slate-500">{s?.last ? formatDateTime(s.last) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}
