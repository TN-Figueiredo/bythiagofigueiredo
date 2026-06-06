-- supabase/migrations/20260604000003_research_cms_redesign.sql
-- Research CMS Redesign: flat themes, new item columns, decisions, focos tables.
--
-- Strategy:
--   1. Seed research_themes (flat, 6 fixed slugs, one row per site).
--   2. ALTER research_items: make topic_id nullable, add new columns, migrate
--      status values and map topic_id → theme_id in one transaction.
--   3. Drop the old status CHECK and add the new one.
--   4. Create research_decisions + join tables.
--   5. Create research_focos with partial unique index for single-active constraint.
--   6. RLS policies on all new tables (idempotent DROP … IF EXISTS first).
--   7. RPCs: activate_research_foco, save_research_foco_full.

BEGIN;

-- ============================================================
-- SECTION 1 — research_themes
-- Fixed catalogue of 6 themes. One row per site, seeded via
-- CROSS JOIN with sites at migration time; app never inserts more.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.research_themes (
  id          text        NOT NULL,            -- slug: asia | ia | dev | games | grana | canal
  site_id     uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  label       text        NOT NULL,
  short       text        NOT NULL,
  color       text        NOT NULL DEFAULT '#a78bfa',
  icon        text        NOT NULL DEFAULT 'folder',
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_research_themes_site ON public.research_themes (site_id);

ALTER TABLE public.research_themes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_themes_select ON public.research_themes;
CREATE POLICY research_themes_select ON public.research_themes
  FOR SELECT TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS research_themes_insert ON public.research_themes;
CREATE POLICY research_themes_insert ON public.research_themes
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS research_themes_update ON public.research_themes;
CREATE POLICY research_themes_update ON public.research_themes
  FOR UPDATE TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS research_themes_delete ON public.research_themes;
CREATE POLICY research_themes_delete ON public.research_themes
  FOR DELETE TO authenticated
  USING (public.can_edit_site(site_id));

-- Seed: one row per (theme, site) — idempotent via ON CONFLICT DO NOTHING.
-- The 6 canonical theme definitions are inlined here so the catalogue is
-- always consistent regardless of which site is onboarded later.
INSERT INTO public.research_themes (id, site_id, label, short, color, icon, sort_order)
SELECT t.id, s.id, t.label, t.short, t.color, t.icon, t.sort_order
FROM public.sites s
CROSS JOIN (VALUES
  ('asia',  'Ásia & Nomadismo',  'Ásia',   '#22b8d6', 'globe', 0),
  ('ia',    'IA & Produção',     'IA',     '#8b8cf6', 'sparkles', 1),
  ('dev',   'Programação',       'Dev',    '#22c55e', 'blog', 2),
  ('games', 'Games & Pedigree',  'Games',  '#ec4899', 'trophy', 3),
  ('grana', 'Monetização',       'Grana',  '#f59e0b', 'dollar', 4),
  ('canal', 'Canal & Audiência', 'Canal',  '#a855f7', 'youtube', 5)
) AS t(id, label, short, color, icon, sort_order)
ON CONFLICT (id, site_id) DO NOTHING;


-- ============================================================
-- SECTION 2 — ALTER research_items
--
-- Steps (all inside this transaction):
--   a) Make topic_id nullable (keep FK, keep data, just allow NULL).
--   b) Drop old status CHECK constraint by name — recreate after migration.
--   c) Add new columns (nullable first, then set defaults / NOT NULL after data fill).
--   d) Migrate status values: new→fresca, reviewed→analise, starred→aplicada, archived→arquivada.
--   e) Map topic_id → theme_id: match topic slug prefix to nearest theme slug,
--      fall back to 'canal' for anything unmatched.
--   f) Set theme_id NOT NULL now that every row has a value.
--   g) Drop the UNIQUE(site_id, topic_id, title) constraint (topic_id will be nullable).
--   h) Add replacement UNIQUE(site_id, theme_id, title).
--   i) Drop the stale partial index on the old status values; recreate for new values.
-- ============================================================

-- (a) Make topic_id nullable so we can transition rows without breaking FK.
ALTER TABLE public.research_items
  ALTER COLUMN topic_id DROP NOT NULL;

