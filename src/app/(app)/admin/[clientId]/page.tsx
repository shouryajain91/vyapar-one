export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import { logAdminAccess, requirePlatformAdmin } from "@/lib/platform-admin";
import { supabaseAdmin } from "@/lib/supabase-server";
import { ChatThread } from "@/components/ChatThread";
import { AdminUserActions } from "@/components/AdminUserActions";
import { Icon } from "@/components/icons";
import { Badge, Card, LinkButton, PageContainer, PageHeader } from "@/components/ui";
import { preview, type MessageRow } from "@/lib/conversations";
import { formatListTime, formatNumber } from "@/lib/format";

const PAGE_SIZE = 30;

export default async function AdminClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ with?: string; p?: string; n?: string }>;
}) {
  const { user, email } = await requirePlatformAdmin();
  const { clientId } = await params;
  const sp = await searchParams;
  const activeNumber = /^\d{5,20}$/.test(sp.with ?? "") ? sp.with : undefined;
  const page = Math.max(1, Number(sp.p) || 1);
  const take = Math.min(1000, Math.max(100, Number(sp.n) || 100));

  const db = supabaseAdmin();
  const { data: client } = await db
    .from("clients")
    .select("id, business_name, contact_email")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) notFound();

  const [{ data: rows }, { data: users }] = await Promise.all([
    db.rpc("conversation_list", { p_client: clientId, p_number: null, p_q: null, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
    db.from("app_users").select("user_id, email, role").eq("client_id", clientId),
  ]);
  const list = (rows ?? []) as { customer: string; customer_name: string | null; last_direction: "inbound" | "outbound"; last_type: string | null; last_body: string | null; last_at: string; total: number }[];
  const totalChats = list[0] ? Number(list[0].total) : 0;
  const pages = Math.max(1, Math.ceil(totalChats / PAGE_SIZE));
  const conversations = list.map((r) => ({
    customerNumber: r.customer,
    customerName: r.customer_name,
    last: { direction: r.last_direction, body: r.last_body, message_type: r.last_type, created_at: r.last_at } as MessageRow,
  }));

  let threadMessages: MessageRow[] = [];
  let threadTotal = 0;
  if (activeNumber) {
    const { data: msgs, count } = await db
      .from("messages")
      .select("*", { count: "exact" })
      .eq("client_id", clientId)
      .or(`from_number.eq.${activeNumber},to_number.eq.${activeNumber}`)
      .order("created_at", { ascending: false })
      .limit(take);
    threadMessages = ((msgs ?? []) as MessageRow[]).reverse();
    threadTotal = count ?? threadMessages.length;
  }
  const active = activeNumber ? { customerNumber: activeNumber, messages: threadMessages } : undefined;
  const now = new Date();
  const href = (o: { with?: string; p?: number; n?: number }) => {
    const u = new URLSearchParams();
    if (o.with) u.set("with", o.with);
    if ((o.p ?? page) > 1) u.set("p", String(o.p ?? page));
    if (o.n) u.set("n", String(o.n));
    const qs = u.toString();
    return `/admin/${clientId}${qs ? `?${qs}` : ""}`;
  };

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
                  href={href({ with: c.customerNumber })}
                  className={`block px-4 py-3 ${c.customerNumber === activeNumber ? "bg-brand-50" : "hover:bg-slate-50"}`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{c.customerName ?? formatNumber(c.customerNumber)}</span>
                    <span className="shrink-0 text-xs text-slate-400">{formatListTime(c.last.created_at, now)}</span>
                  </span>
                  <span className="block truncate text-sm text-slate-500">{preview(c.last)}</span>
                </Link>
              </li>
            ))}
            {conversations.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">No conversations yet.</li>}
            {pages > 1 && (
              <li className="flex items-center justify-between px-4 py-2 text-xs text-slate-500">
                {page > 1 ? <Link href={href({ p: page - 1, with: activeNumber })} className="font-medium text-brand-700">← Newer</Link> : <span />}
                <span>{page}/{pages}</span>
                {page < pages ? <Link href={href({ p: page + 1, with: activeNumber })} className="font-medium text-brand-700">Older →</Link> : <span />}
              </li>
            )}
          </ul>
          <div className="min-h-0 bg-slate-50">
            {active ? (
              <div className="flex h-full flex-col">
                {threadMessages.length < threadTotal && (
                  <Link href={href({ with: active.customerNumber, n: take + 200 })} className="shrink-0 border-b border-slate-200 bg-white px-4 py-2 text-center text-sm font-medium text-brand-700 hover:underline">
                    Load older messages ({threadTotal - threadMessages.length} more)
                  </Link>
                )}
                <div className="min-h-0 flex-1"><ChatThread messages={active.messages} /></div>
              </div>
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
