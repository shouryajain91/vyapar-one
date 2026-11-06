export const instant = false;

import Link from "next/link";
import { getCurrentClient } from "@/lib/current-client";
import { supabaseAdmin } from "@/lib/supabase-server";
import { SendTemplateForm } from "@/components/SendTemplateForm";
import type { SendableTemplate } from "@/lib/template-send";

export default async function NewConversationPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; language?: string }>;
}) {
  const { client, whatsappAccount } = await getCurrentClient();
  const { template, language } = await searchParams;

  const { data } = await supabaseAdmin()
    .from("templates")
    .select("name, language, status, body, header_format, header_text, footer, buttons")
    .eq("client_id", client!.id)
    .eq("status", "APPROVED")
    .order("name");

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/inbox" className="text-sm underline">← Inbox</Link>
      <h1 className="text-2xl font-semibold mt-3 mb-2">New conversation</h1>
      <p className="text-sm text-gray-600 mb-8">
        Start a chat by sending an approved template. Use this when the customer hasn&apos;t
        messaged you in the last 24 hours.
      </p>
      {whatsappAccount ? (
        <SendTemplateForm
          templates={(data ?? []) as SendableTemplate[]}
          defaultKey={template && language ? `${template}|${language}` : undefined}
        />
      ) : (
        <p className="text-sm text-gray-500">Connect WhatsApp from your dashboard first.</p>
      )}
    </main>
  );
}
