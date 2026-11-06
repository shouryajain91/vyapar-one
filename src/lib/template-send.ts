import { extractVariables } from "@/lib/template-validate";

/** The parts of a stored template needed to send it. */
export interface SendableTemplate {
  name: string;
  language: string;
  status: string | null;
  body: string | null;
  header_format: string | null;
  header_text: string | null;
  footer: string | null;
  buttons: { type: string; text: string; url?: string }[] | null;
}

export interface SendInput {
  body_params?: string[];
  header_text?: string;
  header_media?: { id?: string; link?: string; filename?: string };
  button_params?: Record<string, string>; // key = button position (0-based)
}

const uniqueVars = (text: string | null) =>
  [...new Set(extractVariables(text ?? ""))].sort((a, b) => a - b);

/** What the sender has to supply for this template. */
export function describeInputs(t: SendableTemplate) {
  const buttons = t.buttons ?? [];
  return {
    bodyVars: uniqueVars(t.body),
    headerVar: t.header_format === "TEXT" && uniqueVars(t.header_text).length > 0,
    headerMedia:
      t.header_format === "IMAGE" || t.header_format === "VIDEO" || t.header_format === "DOCUMENT"
        ? (t.header_format as "IMAGE" | "VIDEO" | "DOCUMENT")
        : null,
    urlButtons: buttons
      .map((b, index) => ({ b, index }))
      .filter(({ b }) => b.type === "URL" && /\{\{1\}\}$/.test(b.url ?? ""))
      .map(({ b, index }) => ({ index, label: b.text, url: b.url! })),
  };
}

/** Meta rejects newlines, tabs and runs of 4+ spaces inside parameters. */
const clean = (s: string) => s.replace(/[\n\t\r]+/g, " ").replace(/ {4,}/g, "   ").trim();

const fill = (text: string, values: string[]) =>
  text.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => values[Number(n) - 1] ?? "");

/** Fills the template's body for display, e.g. in the inbox. */
export function renderBody(t: SendableTemplate, bodyParams: string[]): string {
  return fill(t.body ?? "", bodyParams.map(clean));
}

/**
 * Builds the Graph API `components` for sending, validating that every
 * variable, media header and link variable has a value. Throws an Error
 * with a message fit to show the user.
 */
export function buildSendComponents(t: SendableTemplate, input: SendInput) {
  const need = describeInputs(t);
  const components: Record<string, unknown>[] = [];

  // Header
  if (need.headerVar) {
    const v = clean(input.header_text ?? "");
    if (!v) throw new Error("Fill in the header value.");
    components.push({ type: "header", parameters: [{ type: "text", text: v }] });
  } else if (need.headerMedia) {
    const m = input.header_media;
    const link = m?.link?.trim();
    if (!m?.id && !(link && /^https:\/\/\S+$/.test(link))) {
      throw new Error(`Add the ${need.headerMedia.toLowerCase()} for the header (upload a file or paste an https link).`);
    }
    const key = need.headerMedia.toLowerCase(); // image | video | document
    const ref = m?.id ? { id: m.id } : { link };
    components.push({
      type: "header",
      parameters: [
        {
          type: key,
          [key]: need.headerMedia === "DOCUMENT" ? { ...ref, filename: m?.filename || "document.pdf" } : ref,
        },
      ],
    });
  }

  // Body
  const params = (input.body_params ?? []).map(clean);
  if (need.bodyVars.length) {
    if (params.length !== need.bodyVars.length || params.some((p) => !p)) {
      throw new Error("Fill in every variable in the message.");
    }
    if (params.some((p) => p.length > 1024)) throw new Error("A variable value is too long.");
    components.push({ type: "body", parameters: params.map((text) => ({ type: "text", text })) });
  }

  // Link buttons with a variable
  for (const ub of need.urlButtons) {
    const v = clean(input.button_params?.[String(ub.index)] ?? "");
    if (!v) throw new Error(`Fill in the link value for the "${ub.label}" button.`);
    components.push({
      type: "button",
      sub_type: "url",
      index: String(ub.index),
      parameters: [{ type: "text", text: v }],
    });
  }

  return { components, rendered: renderBody(t, params) };
}
