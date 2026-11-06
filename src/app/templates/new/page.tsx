export const instant = false;

import Link from "next/link";
import { getCurrentClient } from "@/lib/current-client";
import { NewTemplateForm } from "@/components/NewTemplateForm";

export default async function NewTemplatePage() {
  const { whatsappAccount } = await getCurrentClient();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/templates" className="text-sm underline">← Templates</Link>
      <h1 className="text-2xl font-semibold mt-3 mb-2">New message template</h1>
      <p className="text-sm text-gray-600 mb-8">
        Templates let you message a customer first, or after the 24-hour reply
        window. WhatsApp reviews each one, usually within minutes to a few hours.
      </p>
      {whatsappAccount ? (
        <NewTemplateForm />
      ) : (
        <p className="text-sm text-gray-500">Connect WhatsApp from your dashboard first.</p>
      )}
    </main>
  );
}
