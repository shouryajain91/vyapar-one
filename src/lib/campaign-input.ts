import { normalizeNumber } from "@/lib/phone";
import { buildSendComponents, type SendableTemplate } from "@/lib/template-send";
import type { RecipientVars } from "@/lib/campaign-runner";

export const MAX_RECIPIENTS = 5000;

export interface RecipientInput {
  phone: string;
  name?: string;
  body?: string[];
  header_text?: string;
  buttons?: Record<string, string>;
}

export interface CleanRecipient {
  phone: string;
  contact_name: string | null;
  vars: RecipientVars;
  status: "pending" | "failed" | "skipped";
  error_message: string | null;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/**
 * Validates every row on the server. Rows that can't be sent are kept (so the
 * report shows why) but are not queued. Duplicate numbers are skipped.
 */
export function cleanRecipients(rows: RecipientInput[], tpl: SendableTemplate, headerLink: string | null) {
  const seen = new Set<string>();
  const out: CleanRecipient[] = [];
  rows.forEach((row, i) => {
    const raw = str(row?.phone, 40).trim();
    const phone = normalizeNumber(raw);
    const contact_name = str(row?.name, 100).trim() || null;
    const vars: RecipientVars = {
      body: Array.isArray(row?.body) ? row.body.slice(0, 20).map((v) => str(v, 1100)) : [],
      header_text: row?.header_text ? str(row.header_text, 1100) : undefined,
      buttons:
        row?.buttons && typeof row.buttons === "object"
          ? Object.fromEntries(Object.entries(row.buttons).slice(0, 5).map(([k, v]) => [k, str(v, 500)]))
          : undefined,
    };
    if (!phone) {
      out.push({ phone: `invalid-${i + 1}`, contact_name, vars, status: "failed", error_message: `"${raw.slice(0, 30)}" is not a valid phone number.` });
      return;
    }
    if (seen.has(phone)) {
      out.push({ phone: `dup-${i + 1}-${phone}`, contact_name, vars, status: "skipped", error_message: "Duplicate number in the file; sent once." });
      return;
    }
    seen.add(phone);
    try {
      buildSendComponents(tpl, {
        body_params: vars.body,
        header_text: vars.header_text,
        header_media: headerLink ? { link: headerLink } : undefined,
        button_params: vars.buttons,
      });
    } catch (e) {
      out.push({ phone, contact_name, vars, status: "failed", error_message: (e as Error).message });
      return;
    }
    out.push({ phone, contact_name, vars, status: "pending", error_message: null });
  });
  return out;
}
