BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS ab_test_variants_test_id_label_idx
  ON public.ab_test_variants(test_id, label);

CREATE INDEX IF NOT EXISTS ab_test_variants_test_id_idx
  ON public.ab_test_variants(test_id);

COMMENT ON COLUMN public.ab_test_variants.metadata IS
  'Cowork-facing metadata: thumbnail_tags, title_pattern, emotional_triggers, visual_description, ai_image_prompt, creative_direction, rationale';

COMMIT;
