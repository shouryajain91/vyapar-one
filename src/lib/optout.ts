/**
 * Detects "stop" / "start" messages from customers.
 *
 * Deliberately strict: the WHOLE message must be a stop request, so a sentence
 * like "please don't stop the delivery" is never treated as an opt-out.
 * "CANCEL" and "END" are left out on purpose, because customers use them to
 * cancel an order, not to leave the list.
 */

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const OUT_EXACT = new Set([
  "stop",
  "stopall",
  "stop all",
  "unsubscribe",
  "unsub",
  "quit",
  "opt out",
  "optout",
  "do not message",
  "dont message",
  "do not message me",
  "dont message me",
  "remove me",
  "remove my number",
]);
// "stop", "please stop", "stop messages", "stop sending me promotions", ...
const OUT_PATTERN =
  /^(please )?(stop|unsubscribe|unsub)( (me|all|now|messages?|messaging|msgs?|texts?|promotions?|marketing|these|sending|sending me|message me))*$/;

const IN_EXACT = new Set(["start", "unstop", "subscribe", "opt in", "optin", "resume"]);

export function classifyOptMessage(text: string | null | undefined): "out" | "in" | null {
  if (!text) return null;
  const t = normalize(text);
  if (!t || t.length > 40) return null;
  if (OUT_EXACT.has(t) || OUT_PATTERN.test(t)) return "out";
  if (IN_EXACT.has(t)) return "in";
  return null;
}
