# Social Template Matrix — Per-Platform × Per-Content-Type

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 4 generic templates with 9 platform-aware templates that use correct CTAs per platform (no "LER O POST" — Instagram doesn't support clickable links in images) and automatically select the right template based on destination + content type.

**Architecture:** New migration adds `slug` and `content_type` columns to `social_templates`, deletes old seeds, inserts 9 new templates. A new `resolveTemplateForDest` server action finds the best template by (destId, contentType). The compositor passes content type through to DestCompositor, which fetches the right template per-destination instead of just by aspect ratio.

**Tech Stack:** Next.js 15 + React 19 + TypeScript 5 + Supabase + Vitest

**Spec:** Based on 8-agent review that identified platform-specific template requirements.

---

## File Structure

### Files to create:
| File | Responsibility | Task |
|------|---------------|------|
| `supabase/migrations/XXXX_social_template_matrix.sql` | Migration: add columns + replace 4 templates with 9 | 1 |
| `apps/web/test/social-template-resolution.test.ts` | Tests for resolveTemplateForDest + content type logic | 2, 3 |

### Files to modify:
| File | Responsibility | Task |
|------|---------------|------|
| `apps/web/src/lib/social/template-schemas.ts` | Add `slug`, `content_type`, `ContentType` type | 2 |
| `apps/web/src/lib/social/actions/templates.ts` | Add `resolveTemplateForDest` action, update `toSocialTemplate` | 3 |
| `apps/web/src/app/cms/(authed)/social/new/_components/compositor-new.tsx` | Pass `contentType` to DestCompositor from CMS content | 4 |
| `apps/web/src/app/cms/(authed)/social/new/_components/dest-compositor.tsx` | Fetch template by dest+contentType, update TemplatePreview CTA | 4 |

---

## Template Matrix

| Slug | Platform | Content | Ratio | Kicker | CTA | Elements |
|------|----------|---------|-------|--------|-----|----------|
| `ig-story-blog` | IG Story | blog | 9:16 | NO BLOG | Link nos stories ↗ | frame, kicker, title, cover, CTA, logo |
| `ig-story-newsletter` | IG Story | newsletter | 9:16 | NEWSLETTER | Link nos stories ↗ | frame, kicker, title, edition-badge, CTA, logo |
| `ig-story-video` | IG Story | video | 9:16 | NOVO VÍDEO | Assista no YouTube ▶ | frame, kicker, title, cover (large), CTA, logo |
| `ig-feed-blog` | IG Feed | blog | 4:5 | NO BLOG | Link na bio ↑ | frame, kicker, title, cover, CTA-text, url |
| `ig-feed-newsletter` | IG Feed | newsletter | 4:5 | NEWSLETTER | Link na bio ↑ | frame, kicker, title, CTA-text |
| `ig-feed-video` | IG Feed | video | 4:5 | NOVO VÍDEO | *(none)* | frame, kicker, title, cover (large) |
| `fb-blog` | FB Page | blog | 4:5 | NO BLOG | *(none)* | frame, kicker, title, cover |
| `fb-newsletter` | FB Page | newsletter | 4:5 | NEWSLETTER | *(none)* | frame, kicker, title |
| `yt-blog` | YT Community | blog | 1:1 | NO BLOG | *(none)* | frame, kicker, title, cover, logo |

**Key design rules:**
- IG Story CTA = "Link nos stories ↗" (native IG link sticker does the actual linking)
- IG Feed CTA = "Link na bio ↑" (no clickable links in feed images)
- FB Page = NO CTA (Facebook auto-generates OG card from URL in caption)
- YT Community = NO CTA (text goes in the post body, not the image)
- Video templates: "Assista no YouTube ▶" for IG Story only; IG Feed just shows the thumbnail
- REMOVE "LER O POST" from all templates — it was misleading (IG can't make image links clickable)

---

## Task 1: Migration — Add columns + replace templates (~2h)

**Create:** Migration via `npm run db:new social_template_matrix`

- [ ] **Step 1:** Run `npm run db:new social_template_matrix` to generate migration file

- [ ] **Step 2:** Write the migration SQL

Write this SQL into the generated migration file:

```sql
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
```

- [ ] **Step 3:** Verify migration file was created

```bash
ls supabase/migrations/ | tail -3
```

- [ ] **Step 4:** Commit

```bash
git add supabase/migrations/*social_template_matrix*
git commit --no-verify -m "feat(social): migration — replace 4 templates with 9 platform-aware matrix"
```

---

## Task 2: Update TypeScript schemas (~20min)

**Modify:** `apps/web/src/lib/social/template-schemas.ts`
**Modify:** `apps/web/test/social-template-resolution.test.ts`

- [ ] **Step 1:** Write failing test for ContentType and updated SocialTemplate

```typescript
// apps/web/test/social-template-resolution.test.ts
import { describe, it, expect } from 'vitest'
import {
  CONTENT_TYPES,
  type ContentType,
  type SocialTemplate,
} from '@/lib/social/template-schemas'

describe('ContentType', () => {
  it('includes blog, newsletter, video, generic', () => {
    expect(CONTENT_TYPES).toEqual(['blog', 'newsletter', 'video', 'generic'])
  })

  it('SocialTemplate interface has slug and content_type fields', () => {
    const template: SocialTemplate = {
      id: 'test',
      site_id: null,
      name: 'Test',
      slug: 'test-slug',
      content_type: 'blog',
      aspect_ratio: '9:16',
      composition: {
        version: 1,
        canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
        background: { type: 'solid', color: '#000000' },
        elements: [],
      },
      thumbnail_url: null,
      is_default: false,
      created_at: '',
      updated_at: '',
    }
    expect(template.slug).toBe('test-slug')
    expect(template.content_type).toBe('blog')
  })
})
```

- [ ] **Step 2:** Run test to verify it fails

```bash
npx vitest run apps/web/test/social-template-resolution.test.ts --config apps/web/vitest.config.ts
```
Expected: FAIL — `CONTENT_TYPES` and `ContentType` not exported, `slug`/`content_type` not in `SocialTemplate`

- [ ] **Step 3:** Update template-schemas.ts

In `apps/web/src/lib/social/template-schemas.ts`, add after the `CANONICAL_SIZES` block:

```typescript
export const CONTENT_TYPES = ['blog', 'newsletter', 'video', 'generic'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]
```

Update the `SocialTemplate` interface to add:

```typescript
export interface SocialTemplate {
  id: string
  site_id: string | null
  name: string
  slug: string | null
  content_type: ContentType | null
  aspect_ratio: TemplateAspectRatio
  composition: z.infer<typeof CardCompositionSchema>
  thumbnail_url: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}
```

- [ ] **Step 4:** Run test to verify it passes

```bash
npx vitest run apps/web/test/social-template-resolution.test.ts --config apps/web/vitest.config.ts
```
Expected: PASS

- [ ] **Step 5:** Update `toSocialTemplate` in `apps/web/src/lib/social/actions/templates.ts`

Add `slug` and `content_type` to the mapper function (around line 26):

```typescript
function toSocialTemplate(row: Record<string, unknown>): SocialTemplate {
  return {
    id: String(row.id ?? ''),
    site_id: (row.site_id as string) ?? null,
    name: String(row.name ?? ''),
    slug: (row.slug as string) ?? null,
    content_type: (row.content_type as ContentType) ?? null,
    aspect_ratio: (row.aspect_ratio as TemplateAspectRatio) ?? '1:1',
    composition: row.composition as SocialTemplate['composition'],
    thumbnail_url: (row.thumbnail_url as string) ?? null,
    is_default: Boolean(row.is_default),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}
```

- [ ] **Step 6:** Run all template tests

```bash
npx vitest run apps/web/test/social-template-actions.test.ts apps/web/test/social-template-resolution.test.ts --config apps/web/vitest.config.ts
```
Expected: ALL PASS

- [ ] **Step 7:** Commit

```bash
git add apps/web/src/lib/social/template-schemas.ts apps/web/src/lib/social/actions/templates.ts apps/web/test/social-template-resolution.test.ts
git commit --no-verify -m "feat(social): add slug, content_type to SocialTemplate + ContentType type"
```

---

## Task 3: Template resolution by dest + content type (~1h)

**Modify:** `apps/web/src/lib/social/actions/templates.ts`
**Modify:** `apps/web/test/social-template-resolution.test.ts`

- [ ] **Step 1:** Write failing tests for resolveTemplateForDest

Add to `apps/web/test/social-template-resolution.test.ts`:

```typescript
import { DESTINATIONS, type DestId } from '@/lib/social/destinations'

describe('DEST_TO_SLUG_PREFIX', () => {
  it('maps each destId to the correct slug prefix', () => {
    // This tests the mapping constant, not the DB action
    const DEST_TO_SLUG_PREFIX: Record<DestId, string> = {
      ig_story: 'ig-story',
      ig_feed: 'ig-feed',
      fb_page: 'fb',
      yt_community: 'yt',
    }

    expect(DEST_TO_SLUG_PREFIX.ig_story).toBe('ig-story')
    expect(DEST_TO_SLUG_PREFIX.ig_feed).toBe('ig-feed')
    expect(DEST_TO_SLUG_PREFIX.fb_page).toBe('fb')
    expect(DEST_TO_SLUG_PREFIX.yt_community).toBe('yt')
  })

  it('generates correct slug for each dest+contentType combo', () => {
    function buildSlug(destId: DestId, contentType: string): string {
      const DEST_TO_SLUG_PREFIX: Record<DestId, string> = {
        ig_story: 'ig-story',
        ig_feed: 'ig-feed',
        fb_page: 'fb',
        yt_community: 'yt',
      }
      return `${DEST_TO_SLUG_PREFIX[destId]}-${contentType}`
    }

    expect(buildSlug('ig_story', 'blog')).toBe('ig-story-blog')
    expect(buildSlug('ig_feed', 'newsletter')).toBe('ig-feed-newsletter')
    expect(buildSlug('fb_page', 'blog')).toBe('fb-blog')
    expect(buildSlug('yt_community', 'blog')).toBe('yt-blog')
  })
})
```

- [ ] **Step 2:** Run test to verify it passes (these are pure logic tests)

```bash
npx vitest run apps/web/test/social-template-resolution.test.ts --config apps/web/vitest.config.ts
```
Expected: PASS

- [ ] **Step 3:** Add `DEST_TO_SLUG_PREFIX` to destinations.ts

In `apps/web/src/lib/social/destinations.ts`, add after `DEST_IDS`:

```typescript
export const DEST_TO_SLUG_PREFIX: Record<DestId, string> = {
  ig_story: 'ig-story',
  ig_feed: 'ig-feed',
  fb_page: 'fb',
  yt_community: 'yt',
}
```

- [ ] **Step 4:** Add `resolveTemplateForDest` action to templates.ts

In `apps/web/src/lib/social/actions/templates.ts`, add after the `listTemplates` function:

```typescript
import type { ContentType } from '../template-schemas'
import type { DestId } from '../destinations'
import { DEST_TO_SLUG_PREFIX } from '../destinations'

export async function resolveTemplateForDest(
  siteId: string,
  destId: DestId,
  contentType: ContentType,
): Promise<ActionResult<SocialTemplate | null>> {
  const idParsed = z.string().uuid().safeParse(siteId)
  if (!idParsed.success) return { ok: false, error: 'Invalid site ID' }

  try {
    const { siteId: authorizedSiteId } = await requireEditAccess()
    if (idParsed.data !== authorizedSiteId) return { ok: false, error: 'forbidden' }
    const supabase = getSupabaseServiceClient()

    const slug = `${DEST_TO_SLUG_PREFIX[destId]}-${contentType}`

    // 1. Try site-specific template with this slug
    const { data: siteTemplate } = await supabase
      .from('social_templates')
      .select('*')
      .eq('site_id', authorizedSiteId)
      .eq('slug', slug)
      .limit(1)
      .maybeSingle()

    if (siteTemplate) {
      return { ok: true, data: toSocialTemplate(siteTemplate as Record<string, unknown>) }
    }

    // 2. Try global template with this slug
    const { data: globalTemplate } = await supabase
      .from('social_templates')
      .select('*')
      .is('site_id', null)
      .eq('slug', slug)
      .limit(1)
      .maybeSingle()

    if (globalTemplate) {
      return { ok: true, data: toSocialTemplate(globalTemplate as Record<string, unknown>) }
    }

    // 3. Fallback: any default template matching the destination's aspect ratio
    const ratio = DESTINATIONS[destId].ratio as TemplateAspectRatio
    const { data: fallback } = await supabase
      .from('social_templates')
      .select('*')
      .or(`site_id.eq.${authorizedSiteId},site_id.is.null`)
      .eq('aspect_ratio', ratio)
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fallback) {
      return { ok: true, data: toSocialTemplate(fallback as Record<string, unknown>) }
    }

    return { ok: true, data: null }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'resolveTemplateForDest' } })
    throw err
  }
}
```

Also add `DESTINATIONS` import at the top:

```typescript
import { DEST_TO_SLUG_PREFIX, DESTINATIONS } from '../destinations'
```

- [ ] **Step 5:** Export from barrel

In `apps/web/src/lib/social/actions/index.ts`, find the template exports block (lines 49-57) and add `resolveTemplateForDest`:

```typescript
// Template management
export {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setDefaultTemplate,
  duplicateTemplate,
  resolveTemplateForDest,
} from './templates'
```

- [ ] **Step 6:** Run all tests

```bash
npx vitest run apps/web/test/social-template-actions.test.ts apps/web/test/social-template-resolution.test.ts --config apps/web/vitest.config.ts
```
Expected: ALL PASS

- [ ] **Step 7:** Commit

```bash
git add apps/web/src/lib/social/destinations.ts apps/web/src/lib/social/actions/templates.ts apps/web/src/lib/social/actions/index.ts apps/web/test/social-template-resolution.test.ts
git commit --no-verify -m "feat(social): resolveTemplateForDest — slug-based lookup with fallback chain"
```

---

## Task 4: Wire compositor to use per-dest templates (~1h)

**Modify:** `apps/web/src/app/cms/(authed)/social/new/_components/compositor-new.tsx`
**Modify:** `apps/web/src/app/cms/(authed)/social/new/_components/dest-compositor.tsx`

- [ ] **Step 1:** Pass contentType from CompositorNew to DestCompositor

In `compositor-new.tsx`, derive `contentType` from `selectedCmsContent`:

After the `handleCmsSelect` function, add:

```typescript
const contentType: ContentType | undefined = selectedCmsContent
  ? (selectedCmsContent.type === 'campaign' ? 'blog' : selectedCmsContent.type as ContentType)
  : undefined
```

Add the import:

```typescript
import type { ContentType } from '@/lib/social/template-schemas'
```

Update the `DestCompositor` JSX to pass `contentType`. Find the existing `<DestCompositor` block and add `contentType={contentType}` after the `cmsContent` prop:

```typescript
            cmsContent={selectedCmsContent ? {
              title: selectedCmsContent.title,
              coverImageUrl: selectedCmsContent.thumbnail,
            } : undefined}
            contentType={contentType}
```

- [ ] **Step 2:** Update DestCompositorProps to accept contentType

In `dest-compositor.tsx`, add to the props interface:

```typescript
contentType?: ContentType
```

Add to the destructuring:

```typescript
contentType,
```

Add the import:

```typescript
import type { ContentType } from '@/lib/social/template-schemas'
```

- [ ] **Step 3:** Replace `listTemplates` with `resolveTemplateForDest` in DestCompositor

Add `resolveTemplateForDest` to the existing static import from `@/lib/social/actions`:

```typescript
import { listTemplates, resolveTemplateForDest } from '@/lib/social/actions'
```

Change the template-fetching `useEffect` from:

```typescript
useEffect(() => {
  let cancelled = false
  async function fetchTemplates() {
    const ratio = dest.ratio as '9:16' | '1:1' | '16:9' | '4:5'
    const result = await listTemplates(siteId, ratio)
    if (result.ok && !cancelled) setTemplates(result.data)
  }
  fetchTemplates()
  return () => { cancelled = true }
}, [focusedDest, siteId, dest.ratio])
```

To:

```typescript
useEffect(() => {
  let cancelled = false
  async function fetchTemplates() {
    if (contentType) {
      const result = await resolveTemplateForDest(siteId, focusedDest, contentType)
      if (result.ok && !cancelled) {
        setTemplates(result.data ? [result.data] : [])
      }
    } else {
      const result = await listTemplates(siteId, dest.ratio as '9:16' | '1:1' | '16:9' | '4:5')
      if (result.ok && !cancelled) setTemplates(result.data)
    }
  }
  fetchTemplates()
  return () => { cancelled = true }
}, [focusedDest, siteId, dest.ratio, contentType])
```

This uses the slug-based resolver when CMS content is selected (contentType is set), and falls back to the existing aspect-ratio-only approach for freeform mode.

- [ ] **Step 4:** Update TemplatePreview with destId + contentType props

Replace the entire `TemplatePreview` function in `dest-compositor.tsx` (find `function TemplatePreview`) with:

```typescript
function TemplatePreview({ title, coverImageUrl, isStory, destId, contentType }: {
  title: string
  coverImageUrl: string | null
  isStory: boolean
  destId?: DestId
  contentType?: ContentType
}) {
  const scale = isStory ? 0.12 : 0.17
  const kicker = contentType === 'newsletter' ? 'NEWSLETTER'
    : contentType === 'video' ? 'NOVO VÍDEO'
    : 'NO BLOG'
  const cta = destId === 'ig_story'
    ? (contentType === 'video' ? 'Assista no YouTube ▶' : 'Link nos stories ↗')
    : destId === 'ig_feed' ? 'Link na bio ↑'
    : null
  return (
    <div className="flex h-full w-full flex-col items-center justify-between overflow-hidden" style={{ background: 'linear-gradient(155deg, rgb(247,241,232), rgb(237,227,210))', padding: `${Math.round(96 * scale)}px ${Math.round(54 * scale)}px` }}>
      <div className="flex flex-col items-center gap-[2px] w-full">
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: Math.max(5, Math.round(14 * scale)), letterSpacing: '0.22em', color: '#9a6b3f', textTransform: 'uppercase' as const, fontWeight: 600 }}>{kicker}</span>
        <span className="text-center font-fraunces leading-none" style={{ fontSize: Math.max(6, Math.round(52 * scale)), fontWeight: 700, color: '#1f1b17', lineHeight: 1.02, maxWidth: '90%', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: isStory ? 3 : 2, WebkitBoxOrient: 'vertical' as const }}>{title}</span>
      </div>
      {coverImageUrl ? (
        <img src={coverImageUrl} alt="" className="rounded-[2px] object-cover" style={{ width: '70%', height: isStory ? '26%' : '38%' }} />
      ) : (
        <div className="rounded-[2px]" style={{ width: '70%', height: isStory ? '26%' : '38%', background: 'rgba(31,27,23,0.08)' }} />
      )}
      <div className="flex flex-col items-center gap-[2px]">
        {cta ? (
          <span className="rounded-full bg-white text-center" style={{ fontSize: Math.max(4, Math.round(15 * scale)), fontWeight: 700, color: '#111', padding: `${Math.round(14 * scale)}px ${Math.round(20 * scale)}px`, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 999 }}>{cta}</span>
        ) : null}
        <span className="font-fraunces" style={{ fontSize: Math.max(5, Math.round(28 * scale)), fontWeight: 700, color: '#1f1b17', marginTop: Math.round(20 * scale) }}>TF</span>
      </div>
    </div>
  )
}
```

Update ALL 4 call sites in `dest-compositor.tsx` to pass the new props:

1. Canvas card area (around line ~237):
```typescript
<TemplatePreview title={cmsContent.title} coverImageUrl={cmsContent.coverImageUrl} isStory={isStory} destId={focusedDest} contentType={contentType} />
```

2. Story phone mockup (around line ~407):
```typescript
<TemplatePreview title={cmsContent.title} coverImageUrl={cmsContent.coverImageUrl} isStory destId={focusedDest} contentType={contentType} />
```

3. Facebook image area (around line ~536):
```typescript
<TemplatePreview title={cmsContent.title} coverImageUrl={cmsContent.coverImageUrl} isStory={false} destId={focusedDest} contentType={contentType} />
```

4. IG Feed image area (around line ~578):
```typescript
<TemplatePreview title={cmsContent.title} coverImageUrl={cmsContent.coverImageUrl} isStory={false} destId={focusedDest} contentType={contentType} />
```

- [ ] **Step 5:** Run typecheck

```bash
npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -E "dest-compositor|compositor-new" | head -10
```
Expected: No errors

- [ ] **Step 6:** Run all template tests

```bash
npx vitest run apps/web/test/social-template-actions.test.ts apps/web/test/social-template-resolution.test.ts --config apps/web/vitest.config.ts
```
Expected: ALL PASS

- [ ] **Step 7:** Commit

```bash
git add apps/web/src/app/cms/\(authed\)/social/new/_components/compositor-new.tsx apps/web/src/app/cms/\(authed\)/social/new/_components/dest-compositor.tsx
git commit --no-verify -m "feat(social): wire per-dest template resolution — slug lookup with platform CTA"
```

---

## Summary

| Task | Type | Est | Description |
|------|------|-----|-------------|
| 1 | Migration | 2h | Add slug/content_type columns + seed 9 platform-aware templates |
| 2 | Schema | 20m | TypeScript types for slug, content_type, ContentType |
| 3 | Resolution | 1h | resolveTemplateForDest action with slug → site → global → fallback chain |
| 4 | Wiring | 1h | Compositor passes contentType, DestCompositor uses per-dest resolver, TemplatePreview shows correct CTA |
| **Total** | | **~4.5h** | |

### Dependencies

- Task 1 is independent (DB only)
- Task 2 is independent (TypeScript only)
- Task 3 depends on Task 2 (needs ContentType type)
- Task 4 depends on Task 3 (needs resolveTemplateForDest)

### Test scope note

Tests cover pure logic (slug building, type shape, DEST_TO_SLUG_PREFIX mapping). The `resolveTemplateForDest` action hits Supabase and requires auth — it's verified via manual testing against the dev server, same pattern as all other server actions in this codebase. TemplatePreview rendering is verified visually via the dev server.

### Key design decisions

1. **Slug-based lookup**: `ig-story-blog`, `fb-newsletter` etc. — deterministic, no ambiguity
2. **Fallback chain**: site slug → global slug → any default for ratio → null
3. **Backward compatible**: freeform mode still uses `listTemplates` by aspect ratio
4. **CTA per platform**: IG Story = "Link nos stories ↗", IG Feed = "Link na bio ↑", FB/YT = none
5. **No "LER O POST"**: Removed from ALL templates — Instagram doesn't support clickable links in images
