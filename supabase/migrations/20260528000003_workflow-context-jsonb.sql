-- =============================================================================
-- MIGRATION: Add workflow_context JSONB column to content_pipeline
-- Accumulates step outputs during cross-domain workflows
-- (research -> script -> thumbnail -> A/B test).
-- =============================================================================

ALTER TABLE content_pipeline
  ADD COLUMN IF NOT EXISTS workflow_context jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN content_pipeline.workflow_context IS
  'Accumulated context from cross-domain MCP workflow steps. Each key is a step ID, value is the step output.';
