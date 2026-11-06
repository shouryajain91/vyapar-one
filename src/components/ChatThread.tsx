import type { MessageRow } from "@/lib/conversations";

export function ChatThread({ messages }: { messages: MessageRow[] }) {
  return (
    <div className="space-y-2 mb-6 max-h-[60vh] overflow-y-auto">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
            m.direction === "outbound" ? "bg-green-100 ml-auto" : "bg-gray-100"
          }`}
        >
          <p>{m.body ?? `[${m.message_type}]`}</p>
          <p className="text-[10px] text-gray-500 mt-1">
            {m.status} · {new Date(m.created_at).toLocaleString("en-IN")}
          </p>
        </div>
      ))}
    </div>
  );
}
