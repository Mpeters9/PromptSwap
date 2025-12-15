-- Harden Stripe webhook persistence and refund tracking
begin;

-- Purchases: allow nullable Stripe IDs, enforce uniqueness, normalize statuses, and store amounts in cents
alter table public.purchases
  alter column stripe_checkout_session_id drop not null,
  alter column stripe_payment_intent_id drop not null;

do $$ begin
  alter table public.purchases add constraint purchases_stripe_checkout_session_uidx unique (stripe_checkout_session_id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.purchases add constraint purchases_stripe_payment_intent_uidx unique (stripe_payment_intent_id);
exception when duplicate_object then null; end $$;

-- Normalize purchase statuses
alter table public.purchases drop constraint if exists purchases_status_check;
update public.purchases set status = 'paid' where status = 'completed';
alter table public.purchases
  alter column status type text,
  alter column status set default 'pending';
alter table public.purchases
  add constraint purchases_status_check check (status in ('pending', 'paid', 'partially_refunded', 'refunded', 'failed', 'disputed'));

-- Store totals/refunds in smallest unit (cents)
alter table public.purchases alter column amount_total drop default;
alter table public.purchases alter column refunded_amount drop default;

alter table public.purchases
  alter column amount_total type integer using coalesce(round(amount_total * 100), 0)::integer,
  alter column refunded_amount type integer using coalesce(round(refunded_amount * 100), 0)::integer;

alter table public.purchases
  alter column amount_total set default 0,
  alter column amount_total set not null,
  alter column refunded_amount set default 0,
  alter column refunded_amount set not null;

update public.purchases
set amount_total = coalesce(amount_total, 0)
where amount_total is null;

-- Stripe events: retain minimal payload and Stripe event timestamp
alter table public.stripe_events
  add column if not exists payload jsonb,
  add column if not exists stripe_created_at timestamptz;

-- Refund requests: rename requester column, align statuses, and keep amounts in cents
alter table public.refund_requests
  rename column user_id to requester_user_id;

alter table public.refund_requests drop constraint if exists refund_requests_status_check;
update public.refund_requests set status = 'open' where status in ('pending', 'processing');
update public.refund_requests set status = 'approved' where status = 'approved';
update public.refund_requests set status = 'denied' where status = 'rejected';
update public.refund_requests set status = 'closed' where status = 'completed';

alter table public.refund_requests
  alter column status type text,
  alter column status set default 'open';
alter table public.refund_requests
  add constraint refund_requests_status_check check (status in ('open', 'approved', 'denied', 'closed'));

alter table public.refund_requests
  alter column requested_amount type integer using case when requested_amount is null then null else round(requested_amount * 100)::integer end,
  alter column final_amount type integer using case when final_amount is null then null else round(final_amount * 100)::integer end;

create unique index if not exists refund_requests_open_purchase_idx
  on public.refund_requests (purchase_id) where status = 'open';

-- Refunds: store amounts in cents
alter table public.refunds
  alter column amount type integer using round(amount * 100)::integer;

commit;
