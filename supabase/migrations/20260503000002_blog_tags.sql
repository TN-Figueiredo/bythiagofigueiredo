create table public.blog_tags (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.sites(id) on delete cascade,
  name        text not null,
  slug        text not null,
  color       text not null default '#6366f1',
  color_dark  text,
  badge       text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint blog_tags_site_name_unique unique (site_id, name),
  constraint blog_tags_site_slug_unique unique (site_id, slug),
  constraint blog_tags_color_hex check (color ~ '^#[0-9a-fA-F]{6}$'),
  constraint blog_tags_color_dark_hex check (color_dark is null or color_dark ~ '^#[0-9a-fA-F]{6}$')
);

drop trigger if exists blog_tags_set_updated_at on public.blog_tags;
create trigger blog_tags_set_updated_at
  before update on public.blog_tags
  for each row execute function public.tg_set_updated_at();

alter table public.blog_tags enable row level security;

drop policy if exists "blog_tags_public_read" on public.blog_tags;
create policy "blog_tags_public_read" on public.blog_tags
  for select using (public.site_visible(site_id));

drop policy if exists "blog_tags_staff_all" on public.blog_tags;
create policy "blog_tags_staff_all" on public.blog_tags
  for all using (public.can_edit_site(site_id));

-- Add tag_id FK to blog_posts
alter table public.blog_posts
  add column if not exists tag_id uuid references public.blog_tags(id) on delete restrict;

create index if not exists blog_posts_tag_id_idx on public.blog_posts(tag_id);

-- Backfill: create tags from existing category values
with distinct_cats as (
  select distinct site_id, category
  from public.blog_posts
  where category is not null
)
insert into public.blog_tags (site_id, name, slug, color, sort_order)
select
  site_id,
  category,
  lower(replace(category, ' ', '-')),
  case category
    when 'Tech' then '#6366f1'
    when 'Vida' then '#22c55e'
    else '#9ca3af'
  end,
  row_number() over (partition by site_id order by category)
from distinct_cats
on conflict (site_id, name) do nothing;

-- Wire tag_id from category name
update public.blog_posts bp
set tag_id = bt.id
from public.blog_tags bt
where bt.site_id = bp.site_id
  and bt.name = bp.category
  and bp.category is not null
  and bp.tag_id is null;
