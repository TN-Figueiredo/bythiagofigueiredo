-- Migration: consent_texts_v3_ad_marketing
UPDATE public.consent_texts
  SET superseded_at = now()
  WHERE category = 'cookie_marketing'
    AND version = '2.0'
    AND superseded_at IS NULL;

INSERT INTO public.consent_texts (id, category, locale, version, text_md) VALUES
(
  'cookie_marketing_ads_v3_pt-BR',
  'cookie_marketing',
  'pt-BR',
  '3.0',
  E'**Cookies de marketing e publicidade**\n\n'
  'Utilizamos serviços de publicidade de terceiros (Google AdSense) que podem '
  'armazenar cookies no seu navegador para exibir anúncios personalizados.\n\n'
  '- **Dados coletados:** cookies `__gads`, `__gpi`, identificadores de dispositivo '
  'para segmentação publicitária.\n'
  '- **Processadores:** Google Ireland Ltd (UE) + Google LLC (EUA) via SCCs.\n'
  '- **Retenção:** controlada pelo Google, tipicamente 13 meses.\n'
  '- **Revogação:** a qualquer momento via banner de cookies ou página de privacidade. '
  'Anúncios de terceiros serão substituídos por conteúdo editorial.'
),
(
  'cookie_marketing_ads_v3_en',
  'cookie_marketing',
  'en',
  '3.0',
  E'**Marketing and advertising cookies**\n\n'
  'We use third-party advertising services (Google AdSense) that may store '
  'cookies on your browser to display personalized ads.\n\n'
  '- **Data collected:** `__gads`, `__gpi` cookies, device identifiers for ad targeting.\n'
  '- **Processors:** Google Ireland Ltd (EU) + Google LLC (USA) via SCCs.\n'
  '- **Retention:** controlled by Google, typically 13 months.\n'
  '- **Revocation:** at any time via cookie banner or privacy page. Third-party ads '
  'will be replaced with editorial content.'
)
ON CONFLICT (category, locale, version) DO NOTHING;
