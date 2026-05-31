-- =============================================================================
-- MIGRATION: Add write-ahead marker for AB test rotation crash recovery
-- =============================================================================

ALTER TABLE ab_tests ADD COLUMN IF NOT EXISTS last_applied_variant_id uuid;
