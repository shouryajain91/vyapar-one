"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RegisterNumberButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function register() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/onboarding/register-number", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setMsg(data.error ?? "Registration failed");
      else router.refresh();
    } catch {
      setMsg("Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={register}
        disabled={busy}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {busy ? "Registering..." : "Finish registration"}
      </button>
      {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
    </div>
  );
}
