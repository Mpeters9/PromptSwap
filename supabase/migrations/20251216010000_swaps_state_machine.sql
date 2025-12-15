-- Enforce swap state machine statuses and normalize existing rows
begin;

-- Normalize legacy statuses
update public.swaps set status = 'requested' where status is null or status = 'pending';

-- Status check constraint
alter table public.swaps drop constraint if exists swaps_status_check;
alter table public.swaps
  add constraint swaps_status_check check (status in ('requested','accepted','declined','fulfilled','cancelled','expired'));

alter table public.swaps alter column status set default 'requested';

commit;
