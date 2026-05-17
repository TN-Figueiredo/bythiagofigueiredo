BEGIN;

-- 1. Add settings JSONB column to sites table
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- 2. Create ab_tests table
CREATE TABLE IF NOT EXISTS public.ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.sites(id),
    youtube_video_id UUID NOT NULL REFERENCES public.youtube_videos(id),
    source_pipeline_id UUID REFERENCES public.content_pipeline(id),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    original_thumbnail_url TEXT NOT NULL,
    started_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completed_reason TEXT
        CHECK (completed_reason IS NULL OR completed_reason IN (
            'auto_resolve', 'manual_winner', 'manual_archive', 'max_duration', 'inconclusive'
        )),
    confidence_at_completion NUMERIC(5,4),
    consecutive_confident_evals INTEGER NOT NULL DEFAULT 0,
    status_note TEXT,
    result_metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ab_tests_one_active_per_video
    ON public.ab_tests (youtube_video_id)
    WHERE status IN ('draft', 'active', 'paused');

ALTER TABLE public.ab_tests ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS tg_ab_tests_updated_at ON public.ab_tests;
CREATE TRIGGER tg_ab_tests_updated_at
    BEFORE UPDATE ON public.ab_tests
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Create ab_test_variants table
CREATE TABLE IF NOT EXISTS public.ab_test_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.ab_tests(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    is_original BOOLEAN NOT NULL DEFAULT false,
    blob_url TEXT,
    blob_key TEXT,
    file_size_bytes INTEGER,
    dimensions TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ab_test_variants ENABLE ROW LEVEL SECURITY;

-- 4. Add deferred FK for winner_variant_id on ab_tests
ALTER TABLE public.ab_tests ADD COLUMN IF NOT EXISTS winner_variant_id UUID;
ALTER TABLE public.ab_tests
    ADD CONSTRAINT ab_tests_winner_variant_fk
    FOREIGN KEY (winner_variant_id) REFERENCES public.ab_test_variants(id)
    DEFERRABLE INITIALLY DEFERRED;

-- 5. Create ab_test_cycles table
CREATE TABLE IF NOT EXISTS public.ab_test_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.ab_tests(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.ab_test_variants(id),
    cycle_number INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    impressions INTEGER,
    clicks INTEGER,
    ctr NUMERIC(6,4),
    estimated_impressions INTEGER,
    estimated_clicks INTEGER,
    estimated_ctr NUMERIC(6,4),
    backfill_status TEXT DEFAULT 'pending'
        CHECK (backfill_status IN ('pending', 'partial', 'confirmed', 'no_data', 'error')),
    backfill_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ab_test_cycles_test_id_idx
    ON public.ab_test_cycles (test_id, cycle_number);

ALTER TABLE public.ab_test_cycles ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies

-- ab_tests policies
DROP POLICY IF EXISTS "ab_tests_select" ON public.ab_tests;
CREATE POLICY "ab_tests_select" ON public.ab_tests
    FOR SELECT USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "ab_tests_insert" ON public.ab_tests;
CREATE POLICY "ab_tests_insert" ON public.ab_tests
    FOR INSERT WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "ab_tests_update" ON public.ab_tests;
CREATE POLICY "ab_tests_update" ON public.ab_tests
    FOR UPDATE USING (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "ab_tests_delete" ON public.ab_tests;
CREATE POLICY "ab_tests_delete" ON public.ab_tests
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.sites s
            WHERE s.id = site_id AND public.is_org_admin(s.org_id)
        )
    );

-- ab_test_variants policies
DROP POLICY IF EXISTS "ab_test_variants_select" ON public.ab_test_variants;
CREATE POLICY "ab_test_variants_select" ON public.ab_test_variants
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.ab_tests t WHERE t.id = test_id AND public.can_view_site(t.site_id))
    );

DROP POLICY IF EXISTS "ab_test_variants_insert" ON public.ab_test_variants;
CREATE POLICY "ab_test_variants_insert" ON public.ab_test_variants
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.ab_tests t WHERE t.id = test_id AND public.can_edit_site(t.site_id))
    );

DROP POLICY IF EXISTS "ab_test_variants_update" ON public.ab_test_variants;
CREATE POLICY "ab_test_variants_update" ON public.ab_test_variants
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.ab_tests t WHERE t.id = test_id AND public.can_edit_site(t.site_id))
    );

DROP POLICY IF EXISTS "ab_test_variants_delete" ON public.ab_test_variants;
CREATE POLICY "ab_test_variants_delete" ON public.ab_test_variants
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.ab_tests t
            JOIN public.sites s ON s.id = t.site_id
            WHERE t.id = test_id AND public.is_org_admin(s.org_id)
        )
    );

-- ab_test_cycles policies
DROP POLICY IF EXISTS "ab_test_cycles_select" ON public.ab_test_cycles;
CREATE POLICY "ab_test_cycles_select" ON public.ab_test_cycles
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.ab_tests t WHERE t.id = test_id AND public.can_view_site(t.site_id))
    );

DROP POLICY IF EXISTS "ab_test_cycles_insert" ON public.ab_test_cycles;
CREATE POLICY "ab_test_cycles_insert" ON public.ab_test_cycles
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.ab_tests t WHERE t.id = test_id AND public.can_edit_site(t.site_id))
    );

DROP POLICY IF EXISTS "ab_test_cycles_update" ON public.ab_test_cycles;
CREATE POLICY "ab_test_cycles_update" ON public.ab_test_cycles
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.ab_tests t WHERE t.id = test_id AND public.can_edit_site(t.site_id))
    );

DROP POLICY IF EXISTS "ab_test_cycles_delete" ON public.ab_test_cycles;
CREATE POLICY "ab_test_cycles_delete" ON public.ab_test_cycles
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.ab_tests t
            JOIN public.sites s ON s.id = t.site_id
            WHERE t.id = test_id AND public.is_org_admin(s.org_id)
        )
    );

COMMIT;
