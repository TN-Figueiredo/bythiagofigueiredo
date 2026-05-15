-- Covers cursor-based pagination in GET /api/pipeline/research
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_research_items_pagination
  ON public.research_items (site_id, created_at DESC, id DESC);
