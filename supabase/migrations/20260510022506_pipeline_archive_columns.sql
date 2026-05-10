-- Add archive metadata columns to content_pipeline
ALTER TABLE public.content_pipeline
  ADD COLUMN IF NOT EXISTS archived_at    timestamptz,
  ADD COLUMN IF NOT EXISTS archive_reason text;
