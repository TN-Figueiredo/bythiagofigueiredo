-- supabase/migrations/20260515000001_research_library.sql
-- Research Library: topics, items, links tables with RLS, triggers, and indexes.

BEGIN;

-- research_topics — hierarchical topic tree (max depth 2 = 3 levels)
CREATE TABLE IF NOT EXISTS public.research_topics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid REFERENCES public.research_topics(id) ON DELETE CASCADE,
  name        text NOT NULL,
  slug        text NOT NULL,
  path        text NOT NULL,
  depth       int NOT NULL DEFAULT 0 CHECK (depth <= 2),
  color       text NOT NULL DEFAULT '#a78bfa',
  icon        text NOT NULL DEFAULT '📁',
  sort_order  int NOT NULL DEFAULT 0,
  site_id     uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE(site_id, path),
  UNIQUE(site_id, parent_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_research_topics_site ON public.research_topics (site_id);
CREATE INDEX IF NOT EXISTS idx_research_topics_parent ON public.research_topics (parent_id) WHERE parent_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON public.research_topics;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.research_topics
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.research_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_topics_select ON public.research_topics;
CREATE POLICY research_topics_select ON public.research_topics
  FOR SELECT TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS research_topics_insert ON public.research_topics;
CREATE POLICY research_topics_insert ON public.research_topics
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS research_topics_update ON public.research_topics;
CREATE POLICY research_topics_update ON public.research_topics
  FOR UPDATE TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS research_topics_delete ON public.research_topics;
CREATE POLICY research_topics_delete ON public.research_topics
  FOR DELETE TO authenticated
  USING (public.can_edit_site(site_id));


-- research_items — individual research documents
CREATE TABLE IF NOT EXISTS public.research_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id        uuid NOT NULL REFERENCES public.research_topics(id) ON DELETE CASCADE,
  title           text NOT NULL,
  content_json    jsonb,
  content_md      text,
  summary         text,
  sources         jsonb NOT NULL DEFAULT '[]',
  status          text NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'reviewed', 'starred', 'archived')),
  word_count      int NOT NULL DEFAULT 0,
  version         int NOT NULL DEFAULT 1,
  search_vector   tsvector,
  site_id         uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE(site_id, topic_id, title)
);

CREATE INDEX IF NOT EXISTS idx_research_items_topic ON public.research_items (topic_id);
CREATE INDEX IF NOT EXISTS idx_research_items_site_status ON public.research_items (site_id, status)
  WHERE status != 'archived';
CREATE INDEX IF NOT EXISTS idx_research_items_search ON public.research_items USING GIN (search_vector);

DROP TRIGGER IF EXISTS set_updated_at ON public.research_items;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.research_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.research_item_version_increment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS research_item_version_inc ON public.research_items;
CREATE TRIGGER research_item_version_inc
  BEFORE UPDATE ON public.research_items
  FOR EACH ROW EXECUTE FUNCTION public.research_item_version_increment();

CREATE OR REPLACE FUNCTION public.research_item_search_vector_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', left(coalesce(NEW.content_md, ''), 50000)), 'B');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS research_item_search_vec ON public.research_items;
CREATE TRIGGER research_item_search_vec
  BEFORE INSERT OR UPDATE OF title, content_md ON public.research_items
  FOR EACH ROW EXECUTE FUNCTION public.research_item_search_vector_update();

CREATE OR REPLACE FUNCTION public.research_item_word_count_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.word_count := coalesce(
    array_length(
      regexp_split_to_array(trim(coalesce(NEW.content_md, '')), '\s+'),
      1
    ),
    0
  );
  IF NEW.content_md IS NULL OR trim(NEW.content_md) = '' THEN
    NEW.word_count := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS research_item_word_count ON public.research_items;
CREATE TRIGGER research_item_word_count
  BEFORE INSERT OR UPDATE OF content_md ON public.research_items
  FOR EACH ROW EXECUTE FUNCTION public.research_item_word_count_update();

ALTER TABLE public.research_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_items_select ON public.research_items;
CREATE POLICY research_items_select ON public.research_items
  FOR SELECT TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS research_items_insert ON public.research_items;
CREATE POLICY research_items_insert ON public.research_items
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS research_items_update ON public.research_items;
CREATE POLICY research_items_update ON public.research_items
  FOR UPDATE TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS research_items_delete ON public.research_items;
CREATE POLICY research_items_delete ON public.research_items
  FOR DELETE TO authenticated
  USING (public.can_edit_site(site_id));


-- research_links — many-to-many between research and pipeline items
CREATE TABLE IF NOT EXISTS public.research_links (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id       uuid NOT NULL REFERENCES public.research_items(id) ON DELETE CASCADE,
  pipeline_item_id  uuid NOT NULL REFERENCES public.content_pipeline(id) ON DELETE CASCADE,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE(research_id, pipeline_item_id)
);

CREATE INDEX IF NOT EXISTS idx_research_links_pipeline ON public.research_links (pipeline_item_id);
CREATE INDEX IF NOT EXISTS idx_research_links_research ON public.research_links (research_id);

ALTER TABLE public.research_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_links_select ON public.research_links;
CREATE POLICY research_links_select ON public.research_links
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.research_items ri
    WHERE ri.id = research_id AND public.can_view_site(ri.site_id)
  ));

DROP POLICY IF EXISTS research_links_insert ON public.research_links;
CREATE POLICY research_links_insert ON public.research_links
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.research_items ri
    WHERE ri.id = research_id AND public.can_edit_site(ri.site_id)
  ));

DROP POLICY IF EXISTS research_links_update ON public.research_links;
CREATE POLICY research_links_update ON public.research_links
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.research_items ri
    WHERE ri.id = research_id AND public.can_edit_site(ri.site_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.research_items ri
    WHERE ri.id = research_id AND public.can_edit_site(ri.site_id)
  ));

DROP POLICY IF EXISTS research_links_delete ON public.research_links;
CREATE POLICY research_links_delete ON public.research_links
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.research_items ri
    WHERE ri.id = research_id AND public.can_edit_site(ri.site_id)
  ));

COMMIT;
