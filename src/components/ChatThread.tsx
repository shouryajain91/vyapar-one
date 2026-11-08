"use client";

import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { MessageRow } from "@/lib/conversations";
import { explainError } from "@/lib/wa-errors";

const STATUS_LABEL: Record<string, string> = {
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
};

/** Messages for one conversation. Scrolls to the newest message. */
export function ChatThread({ messages }: { messages: MessageRow[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="h-full overflow-y-auto px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-2">
        {messages.map((m) => {
          const out = m.direction === "outbound";
          return (
            <div key={m.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[75%] ${
                  out
                    ? "rounded-br-md bg-brand-100 text-slate-900"
                    : "rounded-bl-md border border-slate-200 bg-white text-slate-900"
                }`}
              >
                {m.message_type === "template" && (
                  <div className="mb-1">
                    <Badge tone="brand">Template</Badge>
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words">{m.body ?? `[${m.message_type}]`}</p>
                <p className={`mt-1 text-[11px] ${m.status === "failed" ? "text-red-600" : "text-slate-500"}`}>
                  {formatDateTime(m.created_at)}
                  {out && m.status ? ` · ${STATUS_LABEL[m.status] ?? m.status}` : ""}
                  {out && m.status === "read" && m.read_at ? ` at ${formatDateTime(m.read_at)}` : ""}
                  {out && m.status === "delivered" && m.delivered_at ? ` at ${formatDateTime(m.delivered_at)}` : ""}
                </p>
                {out && m.status === "failed" && (
                  <div className="mt-1 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-800">
                    <p>{explainError(m.error_code, m.error_message)}</p>
                    {(m.error_code || m.error_message) && (
                      <p className="mt-0.5 text-[11px] text-red-600/80">
                        {m.error_code ? `Code ${m.error_code}` : ""}
                        {m.error_code && m.error_message ? ": " : ""}
                        {m.error_message ?? ""}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
    </div>
  );
}
