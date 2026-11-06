import { notFound } from "next/navigation";
import { supabaseRSC } from "@/lib/supabase-rsc";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * Platform admins are the emails listed in PLATFORM_ADMIN_EMAILS
 * (comma-separated). If the variable is unset, nobody is an admin.
 * Everyone else gets a 404 so the area is not discoverable.
 */
export async function requirePlatformAdmin() {
  const allowed = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const supabase = await supabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email || !allowed.includes(user.email.toLowerCase())) {
    notFound();
  }
  return { user, email: user.email! };
}

/** Records a platform admin action (viewing chats, resetting a password). */
export async function logAdminAccess(opts: {
  adminUserId: string;
  adminEmail: string;
  clientId: string;
  customerNumber?: string | null;
  action?: string;
  targetUserId?: string | null;
}) {
  try {
    await supabaseAdmin().from("admin_access_log").insert({
      admin_user_id: opts.adminUserId,
      admin_email: opts.adminEmail,
      client_id: opts.clientId,
      customer_number: opts.customerNumber ?? null,
      action: opts.action ?? "view_chats",
      target_user_id: opts.targetUserId ?? null,
    });
  } catch (err) {
    console.error("Failed to write admin access log:", err);
  }
}
