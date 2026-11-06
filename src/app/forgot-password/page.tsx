export const instant = false;

import Link from "next/link";
import { forgotPasswordAction } from "./actions";
import { AuthShell } from "@/components/AuthShell";
import { Alert, buttonClass, inputCls, labelCls } from "@/components/ui";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your account email and we'll send you a link to choose a new password."
      footer={<Link href="/login" className="font-semibold text-brand-700 hover:underline">Back to log in</Link>}
    >
      {error && <Alert tone="error" className="mb-4">{error}</Alert>}
      {sent ? (
        <Alert tone="success">
          If an account exists for that email, a reset link is on its way. Check your inbox and spam
          folder. The link works once and expires soon.
        </Alert>
      ) : (
        <form action={forgotPasswordAction} className="space-y-4">
          <div>
            <label className={labelCls}>Email</label>
            <input name="email" type="email" required autoComplete="email" className={inputCls} />
          </div>
          <button type="submit" className={buttonClass("primary", "md", "w-full")}>Send reset link</button>
        </form>
      )}
    </AuthShell>
  );
}
