-- Track processed Stripe events to ensure idempotency.
create table if not exists public.stripe_events (
  event_id text primary key,
  type text,
  created_at timestamptz default now()
);

alter table public.stripe_events enable row level security;

create policy "stripe_events insert service role"
  on public.stripe_events for insert
  with check (auth.role() = 'service_role');

create policy "stripe_events select service role"
  on public.stripe_events for select
  using (auth.role() = 'service_role');

-- Record payouts issued to sellers.
create table if not exists public.payouts (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references auth.users (id),
  amount numeric(10,2) not null,
  currency text default 'usd',
  stripe_transfer_id text,
  destination_account text,
  created_at timestamptz default now()
);

create unique index if not exists idx_payouts_transfer_id on public.payouts (stripe_transfer_id);
create index if not exists idx_payouts_seller_id on public.payouts (seller_id);

alter table public.payouts enable row level security;

create policy "payouts select own"
  on public.payouts for select
  using (auth.uid() = seller_id);

create policy "payouts insert service role"
  on public.payouts for insert
  with check (auth.role() = 'service_role');
