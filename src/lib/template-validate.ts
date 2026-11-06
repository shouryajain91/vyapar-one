export const CATEGORIES = [
  { value: "UTILITY", label: "Utility (order updates, confirmations, reminders)" },
  { value: "MARKETING", label: "Marketing (offers, promotions, announcements)" },
] as const;

export const LANGUAGES = [
  { value: "en_US", label: "English (US)" },
  { value: "en_GB", label: "English (UK)" },
  { value: "hi", label: "Hindi" },
  { value: "mr", label: "Marathi" },
  { value: "gu", label: "Gujarati" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "bn", label: "Bengali" },
  { value: "kn", label: "Kannada" },
  { value: "ml", label: "Malayalam" },
  { value: "pa", label: "Punjabi" },
] as const;

export type HeaderFormat = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";

export interface HeaderInput {
  format: HeaderFormat;
  text?: string; // TEXT header
  example?: string; // example for a {{1}} in a TEXT header
  mediaHandle?: string; // IMAGE / VIDEO / DOCUMENT: handle from the sample upload
}

export type ButtonInput =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string; example?: string }
  | { type: "PHONE_NUMBER"; text: string; phone: string };

/** Sample-file rules for media headers (kept small: Vercel caps request bodies at ~4.5 MB). */
export const SAMPLE_RULES: Record<"IMAGE" | "VIDEO" | "DOCUMENT", { types: string[]; label: string }> = {
  IMAGE: { types: ["image/jpeg", "image/png"], label: "JPG or PNG" },
  VIDEO: { types: ["video/mp4"], label: "MP4" },
  DOCUMENT: { types: ["application/pdf"], label: "PDF" },
};
export const SAMPLE_MAX_BYTES = 4_000_000;

/** Numbers of the {{n}} variables found in a template body, in order. */
export function extractVariables(body: string): number[] {
  return [...body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1]));
}

export interface TemplateInput {
  name: string;
  category: string;
  language: string;
  body: string;
  examples: string[];
  header?: HeaderInput;
  footer?: string;
  buttons?: ButtonInput[];
}

/** Returns an error message, or null when the input looks valid to Meta. */
export function validateTemplate(t: TemplateInput): string | null {
  if (!/^[a-z0-9_]{1,512}$/.test(t.name)) {
    return "Name can only use lowercase letters, numbers and underscores.";
  }
  if (!CATEGORIES.some((c) => c.value === t.category)) return "Choose a category.";
  if (!LANGUAGES.some((l) => l.value === t.language)) return "Choose a language.";

  const body = t.body.trim();
  if (!body) return "Write the message text.";
  if (body.length > 1024) return "Message text can be at most 1024 characters.";

  const vars = extractVariables(body);
  const unique = [...new Set(vars)];
  if (unique.some((n, i) => n !== i + 1)) {
    return "Variables must be numbered {{1}}, {{2}}, {{3}} in order, without gaps.";
  }
  if (/^\s*\{\{/.test(body) || /\}\}\s*$/.test(body)) {
    return "The text can't start or end with a variable. Add a word before or after it.";
  }
  if (t.examples.length !== unique.length || t.examples.some((e) => !e.trim())) {
    return "Give an example value for every variable.";
  }

  // Header
  const h = t.header;
  if (h && h.format !== "NONE") {
    if (h.format === "TEXT") {
      const text = (h.text ?? "").trim();
      if (!text) return "Write the header text, or choose no header.";
      if (text.length > 60) return "Header text can be at most 60 characters.";
      const hv = extractVariables(text);
      if (hv.length > 1 || (hv.length === 1 && hv[0] !== 1)) {
        return "A header can have at most one variable, {{1}}.";
      }
      if (hv.length === 1 && !(h.example ?? "").trim()) {
        return "Give an example value for the header variable.";
      }
    } else if (!h.mediaHandle) {
      return `Upload a sample ${SAMPLE_RULES[h.format].label} file for the header.`;
    }
  }

  // Footer
  const footer = (t.footer ?? "").trim();
  if (footer) {
    if (footer.length > 60) return "Footer can be at most 60 characters.";
    if (footer.includes("{{")) return "The footer can't contain variables.";
  }

  // Buttons
  const buttons = t.buttons ?? [];
  if (buttons.length > 10) return "A template can have at most 10 buttons.";
  if (buttons.filter((b) => b.type === "URL").length > 2) return "At most 2 link buttons are allowed.";
  if (buttons.filter((b) => b.type === "PHONE_NUMBER").length > 1) return "Only 1 call button is allowed.";
  for (const b of buttons) {
    const text = b.text.trim();
    if (!text) return "Every button needs a label.";
    if (text.length > 25) return "Button labels can be at most 25 characters.";
    if (b.type === "URL") {
      if (!/^https:\/\/\S+$/.test(b.url)) return "Link buttons need a full https:// address.";
      if (b.url.length > 2000) return "Button links can be at most 2000 characters.";
      const bv = (b.url.match(/\{\{\s*\d+\s*\}\}/g) ?? []);
      if (bv.length > 1 || (bv.length === 1 && !/\{\{1\}\}$/.test(b.url))) {
        return "A link can have one variable, {{1}}, and only at the very end.";
      }
      if (bv.length === 1 && !/^https:\/\/\S+$/.test((b.example ?? "").trim())) {
        return "Give an example full link for the link variable.";
      }
    }
    if (b.type === "PHONE_NUMBER" && !/^\+\d{8,15}$/.test(b.phone.trim())) {
      return "Call buttons need a phone number with country code, like +919876543210.";
    }
  }
  return null;
}

/** Builds the Graph API `components` array from validated input. */
export function buildComponents(t: TemplateInput) {
  const components: Record<string, unknown>[] = [];

  const h = t.header;
  if (h && h.format !== "NONE") {
    if (h.format === "TEXT") {
      const text = (h.text ?? "").trim();
      const hasVar = extractVariables(text).length > 0;
      components.push({
        type: "HEADER",
        format: "TEXT",
        text,
        ...(hasVar ? { example: { header_text: [(h.example ?? "").trim()] } } : {}),
      });
    } else {
      components.push({
        type: "HEADER",
        format: h.format,
        example: { header_handle: [h.mediaHandle] },
      });
    }
  }

  const hasVars = extractVariables(t.body).length > 0;
  components.push({
    type: "BODY",
    text: t.body.trim(),
    ...(hasVars ? { example: { body_text: [t.examples.map((e) => e.trim())] } } : {}),
  });

  const footer = (t.footer ?? "").trim();
  if (footer) components.push({ type: "FOOTER", text: footer });

  const buttons = t.buttons ?? [];
  if (buttons.length) {
    // Meta wants quick replies grouped together, before the call-to-action buttons.
    const order = { QUICK_REPLY: 0, URL: 1, PHONE_NUMBER: 2 } as const;
    const sorted = [...buttons].sort((a, b) => order[a.type] - order[b.type]);
    components.push({
      type: "BUTTONS",
      buttons: sorted.map((b) => {
        if (b.type === "QUICK_REPLY") return { type: "QUICK_REPLY", text: b.text.trim() };
        if (b.type === "PHONE_NUMBER") {
          return { type: "PHONE_NUMBER", text: b.text.trim(), phone_number: b.phone.trim() };
        }
        const hasVar = /\{\{1\}\}$/.test(b.url);
        return {
          type: "URL",
          text: b.text.trim(),
          url: b.url.trim(),
          ...(hasVar ? { example: [(b.example ?? "").trim()] } : {}),
        };
      }),
    });
  }
  return components;
}
