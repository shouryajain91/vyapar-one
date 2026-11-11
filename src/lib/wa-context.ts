import { isTokenError, markTokenInvalid } from "@/lib/alerts";
import { getSessionContext } from "@/lib/session";
import { decrypt } from "@/lib/crypto";
import { pickActive } from "@/lib/wa-accounts";

export const GRAPH_VERSION = "v21.0";

export type WaContext =
  | { ok: true; clientId: string; wabaId: string; phoneNumberId: string; accessToken: string }
  | { ok: false; status: number; error: string };

/** Resolves the logged-in user's client and its WhatsApp account. */
export async function getWaContext(): Promise<WaContext> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, status: 401, error: "Not signed in" };
  const clientId = ctx.client_id;

  const { active: account } = await pickActive(ctx.accounts);
  if (!account) return { ok: false, status: 404, error: "Connect WhatsApp first" };

  return {
    ok: true,
    clientId,
    wabaId: account.waba_id,
    phoneNumberId: account.phone_number_id,
    accessToken: decrypt(account.access_token_encrypted),
  };
}

/** Best human-readable message from a Graph API error body. */
export function graphErrorMessage(data: unknown): string {
  const e = (data as { error?: { error_user_msg?: string; message?: string } })?.error;
  return e?.error_user_msg ?? e?.message ?? "Meta rejected the request";
}

/** Call after a failed Graph request: flags the connection when the token no longer works. */
export async function noteGraphFailure(
  ctx: { clientId: string; phoneNumberId: string },
  data: { error?: { code?: number; message?: string } } | null | undefined,
  httpStatus?: number
) {
  if (isTokenError(data?.error?.code, httpStatus)) {
    await markTokenInvalid(ctx.clientId, ctx.phoneNumberId, data?.error?.message);
  }
}
