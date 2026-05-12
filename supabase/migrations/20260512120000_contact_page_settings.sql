BEGIN;

-- contact_page_settings (per-site, per-locale)
CREATE TABLE IF NOT EXISTS public.contact_page_settings (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id            uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  locale             text        NOT NULL,
  hero_title         text        NOT NULL DEFAULT '',
  hero_subtitle      text        DEFAULT '',
  response_time_text text        DEFAULT '',
  form_title         text        DEFAULT '',
  auto_reply_text    text        DEFAULT '',
  subject_options    jsonb       DEFAULT '[]'::jsonb,
  faq_items          jsonb       DEFAULT '[]'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, locale),
  CONSTRAINT cps_hero_title_len CHECK (char_length(hero_title) <= 80),
  CONSTRAINT cps_hero_subtitle_len CHECK (char_length(hero_subtitle) <= 300),
  CONSTRAINT cps_response_time_len CHECK (char_length(response_time_text) <= 100),
  CONSTRAINT cps_form_title_len CHECK (char_length(form_title) <= 100),
  CONSTRAINT cps_auto_reply_len CHECK (char_length(auto_reply_text) <= 500),
  CONSTRAINT cps_subject_options_arr CHECK (subject_options IS NULL OR jsonb_typeof(subject_options) = 'array'),
  CONSTRAINT cps_faq_items_arr CHECK (faq_items IS NULL OR jsonb_typeof(faq_items) = 'array')
);

ALTER TABLE public.contact_page_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cps_public_read" ON public.contact_page_settings;
CREATE POLICY "cps_public_read" ON public.contact_page_settings FOR SELECT USING (public.site_visible(site_id));

DROP POLICY IF EXISTS "cps_staff_insert" ON public.contact_page_settings;
CREATE POLICY "cps_staff_insert" ON public.contact_page_settings FOR INSERT TO authenticated WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "cps_staff_update" ON public.contact_page_settings;
CREATE POLICY "cps_staff_update" ON public.contact_page_settings FOR UPDATE TO authenticated USING (public.can_edit_site(site_id)) WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "cps_staff_delete" ON public.contact_page_settings;
CREATE POLICY "cps_staff_delete" ON public.contact_page_settings FOR DELETE TO authenticated USING (public.can_edit_site(site_id));

DROP TRIGGER IF EXISTS "cps_set_updated_at" ON public.contact_page_settings;
CREATE TRIGGER "cps_set_updated_at" BEFORE UPDATE ON public.contact_page_settings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- contact_page_visibility (per-site, locale-independent)
CREATE TABLE IF NOT EXISTS public.contact_page_visibility (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE UNIQUE,
  show_hero              boolean     DEFAULT true,
  show_social_links      boolean     DEFAULT true,
  show_contact_form      boolean     DEFAULT true,
  show_faq               boolean     DEFAULT true,
  show_avatar            boolean     DEFAULT true,
  show_bio               boolean     DEFAULT true,
  show_response_badge    boolean     DEFAULT true,
  social_order           jsonb       DEFAULT '["email","instagram","youtube","x","github","rss"]'::jsonb,
  social_visible         jsonb       DEFAULT '{"email":true,"instagram":true,"youtube":true,"x":true,"github":true,"rss":true}'::jsonb,
  email_highlight        boolean     DEFAULT true,
  handwritten_note       boolean     DEFAULT true,
  show_subject_selector  boolean     DEFAULT true,
  show_marketing_consent boolean     DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_page_visibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cpv_public_read" ON public.contact_page_visibility;
CREATE POLICY "cpv_public_read" ON public.contact_page_visibility FOR SELECT USING (public.site_visible(site_id));

DROP POLICY IF EXISTS "cpv_staff_insert" ON public.contact_page_visibility;
CREATE POLICY "cpv_staff_insert" ON public.contact_page_visibility FOR INSERT TO authenticated WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "cpv_staff_update" ON public.contact_page_visibility;
CREATE POLICY "cpv_staff_update" ON public.contact_page_visibility FOR UPDATE TO authenticated USING (public.can_edit_site(site_id)) WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "cpv_staff_delete" ON public.contact_page_visibility;
CREATE POLICY "cpv_staff_delete" ON public.contact_page_visibility FOR DELETE TO authenticated USING (public.can_edit_site(site_id));

DROP TRIGGER IF EXISTS "cpv_set_updated_at" ON public.contact_page_visibility;
CREATE TRIGGER "cpv_set_updated_at" BEFORE UPDATE ON public.contact_page_visibility FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Add subject column to contact_submissions
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS subject text DEFAULT NULL;
ALTER TABLE public.contact_submissions DROP CONSTRAINT IF EXISTS contact_submissions_subject_len;
ALTER TABLE public.contact_submissions ADD CONSTRAINT contact_submissions_subject_len CHECK (char_length(subject) <= 100);

COMMIT;