-- (b) Drop old status check. PostgreSQL names inline CHECKs
--     "<table>_<column>_check"; drop defensively.
ALTER TABLE public.research_items
  DROP CONSTRAINT IF EXISTS research_items_status_check;

-- (c) Add new columns.
--     theme_id nullable first — set NOT NULL in step (f) after data migration.
ALTER TABLE public.research_items
  ADD COLUMN IF NOT EXISTS theme_id    text,
  ADD COLUMN IF NOT EXISTS source      text NOT NULL DEFAULT 'thiago'
                                       CHECK (source IN ('thiago', 'cowork', 'dupla')),
  ADD COLUMN IF NOT EXISTS read_min    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pinned      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS takeaways   jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS content_html text;   -- cached render of content_json for read-mode

ALTER TABLE public.research_items
  DROP CONSTRAINT IF EXISTS research_items_takeaways_array;
ALTER TABLE public.research_items
  ADD CONSTRAINT research_items_takeaways_array
    CHECK (jsonb_typeof(takeaways) = 'array');

-- (d) Status migration — single UPDATE per new value to keep the plan
--     readable. All four run atomically inside the outer transaction.
UPDATE public.research_items SET status = 'fresca'   WHERE status = 'new';
UPDATE public.research_items SET status = 'analise'  WHERE status = 'reviewed';
UPDATE public.research_items SET status = 'aplicada' WHERE status = 'starred';
UPDATE public.research_items SET status = 'arquivada' WHERE status = 'archived';

-- Safety net: any status not matching the 4 known old values gets mapped to 'arquivada'
-- to prevent the new CHECK constraint from failing.
UPDATE public.research_items SET status = 'arquivada'
  WHERE status NOT IN ('fresca', 'analise', 'aplicada', 'arquivada');

-- (e) Map topic_id → theme_id.
--     Logic: take the slug of the linked topic and check whether it contains
--     any of the canonical theme ids as a substring.  Falls back to 'canal'.
--     Items that already have theme_id set (re-run safety) are skipped.
UPDATE public.research_items ri
SET theme_id = (
  SELECT
    CASE
      WHEN t.slug ILIKE '%asia%'  OR t.path ILIKE '%asia%'  THEN 'asia'
      WHEN t.slug ~ '(^|/)ia($|/)' OR t.path ~ '(^|/)ia($|/)' THEN 'ia'
      WHEN t.slug ILIKE '%dev%'   OR t.path ILIKE '%dev%'   THEN 'dev'
      WHEN t.slug ILIKE '%games%' OR t.path ILIKE '%games%' THEN 'games'
      WHEN t.slug ILIKE '%grana%' OR t.path ILIKE '%grana%' THEN 'grana'
      ELSE 'canal'
    END
  FROM public.research_topics t
  WHERE t.id = ri.topic_id
)
WHERE ri.theme_id IS NULL AND ri.topic_id IS NOT NULL;

-- Items without a topic_id (should not exist in current prod, but be safe).
UPDATE public.research_items
SET theme_id = 'canal'
WHERE theme_id IS NULL;

-- (f) Now that every row has a theme_id, enforce NOT NULL.
ALTER TABLE public.research_items
  ALTER COLUMN theme_id SET NOT NULL;

-- Add FK from theme_id to research_themes — composite FK (theme_id, site_id).
-- This also validates that every mapped theme actually exists in the catalogue.
ALTER TABLE public.research_items
  DROP CONSTRAINT IF EXISTS research_items_theme_id_fk;
ALTER TABLE public.research_items
  ADD CONSTRAINT research_items_theme_id_fk
    FOREIGN KEY (theme_id, site_id) REFERENCES public.research_themes(id, site_id);

-- (g) Drop old unique constraint that depended on topic_id being meaningful.
ALTER TABLE public.research_items
  DROP CONSTRAINT IF EXISTS research_items_site_id_topic_id_title_key;

-- (h) New uniqueness: a title is unique per theme within a site.
ALTER TABLE public.research_items
  DROP CONSTRAINT IF EXISTS research_items_site_id_theme_id_title_key;
ALTER TABLE public.research_items
  ADD CONSTRAINT research_items_site_id_theme_id_title_key
    UNIQUE (site_id, theme_id, title);

