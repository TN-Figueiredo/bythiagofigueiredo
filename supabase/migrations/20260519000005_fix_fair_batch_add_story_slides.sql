-- Fix social_publish_fair_batch: add story_slides and source_locale columns
-- that were added by 20260518000007 after the RPC was created.

drop function if exists public.social_publish_fair_batch(timestamptz, int);

create or replace function public.social_publish_fair_batch(
  window_end timestamptz,
  batch_size int default 10
)
returns setof social_posts
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select sp.id as post_id,
      row_number() over (partition by sp.site_id order by sp.scheduled_at asc) as rn
    from social_posts sp
    where sp.status = 'scheduled'
      and sp.scheduled_at <= window_end
  )
  select sp.*
  from ranked r
  join social_posts sp on sp.id = r.post_id
  order by r.rn asc, sp.scheduled_at asc
  limit batch_size;
$$;
