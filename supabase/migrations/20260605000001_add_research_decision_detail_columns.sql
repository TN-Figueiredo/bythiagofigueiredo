-- =============================================================================
-- MIGRATION: add research decision detail columns
-- =============================================================================
-- The redesigned Decisões fullscreen (DecisionDoc) renders richer fields than
-- the list card: the scenario (context), concrete implications (consequences),
-- a success metric, a revisit date, and a status/provenance timeline (history).
-- README "Data model" (design_handoff_research_cms) requires all five.
-- Arrays follow the existing `drives jsonb` convention on this table.

ALTER TABLE public.research_decisions
  ADD COLUMN IF NOT EXISTS context      text,
  ADD COLUMN IF NOT EXISTS consequences jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS metric       text,
  ADD COLUMN IF NOT EXISTS revisit      text,
  ADD COLUMN IF NOT EXISTS history      jsonb NOT NULL DEFAULT '[]';

-- Enforce array shape on the two jsonb columns (mirrors the `drives` CHECK).
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

COMMENT ON COLUMN public.research_decisions.context      IS 'The scenario that makes the decision necessary (fullscreen).';
COMMENT ON COLUMN public.research_decisions.consequences IS 'Concrete implications — "what this decides" (string[]).';
COMMENT ON COLUMN public.research_decisions.metric       IS 'Success metric shown in the decision inspector.';
COMMENT ON COLUMN public.research_decisions.revisit      IS 'When to revisit, e.g. "Fim de ago 2026".';
COMMENT ON COLUMN public.research_decisions.history      IS 'Status/provenance timeline: [{ label, date, note }].';
