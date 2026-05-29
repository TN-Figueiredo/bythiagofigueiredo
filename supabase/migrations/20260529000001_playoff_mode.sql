-- Playoff Mode: Round 2 support for AB Lab

-- ab_tests: new columns
ALTER TABLE ab_tests
  ADD COLUMN IF NOT EXISTS parent_test_id UUID REFERENCES ab_tests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS round_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS playoff_test_id UUID REFERENCES ab_tests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS playoff_start_after TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS ab_tests_one_playoff_per_parent
  ON ab_tests (parent_test_id) WHERE parent_test_id IS NOT NULL;

-- ab_test_variants: track which Round 1 variant was cloned
ALTER TABLE ab_test_variants
  ADD COLUMN IF NOT EXISTS source_variant_id UUID REFERENCES ab_test_variants(id) ON DELETE SET NULL;

-- Prevent duplicate cycles from race conditions (auto-start + user start)
CREATE UNIQUE INDEX IF NOT EXISTS ab_test_cycles_test_cycle_unique
  ON ab_test_cycles (test_id, cycle_number);

-- Transactional RPC — hardened after adversarial audit
CREATE OR REPLACE FUNCTION create_playoff_test(
  p_parent_test_id UUID,
  p_variant_ids UUID[],
  p_cooldown_hours INTEGER DEFAULT 4
) RETURNS UUID AS $$
DECLARE
  v_parent ab_tests%ROWTYPE;
  v_new_test_id UUID := gen_random_uuid();
  v_variant RECORD;
  v_new_variant_id UUID;
  v_sort INT := 0;
  v_copied INT := 0;
BEGIN
  SELECT * INTO v_parent FROM ab_tests WHERE id = p_parent_test_id FOR UPDATE;

  IF v_parent IS NULL THEN RAISE EXCEPTION 'Parent test not found'; END IF;
  IF v_parent.status != 'completed' THEN
    RAISE EXCEPTION 'Parent must be completed (got: %)', v_parent.status;
  END IF;
  IF v_parent.completed_reason != 'inconclusive' THEN
    RAISE EXCEPTION 'Only inconclusive tests spawn playoffs (got: %)', v_parent.completed_reason;
  END IF;
  IF v_parent.playoff_test_id IS NOT NULL THEN
    RAISE EXCEPTION 'Playoff already exists: %', v_parent.playoff_test_id;
  END IF;
  IF v_parent.round_number != 1 THEN
    RAISE EXCEPTION 'Only Round 1 tests can spawn playoffs';
  END IF;
  IF array_length(p_variant_ids, 1) IS NULL OR array_length(p_variant_ids, 1) != 2 THEN
    RAISE EXCEPTION 'Playoff requires exactly 2 variant IDs, got %',
      coalesce(array_length(p_variant_ids, 1), 0);
  END IF;
  IF EXISTS (
    SELECT 1 FROM ab_tests
    WHERE youtube_video_id = v_parent.youtube_video_id
      AND status IN ('draft', 'active', 'paused')
      AND id != p_parent_test_id
  ) THEN
    RAISE EXCEPTION 'Video already has an active/draft/paused test';
  END IF;
  IF EXISTS (
    SELECT 1 FROM ab_test_cycles
    WHERE test_id = p_parent_test_id
      AND backfill_status IN ('pending', 'partial')
  ) THEN
    RAISE EXCEPTION 'Parent test has non-terminal backfill cycles';
  END IF;

  INSERT INTO ab_tests (
    id, site_id, youtube_video_id, source_pipeline_id,
    name, status, config, test_type,
    original_thumbnail_url, original_title, original_description,
    round_number, parent_test_id, playoff_start_after
  ) VALUES (
    v_new_test_id, v_parent.site_id, v_parent.youtube_video_id,
    v_parent.source_pipeline_id,
    v_parent.name || ' — Playoff', 'draft', v_parent.config, v_parent.test_type,
    v_parent.original_thumbnail_url, v_parent.original_title,
    v_parent.original_description,
    2, p_parent_test_id, now() + (p_cooldown_hours * INTERVAL '1 hour')
  );

  FOR v_variant IN
    SELECT * FROM ab_test_variants
    WHERE id = ANY(p_variant_ids)
      AND test_id = p_parent_test_id
    ORDER BY sort_order
  LOOP
    v_new_variant_id := gen_random_uuid();
    INSERT INTO ab_test_variants (
      id, test_id, label, is_original, blob_url, blob_key,
      file_size_bytes, dimensions, title_text, description_text,
      metadata, sort_order, source_variant_id
    ) VALUES (
      v_new_variant_id, v_new_test_id, v_variant.label, v_variant.is_original,
      v_variant.blob_url, v_variant.blob_key, v_variant.file_size_bytes,
      v_variant.dimensions, v_variant.title_text, v_variant.description_text,
      v_variant.metadata, v_sort, v_variant.id
    );
    v_sort := v_sort + 1;
    v_copied := v_copied + 1;
  END LOOP;

  IF v_copied != 2 THEN
    RAISE EXCEPTION 'Expected 2 variants from parent test, found %', v_copied;
  END IF;

  INSERT INTO ab_test_tracked_links (ab_test_id, variant_id, link_id, template_name, short_code)
  SELECT v_new_test_id, nv.id, tl.link_id, tl.template_name, tl.short_code
  FROM ab_test_tracked_links tl
  JOIN ab_test_variants nv ON nv.source_variant_id = tl.variant_id
  WHERE tl.ab_test_id = p_parent_test_id
    AND tl.variant_id = ANY(p_variant_ids)
    AND nv.test_id = v_new_test_id;

  UPDATE ab_tests SET playoff_test_id = v_new_test_id WHERE id = p_parent_test_id;

  RETURN v_new_test_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION create_playoff_test FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_playoff_test TO service_role;
