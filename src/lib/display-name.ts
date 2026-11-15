/**
 * First-pass check of a WhatsApp display name, so obvious mistakes are caught before Meta's review.
 * Returns an error message, or null when the name looks fine. Meta makes the final decision.
 */
export function validateDisplayName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 3) return "The name must be at least 3 characters.";
  if (name.length > 75) return "The name can be at most 75 characters.";
  if (/\p{Extended_Pictographic}/u.test(name)) return "Emojis aren't allowed in a display name.";
  if (/[^\p{L}\p{N} .,'&-]/u.test(name)) return "Use only letters, numbers, spaces and . , ' & -";
  if (/^[^\p{L}\p{N}]|[^\p{L}\p{N}.]$/u.test(name)) return "The name must start with a letter or number and not end with punctuation.";
  if (/(https?:|www\.|\.com|\.in\b|\.org|\.net)/i.test(name)) return "Don't put a website address in the name.";
  if (/whatsapp|facebook|instagram|\bmeta\b/i.test(name)) return "The name can't contain WhatsApp, Facebook, Instagram or Meta.";
  const letters = name.replace(/[^\p{L}]/gu, "");
  if (letters.length > 4 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) {
    return "Don't write the whole name in capital letters. Use normal capitalisation, like “Acme Traders”.";
  }
  return null;
}

export const cleanDisplayName = (raw: string) => raw.trim().replace(/\s+/g, " ");
