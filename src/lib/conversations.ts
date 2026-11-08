export interface MessageRow {
  id: string;
  direction: "inbound" | "outbound";
  from_number: string | null;
  to_number: string | null;
  message_type: string | null;
  body: string | null;
  contact_name?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  status: string | null;
  created_at: string;
}

export interface Conversation {
  customerNumber: string;
  /** The customer's WhatsApp profile name, from their latest message that had one. */
  customerName: string | null;
  messages: MessageRow[];
  last: MessageRow;
}

/** Groups messages by customer number, most recently active first. */
export function groupConversations(messages: MessageRow[]): Conversation[] {
  const map = new Map<string, MessageRow[]>();
  for (const m of messages) {
    const customer = m.direction === "inbound" ? m.from_number : m.to_number;
    if (!customer) continue;
    if (!map.has(customer)) map.set(customer, []);
    map.get(customer)!.push(m);
  }
  return [...map.entries()]
    .map(([customerNumber, msgs]) => {
      const sorted = [...msgs].sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      );
      const customerName = [...sorted].reverse().find((m) => m.contact_name)?.contact_name ?? null;
      return { customerNumber, customerName, messages: sorted, last: sorted[sorted.length - 1] };
    })
    .sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
}

export function preview(m: MessageRow): string {
  const text = m.body ?? `[${m.message_type ?? "message"}]`;
  return (m.direction === "outbound" ? "You: " : "") + text;
}
