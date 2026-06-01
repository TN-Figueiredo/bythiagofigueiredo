-- =============================================================================
-- MIGRATION: P7 item 7.2 — Atomic cycle rotation RPC
-- Wraps close+open+marker-clear in a single transaction to prevent partial
-- state on crash. Available for callers (ab-rotate, forceRotate) to opt-in
-- when ready — no existing callers are changed by this migration.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rotate_cycle(
  p_test_id uuid,
  p_new_variant_id uuid,
  p_cycle_number integer,
  p_applied_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_cycle_id uuid;
BEGIN
  -- 1. Close current open cycle
  UPDATE ab_test_cycles
  SET ended_at = now()
  WHERE test_id = p_test_id AND ended_at IS NULL;

  -- 2. Insert new cycle
  INSERT INTO ab_test_cycles (test_id, variant_id, cycle_number, started_at, applied_metadata)
  VALUES (p_test_id, p_new_variant_id, p_cycle_number, now(), p_applied_metadata)
  RETURNING id INTO new_cycle_id;

  -- 3. Clear write-ahead marker
  UPDATE ab_tests
  SET last_applied_variant_id = NULL
  WHERE id = p_test_id;

  RETURN new_cycle_id;
END;
$$;
