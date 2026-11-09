export const instant = false;

import { getCurrentClient } from "@/lib/current-client";
import { supabaseAdmin } from "@/lib/supabase-server";
import { BotTester } from "@/components/BotTester";
import { Alert, Badge, Card, EmptyState, PageContainer, PageHeader, buttonClass, inputCls, labelCls, hintCls } from "@/components/ui";
import { deleteRuleAction, saveRuleAction, toggleRuleAction } from "./actions";

interface Rule {
  id: string; name: string; keywords: string[]; match_type: "contains" | "exact" | "starts_with" | "fallback";
  reply_text: string; cooldown_minutes: number; priority: number; is_active: boolean; phone_number_id: string | null;
}
const MATCH_LABEL = { contains: "Contains the word", exact: "Exactly equals", starts_with: "Starts with", fallback: "Anything else (fallback)" };

function RuleForm({ rule, numbers }: { rule?: Rule; numbers: { phone_number_id: string; display_name: string | null }[] }) {
  return (
    <form action={saveRuleAction} className="grid gap-4 sm:grid-cols-2">
      {rule && <input type="hidden" name="id" value={rule.id} />}
      <div><label className={labelCls}>Rule name</label>
        <input name="name" required maxLength={80} defaultValue={rule?.name} placeholder="Price enquiry" className={inputCls} /></div>
      <div><label className={labelCls}>When the message…</label>
        <select name="match_type" defaultValue={rule?.match_type ?? "contains"} className={inputCls}>
          {Object.entries(MATCH_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select></div>
      <div className="sm:col-span-2"><label className={labelCls}>Keywords</label>
        <input name="keywords" defaultValue={rule?.keywords.join(", ")} placeholder="price, cost, rate" className={inputCls} />
        <p className={hintCls}>Separate with commas. Matches whole words, ignoring capital letters and punctuation. Not needed for a fallback rule.</p></div>
      <div className="sm:col-span-2"><label className={labelCls}>Reply</label>
        <textarea name="reply_text" required maxLength={1000} rows={3} defaultValue={rule?.reply_text} className={inputCls}
          placeholder="Hi {name}! Our plans start at ₹499. Reply CALL and we'll phone you." />
        <p className={hintCls}>Use {"{name}"} to include the customer&apos;s first name.</p></div>
      <div><label className={labelCls}>Don&apos;t repeat for the same customer within (minutes)</label>
        <input name="cooldown_minutes" type="number" min={0} max={1440} defaultValue={rule?.cooldown_minutes ?? 60} className={inputCls} /></div>
      <div><label className={labelCls}>Priority (1 = checked first)</label>
        <input name="priority" type="number" min={1} max={999} defaultValue={rule?.priority ?? 100} className={inputCls} /></div>
      {numbers.length > 1 && (
        <div><label className={labelCls}>Applies to</label>
          <select name="phone_number_id" defaultValue={rule?.phone_number_id ?? ""} className={inputCls}>
            <option value="">All my numbers</option>
            {numbers.map((n) => <option key={n.phone_number_id} value={n.phone_number_id}>{n.display_name ?? n.phone_number_id}</option>)}
          </select></div>
      )}
      <div className="sm:col-span-2"><button type="submit" className={buttonClass("primary")}>{rule ? "Save changes" : "Add rule"}</button></div>
    </form>
  );
}

export default async function BotPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const { client, whatsappAccounts } = await getCurrentClient();
  const { data } = await supabaseAdmin().from("bot_rules").select("*").eq("client_id", client!.id).order("priority").order("created_at");
  const rules = (data ?? []) as Rule[];
  const numbers = (whatsappAccounts ?? []).map((a: { phone_number_id: string; display_name?: string | null }) => ({
    phone_number_id: a.phone_number_id, display_name: a.display_name ?? null,
  }));

  return (
    <PageContainer>
      <PageHeader title="Auto-reply bot" description="Reply automatically when a customer's message contains certain words. Replies are sent within the 24-hour window after the customer writes." />
      {error && <Alert tone="error" className="mb-4">{decodeURIComponent(error)}</Alert>}
      {saved && <Alert tone="success" className="mb-4">Saved.</Alert>}
      <Alert tone="info" className="mb-6">
        The first matching rule (lowest priority number) replies. A fallback rule answers anything no other rule matched. The bot never replies to STOP/START messages or
        to customers who opted out, and sends at most 5 bot replies per customer per hour.
      </Alert>

      <Card title="Try it" description="See which rule would answer a message. Nothing is sent." className="mb-6">
        <BotTester rules={rules.filter((r) => r.is_active)} />
      </Card>

      <Card title="Add a rule" className="mb-6"><RuleForm numbers={numbers} /></Card>

      <h2 className="mb-3 text-base font-semibold text-slate-900">Your rules ({rules.length})</h2>
      {rules.length === 0 ? <EmptyState title="No rules yet" description="Add your first rule above, for example replying to “price” or “hours”." /> : (
        <div className="space-y-3">
          {rules.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{r.name}</span>
                    <Badge tone={r.is_active ? "green" : "slate"}>{r.is_active ? "On" : "Off"}</Badge>
                    <span className="text-xs text-slate-500">priority {r.priority}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{MATCH_LABEL[r.match_type]}{r.keywords.length > 0 && <>: {r.keywords.join(", ")}</>}</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{r.reply_text}</p>
                </div>
                <div className="flex gap-2">
                  <form action={toggleRuleAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="active" value={r.is_active ? "0" : "1"} />
                    <button className={buttonClass("secondary")}>{r.is_active ? "Turn off" : "Turn on"}</button></form>
                  <form action={deleteRuleAction}><button name="id" value={r.id} className={buttonClass("secondary")}>Delete</button></form>
                </div>
              </div>
              <details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-brand-700">Edit</summary>
                <div className="mt-3"><RuleForm rule={r} numbers={numbers} /></div></details>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
