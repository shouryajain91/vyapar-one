/** "+91 98765-43210" -> "919876543210"; bare 10-digit Indian mobiles get 91. */
export function normalizeNumber(raw: string): string | null {
  let d = raw.replace(/[^\d]/g, "");
  if (/^[6-9]\d{9}$/.test(d)) d = "91" + d;
  return /^\d{8,15}$/.test(d) ? d : null;
}
