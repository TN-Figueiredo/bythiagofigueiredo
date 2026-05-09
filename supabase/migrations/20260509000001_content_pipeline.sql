-- Content Pipeline schema: unified editorial workflow engine for all content formats.
-- Tables: pipeline_workflows, content_pipeline, content_collections,
--         content_pipeline_memberships, content_pipeline_history,
--         pipeline_dependencies, pipeline_api_keys, reference_content
-- Includes bilingual full-text search, optimistic locking, RBAC via RLS helpers,
-- and blog taxonomy migration (tech/code → building, vida/viagem → stories, etc.).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. pipeline_workflows  (format × stage lookup table)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pipeline_workflows (
  format     text NOT NULL,
  stage      text NOT NULL,
  position   int  NOT NULL,
  label_pt   text NOT NULL,
  label_en   text NOT NULL,
  PRIMARY KEY (format, stage)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. content_pipeline  (main items table)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.content_pipeline (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id              uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  code                 text        NOT NULL,
  title_pt             text,
  title_en             text,
  format               text        NOT NULL,
  stage                text        NOT NULL,
  language             text        NOT NULL DEFAULT 'pt-br'
                                   CHECK (language IN ('pt-br', 'en', 'both')),
  priority             smallint    NOT NULL DEFAULT 0
                                   CHECK (priority BETWEEN 0 AND 5),
  parent_id            uuid        REFERENCES public.content_pipeline(id) ON DELETE SET NULL,
  hook                 text,
  synopsis             text,
  body_content         text,
  body_compiled        text,
  format_metadata      jsonb       NOT NULL DEFAULT '{}',
  production_checklist jsonb       NOT NULL DEFAULT '[]',
  validation_score     jsonb       NOT NULL DEFAULT '{}',
  tags                 text[]      NOT NULL DEFAULT '{}',
  youtube_video_id     uuid        REFERENCES public.youtube_videos(id)         ON DELETE SET NULL,
  blog_post_id         uuid        REFERENCES public.blog_posts(id)             ON DELETE SET NULL,
  newsletter_edition_id uuid       REFERENCES public.newsletter_editions(id)    ON DELETE SET NULL,
  campaign_id          uuid        REFERENCES public.campaigns(id)              ON DELETE SET NULL,
  is_archived          boolean     NOT NULL DEFAULT false,
  version              int         NOT NULL DEFAULT 1,
  created_by           uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  search_vector        tsvector,
  CONSTRAINT content_pipeline_code_site_unique UNIQUE (site_id, code),
  CONSTRAINT content_pipeline_workflow_fk FOREIGN KEY (format, stage)
    REFERENCES public.pipeline_workflows (format, stage)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. content_collections
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.content_collections (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  code        text        NOT NULL,
  title_pt    text,
  title_en    text,
  type        text        NOT NULL
              CHECK (type IN ('playlist', 'category', 'series', 'arc', 'launch')),
  parent_id   uuid        REFERENCES public.content_collections(id) ON DELETE SET NULL,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_collections_code_site_unique UNIQUE (site_id, code)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. content_pipeline_memberships
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.content_pipeline_memberships (
  pipeline_id   uuid NOT NULL REFERENCES public.content_pipeline(id)   ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.content_collections(id) ON DELETE CASCADE,
  position      int  NOT NULL DEFAULT 0,
  role          text,
  PRIMARY KEY (pipeline_id, collection_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. content_pipeline_history  (audit trail for stage / field changes)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.content_pipeline_history (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id  uuid        NOT NULL REFERENCES public.content_pipeline(id) ON DELETE CASCADE,
  event_type   text        NOT NULL,
  from_value   text,
  to_value     text,
  changed_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at   timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. pipeline_dependencies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pipeline_dependencies (
  blocker_id       uuid NOT NULL REFERENCES public.content_pipeline(id) ON DELETE CASCADE,
  blocked_id       uuid NOT NULL REFERENCES public.content_pipeline(id) ON DELETE CASCADE,
  dependency_type  text NOT NULL DEFAULT 'soft'
                   CHECK (dependency_type IN ('soft', 'hard')),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT pipeline_dependencies_no_self_ref CHECK (blocker_id <> blocked_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. pipeline_api_keys
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pipeline_api_keys (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  key_hash     text        NOT NULL,
  permissions  text[]      NOT NULL DEFAULT '{}',
  created_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. reference_content  (editorial reference docs, versioned)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reference_content (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  key             text        NOT NULL,
  content_md      text,
  content_compact jsonb       NOT NULL DEFAULT '{}',
  version         int         NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reference_content_key_site_unique UNIQUE (site_id, key)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- content_pipeline: partial indexes for active items
CREATE INDEX IF NOT EXISTS idx_pipeline_site_format
  ON public.content_pipeline (site_id, format);

CREATE INDEX IF NOT EXISTS idx_pipeline_site_format_stage_active
  ON public.content_pipeline (site_id, format, stage)
  WHERE NOT is_archived;

CREATE INDEX IF NOT EXISTS idx_pipeline_search_vector
  ON public.content_pipeline USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_pipeline_tags
  ON public.content_pipeline USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_pipeline_parent_id
  ON public.content_pipeline (parent_id)
  WHERE parent_id IS NOT NULL;

-- content_collections
CREATE INDEX IF NOT EXISTS idx_collections_site_type
  ON public.content_collections (site_id, type);

-- memberships: both directions
CREATE INDEX IF NOT EXISTS idx_memberships_collection_id
  ON public.content_pipeline_memberships (collection_id);

CREATE INDEX IF NOT EXISTS idx_memberships_pipeline_id
  ON public.content_pipeline_memberships (pipeline_id);

-- history
CREATE INDEX IF NOT EXISTS idx_pipeline_history_pipeline_changed
  ON public.content_pipeline_history (pipeline_id, changed_at DESC);

-- api_keys: active only
CREATE INDEX IF NOT EXISTS idx_pipeline_api_keys_hash_active
  ON public.pipeline_api_keys (key_hash)
  WHERE revoked_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Functions & Triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- 10a. Bilingual tsvector update (weights A-D, body capped at 10k chars)
CREATE OR REPLACE FUNCTION public.pipeline_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(NEW.title_pt, '')), 'A') ||
    setweight(to_tsvector('english',    coalesce(NEW.title_en, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.hook, '')),     'B') ||
    setweight(to_tsvector('english',    coalesce(NEW.hook, '')),     'B') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.synopsis, '')), 'C') ||
    setweight(to_tsvector('english',    coalesce(NEW.synopsis, '')), 'C') ||
    setweight(to_tsvector('portuguese', array_to_string(coalesce(NEW.tags, '{}'), ' ')), 'C') ||
    setweight(to_tsvector('portuguese',
      left(coalesce(NEW.body_content, ''), 10000)
    ), 'D') ||
    setweight(to_tsvector('english',
      left(coalesce(NEW.body_content, ''), 10000)
    ), 'D');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_search_vector ON public.content_pipeline;
CREATE TRIGGER trg_pipeline_search_vector
  BEFORE INSERT OR UPDATE OF title_pt, title_en, hook, synopsis, tags, body_content
  ON public.content_pipeline
  FOR EACH ROW
  EXECUTE FUNCTION public.pipeline_search_vector_update();

-- 10b. Auto updated_at + optimistic locking version increment
CREATE OR REPLACE FUNCTION public.pipeline_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.version    := OLD.version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_updated_at ON public.content_pipeline;
CREATE TRIGGER trg_pipeline_updated_at
  BEFORE UPDATE
  ON public.content_pipeline
  FOR EACH ROW
  EXECUTE FUNCTION public.pipeline_updated_at();

-- 10c. Record stage change to history (SECURITY DEFINER so it runs as owner)
CREATE OR REPLACE FUNCTION public.pipeline_record_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO public.content_pipeline_history
      (pipeline_id, event_type, from_value, to_value, changed_by)
    VALUES
      (NEW.id, 'stage_change', OLD.stage, NEW.stage, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_stage_change ON public.content_pipeline;
CREATE TRIGGER trg_pipeline_stage_change
  AFTER UPDATE OF stage
  ON public.content_pipeline
  FOR EACH ROW
  EXECUTE FUNCTION public.pipeline_record_stage_change();

-- 10d. Prevent format changes after creation
CREATE OR REPLACE FUNCTION public.pipeline_immutable_format()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.format IS DISTINCT FROM NEW.format THEN
    RAISE EXCEPTION 'format is immutable after creation'
      USING ERRCODE = 'P0001', HINT = 'immutable_field_format';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_immutable_format ON public.content_pipeline;
CREATE TRIGGER trg_pipeline_immutable_format
  BEFORE UPDATE OF format
  ON public.content_pipeline
  FOR EACH ROW
  EXECUTE FUNCTION public.pipeline_immutable_format();

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Enable Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.pipeline_workflows            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_pipeline              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_collections           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_pipeline_memberships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_pipeline_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_dependencies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_api_keys             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_content             ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. RLS Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- pipeline_workflows: public read, no writes through RLS
DROP POLICY IF EXISTS "pipeline_workflows_select" ON public.pipeline_workflows;
CREATE POLICY "pipeline_workflows_select"
  ON public.pipeline_workflows
  FOR SELECT
  TO authenticated
  USING (true);

-- content_pipeline
DROP POLICY IF EXISTS "content_pipeline_select" ON public.content_pipeline;
CREATE POLICY "content_pipeline_select"
  ON public.content_pipeline
  FOR SELECT
  TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "content_pipeline_insert" ON public.content_pipeline;
CREATE POLICY "content_pipeline_insert"
  ON public.content_pipeline
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "content_pipeline_update" ON public.content_pipeline;
CREATE POLICY "content_pipeline_update"
  ON public.content_pipeline
  FOR UPDATE
  TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "content_pipeline_delete" ON public.content_pipeline;
CREATE POLICY "content_pipeline_delete"
  ON public.content_pipeline
  FOR DELETE
  TO authenticated
  USING (public.can_edit_site(site_id));

-- content_collections
DROP POLICY IF EXISTS "content_collections_select" ON public.content_collections;
CREATE POLICY "content_collections_select"
  ON public.content_collections
  FOR SELECT
  TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "content_collections_insert" ON public.content_collections;
CREATE POLICY "content_collections_insert"
  ON public.content_collections
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "content_collections_update" ON public.content_collections;
CREATE POLICY "content_collections_update"
  ON public.content_collections
  FOR UPDATE
  TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "content_collections_delete" ON public.content_collections;
CREATE POLICY "content_collections_delete"
  ON public.content_collections
  FOR DELETE
  TO authenticated
  USING (public.can_edit_site(site_id));

-- content_pipeline_memberships: access via parent content_pipeline
DROP POLICY IF EXISTS "pipeline_memberships_select" ON public.content_pipeline_memberships;
CREATE POLICY "pipeline_memberships_select"
  ON public.content_pipeline_memberships
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.content_pipeline cp
      WHERE cp.id = pipeline_id
        AND public.can_view_site(cp.site_id)
    )
  );

DROP POLICY IF EXISTS "pipeline_memberships_insert" ON public.content_pipeline_memberships;
CREATE POLICY "pipeline_memberships_insert"
  ON public.content_pipeline_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.content_pipeline cp
      WHERE cp.id = pipeline_id
        AND public.can_edit_site(cp.site_id)
    )
  );

DROP POLICY IF EXISTS "pipeline_memberships_update" ON public.content_pipeline_memberships;
CREATE POLICY "pipeline_memberships_update"
  ON public.content_pipeline_memberships
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.content_pipeline cp
      WHERE cp.id = pipeline_id
        AND public.can_edit_site(cp.site_id)
    )
  );

