/** Keyword matching shared by the webhook (server) and the tester on the Bot page (browser). */

export type MatchType = "contains" | "exact" | "starts_with" | "fallback";

export interface BotRuleLike {
  id: string;
  keywords: string[];
  match_type: MatchType;
  priority: number;
}

/** Lowercase, drop punctuation and accents-insensitive spacing; keeps letters/digits of any script. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matches(rule: BotRuleLike, message: string): boolean {
  if (rule.match_type === "fallback") return true;
  const text = normalizeText(message);
  if (!text) return false;
  const padded = ` ${text} `;
  return rule.keywords.some((raw) => {
    const kw = normalizeText(raw);
    if (!kw) return false;
    if (rule.match_type === "exact") return text === kw;
    if (rule.match_type === "starts_with") return text === kw || text.startsWith(kw + " ");
    return padded.includes(` ${kw} `); // whole word / phrase anywhere
  });
}

/** First matching rule by priority (lowest number first); fallback rules only if nothing else matched. */
export function pickRule<T extends BotRuleLike>(rules: T[], message: string): T | null {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  return (
    sorted.find((r) => r.match_type !== "fallback" && matches(r, message)) ??
    sorted.find((r) => r.match_type === "fallback") ??
    null
  );
}

/** Splits "price, cost\nrate" into clean keywords. */
export function parseKeywords(input: string): string[] {
  return [...new Set(input.split(/[,\n]/).map((k) => k.trim()).filter(Boolean))].slice(0, 30);
}

/** Fills {name} in the reply with the customer's first name. */
export function fillReply(text: string, customerName: string | null): string {
  const first = customerName?.trim().split(/\s+/)[0] || "there";
  return text.replace(/\{name\}/gi, first);
}
