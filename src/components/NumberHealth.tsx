"use client";

import { useState } from "react";
import { useCachedFetch } from "@/lib/use-cached-fetch";
import { Alert, Badge, buttonClass, inputCls } from "@/components/ui";

interface Health {
  verified_name: string | null;
  new_display_name: string | null;
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
  const { data: health, error, reload } = useCachedFetch<Health>("/api/numbers/health");

  if (error) return <Alert tone="error" className="mt-4">Number status from Meta: {error}</Alert>;
  if (!health) return <p className="mt-4 text-sm text-slate-500">Checking number status with Meta&hellip;</p>;

  const name = NAME[health.name_status ?? "NONE"] ?? { label: health.name_status ?? "Unknown", tone: "slate" as const, help: "" };
  const quality = QUALITY[health.quality_rating ?? "UNKNOWN"] ?? QUALITY.UNKNOWN;

  const pending = health.new_name_status === "PENDING_REVIEW";
  const approvedNotLive = health.new_name_status === "APPROVED";

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
            {pending && health.new_display_name ? ` Change to “${health.new_display_name}” is in review.` : ""}
          </dd>
          <ChangeName current={health.verified_name} pending={pending} approvedNotLive={approvedNotLive} onDone={reload} />
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

/** Ask Meta for a new display name; they review it, then it goes live. */
function ChangeName({ current, pending, approvedNotLive, onDone }: { current: string | null; pending: boolean; approvedNotLive: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function call(url: string, body: object, okText: (j: Record<string, unknown>) => string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setMsg({ tone: "error", text: j.error ?? "Something went wrong. Please try again." });
      else {
        setMsg({ tone: "success", text: okText(j) });
        setOpen(false);
        setName("");
        onDone();
      }
    } catch {
      setMsg({ tone: "error", text: "Couldn't reach the server. Please try again." });
    }
    setBusy(false);
  }

  return (
    <div className="mt-2">
      {msg && <Alert tone={msg.tone} className="mb-2">{msg.text}</Alert>}
      {approvedNotLive && (
        <button type="button" disabled={busy} className={buttonClass("primary", "sm")} onClick={() => call("/api/onboarding/register-number", {}, () => "The approved name is now being applied. It can take a few minutes to show on WhatsApp.")}>
          {busy ? "Applying…" : "Apply approved name"}
        </button>
      )}
      {!open && !approvedNotLive && (
        <button type="button" disabled={pending} className="text-xs font-medium text-brand-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline" onClick={() => setOpen(true)}>
          {pending ? "Change in review" : "Change display name"}
        </button>
      )}
      {open && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            call("/api/numbers/display-name", { name }, (j) => `Sent to Meta for review: “${String(j.name)}”. Your current name stays until they approve it, usually in 1 to 2 days.`);
          }}
        >
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={75} placeholder={current ?? "Your business name"} aria-label="New display name" required />
          <p className="text-xs text-slate-500">
            Use your real business name, as it appears on your website or documents. No emojis, web addresses or all-capitals. Meta may decline names that don&apos;t match your business. You can change it up to 10 times in 30 days.
          </p>
          <div className="flex gap-2">
            <button type="submit" disabled={busy || name.trim().length < 3} className={buttonClass("primary", "sm")}>{busy ? "Sending…" : "Submit for review"}</button>
            <button type="button" className={buttonClass("secondary", "sm")} onClick={() => { setOpen(false); setMsg(null); }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
