export const instant = false;

import { getCurrentClient } from "@/lib/current-client";
import { ConnectWhatsAppButton } from "@/components/ConnectWhatsAppButton";
import { RegisterNumberButton } from "@/components/RegisterNumberButton";
import Link from "next/link";

export default async function DashboardPage() {
  const { client, whatsappAccount } = await getCurrentClient();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold mb-2">
        {client?.business_name}
      </h1>
      <p className="text-gray-600 mb-8">{client?.contact_email}</p>

      <div className="rounded-xl border p-6 mb-8">
        <h2 className="font-medium mb-3">WhatsApp connection</h2>
        {whatsappAccount ? (
          <div className="text-sm text-gray-700">
            <p>
              Connected as{" "}
              <strong>{whatsappAccount.display_name ?? "your business"}</strong>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Phone number ID: {whatsappAccount.phone_number_id}
            </p>
            {whatsappAccount.verification_status === "pending_registration" && (
              <div className="mt-3 rounded-lg bg-amber-50 p-3 text-amber-800">
                <p>
                  Your number is linked but not yet registered with WhatsApp,
                  so it can&apos;t send or receive messages.
                </p>
                <RegisterNumberButton />
              </div>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Connect your WhatsApp Business number to start sending and
              receiving messages.
            </p>
            <ConnectWhatsAppButton clientId={client!.id} />
          </>
        )}
      </div>

      <div className="flex gap-4">
        <Link href="/inbox" className="underline text-sm">
          Go to Inbox
        </Link>
        <Link href="/templates" className="underline text-sm">
          Manage Templates
        </Link>
      </div>
    </main>
  );
}
