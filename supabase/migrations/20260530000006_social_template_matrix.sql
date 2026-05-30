-- =============================================================================
-- Social Templates: Add slug/content_type columns + replace with 9 matrix seeds
-- =============================================================================

-- 1. Add new columns
ALTER TABLE social_templates ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE social_templates ADD COLUMN IF NOT EXISTS content_type TEXT;

-- Add constraints
CREATE UNIQUE INDEX IF NOT EXISTS social_templates_slug_key
  ON social_templates (slug) WHERE slug IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_templates_content_type_check') THEN
    ALTER TABLE social_templates ADD CONSTRAINT social_templates_content_type_check
      CHECK (content_type IN ('blog', 'newsletter', 'video', 'generic'));
  END IF;
END $$;

-- 2. Remove old generic seeds (site_id IS NULL = system templates)
DELETE FROM social_templates
WHERE site_id IS NULL
  AND name IN ('Blog → Story', 'Blog → Fanpage', 'Blog → Comunidade', 'Newsletter → Story');

-- 3. Seed 9 platform-aware templates
-- All use the editorial design: cream gradient, Fraunces title, JetBrains Mono kicker

-- IG Story Blog (9:16, 1080x1920) — "Link nos stories ↗"
INSERT INTO social_templates (id, site_id, slug, content_type, name, aspect_ratio, is_default, composition, thumbnail_url, created_at, updated_at)
SELECT gen_random_uuid(), NULL, 'ig-story-blog', 'blog', 'IG Story · Blog', '9:16', true,
  '{
    "version": 1,
    "canvas": { "width": 1080, "height": 1920, "aspectRatio": "9:16" },
    "background": { "type": "gradient", "angle": 155, "stops": [{"color":"#f7f1e8","position":0},{"color":"#ede3d2","position":1}] },
    "elements": [
      {
        "id": "frame", "type": "image", "name": "Moldura editorial",
        "x": 54, "y": 96, "width": 972, "height": 1728,
        "rotation": 0, "opacity": 1, "locked": true,
        "src": "data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''972'' height=''1728''%3E%3Crect x=''0'' y=''0'' width=''972'' height=''1728'' rx=''8'' fill=''none'' stroke=''rgba(31,27,23,0.25)'' stroke-width=''2''/%3E%3C/svg%3E",
        "objectFit": "contain", "maintainAspectRatio": false
      },
      {
        "id": "kicker", "type": "text", "name": "Kicker",
        "x": 108, "y": 200, "width": 864, "height": 60,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "NO BLOG", "fontFamily": "JetBrains Mono", "fontSize": 14,
        "fontWeight": 600, "lineHeight": 1.2, "letterSpacing": "0.22em",
        "align": "center", "color": "#9a6b3f", "uppercase": true,
        "backgroundColor": null, "backgroundPadding": 8, "backgroundRadius": 4
      },
      {
        "id": "title", "type": "text", "name": "Título",
        "x": 86, "y": 380, "width": 908, "height": 300,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "{{title}}", "fontFamily": "Fraunces", "fontSize": 52,
        "fontWeight": 700, "lineHeight": 1.02, "letterSpacing": "-0.01em",
        "align": "center", "color": "#1f1b17"
      },
      {
        "id": "cover", "type": "image", "name": "Capa do post",
        "x": 162, "y": 820, "width": 756, "height": 500,
        "rotation": 0, "opacity": 1, "locked": false,
        "src": "{{cover_image}}", "objectFit": "cover", "borderRadius": 12
      },
      {
        "id": "cta", "type": "text", "name": "CTA",
        "x": 300, "y": 1450, "width": 480, "height": 60,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "Link nos stories ↗", "fontFamily": "Inter", "fontSize": 15,
        "fontWeight": 700, "lineHeight": 1.2, "letterSpacing": "0em",
        "align": "center", "color": "#111111",
        "backgroundColor": "#ffffff", "backgroundPadding": 14, "backgroundRadius": 24
      },
      {
        "id": "logo", "type": "text", "name": "Carimbo TF",
        "x": 490, "y": 1700, "width": 100, "height": 100,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "TF", "fontFamily": "Fraunces", "fontSize": 28,
        "fontWeight": 700, "lineHeight": 1, "letterSpacing": "0em",
        "align": "center", "color": "#1f1b17"
      }
    ]
  }'::jsonb, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM social_templates WHERE slug = 'ig-story-blog');

