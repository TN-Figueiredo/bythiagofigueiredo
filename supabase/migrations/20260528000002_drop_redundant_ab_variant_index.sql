-- The composite unique index ab_test_variants_test_id_label_idx (test_id, label)
-- already covers test_id as the leading column, making the single-column index redundant.
DROP INDEX IF EXISTS public.ab_test_variants_test_id_idx;
