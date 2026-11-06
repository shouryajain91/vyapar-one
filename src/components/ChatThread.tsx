"use client";

import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { MessageRow } from "@/lib/conversations";

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
                  {out && m.status ? ` · ${m.status}` : ""}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
    </div>
  );
}
