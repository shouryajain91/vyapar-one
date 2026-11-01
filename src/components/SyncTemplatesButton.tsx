"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncTemplatesButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/templates/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Sync failed");
      } else {
        setMsg(`Synced ${data.count} template${data.count === 1 ? "" : "s"}`);
        router.refresh();
      }
    } catch {
      setMsg("Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 mb-6">
      <button
        onClick={sync}
        disabled={busy}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {busy ? "Syncing..." : "Sync from WhatsApp"}
      </button>
      {msg && <span className="text-sm text-gray-600">{msg}</span>}
    </div>
  );
}
