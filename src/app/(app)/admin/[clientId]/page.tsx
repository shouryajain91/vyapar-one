export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import { logAdminAccess, requirePlatformAdmin } from "@/lib/platform-admin";
import { supabaseAdmin } from "@/lib/supabase-server";
import { ChatThread } from "@/components/ChatThread";
import { AdminUserActions } from "@/components/AdminUserActions";
import { Icon } from "@/components/icons";
import { Badge, Card, LinkButton, PageContainer, PageHeader } from "@/components/ui";
import { groupConversations, preview, type MessageRow } from "@/lib/conversations";
import { formatListTime, formatNumber } from "@/lib/format";

export default async function AdminClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ with?: string }>;
}) {
  const { user, email } = await requirePlatformAdmin();
  const { clientId } = await params;
  const { with: activeNumber } = await searchParams;

  const db = supabaseAdmin();
  const { data: client } = await db
    .from("clients")
    .select("id, business_name, contact_email")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) notFound();

  const [{ data }, { data: users }] = await Promise.all([
    db.from("messages").select("*").eq("client_id", clientId).order("created_at", { ascending: true }),
    db.from("app_users").select("user_id, email, role").eq("client_id", clientId),
  ]);

  const conversations = groupConversations((data ?? []) as MessageRow[]);
  const active = conversations.find((c) => c.customerNumber === activeNumber);
  const now = new Date();

  await logAdminAccess({
    adminUserId: user.id,
    adminEmail: email,
    clientId,
    customerNumber: active?.customerNumber ?? null,
  });

  return (
    <PageContainer>
      <PageHeader
        back={
          <LinkButton href="/admin" variant="ghost" size="sm">
            <Icon name="back" className="h-3.5 w-3.5" />
            All clients
          </LinkButton>
        }
        title={client.business_name}
        description={`${client.contact_email} · read-only, access is logged`}
      />

      <Card title="Users" description="Password help for this business's logins. Every action is logged." className="mb-6">
        <ul className="divide-y divide-slate-100">
          {(users ?? []).map((u) => (
            <li key={u.user_id} className="py-4 first:pt-0 last:pb-0">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-900">
                {u.email}
                <Badge tone="slate">{u.role}</Badge>
              </p>
              <AdminUserActions userId={u.user_id} email={u.email} />
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Conversations" className="overflow-hidden" >
        <div className="-m-5 grid h-[60vh] min-h-[420px] md:grid-cols-[300px_1fr]">
          <ul className="divide-y divide-slate-100 overflow-y-auto border-b border-slate-200 md:border-b-0 md:border-r">
            {conversations.map((c) => (
              <li key={c.customerNumber}>
                <Link
                  href={`/admin/${clientId}?with=${encodeURIComponent(c.customerNumber)}`}
                  className={`block px-4 py-3 ${c.customerNumber === activeNumber ? "bg-brand-50" : "hover:bg-slate-50"}`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{formatNumber(c.customerNumber)}</span>
                    <span className="shrink-0 text-xs text-slate-400">{formatListTime(c.last.created_at, now)}</span>
                  </span>
                  <span className="block truncate text-sm text-slate-500">{preview(c.last)}</span>
                </Link>
              </li>
            ))}
            {conversations.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">No conversations yet.</li>}
          </ul>
          <div className="min-h-0 bg-slate-50">
            {active ? (
              <ChatThread messages={active.messages} />
            ) : (
              <p className="flex h-full items-center justify-center px-4 text-sm text-slate-500">
                Select a conversation to view messages.
              </p>
            )}
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
