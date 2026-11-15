-- Public sending API: keys, rate limit, idempotency, request log, outbound webhooks.

-- ---------------------------------------------------------------- API keys
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  phone_number_id text not null,                 -- every key is locked to one number
  name text not null,
  key_prefix text not null,                      -- first characters, for display only
  key_hash text not null unique,                 -- sha256 of the full key; the key itself is never stored
  scopes text[] not null default '{send,read,templates}',
  ip_allowlist text[] not null default '{}',     -- empty = any address
  rate_limit_per_sec integer not null default 20 check (rate_limit_per_sec between 1 and 200),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists api_keys_client_idx on public.api_keys (client_id, created_at desc);
alter table public.api_keys enable row level security;

-- Fixed one-second window counters.
create table if not exists public.api_rate (
  key_id uuid not null references public.api_keys(id) on delete cascade,
  sec timestamptz not null,
  n integer not null default 0,
  primary key (key_id, sec)
);
alter table public.api_rate enable row level security;

create table if not exists public.api_idempotency (
  key_id uuid not null references public.api_keys(id) on delete cascade,
  idem_key text not null,
  request_hash text not null,
  status integer,
  response jsonb,
  created_at timestamptz not null default now(),
  primary key (key_id, idem_key)
);
alter table public.api_idempotency enable row level security;

