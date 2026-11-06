export const instant = false;

import { forgotPasswordAction } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold mb-2">Reset your password</h1>
      <p className="text-sm text-gray-600 mb-6">
        Enter your account email and we&apos;ll send you a link to choose a new
        password.
      </p>
      {error && (
        <p className="text-sm text-red-600 mb-4 bg-red-50 rounded p-3">{error}</p>
      )}
      {sent ? (
        <p className="text-sm text-green-800 mb-4 bg-green-50 rounded p-3">
          If an account exists for that email, a reset link is on its way.
          Check your inbox and spam folder. The link works once and expires
          soon.
        </p>
      ) : (
        <form action={forgotPasswordAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-black text-white py-2 font-medium"
          >
            Send reset link
          </button>
        </form>
      )}
      <p className="text-sm text-gray-600 mt-4">
        <a href="/login" className="underline">Back to log in</a>
      </p>
    </main>
  );
}
