-- DEV SEED ONLY — do not run against production
-- Creates a local super_admin user with a known password and fixed UUIDs.
-- Running this against prod would reset/overwrite real auth data.

-- Idempotence: truncate all dev application tables in child-to-parent FK order
-- so this seed can be re-run cleanly. Sprint 1b tables (campaigns /
-- campaign_translations / campaign_submissions / cron_runs), Sprint 2
-- tables (organization_members / sites / organizations), Sprint 4.75 tables
-- (site_memberships / audit_log) and Sprint 5a tables (consents) are listed.
-- Future sprints: add new tables child-to-parent here.
--
-- auth.users is NOT truncated — a user-level seed cannot truncate the auth
-- schema, so it is handled via `on conflict (id) do update` below.
--
-- `restrict` (not `cascade`) is deliberate: if a future table grows an FK into
-- one of these and is not added here, the truncate will fail loudly with an FK
-- error instead of silently leaving stale rows behind and making the seed
-- non-idempotent.
--
-- On-conflict contract below:
--   * auth.users uses `on conflict (id) do update` — guarantees the row exists
--     after the statement.
--   * public.authors uses `on conflict (slug) do update ... returning id` —
--     guarantees `v_author_id` is populated.
--   If either is ever switched to `on conflict do nothing`, `returning id` may
--   yield no row and `v_author_id` can end up NULL; in that case a fallback
--   `select id into v_author_id from public.authors where slug = 'thiago'`
--   must be re-introduced after the authors insert.
truncate table
  public.sent_emails,
  public.unsubscribe_tokens,
  public.newsletter_subscriptions,
  public.contact_submissions,
  public.invitations,
  public.campaign_submissions,
  public.campaign_translations,
  public.campaigns,
  public.cron_runs,
  public.blog_translations,
  public.blog_posts,
  public.authors,
  public.audit_log,
  public.consents,
  public.site_memberships,
  public.organization_members,
  public.sites,
  public.organizations
restrict;

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

  -- ============ Sprint 2: master ring + site ============
  insert into public.organizations (name, slug)
  values ('Figueiredo Technology', 'figueiredo-tech')
  returning id into v_org_id;

  insert into public.sites (org_id, name, slug, domains, primary_domain, default_locale, supported_locales)
  values (
    v_org_id,
    'ByThiagoFigueiredo',
    'bythiagofigueiredo',
    array['bythiagofigueiredo.com', 'www.bythiagofigueiredo.com', 'localhost', '127.0.0.1'],
    'bythiagofigueiredo.com',
    'pt-BR',
    array['pt-BR','en']
  )
  returning id into v_site_id;

  update public.sites
  set contact_notification_email = 'thiago@bythiagofigueiredo.com'
  where id = v_site_id;

  -- Sprint 4.75 RBAC v3: role check constraint only accepts 'org_admin'
  -- (legacy 'owner'/'admin' were migrated by 20260420000001_rbac_v3_schema).
  insert into public.organization_members (org_id, user_id, role)
  values (v_org_id, v_user_id, 'org_admin');

  -- After truncate this insert always succeeds; `on conflict` kept as a cheap
  -- defensive guard in case another author insert is added above this one later.
  insert into public.authors (user_id, name, slug, bio_md)
  values (v_user_id, 'Thiago Figueiredo', 'thiago', 'Builder. Writer.')
  on conflict (slug) do update set user_id = excluded.user_id
  returning id into v_author_id;

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
  on conflict do nothing;

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
  ) on conflict do nothing;

  -- Submissions
  insert into campaign_submissions
    (campaign_id, email, name, locale, consent_marketing, consent_text_version)
  values
    ('11111111-1111-1111-1111-111111111111', 'alice@example.com', 'Alice',
     'pt-BR', true, 'v1-2026-04'),
    ('11111111-1111-1111-1111-111111111111', 'bob@example.com', 'Bob',
     'pt-BR', true, 'v1-2026-04'),
    ('11111111-1111-1111-1111-111111111111', 'carol@example.com', 'Carol',
     'en', true, 'v1-2026-04')
  on conflict do nothing;
end $$;