create table if not exists public.api_request_log (
  id bigint generated always as identity primary key,
  key_id uuid references public.api_keys(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete cascade,
  method text not null,
  path text not null,
  status integer not null,
  ms integer,
  error_code text,
  created_at timestamptz not null default now()
);
create index if not exists api_request_log_client_idx on public.api_request_log (client_id, created_at desc);
alter table public.api_request_log enable row level security;

alter table public.messages add column if not exists reference text;
alter table public.messages add column if not exists api_key_id uuid references public.api_keys(id) on delete set null;
create index if not exists messages_reference_idx on public.messages (client_id, reference) where reference is not null;
create index if not exists messages_api_list_idx on public.messages (client_id, phone_number_id, direction, created_at desc, id desc);
alter table public.campaign_recipients add column if not exists reference text;
alter table public.campaigns add column if not exists source text not null default 'app';
alter table public.campaigns add column if not exists api_key_id uuid references public.api_keys(id) on delete set null;

-- One round trip: find the key, count this request against its rate limit, return its number's connection.
create or replace function public.api_auth(p_hash text)
returns table (
  key_id uuid, key_name text, client_id uuid, phone_number_id text, scopes text[], ip_allowlist text[],
  rate_limit integer, allowed boolean,
  business_name text, access_token_encrypted text, token_status text, verification_status text,
  display_name text, quality_rating text, messaging_limit_tier text
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare k api_keys%rowtype; cnt integer;
begin
  select * into k from api_keys where key_hash = p_hash and revoked_at is null;
  if not found then return; end if;

  insert into api_rate (key_id, sec, n) values (k.id, date_trunc('second', now()), 1)
  on conflict (key_id, sec) do update set n = api_rate.n + 1
  returning n into cnt;

  if k.last_used_at is null or k.last_used_at < now() - interval '1 minute' then
    update api_keys set last_used_at = now() where id = k.id;
  end if;

  return query
  select k.id, k.name, k.client_id, k.phone_number_id, k.scopes, k.ip_allowlist, k.rate_limit_per_sec, cnt <= k.rate_limit_per_sec,
         c.business_name, w.access_token_encrypted, w.token_status, w.verification_status,
         w.display_name, w.quality_rating, w.messaging_limit_tier
  from clients c
  left join whatsapp_accounts w on w.client_id = k.client_id and w.phone_number_id = k.phone_number_id
  where c.id = k.client_id;
end $$;

-- Idempotency: 'new' (go ahead), 'replay' (return the saved response), 'in_progress', 'mismatch'.
create or replace function public.api_idem_begin(p_key uuid, p_idem text, p_hash text)
returns table (state text, status integer, response jsonb)
language plpgsql security definer set search_path = public as $$
declare r api_idempotency%rowtype;
begin
  insert into api_idempotency (key_id, idem_key, request_hash) values (p_key, p_idem, p_hash)
  on conflict do nothing;
  if found then return query select 'new'::text, null::integer, null::jsonb; return; end if;
  select * into r from api_idempotency where key_id = p_key and idem_key = p_idem;
  if r.request_hash <> p_hash then return query select 'mismatch'::text, null::integer, null::jsonb;
  elsif r.response is null then return query select 'in_progress'::text, null::integer, null::jsonb;
  else return query select 'replay'::text, r.status, r.response; end if;
end $$;

create or replace function public.api_idem_finish(p_key uuid, p_idem text, p_status integer, p_response jsonb)
returns void language sql security definer set search_path = public as $$
  update api_idempotency set status = p_status, response = p_response where key_id = p_key and idem_key = p_idem;
$$;

create or replace function public.api_idem_release(p_key uuid, p_idem text)
returns void language sql security definer set search_path = public as $$
  delete from api_idempotency where key_id = p_key and idem_key = p_idem and response is null;
$$;

create or replace function public.cleanup_api()
returns void language sql security definer set search_path = public as $$
  delete from api_rate where sec < now() - interval '2 minutes';
  delete from api_idempotency where created_at < now() - interval '24 hours';
  delete from api_request_log where created_at < now() - interval '14 days';
$$;

-- Counts for one API batch (a campaign created through the API).
create or replace function public.api_batch_stats(p_client uuid, p_campaign uuid)
returns table (pending bigint, sent bigint, delivered bigint, read bigint, failed bigint, skipped bigint)
language sql stable security definer set search_path = public as $$
  select
    count(*) filter (where r.status in ('pending','sending')),
    count(*) filter (where r.status = 'sent' and coalesce(m.status,'sent') = 'sent'),
    count(*) filter (where m.status = 'delivered'),
    count(*) filter (where m.status = 'read'),
    count(*) filter (where r.status = 'failed' or m.status = 'failed'),
    count(*) filter (where r.status in ('skipped','cancelled'))
  from campaign_recipients r
  left join messages m on m.id = r.message_id
  where r.campaign_id = p_campaign and r.client_id = p_client;
$$;

-- ---------------------------------------------------------------- outbound webhooks
create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  url text not null,
  secret_encrypted text not null,
  events text[] not null default '{message.status,message.received}',
  phone_number_id text,                           -- null = all of the client's numbers
  active boolean not null default true,
  consecutive_failures integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists webhook_endpoints_client_idx on public.webhook_endpoints (client_id, active);
alter table public.webhook_endpoints enable row level security;

create table if not exists public.webhook_deliveries (
  id bigint generated always as identity primary key,
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','done','failed')),
  attempts integer not null default 0,
  last_error text,
  last_http_status integer,
  created_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  delivered_at timestamptz
);
create index if not exists webhook_deliveries_queue_idx on public.webhook_deliveries (status, next_attempt_at, id);
create index if not exists webhook_deliveries_client_idx on public.webhook_deliveries (client_id, id desc);
alter table public.webhook_deliveries enable row level security;

-- Queue one delivery per matching endpoint. Returns how many were queued.
create or replace function public.enqueue_client_event(p_client uuid, p_number text, p_type text, p_data jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into webhook_deliveries (endpoint_id, client_id, event_type, payload)
  select e.id, e.client_id, p_type,
         jsonb_build_object('type', p_type, 'created_at', now(), 'data', p_data)
  from webhook_endpoints e
  where e.client_id = p_client and e.active and p_type = any (e.events)
    and (e.phone_number_id is null or e.phone_number_id = p_number);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.claim_webhook_deliveries(p_limit integer)
returns setof public.webhook_deliveries
language plpgsql security definer set search_path = public as $$
begin
  update webhook_deliveries set status = 'pending' where status = 'processing' and locked_at < now() - interval '2 minutes';
  return query
  with picked as (
    select id from webhook_deliveries
    where status = 'pending' and next_attempt_at <= now()
    order by id limit p_limit
    for update skip locked
  )
  update webhook_deliveries d set status = 'processing', locked_at = now(), attempts = d.attempts + 1
  from picked where d.id = picked.id
  returning d.*;
end $$;

-- Retries after 1, 5, 30 and 120 minutes; the 5th failure parks it.
create or replace function public.finish_webhook_delivery(p_id bigint, p_http integer, p_error text)
returns table (parked boolean, endpoint_id uuid, client_id uuid, failures integer)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare d webhook_deliveries%rowtype; fails integer := 0; park boolean := false;
begin
  select * into d from webhook_deliveries where id = p_id;
  if not found then return; end if;
  if p_error is null then
    update webhook_deliveries set status = 'done', delivered_at = now(), last_http_status = p_http, last_error = null, locked_at = null where id = p_id;
    update webhook_endpoints set consecutive_failures = 0 where id = d.endpoint_id;
  else
    park := d.attempts >= 5;
    update webhook_deliveries set
      status = case when park then 'failed' else 'pending' end,
      last_http_status = p_http, last_error = left(p_error, 300), locked_at = null,
      next_attempt_at = now() + case d.attempts when 1 then interval '1 minute' when 2 then interval '5 minutes'
                                                when 3 then interval '30 minutes' else interval '120 minutes' end
    where id = p_id;
    if park then
      update webhook_endpoints set consecutive_failures = consecutive_failures + 1 where id = d.endpoint_id returning consecutive_failures into fails;
    end if;
  end if;
  return query select park, d.endpoint_id, d.client_id, fails;
end $$;

create or replace function public.cleanup_webhook_deliveries()
returns void language sql security definer set search_path = public as $$
  delete from webhook_deliveries where (status = 'done' and delivered_at < now() - interval '3 days')
                                    or (status = 'failed' and created_at < now() - interval '14 days');
$$;

revoke all on function
  public.api_auth(text), public.api_idem_begin(uuid, text, text), public.api_idem_finish(uuid, text, integer, jsonb),
  public.api_idem_release(uuid, text), public.cleanup_api(), public.api_batch_stats(uuid, uuid),
  public.enqueue_client_event(uuid, text, text, jsonb), public.claim_webhook_deliveries(integer),
  public.finish_webhook_delivery(bigint, integer, text), public.cleanup_webhook_deliveries()
  from public, anon, authenticated;
grant execute on function
  public.api_auth(text), public.api_idem_begin(uuid, text, text), public.api_idem_finish(uuid, text, integer, jsonb),
  public.api_idem_release(uuid, text), public.cleanup_api(), public.api_batch_stats(uuid, uuid),
  public.enqueue_client_event(uuid, text, text, jsonb), public.claim_webhook_deliveries(integer),
  public.finish_webhook_delivery(bigint, integer, text), public.cleanup_webhook_deliveries()
  to service_role;
