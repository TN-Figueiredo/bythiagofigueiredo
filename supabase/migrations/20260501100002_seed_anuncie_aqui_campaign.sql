-- Seed "Anuncie Aqui" house campaign.
-- Shows in unfilled CPA slots to drive potential advertisers to /anuncie.
-- Pre-computed UUID: uuid5(DNS, 'anuncie-aqui') = d3f1a2b4-5c6d-5e7f-8a9b-0c1d2e3f4a5b

INSERT INTO ad_campaigns (id, name, format, status, priority, brand_color, logo_url, pricing_model, type, app_id)
VALUES (
  'd3f1a2b4-5c6d-5e7f-8a9b-0c1d2e3f4a5b',
  'Anuncie Aqui', 'native', 'active', 1,
  '#2563EB', '/ads/logos/anuncie-aqui.svg', 'house_free', 'house', 'bythiagofigueiredo'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO ad_slot_creatives (campaign_id, slot_key, locale, title, body, cta_text, cta_url, interaction, dismiss_seconds)
VALUES
  ('d3f1a2b4-5c6d-5e7f-8a9b-0c1d2e3f4a5b', 'rail_right', 'pt-BR', 'Seu produto aqui', 'Anúncios nativos, integrados ao conteúdo. Sem banners invasivos, sem pop-ups. Audiência de devs e criadores.', 'Anunciar →', '/anuncie', 'link', 0),
  ('d3f1a2b4-5c6d-5e7f-8a9b-0c1d2e3f4a5b', 'inline_mid', 'pt-BR', 'Seu produto aqui', 'Anúncios nativos, integrados ao conteúdo. Sem banners invasivos, sem pop-ups. Audiência de devs e criadores.', 'Anunciar →', '/anuncie', 'link', 0),
  ('d3f1a2b4-5c6d-5e7f-8a9b-0c1d2e3f4a5b', 'block_bottom', 'pt-BR', 'Seu produto aqui', 'Anúncios nativos, integrados ao conteúdo. Sem banners invasivos, sem pop-ups. Audiência de devs e criadores.', 'Anunciar →', '/anuncie', 'link', 0),
  ('d3f1a2b4-5c6d-5e7f-8a9b-0c1d2e3f4a5b', 'banner_top', 'pt-BR', 'Anuncie aqui', 'Espaço nativo para seu produto ou projeto. CPM flexível, report completo, sem tracking de terceiros.', 'Ver formatos →', '/anuncie', 'link', 0),
  ('d3f1a2b4-5c6d-5e7f-8a9b-0c1d2e3f4a5b', 'rail_right', 'en', 'Your product here', 'Native ads integrated into content. No invasive banners, no pop-ups. An audience of devs and creators.', 'Advertise →', '/anuncie', 'link', 0),
  ('d3f1a2b4-5c6d-5e7f-8a9b-0c1d2e3f4a5b', 'inline_mid', 'en', 'Your product here', 'Native ads integrated into content. No invasive banners, no pop-ups. An audience of devs and creators.', 'Advertise →', '/anuncie', 'link', 0),
  ('d3f1a2b4-5c6d-5e7f-8a9b-0c1d2e3f4a5b', 'block_bottom', 'en', 'Your product here', 'Native ads integrated into content. No invasive banners, no pop-ups. An audience of devs and creators.', 'Advertise →', '/anuncie', 'link', 0),
  ('d3f1a2b4-5c6d-5e7f-8a9b-0c1d2e3f4a5b', 'banner_top', 'en', 'Advertise here', 'Native ad space for your product or project. Flexible CPM, full report, no third-party tracking.', 'See formats →', '/anuncie', 'link', 0)
ON CONFLICT DO NOTHING;

-- Update placeholder fallback URLs to relative path
UPDATE ad_placeholders
SET cta_url = '/anuncie'
WHERE cta_url = 'https://bythiagofigueiredo.com/anuncie';
