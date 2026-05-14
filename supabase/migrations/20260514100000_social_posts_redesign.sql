-- supabase/migrations/20260514100000_social_posts_redesign.sql
-- Social Posts Redesign: extend social_posts, social_deliveries, and content tables

-- ---------------------------------------------------------------------------
-- 1. social_posts — new columns for content-driven pipeline
-- ---------------------------------------------------------------------------

-- Origem do conteudo (qual tipo de conteudo CMS gerou este social post)
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS source_content_type TEXT
    CHECK (source_content_type IN ('blog','newsletter','campaign','video'));

-- Referencia ao conteudo fonte (FK logica, sem constraint — tabelas distintas)
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS source_content_id UUID;

-- Como o post foi criado
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual'
    CHECK (origin IN ('manual','auto','publish_modal'));

-- Short link gerado pelo Links Engine
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS short_link_id UUID REFERENCES tracked_links(id);

-- Tracking de cada etapa do pipeline (append-only JSONB array)
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS pipeline_steps JSONB NOT NULL DEFAULT '[]';

-- ---------------------------------------------------------------------------
-- 2. social_deliveries — format and template config
-- ---------------------------------------------------------------------------

-- Formato de entrega por plataforma
ALTER TABLE social_deliveries
  ADD COLUMN IF NOT EXISTS format TEXT
    CHECK (format IN ('link_share','image_post','story','reel','link_card','video_share'));

-- Configuracao de template especifica por formato
ALTER TABLE social_deliveries
  ADD COLUMN IF NOT EXISTS template_config JSONB;

-- ---------------------------------------------------------------------------
-- 3. Content tables — social_config JSONB
-- ---------------------------------------------------------------------------

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS social_config JSONB;

ALTER TABLE newsletter_editions
  ADD COLUMN IF NOT EXISTS social_config JSONB;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS social_config JSONB;

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------

-- Busca rapida: qual social post corresponde a este conteudo?
CREATE INDEX IF NOT EXISTS idx_social_posts_source
  ON social_posts(source_content_type, source_content_id)
  WHERE source_content_id IS NOT NULL;

-- Busca por short link (join com tracked_links para analytics)
CREATE INDEX IF NOT EXISTS idx_social_posts_short_link
  ON social_posts(short_link_id)
  WHERE short_link_id IS NOT NULL;

-- Unique partial index: no maximo 1 social post ativo por conteudo
-- Impede duplicacao acidental quando pipeline esta em andamento
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_posts_active_per_content
  ON social_posts(site_id, source_content_type, source_content_id)
  WHERE status IN ('draft','scheduled','publishing')
    AND source_content_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. RPC: atomic pipeline step update (avoids read-modify-write race)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_pipeline_step(
  p_post_id UUID, p_step_name TEXT, p_patch JSONB
) RETURNS VOID AS $$
DECLARE
  idx INT;
BEGIN
  SELECT ordinality - 1 INTO idx
  FROM social_posts, jsonb_array_elements(pipeline_steps) WITH ORDINALITY AS e(elem, ordinality)
  WHERE id = p_post_id AND elem->>'step' = p_step_name;

  IF idx IS NOT NULL THEN
    UPDATE social_posts
    SET pipeline_steps = jsonb_set(pipeline_steps, ARRAY[idx::TEXT], p_patch)
    WHERE id = p_post_id;
  ELSE
    UPDATE social_posts
    SET pipeline_steps = pipeline_steps || jsonb_build_array(p_patch)
    WHERE id = p_post_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
