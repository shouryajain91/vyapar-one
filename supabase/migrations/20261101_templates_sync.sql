-- Support syncing WhatsApp message templates from Meta.
alter table public.templates add column if not exists meta_template_id text;
alter table public.templates add column if not exists synced_at timestamptz default now();

-- One row per (client, template name, language) so sync can upsert.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'templates_client_name_language_key'
  ) then
    alter table public.templates
      add constraint templates_client_name_language_key unique (client_id, name, language);
  end if;
end $$;
