export const instant = false;

import { getCurrentClient } from "@/lib/current-client";
import { supabaseAdmin } from "@/lib/supabase-server";
import { SendMessageForm } from "@/components/SendMessageForm";
import { ChatThread } from "@/components/ChatThread";
import { SendTemplateForm } from "@/components/SendTemplateForm";
import type { SendableTemplate } from "@/lib/template-send";
import { groupConversations, preview, type MessageRow } from "@/lib/conversations";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string }>;
}) {
  const { client, whatsappAccount } = await getCurrentClient();
  const { with: activeNumber } = await searchParams;

  if (!whatsappAccount) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p>Connect WhatsApp from your dashboard first.</p>
      </main>
    );
  }

  const admin = supabaseAdmin();
  const { data } = await admin
    .from("messages")
    .select("*")
    .eq("client_id", client!.id)
    .order("created_at", { ascending: true });

  const { data: approved } = await admin
    .from("templates")
    .select("name, language, status, body, header_format, header_text, footer, buttons")
    .eq("client_id", client!.id)
    .eq("status", "APPROVED")
    .order("name");

  const conversations = groupConversations((data ?? []) as MessageRow[]);
  const active = conversations.find((c) => c.customerNumber === activeNumber);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-6">
      <aside className="md:col-span-1 md:border-r md:pr-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-medium">Conversations</h2>
          <a href="/inbox/new" className="rounded bg-black px-3 py-1 text-xs text-white">New</a>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {conversations.length} chat{conversations.length === 1 ? "" : "s"} on{" "}
          {whatsappAccount.display_name ?? "your number"}
        </p>
        <ul className="space-y-1">
          {conversations.map((c) => (
            <li key={c.customerNumber}>
              <a
                href={`/inbox?with=${encodeURIComponent(c.customerNumber)}`}
                className={`block rounded px-3 py-2 text-sm ${
                  c.customerNumber === activeNumber
                    ? "bg-black text-white"
                    : "hover:bg-gray-100"
                }`}
              >
                <span className="block font-medium">{c.customerNumber}</span>
                <span className="block truncate text-xs opacity-70">
                  {preview(c.last)}
                </span>
              </a>
            </li>
          ))}
          {conversations.length === 0 && (
            <li className="text-sm text-gray-500">No conversations yet.</li>
          )}
        </ul>
      </aside>

      <section className="md:col-span-2">
        {active ? (
          <>
            <h2 className="font-medium mb-4">{active.customerNumber}</h2>
            <ChatThread messages={active.messages} />
            <SendMessageForm clientId={client!.id} to={active.customerNumber} />
            <details className="mt-6 rounded-lg border p-4">
              <summary className="cursor-pointer text-sm font-medium">Send a template</summary>
              <p className="mt-2 mb-4 text-xs text-gray-500">
                Use a template when the customer hasn&apos;t written in the last 24 hours.
              </p>
              <SendTemplateForm
                templates={(approved ?? []) as SendableTemplate[]}
                fixedTo={active.customerNumber}
              />
            </details>
          </>
        ) : (
          <p className="text-gray-500 text-sm">
            Select a conversation to view messages.
          </p>
        )}
      </section>
    </main>
  );
}
