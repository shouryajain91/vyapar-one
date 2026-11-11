import Link from "next/link";
import { getSessionContext } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

/** Slim bar shown on every page when something needs the business's attention. */
export async function AlertsBanner() {
  const ctx = await getSessionContext();
  if (!ctx) return null;

  const expired = ctx.accounts.some((a) => a.token_status === "invalid");
  const { data } = await supabaseAdmin()
    .from("alerts")
    .select("severity, kind")
    .eq("client_id", ctx.client_id)
    .is("resolved_at", null)
    .neq("kind", "token_invalid")
    .neq("severity", "info")
    .limit(50);
  const others = data ?? [];
  if (!expired && others.length === 0) return null;

  const critical = expired || others.some((a) => a.severity === "critical");
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm ${
        critical ? "bg-red-600 text-white" : "bg-amber-100 text-amber-900"
      }`}
    >
      <span className="font-medium">
        {expired
          ? "Your WhatsApp connection has expired, so messages can't be sent or received."
          : `${others.length} alert${others.length === 1 ? "" : "s"} need${others.length === 1 ? "s" : ""} your attention.`}
      </span>
      <span className="flex items-center gap-3">
        {expired && (
          <Link href="/dashboard" className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">
            Reconnect WhatsApp
          </Link>
        )}
        {others.length > 0 && (
          <Link href="/alerts" className="text-xs font-semibold underline underline-offset-2">
            View alerts
          </Link>
        )}
      </span>
    </div>
  );
}
