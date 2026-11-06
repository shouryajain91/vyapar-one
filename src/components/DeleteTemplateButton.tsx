"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteTemplateButton({ name }: { name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function del() {
    if (!window.confirm(`Delete template "${name}" in all languages? This also removes it from WhatsApp and can't be undone.`)) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/templates?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return setErr(data.error ?? "Delete failed");
    }
    router.refresh();
  }

  return (
    <span>
      <button onClick={del} disabled={busy} className="text-xs text-red-600 underline disabled:opacity-50">
        {busy ? "Deleting..." : "Delete"}
      </button>
      {err && <span className="ml-2 text-xs text-red-600">{err}</span>}
    </span>
  );
}
