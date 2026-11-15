import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { hashKey, KEY_PREFIX, type Scope } from "@/lib/api-keys";

export interface ApiKeyCtx {
  keyId: string;
  keyName: string;
  clientId: string;
  phoneNumberId: string;
  scopes: string[];
  rateLimit: number;
  businessName: string;
  accessTokenEncrypted: string | null;
  tokenStatus: string | null;
  verificationStatus: string | null;
  displayName: string | null;
  qualityRating: string | null;
  messagingLimitTier: string | null;
}

/** Every error from the API has this shape, with a stable `code` to program against. */
export function apiError(status: number, code: string, message: string, extra?: Record<string, unknown>, headers?: Record<string, string>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status, headers });
}

function clientIp(req: NextRequest) {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
}

type Auth = { ok: true; ctx: ApiKeyCtx } | { ok: false; res: NextResponse };

async function authenticate(req: NextRequest, scope: Scope): Promise<Auth> {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!m || !m[1].startsWith(KEY_PREFIX) || m[1].length > 100) {
    return { ok: false, res: apiError(401, "unauthorized", "Send your API key as: Authorization: Bearer vp_live_…", undefined, { "WWW-Authenticate": "Bearer" }) };
  }
  const { data, error } = await supabaseAdmin().rpc("api_auth", { p_hash: hashKey(m[1]) });
  if (error) {
    console.error("api_auth failed:", error.message);
    return { ok: false, res: apiError(503, "service_unavailable", "Temporary problem. Please retry shortly.") };
  }
  const row = (data as Record<string, unknown>[] | null)?.[0];
  if (!row) return { ok: false, res: apiError(401, "unauthorized", "This API key is invalid or has been revoked.") };

  const allow = (row.ip_allowlist as string[]) ?? [];
  if (allow.length && !allow.includes(clientIp(req))) {
    return { ok: false, res: apiError(403, "ip_not_allowed", "This API key can't be used from this IP address.") };
  }
  const limit = row.rate_limit as number;
  if (!row.allowed) {
    return { ok: false, res: apiError(429, "rate_limited", `Too many requests. This key allows ${limit} per second.`, undefined, { "Retry-After": "1", "X-RateLimit-Limit": String(limit) }) };
  }
  if (!(row.scopes as string[]).includes(scope)) {
    return { ok: false, res: apiError(403, "forbidden", `This API key doesn't have the "${scope}" permission.`) };
  }
  return {
    ok: true,
    ctx: {
      keyId: row.key_id as string,
      keyName: row.key_name as string,
      clientId: row.client_id as string,
      phoneNumberId: row.phone_number_id as string,
      scopes: row.scopes as string[],
      rateLimit: limit,
      businessName: row.business_name as string,
      accessTokenEncrypted: (row.access_token_encrypted as string) ?? null,
      tokenStatus: (row.token_status as string) ?? null,
      verificationStatus: (row.verification_status as string) ?? null,
      displayName: (row.display_name as string) ?? null,
      qualityRating: (row.quality_rating as string) ?? null,
      messagingLimitTier: (row.messaging_limit_tier as string) ?? null,
    },
  };
}

/**
 * Wraps a v1 route: authenticates, rate-limits, turns crashes into a clean 500,
 * and records the call (without bodies) for the client's activity page.
 */
export function api<P = Record<string, never>>(scope: Scope, handler: (req: NextRequest, ctx: ApiKeyCtx, params: P) => Promise<NextResponse>) {
  return async (req: NextRequest, route: { params: Promise<P> }) => {
    const started = Date.now();
    const auth = await authenticate(req, scope);
    if (!auth.ok) return auth.res;
    let res: NextResponse;
    try {
      res = await handler(req, auth.ctx, await route.params);
    } catch (e) {
      console.error("API error:", (e as Error).message);
      res = apiError(500, "internal_error", "Something went wrong on our side. Please retry.");
    }
    res.headers.set("X-RateLimit-Limit", String(auth.ctx.rateLimit));
    const status = res.status;
    const errorCode = status >= 400 ? res.headers.get("x-error-code") : null;
    after(async () => {
      await supabaseAdmin().from("api_request_log").insert({
        key_id: auth.ctx.keyId,
        client_id: auth.ctx.clientId,
        method: req.method,
        path: new URL(req.url).pathname.slice(0, 200),
        status,
        ms: Date.now() - started,
        error_code: errorCode,
      });
    });
    return res;
  };
}

/** Error response that also tags the log with its code. */
export function fail(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  const r = apiError(status, code, message, extra);
  r.headers.set("x-error-code", code);
  return r;
}

export async function readJson(req: NextRequest): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; res: NextResponse }> {
  const text = await req.text();
  if (text.length > 1_000_000) return { ok: false, res: fail(413, "payload_too_large", "The request body is too large.") };
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return { ok: true, body };
  } catch {
    return { ok: false, res: fail(400, "invalid_json", "The request body must be a JSON object.") };
  }
}
