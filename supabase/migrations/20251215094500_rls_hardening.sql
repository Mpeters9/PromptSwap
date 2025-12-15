-- RLS hardening and least-privilege policies
begin;

-- Helper for admin detection: coalesce(is_admin,false)
-- Profiles
alter table public.profiles enable row level security;

create policy if not exists profiles_select_self_admin_service
  on public.profiles for select
  using (
    auth.uid() = id
    or auth.role() = 'service_role'
    or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true)
  );

create policy if not exists profiles_update_self_admin_service
  on public.profiles for update
  using (
    auth.uid() = id
    or auth.role() = 'service_role'
    or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true)
  )
  with check (
    auth.uid() = id
    or auth.role() = 'service_role'
    or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true)
  );

-- Prompts (keep existing select/owner policies, add admin override)
create policy if not exists prompts_admin_manage
  on public.prompts for all
  using (exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true) or auth.role() = 'service_role')
  with check (exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true) or auth.role() = 'service_role');

-- Prompt versions
alter table public.prompt_versions enable row level security;
create policy if not exists prompt_versions_select
  on public.prompt_versions for select
  using (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or exists(select 1 from public.prompts p where p.id = prompt_id and (p.user_id = auth.uid() or p.is_public = true))
    or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true)
  );
create policy if not exists prompt_versions_modify_self
  on public.prompt_versions for all
  using (auth.uid() = user_id or auth.role() = 'service_role' or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true))
  with check (auth.uid() = user_id or auth.role() = 'service_role' or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true));

-- Swaps
alter table public.swaps enable row level security;
create policy if not exists swaps_select_participants
  on public.swaps for select
  using (
    auth.role() = 'service_role'
    or requester_id = auth.uid()
    or responder_id = auth.uid()
    or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true)
  );
create policy if not exists swaps_modify_participants
  on public.swaps for all
  using (
    auth.role() = 'service_role'
    or requester_id = auth.uid()
    or responder_id = auth.uid()
    or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true)
  )
  with check (
    auth.role() = 'service_role'
    or requester_id = auth.uid()
    or responder_id = auth.uid()
    or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true)
  );

-- Prompt comments
alter table public.prompt_comments enable row level security;
create policy if not exists prompt_comments_select
  on public.prompt_comments for select
  using (
    auth.role() = 'service_role'
    or exists(select 1 from public.prompts p where p.id = prompt_comments.prompt_id and (p.is_public = true or p.user_id = auth.uid()))
    or user_id = auth.uid()
    or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true)
  );
create policy if not exists prompt_comments_insert_owner
  on public.prompt_comments for insert
  with check (auth.uid() = user_id or auth.role() = 'service_role');
create policy if not exists prompt_comments_update_owner_admin
  on public.prompt_comments for update
  using (auth.uid() = user_id or auth.role() = 'service_role' or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true))
  with check (auth.uid() = user_id or auth.role() = 'service_role' or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true));
create policy if not exists prompt_comments_delete_owner_admin
  on public.prompt_comments for delete
  using (auth.uid() = user_id or auth.role() = 'service_role' or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true));

-- Ratings
alter table public.prompt_ratings enable row level security;
create policy if not exists prompt_ratings_select
  on public.prompt_ratings for select
  using (
    auth.role() = 'service_role'
    or user_id = auth.uid()
    or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true)
    or exists(select 1 from public.prompts p where p.id = prompt_ratings.prompt_id and p.is_public = true)
  );
create policy if not exists prompt_ratings_insert_owner
  on public.prompt_ratings for insert
  with check (auth.uid() = user_id or auth.role() = 'service_role');
create policy if not exists prompt_ratings_update_owner_admin
  on public.prompt_ratings for update
  using (auth.uid() = user_id or auth.role() = 'service_role' or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true))
  with check (auth.uid() = user_id or auth.role() = 'service_role' or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true));
create policy if not exists prompt_ratings_delete_owner_admin
  on public.prompt_ratings for delete
  using (auth.uid() = user_id or auth.role() = 'service_role' or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true));

-- Purchases (service/admin write; buyer/seller read already exists)
create policy if not exists purchases_admin_select
  on public.purchases for select
  using (auth.role() = 'service_role' or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true));

-- Refund requests
alter table public.refund_requests enable row level security;
create policy if not exists refund_requests_select
  on public.refund_requests for select
  using (
    requester_user_id = auth.uid()
    or auth.role() = 'service_role'
    or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true)
  );
create policy if not exists refund_requests_insert_buyer
  on public.refund_requests for insert
  with check (requester_user_id = auth.uid() or auth.role() = 'service_role');
create policy if not exists refund_requests_update_admin
  on public.refund_requests for update
  using (auth.role() = 'service_role' or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true))
  with check (auth.role() = 'service_role' or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true));

-- Refunds
alter table public.refunds enable row level security;
create policy if not exists refunds_select_parties
  on public.refunds for select
  using (
    auth.role() = 'service_role'
    or exists(select 1 from public.purchases p where p.id = refunds.purchase_id and (p.buyer_id = auth.uid() or p.seller_id = auth.uid()))
    or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true)
  );
create policy if not exists refunds_write_service_admin
  on public.refunds for all
  using (auth.role() = 'service_role' or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true))
  with check (auth.role() = 'service_role' or exists(select 1 from public.profiles ap where ap.id = auth.uid() and coalesce(ap.is_admin,false) = true));

-- Stripe events locked down
alter table public.stripe_events enable row level security;
create policy if not exists stripe_events_service_only
  on public.stripe_events for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

commit;
