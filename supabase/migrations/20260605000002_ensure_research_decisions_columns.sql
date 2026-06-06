-- =============================================================================
-- MIGRATION: ensure research_decisions has the full canonical column set
-- =============================================================================
-- Migration-history repair: an earlier (reverted) variant created
-- research_decisions in prod WITHOUT some columns, and the canonical
-- `CREATE TABLE IF NOT EXISTS` in 20260604000003 was skipped because the
-- table already existed. The seed exposed this: inserts failed on the
-- missing `drives` column. This migration additively guarantees every
-- column the app/types expect, idempotently, then reloads the PostgREST
-- schema cache so the API layer sees them immediately.

ALTER TABLE public.research_decisions
  ADD COLUMN IF NOT EXISTS rationale    text,
  ADD COLUMN IF NOT EXISTS theme_id     text,
  ADD COLUMN IF NOT EXISTS date_label   text,
  ADD COLUMN IF NOT EXISTS drives       jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS context      text,
  ADD COLUMN IF NOT EXISTS consequences jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS metric       text,
  ADD COLUMN IF NOT EXISTS revisit      text,
  ADD COLUMN IF NOT EXISTS history      jsonb NOT NULL DEFAULT '[]';

-- Array-shape guards (mirror the canonical table; idempotent).
ALTER TABLE public.research_decisions
  DROP CONSTRAINT IF EXISTS research_decisions_drives_is_array;
ALTER TABLE public.research_decisions
  ADD CONSTRAINT research_decisions_drives_is_array
    CHECK (jsonb_typeof(drives) = 'array');

ALTER TABLE public.research_decisions
  DROP CONSTRAINT IF EXISTS research_decisions_consequences_is_array;
ALTER TABLE public.research_decisions
  ADD CONSTRAINT research_decisions_consequences_is_array
    CHECK (jsonb_typeof(consequences) = 'array');

ALTER TABLE public.research_decisions
  DROP CONSTRAINT IF EXISTS research_decisions_history_is_array;
ALTER TABLE public.research_decisions
  ADD CONSTRAINT research_decisions_history_is_array
    CHECK (jsonb_typeof(history) = 'array');

-- Force PostgREST to reload its schema cache so the new columns are
-- visible to the API (supabase-js / MCP) without waiting for the
-- periodic reload.
NOTIFY pgrst, 'reload schema';
