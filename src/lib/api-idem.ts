import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { fail, type ApiKeyCtx } from "@/lib/api";
import type { ApiResult } from "@/lib/api-send";

/**
 * Runs `work` once per Idempotency-Key. A retry with the same key and body gets the saved
 * answer instead of sending again. Without the header, `work` simply runs.
 */
export async function withIdempotency(req: NextRequest, key: ApiKeyCtx, requestBody: unknown, work: () => Promise<ApiResult>): Promise<NextResponse> {
  const idem = req.headers.get("idempotency-key")?.trim();
  if (!idem) {
    const r = await work();
    return NextResponse.json(r.body, { status: r.status });
  }
  if (idem.length > 100) return fail(400, "invalid_idempotency_key", "Idempotency-Key must be at most 100 characters.");

  const db = supabaseAdmin();
  const hash = createHash("sha256").update(req.method + new URL(req.url).pathname + JSON.stringify(requestBody)).digest("hex");
  const { data } = await db.rpc("api_idem_begin", { p_key: key.keyId, p_idem: idem, p_hash: hash });
  const s = (data as { state: string; status: number; response: Record<string, unknown> }[] | null)?.[0];
  if (!s) return fail(503, "service_unavailable", "Temporary problem. Please retry shortly.");
  if (s.state === "replay") {
    const r = NextResponse.json(s.response, { status: s.status });
    r.headers.set("Idempotent-Replayed", "true");
    return r;
  }
  if (s.state === "mismatch") return fail(422, "idempotency_mismatch", "This Idempotency-Key was already used with a different request.");
  if (s.state === "in_progress") return fail(409, "idempotency_in_progress", "A request with this Idempotency-Key is still being processed, or its outcome is unknown. Check GET /v1/messages?reference=… or use a new key.");

  const r = await work();
  if (r.status >= 200 && r.status < 300) await db.rpc("api_idem_finish", { p_key: key.keyId, p_idem: idem, p_status: r.status, p_response: r.body });
  else if (r.definitive) await db.rpc("api_idem_release", { p_key: key.keyId, p_idem: idem });
  return NextResponse.json(r.body, { status: r.status });
}
