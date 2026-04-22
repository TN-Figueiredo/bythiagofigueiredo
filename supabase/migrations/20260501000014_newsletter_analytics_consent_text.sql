-- LGPD consent text for newsletter open/click tracking analytics

INSERT INTO public.consent_texts (id, category, locale, version, text_md)
VALUES
  ('newsletter_analytics_v1_pt-BR', 'newsletter_analytics', 'pt-BR', '1.0',
   'Ao se inscrever, você concorda com o rastreamento de aberturas e cliques para melhorar nosso conteúdo. Processadores: Resend (EUA, SCCs). Retenção: 90 dias para IP/user-agent, agregados indefinidamente. Revogação: desative via preferências de assinatura ou solicite via tnfigueiredotv@gmail.com.'),
  ('newsletter_analytics_v1_en', 'newsletter_analytics', 'en', '1.0',
   'By subscribing, you agree to open and click tracking to improve our content. Processors: Resend (US, SCCs). Retention: 90 days for IP/user-agent, aggregates kept indefinitely. Revocation: disable via subscription preferences or request via tnfigueiredotv@gmail.com.')
ON CONFLICT (id) DO NOTHING;
