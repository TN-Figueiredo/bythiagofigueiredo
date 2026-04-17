CREATE TABLE IF NOT EXISTS consent_texts (
  id text PRIMARY KEY,
  category text NOT NULL,
  locale text NOT NULL DEFAULT 'pt-BR',
  version text NOT NULL,
  text_md text NOT NULL,
  effective_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  UNIQUE (category, locale, version)
);

ALTER TABLE consent_texts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS consent_texts_public_read ON consent_texts;
CREATE POLICY consent_texts_public_read ON consent_texts FOR SELECT USING (true);

INSERT INTO consent_texts (id, category, locale, version, text_md) VALUES
('cookie_functional_v1_pt-BR','cookie_functional','pt-BR','1.0','Cookies necessários para o funcionamento básico do site (sessão, segurança). Sempre ativos.'),
('cookie_functional_v1_en','cookie_functional','en','1.0','Cookies necessary for basic site operation (session, security). Always active.'),
('cookie_analytics_v1_pt-BR','cookie_analytics','pt-BR','1.0','Cookies de análise (Sentry Session Replay) para monitorar performance e erros. Opcional.'),
('cookie_analytics_v1_en','cookie_analytics','en','1.0','Analytics cookies (Sentry Session Replay) to monitor performance and errors. Optional.'),
('cookie_marketing_v1_pt-BR','cookie_marketing','pt-BR','1.0','Cookies de marketing para personalização de conteúdo. Opcional.'),
('cookie_marketing_v1_en','cookie_marketing','en','1.0','Marketing cookies for content personalization. Optional.'),
('privacy_policy_v1_pt-BR','privacy_policy','pt-BR','1.0','Ao continuar, você concorda com nossa Política de Privacidade.'),
('privacy_policy_v1_en','privacy_policy','en','1.0','By continuing, you agree to our Privacy Policy.'),
('terms_of_service_v1_pt-BR','terms_of_service','pt-BR','1.0','Ao continuar, você concorda com nossos Termos de Uso.'),
('terms_of_service_v1_en','terms_of_service','en','1.0','By continuing, you agree to our Terms of Use.'),
('newsletter_v1_pt-BR','newsletter','pt-BR','1.0','Ao assinar, você concorda em receber emails do bythiagofigueiredo. Descadastre-se a qualquer momento.'),
('newsletter_v1_en','newsletter','en','1.0','By subscribing, you agree to receive emails from bythiagofigueiredo. Unsubscribe anytime.')
ON CONFLICT (id) DO NOTHING;