-- (i) Recreate the partial index for the new non-archived status name.
DROP INDEX IF EXISTS idx_research_items_site_status;
CREATE INDEX IF NOT EXISTS idx_research_items_site_status
  ON public.research_items (site_id, status)
  WHERE status != 'arquivada';

-- Add new status CHECK with new lifecycle values (idempotent).
ALTER TABLE public.research_items
  DROP CONSTRAINT IF EXISTS research_items_status_check;
ALTER TABLE public.research_items
  ADD CONSTRAINT research_items_status_check
    CHECK (status IN ('fresca', 'analise', 'aplicada', 'arquivada'));

-- Index for theme filtering (common query pattern).
CREATE INDEX IF NOT EXISTS idx_research_items_theme ON public.research_items (site_id, theme_id);

-- Index for pinned items (small set, partial index is efficient).
CREATE INDEX IF NOT EXISTS idx_research_items_pinned
  ON public.research_items (site_id)
  WHERE pinned = true;


-- ============================================================
-- SECTION 3 — research_decisions
-- A decision is a structured synthesis drawn from research items.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.research_decisions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  title        text        NOT NULL,
  rationale    text,
  horizon      text        NOT NULL DEFAULT 'agora'
               CHECK (horizon IN ('agora', 'proximo', 'explorar')),
  status       text        NOT NULL DEFAULT 'decidido'
               CHECK (status IN ('decidido', 'testando', 'revisar', 'arquivado')),
  theme_id     text,
  date_label   text,
  drives       jsonb       NOT NULL DEFAULT '[]'
               CHECK (jsonb_typeof(drives) = 'array'),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- FK to research_themes (composite, nullable — only enforced when non-NULL).
ALTER TABLE public.research_decisions
  DROP CONSTRAINT IF EXISTS research_decisions_theme_id_fk;
ALTER TABLE public.research_decisions
  ADD CONSTRAINT research_decisions_theme_id_fk
    FOREIGN KEY (theme_id, site_id) REFERENCES public.research_themes(id, site_id);

CREATE INDEX IF NOT EXISTS idx_research_decisions_site ON public.research_decisions (site_id);
CREATE INDEX IF NOT EXISTS idx_research_decisions_horizon
  ON public.research_decisions (site_id, horizon)
  WHERE status != 'arquivado';

DROP TRIGGER IF EXISTS set_updated_at ON public.research_decisions;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.research_decisions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.research_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_decisions_select ON public.research_decisions;
CREATE POLICY research_decisions_select ON public.research_decisions
  FOR SELECT TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS research_decisions_insert ON public.research_decisions;
CREATE POLICY research_decisions_insert ON public.research_decisions
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS research_decisions_update ON public.research_decisions;
CREATE POLICY research_decisions_update ON public.research_decisions
  FOR UPDATE TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS research_decisions_delete ON public.research_decisions;
CREATE POLICY research_decisions_delete ON public.research_decisions
  FOR DELETE TO authenticated
  USING (public.can_edit_site(site_id));


-- ============================================================
-- SECTION 4 — research_decision_sources
-- Join between a decision and the research_items that support it.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.research_decision_sources (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id  uuid        NOT NULL REFERENCES public.research_decisions(id) ON DELETE CASCADE,
  research_id  uuid        NOT NULL REFERENCES public.research_items(id) ON DELETE CASCADE,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE(decision_id, research_id)
);

CREATE INDEX IF NOT EXISTS idx_rds_decision ON public.research_decision_sources (decision_id);
CREATE INDEX IF NOT EXISTS idx_rds_research ON public.research_decision_sources (research_id);

ALTER TABLE public.research_decision_sources ENABLE ROW LEVEL SECURITY;

-- RLS delegates to the parent decision's site check.
DROP POLICY IF EXISTS research_decision_sources_select ON public.research_decision_sources;
CREATE POLICY research_decision_sources_select ON public.research_decision_sources
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.research_decisions d
    WHERE d.id = decision_id AND public.can_view_site(d.site_id)
  ));

DROP POLICY IF EXISTS research_decision_sources_insert ON public.research_decision_sources;
CREATE POLICY research_decision_sources_insert ON public.research_decision_sources
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.research_decisions d
    WHERE d.id = decision_id AND public.can_edit_site(d.site_id)
  ));

