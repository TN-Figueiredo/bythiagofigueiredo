-- Add sort_order column to content_pipeline for manual drag-and-drop reordering.
-- Items are spaced by 1000 to allow insertions between existing items.

-- 1. Idempotent column addition
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'content_pipeline'
      AND column_name  = 'sort_order'
  ) THEN
    ALTER TABLE public.content_pipeline
      ADD COLUMN sort_order int NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 2. Backfill: preserve current visual ordering (priority DESC, updated_at DESC)
--    as initial sort_order values, partitioned per site/format/stage lane.
UPDATE public.content_pipeline
SET sort_order = sub.rn
FROM (
  SELECT id,
         (ROW_NUMBER() OVER (
           PARTITION BY site_id, format, stage
           ORDER BY priority DESC, updated_at DESC
         ) * 1000)::int AS rn
  FROM public.content_pipeline
) sub
WHERE content_pipeline.id = sub.id;

-- 3. Index for efficient Kanban lane queries (active items only)
CREATE INDEX IF NOT EXISTS idx_pipeline_sort_order_active
  ON public.content_pipeline (site_id, format, stage, sort_order)
  WHERE NOT is_archived;
