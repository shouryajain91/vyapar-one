export const RANGES = [7, 30, 90] as const;

/** Reads ?days= (7, 30 or 90) and returns the time window to report on. */
export function feedbackRange(daysParam: string | undefined, now = Date.now()) {
  const n = Number(daysParam);
  const days = (RANGES as readonly number[]).includes(n) ? n : 30;
  return { days, from: new Date(now - days * 86_400_000).toISOString(), to: new Date(now + 60_000).toISOString() };
}

export interface SummaryRow {
  template_name: string; campaign_id: string | null; campaign_name: string | null;
  sent: number; delivered: number; answer: string | null; answers: number;
}

export interface CampaignBlock {
  key: string; label: string; sent: number; delivered: number; replies: number; answers: Map<string, number>;
}
export interface TemplateBlock { name: string; blocks: CampaignBlock[]; sent: number; delivered: number; replies: number }

/** Groups the flat database rows by template, then by campaign (or "single sends"). */
export function groupSummary(rows: SummaryRow[], buttonOrder: Map<string, string[]>): TemplateBlock[] {
  const byTpl = new Map<string, Map<string, CampaignBlock>>();
  for (const r of rows) {
    const key = r.campaign_id ?? "single";
    const tpl = byTpl.get(r.template_name) ?? new Map<string, CampaignBlock>();
    const b = tpl.get(key) ?? {
      key, label: r.campaign_id ? (r.campaign_name ?? "Campaign") : "Sent one by one",
      sent: Number(r.sent), delivered: Number(r.delivered), replies: 0, answers: new Map<string, number>(),
    };
    if (r.answer) {
      b.answers.set(r.answer, (b.answers.get(r.answer) ?? 0) + Number(r.answers));
      b.replies += Number(r.answers);
    }
    tpl.set(key, b);
    byTpl.set(r.template_name, tpl);
  }
  return [...byTpl.entries()]
    .map(([name, m]) => {
      const blocks = [...m.values()];
      // Show every button the template offers, even ones nobody chose, in button order.
      for (const b of blocks) {
        const ordered = new Map<string, number>();
        for (const label of buttonOrder.get(name) ?? []) ordered.set(label, b.answers.get(label) ?? 0);
        for (const [k, v] of b.answers) if (!ordered.has(k)) ordered.set(k, v);
        b.answers = ordered;
      }
      return {
        name, blocks,
        sent: blocks.reduce((a, b) => a + b.sent, 0),
        delivered: blocks.reduce((a, b) => a + b.delivered, 0),
        replies: blocks.reduce((a, b) => a + b.replies, 0),
      };
    })
    .sort((a, b) => b.sent - a.sent);
}

/** Names of the quick-reply buttons in a stored template, in order. */
export function quickReplyLabels(buttons: unknown): string[] {
  if (!Array.isArray(buttons)) return [];
  return buttons
    .filter((b): b is { type: string; text: string } => !!b && b.type === "QUICK_REPLY" && typeof b.text === "string")
    .map((b) => b.text);
}

export const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
