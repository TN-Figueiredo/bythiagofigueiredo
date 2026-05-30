# Social Canvas Templates — Seed + Editor Wiring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create seed templates ("Blog → Story", "Blog → Fanpage", etc.) in the DB and wire the canvas editor overlay so users can edit art from the compositor.

**Architecture:** Migration adds 4:5 to aspect ratio constraint + seeds 4 system templates with real CardComposition JSONB. Then `dest-compositor.tsx` gets an overlay that mounts `SocialCanvasEditor` with the template as `initialComposition`. The aspect ratio is locked per destination.

**Tech Stack:** Next.js 15 + React 19 + TypeScript 5 + Supabase + react-konva + Vitest

**Spec:** `docs/superpowers/prompts/social-canvas-templates-seed.md`

---

## File Structure

### Files to create:
| File | Responsibility | Task |
|------|---------------|------|
| `supabase/migrations/XXXX_social_template_seeds.sql` | Migration: 4:5 constraint + 4 seed templates | 1 |

### Files to modify:
| File | Responsibility | Task |
|------|---------------|------|
| `apps/web/src/lib/social/template-schemas.ts` | Add '4:5' to ASPECT_RATIOS + CANONICAL_SIZES | 2 |
| `apps/web/src/app/cms/(authed)/social/new/_components/dest-compositor.tsx` | Canvas editor overlay + click handlers | 3 |
| `apps/web/src/app/cms/(authed)/social/new/_components/compositor-new.tsx` | Lift canvas state (composition, canvasImageUrl) | 3 |

---

## Task 1: Migration — Add 4:5 constraint + seed templates (~3h)

**Create:** Migration via `npm run db:new social_template_seeds`

- [ ] Run `npm run db:new social_template_seeds` to generate migration file

- [ ] Write migration SQL with 4:5 constraint update + 4 seed templates

```sql
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
-- Unsupported tokens (kicker, initials) are hardcoded for now.

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
```

- [ ] Verify migration file was created

```bash
ls supabase/migrations/ | tail -3
```

- [ ] Commit

```bash
git commit -m "feat(social): migration — add 4:5 aspect ratio + seed 4 system templates"
```

---

## Task 2: Update TypeScript template schemas (~30min)

**Modify:** `apps/web/src/lib/social/template-schemas.ts`

- [ ] Add '4:5' to ASPECT_RATIOS and CANONICAL_SIZES

In `template-schemas.ts`, change:

```typescript
// Line 4 — change:
export const ASPECT_RATIOS = ['9:16', '1:1', '16:9'] as const

// To:
export const ASPECT_RATIOS = ['9:16', '1:1', '16:9', '4:5'] as const
```

And in CANONICAL_SIZES (around line 7-11), add:

```typescript
'4:5': { width: 1080, height: 1350 },
```

- [ ] Run existing template tests

```bash
npx vitest run apps/web/test/social-template-actions.test.ts
# Expected: PASS
```

- [ ] Commit

```bash
git commit -m "feat(social): add 4:5 to template aspect ratios and canonical sizes"
```

---

## Task 3: Wire canvas editor overlay (~6h)

**Modify:** `apps/web/src/app/cms/(authed)/social/new/_components/compositor-new.tsx`
**Modify:** `apps/web/src/app/cms/(authed)/social/new/_components/dest-compositor.tsx`

This task mounts the existing `SocialCanvasEditor` in a fullscreen overlay when the user clicks "Abrir editor", clicks the canvas area, or clicks the preview phone mockup.

- [ ] Add canvas state to `compositor-new.tsx`

Add state variables after existing state:

```typescript
const [canvasOpen, setCanvasOpen] = useState(false)
const [compositions, setCompositions] = useState<Record<string, any>>({})
const [canvasImages, setCanvasImages] = useState<Record<string, string | null>>({})
```

Pass to DestCompositor:

```typescript
<DestCompositor
  focusedDest={focused}
  destsOn={destsOn}
  caption={captions[focused] ?? ''}
  onCaptionChange={(value) => handleCaptionChange(focused, value)}
  canvasOpen={canvasOpen}
  onOpenCanvas={() => setCanvasOpen(true)}
  onCloseCanvas={() => setCanvasOpen(false)}
  composition={compositions[focused] ?? null}
  onCompositionChange={(comp) => setCompositions(prev => ({ ...prev, [focused]: comp }))}
  canvasImageUrl={canvasImages[focused] ?? null}
  onCanvasImageChange={(url) => setCanvasImages(prev => ({ ...prev, [focused]: url }))}
/>
```

- [ ] Update `DestCompositorProps` in `dest-compositor.tsx`

```typescript
interface DestCompositorProps {
  focusedDest: DestId
  destsOn: Record<DestId, boolean>
  caption: string
  onCaptionChange: (value: string) => void
  canvasOpen: boolean
  onOpenCanvas: () => void
  onCloseCanvas: () => void
  composition: any | null
  onCompositionChange: (comp: any) => void
  canvasImageUrl: string | null
  onCanvasImageChange: (url: string | null) => void
}
```

