-- Bulk campaigns, per-recipient send queue, and keyword auto-reply bot.

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  phone_number_id text not null,
  name text not null,
  template_name text not null,
  template_language text not null,
  header_link text,
  status text not null default 'scheduled' check (status in ('scheduled','running','completed','cancelled')),
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  total integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists campaigns_client_idx on public.campaigns (client_id, created_at desc);
create index if not exists campaigns_due_idx on public.campaigns (status, scheduled_at);

create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  phone text not null,
  contact_name text,
  vars jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','skipped','cancelled')),
  error_message text,
  message_id uuid,
  claimed_at timestamptz,
  sent_at timestamptz,
  unique (campaign_id, phone)
);
create index if not exists campaign_recipients_queue_idx on public.campaign_recipients (campaign_id, status);

create table if not exists public.bot_rules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  phone_number_id text,
  name text not null,
  keywords text[] not null default '{}',
  match_type text not null default 'contains' check (match_type in ('contains','exact','starts_with','fallback')),
  reply_text text not null,
  cooldown_minutes integer not null default 60 check (cooldown_minutes >= 0),
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists bot_rules_client_idx on public.bot_rules (client_id, is_active, priority);

alter table public.messages add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
alter table public.messages add column if not exists bot_rule_id uuid references public.bot_rules(id) on delete set null;
create index if not exists messages_campaign_idx on public.messages (campaign_id);
create index if not exists messages_bot_idx on public.messages (bot_rule_id, to_number, created_at desc);

alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.bot_rules enable row level security;

-- Starts due campaigns and atomically claims a batch of pending recipients.
create or replace function public.claim_campaign_recipients(p_limit integer)
returns setof public.campaign_recipients
language plpgsql security definer set search_path = public as $$
begin
  update campaigns set status = 'running', started_at = coalesce(started_at, now())
   where status = 'scheduled' and scheduled_at <= now();
  return query
  with picked as (
    select r.id from campaign_recipients r
    join campaigns c on c.id = r.campaign_id
    where r.status = 'pending' and c.status = 'running'
    order by c.scheduled_at, r.id
    limit p_limit
    for update of r skip locked
  )
  update campaign_recipients r set status = 'sending', claimed_at = now()
   from picked where r.id = picked.id
  returning r.*;
end $$;

create or replace function public.complete_finished_campaigns()
returns void language sql security definer set search_path = public as $$
  update campaigns c set status = 'completed', completed_at = now()
   where c.status = 'running'
     and not exists (select 1 from campaign_recipients r
                      where r.campaign_id = c.id and r.status in ('pending','sending'));
$$;

-- A recipient stuck in "sending" may or may not have been sent: never retry, mark failed.
create or replace function public.recover_stuck_recipients()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update campaign_recipients set status = 'failed',
         error_message = 'Sending was interrupted; delivery unknown. Check the chat before resending.'
   where status = 'sending' and claimed_at < now() - interval '5 minutes';
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.campaign_stats(p_client uuid)
returns table (campaign_id uuid, pending bigint, sent bigint, delivered bigint, read bigint, failed bigint, skipped bigint)
language sql security definer set search_path = public as $$
  select c.id,
    count(*) filter (where r.status in ('pending','sending')),
    count(*) filter (where r.status = 'sent'),
    count(*) filter (where m.status in ('delivered','read')),
    count(*) filter (where m.status = 'read'),
    count(*) filter (where r.status = 'failed' or m.status = 'failed'),
    count(*) filter (where r.status in ('skipped','cancelled'))
  from campaigns c
  left join campaign_recipients r on r.campaign_id = c.id
  left join messages m on m.id = r.message_id
  where c.client_id = p_client
  group by c.id;
$$;

revoke all on function public.claim_campaign_recipients(integer), public.complete_finished_campaigns(),
  public.recover_stuck_recipients(), public.campaign_stats(uuid) from public, anon, authenticated;
grant execute on function public.claim_campaign_recipients(integer), public.complete_finished_campaigns(),
  public.recover_stuck_recipients(), public.campaign_stats(uuid) to service_role;
