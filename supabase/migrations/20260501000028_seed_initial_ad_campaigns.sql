-- Migration 3: Seed 6 initial ad campaigns with bilingual creatives.
-- Uses deterministic UUIDs for idempotent re-runs.

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN CREATE EXTENSION "uuid-ossp"; END IF; END $$;

-- ==========================================
-- Campaign 1: Railway Ghost (CPA)
-- ==========================================
INSERT INTO ad_campaigns (id, name, advertiser, format, status, priority, brand_color, logo_url, pricing_model, type)
VALUES (
  uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'railway-ghost'),
  'Railway Ghost', 'Railway Ghost', 'native', 'active', 10,
  '#7B5BF7', '/ads/logos/railway-ghost.svg', 'cpm', 'cpa'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO ad_slot_creatives (campaign_id, slot_key, locale, title, body, cta_text, cta_url, interaction, dismiss_seconds)
VALUES
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'railway-ghost'), 'rail_right', 'pt-BR', 'Deploy sem stress, do dev ao prod', 'Hosting feito por dois desenvolvedores cansados de Heroku. Postgres, Redis, e um CLI que não te odeia. 14 dias grátis.', 'Conhecer o Railway Ghost →', '#sponsor-railway', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'railway-ghost'), 'inline_mid', 'pt-BR', 'Deploy sem stress, do dev ao prod', 'Hosting feito por dois desenvolvedores cansados de Heroku. Postgres, Redis, e um CLI que não te odeia. 14 dias grátis.', 'Conhecer o Railway Ghost →', '#sponsor-railway', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'railway-ghost'), 'block_bottom', 'pt-BR', 'Deploy sem stress, do dev ao prod', 'Hosting feito por dois desenvolvedores cansados de Heroku. Postgres, Redis, e um CLI que não te odeia. 14 dias grátis.', 'Conhecer o Railway Ghost →', '#sponsor-railway', 'link', 0)
ON CONFLICT DO NOTHING;

INSERT INTO ad_slot_creatives (campaign_id, slot_key, locale, title, body, cta_text, cta_url, interaction, dismiss_seconds)
VALUES
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'railway-ghost'), 'rail_right', 'en', 'Deploys that don''t keep you up at night', 'Hosting built by two devs tired of Heroku. Postgres, Redis, and a CLI that doesn''t hate you. 14 days free.', 'Try Railway Ghost →', '#sponsor-railway', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'railway-ghost'), 'inline_mid', 'en', 'Deploys that don''t keep you up at night', 'Hosting built by two devs tired of Heroku. Postgres, Redis, and a CLI that doesn''t hate you. 14 days free.', 'Try Railway Ghost →', '#sponsor-railway', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'railway-ghost'), 'block_bottom', 'en', 'Deploys that don''t keep you up at night', 'Hosting built by two devs tired of Heroku. Postgres, Redis, and a CLI that doesn''t hate you. 14 days free.', 'Try Railway Ghost →', '#sponsor-railway', 'link', 0)
ON CONFLICT DO NOTHING;

-- ==========================================
-- Campaign 2: Ensaios de Obsidian (CPA)
-- ==========================================
INSERT INTO ad_campaigns (id, name, advertiser, format, status, priority, brand_color, logo_url, pricing_model, type)
VALUES (
  uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'ensaios-obsidian'),
  'Ensaios de Obsidian', 'Ensaios de Obsidian', 'native', 'active', 10,
  '#3B5A4A', '/ads/logos/ensaios-obsidian.svg', 'cpm', 'cpa'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO ad_slot_creatives (campaign_id, slot_key, locale, title, body, cta_text, cta_url, interaction, dismiss_seconds)
