"use client";

import { showDemoCaption, PERM_MGMT } from "@/lib/demo";
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
      else {
        showDemoCaption({ text: "Phone number registered with the WhatsApp Cloud API.", permission: PERM_MGMT });
        router.refresh();
      }
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
