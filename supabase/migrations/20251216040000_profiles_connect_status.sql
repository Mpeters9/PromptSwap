-- Stripe Connect status fields on profiles
begin;

alter table public.profiles
  add column if not exists connected_account_id text,
  add column if not exists stripe_charges_enabled boolean default false,
  add column if not exists stripe_payouts_enabled boolean default false,
  add column if not exists stripe_account_status text;

create index if not exists idx_profiles_stripe_account_id on public.profiles (stripe_account_id);

commit;
