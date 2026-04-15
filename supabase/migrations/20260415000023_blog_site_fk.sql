-- Add FK on blog_posts.site_id → sites.id.
-- Kept NULLABLE intentionally: NOT NULL enforcement comes in a later migration
-- after the seed (Task 6) backfills site_id for all existing rows.
alter table public.blog_posts
  add constraint blog_posts_site_id_fkey
  foreign key (site_id) references public.sites(id) on delete restrict;
