-- Full-text search and indexing for prompts
begin;

alter table public.prompts
  add column if not exists search_vector tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      array_to_string(tags, ' ')
    )
  ) stored;

create index if not exists idx_prompts_search_vector on public.prompts using gin (search_vector);
create index if not exists idx_prompts_is_public_created_at on public.prompts (is_public, created_at desc);
create index if not exists idx_prompts_price on public.prompts (price);
create index if not exists idx_prompts_likes_desc on public.prompts (likes desc);

commit;
