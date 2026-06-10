-- =============================================================================
-- MIGRATION: add_blog_distribution_plan
-- =============================================================================

-- Plano de distribuição social escolhido no editor de blog (per-post, shared
-- entre idiomas). Shape: {"instagram": "with" | "plus1" | "plus1d", ...}
alter table blog_posts
  add column if not exists distribution_plan jsonb not null default '{}'::jsonb;