-- IG Story Newsletter (9:16, 1080x1920) — "Link nos stories ↗"
INSERT INTO social_templates (id, site_id, slug, content_type, name, aspect_ratio, is_default, composition, thumbnail_url, created_at, updated_at)
SELECT gen_random_uuid(), NULL, 'ig-story-newsletter', 'newsletter', 'IG Story · Newsletter', '9:16', false,
  '{
    "version": 1,
    "canvas": { "width": 1080, "height": 1920, "aspectRatio": "9:16" },
    "background": { "type": "gradient", "angle": 155, "stops": [{"color":"#f7f1e8","position":0},{"color":"#ede3d2","position":1}] },
    "elements": [
      {
        "id": "frame", "type": "image", "name": "Moldura editorial",
        "x": 54, "y": 96, "width": 972, "height": 1728,
        "rotation": 0, "opacity": 1, "locked": true,
        "src": "data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''972'' height=''1728''%3E%3Crect x=''0'' y=''0'' width=''972'' height=''1728'' rx=''8'' fill=''none'' stroke=''rgba(31,27,23,0.25)'' stroke-width=''2''/%3E%3C/svg%3E",
        "objectFit": "contain", "maintainAspectRatio": false
      },
      {
        "id": "kicker", "type": "text", "name": "Kicker",
        "x": 108, "y": 200, "width": 864, "height": 60,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "NEWSLETTER", "fontFamily": "JetBrains Mono", "fontSize": 14,
        "fontWeight": 600, "lineHeight": 1.2, "letterSpacing": "0.22em",
        "align": "center", "color": "#9a6b3f", "uppercase": true,
        "backgroundColor": null, "backgroundPadding": 8, "backgroundRadius": 4
      },
      {
        "id": "title", "type": "text", "name": "Título",
        "x": 86, "y": 380, "width": 908, "height": 300,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "{{title}}", "fontFamily": "Fraunces", "fontSize": 52,
        "fontWeight": 700, "lineHeight": 1.02, "letterSpacing": "-0.01em",
        "align": "center", "color": "#1f1b17"
      },
      {
        "id": "edition-badge", "type": "text", "name": "Badge de edição",
        "x": 340, "y": 820, "width": 400, "height": 240,
        "rotation": 0, "opacity": 0.12, "locked": false,
        "content": "#", "fontFamily": "Fraunces", "fontSize": 180,
        "fontWeight": 700, "lineHeight": 1, "letterSpacing": "0em",
        "align": "center", "color": "#1f1b17"
      },
      {
        "id": "cta", "type": "text", "name": "CTA",
        "x": 300, "y": 1450, "width": 480, "height": 60,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "Link nos stories ↗", "fontFamily": "Inter", "fontSize": 15,
        "fontWeight": 700, "lineHeight": 1.2, "letterSpacing": "0em",
        "align": "center", "color": "#111111",
        "backgroundColor": "#ffffff", "backgroundPadding": 14, "backgroundRadius": 24
      },
      {
        "id": "logo", "type": "text", "name": "Carimbo TF",
        "x": 490, "y": 1700, "width": 100, "height": 100,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "TF", "fontFamily": "Fraunces", "fontSize": 28,
        "fontWeight": 700, "lineHeight": 1, "letterSpacing": "0em",
        "align": "center", "color": "#1f1b17"
      }
    ]
  }'::jsonb, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM social_templates WHERE slug = 'ig-story-newsletter');

