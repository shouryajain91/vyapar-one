-- Cloud API registration needs a 6-digit two-step verification PIN.
alter table public.whatsapp_accounts add column if not exists registration_pin_encrypted text;