VALUES
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'ensaios-obsidian'), 'rail_right', 'pt-BR', 'Um livro sobre escrever em público — sem performar', 'São 12 ensaios curtos sobre como manter uma prática de escrita honesta quando ninguém te paga pra escrever. Edição em português, lançada esse mês.', 'Comprar (R$ 39) →', '#sponsor-obsidian', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'ensaios-obsidian'), 'inline_mid', 'pt-BR', 'Um livro sobre escrever em público — sem performar', 'São 12 ensaios curtos sobre como manter uma prática de escrita honesta quando ninguém te paga pra escrever. Edição em português, lançada esse mês.', 'Comprar (R$ 39) →', '#sponsor-obsidian', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'ensaios-obsidian'), 'block_bottom', 'pt-BR', 'Um livro sobre escrever em público — sem performar', 'São 12 ensaios curtos sobre como manter uma prática de escrita honesta quando ninguém te paga pra escrever. Edição em português, lançada esse mês.', 'Comprar (R$ 39) →', '#sponsor-obsidian', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'ensaios-obsidian'), 'rail_right', 'en', 'A book about writing in public without performing', 'Twelve short essays on keeping an honest writing practice when nobody pays you to write. Portuguese edition, out this month.', 'Buy (US$ 9) →', '#sponsor-obsidian', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'ensaios-obsidian'), 'inline_mid', 'en', 'A book about writing in public without performing', 'Twelve short essays on keeping an honest writing practice when nobody pays you to write. Portuguese edition, out this month.', 'Buy (US$ 9) →', '#sponsor-obsidian', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'ensaios-obsidian'), 'block_bottom', 'en', 'A book about writing in public without performing', 'Twelve short essays on keeping an honest writing practice when nobody pays you to write. Portuguese edition, out this month.', 'Buy (US$ 9) →', '#sponsor-obsidian', 'link', 0)
ON CONFLICT DO NOTHING;

-- ==========================================
-- Campaign 3: Mailpond (CPA)
-- ==========================================
INSERT INTO ad_campaigns (id, name, advertiser, format, status, priority, brand_color, logo_url, pricing_model, type)
VALUES (
  uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'mailpond'),
  'Mailpond', 'Mailpond', 'native', 'active', 10,
  '#D4724B', '/ads/logos/mailpond.svg', 'cpm', 'cpa'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO ad_slot_creatives (campaign_id, slot_key, locale, title, body, cta_text, cta_url, interaction, dismiss_seconds)
VALUES
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'mailpond'), 'rail_right', 'pt-BR', 'A plataforma de newsletter pra escritores que valorizam tipografia', 'Source Serif, Söhne, sua própria fonte custom. Sem templates plásticos. Lista de 1.000 grátis pra sempre.', 'Migrar pra Mailpond →', '#sponsor-mailpond', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'mailpond'), 'inline_mid', 'pt-BR', 'A plataforma de newsletter pra escritores que valorizam tipografia', 'Source Serif, Söhne, sua própria fonte custom. Sem templates plásticos. Lista de 1.000 grátis pra sempre.', 'Migrar pra Mailpond →', '#sponsor-mailpond', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'mailpond'), 'block_bottom', 'pt-BR', 'A plataforma de newsletter pra escritores que valorizam tipografia', 'Source Serif, Söhne, sua própria fonte custom. Sem templates plásticos. Lista de 1.000 grátis pra sempre.', 'Migrar pra Mailpond →', '#sponsor-mailpond', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'mailpond'), 'rail_right', 'en', 'A newsletter platform for writers who care about typography', 'Source Serif, Söhne, your own custom font. No plastic templates. 1,000 subscribers free forever.', 'Move to Mailpond →', '#sponsor-mailpond', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'mailpond'), 'inline_mid', 'en', 'A newsletter platform for writers who care about typography', 'Source Serif, Söhne, your own custom font. No plastic templates. 1,000 subscribers free forever.', 'Move to Mailpond →', '#sponsor-mailpond', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'mailpond'), 'block_bottom', 'en', 'A newsletter platform for writers who care about typography', 'Source Serif, Söhne, your own custom font. No plastic templates. 1,000 subscribers free forever.', 'Move to Mailpond →', '#sponsor-mailpond', 'link', 0)
ON CONFLICT DO NOTHING;

