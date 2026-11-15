export const instant = false;

import { getSessionContext } from "@/lib/session";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import { formatDateTime } from "@/lib/format";
import { Badge, Card, EmptyState, PageContainer, PageHeader, buttonClass, inputCls, labelCls, hintCls } from "@/components/ui";
import { SecretForm } from "@/components/SecretForm";
import { DevTabs } from "@/components/DevTabs";
import { createKeyAction, revokeKeyAction, createWebhookAction, deleteWebhookAction, toggleWebhookAction, testWebhookAction } from "./actions";
import { EVENT_TYPES } from "@/lib/outbound-webhooks";

export default async function DevelopersPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  const db = supabaseAdmin();
  const [{ data: keys }, { data: hooks }] = await Promise.all([
    db.from("api_keys").select("id, name, key_prefix, phone_number_id, scopes, ip_allowlist, created_at, last_used_at, revoked_at").eq("client_id", ctx.client_id).order("created_at", { ascending: false }).limit(50),
    db.from("webhook_endpoints").select("id, url, events, phone_number_id, active, consecutive_failures, created_at").eq("client_id", ctx.client_id).order("created_at", { ascending: false }),
  ]);
  const label = (pn: string | null) => (pn ? ctx.accounts.find((a) => a.phone_number_id === pn)?.display_name ?? pn : "All numbers");

  return (
    <PageContainer>
      <PageHeader title="Developers" description="Send WhatsApp messages from your own website or software using an API key, and get delivery updates on your own server." />
      <DevTabs active="/developers" />

      <Card title="API keys" description="Each key sends from one WhatsApp number. Keep keys secret, like a password." className="mb-6">
        {keys && keys.length > 0 ? (
          <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Key</th><th className="px-4 py-3">Number</th><th className="px-4 py-3">Last used</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {keys.map((k) => (
                  <tr key={k.id} className={k.revoked_at ? "opacity-50" : ""}>
                    <td className="px-4 py-3"><p className="font-medium text-slate-900">{k.name}</p><p className="text-xs text-slate-500">{(k.scopes as string[]).join(", ")}{(k.ip_allowlist as string[]).length ? ` · ${(k.ip_allowlist as string[]).length} IP limit` : ""}</p></td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{k.key_prefix}…</td>
                    <td className="px-4 py-3 text-slate-700">{label(k.phone_number_id)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{k.revoked_at ? <Badge tone="red">Revoked</Badge> : k.last_used_at ? formatDateTime(k.last_used_at) : "Never"}</td>
                    <td className="px-4 py-3 text-right">
                      {!k.revoked_at && (
                        <form action={revokeKeyAction}>
                          <input type="hidden" name="id" value={k.id} />
                          <button type="submit" className={buttonClass("danger", "sm")}>Revoke</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mb-6"><EmptyState title="No API keys yet" description="Create one below to start sending from your own software." /></div>
        )}

        <h3 className="mb-3 text-sm font-semibold text-slate-900">Create a key</h3>
        {ctx.accounts.length === 0 ? (
          <p className="text-sm text-slate-500">Connect a WhatsApp number on the dashboard first.</p>
        ) : (
          <SecretForm action={createKeyAction} submitLabel="Create key" secretTitle="Your new API key">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="kname">Name</label>
                <input id="kname" name="name" required maxLength={60} placeholder="Website checkout" className={inputCls} />
              </div>
              <div>
                <label className={labelCls} htmlFor="kno">Sends from</label>
                <select id="kno" name="phone_number_id" className={inputCls}>
                  {ctx.accounts.map((a) => <option key={a.phone_number_id} value={a.phone_number_id}>{a.display_name ?? a.phone_number_id}</option>)}
                </select>
              </div>
            </div>
            <fieldset>
              <legend className={labelCls}>Permissions</legend>
              <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                <label className="flex items-center gap-2"><input type="checkbox" name="scopes" value="send" defaultChecked /> Send messages</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="scopes" value="read" defaultChecked /> Read message status</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="scopes" value="templates" defaultChecked /> List templates</label>
              </div>
            </fieldset>
            <div>
              <label className={labelCls} htmlFor="kips">Only allow these IP addresses (optional)</label>
              <input id="kips" name="ips" placeholder="203.0.113.10, 203.0.113.11" className={inputCls} />
              <p className={hintCls}>Leave empty to allow any address. Use it if your server has a fixed IP.</p>
            </div>
          </SecretForm>
        )}
      </Card>

      <Card title="Webhooks" description="We send delivery updates and customer replies to your server, so you don't have to keep asking." className="mb-6">
        {hooks && hooks.length > 0 ? (
          <ul className="mb-6 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {hooks.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-slate-900">{h.url}</p>
                  <p className="mt-1 text-xs text-slate-500">{(h.events as string[]).join(", ")} · {label(h.phone_number_id)}</p>
                  {!h.active && <p className="mt-1"><Badge tone="amber">Off{h.consecutive_failures > 0 ? " (delivery kept failing)" : ""}</Badge></p>}
                </div>
                <div className="flex gap-2">
                  <form action={testWebhookAction}><input type="hidden" name="id" value={h.id} /><button className={buttonClass("secondary", "sm")}>Send test</button></form>
                  <form action={toggleWebhookAction}><input type="hidden" name="id" value={h.id} /><input type="hidden" name="active" value={h.active ? "0" : "1"} /><button className={buttonClass("secondary", "sm")}>{h.active ? "Turn off" : "Turn on"}</button></form>
                  <form action={deleteWebhookAction}><input type="hidden" name="id" value={h.id} /><button className={buttonClass("danger", "sm")}>Delete</button></form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mb-6"><EmptyState title="No webhooks yet" description="Add the address of your server below." /></div>
        )}
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Add a webhook</h3>
        <SecretForm action={createWebhookAction} submitLabel="Add webhook" secretTitle="Your webhook signing secret">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="wurl">Your server address</label>
              <input id="wurl" name="url" required type="url" placeholder="https://example.com/hooks/whatsapp" className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="wno">For number</label>
              <select id="wno" name="phone_number_id" className={inputCls}>
                <option value="">All my numbers</option>
                {ctx.accounts.map((a) => <option key={a.phone_number_id} value={a.phone_number_id}>{a.display_name ?? a.phone_number_id}</option>)}
              </select>
            </div>
          </div>
          <fieldset>
            <legend className={labelCls}>Send me</legend>
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              {EVENT_TYPES.map((e) => (
                <label key={e} className="flex items-center gap-2"><input type="checkbox" name="events" value={e} defaultChecked /> {e === "message.status" ? "Delivery updates (delivered, read, failed)" : "Customer replies and button taps"}</label>
              ))}
            </div>
          </fieldset>
        </SecretForm>
      </Card>
    </PageContainer>
  );
}
