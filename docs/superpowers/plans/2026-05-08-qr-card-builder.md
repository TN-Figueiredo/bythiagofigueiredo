# QR Card Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare QR form at `/cms/links/[id]/qr` with a visual canvas editor using react-konva — layered compositions with QR codes, text, and images, exported as PNG or SVG.

**Architecture:** Three-panel editor (left controls, center Konva canvas, right inspector) powered by two hooks (`useCardComposition` for state+history, `useCanvasInteraction` for UI). Composition is versioned JSON persisted as JSONB. Exports via `stage.toBlob()` (PNG) and `compositionToSvg()` (SVG).

**Tech Stack:** react-konva, qrcode, Zod, Vercel Blob, Tailwind 4

**Design spec:** `docs/superpowers/specs/2026-05-08-qr-card-builder-design.md`

---

## Dependency Changes

| Package | Add | Type |
|---------|-----|------|
| `packages/links` | `zod` | dependency |
| `packages/links-admin` | `qrcode`, `@types/qrcode` | devDependency |
| `packages/links-admin` | `konva`, `react-konva` | peerDependency |
| `apps/web` | `konva`, `react-konva` | dependency |

## File Structure

### `packages/links/src/qr/` (data layer)

| File | Purpose | Task |
|------|---------|------|
| `card-composition.ts` | CardComposition types + Zod schema + presets + defaults | 1 |
| `card-composition.test.ts` | Schema validation tests | 1 |
| `svg-export.ts` | `compositionToSvg()` pure function | 3 |
| `svg-export.test.ts` | SVG output tests | 3 |

### `packages/links-admin/src/components/qr-card-builder/` (editor)

| File | Purpose | Task |
|------|---------|------|
| `use-card-composition.ts` | Composition state + undo/redo hook | 4 |
| `use-card-composition.test.ts` | Reducer + history tests | 4 |
| `use-canvas-interaction.ts` | Selection, zoom, guides hook | 5 |
| `use-canvas-interaction.test.ts` | Interaction state tests | 5 |
| `color-picker.tsx` | HSV popover color picker | 6 |
| `context-menu.tsx` | Right-click menu | 6 |
| `canvas-editor.tsx` | Konva Stage + viewport + snap guides | 7 |
| `left-panel.tsx` | Aspect ratios + add elements + background | 8 |
| `layers-panel.tsx` | Layer list with reorder | 8 |
| `right-panel.tsx` | Inspector router | 9 |
| `qr-inspector.tsx` | QR property panel | 9 |
| `text-inspector.tsx` | Text property panel | 9 |
| `image-inspector.tsx` | Image property panel | 9 |
| `multi-inspector.tsx` | Multi-select panel | 9 |
| `toolbar.tsx` | Top toolbar | 10 |
| `export-modal.tsx` | Export dialog | 11 |
| `template-browser.tsx` | Template grid | 11 |
| `index.tsx` | Main editor — composes all panels | 12 |

### `apps/web/` (wiring)

| File | Purpose | Task |
|------|---------|------|
| `src/app/cms/(authed)/links/[id]/qr/actions.ts` | Server actions for save/load/export | 13 |
| `src/app/cms/(authed)/links/[id]/qr/page.tsx` | Page — loads composition, renders builder | 14 |

### DB

| File | Purpose | Task |
|------|---------|------|
| `supabase/migrations/20260508100000_qr_card_composition.sql` | Add `qr_card_composition` column | 2 |

## Parallel Execution Waves

```
Wave 1 (3 parallel): Tasks 1, 2, 6
Wave 2 (4 parallel): Tasks 3, 4, 5, 13
Wave 3 (5 parallel): Tasks 7, 8, 9, 10, 11
Wave 4 (1):          Task 12
Wave 5 (1):          Task 14
```

---

## Task 1: CardComposition Types + Zod Schema

**Depends on:** nothing
**Files:**
- Create: `packages/links/src/qr/card-composition.ts`
- Create: `packages/links/src/qr/card-composition.test.ts`
- Modify: `packages/links/src/qr.ts` (add exports)
- Modify: `packages/links/package.json` (add zod)

- [ ] **Step 1: Add zod dependency to packages/links**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm install zod -w packages/links
```

- [ ] **Step 2: Create card-composition.ts**

Create `packages/links/src/qr/card-composition.ts`:

```typescript
import { z } from 'zod'

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6,8}$/)

const BaseElementSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().min(0).max(360).default(0),
  opacity: z.number().min(0).max(1).default(1),
  locked: z.boolean().default(false),
})

const QrElementSchema = BaseElementSchema.extend({
  type: z.literal('qr'),
  foregroundColor: HexColor.default('#000000'),
  backgroundColor: HexColor.default('#ffffff'),
  errorCorrection: z.enum(['L', 'M', 'Q', 'H']).default('M'),
  cornerRadius: z.number().min(0).max(20).default(0),
  maintainAspectRatio: z.literal(true).default(true),
})

const TextElementSchema = BaseElementSchema.extend({
  type: z.literal('text'),
  content: z.string(),
  fontFamily: z.string().default('Inter'),
  fontSize: z.number().min(8).max(400).default(24),
  fontWeight: z.number().min(100).max(900).default(400),
  lineHeight: z.number().min(0.5).max(3).default(1.2),
  letterSpacing: z.string().default('0em'),
  align: z.enum(['left', 'center', 'right']).default('left'),
  color: HexColor.default('#000000'),
  uppercase: z.boolean().default(false),
})

const ImageElementSchema = BaseElementSchema.extend({
  type: z.literal('image'),
  src: z.string().min(1),
  objectFit: z.enum(['fill', 'cover', 'contain', 'stretch']).default('cover'),
  borderRadius: z.number().min(0).max(100).default(0),
  borderColor: HexColor.default('#000000'),
  borderWidth: z.number().min(0).max(20).default(0),
  maintainAspectRatio: z.boolean().default(true),
})

const CardElementSchema = z.discriminatedUnion('type', [
  QrElementSchema,
  TextElementSchema,
  ImageElementSchema,
])

const SolidBackgroundSchema = z.object({
  type: z.literal('solid'),
  color: HexColor,
})

const ImageBackgroundSchema = z.object({
  type: z.literal('image'),
  url: z.string().min(1),
  fallbackColor: HexColor,
})

const GradientStopSchema = z.object({
  color: HexColor,
  position: z.number().min(0).max(1),
})

const GradientBackgroundSchema = z.object({
  type: z.literal('gradient'),
  angle: z.number().min(0).max(360),
  stops: z.array(GradientStopSchema).min(2),
})

const BackgroundSchema = z.discriminatedUnion('type', [
  SolidBackgroundSchema,
  ImageBackgroundSchema,
  GradientBackgroundSchema,
])

const CanvasSchema = z.object({
  width: z.number().min(200).max(4096),
  height: z.number().min(200).max(4096),
  aspectRatio: z.string(),
})

export const CardCompositionSchema = z.object({
  version: z.literal(1),
  canvas: CanvasSchema,
  background: BackgroundSchema,
  elements: z.array(CardElementSchema).max(20),
})

// ─── Types (inferred from Zod) ──────────────────────────────────────────────

export type CardComposition = z.infer<typeof CardCompositionSchema>
export type CardElement = z.infer<typeof CardElementSchema>
export type QrElement = z.infer<typeof QrElementSchema>
export type TextElement = z.infer<typeof TextElementSchema>
export type ImageElement = z.infer<typeof ImageElementSchema>
export type Background = z.infer<typeof BackgroundSchema>
export type GradientStop = z.infer<typeof GradientStopSchema>
export type Canvas = z.infer<typeof CanvasSchema>

// ─── Aspect Ratio Presets ───────────────────────────────────────────────────

export interface AspectRatioPreset {
  name: string
  label: string
  width: number
  height: number
}

export const ASPECT_RATIO_PRESETS: AspectRatioPreset[] = [
  { name: '9:16', label: 'Story', width: 1080, height: 1920 },
  { name: '1:1', label: 'Square', width: 1080, height: 1080 },
  { name: '16:9', label: 'Landscape', width: 1920, height: 1080 },
  { name: '4:5', label: 'Portrait', width: 1080, height: 1350 },
  { name: '1200:630', label: 'Wide (OG)', width: 1200, height: 630 },
  { name: 'custom', label: 'Custom', width: 1080, height: 1080 },
]

export const AVAILABLE_FONTS = [
  'Inter',
  'Fraunces',
  'JetBrains Mono',
  'Source Serif Pro',
  'Caveat',
] as const

export const MAX_ELEMENTS = 20
export const MAX_HISTORY = 50
export const MIN_CANVAS = 200
export const MAX_CANVAS = 4096

// ─── Helpers ────────────────────────────────────────────────────────────────

export function createDefaultComposition(
  preset: AspectRatioPreset = ASPECT_RATIO_PRESETS[1]!,
): CardComposition {
  return {
    version: 1,
    canvas: {
      width: preset.width,
      height: preset.height,
      aspectRatio: preset.name,
    },
    background: { type: 'solid', color: '#ffffff' },
    elements: [],
  }
}

export function createQrElement(
  id: string,
  canvasWidth: number,
  canvasHeight: number,
): QrElement {
  const size = Math.min(canvasWidth, canvasHeight) * 0.4
  return {
    id,
    type: 'qr',
    x: (canvasWidth - size) / 2,
    y: (canvasHeight - size) / 2,
    width: size,
    height: size,
    rotation: 0,
    opacity: 1,
    locked: false,
    foregroundColor: '#000000',
    backgroundColor: '#ffffff',
    errorCorrection: 'M',
    cornerRadius: 0,
    maintainAspectRatio: true,
  }
}

export function createTextElement(
  id: string,
  canvasWidth: number,
  canvasHeight: number,
): TextElement {
  return {
    id,
    type: 'text',
    x: canvasWidth * 0.1,
    y: canvasHeight * 0.8,
    width: canvasWidth * 0.8,
    height: 40,
    rotation: 0,
    opacity: 1,
    locked: false,
    content: 'Your text here',
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: '0em',
    align: 'center',
    color: '#000000',
    uppercase: false,
  }
}

export function createImageElement(
  id: string,
  src: string,
  canvasWidth: number,
  canvasHeight: number,
): ImageElement {
  const size = Math.min(canvasWidth, canvasHeight) * 0.3
  return {
    id,
    type: 'image',
    x: (canvasWidth - size) / 2,
    y: canvasHeight * 0.1,
    width: size,
    height: size,
    rotation: 0,
    opacity: 1,
    locked: false,
    src,
    objectFit: 'cover',
    borderRadius: 0,
    borderColor: '#000000',
    borderWidth: 0,
    maintainAspectRatio: true,
  }
}

export function migrateLegacyQrConfig(
  legacyConfig: { foreground?: string; background?: string; error_correction?: string; size?: number },
  canvasWidth = 1080,
  canvasHeight = 1080,
): CardComposition {
  const comp = createDefaultComposition(ASPECT_RATIO_PRESETS[1]!)
  comp.canvas.width = canvasWidth
  comp.canvas.height = canvasHeight
  comp.background = {
    type: 'solid',
    color: legacyConfig.background ?? '#ffffff',
  }
  const qr = createQrElement('qr-migrated', canvasWidth, canvasHeight)
  qr.foregroundColor = legacyConfig.foreground ?? '#000000'
  qr.backgroundColor = legacyConfig.background ?? '#ffffff'
  qr.errorCorrection = (legacyConfig.error_correction as 'L' | 'M' | 'Q' | 'H') ?? 'M'
  comp.elements = [qr]
  return comp
}
```

- [ ] **Step 3: Write tests for card-composition**

Create `packages/links/src/qr/card-composition.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  CardCompositionSchema,
  ASPECT_RATIO_PRESETS,
  AVAILABLE_FONTS,
  createDefaultComposition,
  createQrElement,
  createTextElement,
  createImageElement,
  migrateLegacyQrConfig,
  MAX_ELEMENTS,
} from './card-composition.js'

