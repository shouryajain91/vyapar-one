import { NextRequest, NextResponse, after } from "next/server";
import { getSessionClientId } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";
import { loadAccounts } from "@/lib/wa-accounts";
import { cleanRecipients, MAX_RECIPIENTS, type RecipientInput } from "@/lib/campaign-input";
import { runCampaignBatches } from "@/lib/campaign-runner";
import type { SendableTemplate } from "@/lib/template-send";

export const maxDuration = 60;

interface Body {
  name?: string;
  template_name?: string;
  template_language?: string;
  header_link?: string;
  scheduled_at?: string | null; // ISO; empty = send now
  consent?: boolean;
  rows?: RecipientInput[];
}

export async function POST(req: NextRequest) {
  const clientId = await getSessionClientId();
  if (!clientId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = (b.name ?? "").trim().slice(0, 100);
  if (!name) return NextResponse.json({ error: "Give the campaign a name." }, { status: 400 });
  if (b.consent !== true) {
    return NextResponse.json({ error: "Please confirm these customers agreed to receive WhatsApp messages." }, { status: 400 });
  }
  const rows = Array.isArray(b.rows) ? b.rows : [];
  if (!rows.length) return NextResponse.json({ error: "The file has no rows." }, { status: 400 });
  if (rows.length > MAX_RECIPIENTS) {
    return NextResponse.json({ error: `A campaign can have up to ${MAX_RECIPIENTS} recipients. Split the file and try again.` }, { status: 400 });
  }

  const headerLink = (b.header_link ?? "").trim() || null;
  if (headerLink && !/^https:\/\/\S+$/.test(headerLink)) {
    return NextResponse.json({ error: "The header media link must start with https://" }, { status: 400 });
  }

  let scheduledAt = new Date();
  const later = !!b.scheduled_at;
  if (later) {
    scheduledAt = new Date(b.scheduled_at!);
    const ms = scheduledAt.getTime() - Date.now();
    if (Number.isNaN(ms) || ms < -60_000) return NextResponse.json({ error: "Pick a time in the future." }, { status: 400 });
    if (ms > 60 * 24 * 3600_000) return NextResponse.json({ error: "You can schedule up to 60 days ahead." }, { status: 400 });
  }

  const { active: account } = await loadAccounts(clientId);
  if (!account) return NextResponse.json({ error: "Connect a WhatsApp number first." }, { status: 409 });
  if (account.verification_status === "pending_registration") {
    return NextResponse.json({ error: "Finish registering your number on the dashboard first." }, { status: 409 });
  }

  const db = supabaseAdmin();
  const { data: tpl } = await db
    .from("templates")
    .select("name, language, status, body, header_format, header_text, footer, buttons")
    .eq("client_id", clientId)
    .eq("name", b.template_name ?? "")
    .eq("language", b.template_language ?? "")
    .maybeSingle();
  if (!tpl) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  if (tpl.status !== "APPROVED") return NextResponse.json({ error: `This template is ${tpl.status ?? "not approved"} and can't be sent yet.` }, { status: 400 });

  const clean = cleanRecipients(rows, tpl as SendableTemplate, headerLink);
  const queued = clean.filter((r) => r.status === "pending").length;
  if (!queued) {
    return NextResponse.json({ error: "None of the rows can be sent. " + (clean.find((r) => r.error_message)?.error_message ?? "") }, { status: 400 });
  }

  const { data: camp, error } = await db
    .from("campaigns")
    .insert({
      client_id: clientId,
      phone_number_id: account.phone_number_id,
      name,
      template_name: tpl.name,
      template_language: tpl.language,
      header_link: headerLink,
      // Held as "cancelled" until all recipients are stored, so the sender never sees a half-loaded campaign.
      status: "cancelled",
      scheduled_at: scheduledAt.toISOString(),
      total: clean.length,
    })
    .select("id")
    .single();
  if (error || !camp) return NextResponse.json({ error: "Couldn't create the campaign." }, { status: 500 });

  for (let i = 0; i < clean.length; i += 500) {
    const { error: e } = await db.from("campaign_recipients").insert(
      clean.slice(i, i + 500).map((r) => ({ ...r, campaign_id: camp.id, client_id: clientId }))
    );
    if (e) {
      await db.from("campaigns").delete().eq("id", camp.id);
      return NextResponse.json({ error: "Couldn't save the recipients. Nothing was sent." }, { status: 500 });
    }
  }
  await db.from("campaigns").update({ status: "scheduled" }).eq("id", camp.id);

  // Instant campaigns start straight away; the minute cron continues anything left.
  if (!later) after(() => runCampaignBatches(55_000).catch((e) => console.error("campaign run failed", e)));

  return NextResponse.json({ id: camp.id, queued, rejected: clean.length - queued });
}
