"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Alert, buttonClass } from "@/components/ui";

export interface SecretState {
  error?: string;
  secret?: string;
  note?: string;
}

/** A form whose result is a secret (API key, signing secret) shown exactly once. */
export function SecretForm({
  action,
  submitLabel,
  secretTitle,
  children,
}: {
  action: (prev: SecretState, fd: FormData) => Promise<SecretState>;
  submitLabel: string;
  secretTitle: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [copied, setCopied] = useState(false);

  return (
    <div>
      {state.secret && (
        <Alert tone="success" className="mb-4">
          <p className="font-semibold">{secretTitle}</p>
          <p className="mt-1 text-xs">Copy it now. For your security it is shown only this once and we can&apos;t show it again.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-white px-2 py-1 font-mono text-xs text-slate-900 ring-1 ring-emerald-200">{state.secret}</code>
            <button
              type="button"
              className={buttonClass("secondary", "sm")}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(state.secret!);
                  setCopied(true);
                } catch {}
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {state.note && <p className="mt-2 text-xs">{state.note}</p>}
        </Alert>
      )}
      {state.error && <Alert tone="error" className="mb-4">{state.error}</Alert>}
      <form action={formAction} className="space-y-4">
        {children}
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Working…" : submitLabel}
        </button>
      </form>
    </div>
  );
}
