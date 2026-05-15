-- Fix BTF-015 / BTF-016: SECURITY DEFINER without SET search_path
-- on update_pipeline_step(). Both 20260514100000 and 20260515000002
-- declared the function as SECURITY DEFINER but omitted search_path,
-- allowing potential search_path hijacking.
--
-- This migration recreates the function with:
--   1. SET search_path = '' (forces fully qualified references)
--   2. All table references qualified as public.social_posts
--   3. Same input-validation logic from 20260515000002

DROP FUNCTION IF EXISTS public.update_pipeline_step(UUID, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.update_pipeline_step(
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
  FROM public.social_posts,
       jsonb_array_elements(pipeline_steps) WITH ORDINALITY AS e(elem, ordinality)
  WHERE id = p_post_id AND elem->>'step' = p_step_name;

  IF idx IS NOT NULL THEN
    UPDATE public.social_posts
    SET pipeline_steps = jsonb_set(pipeline_steps, ARRAY[idx::TEXT], p_patch)
    WHERE id = p_post_id;
  ELSE
    UPDATE public.social_posts
    SET pipeline_steps = pipeline_steps || jsonb_build_array(p_patch)
    WHERE id = p_post_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
