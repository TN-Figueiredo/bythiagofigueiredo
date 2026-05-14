-- supabase/migrations/20260515000002_fix_pipeline_step_rpc_security.sql
-- Security hardening: add input validation to update_pipeline_step RPC.
--
-- SECURITY DEFINER is intentional: this function is called from server-side
-- pipeline workers (via service role or anon context) that need to write
-- pipeline_steps without exposing a blanket UPDATE policy on social_posts.
-- The explicit validation below replaces row-level trust with parameter-level
-- trust so an authenticated-but-unprivileged caller cannot mutate arbitrary
-- steps or inject malformed JSONB.

CREATE OR REPLACE FUNCTION update_pipeline_step(
  p_post_id   UUID,
  p_step_name TEXT,
  p_patch     JSONB
) RETURNS VOID AS $$
DECLARE
  idx INT;
BEGIN
  -- 1. Validate step name against the known pipeline stages.
  IF p_step_name NOT IN ('post_created', 'short_link', 'og_scrape', 'deliver') THEN
    RAISE EXCEPTION 'update_pipeline_step: invalid step name "%"', p_step_name
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 2. Validate that the patch object contains the required fields.
  IF p_patch->>'step' IS NULL OR p_patch->>'status' IS NULL OR p_patch->>'at' IS NULL THEN
    RAISE EXCEPTION 'update_pipeline_step: p_patch must contain "step", "status", and "at" fields'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 3. Perform the atomic upsert into pipeline_steps (no read-modify-write race).
  SELECT ordinality - 1 INTO idx
  FROM social_posts,
       jsonb_array_elements(pipeline_steps) WITH ORDINALITY AS e(elem, ordinality)
  WHERE id = p_post_id AND elem->>'step' = p_step_name;

  IF idx IS NOT NULL THEN
    UPDATE social_posts
    SET pipeline_steps = jsonb_set(pipeline_steps, ARRAY[idx::TEXT], p_patch)
    WHERE id = p_post_id;
  ELSE
    UPDATE social_posts
    SET pipeline_steps = pipeline_steps || jsonb_build_array(p_patch)
    WHERE id = p_post_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
