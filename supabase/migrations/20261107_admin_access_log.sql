create table if not exists public.admin_access_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  admin_email text not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  customer_number text,
  accessed_at timestamptz not null default now()
);
alter table public.admin_access_log enable row level security;
create index if not exists admin_access_log_client_idx on public.admin_access_log (client_id, accessed_at desc);
