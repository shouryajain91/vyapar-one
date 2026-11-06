import { NextResponse } from "next/server";
import { supabaseRSC } from "@/lib/supabase-rsc";
import { loadAccounts } from "@/lib/wa-accounts";
import { supabaseAdmin } from "@/lib/supabase-server";
import { decrypt } from "@/lib/crypto";

const GRAPH_VERSION = "v21.0";

interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components?: {
    type: string;
    format?: string;
    text?: string;
    buttons?: { type: string; text: string; url?: string; phone_number?: string }[];
  }[];
}

// Pulls the logged-in client's message templates from their WABA on Meta
// and upserts them into our `templates` table.
export async function POST() {
  const supabase = await supabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data: appUser } = await db
    .from("app_users")
    .select("client_id")
    .eq("user_id", user.id)
    .single();
  if (!appUser) {
    return NextResponse.json({ error: "No client for user" }, { status: 403 });
  }

  const { active: account } = await loadAccounts(appUser.client_id);
  if (!account) {
    return NextResponse.json(
      { error: "Connect WhatsApp first" },
      { status: 404 }
    );
  }

  const accessToken = decrypt(account.access_token_encrypted);

  const all: MetaTemplate[] = [];
  let url: string | null =
    `https://graph.facebook.com/${GRAPH_VERSION}/${account.waba_id}/message_templates` +
    `?fields=id,name,language,category,status,components&limit=100`;

  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("Template fetch failed:", data);
      return NextResponse.json(
        { error: "Could not fetch templates from Meta", details: data },
        { status: 502 }
      );
    }
    all.push(...(data.data ?? []));
    url = data.paging?.next ?? null;
  }

  const now = new Date().toISOString();
  const rows = all.map((t) => ({
    client_id: appUser.client_id,
    meta_template_id: t.id,
    name: t.name,
    language: t.language,
    category: t.category,
    status: t.status,
    body: t.components?.find((c) => c.type === "BODY")?.text ?? null,
    header_format: t.components?.find((c) => c.type === "HEADER")?.format ?? null,
    header_text:
      t.components?.find((c) => c.type === "HEADER" && c.format === "TEXT")?.text ?? null,
    footer: t.components?.find((c) => c.type === "FOOTER")?.text ?? null,
    buttons:
      t.components
        ?.find((c) => c.type === "BUTTONS")
        ?.buttons?.map((b) => ({
          type: b.type,
          text: b.text,
          ...(b.url ? { url: b.url } : {}),
          ...(b.phone_number ? { phone: b.phone_number } : {}),
        })) ?? null,
    synced_at: now,
  }));

  if (rows.length > 0) {
    const { error } = await db
      .from("templates")
      .upsert(rows, { onConflict: "client_id,name,language" });
    if (error) {
      console.error("Template upsert failed:", error);
      return NextResponse.json({ error: "Could not save templates" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, count: rows.length });
}