describe('CardCompositionSchema', () => {
  const validComposition = {
    version: 1,
    canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
    background: { type: 'solid' as const, color: '#ffffff' },
    elements: [],
  }

  it('accepts a valid empty composition', () => {
    const result = CardCompositionSchema.safeParse(validComposition)
    expect(result.success).toBe(true)
  })

  it('accepts composition with QR element', () => {
    const comp = {
      ...validComposition,
      elements: [{
        id: 'qr-1', type: 'qr', x: 100, y: 100, width: 200, height: 200,
        rotation: 0, opacity: 1, locked: false,
        foregroundColor: '#000000', backgroundColor: '#ffffff',
        errorCorrection: 'M', cornerRadius: 0, maintainAspectRatio: true as const,
      }],
    }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('accepts composition with text element', () => {
    const comp = {
      ...validComposition,
      elements: [{
        id: 'txt-1', type: 'text', x: 10, y: 10, width: 300, height: 40,
        rotation: 0, opacity: 1, locked: false,
        content: 'Hello', fontFamily: 'Inter', fontSize: 24, fontWeight: 400,
        lineHeight: 1.2, letterSpacing: '0em', align: 'left', color: '#000000',
        uppercase: false,
      }],
    }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('accepts composition with image element', () => {
    const comp = {
      ...validComposition,
      elements: [{
        id: 'img-1', type: 'image', x: 0, y: 0, width: 500, height: 500,
        rotation: 0, opacity: 1, locked: false,
        src: 'https://example.com/img.png', objectFit: 'cover',
        borderRadius: 0, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      }],
    }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('accepts gradient background', () => {
    const comp = {
      ...validComposition,
      background: {
        type: 'gradient' as const,
        angle: 90,
        stops: [
          { color: '#ff0000', position: 0 },
          { color: '#0000ff', position: 1 },
        ],
      },
    }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('accepts image background', () => {
    const comp = {
      ...validComposition,
      background: {
        type: 'image' as const,
        url: 'https://example.com/bg.jpg',
        fallbackColor: '#cccccc',
      },
    }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('rejects version !== 1', () => {
    const comp = { ...validComposition, version: 2 }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(false)
  })

  it('rejects canvas width below 200', () => {
    const comp = { ...validComposition, canvas: { ...validComposition.canvas, width: 100 } }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(false)
  })

  it('rejects canvas width above 4096', () => {
    const comp = { ...validComposition, canvas: { ...validComposition.canvas, width: 5000 } }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(false)
  })

  it('rejects more than 20 elements', () => {
    const elements = Array.from({ length: 21 }, (_, i) => ({
      id: `txt-${i}`, type: 'text' as const, x: 0, y: 0, width: 100, height: 40,
      rotation: 0, opacity: 1, locked: false,
      content: 'x', fontFamily: 'Inter', fontSize: 24, fontWeight: 400,
      lineHeight: 1.2, letterSpacing: '0em', align: 'left' as const,
      color: '#000000', uppercase: false,
    }))
    const comp = { ...validComposition, elements }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(false)
  })

  it('rejects invalid hex color', () => {
    const comp = {
      ...validComposition,
      background: { type: 'solid' as const, color: 'not-a-color' },
    }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(false)
  })

  it('rejects gradient with fewer than 2 stops', () => {
    const comp = {
      ...validComposition,
      background: {
        type: 'gradient' as const,
        angle: 0,
        stops: [{ color: '#ff0000', position: 0 }],
      },
    }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(false)
  })
})

describe('ASPECT_RATIO_PRESETS', () => {
  it('has 6 presets', () => {
    expect(ASPECT_RATIO_PRESETS).toHaveLength(6)
  })

  it('includes Story 1080x1920', () => {
    const story = ASPECT_RATIO_PRESETS.find(p => p.label === 'Story')
    expect(story).toEqual({ name: '9:16', label: 'Story', width: 1080, height: 1920 })
  })

  it('includes Square 1080x1080', () => {
    const square = ASPECT_RATIO_PRESETS.find(p => p.label === 'Square')
    expect(square).toEqual({ name: '1:1', label: 'Square', width: 1080, height: 1080 })
  })
})

describe('AVAILABLE_FONTS', () => {
  it('has 5 fonts', () => {
    expect(AVAILABLE_FONTS).toHaveLength(5)
  })
})

describe('createDefaultComposition', () => {
  it('creates a valid composition', () => {
    const comp = createDefaultComposition()
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('defaults to Square preset', () => {
    const comp = createDefaultComposition()
    expect(comp.canvas.width).toBe(1080)
    expect(comp.canvas.height).toBe(1080)
    expect(comp.canvas.aspectRatio).toBe('1:1')
  })

  it('uses provided preset', () => {
    const comp = createDefaultComposition(ASPECT_RATIO_PRESETS[0]!)
    expect(comp.canvas.width).toBe(1080)
    expect(comp.canvas.height).toBe(1920)
  })

  it('starts with solid white background', () => {
    const comp = createDefaultComposition()
    expect(comp.background).toEqual({ type: 'solid', color: '#ffffff' })
  })

  it('starts with no elements', () => {
    const comp = createDefaultComposition()
    expect(comp.elements).toEqual([])
  })
})

describe('createQrElement', () => {
  it('centers QR in canvas', () => {
    const qr = createQrElement('qr-1', 1080, 1080)
    const size = 1080 * 0.4
    expect(qr.x).toBe((1080 - size) / 2)
    expect(qr.y).toBe((1080 - size) / 2)
    expect(qr.width).toBe(size)
    expect(qr.height).toBe(size)
  })

  it('sets type to qr', () => {
    const qr = createQrElement('qr-1', 1080, 1080)
    expect(qr.type).toBe('qr')
  })

  it('maintains aspect ratio', () => {
    const qr = createQrElement('qr-1', 1080, 1080)
    expect(qr.maintainAspectRatio).toBe(true)
  })
})

describe('createTextElement', () => {
  it('positions text near bottom', () => {
    const txt = createTextElement('txt-1', 1080, 1080)
    expect(txt.y).toBe(1080 * 0.8)
    expect(txt.type).toBe('text')
  })
})

describe('createImageElement', () => {
  it('centers image in canvas', () => {
    const img = createImageElement('img-1', 'https://example.com/img.png', 1080, 1080)
    expect(img.type).toBe('image')
    expect(img.src).toBe('https://example.com/img.png')
  })
})

describe('migrateLegacyQrConfig', () => {
  it('creates valid composition from legacy config', () => {
    const comp = migrateLegacyQrConfig({
      foreground: '#ff0000',
      background: '#00ff00',
      error_correction: 'H',
    })
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
    expect(comp.elements).toHaveLength(1)
    expect(comp.elements[0]!.type).toBe('qr')
  })

  it('uses legacy colors', () => {
    const comp = migrateLegacyQrConfig({ foreground: '#ff0000', background: '#00ff00' })
    const qr = comp.elements[0] as { foregroundColor: string; backgroundColor: string }
    expect(qr.foregroundColor).toBe('#ff0000')
    expect(qr.backgroundColor).toBe('#00ff00')
  })

  it('defaults to black/white when no colors provided', () => {
    const comp = migrateLegacyQrConfig({})
    const qr = comp.elements[0] as { foregroundColor: string; backgroundColor: string }
    expect(qr.foregroundColor).toBe('#000000')
    expect(qr.backgroundColor).toBe('#ffffff')
  })
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test -w packages/links -- --run src/qr/card-composition.test.ts
```

- [ ] **Step 5: Update qr.ts exports**

In `packages/links/src/qr.ts`, add after existing exports:

```typescript
// Card composition (QR Card Builder)
export {
  CardCompositionSchema,
  ASPECT_RATIO_PRESETS,
  AVAILABLE_FONTS,
  MAX_ELEMENTS,
  MAX_HISTORY,
  MIN_CANVAS,
  MAX_CANVAS,
  createDefaultComposition,
  createQrElement,
  createTextElement,
  createImageElement,
  migrateLegacyQrConfig,
} from './qr/card-composition.js'
export type {
  CardComposition,
  CardElement,
  QrElement,
  TextElement,
  ImageElement,
  Background,
  GradientStop,
  Canvas,
  AspectRatioPreset,
} from './qr/card-composition.js'
```

- [ ] **Step 6: Commit**

```bash
git add packages/links/src/qr/card-composition.ts packages/links/src/qr/card-composition.test.ts packages/links/src/qr.ts packages/links/package.json package-lock.json
git commit -m "feat(links): add CardComposition types, Zod schema, and presets

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: DB Migration — qr_card_composition Column

**Depends on:** nothing
**Files:**
- Create: `supabase/migrations/20260508100000_qr_card_composition.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/20260508100000_qr_card_composition.sql`:

```sql
-- Add qr_card_composition JSONB column to tracked_links
-- Stores the full CardComposition JSON for the QR Card Builder.
-- The existing qr_config column is kept for legacy compatibility.

ALTER TABLE public.tracked_links
  ADD COLUMN IF NOT EXISTS qr_card_composition jsonb;

-- Update link_qr_templates to add composition column (replaces config for new format)
-- The existing config column is kept; new builder writes to composition.
ALTER TABLE public.link_qr_templates
  ADD COLUMN IF NOT EXISTS composition jsonb;

ALTER TABLE public.link_qr_templates
  ADD COLUMN IF NOT EXISTS thumbnail_url text;
```

- [ ] **Step 2: Push migration to prod**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run db:push:prod
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260508100000_qr_card_composition.sql
git commit -m "feat(db): add qr_card_composition column to tracked_links

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: SVG Export Function

**Depends on:** Task 1
**Files:**
- Create: `packages/links/src/qr/svg-export.ts`
- Create: `packages/links/src/qr/svg-export.test.ts`
- Modify: `packages/links/src/qr.ts` (add export)

- [ ] **Step 1: Create svg-export.ts**

Create `packages/links/src/qr/svg-export.ts`:

```typescript
import type { CardComposition, CardElement, Background } from './card-composition.js'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function renderBackground(bg: Background, width: number, height: number): string {
  switch (bg.type) {
    case 'solid':
      return `<rect width="${width}" height="${height}" fill="${bg.color}" />`
    case 'gradient': {
      const id = 'bg-gradient'
      const rad = (bg.angle * Math.PI) / 180
      const x1 = 50 - Math.cos(rad) * 50
      const y1 = 50 - Math.sin(rad) * 50
      const x2 = 50 + Math.cos(rad) * 50
      const y2 = 50 + Math.sin(rad) * 50
      const stops = bg.stops
        .map(s => `<stop offset="${s.position * 100}%" stop-color="${s.color}" />`)
        .join('\n      ')
      return `<defs>
    <linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">
      ${stops}
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#${id})" />`
    }
    case 'image':
      return `<rect width="${width}" height="${height}" fill="${bg.fallbackColor}" />
  <image href="${escapeXml(bg.url)}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />`
  }
}

function renderElement(el: CardElement): string {
  const transform = buildTransform(el)
  switch (el.type) {
    case 'qr':
      return `<rect${transform} x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${el.backgroundColor}" opacity="${el.opacity}" rx="${el.cornerRadius}" />
  <text${transform} x="${el.x + el.width / 2}" y="${el.y + el.height / 2}" text-anchor="middle" dominant-baseline="central" fill="${el.foregroundColor}" font-size="10" opacity="${el.opacity}">[QR]</text>`
    case 'text': {
      const text = el.uppercase ? el.content.toUpperCase() : el.content
      const anchor = el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start'
      const tx = el.align === 'center' ? el.x + el.width / 2 : el.align === 'right' ? el.x + el.width : el.x
      return `<text${transform} x="${tx}" y="${el.y + el.fontSize}" fill="${el.color}" font-family="${escapeXml(el.fontFamily)}" font-size="${el.fontSize}" font-weight="${el.fontWeight}" letter-spacing="${el.letterSpacing}" text-anchor="${anchor}" opacity="${el.opacity}">${escapeXml(text)}</text>`
    }
    case 'image':
      return `<image${transform} href="${escapeXml(el.src)}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" opacity="${el.opacity}" preserveAspectRatio="xMidYMid slice" />`
  }
}

function buildTransform(el: CardElement): string {
  if (el.rotation === 0) return ''
  const cx = el.x + el.width / 2
  const cy = el.y + el.height / 2
  return ` transform="rotate(${el.rotation}, ${cx}, ${cy})"`
}

export function compositionToSvg(composition: CardComposition): string {
  const { canvas, background, elements } = composition
  const bg = renderBackground(background, canvas.width, canvas.height)
  const els = elements.map(renderElement).join('\n  ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
  <clipPath id="canvas-clip"><rect width="${canvas.width}" height="${canvas.height}" /></clipPath>
  <g clip-path="url(#canvas-clip)">
  ${bg}
  ${els}
  </g>
</svg>`
}
```

- [ ] **Step 2: Write tests**

Create `packages/links/src/qr/svg-export.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { compositionToSvg } from './svg-export.js'
import type { CardComposition } from './card-composition.js'

describe('compositionToSvg', () => {
  const base: CardComposition = {
    version: 1,
    canvas: { width: 500, height: 500, aspectRatio: '1:1' },
    background: { type: 'solid', color: '#ffffff' },
    elements: [],
  }

  it('produces valid SVG with correct dimensions', () => {
    const svg = compositionToSvg(base)
    expect(svg).toContain('width="500"')
    expect(svg).toContain('height="500"')
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
  })

  it('renders solid background', () => {
    const svg = compositionToSvg(base)
    expect(svg).toContain('fill="#ffffff"')
  })

  it('renders gradient background', () => {
    const comp: CardComposition = {
      ...base,
      background: {
        type: 'gradient',
        angle: 90,
        stops: [
          { color: '#ff0000', position: 0 },
          { color: '#0000ff', position: 1 },
        ],
      },
    }
    const svg = compositionToSvg(comp)
    expect(svg).toContain('linearGradient')
    expect(svg).toContain('#ff0000')
    expect(svg).toContain('#0000ff')
  })

  it('renders image background with fallback', () => {
    const comp: CardComposition = {
      ...base,
      background: {
        type: 'image',
        url: 'https://example.com/bg.jpg',
        fallbackColor: '#cccccc',
      },
    }
    const svg = compositionToSvg(comp)
    expect(svg).toContain('fill="#cccccc"')
    expect(svg).toContain('https://example.com/bg.jpg')
  })

  it('renders text element', () => {
    const comp: CardComposition = {
      ...base,
      elements: [{
        id: 't1', type: 'text', x: 10, y: 20, width: 200, height: 40,
        rotation: 0, opacity: 1, locked: false,
        content: 'Hello World', fontFamily: 'Inter', fontSize: 24,
        fontWeight: 700, lineHeight: 1.2, letterSpacing: '0em',
        align: 'left', color: '#333333', uppercase: false,
      }],
    }
    const svg = compositionToSvg(comp)
    expect(svg).toContain('Hello World')
    expect(svg).toContain('font-family="Inter"')
    expect(svg).toContain('font-weight="700"')
    expect(svg).toContain('fill="#333333"')
  })

  it('applies uppercase to text', () => {
    const comp: CardComposition = {
      ...base,
      elements: [{
        id: 't1', type: 'text', x: 0, y: 0, width: 200, height: 40,
        rotation: 0, opacity: 1, locked: false,
        content: 'hello', fontFamily: 'Inter', fontSize: 24,
        fontWeight: 400, lineHeight: 1.2, letterSpacing: '0em',
        align: 'left', color: '#000000', uppercase: true,
      }],
    }
    const svg = compositionToSvg(comp)
    expect(svg).toContain('HELLO')
  })

  it('renders image element', () => {
    const comp: CardComposition = {
      ...base,
      elements: [{
        id: 'i1', type: 'image', x: 50, y: 50, width: 200, height: 200,
        rotation: 0, opacity: 0.8, locked: false,
        src: 'https://example.com/photo.png', objectFit: 'cover',
        borderRadius: 0, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      }],
    }
    const svg = compositionToSvg(comp)
    expect(svg).toContain('https://example.com/photo.png')
    expect(svg).toContain('opacity="0.8"')
  })

  it('applies rotation transform', () => {
    const comp: CardComposition = {
      ...base,
      elements: [{
        id: 't1', type: 'text', x: 100, y: 100, width: 200, height: 40,
        rotation: 45, opacity: 1, locked: false,
        content: 'Rotated', fontFamily: 'Inter', fontSize: 24,
        fontWeight: 400, lineHeight: 1.2, letterSpacing: '0em',
        align: 'left', color: '#000000', uppercase: false,
      }],
    }
    const svg = compositionToSvg(comp)
    expect(svg).toContain('rotate(45,')
  })

  it('includes canvas clip path', () => {
    const svg = compositionToSvg(base)
    expect(svg).toContain('clipPath')
    expect(svg).toContain('canvas-clip')
  })

  it('escapes XML special characters in text', () => {
    const comp: CardComposition = {
      ...base,
      elements: [{
        id: 't1', type: 'text', x: 0, y: 0, width: 200, height: 40,
        rotation: 0, opacity: 1, locked: false,
        content: '<script>alert("xss")</script>', fontFamily: 'Inter',
        fontSize: 24, fontWeight: 400, lineHeight: 1.2, letterSpacing: '0em',
        align: 'left', color: '#000000', uppercase: false,
      }],
    }
    const svg = compositionToSvg(comp)
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
  })

  it('preserves element z-order (first = bottom)', () => {
    const comp: CardComposition = {
      ...base,
      elements: [
        {
          id: 't1', type: 'text', x: 0, y: 0, width: 200, height: 40,
          rotation: 0, opacity: 1, locked: false,
          content: 'Bottom', fontFamily: 'Inter', fontSize: 24,
          fontWeight: 400, lineHeight: 1.2, letterSpacing: '0em',
          align: 'left', color: '#000000', uppercase: false,
        },
        {
          id: 't2', type: 'text', x: 0, y: 0, width: 200, height: 40,
          rotation: 0, opacity: 1, locked: false,
          content: 'Top', fontFamily: 'Inter', fontSize: 24,
          fontWeight: 400, lineHeight: 1.2, letterSpacing: '0em',
          align: 'left', color: '#000000', uppercase: false,
        },
      ],
    }
    const svg = compositionToSvg(comp)
    const bottomIdx = svg.indexOf('Bottom')
    const topIdx = svg.indexOf('Top')
    expect(bottomIdx).toBeLessThan(topIdx)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test -w packages/links -- --run src/qr/svg-export.test.ts
```

- [ ] **Step 4: Add export to qr.ts**

In `packages/links/src/qr.ts`, add:

```typescript
export { compositionToSvg } from './qr/svg-export.js'
```

- [ ] **Step 5: Commit**

```bash
git add packages/links/src/qr/svg-export.ts packages/links/src/qr/svg-export.test.ts packages/links/src/qr.ts
git commit -m "feat(links): add compositionToSvg SVG export function

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: useCardComposition Hook

**Depends on:** Task 1
**Files:**
- Create: `packages/links-admin/src/components/qr-card-builder/use-card-composition.ts`
- Create: `packages/links-admin/src/components/qr-card-builder/use-card-composition.test.ts`

- [ ] **Step 1: Create the hook**

Create `packages/links-admin/src/components/qr-card-builder/use-card-composition.ts`:

```typescript
import { useReducer, useCallback, useMemo } from 'react'
import type { CardComposition, CardElement, Background, Canvas } from '@tn-figueiredo/links/qr'

const MAX_HISTORY = 50

type Action =
  | { type: 'UPDATE_ELEMENT'; id: string; patch: Partial<CardElement> }
  | { type: 'ADD_ELEMENT'; element: CardElement }
  | { type: 'REMOVE_ELEMENT'; id: string }
  | { type: 'REORDER'; fromIndex: number; toIndex: number }
  | { type: 'SET_BACKGROUND'; background: Background }
  | { type: 'SET_CANVAS'; canvas: Canvas }
  | { type: 'REPLACE'; composition: CardComposition }
  | { type: 'UNDO' }
  | { type: 'REDO' }

interface HistoryState {
  past: CardComposition[]
  present: CardComposition
  future: CardComposition[]
}

function pushHistory(state: HistoryState, next: CardComposition): HistoryState {
  const past = [...state.past, state.present].slice(-MAX_HISTORY)
  return { past, present: next, future: [] }
}

function applyElementUpdate(
  elements: CardElement[],
  id: string,
  patch: Partial<CardElement>,
): CardElement[] {
  return elements.map(el =>
    el.id === id ? { ...el, ...patch } as CardElement : el,
  )
}

function reorderArray<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr]
  const [moved] = result.splice(from, 1)
  if (moved !== undefined) result.splice(to, 0, moved)
  return result
}

function reducer(state: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case 'UPDATE_ELEMENT': {
      const next = {
        ...state.present,
        elements: applyElementUpdate(state.present.elements, action.id, action.patch),
      }
      return pushHistory(state, next)
    }
    case 'ADD_ELEMENT': {
      const next = {
        ...state.present,
        elements: [...state.present.elements, action.element],
      }
      return pushHistory(state, next)
    }
    case 'REMOVE_ELEMENT': {
      const next = {
        ...state.present,
        elements: state.present.elements.filter(el => el.id !== action.id),
      }
      return pushHistory(state, next)
    }
    case 'REORDER': {
      const next = {
        ...state.present,
        elements: reorderArray(state.present.elements, action.fromIndex, action.toIndex),
      }
      return pushHistory(state, next)
    }
    case 'SET_BACKGROUND': {
      const next = { ...state.present, background: action.background }
      return pushHistory(state, next)
    }
    case 'SET_CANVAS': {
      const next = { ...state.present, canvas: action.canvas }
      return pushHistory(state, next)
    }
    case 'REPLACE':
      return { past: [], present: action.composition, future: [] }
    case 'UNDO': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]!
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      }
    }
    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[0]!
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      }
    }
  }
}

export function useCardComposition(initial: CardComposition) {
  const [state, dispatch] = useReducer(reducer, {
    past: [],
    present: initial,
    future: [],
  })

  const updateElement = useCallback(
    (id: string, patch: Partial<CardElement>) =>
      dispatch({ type: 'UPDATE_ELEMENT', id, patch }),
    [],
  )

  const addElement = useCallback(
    (element: CardElement) => dispatch({ type: 'ADD_ELEMENT', element }),
    [],
  )

  const removeElement = useCallback(
    (id: string) => dispatch({ type: 'REMOVE_ELEMENT', id }),
    [],
  )

  const reorderElements = useCallback(
    (fromIndex: number, toIndex: number) =>
      dispatch({ type: 'REORDER', fromIndex, toIndex }),
    [],
  )

  const setBackground = useCallback(
    (background: Background) => dispatch({ type: 'SET_BACKGROUND', background }),
    [],
  )

  const setCanvas = useCallback(
    (canvas: Canvas) => dispatch({ type: 'SET_CANVAS', canvas }),
    [],
  )

  const replaceComposition = useCallback(
    (composition: CardComposition) => dispatch({ type: 'REPLACE', composition }),
    [],
  )

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])

  return useMemo(() => ({
    composition: state.present,
    updateElement,
    addElement,
    removeElement,
    reorderElements,
    setBackground,
    setCanvas,
    replaceComposition,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }), [state, updateElement, addElement, removeElement, reorderElements, setBackground, setCanvas, replaceComposition, undo, redo])
}

export type UseCardCompositionReturn = ReturnType<typeof useCardComposition>
```

- [ ] **Step 2: Write tests**

Create `packages/links-admin/src/components/qr-card-builder/use-card-composition.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCardComposition } from './use-card-composition'
import type { CardComposition, CardElement } from '@tn-figueiredo/links/qr'

const base: CardComposition = {
  version: 1,
  canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
  background: { type: 'solid', color: '#ffffff' },
  elements: [],
}

const textEl: CardElement = {
  id: 'txt-1', type: 'text', x: 10, y: 10, width: 200, height: 40,
  rotation: 0, opacity: 1, locked: false,
  content: 'Hello', fontFamily: 'Inter', fontSize: 24, fontWeight: 400,
  lineHeight: 1.2, letterSpacing: '0em', align: 'left', color: '#000000',
  uppercase: false,
}

const qrEl: CardElement = {
  id: 'qr-1', type: 'qr', x: 100, y: 100, width: 200, height: 200,
  rotation: 0, opacity: 1, locked: false,
  foregroundColor: '#000000', backgroundColor: '#ffffff',
  errorCorrection: 'M', cornerRadius: 0, maintainAspectRatio: true as const,
}

describe('useCardComposition', () => {
  it('returns initial composition', () => {
    const { result } = renderHook(() => useCardComposition(base))
    expect(result.current.composition).toEqual(base)
  })

  it('adds an element', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.addElement(textEl))
    expect(result.current.composition.elements).toHaveLength(1)
    expect(result.current.composition.elements[0]!.id).toBe('txt-1')
  })

  it('removes an element', () => {
    const initial = { ...base, elements: [textEl] }
    const { result } = renderHook(() => useCardComposition(initial))
    act(() => result.current.removeElement('txt-1'))
    expect(result.current.composition.elements).toHaveLength(0)
  })

  it('updates an element', () => {
    const initial = { ...base, elements: [textEl] }
    const { result } = renderHook(() => useCardComposition(initial))
    act(() => result.current.updateElement('txt-1', { x: 999 }))
    expect(result.current.composition.elements[0]!.x).toBe(999)
  })

  it('reorders elements', () => {
    const initial = { ...base, elements: [textEl, qrEl] }
    const { result } = renderHook(() => useCardComposition(initial))
    act(() => result.current.reorderElements(0, 1))
    expect(result.current.composition.elements[0]!.id).toBe('qr-1')
    expect(result.current.composition.elements[1]!.id).toBe('txt-1')
  })

  it('sets background', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.setBackground({ type: 'solid', color: '#ff0000' }))
    expect(result.current.composition.background).toEqual({ type: 'solid', color: '#ff0000' })
  })

  it('sets canvas', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.setCanvas({ width: 1920, height: 1080, aspectRatio: '16:9' }))
    expect(result.current.composition.canvas.width).toBe(1920)
  })

  it('undo reverts last action', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.addElement(textEl))
    expect(result.current.composition.elements).toHaveLength(1)
    act(() => result.current.undo())
    expect(result.current.composition.elements).toHaveLength(0)
  })

  it('redo reapplies undone action', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.addElement(textEl))
    act(() => result.current.undo())
    act(() => result.current.redo())
    expect(result.current.composition.elements).toHaveLength(1)
  })

  it('canUndo is false initially', () => {
    const { result } = renderHook(() => useCardComposition(base))
    expect(result.current.canUndo).toBe(false)
  })

  it('canUndo is true after mutation', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.addElement(textEl))
    expect(result.current.canUndo).toBe(true)
  })

  it('canRedo is false initially', () => {
    const { result } = renderHook(() => useCardComposition(base))
    expect(result.current.canRedo).toBe(false)
  })

  it('canRedo is true after undo', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.addElement(textEl))
    act(() => result.current.undo())
    expect(result.current.canRedo).toBe(true)
  })

  it('new mutation clears future (redo)', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.addElement(textEl))
    act(() => result.current.undo())
    expect(result.current.canRedo).toBe(true)
    act(() => result.current.addElement(qrEl))
    expect(result.current.canRedo).toBe(false)
  })

  it('history caps at 50', () => {
    const { result } = renderHook(() => useCardComposition(base))
    for (let i = 0; i < 55; i++) {
      act(() => result.current.addElement({ ...textEl, id: `txt-${i}` }))
    }
    let undoCount = 0
    while (result.current.canUndo) {
      act(() => result.current.undo())
      undoCount++
    }
    expect(undoCount).toBe(50)
  })

  it('replaceComposition resets history', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.addElement(textEl))
    act(() => result.current.addElement(qrEl))
    expect(result.current.canUndo).toBe(true)

    const newComp: CardComposition = {
      ...base,
      canvas: { width: 1920, height: 1080, aspectRatio: '16:9' },
    }
    act(() => result.current.replaceComposition(newComp))
    expect(result.current.composition.canvas.width).toBe(1920)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('undo with empty past is no-op', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.undo())
    expect(result.current.composition).toEqual(base)
  })

  it('redo with empty future is no-op', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.redo())
    expect(result.current.composition).toEqual(base)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test -w packages/links-admin -- --run src/components/qr-card-builder/use-card-composition.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add packages/links-admin/src/components/qr-card-builder/use-card-composition.ts packages/links-admin/src/components/qr-card-builder/use-card-composition.test.ts
