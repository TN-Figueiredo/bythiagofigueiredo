BEGIN;

-- ══ 1. ab_tests: add test_type + original metadata ══

ALTER TABLE public.ab_tests
  ADD COLUMN IF NOT EXISTS test_type TEXT NOT NULL DEFAULT 'thumbnail'
    CHECK (test_type IN ('thumbnail', 'title', 'description', 'combo')),
  ADD COLUMN IF NOT EXISTS original_title TEXT,
  ADD COLUMN IF NOT EXISTS original_description TEXT;

COMMENT ON COLUMN public.ab_tests.test_type IS 'Discriminator: thumbnail|title|description|combo';
COMMENT ON COLUMN public.ab_tests.original_title IS 'Captured from YouTube on test creation';
COMMENT ON COLUMN public.ab_tests.original_description IS 'Captured from YouTube on test creation';

-- ══ 2. ab_test_variants: add text fields + metadata ══

ALTER TABLE public.ab_test_variants
  ADD COLUMN IF NOT EXISTS title_text TEXT,
  ADD COLUMN IF NOT EXISTS description_text TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN public.ab_test_variants.title_text IS 'Title for this variant (null = use original)';
COMMENT ON COLUMN public.ab_test_variants.description_text IS 'Description template with {{link:name}} placeholders';
COMMENT ON COLUMN public.ab_test_variants.metadata IS 'Cowork-facing metadata: thumbnail_tags, title_pattern, emotional_triggers, visual_description';

-- ══ 3. ab_test_cycles: add applied_metadata ══

ALTER TABLE public.ab_test_cycles
  ADD COLUMN IF NOT EXISTS applied_metadata JSONB;

COMMENT ON COLUMN public.ab_test_cycles.applied_metadata IS 'Records what was actually set on YouTube for this cycle';

-- ══ 4. ab_test_tracked_links: maps {{link:name}} → tracked short code per variant ══

CREATE TABLE IF NOT EXISTS public.ab_test_tracked_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ab_test_id UUID NOT NULL REFERENCES public.ab_tests(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.ab_test_variants(id) ON DELETE CASCADE,
  link_id UUID NOT NULL REFERENCES public.tracked_links(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  short_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ab_test_id, variant_id, template_name)
);

ALTER TABLE public.ab_test_tracked_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ab_test_tracked_links_select_staff" ON public.ab_test_tracked_links;
CREATE POLICY "ab_test_tracked_links_select_staff" ON public.ab_test_tracked_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ab_tests t
      WHERE t.id = ab_test_tracked_links.ab_test_id
        AND public.can_view_site(t.site_id)
    )
  );

DROP POLICY IF EXISTS "ab_test_tracked_links_insert_staff" ON public.ab_test_tracked_links;
CREATE POLICY "ab_test_tracked_links_insert_staff" ON public.ab_test_tracked_links
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ab_tests t
      WHERE t.id = ab_test_tracked_links.ab_test_id
        AND public.can_edit_site(t.site_id)
    )
  );

DROP POLICY IF EXISTS "ab_test_tracked_links_delete_staff" ON public.ab_test_tracked_links;
CREATE POLICY "ab_test_tracked_links_delete_staff" ON public.ab_test_tracked_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.ab_tests t
      WHERE t.id = ab_test_tracked_links.ab_test_id
        AND public.can_edit_site(t.site_id)
    )
  );

COMMIT;