DROP POLICY IF EXISTS research_decision_sources_update ON public.research_decision_sources;
CREATE POLICY research_decision_sources_update ON public.research_decision_sources
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.research_decisions d
    WHERE d.id = decision_id AND public.can_edit_site(d.site_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.research_decisions d
    WHERE d.id = decision_id AND public.can_edit_site(d.site_id)
  ));

DROP POLICY IF EXISTS research_decision_sources_delete ON public.research_decision_sources;
CREATE POLICY research_decision_sources_delete ON public.research_decision_sources
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.research_decisions d
    WHERE d.id = decision_id AND public.can_edit_site(d.site_id)
  ));


-- ============================================================
-- SECTION 5 — research_focos
-- A "foco" is the active research focus for a site — at most ONE
-- active foco per site at any time.
--
-- Single-active constraint: partial unique index on (site_id) WHERE
-- active = true.  This is enforced at the DB level without triggers.
-- The activate_research_foco RPC deactivates all others before
-- activating the target — both in one transaction for safety.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.research_focos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  title        text        NOT NULL,
  description  text,
  state        text        NOT NULL DEFAULT 'rascunho'
               CHECK (state IN ('ativo', 'proposto', 'rascunho', 'arquivado')),
  horizon      text        NOT NULL DEFAULT 'agora'
               CHECK (horizon IN ('agora', 'proximo', 'explorar')),
  active       boolean     NOT NULL DEFAULT false,
  author       text        NOT NULL DEFAULT 'thiago'
               CHECK (author IN ('thiago', 'cowork')),
  rationale    text,
  metric       text,
  window_label text,
  started_at   timestamptz,
  ended_at     timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Single-active constraint: only one row per site_id can have active = true.
-- A partial unique index is the idiomatic PostgreSQL approach — no trigger needed.
DROP INDEX IF EXISTS idx_research_focos_single_active;
CREATE UNIQUE INDEX idx_research_focos_single_active
  ON public.research_focos (site_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_research_focos_site ON public.research_focos (site_id);

DROP TRIGGER IF EXISTS set_updated_at ON public.research_focos;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.research_focos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.research_focos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_focos_select ON public.research_focos;
CREATE POLICY research_focos_select ON public.research_focos
  FOR SELECT TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS research_focos_insert ON public.research_focos;
CREATE POLICY research_focos_insert ON public.research_focos
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS research_focos_update ON public.research_focos;
CREATE POLICY research_focos_update ON public.research_focos
  FOR UPDATE TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS research_focos_delete ON public.research_focos;
CREATE POLICY research_focos_delete ON public.research_focos
  FOR DELETE TO authenticated
  USING (public.can_edit_site(site_id));


-- ============================================================
-- SECTION 6 — research_foco_themes
-- Which themes are in scope for the active foco.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.research_foco_themes (
  foco_id    uuid NOT NULL REFERENCES public.research_focos(id) ON DELETE CASCADE,
  theme_id   text NOT NULL,
  site_id    uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (foco_id, theme_id),
  FOREIGN KEY (theme_id, site_id) REFERENCES public.research_themes(id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_rft_foco ON public.research_foco_themes (foco_id);

ALTER TABLE public.research_foco_themes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_foco_themes_select ON public.research_foco_themes;
CREATE POLICY research_foco_themes_select ON public.research_foco_themes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.research_focos f
    WHERE f.id = foco_id AND public.can_view_site(f.site_id)
  ));

DROP POLICY IF EXISTS research_foco_themes_insert ON public.research_foco_themes;
CREATE POLICY research_foco_themes_insert ON public.research_foco_themes
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.research_focos f
    WHERE f.id = foco_id AND public.can_edit_site(f.site_id)
  ));

DROP POLICY IF EXISTS research_foco_themes_update ON public.research_foco_themes;
CREATE POLICY research_foco_themes_update ON public.research_foco_themes
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.research_focos f
    WHERE f.id = foco_id AND public.can_edit_site(f.site_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.research_focos f
    WHERE f.id = foco_id AND public.can_edit_site(f.site_id)
  ));

