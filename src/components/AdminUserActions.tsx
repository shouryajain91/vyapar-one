"use client";

import { useState } from "react";
import { createResetLinkAction, setTempPasswordAction } from "@/app/(app)/admin/actions";
import { Alert, Button } from "@/components/ui";
import { Icon } from "@/components/icons";

export function AdminUserActions({ userId, email }: { userId: string; email: string }) {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ label: string; value: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(kind: "link" | "temp") {
    const ok = window.confirm(
      kind === "link"
        ? `Create a one-time password reset link for ${email}?`
        : `Set a new temporary password for ${email}? Their current password stops working.`
    );
    if (!ok) return;
    setBusy(true);
    setErr(null);
    setOut(null);
    const res = kind === "link" ? await createResetLinkAction(userId) : await setTempPasswordAction(userId);
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    if ("link" in res) setOut({ label: "Reset link. Send it to the user, it works once:", value: res.link });
    else setOut({ label: "Temporary password. Shown once, ask the user to change it:", value: res.password });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => run("link")}>
          <Icon name="link" className="h-3.5 w-3.5" />
          Create reset link
        </Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => run("temp")}>
          <Icon name="shield" className="h-3.5 w-3.5" />
          Set temporary password
        </Button>
      </div>
      {err && <Alert tone="error" className="mt-3">{err}</Alert>}
      {out && (
        <Alert tone="warning" className="mt-3">
          <p className="mb-1 font-medium">{out.label}</p>
          <code className="block break-all rounded bg-white/70 p-2 text-xs select-all">{out.value}</code>
        </Alert>
      )}
    </div>
  );
}
