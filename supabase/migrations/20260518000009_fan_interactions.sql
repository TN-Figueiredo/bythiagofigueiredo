-- Fan interactions tracking for cross-platform superfan detection

CREATE TABLE IF NOT EXISTS public.fan_interactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  visitor_hash     text NOT NULL,
  platform         text NOT NULL,
  interaction_type text NOT NULL,
  post_id          uuid REFERENCES public.social_posts(id) ON DELETE SET NULL,
  link_id          uuid REFERENCES public.tracked_links(id) ON DELETE SET NULL,
  raw              jsonb DEFAULT '{}',
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fan_interactions_visitor
  ON public.fan_interactions (site_id, visitor_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fan_interactions_platform
  ON public.fan_interactions (site_id, platform, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fan_interactions_post
  ON public.fan_interactions (post_id) WHERE post_id IS NOT NULL;

-- RLS
ALTER TABLE public.fan_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fan_interactions_select" ON public.fan_interactions;
CREATE POLICY "fan_interactions_select" ON public.fan_interactions
  FOR SELECT TO authenticated
  USING (public.site_visible(site_id));

DROP POLICY IF EXISTS "fan_interactions_insert" ON public.fan_interactions;
CREATE POLICY "fan_interactions_insert" ON public.fan_interactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "fan_interactions_delete" ON public.fan_interactions;
CREATE POLICY "fan_interactions_delete" ON public.fan_interactions
  FOR DELETE TO authenticated
  USING (public.is_staff());
