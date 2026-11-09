-- One round trip for "who is this user": client row + connected numbers.
create or replace function public.session_context(p_user uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'client_id', c.id,
    'client', to_jsonb(c),
    'accounts', coalesce((select jsonb_agg(to_jsonb(a) order by a.connected_at) from whatsapp_accounts a where a.client_id = c.id), '[]'::jsonb)
  )
  from app_users u join clients c on c.id = u.client_id
  where u.user_id = p_user
  limit 1;
$$;

-- Dashboard numbers computed in the database instead of loading every message.
create or replace function public.dashboard_counts(p_client uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', count(*),
    'sent', count(*) filter (where direction = 'outbound'),
    'conversations', count(distinct case when direction = 'inbound' then from_number else to_number end)
  ) from messages where client_id = p_client;
$$;

create index if not exists messages_client_idx on public.messages (client_id, created_at desc);

revoke all on function public.session_context(uuid), public.dashboard_counts(uuid) from public, anon, authenticated;
grant execute on function public.session_context(uuid), public.dashboard_counts(uuid) to service_role;
