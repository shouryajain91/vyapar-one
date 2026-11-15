import { createHash, randomBytes } from "node:crypto";

export const KEY_PREFIX = "vp_live_";
export const SCOPES = ["send", "read", "templates"] as const;
export type Scope = (typeof SCOPES)[number];

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** A new random key. The full text is shown once; only its hash is stored. */
export function generateKey() {
  const key = KEY_PREFIX + randomBytes(24).toString("base64url");
  return { key, hash: hashKey(key), prefix: key.slice(0, KEY_PREFIX.length + 4) };
}
