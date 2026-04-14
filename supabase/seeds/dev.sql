-- DEV SEED ONLY — do not run against production
-- Creates a local super_admin user with a known password and fixed UUIDs.
-- Running this against prod would reset/overwrite real auth data.

-- Idempotence: truncate all dev application tables in FK-safe order.
-- `cascade` auto-truncates any future tables with FKs into these (e.g. Sprint 1b
-- campaigns, campaign_translations, campaign_submissions referencing authors) —
-- so no extra lines are needed here when new tables land.
-- Note: auth.users is handled via `on conflict do update` below because we can't
-- truncate the auth schema from a user-level seed.
truncate table
  public.blog_translations,
  public.blog_posts,
  public.authors
restart identity cascade;

do $$
declare
  v_user_id uuid := '00000000-0000-0000-0000-000000000001';
  v_author_id uuid;
  v_post1 uuid;
  v_post2 uuid;
  v_post3 uuid;
begin
  insert into auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token,
    email_change, email_change_token_new, recovery_token
  )
  values (
    v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'thiago@bythiagofigueiredo.com',
    crypt('dev-password-123', gen_salt('bf')),
    now(),
    jsonb_build_object('role','super_admin','provider','email','providers',jsonb_build_array('email')),
    '{}'::jsonb,
    now(), now(), '', '', '', ''
  )
  on conflict (id) do update set
    raw_app_meta_data = excluded.raw_app_meta_data;

  -- After truncate this insert always succeeds; `on conflict` kept as a cheap
  -- defensive guard in case another author insert is added above this one later.
  insert into public.authors (user_id, name, slug, bio_md)
  values (v_user_id, 'Thiago Figueiredo', 'thiago', 'Builder. Writer.')
  on conflict (slug) do update set user_id = excluded.user_id
  returning id into v_author_id;

  insert into public.blog_posts (author_id, status, published_at)
  values (v_author_id, 'published', now() - interval '1 day')
  returning id into v_post1;
  insert into public.blog_translations (post_id, locale, title, slug, excerpt, content_md)
  values
    (v_post1, 'pt-BR', 'Primeiro post', 'primeiro-post', 'Olá mundo', '# Olá\n\nConteúdo pt-BR.'),
    (v_post1, 'en',    'First post',    'first-post',    'Hello world', '# Hello\n\nEnglish content.');

  insert into public.blog_posts (author_id, status)
  values (v_author_id, 'draft')
  returning id into v_post2;
  insert into public.blog_translations (post_id, locale, title, slug, content_md)
  values (v_post2, 'pt-BR', 'Rascunho', 'rascunho', '# WIP');

  insert into public.blog_posts (author_id, status, scheduled_for)
  values (v_author_id, 'scheduled', now() + interval '7 days')
  returning id into v_post3;
  insert into public.blog_translations (post_id, locale, title, slug, content_md)
  values (v_post3, 'pt-BR', 'Agendado', 'agendado', '# Em breve');
end $$;
