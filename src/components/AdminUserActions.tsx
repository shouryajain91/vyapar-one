"use client";

import { useState } from "react";
import { createResetLinkAction, setTempPasswordAction } from "@/app/admin/actions";

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
    if ("link" in res) setOut({ label: "Reset link (send it to the user, works once):", value: res.link });
    else setOut({ label: "Temporary password (shown once, ask the user to change it):", value: res.password });
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => run("link")}
          className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50">
          Create reset link
        </button>
        <button disabled={busy} onClick={() => run("temp")}
          className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50">
          Set temporary password
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      {out && (
        <div className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-900">
          <p className="mb-1">{out.label}</p>
          <code className="block break-all select-all">{out.value}</code>
        </div>
      )}
    </div>
  );
}
