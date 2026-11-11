-- Token health, number quality, alerts, webhook queue, and DB-side paging.

alter table public.whatsapp_accounts
  add column if not exists token_status text not null default 'ok' check (token_status in ('ok','invalid')),
  add column if not exists token_error text,
  add column if not exists token_checked_at timestamptz,
  add column if not exists quality_rating text,
  add column if not exists messaging_limit_tier text,
  add column if not exists quality_checked_at timestamptz;

-- ---------------------------------------------------------------- alerts
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  phone_number_id text,
  kind text not null,
  severity text not null default 'warning' check (severity in ('critical','warning','info')),
  title text not null,
  detail text,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index if not exists alerts_open_key on public.alerts (client_id, dedupe_key) where resolved_at is null;
create index if not exists alerts_client_idx on public.alerts (client_id, resolved_at, created_at desc);
alter table public.alerts enable row level security;

-- Opens an alert unless the same one is already open (then just refreshes its text).
create or replace function public.raise_alert(
  p_client uuid, p_number text, p_kind text, p_severity text, p_title text, p_detail text, p_key text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into alerts (client_id, phone_number_id, kind, severity, title, detail, dedupe_key)
  values (p_client, p_number, p_kind, p_severity, p_title, p_detail, p_key)
  on conflict (client_id, dedupe_key) where resolved_at is null
  do update set detail = excluded.detail, title = excluded.title, severity = excluded.severity;
  get diagnostics n = row_count;
  return n > 0;
end $$;

create or replace function public.resolve_alert(p_client uuid, p_key text)
returns void language sql security definer set search_path = public as $$
  update alerts set resolved_at = now() where client_id = p_client and dedupe_key = p_key and resolved_at is null;
$$;

-- Numbers whose last hour of sending went badly (at least 10 sends and 30% failed).
create or replace function public.failure_spikes()
returns table (client_id uuid, phone_number_id text, total bigint, failed bigint)
language sql stable security definer set search_path = public as $$
  select m.client_id, m.phone_number_id, count(*), count(*) filter (where m.status = 'failed')
  from messages m
  where m.direction = 'outbound' and m.created_at > now() - interval '1 hour' and m.phone_number_id is not null
  group by m.client_id, m.phone_number_id
  having count(*) >= 10 and count(*) filter (where m.status = 'failed') >= 0.3 * count(*);
$$;

-- ---------------------------------------------------------------- webhook queue
create table if not exists public.webhook_events (
  id bigint generated always as identity primary key,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','done','failed')),
  attempts integer not null default 0,
  last_error text,
  received_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  processed_at timestamptz
);
create index if not exists webhook_events_queue_idx on public.webhook_events (status, next_attempt_at, id);
alter table public.webhook_events enable row level security;

create or replace function public.claim_webhook_events(p_limit integer)
returns setof public.webhook_events
language plpgsql security definer set search_path = public as $$
begin
  update webhook_events set status = 'pending' where status = 'processing' and locked_at < now() - interval '5 minutes';
  return query
  with picked as (
    select id from webhook_events
    where status = 'pending' and next_attempt_at <= now()
    order by id limit p_limit
    for update skip locked
  )
  update webhook_events e set status = 'processing', locked_at = now(), attempts = e.attempts + 1
  from picked where e.id = picked.id
  returning e.*;
end $$;

create or replace function public.finish_webhook_event(p_id bigint, p_error text)
returns void language sql security definer set search_path = public as $$
  update webhook_events set
    status = case when p_error is null then 'done' when attempts >= 5 then 'failed' else 'pending' end,
    last_error = p_error,
    processed_at = case when p_error is null then now() else processed_at end,
    next_attempt_at = now() + (attempts * interval '1 minute'),
    locked_at = null
  where id = p_id;
$$;

create or replace function public.cleanup_webhook_events()
returns void language sql security definer set search_path = public as $$
  delete from webhook_events where (status = 'done' and processed_at < now() - interval '3 days')
                                or (status = 'failed' and received_at < now() - interval '30 days');
$$;

-- ---------------------------------------------------------------- paging
create index if not exists messages_client_from_idx on public.messages (client_id, from_number, created_at desc);
create index if not exists messages_client_to_idx on public.messages (client_id, to_number, created_at desc);

-- One row per customer chat (latest message), newest first, with optional search.
create or replace function public.conversation_list(
  p_client uuid, p_number text, p_q text, p_limit integer, p_offset integer
) returns table (
  customer text, customer_name text, last_id uuid, last_direction text, last_type text,
  last_body text, last_status text, last_at timestamptz, total bigint
)
language sql stable security definer set search_path = public as $$
  with m as (
    select id, direction, message_type, body, status, created_at, contact_name,
           case when direction = 'inbound' then from_number else to_number end as customer
    from messages
    where client_id = p_client and (p_number is null or phone_number_id = p_number)
  ),
  latest as (
    select distinct on (customer) customer, id, direction, message_type, body, status, created_at
    from m where customer is not null order by customer, created_at desc
  ),
  names as (
    select distinct on (customer) customer, contact_name
    from m where customer is not null and contact_name is not null order by customer, created_at desc
  )
  select l.customer, n.contact_name, l.id, l.direction, l.message_type, l.body, l.status, l.created_at,
         count(*) over ()
  from latest l left join names n using (customer)
  where p_q is null or p_q = '' or l.customer ilike '%' || p_q || '%' or n.contact_name ilike '%' || p_q || '%'
  order by l.created_at desc
  limit p_limit offset p_offset;
$$;

-- Admin home: per-client message totals, paged by client.
create or replace function public.admin_client_list(p_q text, p_limit integer, p_offset integer)
returns table (
  id uuid, business_name text, contact_email text, created_at timestamptz,
  display_name text, verification_status text, token_status text,
  message_count bigint, last_activity timestamptz, open_alerts bigint, total bigint
)
language sql stable security definer set search_path = public as $$
  select c.id, c.business_name, c.contact_email, c.created_at,
         a.display_name, a.verification_status, a.token_status,
         coalesce(ms.cnt, 0), ms.last_at,
         (select count(*) from alerts al where al.client_id = c.id and al.resolved_at is null),
         count(*) over ()
  from clients c
  left join lateral (select display_name, verification_status, token_status from whatsapp_accounts w where w.client_id = c.id order by connected_at limit 1) a on true
  left join lateral (select count(*) cnt, max(created_at) last_at from messages m where m.client_id = c.id) ms on true
  where p_q is null or p_q = '' or c.business_name ilike '%' || p_q || '%' or c.contact_email ilike '%' || p_q || '%'
  order by c.created_at desc
  limit p_limit offset p_offset;
$$;

revoke all on function
  public.raise_alert(uuid, text, text, text, text, text, text), public.resolve_alert(uuid, text), public.failure_spikes(),
  public.claim_webhook_events(integer), public.finish_webhook_event(bigint, text), public.cleanup_webhook_events(),
  public.conversation_list(uuid, text, text, integer, integer), public.admin_client_list(text, integer, integer)
  from public, anon, authenticated;
grant execute on function
  public.raise_alert(uuid, text, text, text, text, text, text), public.resolve_alert(uuid, text), public.failure_spikes(),
  public.claim_webhook_events(integer), public.finish_webhook_event(bigint, text), public.cleanup_webhook_events(),
  public.conversation_list(uuid, text, text, integer, integer), public.admin_client_list(text, integer, integer)
  to service_role;