git commit -m "feat(links-admin): add useCardComposition hook with undo/redo

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: useCanvasInteraction Hook

**Depends on:** Task 1
**Files:**
- Create: `packages/links-admin/src/components/qr-card-builder/use-canvas-interaction.ts`
- Create: `packages/links-admin/src/components/qr-card-builder/use-canvas-interaction.test.ts`

- [ ] **Step 1: Create the hook**

Create `packages/links-admin/src/components/qr-card-builder/use-canvas-interaction.ts`:

```typescript
import { useState, useCallback, useMemo } from 'react'

export interface ContextMenuState {
  x: number
  y: number
  elementId: string | null
}

export function useCanvasInteraction() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [zoom, setZoomState] = useState(1)
  const [guidesVisible, setGuidesVisible] = useState(true)
  const [gridVisible, setGridVisible] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const select = useCallback((id: string) => {
    setSelectedIds(new Set([id]))
  }, [])

  const multiSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const setZoom = useCallback((z: number) => {
    setZoomState(Math.max(0.1, Math.min(5, z)))
  }, [])

  const fitToView = useCallback(
    (containerWidth: number, containerHeight: number, canvasWidth: number, canvasHeight: number) => {
      const padding = 80
      const scaleX = (containerWidth - padding) / canvasWidth
      const scaleY = (containerHeight - padding) / canvasHeight
      setZoomState(Math.min(scaleX, scaleY, 1))
    },
    [],
  )

  const toggleGuides = useCallback(() => setGuidesVisible(prev => !prev), [])
  const toggleGrid = useCallback(() => setGridVisible(prev => !prev), [])

  const openContextMenu = useCallback((x: number, y: number, elementId: string | null) => {
    setContextMenu({ x, y, elementId })
  }, [])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  return useMemo(() => ({
    selectedIds,
    select,
    multiSelect,
    deselectAll,
    zoom,
    setZoom,
    fitToView,
    guidesVisible,
    gridVisible,
    toggleGuides,
    toggleGrid,
    contextMenu,
    openContextMenu,
    closeContextMenu,
  }), [
    selectedIds, select, multiSelect, deselectAll,
    zoom, setZoom, fitToView,
    guidesVisible, gridVisible, toggleGuides, toggleGrid,
    contextMenu, openContextMenu, closeContextMenu,
  ])
}

export type UseCanvasInteractionReturn = ReturnType<typeof useCanvasInteraction>
```

- [ ] **Step 2: Write tests**

Create `packages/links-admin/src/components/qr-card-builder/use-canvas-interaction.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasInteraction } from './use-canvas-interaction'

describe('useCanvasInteraction', () => {
  it('starts with no selection', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('selects an element', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.select('el-1'))
    expect(result.current.selectedIds.has('el-1')).toBe(true)
    expect(result.current.selectedIds.size).toBe(1)
  })

  it('replaces selection on single select', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.select('el-1'))
    act(() => result.current.select('el-2'))
    expect(result.current.selectedIds.has('el-1')).toBe(false)
    expect(result.current.selectedIds.has('el-2')).toBe(true)
  })

  it('multi-select adds to selection', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.select('el-1'))
    act(() => result.current.multiSelect('el-2'))
    expect(result.current.selectedIds.size).toBe(2)
  })

  it('multi-select toggles off existing selection', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.select('el-1'))
    act(() => result.current.multiSelect('el-1'))
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('deselects all', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.select('el-1'))
    act(() => result.current.multiSelect('el-2'))
    act(() => result.current.deselectAll())
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('default zoom is 1', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    expect(result.current.zoom).toBe(1)
  })

  it('clamps zoom between 0.1 and 5', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.setZoom(0.01))
    expect(result.current.zoom).toBe(0.1)
    act(() => result.current.setZoom(10))
    expect(result.current.zoom).toBe(5)
  })

  it('fitToView calculates correct zoom', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.fitToView(800, 600, 1080, 1080))
    expect(result.current.zoom).toBeCloseTo((600 - 80) / 1080, 5)
  })

  it('fitToView caps at 1', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.fitToView(2000, 2000, 500, 500))
    expect(result.current.zoom).toBe(1)
  })

  it('guides visible by default', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    expect(result.current.guidesVisible).toBe(true)
  })

  it('toggles guides', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.toggleGuides())
    expect(result.current.guidesVisible).toBe(false)
    act(() => result.current.toggleGuides())
    expect(result.current.guidesVisible).toBe(true)
  })

  it('grid hidden by default', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    expect(result.current.gridVisible).toBe(false)
  })

  it('toggles grid', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.toggleGrid())
    expect(result.current.gridVisible).toBe(true)
  })

  it('context menu null by default', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    expect(result.current.contextMenu).toBeNull()
  })

  it('opens and closes context menu', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.openContextMenu(100, 200, 'el-1'))
    expect(result.current.contextMenu).toEqual({ x: 100, y: 200, elementId: 'el-1' })
    act(() => result.current.closeContextMenu())
    expect(result.current.contextMenu).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test -w packages/links-admin -- --run src/components/qr-card-builder/use-canvas-interaction.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add packages/links-admin/src/components/qr-card-builder/use-canvas-interaction.ts packages/links-admin/src/components/qr-card-builder/use-canvas-interaction.test.ts
git commit -m "feat(links-admin): add useCanvasInteraction hook

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Color Picker + Context Menu

**Depends on:** nothing (standalone UI components)
**Files:**
- Create: `packages/links-admin/src/components/qr-card-builder/color-picker.tsx`
- Create: `packages/links-admin/src/components/qr-card-builder/context-menu.tsx`

- [ ] **Step 1: Create color-picker.tsx**

Create `packages/links-admin/src/components/qr-card-builder/color-picker.tsx`:

```tsx
'use client'
import { useState, useCallback, useRef, useEffect } from 'react'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  palette?: string[]
  label?: string
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1, 7), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  const v = max
  const s = max === 0 ? 0 : d / max
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return { h, s, v }
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  let r = 0, g = 0, b = 0
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    case 5: r = v; g = p; b = q; break
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}

