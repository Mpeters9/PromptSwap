-- Purchases: only buyer/seller can read; only service role can write/delete.
alter table public.purchases enable row level security;

drop policy if exists "Purchases buyers can select their rows" on public.purchases;
drop policy if exists "Purchases sellers can select their rows" on public.purchases;
drop policy if exists "Purchases inserts require service role" on public.purchases;

create policy "purchases select buyer_seller_or_service"
  on public.purchases for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id or auth.role() = 'service_role');

create policy "purchases insert service_only"
  on public.purchases for insert
  with check (auth.role() = 'service_role');

create policy "purchases update service_only"
  on public.purchases for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "purchases delete service_only"
  on public.purchases for delete
  using (auth.role() = 'service_role');

-- Prompt sales: mirror purchase protections.
alter table public.prompt_sales enable row level security;

drop policy if exists "prompt_sales select buyer" on public.prompt_sales;
drop policy if exists "prompt_sales select seller" on public.prompt_sales;

create policy "prompt_sales select buyer_seller_or_service"
  on public.prompt_sales for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id or auth.role() = 'service_role');

create policy "prompt_sales insert service_only"
  on public.prompt_sales for insert
  with check (auth.role() = 'service_role');

create policy "prompt_sales update service_only"
  on public.prompt_sales for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "prompt_sales delete service_only"
  on public.prompt_sales for delete
  using (auth.role() = 'service_role');

-- Payouts: only seller can read; service role manages writes/deletes.
alter table public.payouts enable row level security;

drop policy if exists "payouts select own" on public.payouts;
drop policy if exists "payouts select service" on public.payouts;
drop policy if exists "payouts insert service" on public.payouts;

create policy "payouts select seller_or_service"
  on public.payouts for select
  using (auth.uid() = seller_id or auth.role() = 'service_role');

create policy "payouts insert service_only"
  on public.payouts for insert
  with check (auth.role() = 'service_role');

create policy "payouts update service_only"
  on public.payouts for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "payouts delete service_only"
  on public.payouts for delete
  using (auth.role() = 'service_role');

-- Profiles: restrict reads to owner or service; writes to service.
alter table public.profiles enable row level security;

drop policy if exists "profiles select self_or_service" on public.profiles;
drop policy if exists "profiles update service_only" on public.profiles;
drop policy if exists "profiles insert service_only" on public.profiles;

create policy "profiles select self_or_service"
  on public.profiles for select
  using (auth.uid() = id or auth.role() = 'service_role');

create policy "profiles insert service_only"
  on public.profiles for insert
  with check (auth.role() = 'service_role');

create policy "profiles update service_only"
  on public.profiles for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
