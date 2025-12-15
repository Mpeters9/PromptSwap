begin;

create table if not exists public.system_events (
  id uuid not null default gen_random_uuid(),
  request_id text not null,
  type text not null,
  payload_summary jsonb,
  error_message text not null,
  context text,
  created_at timestamptz not null default now(),
  primary key (id)
);
create index if not exists idx_system_events_created_at on public.system_events (created_at desc);
create index if not exists idx_system_events_type on public.system_events (type);

commit;
