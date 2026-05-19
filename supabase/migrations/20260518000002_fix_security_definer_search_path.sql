-- Fix SECURITY DEFINER function missing SET search_path
-- Prevents privilege-escalation via search_path injection.

CREATE OR REPLACE FUNCTION public.update_pipeline_step(
  p_post_id   UUID,
  p_step_name TEXT,
  p_patch     JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  idx INT;
BEGIN
  IF p_step_name NOT IN ('post_created', 'short_link', 'platform_prepare', 'deliver') THEN
    RAISE EXCEPTION 'update_pipeline_step: invalid step name "%"', p_step_name
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_patch->>'step' IS NULL OR p_patch->>'status' IS NULL OR p_patch->>'at' IS NULL THEN
    RAISE EXCEPTION 'update_pipeline_step: p_patch must contain "step", "status", and "at" fields'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

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
$$;
