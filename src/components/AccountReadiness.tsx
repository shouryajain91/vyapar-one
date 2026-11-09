"use client";

import { useCachedFetch } from "@/lib/use-cached-fetch";
import { Alert, Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

interface Readiness {
  can_send_message: string | null;
  issues: { area: string; code: string | null; text: string; fix: string | null }[];
  unavailable: string[];
  funding_attached: boolean | null;
  account_status: string | null;
  business_verification: string | null;
  currency: string | null;
  messaging_limit: string | null;
  recent_payment_failures: number;
  last_payment_failure_at: string | null;
}

const SEND: Record<string, { label: string; tone: "green" | "amber" | "red" }> = {
  AVAILABLE: { label: "Ready to send", tone: "green" },
  LIMITED: { label: "Limited", tone: "amber" },
  BLOCKED: { label: "Blocked", tone: "red" },
};

const VERIFY: Record<string, { label: string; tone: "green" | "amber" | "red" | "slate" }> = {
  verified: { label: "Verified", tone: "green" },
  pending: { label: "Pending", tone: "amber" },
  pending_need_more_info: { label: "More info needed", tone: "amber" },
  not_verified: { label: "Not verified", tone: "slate" },
  rejected: { label: "Rejected", tone: "red" },
  revoked: { label: "Revoked", tone: "red" },
  expired: { label: "Expired", tone: "red" },
};

const LIMIT: Record<string, string> = {
  TIER_50: "50", TIER_250: "250", TIER_1K: "1,000", TIER_2K: "2,000", TIER_10K: "10,000", TIER_100K: "100,000",
  TIER_UNLIMITED: "No limit", UNTIERED: "Not set",
};

/** Can this business send, and is billing in place? Live from Meta. */
export function AccountReadiness() {
  const { data: r, error } = useCachedFetch<Readiness>("/api/account/readiness");

  if (error) return <Alert tone="error" className="mt-4">Sending status from Meta: {error}</Alert>;
  if (!r) return <p className="mt-4 text-sm text-slate-500">Checking sending status with Meta&hellip;</p>;

  const no = (field: string) => r.unavailable.includes(field);
  const send = r.can_send_message ? SEND[r.can_send_message] : null;
  const verify = r.business_verification ? (VERIFY[r.business_verification] ?? { label: r.business_verification, tone: "slate" as const }) : null;

  return (
    <div className="mt-4 rounded-lg border border-slate-200 p-4">
      <p className="mb-3 text-sm font-semibold text-slate-900">Can I send messages?</p>

      {r.recent_payment_failures > 0 && (
        <Alert tone="error" className="mb-3">
          {r.recent_payment_failures} message{r.recent_payment_failures === 1 ? "" : "s"} failed in the last 14 days because of a payment problem
          {r.last_payment_failure_at ? ` (latest ${formatDateTime(r.last_payment_failure_at)})` : ""}. Add funds or fix the payment method in
          WhatsApp Manager &rarr; Payment settings.
        </Alert>
      )}

      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-2 text-slate-600">
          Sending status {send ? <Badge tone={send.tone}>{send.label}</Badge> : <span className="text-slate-500">{no("health_status") ? "Not shared by Meta yet" : "Not reported"}</span>}
        </div>
        <div className="flex items-center justify-between gap-2 text-slate-600">
          Payment method or credit line
          {r.funding_attached === null ? (
            <span className="text-slate-500">{no("primary_funding_id") ? "Not shared by Meta yet" : "Not reported"}</span>
          ) : r.funding_attached ? (
            <Badge tone="green">Attached</Badge>
          ) : (
            <Badge tone="red">Not found</Badge>
          )}
        </div>
        {verify && (
          <div className="flex items-center justify-between gap-2 text-slate-600">
            Business verification <Badge tone={verify.tone}>{verify.label}</Badge>
          </div>
        )}
        {r.messaging_limit && (
          <div className="flex items-center justify-between gap-2 text-slate-600">
            New customers per day <span className="text-slate-900">{LIMIT[r.messaging_limit] ?? r.messaging_limit}</span>
          </div>
        )}
      </dl>

      {r.issues.length > 0 && (
        <ul className="mt-3 space-y-2">
          {r.issues.map((i, n) => (
            <li key={n} className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p>{i.text}</p>
              {i.fix && <p className="mt-0.5 text-amber-800/80">{i.fix}</p>}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-slate-500">
        Meta doesn&apos;t share your balance or credit amount with apps. To see it, open WhatsApp Manager &rarr; Billing.
        If a send fails for lack of funds, it appears above.
        {(no("health_status") || no("primary_funding_id")) &&
          " Meta only shares sending status and payment details with apps from approved solution providers, so those lines may stay empty for now."}
      </p>
    </div>
  );
}
