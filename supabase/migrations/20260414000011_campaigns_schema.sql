-- campaigns: parent row (interest + media + brevo config), translations live in separate table
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  site_id uuid,
  interest text not null,
  status post_status not null default 'draft',
  pdf_storage_path text,
  brevo_list_id int,
  brevo_template_id int,
  form_fields jsonb not null default '[]',
  scheduled_for timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index on campaigns (status, published_at desc);
create index on campaigns (status, scheduled_for) where status = 'scheduled';

create trigger tg_campaigns_updated_at
  before update on campaigns
  for each row execute function tg_set_updated_at();

-- translations
create table campaign_translations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  locale text not null,

  meta_title text,
  meta_description text,
  og_image_url text,
  slug text not null,

  main_hook_md text not null,
  supporting_argument_md text,
  introductory_block_md text,
  body_content_md text,

  form_intro_md text,
  form_button_label text not null default 'Enviar',
  form_button_loading_label text not null default 'Enviando...',

  context_tag text not null,
  success_headline text not null,
  success_headline_duplicate text not null,
  success_subheadline text not null,
  success_subheadline_duplicate text not null,
  check_mail_text text not null,
  download_button_label text not null,

  extras jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index on campaign_translations (campaign_id, locale);
create unique index on campaign_translations (campaign_id, locale, slug);

create trigger tg_campaign_translations_updated_at
  before update on campaign_translations
  for each row execute function tg_set_updated_at();
