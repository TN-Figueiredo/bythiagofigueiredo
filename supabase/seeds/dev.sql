-- DEV SEED ONLY — do not run against production
-- Creates a local super_admin user with a known password and demo content.
-- Running this against prod would reset/overwrite real auth data.
--
-- IMPORTANT (2026-06-11): this seed must NOT truncate organizations/sites/
-- authors. The structural seed migration (20260507000003_seed.sql) creates the
-- master org/site (with short_domain), the default author, the `main-pt`
-- newsletter type, kill_switches, consent_texts, etc. A previous version of
-- this file truncated those tables CASCADE, silently wiping all of that and
-- breaking ~20 DB-gated integration tests. This seed now REUSES the structural
-- rows and only adds dev-only extras (auth user, membership, demo posts and
-- campaigns) idempotently.

do $$
declare
  v_user_id uuid := '00000000-0000-0000-0000-000000000001';
  v_author_id uuid;
  v_post1 uuid;
  v_post2 uuid;
  v_post3 uuid;
  v_org_id uuid;
  v_site_id uuid;
begin
  -- Bypass user-defined triggers (e.g. enforce_publish_permission from
  -- Sprint 4.75) for the duration of this seed. Seed runs as postgres
  -- superuser without an auth.uid(), so can_publish_site() would deny
  -- inserting rows with status='published'. Replica-mode fires only
  -- replica-enabled triggers, skipping our enforcement triggers.
  set local session_replication_role = 'replica';
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

  -- ============ master ring + site: REUSE the structural seed rows ============
  -- (created by migration 20260507000003_seed.sql; fallback inserts only run
  --  if the structural seed is somehow absent)
  select id into v_org_id from public.organizations where slug = 'figueiredo-tech';
  if v_org_id is null then
    insert into public.organizations (name, slug)
    values ('Figueiredo Technology', 'figueiredo-tech')
    returning id into v_org_id;
  end if;

  select id into v_site_id from public.sites where slug = 'bythiagofigueiredo';
  if v_site_id is null then
    insert into public.sites (org_id, name, slug, domains, primary_domain, default_locale, supported_locales)
    values (
      v_org_id,
      'ByThiagoFigueiredo',
      'bythiagofigueiredo',
      array['bythiagofigueiredo.com', 'www.bythiagofigueiredo.com'],
      'bythiagofigueiredo.com',
      'pt-BR',
      array['pt-BR','en']
    )
    returning id into v_site_id;
  end if;

  -- Local dev needs localhost in the site's domain list for middleware
  -- host→site resolution. Append once (idempotent).
  update public.sites
     set domains = domains || array['localhost', '127.0.0.1']
   where id = v_site_id
     and not (domains @> array['localhost']);

  update public.sites
     set contact_notification_email = coalesce(contact_notification_email, 'thiago@bythiagofigueiredo.com')
   where id = v_site_id;

  -- Sprint 4.75 RBAC v3: role check constraint only accepts 'org_admin'.
  insert into public.organization_members (org_id, user_id, role)
  values (v_org_id, v_user_id, 'org_admin')
  on conflict (org_id, user_id) do nothing;

  -- Dev author linked to the super_admin user. The structural seed already
  -- provides the site's default author (is_default=true, slug
  -- 'thiago-figueiredo') — this one is a separate non-default author.
  insert into public.authors (user_id, name, slug, bio_md, site_id)
  values (v_user_id, 'Thiago Figueiredo', 'thiago', 'Builder. Writer.', v_site_id)
  on conflict (site_id, slug) do update set user_id = excluded.user_id
  returning id into v_author_id;

  -- ============ demo blog posts (idempotent: delete-then-insert) ============
  -- Replica mode disables FK cascade triggers, so delete child rows first.
  delete from public.blog_posts
   where id in (
     select post_id from public.blog_translations
      where slug in ('primeiro-post', 'first-post', 'rascunho', 'agendado')
   );
  delete from public.blog_translations
   where slug in ('primeiro-post', 'first-post', 'rascunho', 'agendado');

  insert into public.blog_posts (author_id, status, published_at, site_id)
  values (v_author_id, 'published', now() - interval '1 day', v_site_id)
  returning id into v_post1;
  insert into public.blog_translations (post_id, locale, title, slug, excerpt, content_mdx)
  values
    (v_post1, 'pt-BR', 'Primeiro post', 'primeiro-post', 'Olá mundo', E'# Olá\n\nConteúdo pt-BR.'),
    (v_post1, 'en',    'First post',    'first-post',    'Hello world', E'# Hello\n\nEnglish content.');

  insert into public.blog_posts (author_id, status, site_id)
  values (v_author_id, 'draft', v_site_id)
  returning id into v_post2;
  insert into public.blog_translations (post_id, locale, title, slug, content_mdx)
  values (v_post2, 'pt-BR', 'Rascunho', 'rascunho', '# WIP');

  insert into public.blog_posts (author_id, status, scheduled_for, site_id)
  values (v_author_id, 'scheduled', now() + interval '7 days', v_site_id)
  returning id into v_post3;
  insert into public.blog_translations (post_id, locale, title, slug, content_mdx)
  values (v_post3, 'pt-BR', 'Agendado', 'agendado', '# Em breve');

  -- ============ Sprint 1b: campaigns seed ============

  -- Published campaign with pt-BR + en
  insert into campaigns (id, interest, status, published_at, pdf_storage_path, form_fields, site_id)
  values (
    '11111111-1111-1111-1111-111111111111',
    'creator',
    'published',
    now() - interval '1 day',
    'seed/creator-playbook.pdf',
    '[
      {"name":"name","label":"Nome","type":"name","required":true},
      {"name":"email","label":"E-mail","type":"email","required":true}
    ]'::jsonb,
    v_site_id
  )
  on conflict (id) do nothing;

  insert into campaign_translations (
    campaign_id, locale, slug, meta_title, meta_description,
    main_hook_md, supporting_argument_md, introductory_block_md, body_content_md,
    form_intro_md, form_button_label, form_button_loading_label,
    context_tag, success_headline, success_headline_duplicate,
    success_subheadline, success_subheadline_duplicate,
    check_mail_text, download_button_label
  ) values
  (
    '11111111-1111-1111-1111-111111111111', 'pt-BR', 'playbook-creator',
    'Playbook Creator — Thiago Figueiredo',
    'Guia gratuito para criadores de conteúdo',
    '# Transforme sua presença digital',
    'Argumento de suporte',
    'Bloco introdutório',
    'Conteúdo principal em markdown',
    'Preencha o formulário para receber',
    'Enviar', 'Enviando...',
    'Parabéns!', 'Tudo certo!', 'Você já estava na lista!',
    'Enviamos o PDF para o seu e-mail.', 'Você já tinha baixado antes.',
    'Verifique sua caixa (e spam).',
    'Baixar o playbook'
  ),
  (
    '11111111-1111-1111-1111-111111111111', 'en', 'creator-playbook',
    'Creator Playbook — Thiago Figueiredo',
    'Free guide for content creators',
    '# Transform your digital presence',
    'Supporting argument',
    'Intro block',
    'Main markdown body',
    'Fill the form below',
    'Submit', 'Sending...',
    'Welcome!', 'Hello again!', 'You were already on the list!',
    'We sent the PDF to your inbox.', 'You had already downloaded it.',
    'Check your inbox (and spam).',
    'Download the playbook'
  )
  on conflict (campaign_id, locale) do nothing;

  -- Draft campaign
  insert into campaigns (id, interest, status, form_fields, site_id)
  values (
    '22222222-2222-2222-2222-222222222222', 'fitness', 'draft', '[]'::jsonb, v_site_id
  ) on conflict (id) do nothing;

  insert into campaign_translations (
    campaign_id, locale, slug,
    main_hook_md, form_button_label, form_button_loading_label,
    context_tag, success_headline, success_headline_duplicate,
    success_subheadline, success_subheadline_duplicate,
    check_mail_text, download_button_label
  ) values (
    '22222222-2222-2222-2222-222222222222', 'pt-BR', 'rascunho-fitness',
    '# Em breve', 'Enviar', 'Enviando...',
    'Prévia', 'Obrigado!', 'Você já está!',
    'Em breve.', 'Em breve.',
    'Fique de olho.', 'Baixar'
  ) on conflict (campaign_id, locale) do nothing;

  -- Submissions (idempotent: delete-then-insert — id is generated, so
  -- on-conflict would not dedupe re-runs)
  delete from public.campaign_submissions
   where campaign_id = '11111111-1111-1111-1111-111111111111'
     and email in ('alice@example.com', 'bob@example.com', 'carol@example.com');

  insert into campaign_submissions
    (campaign_id, email, name, locale, consent_marketing, consent_text_version)
  values
    ('11111111-1111-1111-1111-111111111111', 'alice@example.com', 'Alice',
     'pt-BR', true, 'v1-2026-04'),
    ('11111111-1111-1111-1111-111111111111', 'bob@example.com', 'Bob',
     'pt-BR', true, 'v1-2026-04'),
    ('11111111-1111-1111-1111-111111111111', 'carol@example.com', 'Carol',
     'en', true, 'v1-2026-04');
end $$;