DROP POLICY IF EXISTS research_foco_themes_delete ON public.research_foco_themes;
CREATE POLICY research_foco_themes_delete ON public.research_foco_themes
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.research_focos f
    WHERE f.id = foco_id AND public.can_edit_site(f.site_id)
  ));


-- ============================================================
-- SECTION 7 — research_foco_sources
-- Research items explicitly pinned into a foco as its source material.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.research_foco_sources (
  foco_id    uuid NOT NULL REFERENCES public.research_focos(id) ON DELETE CASCADE,
  item_id    uuid NOT NULL REFERENCES public.research_items(id) ON DELETE CASCADE,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (foco_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_rfs_foco ON public.research_foco_sources (foco_id);
CREATE INDEX IF NOT EXISTS idx_rfs_item ON public.research_foco_sources (item_id);

ALTER TABLE public.research_foco_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_foco_sources_select ON public.research_foco_sources;
CREATE POLICY research_foco_sources_select ON public.research_foco_sources
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.research_focos f
    WHERE f.id = foco_id AND public.can_view_site(f.site_id)
  ));

DROP POLICY IF EXISTS research_foco_sources_insert ON public.research_foco_sources;
CREATE POLICY research_foco_sources_insert ON public.research_foco_sources
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.research_focos f
    WHERE f.id = foco_id AND public.can_edit_site(f.site_id)
  ));

DROP POLICY IF EXISTS research_foco_sources_update ON public.research_foco_sources;
CREATE POLICY research_foco_sources_update ON public.research_foco_sources
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.research_focos f
    WHERE f.id = foco_id AND public.can_edit_site(f.site_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.research_focos f
    WHERE f.id = foco_id AND public.can_edit_site(f.site_id)
  ));

DROP POLICY IF EXISTS research_foco_sources_delete ON public.research_foco_sources;
CREATE POLICY research_foco_sources_delete ON public.research_foco_sources
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.research_focos f
    WHERE f.id = foco_id AND public.can_edit_site(f.site_id)
  ));


-- ============================================================
-- SECTION 8 — RPC: activate_research_foco
--
-- Atomically deactivates all other focos for the site, then
-- activates the target foco and stamps started_at.
-- The partial unique index on (site_id) WHERE active = true
-- provides the hard constraint; this RPC is the controlled path.
--
-- Arguments:
--   p_foco_id  uuid  — the foco to activate
--   p_site_id  uuid  — must match foco.site_id (caller-supplied for RLS check)
--
-- Returns: the updated research_focos row.
-- ============================================================

CREATE OR REPLACE FUNCTION public.activate_research_foco(
  p_foco_id uuid,
  p_site_id uuid
)
RETURNS public.research_focos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_foco public.research_focos;
BEGIN
  -- Verify caller can edit this site.
  IF NOT public.can_edit_site(p_site_id) THEN
    RAISE EXCEPTION 'permission denied for site %', p_site_id
      USING ERRCODE = '42501';
  END IF;

  -- Verify the foco belongs to the declared site.
  IF NOT EXISTS (
    SELECT 1 FROM public.research_focos
    WHERE id = p_foco_id AND site_id = p_site_id
  ) THEN
    RAISE EXCEPTION 'foco % not found for site %', p_foco_id, p_site_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Deactivate the previously active foco (sets ended_at + transitions state).
  UPDATE public.research_focos
  SET
    active     = false,
    state      = 'arquivado',
    ended_at   = now(),
    updated_at = now()
  WHERE site_id = p_site_id
    AND id != p_foco_id
    AND active = true;

  -- Activate the target foco.
  UPDATE public.research_focos
  SET
    active     = true,
    state      = 'ativo',
    started_at = COALESCE(started_at, now()),
    ended_at   = NULL,
    updated_at = now()
  WHERE id = p_foco_id
  RETURNING * INTO v_foco;

  RETURN v_foco;
END;
$$;

