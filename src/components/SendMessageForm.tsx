"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, inputCls } from "@/components/ui";
import { Icon } from "@/components/icons";

export function SendMessageForm({
  clientId,
  to,
  disabled = false,
}: {
  clientId: string;
  to: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSend() {
    if (!text.trim() || disabled) return;
    setError(null);

    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, to, type: "text", text }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // Free-form text only works inside the 24h customer-reply window.
      setError(
        data.error === "WhatsApp API error"
          ? "Send failed. If the customer hasn't written in the last 24 hours, send a template instead."
          : data.error ?? "Send failed. Please try again."
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
          placeholder={disabled ? "Reply window closed. Send a template instead." : "Type a message..."}
          disabled={disabled}
          className={inputCls}
        />
        <Button onClick={handleSend} disabled={isPending || disabled || !text.trim()}>
          <Icon name="send" />
          Send
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
