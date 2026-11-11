export const instant = false;

import Link from "next/link";
import { getCurrentClient } from "@/lib/current-client";
import { supabaseAdmin } from "@/lib/supabase-server";
import { SendMessageForm } from "@/components/SendMessageForm";
import { ChatThread } from "@/components/ChatThread";
import { SendTemplateForm } from "@/components/SendTemplateForm";
import { Icon } from "@/components/icons";
import { Alert, Badge, EmptyState, LinkButton, buttonClass } from "@/components/ui";
import type { SendableTemplate } from "@/lib/template-send";
import { preview, type MessageRow } from "@/lib/conversations";
import { formatListTime, formatNumber, replyWindow } from "@/lib/format";

const PAGE_SIZE = 30;

interface ConvRow {
  customer: string; customer_name: string | null; last_direction: "inbound" | "outbound"; last_type: string | null;
  last_body: string | null; last_at: string; total: number;
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string; p?: string; q?: string; n?: string }>;
}) {
  const { client, whatsappAccount } = await getCurrentClient();
  const sp = await searchParams;
  const activeNumber = /^\d{5,20}$/.test(sp.with ?? "") ? sp.with : undefined;
  const page = Math.max(1, Number(sp.p) || 1);
  const q = (sp.q ?? "").trim().slice(0, 40);
  const take = Math.min(1000, Math.max(100, Number(sp.n) || 100));

  if (!whatsappAccount) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          title="Connect WhatsApp to use the inbox"
          description="Your conversations will show up here once your number is connected."
          action={<LinkButton href="/dashboard">Go to dashboard</LinkButton>}
        />
      </div>
    );
  }

  const admin = supabaseAdmin();
  const number = whatsappAccount.phone_number_id;
  const [{ data: rows }, { data: approved }] = await Promise.all([
    admin.rpc("conversation_list", { p_client: client!.id, p_number: number, p_q: q || null, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
    admin
      .from("templates")
      .select("name, language, status, body, header_format, header_text, footer, buttons")
      .eq("client_id", client!.id)
      .eq("status", "APPROVED")
      .order("name"),
  ]);
  const list = (rows ?? []) as ConvRow[];
  const totalChats = list[0] ? Number(list[0].total) : 0;
  const pages = Math.max(1, Math.ceil(totalChats / PAGE_SIZE));

  // Only the open chat's messages are loaded (newest first, then flipped).
  let threadMessages: MessageRow[] = [];
  let threadTotal = 0;
  let lastInbound: string | null = null;
  let threadName: string | null = null;
  if (activeNumber) {
    const thread = () => admin.from("messages").select("id, direction, from_number, to_number, message_type, body, contact_name, status, error_code, error_message, delivered_at, read_at, created_at", { count: "exact" })
      .eq("client_id", client!.id).eq("phone_number_id", number).or(`from_number.eq.${activeNumber},to_number.eq.${activeNumber}`);
    const [{ data: msgs, count }, { data: inb }] = await Promise.all([
      thread().order("created_at", { ascending: false }).limit(take),
      admin.from("messages").select("created_at").eq("client_id", client!.id).eq("phone_number_id", number).eq("from_number", activeNumber).eq("direction", "inbound").order("created_at", { ascending: false }).limit(1),
    ]);
    threadMessages = ((msgs ?? []) as MessageRow[]).reverse();
    threadTotal = count ?? threadMessages.length;
    lastInbound = inb?.[0]?.created_at ?? null;
    threadName = [...threadMessages].reverse().find((m) => m.contact_name)?.contact_name ?? null;
  }

  const phones = [...new Set([...list.map((c) => c.customer), ...(activeNumber ? [activeNumber] : [])])];
  const { data: optedOutRows } = phones.length
    ? await admin.from("opt_outs").select("phone").eq("client_id", client!.id).eq("status", "opted_out").in("phone", phones)
    : { data: [] };
  const optedOut = new Set((optedOutRows ?? []).map((o) => o.phone as string));

  const conversations = list.map((r) => ({
    customerNumber: r.customer,
    customerName: r.customer_name,
    last: { direction: r.last_direction, body: r.last_body, message_type: r.last_type, created_at: r.last_at } as MessageRow,
  }));
  const active = activeNumber
    ? { customerNumber: activeNumber, customerName: threadName, messages: threadMessages }
    : undefined;
  const now = new Date();
  const win = replyWindow(lastInbound, now);
  const href = (o: { with?: string; p?: number; n?: number }) => {
    const u = new URLSearchParams();
    if (o.with) u.set("with", o.with);
    if (q) u.set("q", q);
    if ((o.p ?? page) > 1) u.set("p", String(o.p ?? page));
    if (o.n) u.set("n", String(o.n));
    const qs = u.toString();
    return `/inbox${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] md:h-dvh">
      {/* Conversation list */}
      <aside
        className={`${active ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-slate-200 bg-white md:w-80 lg:w-96`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Inbox</h1>
            <p className="text-xs text-slate-500">
              {totalChats} chat{totalChats === 1 ? "" : "s"} · {whatsappAccount.display_name ?? "your number"}
            </p>
          </div>
          <LinkButton href="/inbox/new" size="sm">
            <Icon name="plus" className="h-3.5 w-3.5" />
            New
          </LinkButton>
        </div>
        <form action="/inbox" className="shrink-0 border-b border-slate-200 p-3">
          <input name="q" defaultValue={q} placeholder="Search name or number" className="block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </form>
        <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
          {conversations
            .slice()
            .map((c) => {
              const selected = c.customerNumber === activeNumber;
              return (
                <li key={c.customerNumber}>
                  <Link
                    href={href({ with: c.customerNumber })}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      selected ? "bg-brand-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <Icon name="user" className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">{c.customerName ?? formatNumber(c.customerNumber)}</span>
                        <span className="shrink-0 text-xs text-slate-400">{formatListTime(c.last.created_at, now)}</span>
                      </span>
                      <span className="block truncate text-sm text-slate-500">
                        {optedOut.has(c.customerNumber) && <span className="mr-1 font-medium text-red-600">Opted out ·</span>}
                        {preview(c.last)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          {conversations.length === 0 && (
            <li className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-900">No conversations yet</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">
                Start one by sending a template, or wait for a customer to message your number.
              </p>
              <div className="mt-4 flex justify-center">
                <LinkButton href="/inbox/new">Start a conversation</LinkButton>
              </div>
            </li>
          )}
        </ul>
        {pages > 1 && (
          <div className="flex shrink-0 items-center justify-between border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
            {page > 1 ? <Link href={href({ p: page - 1, with: activeNumber })} className="font-medium text-brand-700">← Newer</Link> : <span />}
            <span>Page {page} of {pages}</span>
            {page < pages ? <Link href={href({ p: page + 1, with: activeNumber })} className="font-medium text-brand-700">Older →</Link> : <span />}
          </div>
        )}
      </aside>

      {/* Thread */}
      <section className={`${active ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-slate-50`}>
        {active ? (
          <>
            <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
              <Link href="/inbox" aria-label="Back to conversations" className={buttonClass("secondary", "sm", "md:hidden")}>
                <Icon name="back" className="h-3.5 w-3.5" />
                Back
              </Link>
              <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 sm:inline-flex">
                <Icon name="user" className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{active.customerName ?? formatNumber(active.customerNumber)}</p>
                <p className="whitespace-nowrap text-xs text-slate-500">{active.customerName ? `${formatNumber(active.customerNumber)} · ` : ""}{threadTotal} messages{optedOut.has(active.customerNumber) && <span className="ml-2 font-medium text-red-600">Opted out</span>}</p>
              </div>
              <span className="shrink-0 whitespace-nowrap">
                {win.open ? (
                  <Badge tone="green">
                    <span className="hidden sm:inline">Reply&nbsp;</span>window open · {win.hoursLeft}h left
                  </Badge>
                ) : (
                  <Badge tone="amber">Window closed</Badge>
                )}
              </span>
            </header>

            <div className="min-h-0 flex-1">
              {threadMessages.length < threadTotal && (
                <div className="border-b border-slate-200 bg-white px-4 py-2 text-center">
                  <Link href={href({ with: active.customerNumber, n: take + 200 })} className="text-sm font-medium text-brand-700 hover:underline">
                    Load older messages ({threadTotal - threadMessages.length} more)
                  </Link>
                </div>
              )}
              <ChatThread messages={active.messages} />
            </div>

            <footer className="max-h-[70%] shrink-0 overflow-y-auto border-t border-slate-200 bg-white p-3 sm:p-4">
              {!win.open && (
                <Alert tone="warning" className="mb-3">
                  This customer hasn&apos;t written in the last 24 hours, so WhatsApp only allows a template message.
                </Alert>
              )}
              <SendMessageForm clientId={client!.id} to={active.customerNumber} disabled={!win.open} />
              <details className="group mt-3">
                <summary className={`${buttonClass(win.open ? "secondary" : "primary", "sm")} cursor-pointer list-none`}>
                  <Icon name="template" className="h-3.5 w-3.5" />
                  Send a template
                </summary>
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <SendTemplateForm templates={(approved ?? []) as SendableTemplate[]} fixedTo={active.customerNumber} />
                </div>
              </details>
            </footer>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-300 shadow-sm">
              <Icon name="chat" className="h-6 w-6" />
            </span>
            <p className="text-sm font-semibold text-slate-900">Select a conversation</p>
            <p className="mt-1 text-sm text-slate-500">Choose a chat on the left to read and reply.</p>
          </div>
        )}
      </section>
    </div>
  );
}
