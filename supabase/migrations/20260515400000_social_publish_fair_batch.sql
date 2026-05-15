-- Fair-scheduling RPC: round-robin across sites to prevent starvation
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
    select sp.*,
      row_number() over (partition by sp.site_id order by sp.scheduled_at asc) as rn
    from social_posts sp
    where sp.status = 'scheduled'
      and sp.scheduled_at <= window_end
  )
  select id, site_id, created_by, type, status, scheduled_at,
         user_timezone, published_at, content, template_id, idempotency_key,
         created_at, updated_at, source_content_type, source_content_id,
         origin, short_link_id, pipeline_steps, source_pipeline_id,
         pipeline_snapshot, graduated_at
  from ranked
  order by rn asc, scheduled_at asc
  limit batch_size;
$$;
