-- =============================================================================
-- MIGRATION: newsletter subscription attribution (UTM + referrer)
-- =============================================================================
-- newsletter_subscriptions só guardava email/status/ip/locale/newsletter_id —
-- sem como atribuir um inscrito ao conteúdo que o trouxe. Sem isso, métricas de
-- foco do tipo "≥300 subs vindos de AI Empire" não são rastreáveis.
-- Adiciona o conjunto UTM padrão + referrer, todos nullable (signup orgânico
-- não carrega UTM). Captura é feita no signup (server actions públicas).

ALTER TABLE public.newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS utm_source   text,
  ADD COLUMN IF NOT EXISTS utm_medium   text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content  text,
  ADD COLUMN IF NOT EXISTS utm_term     text,
  ADD COLUMN IF NOT EXISTS referrer     text;

COMMENT ON COLUMN public.newsletter_subscriptions.utm_campaign IS
  'Campanha de origem do inscrito (ex.: ai-empire). Base da atribuição de foco.';

-- Índice parcial para consultas de atribuição por campanha (ex.: contar subs de
-- ai-empire) sem pesar a tabela inteira — só linhas com utm_campaign.
CREATE INDEX IF NOT EXISTS idx_newsletter_subs_utm_campaign
  ON public.newsletter_subscriptions (utm_campaign)
  WHERE utm_campaign IS NOT NULL;
