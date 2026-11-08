-- Aggregates for the platform admin report. Callable only with the service role.
create or replace function public.platform_message_report(p_from timestamptz, p_to timestamptz)
returns table (client_id uuid, sent bigint, delivered bigint, read bigint, failed bigint, received bigint, last_activity timestamptz)
language sql stable set search_path = public as $$
  select m.client_id,
    count(*) filter (where m.direction = 'outbound'),
    count(*) filter (where m.direction = 'outbound' and m.status in ('delivered','read')),
    count(*) filter (where m.direction = 'outbound' and m.status = 'read'),
    count(*) filter (where m.direction = 'outbound' and m.status = 'failed'),
    count(*) filter (where m.direction = 'inbound'),
    max(m.created_at)
  from public.messages m
  where m.created_at >= p_from and m.created_at <= p_to
  group by m.client_id
$$;

create or replace function public.platform_failure_reasons(p_from timestamptz, p_to timestamptz)
returns table (error_code text, error_message text, n bigint)
language sql stable set search_path = public as $$
  select m.error_code, min(m.error_message), count(*)
  from public.messages m
  where m.direction = 'outbound' and m.status = 'failed'
    and m.created_at >= p_from and m.created_at <= p_to
  group by m.error_code
  order by count(*) desc
  limit 10
$$;

revoke execute on function public.platform_message_report(timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.platform_failure_reasons(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.platform_message_report(timestamptz, timestamptz) to service_role;
grant execute on function public.platform_failure_reasons(timestamptz, timestamptz) to service_role;
