-- A business can connect several WhatsApp numbers. Messages record which
-- of the business's numbers they belong to, so each number has its own inbox.
alter table public.messages add column if not exists phone_number_id text;

update public.messages m
set phone_number_id = (
  select a.phone_number_id from public.whatsapp_accounts a
  where a.client_id = m.client_id
  order by a.connected_at nulls last
  limit 1
)
where m.phone_number_id is null;

create index if not exists messages_client_number_idx
  on public.messages (client_id, phone_number_id, created_at);
