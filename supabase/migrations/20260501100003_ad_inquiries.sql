-- Ad inquiries: potential advertisers submitting interest via /anuncie.

CREATE TABLE IF NOT EXISTS public.ad_inquiries (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id             TEXT        NOT NULL DEFAULT 'bythiagofigueiredo',
  name               TEXT        NOT NULL CHECK (length(name) BETWEEN 2 AND 200),
  email              CITEXT      NOT NULL CHECK (length(email) BETWEEN 5 AND 320),
  company            TEXT        CHECK (company IS NULL OR length(company) <= 200),
  website            TEXT        CHECK (website IS NULL OR length(website) <= 500),
  message            TEXT        NOT NULL CHECK (length(message) BETWEEN 10 AND 5000),
  budget             TEXT        CHECK (budget IS NULL OR budget IN ('under_500', '500_2000', '2000_5000', 'above_5000', 'not_sure')),
  preferred_slots    TEXT[]      DEFAULT '{}',
  status             TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'negotiating', 'converted', 'archived')),
  admin_notes        TEXT,
  ip                 INET,
  user_agent         TEXT,
  consent_processing BOOLEAN     NOT NULL DEFAULT true,
  consent_version    TEXT        NOT NULL,
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contacted_at       TIMESTAMPTZ,
  converted_at       TIMESTAMPTZ
);

CREATE INDEX idx_ad_inquiries_app_id ON public.ad_inquiries(app_id);
CREATE INDEX idx_ad_inquiries_status ON public.ad_inquiries(app_id, status);
CREATE INDEX idx_ad_inquiries_submitted ON public.ad_inquiries(app_id, submitted_at DESC);

ALTER TABLE public.ad_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.ad_inquiries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "ad_inquiries_select_auth" ON public.ad_inquiries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ad_inquiries_insert_anon" ON public.ad_inquiries
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "ad_inquiries_insert_auth" ON public.ad_inquiries
  FOR INSERT TO authenticated WITH CHECK (true);
