export const instant = false;

import Link from "next/link";
import { signupAction } from "./actions";
import { AuthShell } from "@/components/AuthShell";
import { Alert, buttonClass, hintCls, inputCls, labelCls } from "@/components/ui";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up your business on Vyapar One in a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">Log in</Link>
        </>
      }
    >
      {error && <Alert tone="error" className="mb-4">{decodeURIComponent(error)}</Alert>}
      <form action={signupAction} className="space-y-4">
        <div>
          <label className={labelCls}>Business name</label>
          <input name="business_name" required className={inputCls} placeholder="Acme Traders" />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input name="email" type="email" required autoComplete="email" className={inputCls} placeholder="you@business.com" />
        </div>
        <div>
          <label className={labelCls}>Password</label>
          <input name="password" type="password" required minLength={6} autoComplete="new-password" className={inputCls} />
          <p className={hintCls}>At least 6 characters.</p>
        </div>
        <button type="submit" className={buttonClass("primary", "md", "w-full")}>Create account</button>
      </form>
    </AuthShell>
  );
}
