-- Feedback: link tap-to-answer replies to the message they answer, and summarise them.
alter table public.messages
  add column if not exists reply_to_wa_id text,
  add column if not exists button_payload text;
create index if not exists messages_reply_to_idx on public.messages (client_id, reply_to_wa_id) where reply_to_wa_id is not null;

-- Per template and campaign: how many were sent/delivered and how many people chose each answer.
create or replace function public.feedback_summary(p_client uuid, p_from timestamptz, p_to timestamptz)
returns table (template_name text, campaign_id uuid, campaign_name text, sent bigint, delivered bigint, answer text, answers bigint)
language sql stable security definer set search_path = public as $$
  with sent as (
    select o.template_name, o.campaign_id,
           count(*) filter (where o.status <> 'failed') as sent,
           count(*) filter (where o.status in ('delivered','read')) as delivered
    from messages o
    where o.client_id = p_client and o.direction = 'outbound' and o.message_type = 'template'
      and o.created_at >= p_from and o.created_at < p_to
      and exists (select 1 from templates t where t.client_id = o.client_id and t.name = o.template_name and t.buttons::text like '%QUICK_REPLY%')
    group by o.template_name, o.campaign_id
  ),
  ans as (
    select o.template_name, o.campaign_id, r.body as answer, count(*) as n
    from messages r
    join messages o on o.client_id = r.client_id and o.wa_message_id = r.reply_to_wa_id
    where r.client_id = p_client and r.direction = 'inbound' and r.reply_to_wa_id is not null
      and r.message_type in ('button','interactive') and r.body is not null
      and o.message_type = 'template' and o.created_at >= p_from and o.created_at < p_to
    group by o.template_name, o.campaign_id, r.body
  )
  select coalesce(s.template_name, a.template_name), coalesce(s.campaign_id, a.campaign_id), c.name,
         coalesce(s.sent, 0), coalesce(s.delivered, 0), a.answer, coalesce(a.n, 0)
  from sent s
  full join ans a on a.template_name = s.template_name and a.campaign_id is not distinct from s.campaign_id
  left join campaigns c on c.id = coalesce(s.campaign_id, a.campaign_id);
$$;

-- Individual answers, newest first.
create or replace function public.feedback_responses(
  p_client uuid, p_from timestamptz, p_to timestamptz, p_limit integer, p_offset integer
) returns table (
  replied_at timestamptz, customer text, customer_name text, answer text,
  template_name text, campaign_name text, total bigint
)
language sql stable security definer set search_path = public as $$
  select r.created_at, r.from_number, r.contact_name, r.body, o.template_name, c.name, count(*) over ()
  from messages r
  join messages o on o.client_id = r.client_id and o.wa_message_id = r.reply_to_wa_id
  left join campaigns c on c.id = o.campaign_id
  where r.client_id = p_client and r.direction = 'inbound' and r.reply_to_wa_id is not null
    and r.message_type in ('button','interactive') and r.body is not null
    and o.message_type = 'template' and r.created_at >= p_from and r.created_at < p_to
  order by r.created_at desc
  limit p_limit offset p_offset;
$$;

revoke all on function public.feedback_summary(uuid, timestamptz, timestamptz), public.feedback_responses(uuid, timestamptz, timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.feedback_summary(uuid, timestamptz, timestamptz), public.feedback_responses(uuid, timestamptz, timestamptz, integer, integer) to service_role;
