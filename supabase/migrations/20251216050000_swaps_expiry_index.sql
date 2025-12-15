begin;

create index if not exists idx_swaps_status_created_at on public.swaps (status, created_at);

commit;
