export const instant = false;

import Link from "next/link";
import { getCurrentClient } from "@/lib/current-client";
import { supabaseAdmin } from "@/lib/supabase-server";
import { CampaignWizard } from "@/components/CampaignWizard";
import { Alert, PageContainer, PageHeader } from "@/components/ui";
import type { SendableTemplate } from "@/lib/template-send";

export default async function NewCampaignPage() {
  const { client, whatsappAccount } = await getCurrentClient();
  const { data } = await supabaseAdmin()
    .from("templates")
    .select("name, language, status, body, header_format, header_text, footer, buttons")
    .eq("client_id", client!.id)
    .eq("status", "APPROVED")
    .order("name");

  return (
    <PageContainer>
      <PageHeader back={<Link href="/campaigns" className="text-sm text-slate-500 hover:text-slate-900">← Campaigns</Link>} title="New campaign" description="Send an approved template to many customers from a spreadsheet." />
      {!whatsappAccount ? (
        <Alert tone="info">Connect a WhatsApp number on the dashboard first.</Alert>
      ) : (
        <CampaignWizard templates={(data ?? []) as SendableTemplate[]} />
      )}
    </PageContainer>
  );
}
