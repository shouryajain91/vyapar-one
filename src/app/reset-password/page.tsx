export const instant = false;

import { redirect } from "next/navigation";
import { supabaseRSC } from "@/lib/supabase-rsc";
import { resetPasswordAction } from "./actions";
import { AuthShell } from "@/components/AuthShell";
import { Alert, buttonClass, inputCls, labelCls } from "@/components/ui";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Only reachable after clicking a valid reset link (which signs you in).
  const supabase = await supabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/forgot-password?error=" + encodeURIComponent("Open the reset link from your email, or request a new one."));
  }

  return (
    <AuthShell title="Choose a new password" subtitle={`For ${user.email}`}>
      {error && <Alert tone="error" className="mb-4">{error}</Alert>}
      <form action={resetPasswordAction} className="space-y-4">
        <div>
          <label className={labelCls}>New password</label>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Confirm password</label>
          <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
        </div>
        <button type="submit" className={buttonClass("primary", "md", "w-full")}>Save password</button>
      </form>
    </AuthShell>
  );
}
