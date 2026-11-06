alter table public.admin_access_log add column if not exists action text not null default 'view_chats';
alter table public.admin_access_log add column if not exists target_user_id uuid;
