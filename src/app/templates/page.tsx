export const instant = false;

import { getCurrentClient } from "@/lib/current-client";
import { supabaseAdmin } from "@/lib/supabase-server";

export default async function TemplatesPage() {
  const { client } = await getCurrentClient();
  const admin = supabaseAdmin();

  const { data: templates } = await admin
    .from("templates")
    .select("*")
    .eq("client_id", client!.id)
    .order("synced_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold mb-6">Message Templates</h1>
      <p className="text-sm text-gray-600 mb-6">
        Templates are created and approved in Meta's WhatsApp Manager, then
        synced here. (Template-sync route not yet built — see project spec,
        step 8.)
      </p>
      <ul className="space-y-3">
        {(templates ?? []).map((t) => (
          <li key={t.id} className="rounded-lg border p-4">
            <p className="font-medium">{t.name}</p>
            <p className="text-xs text-gray-500">
              {t.language} · {t.category} · {t.status}
            </p>
            {t.body && <p className="text-sm mt-2">{t.body}</p>}
          </li>
        ))}
        {(!templates || templates.length === 0) && (
          <p className="text-sm text-gray-500">No templates synced yet.</p>
        )}
      </ul>
    </main>
  );
}
