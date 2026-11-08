alter table public.messages add column if not exists template_name text;
update public.messages set template_name = raw_payload->'template'->>'name'
where message_type = 'template' and direction = 'outbound' and template_name is null;
create index if not exists messages_client_created_idx on public.messages (client_id, created_at desc);