DROP POLICY IF EXISTS "pipeline_memberships_delete" ON public.content_pipeline_memberships;
CREATE POLICY "pipeline_memberships_delete"
  ON public.content_pipeline_memberships
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.content_pipeline cp
      WHERE cp.id = pipeline_id
        AND public.can_edit_site(cp.site_id)
    )
  );

-- content_pipeline_history: read-only via parent pipeline
DROP POLICY IF EXISTS "pipeline_history_select" ON public.content_pipeline_history;
CREATE POLICY "pipeline_history_select"
  ON public.content_pipeline_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.content_pipeline cp
      WHERE cp.id = pipeline_id
        AND public.can_view_site(cp.site_id)
    )
  );

-- pipeline_dependencies: read/write via blocker pipeline
DROP POLICY IF EXISTS "pipeline_dependencies_select" ON public.pipeline_dependencies;
CREATE POLICY "pipeline_dependencies_select"
  ON public.pipeline_dependencies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.content_pipeline cp
      WHERE cp.id = blocker_id
        AND public.can_view_site(cp.site_id)
    )
  );

DROP POLICY IF EXISTS "pipeline_dependencies_insert" ON public.pipeline_dependencies;
CREATE POLICY "pipeline_dependencies_insert"
  ON public.pipeline_dependencies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.content_pipeline cp
      WHERE cp.id = blocker_id
        AND public.can_edit_site(cp.site_id)
    )
  );

