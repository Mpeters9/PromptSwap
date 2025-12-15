-- Notifications table with RLS
begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_read_created on public.notifications (user_id, is_read, created_at desc);
create index if not exists idx_notifications_user_created on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy if not exists notifications_select_owner_admin_service
  on public.notifications for select
  using (
    auth.uid() = user_id
    or auth.role() = 'service_role'
    or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true)
  );

create policy if not exists notifications_insert_owner_admin_service
  on public.notifications for insert
  with check (
    auth.uid() = user_id
    or auth.role() = 'service_role'
    or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true)
  );

create policy if not exists notifications_update_owner_admin_service
  on public.notifications for update
  using (
    auth.uid() = user_id
    or auth.role() = 'service_role'
    or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true)
  )
  with check (
    auth.uid() = user_id
    or auth.role() = 'service_role'
    or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true)
  );

commit;
