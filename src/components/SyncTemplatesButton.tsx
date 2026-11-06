"use client";

import { showDemoCaption, PERM_MGMT } from "@/lib/demo";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";

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
        showDemoCaption({ text: `Fetched ${data.count} template${data.count === 1 ? "" : "s"} from the WhatsApp Business account, with their approval status.`, permission: PERM_MGMT });
        router.refresh();
      }
    } catch {
      setMsg("Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-sm text-slate-500">{msg}</span>}
      <Button variant="secondary" onClick={sync} disabled={busy}>
        <Icon name="refresh" className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        {busy ? "Syncing..." : "Sync from WhatsApp"}
      </Button>
    </div>
  );
}
