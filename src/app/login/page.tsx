export const instant = false;

import Link from "next/link";
import { loginAction } from "./actions";
import { AuthShell } from "@/components/AuthShell";
import { Alert, buttonClass, inputCls, labelCls } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthShell
      title="Log in"
      subtitle="Welcome back. Log in to manage your WhatsApp conversations."
      footer={
        <>
          New to Vyapar One?{" "}
          <Link href="/signup" className="font-semibold text-brand-700 hover:underline">Create an account</Link>
        </>
      }
    >
      {error && <Alert tone="error" className="mb-4">{decodeURIComponent(error)}</Alert>}
      <form action={loginAction} className="space-y-4">
        <div>
          <label className={labelCls}>Email</label>
          <input name="email" type="email" required autoComplete="email" className={inputCls} />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Password</label>
            <Link href="/forgot-password" className="text-sm font-medium text-brand-700 hover:underline">
              Forgot password?
            </Link>
          </div>
          <input name="password" type="password" required autoComplete="current-password" className={inputCls} />
        </div>
        <button type="submit" className={buttonClass("primary", "md", "w-full")}>Log in</button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <Link href="/login/code" className={buttonClass("secondary", "md", "w-full")}>
        Email me a login code
      </Link>
    </AuthShell>
  );
}
