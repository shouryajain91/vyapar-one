import { NextResponse } from "next/server";
import { api, fail } from "@/lib/api";
import { toApiMessage, MESSAGE_COLUMNS } from "@/lib/api-send";
import { supabaseAdmin } from "@/lib/supabase-server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = api<{ id: string }>("read", async (_req, key, { id }) => {
  if (!UUID.test(id)) return fail(404, "not_found", "Message not found.");
  const { data } = await supabaseAdmin()
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("id", id)
    .eq("client_id", key.clientId)
    .eq("phone_number_id", key.phoneNumberId)
    .maybeSingle();
  if (!data) return fail(404, "not_found", "Message not found.");
  return NextResponse.json(toApiMessage(data as Record<string, unknown>));
});
