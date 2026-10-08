import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-semibold mb-4">Vyapar One</h1>
      <p className="text-gray-600 max-w-md mb-8">
        Connect your WhatsApp Business number and talk to your customers from
        one shared inbox.
      </p>
      <div className="flex gap-4">
        <Link
          href="/signup"
          className="rounded-lg bg-black text-white px-5 py-2 font-medium"
        >
          Get started
        </Link>
        <Link href="/login" className="rounded-lg border px-5 py-2 font-medium">
          Log in
        </Link>
      </div>
    </main>
  );
}
