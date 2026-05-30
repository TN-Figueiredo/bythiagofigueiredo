-- =============================================================================
-- MIGRATION: Custom canvas format presets per site/context
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.canvas_format_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  context text NOT NULL DEFAULT 'qr-card',
  name text NOT NULL,
  width integer NOT NULL CHECK (width >= 200 AND width <= 4096),
  height integer NOT NULL CHECK (height >= 200 AND height <= 4096),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canvas_format_presets_site_ctx
  ON canvas_format_presets (site_id, context);

ALTER TABLE public.canvas_format_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "canvas_format_presets_read" ON public.canvas_format_presets;
CREATE POLICY "canvas_format_presets_read"
  ON public.canvas_format_presets
  FOR SELECT TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "canvas_format_presets_write" ON public.canvas_format_presets;
CREATE POLICY "canvas_format_presets_write"
  ON public.canvas_format_presets
  FOR ALL TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

COMMENT ON TABLE public.canvas_format_presets IS 'Custom canvas format presets per site and context (qr-card, social, etc.)';
