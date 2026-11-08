-- Customers who asked to stop receiving messages (STOP / unsubscribe), per business.
create table if not exists public.opt_outs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  phone text not null,
  contact_name text,
  status text not null default 'opted_out' check (status in ('opted_out', 'opted_in')),
  source text not null default 'keyword' check (source in ('keyword', 'manual')),
  reason_text text,
  opted_out_at timestamptz not null default now(),
  opted_in_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (client_id, phone)
);
create index if not exists opt_outs_client_status_idx on public.opt_outs (client_id, status);
alter table public.opt_outs enable row level security;
