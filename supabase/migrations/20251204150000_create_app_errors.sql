-- Error log table
create table if not exists public.app_errors (
  id uuid primary key default uuid_generate_v4(),
  message text not null,
  stack text,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table public.app_errors enable row level security;

create policy "app_errors insert service"
  on public.app_errors for insert
  with check (auth.role() = 'service_role');

create policy "app_errors select service"
  on public.app_errors for select
  using (auth.role() = 'service_role');
