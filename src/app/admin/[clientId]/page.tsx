export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import { logAdminAccess, requirePlatformAdmin } from "@/lib/platform-admin";
import { supabaseAdmin } from "@/lib/supabase-server";
import { ChatThread } from "@/components/ChatThread";
import { groupConversations, preview, type MessageRow } from "@/lib/conversations";

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

  const { data } = await db
    .from("messages")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  const conversations = groupConversations((data ?? []) as MessageRow[]);
  const active = conversations.find((c) => c.customerNumber === activeNumber);

  await logAdminAccess({
    adminUserId: user.id,
    adminEmail: email,
    clientId,
    customerNumber: active?.customerNumber ?? null,
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/admin" className="text-sm underline">
        ← All clients
      </Link>
      <h1 className="text-xl font-semibold mt-3">{client.business_name}</h1>
      <p className="text-sm text-gray-600 mb-6">
        {client.contact_email} · read-only, access is logged
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <aside className="md:col-span-1 md:border-r md:pr-4">
          <ul className="space-y-1">
            {conversations.map((c) => (
              <li key={c.customerNumber}>
                <Link
                  href={`/admin/${clientId}?with=${encodeURIComponent(c.customerNumber)}`}
                  className={`block rounded px-3 py-2 text-sm ${
                    c.customerNumber === activeNumber ? "bg-black text-white" : "hover:bg-gray-100"
                  }`}
                >
                  <span className="block font-medium">{c.customerNumber}</span>
                  <span className="block truncate text-xs opacity-70">{preview(c.last)}</span>
                </Link>
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
            </>
          ) : (
            <p className="text-sm text-gray-500">Select a conversation to view messages.</p>
          )}
        </section>
      </div>
    </main>
  );
}
