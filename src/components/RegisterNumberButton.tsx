"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";

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
    <div>
      <Button onClick={register} disabled={busy}>
        {busy ? "Registering..." : "Finish registration"}
      </Button>
      {msg && <Alert tone="error" className="mt-3">{msg}</Alert>}
    </div>
  );
}
