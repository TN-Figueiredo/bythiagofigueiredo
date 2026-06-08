-- =============================================================================
-- MIGRATION: video_ideia_per_language
-- Backfill video ideia_shared → per-language keys. Additive, idempotent, one-way.
-- pt-br → ideia_pt only; en → ideia_en only; both → ideia_pt AND ideia_en.
-- =============================================================================

-- pt-br items
UPDATE content_pipeline
SET sections = jsonb_set(sections, '{ideia_pt}', sections->'ideia_shared')
WHERE format = 'video' AND language = 'pt-br'
  AND sections ? 'ideia_shared' AND NOT (sections ? 'ideia_pt');

-- en items
UPDATE content_pipeline
SET sections = jsonb_set(sections, '{ideia_en}', sections->'ideia_shared')
WHERE format = 'video' AND language = 'en'
  AND sections ? 'ideia_shared' AND NOT (sections ? 'ideia_en');

-- both items → ideia_pt
UPDATE content_pipeline
SET sections = jsonb_set(sections, '{ideia_pt}', sections->'ideia_shared')
WHERE format = 'video' AND language = 'both'
  AND sections ? 'ideia_shared' AND NOT (sections ? 'ideia_pt');

-- both items → ideia_en
UPDATE content_pipeline
SET sections = jsonb_set(sections, '{ideia_en}', sections->'ideia_shared')
WHERE format = 'video' AND language = 'both'
  AND sections ? 'ideia_shared' AND NOT (sections ? 'ideia_en');
