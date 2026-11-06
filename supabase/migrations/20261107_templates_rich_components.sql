alter table public.templates add column if not exists header_format text;
alter table public.templates add column if not exists header_text text;
alter table public.templates add column if not exists footer text;
alter table public.templates add column if not exists buttons jsonb;