export function ColorSwatch({ color, onClick, size = 24 }: { color: string; onClick?: () => void; size?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-neutral-600 shrink-0"
      style={{ width: size, height: size, backgroundColor: color }}
      aria-label={`Color ${color}`}
    />
  )
}

export function ColorPicker({ value, onChange, palette = [], label }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const rgb = hexToRgb(value)
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
  const [hue, setHue] = useState(hsv.h)
  const [hexInput, setHexInput] = useState(value)

  useEffect(() => {
    setHexInput(value)
    const rgb2 = hexToRgb(value)
    const hsv2 = rgbToHsv(rgb2.r, rgb2.g, rgb2.b)
    if (hsv2.s > 0.01 || hsv2.v > 0.01) setHue(hsv2.h)
  }, [value])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleSvClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height))
    const { r, g, b } = hsvToRgb(hue, s, v)
    onChange(rgbToHex(r, g, b))
  }, [hue, onChange])

  const handleHueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const h = Number(e.target.value) / 360
    setHue(h)
    const { r, g, b } = hsvToRgb(h, hsv.s, hsv.v)
    onChange(rgbToHex(r, g, b))
  }, [hsv.s, hsv.v, onChange])

  const handleHexSubmit = useCallback(() => {
    if (/^#[0-9a-fA-F]{6}$/.test(hexInput)) {
      onChange(hexInput.toLowerCase())
    } else {
      setHexInput(value)
    }
  }, [hexInput, onChange, value])

  return (
    <div className="relative">
      {label && <div className="text-[10px] text-neutral-400 mb-1">{label}</div>}
      <div className="flex items-center gap-2">
        <ColorSwatch color={value} onClick={() => setOpen(!open)} />
        <input
          type="text"
          value={hexInput}
          onChange={e => setHexInput(e.target.value)}
          onBlur={handleHexSubmit}
          onKeyDown={e => e.key === 'Enter' && handleHexSubmit()}
          className="w-[72px] bg-neutral-800 border border-neutral-600 rounded px-1.5 py-0.5 text-[11px] font-mono text-neutral-200"
          aria-label={label ? `${label} hex value` : 'Color hex value'}
        />
      </div>
      {open && (
        <div
          ref={popoverRef}
          className="absolute z-50 top-full left-0 mt-1 bg-neutral-900 border border-neutral-700 rounded-lg p-3 shadow-xl"
          style={{ width: 220 }}
        >
          {/* SV gradient */}
          <div
            className="relative w-full h-[140px] rounded cursor-crosshair mb-2"
            style={{
              background: `linear-gradient(to right, #fff, hsl(${hue * 360}, 100%, 50%))`,
            }}
            onClick={handleSvClick}
          >
            <div className="absolute inset-0 rounded" style={{ background: 'linear-gradient(to top, #000, transparent)' }} />
            <div
              className="absolute w-3 h-3 rounded-full border-2 border-white shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
            />
          </div>
          {/* Hue slider */}
          <input
            type="range"
            min={0}
            max={360}
            value={Math.round(hue * 360)}
            onChange={handleHueChange}
            className="w-full h-3 mb-2 rounded appearance-none"
            style={{
              background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
            }}
            aria-label="Hue"
          />
          {/* Hex input */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-neutral-500">HEX</span>
            <input
              type="text"
              value={hexInput}
              onChange={e => setHexInput(e.target.value)}
              onBlur={handleHexSubmit}
              onKeyDown={e => e.key === 'Enter' && handleHexSubmit()}
              className="flex-1 bg-neutral-800 border border-neutral-600 rounded px-1.5 py-0.5 text-[11px] font-mono text-neutral-200"
            />
          </div>
          {/* Palette */}
          {palette.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2 border-t border-neutral-700">
              {palette.map(c => (
                <ColorSwatch key={c} color={c} size={20} onClick={() => onChange(c)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create context-menu.tsx**

Create `packages/links-admin/src/components/qr-card-builder/context-menu.tsx`:

```tsx
'use client'
import { useEffect, useRef } from 'react'

export interface ContextMenuItem {
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  separator?: false
}

export interface ContextMenuSeparator {
  separator: true
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuEntry[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-neutral-900 border border-neutral-700 rounded-lg py-1 shadow-xl min-w-[180px]"
      style={{ left: x, top: y }}
      role="menu"
    >
      {items.map((item, i) => {
        if (item.separator) {
          return <div key={`sep-${i}`} className="border-t border-neutral-700 my-1" />
        }
        return (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => { item.onClick(); onClose() }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-neutral-200 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-default"
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="text-[10px] text-neutral-500 ml-4">{item.shortcut}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/links-admin/src/components/qr-card-builder/color-picker.tsx packages/links-admin/src/components/qr-card-builder/context-menu.tsx
git commit -m "feat(links-admin): add ColorPicker and ContextMenu components

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Canvas Editor

**Depends on:** Tasks 1, 4, 5
**Files:**
- Create: `packages/links-admin/src/components/qr-card-builder/canvas-editor.tsx`

**Note:** This component uses react-konva (Canvas2D). It cannot be tested in jsdom — test manually.

- [ ] **Step 1: Create canvas-editor.tsx**

Create `packages/links-admin/src/components/qr-card-builder/canvas-editor.tsx`:

```tsx
'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer, Rect, Image as KonvaImage, Text as KonvaText, Transformer, Line, Group } from 'react-konva'
import type Konva from 'konva'
import QRCode from 'qrcode'
import type { CardComposition, CardElement } from '@tn-figueiredo/links/qr'
import type { UseCardCompositionReturn } from './use-card-composition'
import type { UseCanvasInteractionReturn } from './use-canvas-interaction'

interface CanvasEditorProps {
  comp: UseCardCompositionReturn
  interaction: UseCanvasInteractionReturn
  shortUrl: string
  containerWidth: number
  containerHeight: number
}

function useLoadedImage(src: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!src) { setImage(null); return }
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setImage(img)
    img.onerror = () => setImage(null)
    img.src = src
    return () => { img.onload = null; img.onerror = null }
  }, [src])
  return image
}

function useQrImage(
  url: string,
  fg: string,
  bg: string,
  ec: 'L' | 'M' | 'Q' | 'H',
): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    let cancelled = false
    async function generate() {
      try {
        const svg = await QRCode.toString(url, {
          type: 'svg', width: 512, margin: 2,
          color: { dark: fg, light: bg },
          errorCorrectionLevel: ec,
        })
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        const blobUrl = URL.createObjectURL(blob)
        const img = new window.Image()
        img.onload = () => {
          if (!cancelled) setImage(img)
          URL.revokeObjectURL(blobUrl)
        }
        img.src = blobUrl
      } catch { /* ignore QR generation errors */ }
    }
    generate()
    return () => { cancelled = true }
  }, [url, fg, bg, ec])
  return image
}

function QrNode({
  element, shortUrl, isSelected, onSelect,
}: {
  element: CardElement & { type: 'qr' }
  shortUrl: string
  isSelected: boolean
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void
}) {
  const image = useQrImage(shortUrl, element.foregroundColor, element.backgroundColor, element.errorCorrection)
  return (
    <KonvaImage
      id={element.id}
      image={image ?? undefined}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation}
      opacity={element.opacity}
      draggable={!element.locked}
      onClick={e => onSelect(element.id, e)}
      onTap={e => onSelect(element.id, e)}
    />
  )
}

function TextNode({
  element, onSelect,
}: {
  element: CardElement & { type: 'text' }
  isSelected: boolean
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void
}) {
  const text = element.uppercase ? element.content.toUpperCase() : element.content
  return (
    <KonvaText
      id={element.id}
      text={text}
      x={element.x}
      y={element.y}
      width={element.width}
      fontSize={element.fontSize}
      fontFamily={element.fontFamily}
      fontStyle={element.fontWeight >= 700 ? 'bold' : 'normal'}
      fill={element.color}
      align={element.align}
      lineHeight={element.lineHeight}
      letterSpacing={parseFloat(element.letterSpacing) * element.fontSize}
      rotation={element.rotation}
      opacity={element.opacity}
      draggable={!element.locked}
      onClick={e => onSelect(element.id, e)}
      onTap={e => onSelect(element.id, e)}
    />
  )
}

function ImageNode({
  element, onSelect,
}: {
  element: CardElement & { type: 'image' }
  isSelected: boolean
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void
}) {
  const image = useLoadedImage(element.src)
  return (
    <Group
      id={element.id}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation}
      opacity={element.opacity}
      draggable={!element.locked}
      onClick={e => onSelect(element.id, e)}
      onTap={e => onSelect(element.id, e)}
    >
      {element.borderWidth > 0 && (
        <Rect
          x={-element.borderWidth}
          y={-element.borderWidth}
          width={element.width + element.borderWidth * 2}
          height={element.height + element.borderWidth * 2}
          fill={element.borderColor}
          cornerRadius={element.borderRadius + element.borderWidth}
        />
      )}
      <KonvaImage
        image={image ?? undefined}
        width={element.width}
        height={element.height}
        cornerRadius={element.borderRadius}
      />
    </Group>
  )
}

function BackgroundRect({ composition }: { composition: CardComposition }) {
  const { canvas, background } = composition
  const bgImage = useLoadedImage(background.type === 'image' ? background.url : null)

  if (background.type === 'solid') {
    return <Rect width={canvas.width} height={canvas.height} fill={background.color} />
  }
  if (background.type === 'image') {
    return (
      <>
        <Rect width={canvas.width} height={canvas.height} fill={background.fallbackColor} />
        {bgImage && <KonvaImage image={bgImage} width={canvas.width} height={canvas.height} />}
      </>
    )
  }
  // Gradient — Konva supports fillLinearGradient
  const rad = (background.angle * Math.PI) / 180
  const hw = canvas.width / 2
  const hh = canvas.height / 2
  return (
    <Rect
      width={canvas.width}
      height={canvas.height}
      fillLinearGradientStartPoint={{ x: hw - Math.cos(rad) * hw, y: hh - Math.sin(rad) * hh }}
      fillLinearGradientEndPoint={{ x: hw + Math.cos(rad) * hw, y: hh + Math.sin(rad) * hh }}
      fillLinearGradientColorStops={background.stops.flatMap(s => [s.position, s.color])}
    />
  )
}

export function CanvasEditor({ comp, interaction, shortUrl, containerWidth, containerHeight }: CanvasEditorProps) {
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const { composition, updateElement } = comp
  const { selectedIds, select, multiSelect, deselectAll, zoom, openContextMenu } = interaction

  // Attach transformer to selected nodes
  useEffect(() => {
    const tr = transformerRef.current
    const stage = stageRef.current
    if (!tr || !stage) return
    const layer = stage.findOne('Layer')
    if (!layer) return
    const nodes = Array.from(selectedIds)
      .map(id => stage.findOne(`#${id}`))
      .filter((n): n is Konva.Node => n !== null && n !== undefined)
    tr.nodes(nodes)
    tr.getLayer()?.batchDraw()
  }, [selectedIds, composition.elements])

  const handleSelect = useCallback((id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    if ((e.evt as MouseEvent).shiftKey) {
      multiSelect(id)
    } else {
      select(id)
    }
  }, [select, multiSelect])

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) deselectAll()
  }, [deselectAll])

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    const id = node.id()
    if (!id) return
    updateElement(id, { x: node.x(), y: node.y() })
  }, [updateElement])

  const handleTransformEnd = useCallback((e: Konva.KonvaEventObject<Event>) => {
    const node = e.target
    const id = node.id()
    if (!id) return
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    updateElement(id, {
      x: node.x(),
      y: node.y(),
      width: Math.max(10, node.width() * scaleX),
      height: Math.max(10, node.height() * scaleY),
      rotation: node.rotation(),
    })
  }, [updateElement])

  const handleContextMenu = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const pos = stage.getPointerPosition()
    if (!pos) return
    const target = e.target
    const elId = target === stage ? null : target.id() || null
    if (elId && !selectedIds.has(elId)) select(elId)
    openContextMenu(pos.x, pos.y, elId)
  }, [selectedIds, select, openContextMenu])

  const stageWidth = containerWidth
  const stageHeight = containerHeight

  const renderElement = (el: CardElement) => {
    const isSelected = selectedIds.has(el.id)
    switch (el.type) {
      case 'qr':
        return <QrNode key={el.id} element={el} shortUrl={shortUrl} isSelected={isSelected} onSelect={handleSelect} />
      case 'text':
        return <TextNode key={el.id} element={el} isSelected={isSelected} onSelect={handleSelect} />
      case 'image':
        return <ImageNode key={el.id} element={el} isSelected={isSelected} onSelect={handleSelect} />
    }
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: stageWidth,
        height: stageHeight,
        backgroundImage: 'repeating-conic-gradient(#1a1a1a 0% 25%, #222 0% 50%)',
        backgroundSize: '20px 20px',
      }}
    >
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        scaleX={zoom}
        scaleY={zoom}
        offsetX={-(stageWidth / zoom - composition.canvas.width) / 2}
        offsetY={-(stageHeight / zoom - composition.canvas.height) / 2}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onContextMenu={handleContextMenu}
      >
        <Layer>
          {/* Canvas card shadow */}
          <Rect
            x={-2}
            y={-2}
            width={composition.canvas.width + 4}
            height={composition.canvas.height + 4}
            fill="rgba(0,0,0,0.3)"
            cornerRadius={2}
          />
          {/* Canvas card */}
          <BackgroundRect composition={composition} />
          {/* Elements */}
          {composition.elements.map(renderElement)}
          {/* Transformer */}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 10 || newBox.height < 10) return oldBox
              return newBox
            }}
            onDragEnd={handleDragEnd}
            onTransformEnd={handleTransformEnd}
          />
        </Layer>
      </Stage>
    </div>
  )
}

export { stageRef as canvasStageRef }
```

**Important:** The `stageRef` is needed by export-modal (Task 11) to call `stage.toBlob()`. The main editor (Task 12) will pass it via a forwarded ref.

- [ ] **Step 2: Commit**

```bash
git add packages/links-admin/src/components/qr-card-builder/canvas-editor.tsx
git commit -m "feat(links-admin): add CanvasEditor with Konva rendering

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Left Panel + Layers Panel

**Depends on:** Tasks 1, 4, 6
**Files:**
- Create: `packages/links-admin/src/components/qr-card-builder/left-panel.tsx`
- Create: `packages/links-admin/src/components/qr-card-builder/layers-panel.tsx`

- [ ] **Step 1: Create layers-panel.tsx**

Create `packages/links-admin/src/components/qr-card-builder/layers-panel.tsx`:

