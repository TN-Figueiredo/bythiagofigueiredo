-- Partial index for velocity queries: stage transitions by date
-- Supports: SELECT ... FROM content_pipeline_history
--           WHERE event_type = 'stage_change' AND changed_at >= $1
--           ORDER BY changed_at DESC LIMIT 5000

CREATE INDEX IF NOT EXISTS idx_pipeline_history_velocity
  ON public.content_pipeline_history (changed_at DESC)
  WHERE event_type = 'stage_change';
