export const instant = false;

import Link from "next/link";
import { cookies } from "next/headers";
import { AuthShell } from "@/components/AuthShell";
import { Alert, buttonClass, inputCls, labelCls, hintCls } from "@/components/ui";
import { sendLoginCodeAction, verifyLoginCodeAction } from "./actions";

export default async function LoginCodePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  const email = (await cookies()).get("login_code_email")?.value;
  const enterCode = sent === "1" && !!email;

  return (
    <AuthShell
      title={enterCode ? "Check your email" : "Log in with an email code"}
      subtitle={
        enterCode
          ? `If ${email} has an account, we've sent a 6-digit code. It expires in a few minutes.`
          : "We'll email you a one-time code. No password needed."
      }
      footer={
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Log in with a password instead
        </Link>
      }
    >
      {error && <Alert tone="error" className="mb-4">{decodeURIComponent(error)}</Alert>}

      {enterCode ? (
        <>
          <form action={verifyLoginCodeAction} className="space-y-4">
            <div>
              <label className={labelCls} htmlFor="code">Code</label>
              <input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,9}"
                maxLength={9}
                required
                autoFocus
                className={`${inputCls} text-center font-mono text-xl tracking-[0.4em]`}
              />
              <p className={hintCls}>Can&apos;t find it? Check your spam folder.</p>
            </div>
            <button type="submit" className={buttonClass("primary", "md", "w-full")}>Log in</button>
          </form>
          <form action={sendLoginCodeAction} className="mt-4 text-center">
            <input type="hidden" name="email" value={email} />
            <button type="submit" className="text-sm font-medium text-brand-700 hover:underline">
              Send a new code
            </button>
          </form>
        </>
      ) : (
        <form action={sendLoginCodeAction} className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" autoFocus className={inputCls} />
          </div>
          <button type="submit" className={buttonClass("primary", "md", "w-full")}>Email me a code</button>
        </form>
      )}
    </AuthShell>
  );
}
