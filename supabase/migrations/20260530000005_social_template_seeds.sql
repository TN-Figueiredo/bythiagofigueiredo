-- =============================================================================
-- Social Templates: Add 4:5 aspect ratio + seed system templates
-- =============================================================================

-- 1. Extend aspect_ratio CHECK to include 4:5
ALTER TABLE social_templates DROP CONSTRAINT IF EXISTS social_templates_aspect_ratio_check;
ALTER TABLE social_templates ADD CONSTRAINT social_templates_aspect_ratio_check
  CHECK (aspect_ratio IN ('9:16', '1:1', '16:9', '4:5'));

-- 2. Seed system templates (site_id = NULL = global)
-- These use {{title}}, {{cover_image}} variable placeholders
-- that get resolved by konva-renderer.ts at render time.

-- Blog → Story (9:16, 1080x1920)
INSERT INTO social_templates (id, site_id, name, aspect_ratio, is_default, composition, thumbnail_url, created_at, updated_at)
SELECT gen_random_uuid(), NULL, 'Blog → Story', '9:16', true,
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
        "id": "sticker", "type": "text", "name": "Sticker de link",
        "x": 340, "y": 1450, "width": 400, "height": 60,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "LER O POST", "fontFamily": "Inter", "fontSize": 16,
        "fontWeight": 700, "lineHeight": 1.2, "letterSpacing": "0em",
        "align": "center", "color": "#111111",
        "backgroundColor": "#ffffff", "backgroundPadding": 14, "backgroundRadius": 12
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
WHERE NOT EXISTS (SELECT 1 FROM social_templates WHERE site_id IS NULL AND name = 'Blog → Story');

-- Blog → Fanpage (4:5, 1080x1350)
INSERT INTO social_templates (id, site_id, name, aspect_ratio, is_default, composition, thumbnail_url, created_at, updated_at)
SELECT gen_random_uuid(), NULL, 'Blog → Fanpage', '4:5', true,
  '{
    "version": 1,
    "canvas": { "width": 1080, "height": 1350, "aspectRatio": "4:5" },
    "background": { "type": "gradient", "angle": 155, "stops": [{"color":"#f7f1e8","position":0},{"color":"#ede3d2","position":1}] },
    "elements": [
      {
        "id": "frame", "type": "image", "name": "Moldura editorial",
        "x": 65, "y": 81, "width": 950, "height": 1188,
        "rotation": 0, "opacity": 1, "locked": true,
        "src": "data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''950'' height=''1188'' %3E%3Crect x=''0'' y=''0'' width=''950'' height=''1188'' rx=''8'' fill=''none'' stroke=''rgba(31,27,23,0.25)'' stroke-width=''2''/%3E%3C/svg%3E",
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
        "id": "url", "type": "text", "name": "URL",
        "x": 108, "y": 1200, "width": 864, "height": 40,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "bythiagofigueiredo.com", "fontFamily": "JetBrains Mono", "fontSize": 10,
        "fontWeight": 500, "lineHeight": 1.2, "letterSpacing": "0.15em",
        "align": "center", "color": "#9a6b3f"
      }
    ]
  }'::jsonb, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM social_templates WHERE site_id IS NULL AND name = 'Blog → Fanpage');

-- Blog → Comunidade (1:1, 1080x1080)
INSERT INTO social_templates (id, site_id, name, aspect_ratio, is_default, composition, thumbnail_url, created_at, updated_at)
SELECT gen_random_uuid(), NULL, 'Blog → Comunidade', '1:1', true,
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
        "id": "url", "type": "text", "name": "URL",
        "x": 108, "y": 940, "width": 864, "height": 40,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "bythiagofigueiredo.com", "fontFamily": "JetBrains Mono", "fontSize": 10,
        "fontWeight": 500, "lineHeight": 1.2, "letterSpacing": "0.15em",
        "align": "center", "color": "#9a6b3f"
      }
    ]
  }'::jsonb, NULL, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM social_templates WHERE site_id IS NULL AND name = 'Blog → Comunidade');

-- Newsletter → Story (9:16, 1080x1920)
INSERT INTO social_templates (id, site_id, name, aspect_ratio, is_default, composition, thumbnail_url, created_at, updated_at)
SELECT gen_random_uuid(), NULL, 'Newsletter → Story', '9:16', false,
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
        "content": "NEWSLETTER WEEKLY", "fontFamily": "JetBrains Mono", "fontSize": 14,
        "fontWeight": 600, "lineHeight": 1.2, "letterSpacing": "0.22em",
        "align": "center", "color": "#9a6b3f", "uppercase": true
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
        "id": "edition-badge", "type": "text", "name": "Badge de edicao",
        "x": 340, "y": 820, "width": 400, "height": 240,
        "rotation": 0, "opacity": 0.12, "locked": false,
        "content": "#", "fontFamily": "Fraunces", "fontSize": 180,
        "fontWeight": 700, "lineHeight": 1, "letterSpacing": "0em",
        "align": "center", "color": "#1f1b17"
      },
      {
        "id": "sticker", "type": "text", "name": "Sticker de link",
        "x": 340, "y": 1450, "width": 400, "height": 60,
        "rotation": 0, "opacity": 1, "locked": false,
        "content": "LER A EDICAO", "fontFamily": "Inter", "fontSize": 16,
        "fontWeight": 700, "lineHeight": 1.2, "letterSpacing": "0em",
        "align": "center", "color": "#111111",
        "backgroundColor": "#ffffff", "backgroundPadding": 14, "backgroundRadius": 12
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
WHERE NOT EXISTS (SELECT 1 FROM social_templates WHERE site_id IS NULL AND name = 'Newsletter → Story');
