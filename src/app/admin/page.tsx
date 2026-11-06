export const instant = false;

import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { supabaseAdmin } from "@/lib/supabase-server";

export default async function AdminPage() {
  await requirePlatformAdmin();
  const db = supabaseAdmin();

  const [{ data: clients }, { data: accounts }, { data: msgs }] =
    await Promise.all([
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
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold mb-1">Platform admin</h1>
      <p className="text-sm text-gray-600 mb-8">
        Read-only view of client conversations. Every chat you open is logged.
      </p>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3">Messages</th>
              <th className="px-4 py-3">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {(clients ?? []).map((c) => {
              const acct = accountByClient.get(c.id);
              const s = stats.get(c.id);
              return (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link href={`/admin/${c.id}`} className="font-medium underline">
                      {c.business_name}
                    </Link>
                    <div className="text-xs text-gray-500">{c.contact_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {acct ? `${acct.display_name ?? "Connected"} (${acct.verification_status})` : "Not connected"}
                  </td>
                  <td className="px-4 py-3">{s?.count ?? 0}</td>
                  <td className="px-4 py-3">
                    {s?.last ? new Date(s.last).toLocaleString("en-IN") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