-- ==========================================
-- Campaign 4: Caderno de Campo (house)
-- ==========================================
INSERT INTO ad_campaigns (id, name, format, status, priority, brand_color, logo_url, pricing_model, type)
VALUES (
  uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'caderno-de-campo'),
  'Caderno de Campo', 'native', 'active', 5,
  '#FF8240', '/ads/logos/caderno-de-campo.svg', 'house_free', 'house'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO ad_slot_creatives (campaign_id, slot_key, locale, title, body, cta_text, cta_url, interaction, dismiss_seconds)
VALUES
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'caderno-de-campo'), 'inline_end', 'pt-BR', 'Receba o próximo ensaio antes de virar público', 'Uma carta a cada 15 dias, com o que estou escrevendo, lendo, e construindo. 1.247 leitores. Sem spam, sem afiliados.', 'Assinar a newsletter →', 'newsletters.html', 'form', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'caderno-de-campo'), 'rail_left', 'pt-BR', 'Receba o próximo ensaio antes de virar público', 'Uma carta a cada 15 dias, com o que estou escrevendo, lendo, e construindo. 1.247 leitores. Sem spam, sem afiliados.', 'Assinar a newsletter →', 'newsletters.html', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'caderno-de-campo'), 'inline_end', 'en', 'Get the next essay before it goes public', 'A letter every 15 days with what I''m writing, reading, and building. 1,247 readers. No spam, no affiliates.', 'Subscribe →', 'newsletters.html', 'form', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'caderno-de-campo'), 'rail_left', 'en', 'Get the next essay before it goes public', 'A letter every 15 days with what I''m writing, reading, and building. 1,247 readers. No spam, no affiliates.', 'Subscribe →', 'newsletters.html', 'link', 0)
ON CONFLICT DO NOTHING;

-- ==========================================
-- Campaign 5: Canal no YouTube (house)
-- ==========================================
INSERT INTO ad_campaigns (id, name, format, status, priority, brand_color, logo_url, pricing_model, type)
VALUES (
  uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'canal-youtube'),
  'Canal no YouTube', 'native', 'active', 5,
  '#C44B3D', '/ads/logos/youtube.svg', 'house_free', 'house'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO ad_slot_creatives (campaign_id, slot_key, locale, title, body, cta_text, cta_url, interaction, dismiss_seconds)
VALUES
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'canal-youtube'), 'rail_left', 'pt-BR', 'Vejo sua dúvida em vídeo — toda quinta', 'Vídeos curtos sobre o que estou construindo. Esta semana: como o CMS gerencia vários sites com um post só.', 'Ver no YouTube →', 'videos.html', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'canal-youtube'), 'rail_left', 'en', 'Your question, in video — every Thursday', 'Short videos about what I''m building. This week: how the CMS manages multiple sites with one post.', 'Watch on YouTube →', 'videos.html', 'link', 0)
ON CONFLICT DO NOTHING;

-- ==========================================
-- Campaign 6: Leitura relacionada (house)
-- ==========================================
INSERT INTO ad_campaigns (id, name, format, status, priority, brand_color, logo_url, pricing_model, type)
VALUES (
  uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'leitura-relacionada'),
  'Leitura relacionada', 'native', 'active', 5,
  '#7A8A4D', '/ads/logos/related-post.svg', 'house_free', 'house'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO ad_slot_creatives (campaign_id, slot_key, locale, title, body, cta_text, cta_url, interaction, dismiss_seconds)
VALUES
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'leitura-relacionada'), 'banner_top', 'pt-BR', 'Por que abandonei o Notion para escrever — e o que veio depois', 'Sobre fricção, atrito útil, e por que ferramentas "perfeitas" às vezes atrapalham. Ensaio de 12 minutos.', 'Ler o ensaio →', 'post.html?p=notion', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'leitura-relacionada'), 'banner_top', 'en', 'Why I left Notion for writing — and what came next', 'On friction, useful resistance, and why "perfect" tools sometimes get in the way. A 12-minute essay.', 'Read the essay →', 'post.html?p=notion', 'link', 0)
ON CONFLICT DO NOTHING;
