"use client";

import { showDemoCaption, PERM_MGMT } from "@/lib/demo";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";

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
    showDemoCaption({ text: "Template deleted from the WhatsApp Business account.", permission: PERM_MGMT });
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button variant="danger" size="sm" onClick={del} disabled={busy}>
        <Icon name="trash" className="h-3.5 w-3.5" />
        {busy ? "Deleting..." : "Delete"}
      </Button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </span>
  );
}
