create or replace function public.validate_translation_slug_unique_per_site()
returns trigger
language plpgsql
as $$
declare
  v_site_id uuid;
  v_conflict int;
begin
  select site_id into v_site_id from public.blog_posts where id = new.post_id;

  select 1 into v_conflict
  from public.blog_translations bt
  join public.blog_posts bp on bp.id = bt.post_id
  where bt.locale = new.locale
    and bt.slug = new.slug
    and bt.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and bp.site_id is not distinct from v_site_id
  limit 1;

  if v_conflict is not null then
    raise exception 'duplicate slug % for locale % on site %', new.slug, new.locale, v_site_id
      using errcode = '23505';
  end if;

  return new;
end
$$;

create trigger blog_translations_validate_slug
before insert or update on public.blog_translations
for each row execute function public.validate_translation_slug_unique_per_site();