```tsx
'use client'
import { useCallback } from 'react'
import { GripVertical, Eye, Lock, Type, Image, QrCode } from 'lucide-react'
import type { CardElement } from '@tn-figueiredo/links/qr'

interface LayersPanelProps {
  elements: CardElement[]
  selectedIds: Set<string>
  onSelect: (id: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onUpdateElement: (id: string, patch: Partial<CardElement>) => void
}

function elementIcon(type: string) {
  switch (type) {
    case 'qr': return <QrCode size={14} />
    case 'text': return <Type size={14} />
    case 'image': return <Image size={14} />
    default: return null
  }
}

function elementLabel(el: CardElement): string {
  switch (el.type) {
    case 'qr': return 'QR Code'
    case 'text': return el.content.slice(0, 20) || 'Text'
    case 'image': return 'Image'
  }
}

export function LayersPanel({ elements, selectedIds, onSelect, onReorder, onUpdateElement }: LayersPanelProps) {
  const handleMoveUp = useCallback((idx: number) => {
    if (idx < elements.length - 1) onReorder(idx, idx + 1)
  }, [elements.length, onReorder])

  const handleMoveDown = useCallback((idx: number) => {
    if (idx > 0) onReorder(idx, idx - 1)
  }, [onReorder])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); handleMoveUp(idx) }
    if (e.key === 'ArrowDown') { e.preventDefault(); handleMoveDown(idx) }
  }, [handleMoveUp, handleMoveDown])

  // Render in reverse order (top layers first in the list)
  const reversed = [...elements].reverse()

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Layers</span>
        <span className="text-[10px] text-neutral-500">{elements.length}</span>
      </div>
      {reversed.length === 0 && (
        <p className="px-2 py-3 text-[11px] text-neutral-500 text-center">No elements yet</p>
      )}
      {reversed.map((el) => {
        const realIdx = elements.indexOf(el)
        const isSelected = selectedIds.has(el.id)
        return (
          <div
            key={el.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(el.id)}
            onKeyDown={e => handleKeyDown(e, realIdx)}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] cursor-pointer ${
              isSelected ? 'bg-blue-600/20 text-blue-300' : 'text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            <GripVertical size={12} className="text-neutral-600 shrink-0 cursor-grab" />
            {elementIcon(el.type)}
            <span className="flex-1 truncate">{elementLabel(el)}</span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onUpdateElement(el.id, { locked: !el.locked }) }}
              className="p-0.5 hover:text-white"
              aria-label={el.locked ? 'Unlock' : 'Lock'}
            >
              <Lock size={11} className={el.locked ? 'text-yellow-500' : 'text-neutral-600'} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create left-panel.tsx**

Create `packages/links-admin/src/components/qr-card-builder/left-panel.tsx`:

```tsx
'use client'
import { useState, useCallback } from 'react'
import { QrCode, Type, ImagePlus } from 'lucide-react'
import {
  ASPECT_RATIO_PRESETS,
  MAX_ELEMENTS,
  createQrElement,
  createTextElement,
  createImageElement,
} from '@tn-figueiredo/links/qr'
import type { CardComposition, Background } from '@tn-figueiredo/links/qr'
import type { UseCardCompositionReturn } from './use-card-composition'
import type { UseCanvasInteractionReturn } from './use-canvas-interaction'
import { ColorPicker } from './color-picker'
import { LayersPanel } from './layers-panel'

interface LeftPanelProps {
  comp: UseCardCompositionReturn
  interaction: UseCanvasInteractionReturn
  onImageUpload: (file: File) => Promise<string>
}

type BgTab = 'solid' | 'image' | 'gradient'

export function LeftPanel({ comp, interaction, onImageUpload }: LeftPanelProps) {
  const { composition, setCanvas, setBackground, addElement, updateElement, reorderElements } = comp
  const { selectedIds, select } = interaction
  const [bgTab, setBgTab] = useState<BgTab>(composition.background.type as BgTab)

  const handlePreset = useCallback((preset: typeof ASPECT_RATIO_PRESETS[number]) => {
    if (preset.name === 'custom') return
    setCanvas({ width: preset.width, height: preset.height, aspectRatio: preset.name })
  }, [setCanvas])

  const handleAddQr = useCallback(() => {
    if (composition.elements.length >= MAX_ELEMENTS) return
    const id = crypto.randomUUID()
    addElement(createQrElement(id, composition.canvas.width, composition.canvas.height))
    select(id)
  }, [composition, addElement, select])

  const handleAddText = useCallback(() => {
    if (composition.elements.length >= MAX_ELEMENTS) return
    const id = crypto.randomUUID()
    addElement(createTextElement(id, composition.canvas.width, composition.canvas.height))
    select(id)
  }, [composition, addElement, select])

  const handleAddImage = useCallback(async () => {
    if (composition.elements.length >= MAX_ELEMENTS) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file || file.size > 5 * 1024 * 1024) return
      const src = await onImageUpload(file)
      const id = crypto.randomUUID()
      addElement(createImageElement(id, src, composition.canvas.width, composition.canvas.height))
      select(id)
    }
    input.click()
  }, [composition, addElement, select, onImageUpload])

  const handleSolidColor = useCallback((color: string) => {
    setBackground({ type: 'solid', color })
  }, [setBackground])

  const handleGradientAngle = useCallback((angle: number) => {
    if (composition.background.type !== 'gradient') return
    setBackground({ ...composition.background, angle })
  }, [composition.background, setBackground])

  const bg = composition.background

  return (
    <aside className="w-[252px] shrink-0 bg-neutral-900 border-r border-neutral-800 overflow-y-auto flex flex-col">
      {/* Aspect Ratio */}
      <section className="p-3 border-b border-neutral-800">
        <h3 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Aspect Ratio</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {ASPECT_RATIO_PRESETS.map(preset => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handlePreset(preset)}
              className={`p-1.5 rounded text-[10px] text-center border ${
                composition.canvas.aspectRatio === preset.name
                  ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                  : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
              }`}
            >
              <div className="font-medium">{preset.label}</div>
              <div className="text-neutral-500">{preset.name === 'custom' ? '...' : `${preset.width}×${preset.height}`}</div>
            </button>
          ))}
        </div>
        {composition.canvas.aspectRatio === 'custom' && (
          <div className="flex gap-2 mt-2">
            <input
              type="number"
              min={200}
              max={4096}
              value={composition.canvas.width}
              onChange={e => setCanvas({ ...composition.canvas, width: Number(e.target.value) })}
              className="w-1/2 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-[11px] text-neutral-200"
              aria-label="Width"
            />
            <span className="text-neutral-600 self-center">×</span>
            <input
              type="number"
              min={200}
              max={4096}
              value={composition.canvas.height}
              onChange={e => setCanvas({ ...composition.canvas, height: Number(e.target.value) })}
              className="w-1/2 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-[11px] text-neutral-200"
              aria-label="Height"
            />
          </div>
        )}
      </section>

      {/* Add to Canvas */}
      <section className="p-3 border-b border-neutral-800">
        <h3 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Add to Canvas</h3>
        <div className="flex gap-2">
          <button type="button" onClick={handleAddQr} className="flex-1 flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]" disabled={composition.elements.length >= MAX_ELEMENTS}>
            <QrCode size={18} />QR Code
          </button>
          <button type="button" onClick={handleAddText} className="flex-1 flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]" disabled={composition.elements.length >= MAX_ELEMENTS}>
            <Type size={18} />Text
          </button>
          <button type="button" onClick={handleAddImage} className="flex-1 flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]" disabled={composition.elements.length >= MAX_ELEMENTS}>
            <ImagePlus size={18} />Image
          </button>
        </div>
      </section>

      {/* Background */}
      <section className="p-3 border-b border-neutral-800">
        <h3 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Background</h3>
        <div className="flex gap-1 mb-2">
          {(['solid', 'image', 'gradient'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setBgTab(tab)
                if (tab === 'solid' && bg.type !== 'solid') setBackground({ type: 'solid', color: '#ffffff' })
                if (tab === 'gradient' && bg.type !== 'gradient') setBackground({ type: 'gradient', angle: 180, stops: [{ color: '#000000', position: 0 }, { color: '#ffffff', position: 1 }] })
              }}
              className={`flex-1 py-1 rounded text-[10px] ${bgTab === tab ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        {bgTab === 'solid' && bg.type === 'solid' && (
          <ColorPicker value={bg.color} onChange={handleSolidColor} label="Color" />
        )}
        {bgTab === 'gradient' && bg.type === 'gradient' && (
          <div className="space-y-2">
            <div className="h-8 rounded" style={{ background: `linear-gradient(${bg.angle}deg, ${bg.stops.map(s => `${s.color} ${s.position * 100}%`).join(', ')})` }} />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-500">Angle</span>
              <input type="range" min={0} max={360} value={bg.angle} onChange={e => handleGradientAngle(Number(e.target.value))} className="flex-1" />
              <span className="text-[10px] text-neutral-400 w-8 text-right">{bg.angle}°</span>
            </div>
            {bg.stops.map((stop, i) => (
              <div key={i} className="flex items-center gap-2">
                <ColorPicker value={stop.color} onChange={c => {
                  const stops = [...bg.stops]
                  stops[i] = { ...stop, color: c }
                  setBackground({ ...bg, stops })
                }} />
                <span className="text-[10px] text-neutral-400">{Math.round(stop.position * 100)}%</span>
              </div>
            ))}
          </div>
        )}
        {bgTab === 'image' && (
          <div className="space-y-2">
            {bg.type === 'image' && bg.url && (
              <div className="h-14 rounded bg-neutral-800 bg-cover bg-center" style={{ backgroundImage: `url(${bg.url})` }} />
            )}
            <button
              type="button"
              onClick={async () => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'image/*'
                input.onchange = async () => {
                  const file = input.files?.[0]
                  if (!file) return
                  const src = await onImageUpload(file)
                  setBackground({ type: 'image', url: src, fallbackColor: bg.type === 'image' ? bg.fallbackColor : '#ffffff' })
                }
                input.click()
              }}
              className="w-full py-2 border border-dashed border-neutral-600 rounded text-[11px] text-neutral-400 hover:border-neutral-400"
            >
              Upload / Replace
            </button>
          </div>
        )}
      </section>

      {/* Layers */}
      <section className="p-3 flex-1">
        <LayersPanel
          elements={composition.elements}
          selectedIds={selectedIds}
          onSelect={select}
          onReorder={reorderElements}
          onUpdateElement={updateElement}
        />
      </section>
    </aside>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/links-admin/src/components/qr-card-builder/left-panel.tsx packages/links-admin/src/components/qr-card-builder/layers-panel.tsx
git commit -m "feat(links-admin): add LeftPanel and LayersPanel components

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Right Panel + Inspectors

**Depends on:** Tasks 1, 4, 6
**Files:**
- Create: `packages/links-admin/src/components/qr-card-builder/right-panel.tsx`
- Create: `packages/links-admin/src/components/qr-card-builder/qr-inspector.tsx`
- Create: `packages/links-admin/src/components/qr-card-builder/text-inspector.tsx`
- Create: `packages/links-admin/src/components/qr-card-builder/image-inspector.tsx`
- Create: `packages/links-admin/src/components/qr-card-builder/multi-inspector.tsx`

- [ ] **Step 1: Create shared NumberInput helper**

All inspectors use number inputs with labels. Create `packages/links-admin/src/components/qr-card-builder/inspector-field.tsx`:

```tsx
'use client'

interface NumberFieldProps {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
}

export function NumberField({ label, value, onChange, min, max, step = 1, unit }: NumberFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[10px] text-neutral-400 w-6 shrink-0">{label}</label>
      <input
        type="number"
        value={Math.round(value * 100) / 100}
        onChange={e => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-[11px] text-neutral-200 w-0"
      />
      {unit && <span className="text-[9px] text-neutral-500 w-4 shrink-0">{unit}</span>}
    </div>
  )
}

interface SliderFieldProps {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  format?: (v: number) => string
}

export function SliderField({ label, value, onChange, min, max, step = 1, format }: SliderFieldProps) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[10px] text-neutral-400">{label}</span>
        <span className="text-[10px] text-neutral-500">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
    </div>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 mt-3 first:mt-0">{children}</h4>
}
```

- [ ] **Step 2: Create qr-inspector.tsx**

Create `packages/links-admin/src/components/qr-card-builder/qr-inspector.tsx`:

```tsx
'use client'
import { Copy } from 'lucide-react'
import type { QrElement } from '@tn-figueiredo/links/qr'
import { ColorPicker } from './color-picker'
import { NumberField, SliderField, SectionTitle } from './inspector-field'

interface QrInspectorProps {
  element: QrElement
  shortUrl: string
  linkCode: string
  onUpdate: (patch: Partial<QrElement>) => void
}

export function QrInspector({ element, shortUrl, linkCode, onUpdate }: QrInspectorProps) {
  return (
    <div className="space-y-2">
      {/* Encoded URL */}
      <SectionTitle>Encoded URL</SectionTitle>
      <div className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 flex items-center gap-1.5">
        <span className="flex-1 text-[11px] font-mono text-neutral-300 truncate">{shortUrl}</span>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(shortUrl)}
          className="p-0.5 text-neutral-500 hover:text-white"
          title="Copy URL"
        >
          <Copy size={12} />
        </button>
      </div>
      <div className="text-[9px] text-neutral-500">From link: {linkCode}</div>

      {/* Transform */}
      <SectionTitle>Transform</SectionTitle>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberField label="X" value={element.x} onChange={v => onUpdate({ x: v })} unit="px" />
        <NumberField label="Y" value={element.y} onChange={v => onUpdate({ y: v })} unit="px" />
        <NumberField label="W" value={element.width} onChange={v => onUpdate({ width: v, height: v })} min={20} unit="px" />
        <NumberField label="H" value={element.height} onChange={v => onUpdate({ width: v, height: v })} min={20} unit="px" />
      </div>

      {/* QR Appearance */}
      <SectionTitle>QR Appearance</SectionTitle>
      <ColorPicker label="Foreground" value={element.foregroundColor} onChange={c => onUpdate({ foregroundColor: c })} />
      <ColorPicker label="Background" value={element.backgroundColor} onChange={c => onUpdate({ backgroundColor: c })} />
      <div>
        <span className="text-[10px] text-neutral-400">Error Correction</span>
        <select
          value={element.errorCorrection}
          onChange={e => onUpdate({ errorCorrection: e.target.value as 'L' | 'M' | 'Q' | 'H' })}
          className="w-full mt-0.5 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-1 text-[11px] text-neutral-200"
        >
          <option value="L">L (7%)</option>
          <option value="M">M (15%)</option>
          <option value="Q">Q (25%)</option>
          <option value="H">H (30%)</option>
        </select>
      </div>
      <SliderField label="Corner Radius" value={element.cornerRadius} onChange={v => onUpdate({ cornerRadius: v })} min={0} max={20} format={v => `${v}px`} />

      {/* Display */}
      <SectionTitle>Display</SectionTitle>
      <SliderField label="Rotation" value={element.rotation} onChange={v => onUpdate({ rotation: v })} min={0} max={360} format={v => `${v}°`} />
      <SliderField label="Opacity" value={element.opacity * 100} onChange={v => onUpdate({ opacity: v / 100 })} min={0} max={100} format={v => `${Math.round(v)}%`} />

      {/* Options */}
      <SectionTitle>Options</SectionTitle>
      <label className="flex items-center gap-2 text-[11px] text-neutral-300">
        <input type="checkbox" checked={element.locked} onChange={e => onUpdate({ locked: e.target.checked })} className="rounded" />
        Lock position
      </label>
    </div>
  )
}
```

- [ ] **Step 3: Create text-inspector.tsx**

Create `packages/links-admin/src/components/qr-card-builder/text-inspector.tsx`:

```tsx
'use client'
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { AVAILABLE_FONTS } from '@tn-figueiredo/links/qr'
import type { TextElement } from '@tn-figueiredo/links/qr'
import { ColorPicker } from './color-picker'
import { NumberField, SliderField, SectionTitle } from './inspector-field'

interface TextInspectorProps {
  element: TextElement
  onUpdate: (patch: Partial<TextElement>) => void
}

