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
import { groupConversations, preview, type MessageRow } from "@/lib/conversations";
import { formatListTime, formatNumber, replyWindow } from "@/lib/format";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string }>;
}) {
  const { client, whatsappAccount } = await getCurrentClient();
  const { with: activeNumber } = await searchParams;

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
  const [{ data }, { data: approved }] = await Promise.all([
    admin.from("messages").select("*").eq("client_id", client!.id).order("created_at", { ascending: true }),
    admin
      .from("templates")
      .select("name, language, status, body, header_format, header_text, footer, buttons")
      .eq("client_id", client!.id)
      .eq("status", "APPROVED")
      .order("name"),
  ]);

  const conversations = groupConversations((data ?? []) as MessageRow[]);
  const active = conversations.find((c) => c.customerNumber === activeNumber);
  const now = new Date();

  const lastInbound = active
    ? [...active.messages].reverse().find((m) => m.direction === "inbound")?.created_at ?? null
    : null;
  const win = replyWindow(lastInbound, now);

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
              {conversations.length} chat{conversations.length === 1 ? "" : "s"} · {whatsappAccount.display_name ?? "your number"}
            </p>
          </div>
          <LinkButton href="/inbox/new" size="sm">
            <Icon name="plus" className="h-3.5 w-3.5" />
            New
          </LinkButton>
        </div>
        <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
          {conversations
            .slice()
            .map((c) => {
              const selected = c.customerNumber === activeNumber;
              return (
                <li key={c.customerNumber}>
                  <Link
                    href={`/inbox?with=${encodeURIComponent(c.customerNumber)}`}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      selected ? "bg-brand-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <Icon name="user" className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">{formatNumber(c.customerNumber)}</span>
                        <span className="shrink-0 text-xs text-slate-400">{formatListTime(c.last.created_at, now)}</span>
                      </span>
                      <span className="block truncate text-sm text-slate-500">{preview(c.last)}</span>
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
                <p className="truncate text-sm font-semibold text-slate-900">{formatNumber(active.customerNumber)}</p>
                <p className="whitespace-nowrap text-xs text-slate-500">{active.messages.length} messages</p>
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
