-- Create purchases table to track prompt transactions.
create table public.purchases (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid not null references auth.users (id),
  seller_id uuid not null references auth.users (id),
  prompt_id uuid not null references public.prompts (id),
  price integer not null,
  created_at timestamp default now()
);

alter table public.purchases
  add constraint purchases_buyer_prompt_unique unique (buyer_id, prompt_id);

create index idx_purchases_buyer_id on public.purchases (buyer_id);
create index idx_purchases_seller_id on public.purchases (seller_id);
create index idx_purchases_prompt_id on public.purchases (prompt_id);

alter table public.purchases enable row level security;

create policy "Purchases buyers can select their rows"
  on public.purchases for select
  using (auth.uid() = buyer_id);

create policy "Purchases sellers can select their rows"
  on public.purchases for select
  using (auth.uid() = seller_id);

create policy "Purchases inserts require service role"
  on public.purchases for insert
  with check (auth.role() = 'service_role');
