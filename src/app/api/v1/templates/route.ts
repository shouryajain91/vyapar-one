import { NextResponse } from "next/server";
import { api } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase-server";
import { describeInputs, type SendableTemplate } from "@/lib/template-send";

/** Approved templates and exactly what each one needs when sending. */
export const GET = api("templates", async (_req, key) => {
  const { data } = await supabaseAdmin()
    .from("templates")
    .select("name, language, status, body, header_format, header_text, footer, buttons")
    .eq("client_id", key.clientId)
    .eq("status", "APPROVED")
    .order("name")
    .limit(500);
  return NextResponse.json({
    data: (data ?? []).map((t) => {
      const need = describeInputs(t as SendableTemplate);
      return {
        name: t.name,
        language: t.language,
        body: t.body,
        needs: {
          body_variables: need.bodyVars.length,
          header_text: need.headerVar,
          header_media: need.headerMedia, // IMAGE | VIDEO | DOCUMENT | null
          url_buttons: need.urlButtons.map((b) => ({ index: b.index, label: b.label })),
        },
      };
    }),
  });
});