- [ ] Add click handlers to "Abrir editor", canvas area, and preview

On the "Abrir editor" button, add:
```typescript
onClick={onOpenCanvas}
```

On the canvas checkerboard area div, add:
```typescript
onClick={onOpenCanvas}
```

On the preview phone mockup container, add:
```typescript
onClick={onOpenCanvas}
className="... cursor-pointer"
```

- [ ] Fetch templates from DB and resolve default

Before opening the canvas, fetch templates filtered by the destination's aspect ratio. Use the existing `listTemplates` action:

```typescript
import { listTemplates } from '@/lib/social/actions'
import type { TemplateAspectRatio } from '@/lib/social/template-schemas'

// Inside DestCompositor, add a useEffect to fetch templates for the focused dest:
const [templates, setTemplates] = useState<SocialTemplate[]>([])

useEffect(() => {
  // Fetch templates matching the destination's aspect ratio
  async function fetchTemplates() {
    const ratio = dest.ratio as TemplateAspectRatio
    const result = await listTemplates(siteId, ratio)
    if (result.ok) setTemplates(result.data)
  }
  fetchTemplates()
}, [focusedDest, siteId])
```

Auto-apply the default template as `initialComposition` when no prior composition exists:

```typescript
// After templates are fetched, if no composition exists yet, apply the default
useEffect(() => {
  if (!composition && templates.length > 0) {
    const defaultTpl = templates.find(t => t.is_default) ?? templates[0]
    if (defaultTpl) onCompositionChange(defaultTpl.composition)
  }
}, [templates, composition])
```

- [ ] Add canvas editor overlay at the end of DestCompositor

Add dynamic import and overlay before the closing `</div>` of the grid:

```typescript
import dynamic from 'next/dynamic'

const SocialCanvasEditor = dynamic(
  () => import('./canvas-editor').then(m => ({ default: m.SocialCanvasEditor })),
  { ssr: false }
)
```

Then at the END of the component, before the final `</div>`:

```typescript
{/* Canvas editor overlay */}
{canvasOpen && (
  <div className="fixed inset-0 z-50 bg-cms-bg" style={{ background: 'rgb(14,12,10)' }}>
    <SocialCanvasEditor
      aspectRatio={dest.ratio as TemplateAspectRatio}
      templates={templates}
      postData={{ title: caption, description: caption }}
      initialComposition={composition ?? undefined}
      hideAspectRatioSelector
      embedded={false}
      onExport={async (blob, meta) => {
        // NOTE: URL.createObjectURL creates a local blob URL that only lives
        // in this browser tab. For production publish flow, this should be
        // uploaded to Vercel Blob and replaced with a persistent URL.
        const url = URL.createObjectURL(blob)
        onCanvasImageChange(url)
        onCloseCanvas()
        return { url }
      }}
      onCompositionChange={onCompositionChange}
      onUseInPost={() => {
        onCloseCanvas()
      }}
      onSaveTemplate={async () => {}}
      onDeleteTemplate={async () => {}}
      onImageUpload={async (file) => {
        // TODO: production should upload to Vercel Blob instead of local blob URL
        const url = URL.createObjectURL(file)
        return url
      }}
      onVideoUpload={async (file) => {
        // TODO: production should upload to Vercel Blob instead of local blob URL
        const url = URL.createObjectURL(file)
        return url
      }}
    />
  </div>
)}
```

- [ ] Show canvas image in preview when available

In the canvas placeholder area (the checkerboard with "Clique pra editar"), replace the empty state with a conditional:

```typescript
{canvasImageUrl ? (
  <img src={canvasImageUrl} alt="Canvas preview" className="h-full w-full object-contain" />
) : (
  <div className="flex h-full w-full flex-col items-center justify-center gap-2" style={{ background: 'rgb(18,16,12)' }}>
    <svg ...>...</svg>
    <span>Clique pra editar</span>
  </div>
)}
```

Similarly update the phone mockup preview to show the canvas image when available.

- [ ] Commit

```bash
git commit -m "feat(social): wire canvas editor overlay — Abrir editor opens fullscreen editor with aspect lock"
```

---

## Summary

| Task | Type | Est | Description |
|------|------|-----|-------------|
| 1 | Migration | 3h | Add 4:5 constraint + seed 4 templates |
| 2 | Schema | 30m | TypeScript ASPECT_RATIOS + CANONICAL_SIZES |
| 3 | Wiring | 6h | Canvas editor overlay + click handlers + image state |
| **Total** | | **~9.5h** | |

### Dependencies

- Task 1 and Task 2 are independent (can run in parallel)
- Task 3 depends on Task 2 (needs 4:5 in the type system)

### Key files changed

```
supabase/migrations/XXXX_social_template_seeds.sql — Task 1 (created)
template-schemas.ts — Task 2
compositor-new.tsx — Task 3
dest-compositor.tsx — Task 3
```
