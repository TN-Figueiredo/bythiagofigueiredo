-- =============================================================
-- Sprint 5i: Playlist Graph Editor — Schema
-- 3 tables: playlists, playlist_items, playlist_edges
-- =============================================================

-- 1. playlists
CREATE TABLE IF NOT EXISTS public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  category TEXT,
  viewport_state JSONB DEFAULT '{"zoom":1,"x":0,"y":0}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT playlists_site_slug_unique UNIQUE (site_id, slug)
);

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "playlists_select" ON public.playlists;
CREATE POLICY "playlists_select"
  ON public.playlists FOR SELECT TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "playlists_insert" ON public.playlists;
CREATE POLICY "playlists_insert"
  ON public.playlists FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "playlists_update" ON public.playlists;
CREATE POLICY "playlists_update"
  ON public.playlists FOR UPDATE TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "playlists_delete" ON public.playlists;
CREATE POLICY "playlists_delete"
  ON public.playlists FOR DELETE TO authenticated
  USING (public.can_edit_site(site_id));

DROP TRIGGER IF EXISTS set_playlists_updated_at ON public.playlists;
CREATE TRIGGER set_playlists_updated_at
  BEFORE UPDATE ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_playlists_site ON public.playlists(site_id);

-- 2. playlist_items
CREATE TABLE IF NOT EXISTS public.playlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  blog_post_id UUID REFERENCES public.blog_posts(id) ON DELETE SET NULL,
  newsletter_edition_id UUID REFERENCES public.newsletter_editions(id) ON DELETE SET NULL,
  pipeline_id UUID REFERENCES public.content_pipeline(id) ON DELETE SET NULL,
  CONSTRAINT playlist_items_single_ref CHECK (num_nonnulls(blog_post_id, newsletter_edition_id, pipeline_id) <= 1),
  sort_order INTEGER NOT NULL DEFAULT 1000,
  position_x REAL NOT NULL DEFAULT 0,
  position_y REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_playlist_item_blog
  ON public.playlist_items(playlist_id, blog_post_id) WHERE blog_post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_playlist_item_newsletter
  ON public.playlist_items(playlist_id, newsletter_edition_id) WHERE newsletter_edition_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_playlist_item_pipeline
  ON public.playlist_items(playlist_id, pipeline_id) WHERE pipeline_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON public.playlist_items(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_blog ON public.playlist_items(blog_post_id) WHERE blog_post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_playlist_items_newsletter ON public.playlist_items(newsletter_edition_id) WHERE newsletter_edition_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_playlist_items_pipeline ON public.playlist_items(pipeline_id) WHERE pipeline_id IS NOT NULL;

ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "playlist_items_select" ON public.playlist_items;
CREATE POLICY "playlist_items_select"
  ON public.playlist_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_items.playlist_id
      AND public.can_view_site(playlists.site_id)
  ));

DROP POLICY IF EXISTS "playlist_items_insert" ON public.playlist_items;
CREATE POLICY "playlist_items_insert"
  ON public.playlist_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_items.playlist_id
      AND public.can_edit_site(playlists.site_id)
  ));

DROP POLICY IF EXISTS "playlist_items_update" ON public.playlist_items;
CREATE POLICY "playlist_items_update"
  ON public.playlist_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_items.playlist_id
      AND public.can_edit_site(playlists.site_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_items.playlist_id
      AND public.can_edit_site(playlists.site_id)
  ));

DROP POLICY IF EXISTS "playlist_items_delete" ON public.playlist_items;
CREATE POLICY "playlist_items_delete"
  ON public.playlist_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_items.playlist_id
      AND public.can_edit_site(playlists.site_id)
  ));

-- 3. playlist_edges
CREATE TABLE IF NOT EXISTS public.playlist_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  source_item_id UUID NOT NULL REFERENCES public.playlist_items(id) ON DELETE CASCADE,
  target_item_id UUID NOT NULL REFERENCES public.playlist_items(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL DEFAULT 'sequence'
    CHECK (edge_type IN ('sequence', 'related', 'prerequisite', 'continuation')),
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT playlist_edges_unique UNIQUE (playlist_id, source_item_id, target_item_id),
  CONSTRAINT playlist_edges_no_self CHECK (source_item_id != target_item_id)
);

CREATE INDEX IF NOT EXISTS idx_playlist_edges_playlist ON public.playlist_edges(playlist_id);

ALTER TABLE public.playlist_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "playlist_edges_select" ON public.playlist_edges;
CREATE POLICY "playlist_edges_select"
  ON public.playlist_edges FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_edges.playlist_id
      AND public.can_view_site(playlists.site_id)
  ));

DROP POLICY IF EXISTS "playlist_edges_insert" ON public.playlist_edges;
CREATE POLICY "playlist_edges_insert"
  ON public.playlist_edges FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_edges.playlist_id
      AND public.can_edit_site(playlists.site_id)
  ));

DROP POLICY IF EXISTS "playlist_edges_update" ON public.playlist_edges;
CREATE POLICY "playlist_edges_update"
  ON public.playlist_edges FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_edges.playlist_id
      AND public.can_edit_site(playlists.site_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_edges.playlist_id
      AND public.can_edit_site(playlists.site_id)
  ));

DROP POLICY IF EXISTS "playlist_edges_delete" ON public.playlist_edges;
CREATE POLICY "playlist_edges_delete"
  ON public.playlist_edges FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_edges.playlist_id
      AND public.can_edit_site(playlists.site_id)
  ));

-- 4. Cycle prevention trigger (sequence edges only)
CREATE OR REPLACE FUNCTION public.prevent_sequence_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.edge_type != 'sequence' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    WITH RECURSIVE chain AS (
      SELECT target_item_id
      FROM public.playlist_edges
      WHERE source_item_id = NEW.target_item_id
        AND playlist_id = NEW.playlist_id
        AND edge_type = 'sequence'
      UNION ALL
      SELECT e.target_item_id
      FROM public.playlist_edges e
      JOIN chain c ON e.source_item_id = c.target_item_id
      WHERE e.playlist_id = NEW.playlist_id
        AND e.edge_type = 'sequence'
    )
    SELECT 1 FROM chain WHERE target_item_id = NEW.source_item_id
  ) THEN
    RAISE EXCEPTION 'Sequence edge would create a cycle';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_prevent_sequence_cycle ON public.playlist_edges;
CREATE TRIGGER tg_prevent_sequence_cycle
  BEFORE INSERT OR UPDATE ON public.playlist_edges
  FOR EACH ROW EXECUTE FUNCTION public.prevent_sequence_cycle();
