export const instant = false;

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Alert, Card, PageContainer, PageHeader, buttonClass, hintCls, inputCls, labelCls } from "@/components/ui";
import { changePasswordAction, sendPasswordCodeAction } from "./actions";

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string; done?: string; error?: string }> }) {
  const { sent, done, error } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <PageContainer>
      <PageHeader title="Change password" description="For your security, we email a one-time code to confirm it's you before the password changes." />
      {error && <Alert tone="error" className="mb-4">{decodeURIComponent(error)}</Alert>}
      {done && <Alert tone="success" className="mb-4">Your password has been changed. Use it next time you log in.</Alert>}

      <Card className="max-w-lg">
        {sent === "1" && !done ? (
          <>
            <p className="mb-4 text-sm text-slate-600">
              We sent a 6-digit code to <strong>{user.email}</strong>. It expires in a few minutes. Check your spam folder if you can&apos;t find it.
            </p>
            <form action={changePasswordAction} className="space-y-4">
              <div>
                <label className={labelCls} htmlFor="code">Code from your email</label>
                <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,9}" maxLength={9} required autoFocus
                  className={`${inputCls} text-center font-mono text-xl tracking-[0.4em]`} />
              </div>
              <div>
                <label className={labelCls} htmlFor="password">New password</label>
                <input id="password" name="password" type="password" minLength={8} maxLength={72} required autoComplete="new-password" className={inputCls} />
                <p className={hintCls}>At least 8 characters.</p>
              </div>
              <div>
                <label className={labelCls} htmlFor="confirm">Confirm new password</label>
                <input id="confirm" name="confirm" type="password" minLength={8} maxLength={72} required autoComplete="new-password" className={inputCls} />
              </div>
              <button type="submit" className={buttonClass("primary")}>Change password</button>
            </form>
            <form action={sendPasswordCodeAction} className="mt-4">
              <button type="submit" className="text-sm font-medium text-brand-700 hover:underline">Send a new code</button>
            </form>
          </>
        ) : (
          <form action={sendPasswordCodeAction} className="space-y-4">
            <p className="text-sm text-slate-600">We&apos;ll send a code to <strong>{user.email}</strong>.</p>
            <button type="submit" className={buttonClass("primary")}>Email me a code</button>
          </form>
        )}
      </Card>
    </PageContainer>
  );
}
