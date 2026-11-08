-- The customer's WhatsApp profile name, as sent by Meta with each inbound message.
alter table public.messages add column if not exists contact_name text;