DROP POLICY IF EXISTS "pipeline_dependencies_delete" ON public.pipeline_dependencies;
CREATE POLICY "pipeline_dependencies_delete"
  ON public.pipeline_dependencies
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.content_pipeline cp
      WHERE cp.id = blocker_id
        AND public.can_edit_site(cp.site_id)
    )
  );

-- reference_content
DROP POLICY IF EXISTS "reference_content_select" ON public.reference_content;
CREATE POLICY "reference_content_select"
  ON public.reference_content
  FOR SELECT
  TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "reference_content_insert" ON public.reference_content;
CREATE POLICY "reference_content_insert"
  ON public.reference_content
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "reference_content_update" ON public.reference_content;
CREATE POLICY "reference_content_update"
  ON public.reference_content
  FOR UPDATE
  TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "reference_content_delete" ON public.reference_content;
CREATE POLICY "reference_content_delete"
  ON public.reference_content
  FOR DELETE
  TO authenticated
  USING (public.can_edit_site(site_id));

-- pipeline_api_keys: admin only
DROP POLICY IF EXISTS "pipeline_api_keys_select" ON public.pipeline_api_keys;
CREATE POLICY "pipeline_api_keys_select"
  ON public.pipeline_api_keys
  FOR SELECT
  TO authenticated
  USING (public.can_admin_site_users(site_id));

