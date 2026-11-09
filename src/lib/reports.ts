/** Shared filter handling for the Reports page and its CSV export. */

export const PAGE_SIZE = 50;
export const EXPORT_MAX = 10000;

export interface ReportFilters {
  from: string; // YYYY-MM-DD (India time)
  to: string; // YYYY-MM-DD (India time)
  dir: "" | "inbound" | "outbound";
  status: string; // "" | sent | delivered | read | failed | received
  type: string; // "" | text | template | image | ...
  num: string; // "" (all numbers) | phone_number_id
  q: string;
  page: number;
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function istDay(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function parseFilters(p: Params): ReportFilters {
  const from = DATE.test(one(p.from)) ? one(p.from) : istDay(-29);
  const to = DATE.test(one(p.to)) ? one(p.to) : istDay(0);
  const dir = one(p.dir);
  return {
    from,
    to,
    dir: dir === "inbound" || dir === "outbound" ? dir : "",
    status: ["sent", "delivered", "read", "failed", "received"].includes(one(p.status)) ? one(p.status) : "",
    type: /^[a-z_]{1,30}$/.test(one(p.type)) ? one(p.type) : "",
    num: /^\d{1,30}$/.test(one(p.num)) ? one(p.num) : "",
    q: one(p.q).slice(0, 80),
    page: Math.max(1, Number.parseInt(one(p.page), 10) || 1),
  };
}

/** Query string for links (pagination, export), without the page. */
export function filterQuery(f: ReportFilters, extra: Record<string, string> = {}) {
  const sp = new URLSearchParams();
  sp.set("from", f.from);
  sp.set("to", f.to);
  for (const k of ["dir", "status", "type", "num", "q"] as const) if (f[k]) sp.set(k, f[k]);
  for (const [k, v] of Object.entries(extra)) sp.set(k, v);
  return sp.toString();
}

/** Applies the filters to a messages query. `omitStatus` lets summary counts ignore the status filter. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyFilters<Q extends { [k: string]: any }>(
  query: Q,
  clientId: string,
  f: ReportFilters,
  opts: { omitStatus?: boolean } = {}
): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = query.eq("client_id", clientId);
  q = q.gte("created_at", `${f.from}T00:00:00+05:30`).lte("created_at", `${f.to}T23:59:59.999+05:30`);
  if (f.dir) q = q.eq("direction", f.dir);
  if (f.type) q = q.eq("message_type", f.type);
  if (f.num) q = q.eq("phone_number_id", f.num);
  if (!opts.omitStatus && f.status) q = q.eq("status", f.status);
  // Search by number, customer name, template or text. Strip characters that
  // would break PostgREST's filter syntax.
  const term = f.q.replace(/[,()%*\\]/g, " ").trim();
  if (term) {
    q = q.or(
      `from_number.ilike.%${term}%,to_number.ilike.%${term}%,contact_name.ilike.%${term}%,template_name.ilike.%${term}%,body.ilike.%${term}%`
    );
  }
  return q as Q;
}

export const REPORT_COLUMNS =
  "id, created_at, direction, from_number, to_number, contact_name, phone_number_id, message_type, template_name, body, status, error_code, error_message, delivered_at, read_at, campaign_id, bot_rule_id";