export function TextInspector({ element, onUpdate }: TextInspectorProps) {
  return (
    <div className="space-y-2">
      <SectionTitle>Content</SectionTitle>
      <textarea
        value={element.content}
        onChange={e => onUpdate({ content: e.target.value })}
        rows={3}
        className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-[12px] text-neutral-200 resize-y"
      />

      <SectionTitle>Transform</SectionTitle>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberField label="X" value={element.x} onChange={v => onUpdate({ x: v })} unit="px" />
        <NumberField label="Y" value={element.y} onChange={v => onUpdate({ y: v })} unit="px" />
        <NumberField label="W" value={element.width} onChange={v => onUpdate({ width: v })} min={20} unit="px" />
      </div>

      <SectionTitle>Typography</SectionTitle>
      <div>
        <span className="text-[10px] text-neutral-400">Font</span>
        <select
          value={element.fontFamily}
          onChange={e => onUpdate({ fontFamily: e.target.value })}
          className="w-full mt-0.5 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-1 text-[11px] text-neutral-200"
        >
          {AVAILABLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberField label="Size" value={element.fontSize} onChange={v => onUpdate({ fontSize: v })} min={8} max={400} unit="px" />
        <NumberField label="Wt" value={element.fontWeight} onChange={v => onUpdate({ fontWeight: v })} min={100} max={900} step={100} />
      </div>
      <NumberField label="LH" value={element.lineHeight} onChange={v => onUpdate({ lineHeight: v })} min={0.5} max={3} step={0.1} />
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-neutral-400 w-6">Align</span>
        {(['left', 'center', 'right'] as const).map(a => (
          <button
            key={a}
            type="button"
            onClick={() => onUpdate({ align: a })}
            className={`p-1 rounded ${element.align === a ? 'bg-blue-600/30 text-blue-300' : 'text-neutral-400 hover:text-white'}`}
          >
            {a === 'left' ? <AlignLeft size={14} /> : a === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[11px] text-neutral-300">
        <input type="checkbox" checked={element.uppercase} onChange={e => onUpdate({ uppercase: e.target.checked })} className="rounded" />
        Uppercase
      </label>

      <SectionTitle>Color</SectionTitle>
      <ColorPicker label="Text color" value={element.color} onChange={c => onUpdate({ color: c })} />

      <SectionTitle>Display</SectionTitle>
      <SliderField label="Rotation" value={element.rotation} onChange={v => onUpdate({ rotation: v })} min={0} max={360} format={v => `${v}°`} />
      <SliderField label="Opacity" value={element.opacity * 100} onChange={v => onUpdate({ opacity: v / 100 })} min={0} max={100} format={v => `${Math.round(v)}%`} />

      <SectionTitle>Options</SectionTitle>
      <label className="flex items-center gap-2 text-[11px] text-neutral-300">
        <input type="checkbox" checked={element.locked} onChange={e => onUpdate({ locked: e.target.checked })} className="rounded" />
        Lock position
      </label>
    </div>
  )
}
```

- [ ] **Step 4: Create image-inspector.tsx**

Create `packages/links-admin/src/components/qr-card-builder/image-inspector.tsx`:

```tsx
'use client'
import type { ImageElement } from '@tn-figueiredo/links/qr'
import { ColorPicker } from './color-picker'
import { NumberField, SliderField, SectionTitle } from './inspector-field'

interface ImageInspectorProps {
  element: ImageElement
  onUpdate: (patch: Partial<ImageElement>) => void
  onReplaceImage: () => void
}

const FIT_OPTIONS = [
  { value: 'fill', label: 'Fill' },
  { value: 'cover', label: 'Cover' },
  { value: 'contain', label: 'Contain' },
  { value: 'stretch', label: 'Stretch' },
] as const

export function ImageInspector({ element, onUpdate, onReplaceImage }: ImageInspectorProps) {
  return (
    <div className="space-y-2">
      <SectionTitle>Source</SectionTitle>
      <div className="h-14 rounded bg-neutral-800 bg-cover bg-center border border-neutral-700" style={{ backgroundImage: `url(${element.src})` }} />
      <button type="button" onClick={onReplaceImage} className="w-full py-1.5 border border-dashed border-neutral-600 rounded text-[11px] text-neutral-400 hover:border-neutral-400">
        Replace image
      </button>

      <SectionTitle>Transform</SectionTitle>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberField label="X" value={element.x} onChange={v => onUpdate({ x: v })} unit="px" />
        <NumberField label="Y" value={element.y} onChange={v => onUpdate({ y: v })} unit="px" />
        <NumberField label="W" value={element.width} onChange={v => {
          if (element.maintainAspectRatio) {
            const ratio = element.height / element.width
            onUpdate({ width: v, height: v * ratio })
          } else {
            onUpdate({ width: v })
          }
        }} min={10} unit="px" />
        <NumberField label="H" value={element.height} onChange={v => {
          if (element.maintainAspectRatio) {
            const ratio = element.width / element.height
            onUpdate({ height: v, width: v * ratio })
          } else {
            onUpdate({ height: v })
          }
        }} min={10} unit="px" />
      </div>

      <SectionTitle>Object Fit</SectionTitle>
      <div className="flex gap-1">
        {FIT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onUpdate({ objectFit: opt.value })}
            className={`flex-1 py-1 rounded text-[10px] ${element.objectFit === opt.value ? 'bg-blue-600/30 text-blue-300' : 'text-neutral-400 hover:text-white border border-neutral-700'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <SectionTitle>Appearance</SectionTitle>
      <SliderField label="Border Radius" value={element.borderRadius} onChange={v => onUpdate({ borderRadius: v })} min={0} max={100} format={v => `${v}px`} />
      <ColorPicker label="Border Color" value={element.borderColor} onChange={c => onUpdate({ borderColor: c })} />
      <SliderField label="Border Width" value={element.borderWidth} onChange={v => onUpdate({ borderWidth: v })} min={0} max={20} format={v => `${v}px`} />

      <SectionTitle>Display</SectionTitle>
      <SliderField label="Rotation" value={element.rotation} onChange={v => onUpdate({ rotation: v })} min={0} max={360} format={v => `${v}°`} />
      <SliderField label="Opacity" value={element.opacity * 100} onChange={v => onUpdate({ opacity: v / 100 })} min={0} max={100} format={v => `${Math.round(v)}%`} />

      <SectionTitle>Options</SectionTitle>
      <label className="flex items-center gap-2 text-[11px] text-neutral-300">
        <input type="checkbox" checked={element.locked} onChange={e => onUpdate({ locked: e.target.checked })} className="rounded" />
        Lock position
      </label>
      <label className="flex items-center gap-2 text-[11px] text-neutral-300">
        <input type="checkbox" checked={element.maintainAspectRatio} onChange={e => onUpdate({ maintainAspectRatio: e.target.checked })} className="rounded" />
        Maintain aspect ratio
      </label>
    </div>
  )
}
```

- [ ] **Step 5: Create multi-inspector.tsx**

Create `packages/links-admin/src/components/qr-card-builder/multi-inspector.tsx`:

```tsx
'use client'
import { Trash2, Lock } from 'lucide-react'
import type { CardElement } from '@tn-figueiredo/links/qr'
import { SliderField, SectionTitle } from './inspector-field'

interface MultiInspectorProps {
  elements: CardElement[]
  onUpdateAll: (patch: Partial<CardElement>) => void
  onDeleteAll: () => void
  onLockAll: () => void
  onAlign: (alignment: string) => void
}

export function MultiInspector({ elements, onUpdateAll, onDeleteAll, onLockAll, onAlign }: MultiInspectorProps) {
  const opacities = elements.map(e => e.opacity)
  const allSame = opacities.every(o => o === opacities[0])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="bg-blue-600/20 text-blue-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">{elements.length}</span>
        <span className="text-[12px] text-neutral-300">Elements Selected</span>
      </div>

      <SectionTitle>Alignment</SectionTitle>
      <div className="grid grid-cols-4 gap-1">
        {[
          { key: 'left', label: 'Left' },
          { key: 'center-h', label: 'Center' },
          { key: 'right', label: 'Right' },
          { key: 'top', label: 'Top' },
          { key: 'middle', label: 'Middle' },
          { key: 'bottom', label: 'Bottom' },
          { key: 'distribute-h', label: 'Dist H' },
          { key: 'distribute-v', label: 'Dist V' },
        ].map(a => (
          <button
            key={a.key}
            type="button"
            onClick={() => onAlign(a.key)}
            className="py-1.5 rounded border border-neutral-700 text-[9px] text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
          >
            {a.label}
          </button>
        ))}
      </div>

      <SectionTitle>Shared Properties</SectionTitle>
      <SliderField
        label="Opacity"
        value={allSame ? (opacities[0] ?? 1) * 100 : 50}
        onChange={v => onUpdateAll({ opacity: v / 100 })}
        min={0}
        max={100}
        format={v => allSame ? `${Math.round(v)}%` : 'Mixed'}
      />

      <SectionTitle>Actions</SectionTitle>
      <div className="flex gap-2">
        <button type="button" onClick={onLockAll} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded border border-neutral-700 text-[11px] text-neutral-300 hover:border-neutral-500">
          <Lock size={12} />Lock All
        </button>
        <button type="button" onClick={onDeleteAll} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded border border-red-800 text-[11px] text-red-400 hover:border-red-600">
          <Trash2 size={12} />Delete All
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create right-panel.tsx**

Create `packages/links-admin/src/components/qr-card-builder/right-panel.tsx`:

```tsx
'use client'
import type { CardComposition, CardElement } from '@tn-figueiredo/links/qr'
import { QrInspector } from './qr-inspector'
import { TextInspector } from './text-inspector'
import { ImageInspector } from './image-inspector'
import { MultiInspector } from './multi-inspector'

interface RightPanelProps {
  composition: CardComposition
  selectedIds: Set<string>
  shortUrl: string
  linkCode: string
  onUpdateElement: (id: string, patch: Partial<CardElement>) => void
  onRemoveElement: (id: string) => void
  onReplaceImage: (elementId: string) => void
}

export function RightPanel({
  composition, selectedIds, shortUrl, linkCode,
  onUpdateElement, onRemoveElement, onReplaceImage,
}: RightPanelProps) {
  const selectedElements = composition.elements.filter(el => selectedIds.has(el.id))

  if (selectedElements.length === 0) {
    return (
      <aside className="w-[244px] shrink-0 bg-neutral-900 border-l border-neutral-800 p-3 overflow-y-auto">
        <p className="text-[11px] text-neutral-500 text-center mt-8">Select an element to edit its properties</p>
      </aside>
    )
  }

  if (selectedElements.length > 1) {
    return (
      <aside className="w-[244px] shrink-0 bg-neutral-900 border-l border-neutral-800 p-3 overflow-y-auto">
        <MultiInspector
          elements={selectedElements}
          onUpdateAll={patch => selectedElements.forEach(el => onUpdateElement(el.id, patch))}
          onDeleteAll={() => selectedElements.forEach(el => onRemoveElement(el.id))}
          onLockAll={() => selectedElements.forEach(el => onUpdateElement(el.id, { locked: true }))}
          onAlign={() => { /* alignment logic handled in main editor */ }}
        />
      </aside>
    )
  }

  const element = selectedElements[0]!

  return (
    <aside className="w-[244px] shrink-0 bg-neutral-900 border-l border-neutral-800 p-3 overflow-y-auto">
      {element.type === 'qr' && (
        <QrInspector
          element={element}
          shortUrl={shortUrl}
          linkCode={linkCode}
          onUpdate={patch => onUpdateElement(element.id, patch)}
        />
      )}
      {element.type === 'text' && (
        <TextInspector
          element={element}
          onUpdate={patch => onUpdateElement(element.id, patch)}
        />
      )}
      {element.type === 'image' && (
        <ImageInspector
          element={element}
          onUpdate={patch => onUpdateElement(element.id, patch)}
          onReplaceImage={() => onReplaceImage(element.id)}
        />
      )}
    </aside>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/links-admin/src/components/qr-card-builder/inspector-field.tsx packages/links-admin/src/components/qr-card-builder/qr-inspector.tsx packages/links-admin/src/components/qr-card-builder/text-inspector.tsx packages/links-admin/src/components/qr-card-builder/image-inspector.tsx packages/links-admin/src/components/qr-card-builder/multi-inspector.tsx packages/links-admin/src/components/qr-card-builder/right-panel.tsx
git commit -m "feat(links-admin): add inspector panels for QR, text, image, multi-select

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Toolbar

**Depends on:** Task 4
**Files:**
- Create: `packages/links-admin/src/components/qr-card-builder/toolbar.tsx`

- [ ] **Step 1: Create toolbar.tsx**

Create `packages/links-admin/src/components/qr-card-builder/toolbar.tsx`:

```tsx
'use client'
import { Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Grid3X3, Magnet, Save, Download } from 'lucide-react'

interface ToolbarProps {
  linkCode: string
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFitToView: () => void
  guidesVisible: boolean
  onToggleGuides: () => void
  gridVisible: boolean
  onToggleGrid: () => void
  isSaving: boolean
  onOpenTemplates: () => void
  onOpenExport: () => void
}

export function Toolbar({
  linkCode, canUndo, canRedo, onUndo, onRedo,
  zoom, onZoomIn, onZoomOut, onFitToView,
  guidesVisible, onToggleGuides, gridVisible, onToggleGrid,
  isSaving, onOpenTemplates, onOpenExport,
}: ToolbarProps) {
  return (
    <div className="h-10 bg-neutral-900 border-b border-neutral-800 flex items-center px-3 gap-1">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-[11px] text-neutral-400 mr-4">
        <span className="hover:text-neutral-200 cursor-pointer">Links</span>
        <span>/</span>
        <span className="text-neutral-200 font-medium">{linkCode}</span>
        <span>/</span>
        <span className="text-blue-400">QR Card</span>
      </div>

      <div className="w-px h-5 bg-neutral-700 mx-1" />

      {/* Undo / Redo */}
      <button type="button" onClick={onUndo} disabled={!canUndo} className="p-1.5 rounded text-neutral-400 hover:text-white disabled:opacity-30" title="Undo (⌘Z)" aria-label="Undo">
        <Undo2 size={15} />
      </button>
      <button type="button" onClick={onRedo} disabled={!canRedo} className="p-1.5 rounded text-neutral-400 hover:text-white disabled:opacity-30" title="Redo (⌘⇧Z)" aria-label="Redo">
        <Redo2 size={15} />
      </button>

      <div className="w-px h-5 bg-neutral-700 mx-1" />

      {/* Zoom */}
      <button type="button" onClick={onZoomOut} className="p-1.5 rounded text-neutral-400 hover:text-white" title="Zoom out" aria-label="Zoom out">
        <ZoomOut size={15} />
      </button>
      <span className="text-[11px] text-neutral-300 w-10 text-center">{Math.round(zoom * 100)}%</span>
      <button type="button" onClick={onZoomIn} className="p-1.5 rounded text-neutral-400 hover:text-white" title="Zoom in" aria-label="Zoom in">
        <ZoomIn size={15} />
      </button>
      <button type="button" onClick={onFitToView} className="p-1.5 rounded text-neutral-400 hover:text-white" title="Fit to view (⌘0)" aria-label="Fit to view">
        <Maximize size={14} />
      </button>

      <div className="w-px h-5 bg-neutral-700 mx-1" />

      {/* Toggles */}
      <button type="button" onClick={onToggleGuides} className={`p-1.5 rounded ${guidesVisible ? 'text-blue-400' : 'text-neutral-500'} hover:text-white`} title="Snap guides (⌘G)" aria-label="Toggle snap guides">
        <Magnet size={14} />
      </button>
      <button type="button" onClick={onToggleGrid} className={`p-1.5 rounded ${gridVisible ? 'text-blue-400' : 'text-neutral-500'} hover:text-white`} title="Toggle grid" aria-label="Toggle grid">
        <Grid3X3 size={14} />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save status */}
      {isSaving && <span className="text-[10px] text-neutral-500 mr-2">Saving...</span>}

      {/* Template & Export */}
      <button type="button" onClick={onOpenTemplates} className="px-2.5 py-1 rounded border border-neutral-700 text-[11px] text-neutral-300 hover:border-neutral-500 mr-1" aria-label="Templates">
        <Save size={13} className="inline mr-1" />Templates
      </button>
      <button type="button" onClick={onOpenExport} className="px-2.5 py-1 rounded bg-blue-600 text-[11px] text-white hover:bg-blue-500" aria-label="Export">
        <Download size={13} className="inline mr-1" />Export
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/links-admin/src/components/qr-card-builder/toolbar.tsx
git commit -m "feat(links-admin): add Toolbar component for QR Card Builder

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 11: Export Modal + Template Browser

**Depends on:** Tasks 1, 3, 4
**Files:**
- Create: `packages/links-admin/src/components/qr-card-builder/export-modal.tsx`
- Create: `packages/links-admin/src/components/qr-card-builder/template-browser.tsx`

- [ ] **Step 1: Create export-modal.tsx**

Create `packages/links-admin/src/components/qr-card-builder/export-modal.tsx`:

```tsx
'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { X, Check, Loader2, Download, Copy } from 'lucide-react'
import type Konva from 'konva'
import type { CardComposition } from '@tn-figueiredo/links/qr'
import { compositionToSvg } from '@tn-figueiredo/links/qr'

interface ExportModalProps {
  composition: CardComposition
  stageRef: React.RefObject<Konva.Stage | null>
  linkCode: string
  onExport: (blob: Blob, metadata: { format: 'png' | 'svg'; scale: number; width: number; height: number }) => Promise<{ url: string } | null>
  onClose: () => void
}

type ExportState = 'idle' | 'exporting' | 'done'

export function ExportModal({ composition, stageRef, linkCode, onExport, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<'png' | 'svg'>('png')
  const [scale, setScale] = useState(2)
  const [saveToBlob, setSaveToBlob] = useState(true)
  const [state, setState] = useState<ExportState>('idle')
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<number>(0)
  const [step, setStep] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const w = composition.canvas.width
  const h = composition.canvas.height
  const outW = format === 'png' ? w * scale : w
  const outH = format === 'png' ? h * scale : h

  const handleExport = useCallback(async () => {
    setState('exporting')
    setStep(1)

    let blob: Blob

    if (format === 'png') {
      await document.fonts.ready
      setStep(2)
      const stage = stageRef.current
      if (!stage) { setState('idle'); return }
      blob = await new Promise<Blob>((resolve, reject) => {
        stage.toBlob({
          pixelRatio: scale,
          callback: (b: Blob | null) => b ? resolve(b) : reject(new Error('toBlob failed')),
        })
      })
    } else {
      setStep(2)
      const svg = compositionToSvg(composition)
      blob = new Blob([svg], { type: 'image/svg+xml' })
    }

    setFileSize(blob.size)
    setStep(3)

    let resultUrl: string | null = null
    if (saveToBlob) {
      const result = await onExport(blob, { format, scale, width: outW, height: outH })
      resultUrl = result?.url ?? null
    }

    setStep(4)
    const downloadUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `qr-card-${linkCode}.${format}`
    a.click()
    URL.revokeObjectURL(downloadUrl)

    setBlobUrl(resultUrl)
    setState('done')
  }, [format, scale, saveToBlob, composition, stageRef, linkCode, onExport, outW, outH])

  const steps = [
    { label: `Rendering canvas at ${scale}x resolution`, done: step >= 2 },
    { label: `Encoding ${format.toUpperCase()} (${outW}×${outH})`, done: step >= 3 },
    ...(saveToBlob ? [{ label: 'Uploading to Vercel Blob...', done: step >= 4 }] : []),
    { label: 'Saving to browser downloads', done: step >= 4 },
  ]

  const estimatedSize = format === 'png' ? `~${Math.round(outW * outH * 4 / 1024 / 5)} KB` : 'varies'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        ref={dialogRef}
        className="relative bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-[560px] max-h-[80vh] overflow-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Export QR Card"
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-[14px] font-semibold text-neutral-200">Export QR Card</h2>
          <button type="button" onClick={onClose} className="p-1 text-neutral-500 hover:text-white" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 flex gap-6">
          {/* Preview */}
          <div className="shrink-0">
            <div className="w-[160px] h-[160px] bg-neutral-800 rounded border border-neutral-700 flex items-center justify-center text-[11px] text-neutral-500">
              Preview
            </div>
            <div className="text-[10px] text-neutral-500 text-center mt-1">{w}×{h}</div>
          </div>

          {/* Options */}
          <div className="flex-1 space-y-4">
            {state === 'idle' && (
              <>
                <div>
                  <div className="text-[10px] text-neutral-400 mb-1">Format</div>
                  <div className="flex gap-2">
                    {(['png', 'svg'] as const).map(f => (
                      <button key={f} type="button" onClick={() => setFormat(f)} className={`flex-1 py-1.5 rounded text-[11px] border ${format === f ? 'border-blue-500 bg-blue-600/10 text-blue-300' : 'border-neutral-700 text-neutral-400'}`}>
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {format === 'png' && (
                  <div>
                    <div className="text-[10px] text-neutral-400 mb-1">Scale</div>
                    <div className="flex gap-2">
                      {[1, 2, 3].map(s => (
                        <button key={s} type="button" onClick={() => setScale(s)} className={`flex-1 py-1.5 rounded text-[11px] border ${scale === s ? 'border-blue-500 bg-blue-600/10 text-blue-300' : 'border-neutral-700 text-neutral-400'}`}>
                          {s}× <span className="text-[9px] text-neutral-500 block">{w * s}×{h * s}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 text-[11px] text-neutral-300">
                  <input type="checkbox" checked={saveToBlob} onChange={e => setSaveToBlob(e.target.checked)} className="rounded" />
                  Save copy to Vercel Blob
                </label>

                <button type="button" onClick={handleExport} className="w-full py-2 rounded bg-blue-600 text-[12px] font-medium text-white hover:bg-blue-500">
                  <Download size={14} className="inline mr-1.5" />
                  Download {format.toUpperCase()} · {scale}× · {estimatedSize}
                </button>
              </>
            )}

            {state === 'exporting' && (
              <div className="space-y-2">
                {steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    {s.done ? <Check size={14} className="text-green-400" /> : i === step - 1 ? <Loader2 size={14} className="text-blue-400 animate-spin" /> : <div className="w-3.5 h-3.5 rounded-full border border-neutral-600" />}
                    <span className={s.done ? 'text-neutral-300' : 'text-neutral-500'}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            {state === 'done' && (
              <div className="space-y-3 text-center">
                <div className="w-10 h-10 mx-auto bg-green-600/20 rounded-full flex items-center justify-center">
                  <Check size={20} className="text-green-400" />
                </div>
                <p className="text-[13px] text-neutral-200 font-medium">Card exported successfully</p>
                <p className="text-[11px] text-neutral-500">{`qr-card-${linkCode}.${format}`} · {(fileSize / 1024).toFixed(0)} KB</p>
                {blobUrl && (
                  <div className="flex items-center gap-2 bg-neutral-800 rounded px-2 py-1.5">
                    <span className="flex-1 text-[10px] font-mono text-neutral-400 truncate">{blobUrl}</span>
                    <button type="button" onClick={() => navigator.clipboard.writeText(blobUrl)} className="text-neutral-500 hover:text-white">
                      <Copy size={12} />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={onClose} className="flex-1 py-1.5 rounded border border-neutral-700 text-[11px] text-neutral-300">
                    Back to Editor
                  </button>
                  <button type="button" onClick={() => { setState('idle'); setBlobUrl(null) }} className="flex-1 py-1.5 rounded border border-neutral-700 text-[11px] text-neutral-300">
                    Export Another
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create template-browser.tsx**

Create `packages/links-admin/src/components/qr-card-builder/template-browser.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { CardComposition } from '@tn-figueiredo/links/qr'

export interface QrTemplate {
  id: string
  name: string
  composition: CardComposition
  thumbnailUrl: string | null
  createdAt: string
}

interface TemplateBrowserProps {
  templates: QrTemplate[]
  onLoad: (composition: CardComposition) => void
  onSave: (name: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function TemplateBrowser({ templates, onLoad, onSave, onDelete, onClose }: TemplateBrowserProps) {
  const [saveName, setSaveName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-[640px] max-h-[80vh] overflow-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Templates"
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-[14px] font-semibold text-neutral-200">Templates</h2>
          <button type="button" onClick={onClose} className="text-neutral-500 hover:text-white text-[12px]">Close</button>
        </div>

        <div className="p-4 grid grid-cols-3 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
          {/* Blank canvas */}
          <button
            type="button"
            onClick={() => {
              onLoad({
                version: 1,
                canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
                background: { type: 'solid', color: '#ffffff' },
                elements: [],
              })
              onClose()
            }}
            className="aspect-square rounded-lg border-2 border-dashed border-neutral-700 flex flex-col items-center justify-center text-neutral-500 hover:border-neutral-500 hover:text-neutral-300"
          >
            <div className="text-[24px] mb-1">+</div>
            <span className="text-[11px]">Blank Canvas</span>
          </button>

          {/* Save current */}
          <div className="aspect-square rounded-lg border-2 border-dashed border-blue-800 flex flex-col items-center justify-center text-blue-400 hover:border-blue-600">
            {showSaveInput ? (
              <div className="p-2 space-y-2">
                <input
                  type="text"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder="Template name"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-[11px] text-neutral-200"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { if (saveName.trim()) { onSave(saveName.trim()); setShowSaveInput(false); setSaveName('') } }}
                  className="w-full py-1 rounded bg-blue-600 text-[11px] text-white"
                >
                  Save
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowSaveInput(true)} className="w-full h-full flex flex-col items-center justify-center">
                <Plus size={20} className="mb-1" />
                <span className="text-[11px]">Save Current</span>
              </button>
            )}
          </div>

          {/* Templates */}
          {templates.map(tpl => (
            <div key={tpl.id} className="relative group">
              <button
                type="button"
                onClick={() => { onLoad(tpl.composition); onClose() }}
                className="w-full aspect-square rounded-lg border border-neutral-700 bg-neutral-800 overflow-hidden hover:border-blue-500"
              >
                {tpl.thumbnailUrl ? (
                  <img src={tpl.thumbnailUrl} alt={tpl.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-600 text-[10px]">No preview</div>
                )}
              </button>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] text-neutral-400 truncate">{tpl.name}</span>
                <button
                  type="button"
                  onClick={() => onDelete(tpl.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-600 hover:text-red-400"
                  aria-label={`Delete template ${tpl.name}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/links-admin/src/components/qr-card-builder/export-modal.tsx packages/links-admin/src/components/qr-card-builder/template-browser.tsx
git commit -m "feat(links-admin): add ExportModal and TemplateBrowser

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 12: Main Editor (index.tsx) + Package Exports

**Depends on:** Tasks 7–11
**Files:**
- Create: `packages/links-admin/src/components/qr-card-builder/index.tsx`
- Modify: `packages/links-admin/src/client.ts`
- Modify: `packages/links-admin/src/index.ts`
- Modify: `packages/links-admin/src/types.ts`

- [ ] **Step 1: Create index.tsx (main editor)**

Create `packages/links-admin/src/components/qr-card-builder/index.tsx`:

```tsx
'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import type Konva from 'konva'
import type { CardComposition, CardElement } from '@tn-figueiredo/links/qr'
import { useCardComposition } from './use-card-composition'
import { useCanvasInteraction } from './use-canvas-interaction'
import { CanvasEditor } from './canvas-editor'
import { LeftPanel } from './left-panel'
import { RightPanel } from './right-panel'
import { Toolbar } from './toolbar'
import { ContextMenu } from './context-menu'
import type { ContextMenuEntry } from './context-menu'
import { ExportModal } from './export-modal'
import { TemplateBrowser } from './template-browser'
import type { QrTemplate } from './template-browser'

export interface QrCardBuilderProps {
  link: { id: string; code: string; title: string | null }
  shortUrl: string
  initialComposition: CardComposition
  templates: QrTemplate[]
  onSave: (composition: CardComposition) => Promise<void>
  onExport: (blob: Blob, metadata: { format: 'png' | 'svg'; scale: number; width: number; height: number }) => Promise<{ url: string } | null>
  onSaveTemplate: (name: string, composition: CardComposition, thumbnail: Blob) => Promise<void>
  onDeleteTemplate: (id: string) => Promise<void>
  onImageUpload: (file: File) => Promise<string>
}

export function QrCardBuilder({
  link, shortUrl, initialComposition, templates,
  onSave, onExport, onSaveTemplate, onDeleteTemplate, onImageUpload,
}: QrCardBuilderProps) {
  const comp = useCardComposition(initialComposition)
  const interaction = useCanvasInteraction()
  const stageRef = useRef<Konva.Stage>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [showExport, setShowExport] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [viewportTooSmall, setViewportTooSmall] = useState(false)

  // Viewport check
  useEffect(() => {
    function check() { setViewportTooSmall(window.innerWidth < 960) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Container resize
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Auto-save on composition change (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      setIsSaving(true)
      try { await onSave(comp.composition) } finally { setIsSaving(false) }
    }, 1500)
    return () => clearTimeout(timer)
  }, [comp.composition, onSave])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      const cmd = e.metaKey || e.ctrlKey
      if (cmd && e.key === 'z' && !e.shiftKey) { e.preventDefault(); comp.undo() }
      if (cmd && e.key === 'z' && e.shiftKey) { e.preventDefault(); comp.redo() }
      if (cmd && e.key === 'g' && !e.shiftKey) { e.preventDefault(); interaction.toggleGuides() }
      if (cmd && e.key === '0') { e.preventDefault(); interaction.fitToView(containerSize.width, containerSize.height, comp.composition.canvas.width, comp.composition.canvas.height) }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !cmd) {
        e.preventDefault()
        interaction.selectedIds.forEach(id => comp.removeElement(id))
        interaction.deselectAll()
      }
      if (cmd && e.key === 'd') {
        e.preventDefault()
        interaction.selectedIds.forEach(id => {
          const el = comp.composition.elements.find(e => e.id === id)
          if (el) comp.addElement({ ...el, id: crypto.randomUUID(), x: el.x + 20, y: el.y + 20 })
        })
      }
      if (cmd && e.key === 'l') {
        e.preventDefault()
        interaction.selectedIds.forEach(id => {
          const el = comp.composition.elements.find(e => e.id === id)
          if (el) comp.updateElement(id, { locked: !el.locked })
        })
      }
      if (cmd && e.key === ']' && !e.shiftKey) {
        e.preventDefault()
        interaction.selectedIds.forEach(id => {
          const idx = comp.composition.elements.findIndex(e => e.id === id)
          if (idx < comp.composition.elements.length - 1) comp.reorderElements(idx, idx + 1)
        })
      }
      if (cmd && e.key === '[' && !e.shiftKey) {
        e.preventDefault()
        interaction.selectedIds.forEach(id => {
          const idx = comp.composition.elements.findIndex(e => e.id === id)
          if (idx > 0) comp.reorderElements(idx, idx - 1)
        })
      }
      if (cmd && e.shiftKey && e.key === 'E') { e.preventDefault(); setShowExport(true) }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [comp, interaction, containerSize])

  const handleReplaceImage = useCallback((elementId: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file || file.size > 5 * 1024 * 1024) return
      const src = await onImageUpload(file)
      comp.updateElement(elementId, { src })
    }
    input.click()
  }, [comp, onImageUpload])

  // Context menu items
  const contextMenuItems = useCallback((): ContextMenuEntry[] => {
    const cm = interaction.contextMenu
    if (!cm?.elementId) return []
    const el = comp.composition.elements.find(e => e.id === cm.elementId)
    if (!el) return []
    const idx = comp.composition.elements.indexOf(el)
    return [
      { label: 'Bring Forward', shortcut: '⌘]', onClick: () => { if (idx < comp.composition.elements.length - 1) comp.reorderElements(idx, idx + 1) } },
      { label: 'Send Backward', shortcut: '⌘[', onClick: () => { if (idx > 0) comp.reorderElements(idx, idx - 1) } },
      { label: 'Bring to Front', shortcut: '⌘⇧]', onClick: () => comp.reorderElements(idx, comp.composition.elements.length - 1) },
      { label: 'Send to Back', shortcut: '⌘⇧[', onClick: () => comp.reorderElements(idx, 0) },
      { separator: true },
      { label: 'Duplicate', shortcut: '⌘D', onClick: () => comp.addElement({ ...el, id: crypto.randomUUID(), x: el.x + 20, y: el.y + 20 }) },
      { label: el.locked ? 'Unlock' : 'Lock', shortcut: '⌘L', onClick: () => comp.updateElement(el.id, { locked: !el.locked }) },
      { separator: true },
      { label: 'Delete', shortcut: '⌫', onClick: () => { comp.removeElement(el.id); interaction.deselectAll() } },
    ]
  }, [interaction.contextMenu, comp, interaction])

  const handleSaveTemplate = useCallback(async (name: string) => {
    const stage = stageRef.current
    if (!stage) return
    const dataUrl = stage.toDataURL({ pixelRatio: 0.5 })
    const res = await fetch(dataUrl)
    const thumbnail = await res.blob()
    await onSaveTemplate(name, comp.composition, thumbnail)
  }, [comp.composition, onSaveTemplate])

  if (viewportTooSmall) {
    return (
      <div className="fixed inset-0 bg-neutral-950 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-[16px] text-neutral-300 font-medium mb-2">Desktop Required</p>
          <p className="text-[13px] text-neutral-500">This editor requires a desktop viewport (960px+).</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-neutral-950 flex flex-col" role="application" aria-label="QR Card canvas editor">
      <Toolbar
        linkCode={link.code}
        canUndo={comp.canUndo}
        canRedo={comp.canRedo}
        onUndo={comp.undo}
        onRedo={comp.redo}
        zoom={interaction.zoom}
        onZoomIn={() => interaction.setZoom(interaction.zoom + 0.1)}
        onZoomOut={() => interaction.setZoom(interaction.zoom - 0.1)}
        onFitToView={() => interaction.fitToView(containerSize.width, containerSize.height, comp.composition.canvas.width, comp.composition.canvas.height)}
        guidesVisible={interaction.guidesVisible}
        onToggleGuides={interaction.toggleGuides}
        gridVisible={interaction.gridVisible}
        onToggleGrid={interaction.toggleGrid}
        isSaving={isSaving}
        onOpenTemplates={() => setShowTemplates(true)}
        onOpenExport={() => setShowExport(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <LeftPanel comp={comp} interaction={interaction} onImageUpload={onImageUpload} />

        <div ref={containerRef} className="flex-1 overflow-hidden">
          <CanvasEditor
            comp={comp}
            interaction={interaction}
            shortUrl={shortUrl}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
          />
        </div>

        <RightPanel
          composition={comp.composition}
          selectedIds={interaction.selectedIds}
          shortUrl={shortUrl}
          linkCode={link.code}
          onUpdateElement={comp.updateElement}
          onRemoveElement={comp.removeElement}
          onReplaceImage={handleReplaceImage}
        />
      </div>

      {/* Status bar */}
      <div className="h-[22px] bg-neutral-900 border-t border-neutral-800 flex items-center px-3 gap-4 text-[10px] text-neutral-500">
        <span>{comp.composition.canvas.width}×{comp.composition.canvas.height}</span>
        <span>{comp.composition.canvas.aspectRatio}</span>
        <span>{comp.composition.elements.length} elements</span>
      </div>

      {/* Context menu */}
      {interaction.contextMenu && (
        <ContextMenu
          x={interaction.contextMenu.x}
          y={interaction.contextMenu.y}
          items={contextMenuItems()}
          onClose={interaction.closeContextMenu}
        />
      )}

      {/* Modals */}
      {showExport && (
        <ExportModal
          composition={comp.composition}
          stageRef={stageRef}
          linkCode={link.code}
          onExport={onExport}
          onClose={() => setShowExport(false)}
        />
      )}
      {showTemplates && (
        <TemplateBrowser
          templates={templates}
          onLoad={c => comp.replaceComposition(c)}
          onSave={handleSaveTemplate}
          onDelete={onDeleteTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add QrTemplate type to types.ts**

In `packages/links-admin/src/types.ts`, add at the end:

```typescript
export interface QrTemplate {
  id: string
  name: string
  composition: Record<string, unknown>
  thumbnailUrl: string | null
  createdAt: string
}
```

- [ ] **Step 3: Update client.ts — add export**

In `packages/links-admin/src/client.ts`, add:

```typescript
export { QrCardBuilder } from './components/qr-card-builder/index'
export type { QrCardBuilderProps } from './components/qr-card-builder/index'
```

- [ ] **Step 4: Update index.ts — add type re-export**

In `packages/links-admin/src/index.ts`, add:

```typescript
export type { QrCardBuilderProps } from './components/qr-card-builder/index'
```

- [ ] **Step 5: Commit**

```bash
git add packages/links-admin/src/components/qr-card-builder/index.tsx packages/links-admin/src/client.ts packages/links-admin/src/index.ts packages/links-admin/src/types.ts
git commit -m "feat(links-admin): add QrCardBuilder main editor component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 13: Server Actions

**Depends on:** Tasks 1, 2
**Files:**
- Create: `apps/web/src/app/cms/(authed)/links/[id]/qr/actions.ts`

- [ ] **Step 1: Create server actions file**

Create `apps/web/src/app/cms/(authed)/links/[id]/qr/actions.ts`:

```typescript
'use server'

import { revalidateTag } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CardCompositionSchema } from '@tn-figueiredo/links/qr'
import { uploadMediaAsset } from '@/lib/media/upload'
import type { CardComposition } from '@tn-figueiredo/links/qr'

type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

async function requireEditScope(siteId: string) {
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
}

export async function saveQrCard(
  linkId: string,
  composition: CardComposition,
): Promise<ActionResult> {
  if (!linkId) return { ok: false, error: 'id_required' }

  const parsed = CardCompositionSchema.safeParse(composition)
  if (!parsed.success) return { ok: false, error: 'invalid_composition' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('tracked_links')
    .update({
      qr_card_composition: parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', linkId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidateTag(`link:${linkId}`)
  return { ok: true }
}

export async function loadQrCard(
  linkId: string,
): Promise<ActionResult<{ composition: CardComposition | null; legacyConfig: Record<string, unknown> | null }>> {
  if (!linkId) return { ok: false, error: 'id_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('tracked_links')
    .select('qr_card_composition, qr_config')
    .eq('id', linkId)
    .eq('site_id', siteId)
    .single()

  if (error) return { ok: false, error: error.message }

  const raw = data.qr_card_composition as unknown
  if (raw) {
    const parsed = CardCompositionSchema.safeParse(raw)
    if (parsed.success) return { ok: true, composition: parsed.data, legacyConfig: null }
  }

  return {
    ok: true,
    composition: null,
    legacyConfig: (data.qr_config as Record<string, unknown>) ?? null,
  }
}

export async function saveQrTemplate(
  name: string,
  composition: CardComposition,
  thumbnailFormData: FormData,
): Promise<ActionResult<{ id: string }>> {
  if (!name) return { ok: false, error: 'name_required' }

  const parsed = CardCompositionSchema.safeParse(composition)
  if (!parsed.success) return { ok: false, error: 'invalid_composition' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const thumbnailFile = thumbnailFormData.get('thumbnail') as File | null
  let thumbnailUrl: string | null = null

  if (thumbnailFile && thumbnailFile.size > 0) {
    const result = await uploadMediaAsset({
      file: thumbnailFile,
      filename: `qr-template-${Date.now()}.png`,
      folder: 'qr-templates',
      siteId,
      uploadedBy: 'system',
      tags: ['qr-template'],
    })
    if (result.ok) thumbnailUrl = result.asset.blobUrl
  }

  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('link_qr_templates')
    .insert({
      site_id: siteId,
      name,
      composition: parsed.data,
      config: parsed.data,
      thumbnail_url: thumbnailUrl,
      thumbnail_path: thumbnailUrl,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  revalidateTag('links-settings')
  return { ok: true, id: data.id as string }
}

export async function listQrTemplates(): Promise<ActionResult<{ templates: Array<{ id: string; name: string; composition: CardComposition; thumbnailUrl: string | null; createdAt: string }> }>> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('link_qr_templates')
    .select('id, name, composition, config, thumbnail_url, thumbnail_path, created_at')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })

  if (error) return { ok: false, error: error.message }

  const templates = (data ?? []).map(row => {
    const comp = (row.composition ?? row.config) as CardComposition
    return {
      id: row.id as string,
      name: row.name as string,
      composition: comp,
      thumbnailUrl: (row.thumbnail_url ?? row.thumbnail_path ?? null) as string | null,
      createdAt: row.created_at as string,
    }
  })

  return { ok: true, templates }
}

export async function deleteQrTemplate(templateId: string): Promise<ActionResult> {
  if (!templateId) return { ok: false, error: 'id_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('link_qr_templates')
    .delete()
    .eq('id', templateId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidateTag('links-settings')
  return { ok: true }
}

export async function exportQrCard(
  linkId: string,
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  if (!linkId) return { ok: false, error: 'id_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const file = formData.get('file') as File | null
  if (!file) return { ok: false, error: 'file_required' }

  const format = formData.get('format') as string ?? 'png'
  const result = await uploadMediaAsset({
    file,
    filename: `qr-card-${linkId}.${format}`,
    folder: 'qr-cards',
    siteId,
    uploadedBy: 'system',
    tags: ['qr-card', `link:${linkId}`],
  })

  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, url: result.asset.blobUrl }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/links/\[id\]/qr/actions.ts
git commit -m "feat(web): add server actions for QR Card Builder

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 14: Page Wiring + Dependencies + Build + Test

**Depends on:** Tasks 12, 13
**Files:**
- Modify: `apps/web/src/app/cms/(authed)/links/[id]/qr/page.tsx`
- Modify: `packages/links-admin/package.json` (add peer deps)
- Modify: `packages/links-admin/tsup.config.ts` (add externals)
- Modify: `apps/web/package.json` (add deps)

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm install qrcode @types/qrcode -w packages/links-admin --save-dev
```

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm install konva react-konva -w apps/web
```

- [ ] **Step 2: Add konva/react-konva as peer deps in links-admin**

In `packages/links-admin/package.json`, add to `peerDependencies`:

```json
"konva": ">=9.0.0",
"react-konva": ">=18.0.0"
```

- [ ] **Step 3: Update tsup.config.ts externals**

In `packages/links-admin/tsup.config.ts`, update both entries' `external` to include:

```typescript
external: ['react', 'react-dom', 'konva', 'react-konva']
```

- [ ] **Step 4: Rewrite page.tsx**

Replace `apps/web/src/app/cms/(authed)/links/[id]/qr/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { QrCardBuilder } from '@tn-figueiredo/links-admin/client'
import {
  createDefaultComposition,
  migrateLegacyQrConfig,
} from '@tn-figueiredo/links/qr'
import {
  saveQrCard,
  loadQrCard,
  listQrTemplates,
  saveQrTemplate,
  deleteQrTemplate,
  exportQrCard,
} from './actions'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function QrCardBuilderPage({ params }: Props) {
  const { id } = await params
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!authRes.ok) redirect('/cms')

  const supabase = getSupabaseServiceClient()

  const { data: link, error } = await supabase
    .from('tracked_links')
    .select('id, code, title, destination_url, qr_card_composition, qr_config')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (error || !link) notFound()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'
  const shortUrl = `${appUrl}/go/${link.code}`

  // Load or migrate composition
  let composition = createDefaultComposition()
  if (link.qr_card_composition) {
    const loaded = await loadQrCard(id)
    if (loaded.ok && loaded.composition) {
      composition = loaded.composition
    }
  } else if (link.qr_config) {
    composition = migrateLegacyQrConfig(link.qr_config as Record<string, string>)
  }

  // Load templates
  const templatesResult = await listQrTemplates()
  const templates = templatesResult.ok ? templatesResult.templates : []

  // Server action wrappers
  async function handleSave(comp: unknown) {
    'use server'
    await saveQrCard(id, comp as import('@tn-figueiredo/links/qr').CardComposition)
  }

  async function handleExport(formData: FormData) {
    'use server'
    const result = await exportQrCard(id, formData)
    return result.ok ? { url: result.url } : null
  }

  async function handleSaveTemplate(name: string, comp: unknown, thumbnailFormData: FormData) {
    'use server'
    await saveQrTemplate(name, comp as import('@tn-figueiredo/links/qr').CardComposition, thumbnailFormData)
  }

  async function handleDeleteTemplate(templateId: string) {
    'use server'
    await deleteQrTemplate(templateId)
  }

  async function handleImageUpload(formData: FormData) {
    'use server'
    const file = formData.get('file') as File
    if (!file) return ''
    const { uploadMediaAsset: upload } = await import('@/lib/media/upload')
    const { getSiteContext: ctx } = await import('@/lib/cms/site-context')
    const { siteId: sid } = await ctx()
    const result = await upload({
      file, filename: file.name, folder: 'qr-cards',
      siteId: sid, uploadedBy: 'system', tags: ['qr-card-image'],
    })
    return result.ok ? result.asset.blobUrl : ''
  }

  return (
    <QrCardBuilder
      link={{ id: link.id as string, code: link.code as string, title: link.title as string | null }}
      shortUrl={shortUrl}
      initialComposition={composition}
      templates={templates.map(t => ({
        ...t,
        composition: t.composition as import('@tn-figueiredo/links/qr').CardComposition,
      }))}
      onSave={handleSave}
      onExport={async (blob, metadata) => {
        const fd = new FormData()
        fd.append('file', blob)
        fd.append('format', metadata.format)
        return handleExport(fd)
      }}
      onSaveTemplate={async (name, comp, thumbnail) => {
        const fd = new FormData()
        fd.append('thumbnail', thumbnail)
        await handleSaveTemplate(name, comp, fd)
      }}
      onDeleteTemplate={handleDeleteTemplate}
      onImageUpload={async (file) => {
        const fd = new FormData()
        fd.append('file', file)
        return handleImageUpload(fd)
      }}
    />
  )
}
```

- [ ] **Step 5: Build packages**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run build -w packages/links && npm run build -w packages/links-admin
```

- [ ] **Step 6: Run all tests**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm test
```

- [ ] **Step 7: Typecheck**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run typecheck -w apps/web
```

- [ ] **Step 8: Commit all remaining changes**

```bash
git add apps/web/src/app/cms/\(authed\)/links/\[id\]/qr/page.tsx packages/links-admin/package.json packages/links-admin/tsup.config.ts apps/web/package.json package-lock.json
git commit -m "feat(web): wire QR Card Builder page + install deps

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
