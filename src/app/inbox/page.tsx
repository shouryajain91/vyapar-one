import { getCurrentClient } from "@/lib/current-client";
import { supabaseAdmin } from "@/lib/supabase-server";
import { SendMessageForm } from "@/components/SendMessageForm";

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
  const { data: messages } = await admin
    .from("messages")
    .select("*")
    .eq("client_id", client!.id)
    .order("created_at", { ascending: true });

  // Group into conversations by the customer's number
  // (whichever side of from/to isn't our own phone_number_id).
  const conversations = new Map<string, typeof messages>();
  for (const m of messages ?? []) {
    const customerNumber =
      m.direction === "inbound" ? m.from_number : m.to_number;
    if (!customerNumber) continue;
    if (!conversations.has(customerNumber)) {
      conversations.set(customerNumber, []);
    }
    conversations.get(customerNumber)!.push(m);
  }

  const thread = activeNumber ? conversations.get(activeNumber) ?? [] : [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 grid grid-cols-3 gap-6">
      <aside className="col-span-1 border-r pr-4">
        <h2 className="font-medium mb-4">Conversations</h2>
        <ul className="space-y-1">
          {[...conversations.keys()].map((number) => (
            <li key={number}>
              <a
                href={`/inbox?with=${encodeURIComponent(number)}`}
                className={`block rounded px-3 py-2 text-sm ${
                  number === activeNumber
                    ? "bg-black text-white"
                    : "hover:bg-gray-100"
                }`}
              >
                {number}
              </a>
            </li>
          ))}
          {conversations.size === 0 && (
            <li className="text-sm text-gray-500">No conversations yet.</li>
          )}
        </ul>
      </aside>

      <section className="col-span-2">
        {activeNumber ? (
          <>
            <h2 className="font-medium mb-4">{activeNumber}</h2>
            <div className="space-y-2 mb-6 max-h-[60vh] overflow-y-auto">
              {thread.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    m.direction === "outbound"
                      ? "bg-green-100 ml-auto"
                      : "bg-gray-100"
                  }`}
                >
                  <p>{m.body ?? `[${m.message_type}]`}</p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {m.status} ·{" "}
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            <SendMessageForm clientId={client!.id} to={activeNumber} />
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
