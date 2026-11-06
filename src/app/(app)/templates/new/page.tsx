export const instant = false;

import { getCurrentClient } from "@/lib/current-client";
import { NewTemplateForm } from "@/components/NewTemplateForm";
import { Icon } from "@/components/icons";
import { EmptyState, LinkButton, PageContainer, PageHeader } from "@/components/ui";

export default async function NewTemplatePage() {
  const { whatsappAccount } = await getCurrentClient();

  return (
    <PageContainer>
      <PageHeader
        back={
          <LinkButton href="/templates" variant="ghost" size="sm">
            <Icon name="back" className="h-3.5 w-3.5" />
            Templates
          </LinkButton>
        }
        title="New message template"
        description="Templates let you message a customer first, or after the 24-hour reply window. WhatsApp reviews each one, usually within minutes to a few hours."
      />
      {whatsappAccount ? (
        <NewTemplateForm />
      ) : (
        <EmptyState
          title="Connect WhatsApp first"
          description="You need a connected number before you can create templates."
          action={<LinkButton href="/dashboard">Go to dashboard</LinkButton>}
        />
      )}
    </PageContainer>
  );
}
