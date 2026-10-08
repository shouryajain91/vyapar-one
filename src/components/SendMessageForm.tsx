"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SendMessageForm({
  clientId,
  to,
}: {
  clientId: string;
  to: string;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSend() {
    if (!text.trim()) return;
    setError(null);

    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        to,
        type: "text",
        text,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // Free-form text only works inside the 24h customer-reply window.
      // Outside it, Meta will reject this and you need a template instead.
      setError(
        data.error === "WhatsApp API error"
          ? "Send failed — you may be outside the 24-hour window and need to use a template."
          : "Send failed. Please try again."
      );
      return;
    }

    setText("");
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <button
          onClick={handleSend}
          disabled={isPending}
          className="rounded-lg bg-black text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Send
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
