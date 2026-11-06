export const instant = false;

import { getCurrentClient } from "@/lib/current-client";
import { supabaseAdmin } from "@/lib/supabase-server";
import { SyncTemplatesButton } from "@/components/SyncTemplatesButton";
import { DeleteTemplateButton } from "@/components/DeleteTemplateButton";
import { WaPreview } from "@/components/WaPreview";
import { Icon } from "@/components/icons";
import { Alert, Badge, Card, EmptyState, LinkButton, PageContainer, PageHeader } from "@/components/ui";

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "slate"> = {
  APPROVED: "green",
  PENDING: "amber",
  IN_APPEAL: "amber",
  REJECTED: "red",
  PAUSED: "slate",
  DISABLED: "slate",
};

export default async function TemplatesPage() {
  const { client, whatsappAccount } = await getCurrentClient();

  const { data: templates } = await supabaseAdmin()
    .from("templates")
    .select("*")
    .eq("client_id", client!.id)
    .order("synced_at", { ascending: false });

  return (
    <PageContainer>
      <PageHeader
        title="Message templates"
        description="WhatsApp reviews every template before you can use it. Create one here, or sync the ones you made in WhatsApp Manager."
        actions={
          whatsappAccount && (
            <>
              <SyncTemplatesButton />
              <LinkButton href="/templates/new">
                <Icon name="plus" />
                New template
              </LinkButton>
            </>
          )
        }
      />

      {!whatsappAccount ? (
        <EmptyState
          title="Connect WhatsApp first"
          description="Templates belong to your WhatsApp Business account, so connect your number to manage them."
          action={<LinkButton href="/dashboard">Go to dashboard</LinkButton>}
        />
      ) : (templates ?? []).length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Create your first template, or press Sync to pull in the ones you already have."
          action={<LinkButton href="/templates/new"><Icon name="plus" />New template</LinkButton>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(templates ?? []).map((t) => (
            <Card key={t.id} className="flex flex-col">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{t.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t.language} · {t.category ? t.category.charAt(0) + t.category.slice(1).toLowerCase() : "No category"}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[t.status ?? ""] ?? "slate"}>{t.status ?? "UNKNOWN"}</Badge>
              </div>

              <WaPreview
                headerText={t.header_format === "TEXT" ? t.header_text : null}
                headerMedia={
                  t.header_format && t.header_format !== "TEXT"
                    ? t.header_format === "DOCUMENT" ? "PDF document" : t.header_format.toLowerCase()
                    : null
                }
                body={t.body ?? ""}
                footer={t.footer}
                buttons={Array.isArray(t.buttons) ? (t.buttons as { type: string; text: string }[]) : []}
              />

              {t.status === "REJECTED" && t.rejected_reason && t.rejected_reason !== "NONE" && (
                <Alert tone="error" className="mt-3">Rejected: {t.rejected_reason}</Alert>
              )}

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
                {t.status === "APPROVED" ? (
                  <LinkButton
                    href={`/inbox/new?template=${encodeURIComponent(t.name)}&language=${encodeURIComponent(t.language)}`}
                    variant="secondary"
                    size="sm"
                  >
                    <Icon name="send" className="h-3.5 w-3.5" />
                    Send
                  </LinkButton>
                ) : (
                  <span className="text-xs text-slate-400">Can be sent once approved</span>
                )}
                <DeleteTemplateButton name={t.name} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
