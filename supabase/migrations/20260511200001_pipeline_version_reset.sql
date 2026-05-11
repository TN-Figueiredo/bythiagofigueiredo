-- Fix: reset inflated versions caused by Cowork retry loop.
-- The trigger handles version increment, so the API no longer sets it manually.
-- Reset each item's version to its actual edit count (sum of section revs).

ALTER TABLE public.content_pipeline DISABLE TRIGGER trg_pipeline_updated_at;

UPDATE public.content_pipeline
SET version = GREATEST(
  COALESCE(
    (SELECT SUM((v->>'rev')::int)
     FROM jsonb_each(sections) AS x(key, v)
     WHERE v->>'rev' IS NOT NULL),
    1
  ),
  1
);

ALTER TABLE public.content_pipeline ENABLE TRIGGER trg_pipeline_updated_at;
