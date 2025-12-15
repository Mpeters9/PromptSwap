-- Ensure profiles has is_admin boolean with default false
alter table if exists public.profiles
  add column if not exists is_admin boolean default false;

update public.profiles set is_admin = coalesce(is_admin, false);
