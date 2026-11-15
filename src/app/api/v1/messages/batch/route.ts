import { NextResponse, after } from "next/server";
import { api, fail, readJson } from "@/lib/api";
import { withIdempotency } from "@/lib/api-idem";
import { supabaseAdmin } from "@/lib/supabase-server";
import { cleanRecipients, type RecipientInput } from "@/lib/campaign-input";
import { runCampaignBatches } from "@/lib/campaign-runner";
import type { SendableTemplate } from "@/lib/template-send";
import type { ApiResult } from "@/lib/api-send";

export const maxDuration = 60;
const MAX = 1000;

/** Queue the same template for up to 1,000 customers. Sending continues in the background. */
export const POST = api("send", async (req, key) => {
  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  const b = parsed.body;

  const res = await withIdempotency(req, key, b, async (): Promise<ApiResult> => {
    const err = (status: number, code: string, message: string): ApiResult => ({ status, definitive: true, body: { error: { code, message } } });
    const t = (b.template ?? {}) as Record<string, unknown>;
    const name = typeof t.name === "string" ? t.name : "";
    const language = typeof t.language === "string" ? t.language : "";
    const recipients = Array.isArray(b.recipients) ? (b.recipients as Record<string, unknown>[]) : [];
    if (!name || !language) return err(400, "invalid_request", "`template.name` and `template.language` are required.");
    if (!recipients.length) return err(400, "invalid_request", "`recipients` must be a non-empty list.");
    if (recipients.length > MAX) return err(400, "too_many_recipients", `A batch can have up to ${MAX} recipients. Split it into several calls.`);
    const link = typeof t.header_media_link === "string" && t.header_media_link ? t.header_media_link : null;
    if (link && !/^https:\/\/\S+$/.test(link)) return err(400, "invalid_request", "`template.header_media_link` must be an https link.");

    if (!key.accessTokenEncrypted) return err(409, "number_not_connected", "This key's WhatsApp number is no longer connected.");
    if (key.verificationStatus === "pending_registration") return err(409, "number_not_registered", "This number isn't registered yet.");
    if (key.tokenStatus === "invalid") return err(409, "token_expired", "The WhatsApp connection has expired. Reconnect it from the dashboard.");

    const db = supabaseAdmin();
    const { data: tpl } = await db
      .from("templates")
      .select("name, language, status, body, header_format, header_text, footer, buttons")
      .eq("client_id", key.clientId)
      .eq("name", name)
      .eq("language", language)
      .maybeSingle();
    if (!tpl) return err(404, "template_not_found", `No template "${name}" in language "${language}".`);
    if (tpl.status !== "APPROVED") return err(422, "template_not_approved", `Template "${name}" is ${tpl.status ?? "not approved"} and can't be sent.`);

    const rows: RecipientInput[] = recipients.map((r) => ({
      phone: String(r?.to ?? ""),
      name: typeof r?.name === "string" ? r.name : undefined,
      body: Array.isArray(r?.body) ? (r.body as unknown[]).map((v) => String(v ?? "")) : [],
      header_text: typeof r?.header_text === "string" ? r.header_text : undefined,
      buttons: r?.buttons && typeof r.buttons === "object" ? (r.buttons as Record<string, string>) : undefined,
    }));
    const clean = cleanRecipients(rows, tpl as SendableTemplate, link);
    const refs = recipients.map((r) => (typeof r?.reference === "string" ? r.reference.slice(0, 100) : null));
    const queued = clean.filter((r) => r.status === "pending").length;
    const rejected = clean
      .map((r, index) => ({ index, status: r.status, reason: r.error_message }))
      .filter((r) => r.status !== "pending")
      .map(({ index, reason }) => ({ index, reason }));
    if (!queued) return { status: 422, definitive: true, body: { error: { code: "no_valid_recipients", message: "None of the recipients can be sent.", rejected: rejected.slice(0, 50) } } };

    const label = (typeof b.name === "string" && b.name.trim().slice(0, 80)) || `API batch ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
    const { data: camp, error } = await db
      .from("campaigns")
      .insert({
        client_id: key.clientId,
        phone_number_id: key.phoneNumberId,
        name: label,
        template_name: tpl.name,
        template_language: tpl.language,
        header_link: link,
        status: "cancelled", // held until every recipient is stored
        scheduled_at: new Date().toISOString(),
        total: clean.length,
        source: "api",
        api_key_id: key.keyId,
      })
      .select("id")
      .single();
    if (error || !camp) return { status: 500, definitive: true, body: { error: { code: "internal_error", message: "Couldn't create the batch." } } };

    for (let i = 0; i < clean.length; i += 500) {
      const { error: e } = await db
        .from("campaign_recipients")
        .insert(clean.slice(i, i + 500).map((r, j) => ({ ...r, reference: refs[i + j], campaign_id: camp.id, client_id: key.clientId })));
      if (e) {
        await db.from("campaigns").delete().eq("id", camp.id);
        return { status: 500, definitive: true, body: { error: { code: "internal_error", message: "Couldn't save the recipients. Nothing was sent." } } };
      }
    }
    await db.from("campaigns").update({ status: "scheduled" }).eq("id", camp.id);
    after(() => runCampaignBatches(55_000).catch((e) => console.error("batch run failed", e)));
    return { status: 202, definitive: true, body: { batch_id: camp.id, accepted: queued, rejected_count: rejected.length, rejected: rejected.slice(0, 100) } };
  });
  const code = (await res.clone().json())?.error?.code;
  if (code) res.headers.set("x-error-code", code);
  return res;
});

export const GET = api("read", async () => fail(405, "method_not_allowed", "Use POST."));