-- IG Story Video (9:16, 1080x1920) — "Assista no YouTube ▶"
INSERT INTO social_templates (id, site_id, slug, content_type, name, aspect_ratio, is_default, composition, thumbnail_url, created_at, updated_at)
SELECT gen_random_uuid(), NULL, 'ig-story-video', 'video', 'IG Story · Vídeo', '9:16', false,
  '{
    "version": 1,
    "canvas": { "width": 1080, "height": 1920, "aspectRatio": "9:16" },
    "background": { "type": "gradient", "angle": 155, "stops": [{"color":"#f7f1e8","position":0},{"color":"#ede3d2","position":1}] },
    "elements": [
      {
        "id": "frame", "type": "image", "name": "Moldura editorial",
        "x": 54, "y": 96, "width": 972, "height": 1728,
        "rotation": 0, "opacity": 1, "locked": true,
        "src": "data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''972'' height=''1728''%3E%3Crect x=''0'' y=''0'' width=''972'' height=''1728'' rx=''8'' fill=''none'' stroke=''rgba(31,27,23,0.25)'' stroke-width=''2''/%3E%3C/svg%3E",
        "objectFit": "contain", "maintainAspectRatio": false
      },
      {
        "id": "kicker", "type": "text", "name": "Kicker",
        "x": 108, "y": 200, "width": 864, "height": 60,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "NOVO VÍDEO", "fontFamily": "JetBrains Mono", "fontSize": 14,
        "fontWeight": 600, "lineHeight": 1.2, "letterSpacing": "0.22em",
        "align": "center", "color": "#9a6b3f", "uppercase": true,
        "backgroundColor": null, "backgroundPadding": 8, "backgroundRadius": 4
      },
      {
        "id": "title", "type": "text", "name": "Título",
        "x": 86, "y": 340, "width": 908, "height": 260,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "{{title}}", "fontFamily": "Fraunces", "fontSize": 48,
        "fontWeight": 700, "lineHeight": 1.02, "letterSpacing": "-0.01em",
        "align": "center", "color": "#1f1b17"
      },
      {
        "id": "cover", "type": "image", "name": "Thumbnail do vídeo",
        "x": 108, "y": 700, "width": 864, "height": 648,
        "rotation": 0, "opacity": 1, "locked": false,
        "src": "{{cover_image}}", "objectFit": "cover", "borderRadius": 16
      },
      {
        "id": "cta", "type": "text", "name": "CTA",
        "x": 270, "y": 1470, "width": 540, "height": 60,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "Assista no YouTube ▶", "fontFamily": "Inter", "fontSize": 15,
        "fontWeight": 700, "lineHeight": 1.2, "letterSpacing": "0em",
        "align": "center", "color": "#111111",
        "backgroundColor": "#ffffff", "backgroundPadding": 14, "backgroundRadius": 24
      },
      {
        "id": "logo", "type": "text", "name": "Carimbo TF",
        "x": 490, "y": 1700, "width": 100, "height": 100,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "TF", "fontFamily": "Fraunces", "fontSize": 28,
        "fontWeight": 700, "lineHeight": 1, "letterSpacing": "0em",
        "align": "center", "color": "#1f1b17"
      }
    ]
  }'::jsonb, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM social_templates WHERE slug = 'ig-story-video');

-- IG Feed Blog (4:5, 1080x1350) — "Link na bio ↑"
INSERT INTO social_templates (id, site_id, slug, content_type, name, aspect_ratio, is_default, composition, thumbnail_url, created_at, updated_at)
SELECT gen_random_uuid(), NULL, 'ig-feed-blog', 'blog', 'IG Feed · Blog', '4:5', false,
  '{
    "version": 1,
    "canvas": { "width": 1080, "height": 1350, "aspectRatio": "4:5" },
    "background": { "type": "gradient", "angle": 155, "stops": [{"color":"#f7f1e8","position":0},{"color":"#ede3d2","position":1}] },
    "elements": [
      {
        "id": "frame", "type": "image", "name": "Moldura editorial",
        "x": 65, "y": 81, "width": 950, "height": 1188,
        "rotation": 0, "opacity": 1, "locked": true,
        "src": "data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''950'' height=''1188''%3E%3Crect x=''0'' y=''0'' width=''950'' height=''1188'' rx=''8'' fill=''none'' stroke=''rgba(31,27,23,0.25)'' stroke-width=''2''/%3E%3C/svg%3E",
        "objectFit": "contain", "maintainAspectRatio": false
      },
      {
        "id": "kicker", "type": "text", "name": "Kicker",
        "x": 108, "y": 140, "width": 864, "height": 50,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "NO BLOG", "fontFamily": "JetBrains Mono", "fontSize": 11,
        "fontWeight": 600, "lineHeight": 1.2, "letterSpacing": "0.22em",
        "align": "center", "color": "#9a6b3f", "uppercase": true
      },
      {
        "id": "title", "type": "text", "name": "Título",
        "x": 100, "y": 260, "width": 880, "height": 260,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "{{title}}", "fontFamily": "Fraunces", "fontSize": 38,
        "fontWeight": 700, "lineHeight": 1.02, "letterSpacing": "-0.01em",
        "align": "center", "color": "#1f1b17"
      },
      {
        "id": "cover", "type": "image", "name": "Capa do post",
        "x": 162, "y": 580, "width": 756, "height": 380,
        "rotation": 0, "opacity": 1, "locked": false,
        "src": "{{cover_image}}", "objectFit": "cover", "borderRadius": 12
      },
      {
        "id": "cta", "type": "text", "name": "CTA",
        "x": 108, "y": 1040, "width": 864, "height": 40,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "Link na bio ↑", "fontFamily": "Inter", "fontSize": 13,
        "fontWeight": 600, "lineHeight": 1.2, "letterSpacing": "0.05em",
        "align": "center", "color": "#9a6b3f"
      }
    ]
  }'::jsonb, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM social_templates WHERE slug = 'ig-feed-blog');

