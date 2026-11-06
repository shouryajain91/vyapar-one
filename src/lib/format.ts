const TZ = "Asia/Kolkata";

/** "919876543210" -> "+919876543210" */
export function formatNumber(n: string) {
  return n.startsWith("+") ? n : `+${n}`;
}

/** Time if today, otherwise short date. Fixed to India time so server and browser agree. */
export function formatListTime(iso: string, now: Date = new Date()) {
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: TZ });
  return day(d) === day(now)
    ? d.toLocaleTimeString("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-IN", { timeZone: TZ, day: "numeric", month: "short" });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** WhatsApp lets you send free-form replies for 24h after the customer's last message. */
export function replyWindow(lastInboundIso: string | null, now: Date = new Date()) {
  if (!lastInboundIso) return { open: false as const, hoursLeft: 0 };
  const ms = new Date(lastInboundIso).getTime() + 24 * 3600 * 1000 - now.getTime();
  return ms > 0 ? { open: true as const, hoursLeft: Math.max(1, Math.ceil(ms / 3600000)) } : { open: false as const, hoursLeft: 0 };
}
