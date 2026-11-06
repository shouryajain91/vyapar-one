export const instant = false;

import { getCurrentClient } from "@/lib/current-client";
import { supabaseAdmin } from "@/lib/supabase-server";
import { SendTemplateForm } from "@/components/SendTemplateForm";
import { Icon } from "@/components/icons";
import { Card, EmptyState, LinkButton, PageContainer, PageHeader } from "@/components/ui";
import type { SendableTemplate } from "@/lib/template-send";

export default async function NewConversationPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; language?: string }>;
}) {
  const { client, whatsappAccount } = await getCurrentClient();
  const { template, language } = await searchParams;

  const { data } = await supabaseAdmin()
    .from("templates")
    .select("name, language, status, body, header_format, header_text, footer, buttons")
    .eq("client_id", client!.id)
    .eq("status", "APPROVED")
    .order("name");

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        back={
          <LinkButton href="/inbox" variant="ghost" size="sm">
            <Icon name="back" className="h-3.5 w-3.5" />
            Inbox
          </LinkButton>
        }
        title="New conversation"
        description="Start a chat by sending an approved template. Use this when the customer hasn't messaged you in the last 24 hours."
      />
      {!whatsappAccount ? (
        <EmptyState
          title="Connect WhatsApp first"
          description="You need a connected number before you can send messages."
          action={<LinkButton href="/dashboard">Go to dashboard</LinkButton>}
        />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title="No approved templates yet"
          description="WhatsApp needs to approve a template before you can start a conversation with it."
          action={<LinkButton href="/templates/new">Create a template</LinkButton>}
        />
      ) : (
        <Card>
          <SendTemplateForm
            templates={(data ?? []) as SendableTemplate[]}
            defaultKey={template && language ? `${template}|${language}` : undefined}
          />
        </Card>
      )}
    </PageContainer>
  );
}
