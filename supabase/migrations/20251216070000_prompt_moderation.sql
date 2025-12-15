begin;

alter table public.prompts add column if not exists status text not null default 'draft';
alter table public.prompts drop constraint if exists prompts_status_check;
alter table public.prompts
  add constraint prompts_status_check check (status in ('draft','submitted','approved','rejected','archived'));
alter table public.prompts add column if not exists moderation_note text;
create index if not exists idx_prompts_status on public.prompts (status);

create table if not exists public.moderation_actions (
  id uuid not null default gen_random_uuid(),
  prompt_id int not null references public.prompts(id) on delete cascade,
  admin_id uuid not null references public.profiles(id),
  action text not null,
  reason text,
  created_at timestamptz not null default now(),
  primary key (id)
);
create index if not exists idx_moderation_actions_prompt_id on public.moderation_actions (prompt_id);
create index if not exists idx_moderation_actions_admin_id on public.moderation_actions (admin_id);

create table if not exists public.rate_limits (
  key text primary key,
  count int not null default 0,
  expires_at timestamptz not null
);
create index if not exists idx_rate_limits_expires_at on public.rate_limits (expires_at);

commit;