-- IG Feed Newsletter (4:5, 1080x1350) — "Link na bio ↑"
INSERT INTO social_templates (id, site_id, slug, content_type, name, aspect_ratio, is_default, composition, thumbnail_url, created_at, updated_at)
SELECT gen_random_uuid(), NULL, 'ig-feed-newsletter', 'newsletter', 'IG Feed · Newsletter', '4:5', false,
  '{
    "version": 1,
    "canvas": { "width": 1080, "height": 1350, "aspectRatio": "4:5" },
    "background": { "type": "gradient", "angle": 155, "stops": [{"color":"#f7f1e8","position":0},{"color":"#ede3d2","position":1}] },
    "elements": [
      {
        "id": "frame", "type": "image", "name": "Moldura editorial",
        "x": 65, "y": 81, "width": 950, "height": 1188,
        "rotation": 0, "opacity": 1, "locked": true,
        "src": "data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''950'' height=''1188''%3E%3Crect x=''0'' y=''0'' width=''950'' height=''1188'' rx=''8'' fill=''none'' stroke=''rgba(31,27,23,0.25)'' stroke-width=''2''/%3E%3C/svg%3E",
        "objectFit": "contain", "maintainAspectRatio": false
      },
      {
        "id": "kicker", "type": "text", "name": "Kicker",
        "x": 108, "y": 140, "width": 864, "height": 50,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "NEWSLETTER", "fontFamily": "JetBrains Mono", "fontSize": 11,
        "fontWeight": 600, "lineHeight": 1.2, "letterSpacing": "0.22em",
        "align": "center", "color": "#9a6b3f", "uppercase": true
      },
      {
        "id": "title", "type": "text", "name": "Título",
        "x": 100, "y": 300, "width": 880, "height": 400,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "{{title}}", "fontFamily": "Fraunces", "fontSize": 38,
        "fontWeight": 700, "lineHeight": 1.02, "letterSpacing": "-0.01em",
        "align": "center", "color": "#1f1b17"
      },
      {
        "id": "edition-badge", "type": "text", "name": "Badge de edição",
        "x": 300, "y": 750, "width": 480, "height": 200,
        "rotation": 0, "opacity": 0.10, "locked": false,
        "content": "#", "fontFamily": "Fraunces", "fontSize": 160,
        "fontWeight": 700, "lineHeight": 1, "letterSpacing": "0em",
        "align": "center", "color": "#1f1b17"
      },
      {
        "id": "cta", "type": "text", "name": "CTA",
        "x": 108, "y": 1040, "width": 864, "height": 40,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "Link na bio ↑", "fontFamily": "Inter", "fontSize": 13,
        "fontWeight": 600, "lineHeight": 1.2, "letterSpacing": "0.05em",
        "align": "center", "color": "#9a6b3f"
      }
    ]
  }'::jsonb, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM social_templates WHERE slug = 'ig-feed-newsletter');

