export const instant = false;

import { getCurrentClient } from "@/lib/current-client";
import { supabaseAdmin } from "@/lib/supabase-server";
import { NumberHealth } from "@/components/NumberHealth";
import { AccountReadiness } from "@/components/AccountReadiness";
import { ConnectWhatsAppButton } from "@/components/ConnectWhatsAppButton";
import { RegisterNumberButton } from "@/components/RegisterNumberButton";
import { setActiveNumberAction } from "../actions";
import { Icon, type IconName } from "@/components/icons";
import { Badge, Card, LinkButton, PageContainer, PageHeader, buttonClass } from "@/components/ui";

export default async function DashboardPage() {
  const { client, whatsappAccount, whatsappAccounts } = await getCurrentClient();
  const db = supabaseAdmin();

  const [{ data: counts }, { data: tpls }] = await Promise.all([
    db.rpc("dashboard_counts", { p_client: client!.id }),
    db.from("templates").select("status").eq("client_id", client!.id),
  ]);

  const total = (counts?.total as number) ?? 0;
  const templates = tpls ?? [];
  const conversations = (counts?.conversations as number) ?? 0;
  const sent = (counts?.sent as number) ?? 0;
  const approved = templates.filter((t) => t.status === "APPROVED").length;
  const inReview = templates.filter((t) => t.status === "PENDING" || t.status === "IN_APPEAL").length;

  const state: "none" | "pending" | "connected" = !whatsappAccount
    ? "none"
    : whatsappAccount.verification_status === "pending_registration"
    ? "pending"
    : "connected";

  const steps = [
    { title: "Connect your WhatsApp number", done: state !== "none" },
    { title: "Finish number registration", done: state === "connected" },
    { title: "Create a message template", done: templates.length > 0 },
    { title: "Send your first message", done: sent > 0 },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const nextIndex = steps.findIndex((s) => !s.done);

  const stats: { label: string; value: number; hint: string; icon: IconName }[] = [
    { label: "Conversations", value: conversations, hint: "customers you've chatted with", icon: "chat" },
    { label: "Messages sent", value: sent, hint: `${total - sent} received`, icon: "send" },
    { label: "Approved templates", value: approved, hint: "ready to send", icon: "check" },
    { label: "Templates in review", value: inReview, hint: "waiting for WhatsApp", icon: "template" },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome, ${client?.business_name ?? "there"}`}
        description="Here's how your WhatsApp is doing."
      />

      {/* Setup checklist */}
      {doneCount < steps.length && (
        <Card
          className="mb-6"
          title="Get started"
          description={`${doneCount} of ${steps.length} steps done`}
        >
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={s.title} className="flex items-center gap-3">
                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    s.done
                      ? "bg-emerald-100 text-emerald-700"
                      : i === nextIndex
                      ? "bg-brand-700 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {s.done ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={`text-sm ${s.done ? "text-slate-400 line-through" : i === nextIndex ? "font-semibold text-slate-900" : "text-slate-600"}`}>
                  {s.title}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{s.label}</p>
              <span className="text-slate-300"><Icon name={s.icon} className="h-5 w-5" /></span>
            </div>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{s.value}</p>
            <p className="mt-1 text-xs text-slate-500">{s.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Connection */}
        <Card
          className="lg:col-span-2"
          title="WhatsApp connection"
          actions={
            state === "connected" ? <Badge tone="green">Connected</Badge>
            : state === "pending" ? <Badge tone="amber">Needs registration</Badge>
            : <Badge tone="slate">Not connected</Badge>
          }
        >
          {state === "none" && (
            <div>
              <p className="mb-4 text-sm text-slate-600">
                Connect your WhatsApp Business number to start sending and receiving messages from Vyapar One.
              </p>
              <ConnectWhatsAppButton clientId={client!.id} />
            </div>
          )}
          {state !== "none" && (
            <div>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {whatsappAccounts.map((a) => {
                  const isActive = a.phone_number_id === whatsappAccount!.phone_number_id;
                  const pending = a.verification_status === "pending_registration";
                  return (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{a.display_name ?? "Your number"}</p>
                        <p className="font-mono text-xs text-slate-500">ID {a.phone_number_id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {pending ? <Badge tone="amber">Needs registration</Badge> : <Badge tone="green">Connected</Badge>}
                        {isActive ? (
                          <Badge tone="brand">In use</Badge>
                        ) : (
                          <form action={setActiveNumberAction}>
                            <input type="hidden" name="phone_number_id" value={a.phone_number_id} />
                            <button type="submit" className={buttonClass("secondary", "sm")}>Use this number</button>
                          </form>
                        )}
                      </div>
                      {pending && (
                        <div className="w-full">
                          <p className="mb-2 text-sm text-slate-600">
                            This number is linked, but WhatsApp hasn&apos;t activated it yet, so it can&apos;t send or receive messages.
                          </p>
                          <RegisterNumberButton phoneNumberId={a.phone_number_id} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-slate-500">
                The inbox, templates and new messages use the number marked &ldquo;In use&rdquo;.
              </p>
              {whatsappAccounts.some((a) => a.token_status === "invalid") && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">WhatsApp connection expired</p>
                  <p className="mt-1 text-sm text-red-700">
                    Meta stopped accepting our access, so messages can&apos;t be sent or received. This happens if the app was removed
                    from your WhatsApp account or your Meta business settings changed. Reconnect to fix it. Your chats and templates are kept.
                  </p>
                  <div className="mt-3"><ConnectWhatsAppButton clientId={client!.id} label="Reconnect WhatsApp" /></div>
                </div>
              )}
              {whatsappAccount!.verification_status === "connected" && <NumberHealth />}
              {whatsappAccount!.verification_status === "connected" && <AccountReadiness />}
              <div className="mt-4">
                <ConnectWhatsAppButton clientId={client!.id} label="Add another number" variant="secondary" />
              </div>
            </div>
          )}
        </Card>

        {/* Quick actions */}
        <Card title="Quick actions">
          <div className="flex flex-col gap-2">
            <LinkButton href="/inbox" variant="primary"><Icon name="chat" />Open inbox</LinkButton>
            <LinkButton href="/inbox/new" variant="secondary"><Icon name="send" />New conversation</LinkButton>
            <LinkButton href="/templates/new" variant="secondary"><Icon name="plus" />New template</LinkButton>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
