-- Enable RLS and policies for prompts
alter table public.prompts enable row level security;

create policy "prompts select public_or_owner_or_service"
  on public.prompts for select
  using (is_public = true or auth.uid() = user_id or auth.role() = 'service_role');

create policy "prompts insert owner_or_service"
  on public.prompts for insert
  with check (auth.uid() = user_id or auth.role() = 'service_role');

create policy "prompts update owner_or_service"
  on public.prompts for update
  using (auth.uid() = user_id or auth.role() = 'service_role');

create policy "prompts delete owner_or_service"
  on public.prompts for delete
  using (auth.uid() = user_id or auth.role() = 'service_role');

-- Profiles (credits) - restrict to owner or service role
alter table public.profiles enable row level security;

create policy "profiles select self_or_service"
  on public.profiles for select
  using (auth.uid() = id or auth.role() = 'service_role');

create policy "profiles update service_only"
  on public.profiles for update
  using (auth.role() = 'service_role');

create policy "profiles insert service_only"
  on public.profiles for insert
  with check (auth.role() = 'service_role');

-- Payouts: allow sellers to view their payouts; service role manage
alter table public.payouts enable row level security;

create policy "payouts select self"
  on public.payouts for select
  using (auth.uid() = seller_id);

create policy "payouts select service"
  on public.payouts for select
  using (auth.role() = 'service_role');

create policy "payouts insert service"
  on public.payouts for insert
  with check (auth.role() = 'service_role');