-- IG Feed Video (4:5, 1080x1350) — no CTA
INSERT INTO social_templates (id, site_id, slug, content_type, name, aspect_ratio, is_default, composition, thumbnail_url, created_at, updated_at)
SELECT gen_random_uuid(), NULL, 'ig-feed-video', 'video', 'IG Feed · Vídeo', '4:5', false,
  '{
    "version": 1,
    "canvas": { "width": 1080, "height": 1350, "aspectRatio": "4:5" },
    "background": { "type": "gradient", "angle": 155, "stops": [{"color":"#f7f1e8","position":0},{"color":"#ede3d2","position":1}] },
    "elements": [
      {
        "id": "frame", "type": "image", "name": "Moldura editorial",
        "x": 65, "y": 81, "width": 950, "height": 1188,
        "rotation": 0, "opacity": 1, "locked": true,
        "src": "data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''950'' height=''1188''%3E%3Crect x=''0'' y=''0'' width=''950'' height=''1188'' rx=''8'' fill=''none'' stroke=''rgba(31,27,23,0.25)'' stroke-width=''2''/%3E%3C/svg%3E",
        "objectFit": "contain", "maintainAspectRatio": false
      },
      {
        "id": "kicker", "type": "text", "name": "Kicker",
        "x": 108, "y": 140, "width": 864, "height": 50,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "NOVO VÍDEO", "fontFamily": "JetBrains Mono", "fontSize": 11,
        "fontWeight": 600, "lineHeight": 1.2, "letterSpacing": "0.22em",
        "align": "center", "color": "#9a6b3f", "uppercase": true
      },
      {
        "id": "title", "type": "text", "name": "Título",
        "x": 100, "y": 220, "width": 880, "height": 220,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "{{title}}", "fontFamily": "Fraunces", "fontSize": 34,
        "fontWeight": 700, "lineHeight": 1.02, "letterSpacing": "-0.01em",
        "align": "center", "color": "#1f1b17"
      },
      {
        "id": "cover", "type": "image", "name": "Thumbnail do vídeo",
        "x": 108, "y": 500, "width": 864, "height": 648,
        "rotation": 0, "opacity": 1, "locked": false,
        "src": "{{cover_image}}", "objectFit": "cover", "borderRadius": 12
      }
    ]
  }'::jsonb, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM social_templates WHERE slug = 'ig-feed-video');

-- FB Blog (4:5, 1080x1350) — no CTA (OG card from URL in caption)
INSERT INTO social_templates (id, site_id, slug, content_type, name, aspect_ratio, is_default, composition, thumbnail_url, created_at, updated_at)
SELECT gen_random_uuid(), NULL, 'fb-blog', 'blog', 'Facebook · Blog', '4:5', true,
  '{
    "version": 1,
    "canvas": { "width": 1080, "height": 1350, "aspectRatio": "4:5" },
    "background": { "type": "gradient", "angle": 155, "stops": [{"color":"#f7f1e8","position":0},{"color":"#ede3d2","position":1}] },
    "elements": [
      {
        "id": "frame", "type": "image", "name": "Moldura editorial",
        "x": 65, "y": 81, "width": 950, "height": 1188,
        "rotation": 0, "opacity": 1, "locked": true,
        "src": "data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''950'' height=''1188''%3E%3Crect x=''0'' y=''0'' width=''950'' height=''1188'' rx=''8'' fill=''none'' stroke=''rgba(31,27,23,0.25)'' stroke-width=''2''/%3E%3C/svg%3E",
        "objectFit": "contain", "maintainAspectRatio": false
      },
      {
        "id": "kicker", "type": "text", "name": "Kicker",
        "x": 108, "y": 140, "width": 864, "height": 50,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "NO BLOG", "fontFamily": "JetBrains Mono", "fontSize": 11,
        "fontWeight": 600, "lineHeight": 1.2, "letterSpacing": "0.22em",
        "align": "center", "color": "#9a6b3f", "uppercase": true
      },
      {
        "id": "title", "type": "text", "name": "Título",
        "x": 100, "y": 260, "width": 880, "height": 260,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "{{title}}", "fontFamily": "Fraunces", "fontSize": 38,
        "fontWeight": 700, "lineHeight": 1.02, "letterSpacing": "-0.01em",
        "align": "center", "color": "#1f1b17"
      },
      {
        "id": "cover", "type": "image", "name": "Capa do post",
        "x": 162, "y": 580, "width": 756, "height": 500,
        "rotation": 0, "opacity": 1, "locked": false,
        "src": "{{cover_image}}", "objectFit": "cover", "borderRadius": 12
      }
    ]
  }'::jsonb, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM social_templates WHERE slug = 'fb-blog');

