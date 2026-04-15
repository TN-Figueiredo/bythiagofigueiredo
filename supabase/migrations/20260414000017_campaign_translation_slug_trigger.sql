-- Replace the redundant (campaign_id, locale, slug) unique index with a
-- trigger-based (site_id, locale, slug) uniqueness check — mirrors the
-- blog_translations pattern in migration 20260414000006. Routing at
-- /campaigns/[locale]/[slug] requires no two campaigns on the same site
-- share a (locale, slug) translation.

-- Find the auto-generated index name and drop it. The migration that
-- created it used an unnamed CREATE UNIQUE INDEX, so its name is
-- campaign_translations_campaign_id_locale_slug_idx.
drop index if exists public.campaign_translations_campaign_id_locale_slug_idx;

create or replace function public.validate_campaign_translation_slug_unique_per_site()
returns trigger
language plpgsql
as $$
declare
  v_site_id uuid;
  v_conflict int;
begin
  select site_id into v_site_id from public.campaigns where id = new.campaign_id;

  select 1 into v_conflict
  from public.campaign_translations ct
  join public.campaigns c on c.id = ct.campaign_id
  where ct.locale = new.locale
    and ct.slug = new.slug
    and ct.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and c.site_id is not distinct from v_site_id
  limit 1;

  if v_conflict is not null then
    raise exception 'duplicate slug % for locale % on site %', new.slug, new.locale, v_site_id
      using errcode = '23505';
  end if;

  return new;
end
$$;

create trigger campaign_translations_validate_slug
before insert or update on public.campaign_translations
for each row execute function public.validate_campaign_translation_slug_unique_per_site();
