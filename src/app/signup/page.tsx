export const instant = false;

import { signupAction } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold mb-6">Create your account</h1>
      {error && (
        <p className="text-sm text-red-600 mb-4 bg-red-50 rounded p-3">
          {decodeURIComponent(error)}
        </p>
      )}
      <form action={signupAction} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Business name
          </label>
          <input
            name="business_name"
            required
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Acme Traders"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-lg border px-3 py-2"
            placeholder="you@business.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-black text-white py-2 font-medium"
        >
          Sign up
        </button>
      </form>
    </main>
  );
}