-- FB Newsletter (4:5, 1080x1350) — no CTA
INSERT INTO social_templates (id, site_id, slug, content_type, name, aspect_ratio, is_default, composition, thumbnail_url, created_at, updated_at)
SELECT gen_random_uuid(), NULL, 'fb-newsletter', 'newsletter', 'Facebook · Newsletter', '4:5', false,
  '{
    "version": 1,
    "canvas": { "width": 1080, "height": 1350, "aspectRatio": "4:5" },
    "background": { "type": "gradient", "angle": 155, "stops": [{"color":"#f7f1e8","position":0},{"color":"#ede3d2","position":1}] },
    "elements": [
      {
        "id": "frame", "type": "image", "name": "Moldura editorial",
        "x": 65, "y": 81, "width": 950, "height": 1188,
        "rotation": 0, "opacity": 1, "locked": true,
        "src": "data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''950'' height=''1188''%3E%3Crect x=''0'' y=''0'' width=''950'' height=''1188'' rx=''8'' fill=''none'' stroke=''rgba(31,27,23,0.25)'' stroke-width=''2''/%3E%3C/svg%3E",
        "objectFit": "contain", "maintainAspectRatio": false
      },
      {
        "id": "kicker", "type": "text", "name": "Kicker",
        "x": 108, "y": 140, "width": 864, "height": 50,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "NEWSLETTER", "fontFamily": "JetBrains Mono", "fontSize": 11,
        "fontWeight": 600, "lineHeight": 1.2, "letterSpacing": "0.22em",
        "align": "center", "color": "#9a6b3f", "uppercase": true
      },
      {
        "id": "title", "type": "text", "name": "Título",
        "x": 100, "y": 300, "width": 880, "height": 400,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "{{title}}", "fontFamily": "Fraunces", "fontSize": 42,
        "fontWeight": 700, "lineHeight": 1.02, "letterSpacing": "-0.01em",
        "align": "center", "color": "#1f1b17"
      },
      {
        "id": "edition-badge", "type": "text", "name": "Badge de edição",
        "x": 300, "y": 800, "width": 480, "height": 200,
        "rotation": 0, "opacity": 0.10, "locked": false,
        "content": "#", "fontFamily": "Fraunces", "fontSize": 160,
        "fontWeight": 700, "lineHeight": 1, "letterSpacing": "0em",
        "align": "center", "color": "#1f1b17"
      }
    ]
  }'::jsonb, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM social_templates WHERE slug = 'fb-newsletter');

-- YT Community Blog (1:1, 1080x1080) — no CTA (text in post body)
INSERT INTO social_templates (id, site_id, slug, content_type, name, aspect_ratio, is_default, composition, thumbnail_url, created_at, updated_at)
SELECT gen_random_uuid(), NULL, 'yt-blog', 'blog', 'YouTube · Blog', '1:1', true,
  '{
    "version": 1,
    "canvas": { "width": 1080, "height": 1080, "aspectRatio": "1:1" },
    "background": { "type": "gradient", "angle": 155, "stops": [{"color":"#f7f1e8","position":0},{"color":"#ede3d2","position":1}] },
    "elements": [
      {
        "id": "frame", "type": "image", "name": "Moldura editorial",
        "x": 65, "y": 65, "width": 950, "height": 950,
        "rotation": 0, "opacity": 1, "locked": true,
        "src": "data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''950'' height=''950''%3E%3Crect x=''0'' y=''0'' width=''950'' height=''950'' rx=''8'' fill=''none'' stroke=''rgba(31,27,23,0.25)'' stroke-width=''2''/%3E%3C/svg%3E",
        "objectFit": "contain", "maintainAspectRatio": false
      },
      {
        "id": "kicker", "type": "text", "name": "Kicker",
        "x": 108, "y": 120, "width": 864, "height": 40,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "NO BLOG", "fontFamily": "JetBrains Mono", "fontSize": 11,
        "fontWeight": 600, "lineHeight": 1.2, "letterSpacing": "0.22em",
        "align": "center", "color": "#9a6b3f", "uppercase": true
      },
      {
        "id": "title", "type": "text", "name": "Título",
        "x": 100, "y": 220, "width": 880, "height": 220,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "{{title}}", "fontFamily": "Fraunces", "fontSize": 32,
        "fontWeight": 700, "lineHeight": 1.02, "letterSpacing": "-0.01em",
        "align": "center", "color": "#1f1b17"
      },
      {
        "id": "cover", "type": "image", "name": "Capa do post",
        "x": 162, "y": 500, "width": 756, "height": 340,
        "rotation": 0, "opacity": 1, "locked": false,
        "src": "{{cover_image}}", "objectFit": "cover", "borderRadius": 12
      },
      {
        "id": "logo", "type": "text", "name": "Carimbo TF",
        "x": 490, "y": 910, "width": 100, "height": 60,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "TF", "fontFamily": "Fraunces", "fontSize": 20,
        "fontWeight": 700, "lineHeight": 1, "letterSpacing": "0em",
        "align": "center", "color": "#1f1b17"
      }
    ]
  }'::jsonb, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM social_templates WHERE slug = 'yt-blog');
