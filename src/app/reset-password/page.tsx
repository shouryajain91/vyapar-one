export const instant = false;

import { redirect } from "next/navigation";
import { supabaseRSC } from "@/lib/supabase-rsc";
import { resetPasswordAction } from "./actions";

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
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold mb-2">Choose a new password</h1>
      <p className="text-sm text-gray-600 mb-6">For {user.email}</p>
      {error && (
        <p className="text-sm text-red-600 mb-4 bg-red-50 rounded p-3">{error}</p>
      )}
      <form action={resetPasswordAction} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">New password</label>
          <input name="password" type="password" required minLength={8}
            className="w-full rounded-lg border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Confirm password</label>
          <input name="confirm" type="password" required minLength={8}
            className="w-full rounded-lg border px-3 py-2" />
        </div>
        <button type="submit" className="w-full rounded-lg bg-black text-white py-2 font-medium">
          Save password
        </button>
      </form>
    </main>
  );
}
