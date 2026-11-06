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
}

/** Returns an error message, or null when the input looks valid to Meta. */
export function validateTemplate(t: TemplateInput): string | null {
  if (!/^[a-z0-9_]{1,512}$/.test(t.name)) {
    return "Name can only use lowercase letters, numbers and underscores.";
  }
  if (!CATEGORIES.some((c) => c.value === t.category)) {
    return "Choose a category.";
  }
  if (!LANGUAGES.some((l) => l.value === t.language)) {
    return "Choose a language.";
  }
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
  return null;
}