DROP POLICY IF EXISTS "pipeline_api_keys_insert" ON public.pipeline_api_keys;
CREATE POLICY "pipeline_api_keys_insert"
  ON public.pipeline_api_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_admin_site_users(site_id));

DROP POLICY IF EXISTS "pipeline_api_keys_update" ON public.pipeline_api_keys;
CREATE POLICY "pipeline_api_keys_update"
  ON public.pipeline_api_keys
  FOR UPDATE
  TO authenticated
  USING (public.can_admin_site_users(site_id))
  WITH CHECK (public.can_admin_site_users(site_id));

DROP POLICY IF EXISTS "pipeline_api_keys_delete" ON public.pipeline_api_keys;
CREATE POLICY "pipeline_api_keys_delete"
  ON public.pipeline_api_keys
  FOR DELETE
  TO authenticated
  USING (public.can_admin_site_users(site_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. Workflow seed data
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.pipeline_workflows (format, stage, position, label_pt, label_en)
VALUES
  -- video
  ('video', 'idea',          1, 'Ideia',          'Idea'),
  ('video', 'roteiro',       2, 'Roteiro',         'Script'),
  ('video', 'gravacao',      3, 'Gravação',        'Recording'),
  ('video', 'edicao',        4, 'Edição',          'Editing'),
  ('video', 'pos_producao',  5, 'Pós-produção',    'Post-production'),
  ('video', 'scheduled',     6, 'Agendado',        'Scheduled'),
  ('video', 'published',     7, 'Publicado',       'Published'),
  -- blog_post
  ('blog_post', 'idea',      1, 'Ideia',           'Idea'),
  ('blog_post', 'draft',     2, 'Rascunho',        'Draft'),
  ('blog_post', 'ready',     3, 'Pronto',          'Ready'),
  ('blog_post', 'scheduled', 4, 'Agendado',        'Scheduled'),
  ('blog_post', 'published', 5, 'Publicado',       'Published'),
  -- newsletter
  ('newsletter', 'idea',      1, 'Ideia',          'Idea'),
  ('newsletter', 'draft',     2, 'Rascunho',       'Draft'),
  ('newsletter', 'ready',     3, 'Pronto',         'Ready'),
  ('newsletter', 'scheduled', 4, 'Agendado',       'Scheduled'),
  ('newsletter', 'published', 5, 'Publicado',      'Published'),
  -- course
  ('course', 'idea',     1, 'Ideia',               'Idea'),
  ('course', 'outline',  2, 'Outline',             'Outline'),
  ('course', 'modulos',  3, 'Módulos',             'Modules'),
  ('course', 'review',   4, 'Revisão',             'Review'),
  ('course', 'published',5, 'Publicado',           'Published'),
  -- campaign
  ('campaign', 'idea',      1, 'Ideia',            'Idea'),
  ('campaign', 'draft',     2, 'Rascunho',         'Draft'),
  ('campaign', 'approved',  3, 'Aprovado',         'Approved'),
  ('campaign', 'scheduled', 4, 'Agendado',         'Scheduled'),
  ('campaign', 'sent',      5, 'Enviado',          'Sent')
ON CONFLICT (format, stage) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. Blog taxonomy migration
-- ─────────────────────────────────────────────────────────────────────────────

-- Remap old categories to new taxonomy
UPDATE public.blog_posts SET category = 'building' WHERE category IN ('tech', 'code');
UPDATE public.blog_posts SET category = 'stories'  WHERE category IN ('vida', 'viagem');
UPDATE public.blog_posts SET category = 'money'    WHERE category = 'negocio';
UPDATE public.blog_posts SET category = 'bts'      WHERE category = 'crescimento';

-- Swap the CHECK constraint
ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_category_check;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_category_check
  CHECK (category IN ('stories', 'building', 'money', 'bts'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. Seed category collections (from first site)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_site_id uuid;
BEGIN
  SELECT id INTO v_site_id FROM public.sites LIMIT 1;

  IF v_site_id IS NULL THEN
    RAISE NOTICE 'No site found — skipping category collection seed.';
    RETURN;
  END IF;

  INSERT INTO public.content_collections (site_id, code, title_pt, title_en, type)
  VALUES
    (v_site_id, 'cat-stories',  'Histórias',    'Stories',  'category'),
    (v_site_id, 'cat-building', 'Construindo',  'Building', 'category'),
    (v_site_id, 'cat-money',    'Dinheiro',     'Money',    'category'),
    (v_site_id, 'cat-bts',      'Bastidores',   'BTS',      'category')
  ON CONFLICT (site_id, code) DO NOTHING;
END;
$$;

COMMIT;