-- Grant execute to authenticated users (RLS-equivalent for functions).
REVOKE ALL ON FUNCTION public.activate_research_foco(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_research_foco(uuid, uuid) TO authenticated;


-- ============================================================
-- SECTION 9 — RPC: save_research_foco_full
--
-- Upserts a foco plus its theme list and item sources in one call.
-- Replaces the theme and source lists entirely (delete-then-insert).
-- Optionally activates the foco after saving if p_activate = true.
--
-- Arguments:
--   p_site_id    uuid
--   p_foco_id    uuid | NULL  — NULL = INSERT new foco
--   p_title      text
--   p_description text | NULL
--   p_theme_ids  text[]       — canonical theme slugs
--   p_item_ids   uuid[]       — research_items to attach as sources
--   p_activate   boolean      — if true, activate after save
--
-- Returns: the foco row after save (and optional activation).
-- ============================================================

CREATE OR REPLACE FUNCTION public.save_research_foco_full(
  p_site_id      uuid,
  p_foco_id      uuid,
  p_title        text,
  p_description  text,
  p_state        text DEFAULT 'rascunho',
  p_rationale    text DEFAULT NULL,
  p_metric       text DEFAULT NULL,
  p_window_label text DEFAULT NULL,
  p_horizon      text DEFAULT 'agora',
  p_theme_ids    text[] DEFAULT ARRAY[]::text[],
  p_item_ids     uuid[] DEFAULT ARRAY[]::uuid[],
  p_item_notes   jsonb DEFAULT '{}'::jsonb,
  p_activate     boolean DEFAULT false
)
RETURNS public.research_focos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_foco_id uuid;
  v_foco    public.research_focos;
  v_theme   text;
  v_item    uuid;
BEGIN
  -- Permission check.
  IF NOT public.can_edit_site(p_site_id) THEN
    RAISE EXCEPTION 'permission denied for site %', p_site_id
      USING ERRCODE = '42501';
  END IF;

  IF p_foco_id IS NOT NULL THEN
    -- UPDATE existing foco.
    UPDATE public.research_focos
    SET
      title        = p_title,
      description  = p_description,
      state        = p_state,
      rationale    = p_rationale,
      metric       = p_metric,
      window_label = p_window_label,
      horizon      = p_horizon,
      updated_at   = now()
    WHERE id = p_foco_id AND site_id = p_site_id
    RETURNING id INTO v_foco_id;

    IF v_foco_id IS NULL THEN
      RAISE EXCEPTION 'foco % not found for site %', p_foco_id, p_site_id
        USING ERRCODE = 'P0002';
    END IF;
  ELSE
    -- INSERT new foco.
    INSERT INTO public.research_focos (site_id, title, description, state, rationale, metric, window_label, horizon)
    VALUES (p_site_id, p_title, p_description, p_state, p_rationale, p_metric, p_window_label, p_horizon)
    RETURNING id INTO v_foco_id;
  END IF;

  -- Replace theme list: delete all, re-insert supplied list.
  DELETE FROM public.research_foco_themes WHERE foco_id = v_foco_id;
  FOREACH v_theme IN ARRAY COALESCE(p_theme_ids, ARRAY[]::text[]) LOOP
    INSERT INTO public.research_foco_themes (foco_id, theme_id, site_id)
    VALUES (v_foco_id, v_theme, p_site_id)
    ON CONFLICT (foco_id, theme_id) DO NOTHING;
  END LOOP;

  -- Replace item-source list: delete all, re-insert supplied list.
  DELETE FROM public.research_foco_sources WHERE foco_id = v_foco_id;
  FOREACH v_item IN ARRAY COALESCE(p_item_ids, ARRAY[]::uuid[]) LOOP
    INSERT INTO public.research_foco_sources (foco_id, item_id, note)
    VALUES (v_foco_id, v_item, p_item_notes ->> v_item::text)
    ON CONFLICT (foco_id, item_id) DO NOTHING;
  END LOOP;

  -- Optionally activate (delegates to activate_research_foco for atomicity).
  IF p_activate THEN
    SELECT * INTO v_foco
    FROM public.activate_research_foco(v_foco_id, p_site_id);
  ELSE
    SELECT * INTO v_foco
    FROM public.research_focos
    WHERE id = v_foco_id;
  END IF;

  RETURN v_foco;
END;
$$;

REVOKE ALL ON FUNCTION public.save_research_foco_full(uuid, uuid, text, text, text, text, text, text, text, text[], uuid[], jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_research_foco_full(uuid, uuid, text, text, text, text, text, text, text, text[], uuid[], jsonb, boolean) TO authenticated;

COMMIT;
