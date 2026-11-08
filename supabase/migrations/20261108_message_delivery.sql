-- Delivery tracking for outbound messages: when each stage happened and,
-- for failures, Meta's error code and message.
alter table public.messages
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz,
  add column if not exists error_code text,
  add column if not exists error_message text;
