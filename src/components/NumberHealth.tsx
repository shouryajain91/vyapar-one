"use client";

import { useCachedFetch } from "@/lib/use-cached-fetch";
import { Alert, Badge } from "@/components/ui";

interface Health {
  verified_name: string | null;
  display_phone_number: string | null;
  name_status: string | null;
  new_name_status: string | null;
  quality_rating: string | null;
  messaging_limit_tier: string | null;
  status: string | null;
}

const NAME: Record<string, { label: string; tone: "green" | "amber" | "red" | "slate"; help: string }> = {
  APPROVED: { label: "Approved", tone: "green", help: "Your business name shows on WhatsApp." },
  AVAILABLE_WITHOUT_REVIEW: { label: "Ready", tone: "green", help: "No review needed for this name." },
  PENDING_REVIEW: { label: "In review", tone: "amber", help: "Meta is reviewing the name. This usually takes one to two days." },
  DECLINED: { label: "Declined", tone: "red", help: "Meta rejected the name. In WhatsApp Manager, open Phone numbers, then edit the display name so it matches your business or website." },
  EXPIRED: { label: "Expired", tone: "red", help: "The approval expired. Request the display name again in WhatsApp Manager." },
  NONE: { label: "Not set", tone: "slate", help: "No display name has been submitted yet." },
};

const QUALITY: Record<string, { label: string; tone: "green" | "amber" | "red" | "slate" }> = {
  GREEN: { label: "High", tone: "green" },
  YELLOW: { label: "Medium", tone: "amber" },
  RED: { label: "Low", tone: "red" },
  UNKNOWN: { label: "Not rated yet", tone: "slate" },
};

const TIER: Record<string, string> = {
  TIER_250: "250 new customers per day",
  TIER_1K: "1,000 new customers per day",
  TIER_10K: "10,000 new customers per day",
  TIER_100K: "100,000 new customers per day",
  TIER_UNLIMITED: "No daily limit",
};

/** Live number status from Meta: display name review, quality, daily limit. */
export function NumberHealth() {
  const { data: health, error } = useCachedFetch<Health>("/api/numbers/health");

  if (error) return <Alert tone="error" className="mt-4">Number status from Meta: {error}</Alert>;
  if (!health) return <p className="mt-4 text-sm text-slate-500">Checking number status with Meta&hellip;</p>;

  const name = NAME[health.name_status ?? "NONE"] ?? { label: health.name_status ?? "Unknown", tone: "slate" as const, help: "" };
  const quality = QUALITY[health.quality_rating ?? "UNKNOWN"] ?? QUALITY.UNKNOWN;

  return (
    <div className="mt-4 rounded-lg border border-slate-200 p-4">
      <p className="mb-3 text-sm font-semibold text-slate-900">Number status from Meta</p>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="flex items-center justify-between gap-2 text-slate-600">
            Display name{health.verified_name ? ` (${health.verified_name})` : ""}
            <Badge tone={name.tone}>{name.label}</Badge>
          </dt>
          <dd className="mt-1 text-xs text-slate-500">
            {name.help}
            {health.new_name_status && health.new_name_status !== "NONE" ? ` A change is ${health.new_name_status.toLowerCase().replace("_", " ")}.` : ""}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2 text-slate-600">
          Message quality <Badge tone={quality.tone}>{quality.label}</Badge>
        </div>
        <div className="flex items-center justify-between gap-2 text-slate-600">
          Daily limit
          <span className="text-slate-900">{health.messaging_limit_tier ? (TIER[health.messaging_limit_tier] ?? health.messaging_limit_tier) : "Not reported"}</span>
        </div>
      </dl>
    </div>
  );
}
