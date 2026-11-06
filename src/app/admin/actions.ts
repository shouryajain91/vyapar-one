"use server";

import crypto from "crypto";
import { logAdminAccess, requirePlatformAdmin } from "@/lib/platform-admin";
import { supabaseAdmin } from "@/lib/supabase-server";
import { SITE_URL } from "@/lib/site-url";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

async function loadTarget(userId: string) {
  const db = supabaseAdmin();
  const { data } = await db
    .from("app_users")
    .select("user_id, client_id, email")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

/**
 * One-time sign-in link that lands on the "choose a new password" page.
 * The admin passes it to the user, who sets their own password, so the
 * admin never learns it.
 */
export async function createResetLinkAction(
  userId: string
): Promise<Result<{ link: string; email: string }>> {
  const { user, email: adminEmail } = await requirePlatformAdmin();
  const target = await loadTarget(userId);
  if (!target) return { ok: false, error: "User not found" };

  const { data, error } = await supabaseAdmin().auth.admin.generateLink({
    type: "recovery",
    email: target.email,
  });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) {
    console.error("generateLink failed:", error?.message);
    return { ok: false, error: "Could not create a reset link" };
  }

  await logAdminAccess({
    adminUserId: user.id,
    adminEmail,
    clientId: target.client_id,
    action: "password_reset_link",
    targetUserId: userId,
  });

  const link =
    `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(hashed)}` +
    `&type=recovery&next=/reset-password`;
  return { ok: true, link, email: target.email };
}

/** Sets a random temporary password and returns it once. */
export async function setTempPasswordAction(
  userId: string
): Promise<Result<{ password: string; email: string }>> {
  const { user, email: adminEmail } = await requirePlatformAdmin();
  const target = await loadTarget(userId);
  if (!target) return { ok: false, error: "User not found" };

  const password = crypto.randomBytes(12).toString("base64url");
  const { error } = await supabaseAdmin().auth.admin.updateUserById(userId, {
    password,
  });
  if (error) {
    console.error("updateUserById failed:", error.message);
    return { ok: false, error: "Could not set the password" };
  }

  // The password itself is never logged, only that it happened.
  await logAdminAccess({
    adminUserId: user.id,
    adminEmail,
    clientId: target.client_id,
    action: "password_set_temporary",
    targetUserId: userId,
  });

  return { ok: true, password, email: target.email };
}
