export const instant = false;

import Link from "next/link";
import { getCurrentClient } from "@/lib/current-client";
import { supabaseAdmin } from "@/lib/supabase-server";
import { SyncTemplatesButton } from "@/components/SyncTemplatesButton";
import { DeleteTemplateButton } from "@/components/DeleteTemplateButton";

const STATUS_STYLE: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-800",
  PENDING: "bg-amber-100 text-amber-800",
  IN_APPEAL: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-100 text-red-800",
  PAUSED: "bg-gray-200 text-gray-700",
  DISABLED: "bg-gray-200 text-gray-700",
};

export default async function TemplatesPage() {
  const { client, whatsappAccount } = await getCurrentClient();
  const admin = supabaseAdmin();

  const { data: templates } = await admin
    .from("templates")
    .select("*")
    .eq("client_id", client!.id)
    .order("synced_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold">Message Templates</h1>
        {whatsappAccount && (
          <Link href="/templates/new" className="rounded-lg bg-black px-4 py-2 text-sm text-white">
            New template
          </Link>
        )}
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Templates are reviewed by WhatsApp before you can use them. Create one
        here, or sync the ones you made in WhatsApp Manager.
      </p>
      {whatsappAccount ? (
        <SyncTemplatesButton />
      ) : (
        <p className="text-sm text-gray-500 mb-6">
          Connect WhatsApp from your dashboard to manage templates.
        </p>
      )}
      <ul className="space-y-3">
        {(templates ?? []).map((t) => (
          <li key={t.id} className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-gray-500">{t.language} · {t.category}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[t.status ?? ""] ?? "bg-gray-100 text-gray-700"}`}>
                {t.status ?? "UNKNOWN"}
              </span>
            </div>
            {t.header_format && (
              <p className="mt-2 text-xs font-medium text-gray-600">
                {t.header_format === "TEXT"
                  ? `Header: ${t.header_text ?? ""}`
                  : `Header: ${t.header_format === "DOCUMENT" ? "PDF" : t.header_format.toLowerCase()}`}
              </p>
            )}
            {t.body && <p className="text-sm mt-2 whitespace-pre-wrap">{t.body}</p>}
            {t.footer && <p className="mt-1 text-xs text-gray-500">{t.footer}</p>}
            {Array.isArray(t.buttons) && t.buttons.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {(t.buttons as { type: string; text: string }[]).map((b, i) => (
                  <span key={i} className="rounded-full border px-3 py-1 text-xs text-gray-700">
                    {b.type === "URL" ? "🔗 " : b.type === "PHONE_NUMBER" ? "📞 " : ""}
                    {b.text}
                  </span>
                ))}
              </div>
            )}
            {t.status === "REJECTED" && t.rejected_reason && t.rejected_reason !== "NONE" && (
              <p className="mt-2 text-xs text-red-700">Reason: {t.rejected_reason}</p>
            )}
            <div className="mt-3">
              <DeleteTemplateButton name={t.name} />
            </div>
          </li>
        ))}
        {(!templates || templates.length === 0) && (
          <p className="text-sm text-gray-500">No templates yet.</p>
        )}
      </ul>
    </main>
  );
}
