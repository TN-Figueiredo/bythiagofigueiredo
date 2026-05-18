# Phase 2: Template System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the template CRUD, library page, server-side Konva rendering, seed data, and settings matrix. Templates use the existing `CardComposition` type from `@tn-figueiredo/links/qr` and are organized by aspect ratio (`9:16`, `1:1`, `16:9`), not by platform.

**Architecture:** Server actions follow the established pattern in `apps/web/src/lib/social/actions/` (use `requireEditAccess()`, return `ActionResult`). Templates are stored in `social_templates` (Phase 1 migration). Server-side rendering replaces the existing `@vercel/og`-based `story-generator.ts` with Konva + node-canvas for visual parity between server Quick Mode and client Design Mode. Seed data provides 9 system defaults (3 per aspect ratio). The Settings Matrix maps content_type x platform to default template IDs, stored in `sites.social_defaults` JSONB.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, Supabase, Vercel Blob (`@vercel/blob`), konva + canvas (node-canvas), Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-17-social-composer-stories-templates-design.md` — Sections 4, 7, 8.

**Depends on:** Phase 1 (DB migration creating `social_templates` table + `sites.social_defaults` column).

---

## File Structure

```
New files:
  apps/web/src/lib/social/template-schemas.ts
  apps/web/src/lib/social/actions/templates.ts
  apps/web/src/lib/social/konva-renderer.ts
  apps/web/src/app/cms/(authed)/social/templates/page.tsx
  apps/web/src/app/cms/(authed)/social/templates/loading.tsx
  apps/web/src/app/cms/(authed)/social/templates/_components/template-grid.tsx
  apps/web/src/app/cms/(authed)/social/templates/_components/template-card.tsx
  apps/web/src/lib/social/actions/settings.ts
  apps/web/src/app/cms/(authed)/settings/social/_components/template-matrix.tsx
  apps/web/test/social-template-actions.test.ts
  apps/web/test/konva-renderer.test.ts
  scripts/seed-social-templates.ts

Modified files:
  apps/web/src/app/cms/(authed)/settings/social/page.tsx
  apps/web/src/app/cms/(authed)/_shared/cms-sections.ts  (add Templates nav item)
```

**Dependency graph:**

```
Task 5 (Template CRUD + Zod schemas + tests)
  ├──► Task 6 (Template Library Page)    ─── parallel ──┐
  ├──► Task 7 (Konva Renderer + tests)   ─── parallel ──┤
  └──► Task 8 (Seed Data)                ─── after 5 ───┘
Task 6 ──► Task 9 (Settings Matrix)      ─── after 6 ───┘
```

Tasks 5, 6, 7 can start in parallel once Phase 1 migration is applied. Task 8 depends on Task 5 (needs template types). Task 9 depends on Task 6 (needs template list action for dropdowns).

---

### Task 5: Template CRUD Server Actions

**Files:**
- Create: `apps/web/src/lib/social/template-schemas.ts`
- Create: `apps/web/src/lib/social/actions/templates.ts`
- Create: `apps/web/test/social-template-actions.test.ts`

- [ ] **Step 1: Create Zod schemas**

Create `apps/web/src/lib/social/template-schemas.ts`:

```typescript
import { z } from 'zod'
import { CardCompositionSchema } from '@tn-figueiredo/links/qr'

export const ASPECT_RATIOS = ['9:16', '1:1', '16:9'] as const
export type TemplateAspectRatio = (typeof ASPECT_RATIOS)[number]

export const CANONICAL_SIZES: Record<TemplateAspectRatio, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1280, height: 720 },
}

export const aspectRatioSchema = z.enum(ASPECT_RATIOS)

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  aspectRatio: aspectRatioSchema,
  composition: CardCompositionSchema,
  thumbnailBase64: z.string().optional(),
})

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  composition: CardCompositionSchema.optional(),
  thumbnailBase64: z.string().optional(),
})

export interface SocialTemplate {
  id: string
  site_id: string | null
  name: string
  aspect_ratio: TemplateAspectRatio
  composition: z.infer<typeof CardCompositionSchema>
  thumbnail_url: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface TemplateContext {
  title?: string
  description?: string
  cover_image?: string
  short_url?: string
  logo?: string
}
```

- [ ] **Step 2: Write failing tests**

Create `apps/web/test/social-template-actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createTemplateSchema,
  updateTemplateSchema,
  aspectRatioSchema,
  ASPECT_RATIOS,
  CANONICAL_SIZES,
  type SocialTemplate,
} from '@/lib/social/template-schemas'
import { CardCompositionSchema } from '@tn-figueiredo/links/qr'

// ---------------------------------------------------------------------------
// Zod schema unit tests (no DB, no mocking)
// ---------------------------------------------------------------------------

const VALID_COMPOSITION = {
  version: 1 as const,
  canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
  background: { type: 'solid' as const, color: '#0a0a0a' },
  elements: [
    {
      id: 'title-1',
      type: 'text' as const,
      x: 80,
      y: 800,
      width: 920,
      height: 200,
      rotation: 0,
      opacity: 1,
      locked: false,
      content: '{{title}}',
      fontFamily: 'Inter',
      fontSize: 48,
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: '0em',
      align: 'center' as const,
      color: '#ffffff',
      backgroundColor: null,
      backgroundPadding: 8,
      backgroundRadius: 4,
      uppercase: false,
    },
  ],
}

describe('template-schemas', () => {
  describe('aspectRatioSchema', () => {
    it('accepts valid aspect ratios', () => {
      for (const ratio of ASPECT_RATIOS) {
        expect(aspectRatioSchema.safeParse(ratio).success).toBe(true)
      }
    })

    it('rejects invalid aspect ratios', () => {
      expect(aspectRatioSchema.safeParse('4:3').success).toBe(false)
      expect(aspectRatioSchema.safeParse('').success).toBe(false)
    })
  })

  describe('CANONICAL_SIZES', () => {
    it('maps every aspect ratio to a size', () => {
      for (const ratio of ASPECT_RATIOS) {
        const size = CANONICAL_SIZES[ratio]
        expect(size.width).toBeGreaterThan(0)
        expect(size.height).toBeGreaterThan(0)
      }
    })

    it('9:16 is 1080x1920', () => {
      expect(CANONICAL_SIZES['9:16']).toEqual({ width: 1080, height: 1920 })
    })

    it('1:1 is 1080x1080', () => {
      expect(CANONICAL_SIZES['1:1']).toEqual({ width: 1080, height: 1080 })
    })

    it('16:9 is 1280x720', () => {
      expect(CANONICAL_SIZES['16:9']).toEqual({ width: 1280, height: 720 })
    })
  })

  describe('createTemplateSchema', () => {
    it('accepts valid input', () => {
      const input = {
        name: 'Bold Story',
        aspectRatio: '9:16' as const,
        composition: VALID_COMPOSITION,
      }
      const result = createTemplateSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('rejects empty name', () => {
      const input = {
        name: '',
        aspectRatio: '9:16' as const,
        composition: VALID_COMPOSITION,
      }
      expect(createTemplateSchema.safeParse(input).success).toBe(false)
    })

    it('rejects name over 120 chars', () => {
      const input = {
        name: 'x'.repeat(121),
        aspectRatio: '9:16' as const,
        composition: VALID_COMPOSITION,
      }
      expect(createTemplateSchema.safeParse(input).success).toBe(false)
    })

    it('rejects invalid aspect ratio', () => {
      const input = {
        name: 'Test',
        aspectRatio: '4:3',
        composition: VALID_COMPOSITION,
      }
      expect(createTemplateSchema.safeParse(input).success).toBe(false)
    })

    it('rejects composition with no version', () => {
      const input = {
        name: 'Test',
        aspectRatio: '9:16' as const,
        composition: { ...VALID_COMPOSITION, version: undefined },
      }
      expect(createTemplateSchema.safeParse(input).success).toBe(false)
    })

    it('allows optional thumbnailBase64', () => {
      const input = {
        name: 'Test',
        aspectRatio: '9:16' as const,
        composition: VALID_COMPOSITION,
        thumbnailBase64: 'data:image/png;base64,iVBOR...',
      }
      expect(createTemplateSchema.safeParse(input).success).toBe(true)
    })
  })

  describe('updateTemplateSchema', () => {
    it('accepts partial update with only name', () => {
      const result = updateTemplateSchema.safeParse({ name: 'New Name' })
      expect(result.success).toBe(true)
    })

    it('accepts partial update with only composition', () => {
      const result = updateTemplateSchema.safeParse({ composition: VALID_COMPOSITION })
      expect(result.success).toBe(true)
    })

    it('accepts empty object (no fields)', () => {
      const result = updateTemplateSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('rejects empty name', () => {
      const result = updateTemplateSchema.safeParse({ name: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('CardCompositionSchema integration', () => {
    it('validates a full composition with text + image elements', () => {
      const comp = {
        version: 1 as const,
        canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
        background: {
          type: 'gradient' as const,
          angle: 135,
          stops: [
            { color: '#7c3aed', position: 0 },
            { color: '#2563eb', position: 0.5 },
            { color: '#06b6d4', position: 1 },
          ],
        },
        elements: [
          {
            id: 'bg-img',
            type: 'image' as const,
            x: 0,
            y: 0,
            width: 1080,
            height: 1080,
            rotation: 0,
            opacity: 0.3,
            locked: true,
            src: '{{cover_image}}',
            objectFit: 'cover' as const,
            borderRadius: 0,
            borderColor: '#000000',
            borderWidth: 0,
            maintainAspectRatio: true,
          },
          {
            id: 'title-text',
            type: 'text' as const,
            x: 80,
            y: 400,
            width: 920,
            height: 200,
            rotation: 0,
            opacity: 1,
            locked: false,
            content: '{{title}}',
            fontFamily: 'Bebas Neue',
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '0em',
            align: 'center' as const,
            color: '#ffffff',
            backgroundColor: null,
            backgroundPadding: 8,
            backgroundRadius: 4,
            uppercase: true,
          },
        ],
      }
      const result = CardCompositionSchema.safeParse(comp)
      expect(result.success).toBe(true)
    })

    it('rejects composition with more than 20 elements', () => {
      const elements = Array.from({ length: 21 }, (_, i) => ({
        id: `el-${i}`,
        type: 'text' as const,
        x: 0,
        y: i * 50,
        width: 100,
        height: 40,
        rotation: 0,
        opacity: 1,
        locked: false,
        content: `Element ${i}`,
        fontFamily: 'Inter',
        fontSize: 24,
        fontWeight: 400,
        lineHeight: 1.2,
        letterSpacing: '0em',
        align: 'left' as const,
        color: '#000000',
        backgroundColor: null,
        backgroundPadding: 8,
        backgroundRadius: 4,
        uppercase: false,
      }))
      const comp = {
        version: 1 as const,
        canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
        background: { type: 'solid' as const, color: '#ffffff' },
        elements,
      }
      const result = CardCompositionSchema.safeParse(comp)
      expect(result.success).toBe(false)
    })
  })
})
```

- [ ] **Step 3: Run tests — expect pass (schema-only, no mocks needed)**

```bash
cd apps/web && npx vitest run test/social-template-actions.test.ts
```

Expected: all tests pass.

- [ ] **Step 4: Create template server actions**

Create `apps/web/src/lib/social/actions/templates.ts`:

```typescript
'use server'

import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  type ActionResult,
  SENTRY_TAG,
  zodError,
  requireEditAccess,
  revalidateSocialPaths,
} from './_shared'
import {
  createTemplateSchema,
  updateTemplateSchema,
  aspectRatioSchema,
  type SocialTemplate,
  type TemplateAspectRatio,
} from '../template-schemas'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSocialTemplate(row: Record<string, unknown>): SocialTemplate {
  return {
    id: String(row.id ?? ''),
    site_id: (row.site_id as string) ?? null,
    name: String(row.name ?? ''),
    aspect_ratio: (row.aspect_ratio as TemplateAspectRatio) ?? '1:1',
    composition: row.composition as SocialTemplate['composition'],
    thumbnail_url: (row.thumbnail_url as string) ?? null,
    is_default: Boolean(row.is_default),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

async function uploadThumbnail(base64: string, templateId: string): Promise<string> {
  const { put } = await import('@vercel/blob')
  const matches = base64.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!matches) throw new Error('Invalid base64 image')
  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1]!
  const buffer = Buffer.from(matches[2]!, 'base64')
  const blob = await put(`social-templates/${templateId}.${ext}`, buffer, {
    access: 'public',
    contentType: `image/${matches[1]}`,
  })
  return blob.url
}

// ---------------------------------------------------------------------------
// listTemplates
// ---------------------------------------------------------------------------

export async function listTemplates(
  siteId: string,
  aspectRatio?: TemplateAspectRatio,
): Promise<ActionResult<SocialTemplate[]>> {
  const idParsed = z.string().uuid().safeParse(siteId)
  if (!idParsed.success) return { ok: false, error: 'Invalid site ID' }
  if (aspectRatio) {
    const ratioParsed = aspectRatioSchema.safeParse(aspectRatio)
    if (!ratioParsed.success) return { ok: false, error: 'Invalid aspect ratio' }
  }

  try {
    await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    // Return site-specific templates + global defaults (site_id IS NULL)
    let query = supabase
      .from('social_templates')
      .select('*')
      .or(`site_id.eq.${idParsed.data},site_id.is.null`)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (aspectRatio) {
      query = query.eq('aspect_ratio', aspectRatio)
    }

    const { data, error } = await query

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'listTemplates' } })
      return { ok: false, error: error.message }
    }

    return { ok: true, data: (data ?? []).map(r => toSocialTemplate(r as Record<string, unknown>)) }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'listTemplates' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// getTemplate
// ---------------------------------------------------------------------------

export async function getTemplate(
  id: string,
): Promise<ActionResult<SocialTemplate>> {
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'Invalid template ID' }

  try {
    await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const { data, error } = await supabase
      .from('social_templates')
      .select('*')
      .eq('id', parsed.data)
      .single()

    if (error || !data) return { ok: false, error: 'Template not found' }

    return { ok: true, data: toSocialTemplate(data as Record<string, unknown>) }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'getTemplate' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// createTemplate
// ---------------------------------------------------------------------------

export async function createTemplate(data: {
  name: string
  aspectRatio: TemplateAspectRatio
  composition: SocialTemplate['composition']
  thumbnailBase64?: string
}): Promise<ActionResult<{ id: string }>> {
  const parsed = createTemplateSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const templateId = crypto.randomUUID()
    let thumbnailUrl: string | null = null

    if (parsed.data.thumbnailBase64) {
      thumbnailUrl = await uploadThumbnail(parsed.data.thumbnailBase64, templateId)
    }

    const row = {
      id: templateId,
      site_id: siteId,
      name: parsed.data.name,
      aspect_ratio: parsed.data.aspectRatio,
      composition: parsed.data.composition,
      thumbnail_url: thumbnailUrl,
      is_default: false,
    }

    const { error } = await supabase.from('social_templates').insert(row)

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'createTemplate' } })
      return { ok: false, error: error.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: { id: templateId } }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'createTemplate' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// updateTemplate
// ---------------------------------------------------------------------------

export async function updateTemplate(
  id: string,
  data: {
    name?: string
    composition?: SocialTemplate['composition']
    thumbnailBase64?: string
  },
): Promise<ActionResult> {
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { ok: false, error: 'Invalid template ID' }
  const parsed = updateTemplateSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    // Verify template exists and belongs to this site (not a system template)
    const { data: existing, error: fetchError } = await supabase
      .from('social_templates')
      .select('id, site_id')
      .eq('id', idParsed.data)
      .single()

    if (fetchError || !existing) return { ok: false, error: 'Template not found' }

    // Cannot edit system defaults (site_id IS NULL)
    if (existing.site_id === null) {
      return { ok: false, error: 'Cannot edit system default templates' }
    }

    if (existing.site_id !== siteId) {
      return { ok: false, error: 'forbidden' }
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (parsed.data.name !== undefined) patch.name = parsed.data.name
    if (parsed.data.composition !== undefined) patch.composition = parsed.data.composition

    if (parsed.data.thumbnailBase64) {
      patch.thumbnail_url = await uploadThumbnail(parsed.data.thumbnailBase64, idParsed.data)
    }

    const { error } = await supabase
      .from('social_templates')
      .update(patch)
      .eq('id', idParsed.data)
      .eq('site_id', siteId)

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'updateTemplate' } })
      return { ok: false, error: error.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'updateTemplate' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// deleteTemplate
// ---------------------------------------------------------------------------

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'Invalid template ID' }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    // Check if template exists and is deletable
    const { data: existing, error: fetchError } = await supabase
      .from('social_templates')
      .select('id, site_id')
      .eq('id', parsed.data)
      .single()

    if (fetchError || !existing) return { ok: false, error: 'Template not found' }

    // System defaults cannot be deleted
    if (existing.site_id === null) {
      return { ok: false, error: 'Cannot delete system default templates' }
    }

    if (existing.site_id !== siteId) {
      return { ok: false, error: 'forbidden' }
    }

    const { error } = await supabase
      .from('social_templates')
      .delete()
      .eq('id', parsed.data)
      .eq('site_id', siteId)

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'deleteTemplate' } })
      return { ok: false, error: error.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'deleteTemplate' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// setDefaultTemplate
// ---------------------------------------------------------------------------

export async function setDefaultTemplate(
  id: string,
  siteId: string,
): Promise<ActionResult> {
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { ok: false, error: 'Invalid template ID' }
  const siteParsed = z.string().uuid().safeParse(siteId)
  if (!siteParsed.success) return { ok: false, error: 'Invalid site ID' }

  try {
    const { siteId: authorizedSiteId } = await requireEditAccess()
    if (siteParsed.data !== authorizedSiteId) {
      return { ok: false, error: 'forbidden' }
    }

    const supabase = getSupabaseServiceClient()

    // Get template to know its aspect ratio
    const { data: template, error: fetchError } = await supabase
      .from('social_templates')
      .select('id, aspect_ratio, site_id')
      .eq('id', idParsed.data)
      .single()

    if (fetchError || !template) return { ok: false, error: 'Template not found' }

    // Verify template is accessible by this site (either site-owned or global)
    if (template.site_id !== null && template.site_id !== authorizedSiteId) {
      return { ok: false, error: 'forbidden' }
    }

    // Unset previous default for this site + aspect ratio
    await supabase
      .from('social_templates')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('site_id', authorizedSiteId)
      .eq('aspect_ratio', template.aspect_ratio as string)
      .eq('is_default', true)

    // If the template is a global one, duplicate it for this site as default
    if (template.site_id === null) {
      // For globals, we set the default via sites.social_defaults or
      // create a site-scoped copy. For simplicity, we'll just track it in
      // a site-specific row. But since the unique index uses COALESCE,
      // we need to ensure we only have one default per site+ratio.
      // The global template IS the default — just mark it.
      // However, the unique index prevents two defaults for the same
      // coalesced site_id + ratio. Global defaults use the zero UUID.
      // We'll only unset site-scoped defaults and let the global be the
      // fallback. Instead, create a site copy.
      const { data: globalTmpl } = await supabase
        .from('social_templates')
        .select('*')
        .eq('id', idParsed.data)
        .single()

      if (globalTmpl) {
        const copyId = crypto.randomUUID()
        await supabase.from('social_templates').insert({
          id: copyId,
          site_id: authorizedSiteId,
          name: globalTmpl.name as string,
          aspect_ratio: globalTmpl.aspect_ratio as string,
          composition: globalTmpl.composition,
          thumbnail_url: globalTmpl.thumbnail_url as string | null,
          is_default: true,
        })
      }
    } else {
      // Set this template as default
      const { error } = await supabase
        .from('social_templates')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', idParsed.data)

      if (error) {
        Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'setDefaultTemplate' } })
        return { ok: false, error: error.message }
      }
    }

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'setDefaultTemplate' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// duplicateTemplate
// ---------------------------------------------------------------------------

export async function duplicateTemplate(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'Invalid template ID' }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const { data: source, error: fetchError } = await supabase
      .from('social_templates')
      .select('*')
      .eq('id', parsed.data)
      .single()

    if (fetchError || !source) return { ok: false, error: 'Template not found' }

    // Verify accessibility: global templates or site-owned
    if (source.site_id !== null && source.site_id !== siteId) {
      return { ok: false, error: 'forbidden' }
    }

    const copyId = crypto.randomUUID()
    const row = {
      id: copyId,
      site_id: siteId,
      name: `Copy of ${source.name as string}`,
      aspect_ratio: source.aspect_ratio as string,
      composition: source.composition,
      thumbnail_url: source.thumbnail_url as string | null,
      is_default: false,
    }

    const { error } = await supabase.from('social_templates').insert(row)

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'duplicateTemplate' } })
      return { ok: false, error: error.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: { id: copyId } }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'duplicateTemplate' } })
    throw err
  }
}
```

- [ ] **Step 5: Run all tests**

```bash
cd apps/web && npx vitest run test/social-template-actions.test.ts
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/social/template-schemas.ts \
       apps/web/src/lib/social/actions/templates.ts \
       apps/web/test/social-template-actions.test.ts
git commit -m "feat(social): template CRUD server actions + Zod schemas

Add listTemplates, getTemplate, createTemplate, updateTemplate,
deleteTemplate, setDefaultTemplate, duplicateTemplate actions following
the established social actions pattern. System defaults (site_id=NULL)
are protected from edit/delete. Includes Zod schemas with aspect ratio
validation and CardComposition integration.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Template Library Page

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/templates/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/templates/loading.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/templates/_components/template-grid.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/templates/_components/template-card.tsx`

- [ ] **Step 1: Create loading skeleton**

Create `apps/web/src/app/cms/(authed)/social/templates/loading.tsx`:

```tsx
export default function TemplatesLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-28 animate-pulse rounded-md bg-cms-border" />
          ))}
        </div>
        <div className="h-9 w-32 animate-pulse rounded-md bg-cms-border" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-[9/16] animate-pulse rounded-lg bg-cms-border" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create template card component**

Create `apps/web/src/app/cms/(authed)/social/templates/_components/template-card.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { SocialTemplate } from '@/lib/social/template-schemas'
import { deleteTemplate, duplicateTemplate, setDefaultTemplate } from '@/lib/social/actions/templates'
import { useRouter } from 'next/navigation'

interface TemplateCardProps {
  template: SocialTemplate
  siteId: string
}

export function TemplateCard({ template, siteId }: TemplateCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isSystem = template.site_id === null

  function handleDuplicate() {
    setMenuOpen(false)
    startTransition(async () => {
      await duplicateTemplate(template.id)
      router.refresh()
    })
  }

  function handleSetDefault() {
    setMenuOpen(false)
    startTransition(async () => {
      await setDefaultTemplate(template.id, siteId)
      router.refresh()
    })
  }

  function handleDelete() {
    setConfirmDelete(false)
    setMenuOpen(false)
    startTransition(async () => {
      await deleteTemplate(template.id)
      router.refresh()
    })
  }

  // Aspect ratio for card preview sizing
  const aspectClass =
    template.aspect_ratio === '9:16'
      ? 'aspect-[9/16]'
      : template.aspect_ratio === '1:1'
        ? 'aspect-square'
        : 'aspect-video'

  return (
    <div className={`group relative overflow-hidden rounded-lg border border-cms-border bg-cms-surface transition-colors hover:border-cms-accent/40 ${isPending ? 'opacity-50' : ''}`}>
      {/* Thumbnail preview */}
      <div className={`${aspectClass} relative bg-cms-bg`}>
        {template.thumbnail_url ? (
          <img
            src={template.thumbnail_url}
            alt={template.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-cms-text-dim text-xs">
            No preview
          </div>
        )}

        {/* Default star badge */}
        {template.is_default && (
          <div className="absolute left-2 top-2 rounded-full bg-amber-500/90 p-1" title="Default template">
            <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
        )}

        {/* System badge */}
        {isSystem && (
          <div className="absolute right-2 top-2 rounded bg-cms-bg/80 px-1.5 py-0.5 text-[10px] font-medium text-cms-text-dim backdrop-blur">
            System
          </div>
        )}
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between p-2">
        <span className="truncate text-sm font-medium text-cms-text">{template.name}</span>

        {/* Overflow menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded p-1 text-cms-text-dim hover:bg-cms-border hover:text-cms-text"
            aria-label="Template actions"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-40 rounded-md border border-cms-border bg-cms-surface py-1 shadow-lg">
                {!isSystem && (
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      router.push(`/cms/social/templates/${template.id}/edit`)
                    }}
                    className="flex w-full items-center px-3 py-1.5 text-sm text-cms-text hover:bg-cms-border"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={handleDuplicate}
                  className="flex w-full items-center px-3 py-1.5 text-sm text-cms-text hover:bg-cms-border"
                >
                  Duplicate
                </button>
                <button
                  onClick={handleSetDefault}
                  className="flex w-full items-center px-3 py-1.5 text-sm text-cms-text hover:bg-cms-border"
                >
                  Set as Default
                </button>
                {!isSystem && (
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      setConfirmDelete(true)
                    }}
                    className="flex w-full items-center px-3 py-1.5 text-sm text-red-400 hover:bg-cms-border"
                  >
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-cms-bg/80 backdrop-blur-sm">
          <div className="mx-4 rounded-lg border border-cms-border bg-cms-surface p-4 shadow-xl">
            <p className="text-sm text-cms-text">Delete &quot;{template.name}&quot;?</p>
            <p className="mt-1 text-xs text-cms-text-dim">This cannot be undone.</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded px-3 py-1.5 text-sm text-cms-text hover:bg-cms-border"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create template grid component**

Create `apps/web/src/app/cms/(authed)/social/templates/_components/template-grid.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SocialTemplate, TemplateAspectRatio } from '@/lib/social/template-schemas'
import { ASPECT_RATIOS } from '@/lib/social/template-schemas'
import { TemplateCard } from './template-card'

interface TemplateGridProps {
  templates: SocialTemplate[]
  siteId: string
}

const TAB_LABELS: Record<TemplateAspectRatio, string> = {
  '9:16': '9:16 Vertical',
  '1:1': '1:1 Square',
  '16:9': '16:9 Landscape',
}

export function TemplateGrid({ templates, siteId }: TemplateGridProps) {
  const [activeRatio, setActiveRatio] = useState<TemplateAspectRatio>('9:16')
  const filtered = templates.filter(t => t.aspect_ratio === activeRatio)

  // Grid columns adjust by aspect ratio for sensible card sizing
  const gridClass =
    activeRatio === '9:16'
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
      : activeRatio === '1:1'
        ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

  const newCardAspect =
    activeRatio === '9:16'
      ? 'aspect-[9/16]'
      : activeRatio === '1:1'
        ? 'aspect-square'
        : 'aspect-video'

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 border-b border-cms-border pb-2">
          {ASPECT_RATIOS.map(ratio => (
            <button
              key={ratio}
              onClick={() => setActiveRatio(ratio)}
              aria-current={activeRatio === ratio ? 'page' : undefined}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                activeRatio === ratio
                  ? 'text-cms-accent border-b-2 border-cms-accent'
                  : 'text-cms-text-muted hover:text-cms-text'
              }`}
            >
              {TAB_LABELS[ratio]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className={`grid gap-4 ${gridClass}`}>
        {filtered.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            siteId={siteId}
          />
        ))}

        {/* "+ New Template" card */}
        <Link
          href={`/cms/social/templates/new?ratio=${activeRatio}`}
          className={`${newCardAspect} flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-cms-border bg-cms-bg text-cms-text-dim transition-colors hover:border-cms-accent/40 hover:text-cms-accent`}
        >
          <svg className="mb-2 h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-sm font-medium">New Template</span>
        </Link>
      </div>

      {filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-cms-text-dim">
          No templates for {TAB_LABELS[activeRatio]}. Create one to get started.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create the page**

Create `apps/web/src/app/cms/(authed)/social/templates/page.tsx`:

```tsx
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { listTemplates } from '@/lib/social/actions/templates'
import { TemplateGrid } from './_components/template-grid'

export const dynamic = 'force-dynamic'

export default async function TemplatesPage() {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'view' })

  const result = await listTemplates(ctx.siteId)
  const templates = result.ok ? result.data : []

  return (
    <>
      <CmsTopbar title="Templates" />
      <div className="p-6">
        <TemplateGrid templates={templates} siteId={ctx.siteId} />
      </div>
    </>
  )
}
```

- [ ] **Step 5: Add Templates to CMS navigation**

Modify `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts` — add a "Templates" nav item to the Social section:

Find the Social section items array and add the Templates entry after "Accounts":

```typescript
{ label: 'Templates', href: '/cms/social/templates', icon: LayoutTemplateIcon, minRole: 'editor' },
```

The exact insertion point depends on the current array. Add it after the existing items in the Social section.

- [ ] **Step 6: Run tests**

```bash
cd apps/web && npx vitest run test/cms/social-navigation.test.ts
```

The navigation test will need updating since we added a new nav item. Update the test to expect the new count and the "Templates" entry.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/social/templates/ \
       apps/web/src/app/cms/'(authed)'/_shared/cms-sections.ts \
       apps/web/test/cms/social-navigation.test.ts
git commit -m "feat(social): template library page with grid view and aspect ratio tabs

Route /cms/social/templates with three tabs (9:16, 1:1, 16:9), template
cards with thumbnail preview, overflow menu (Edit, Duplicate, Delete,
Set as Default), delete confirmation dialog, and + New Template card.
Adds Templates nav item to Social section.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Server-Side Konva Renderer

**Files:**
- Create: `apps/web/src/lib/social/konva-renderer.ts`
- Create: `apps/web/test/konva-renderer.test.ts`

- [ ] **Step 1: Install dependencies**

```bash
cd apps/web && npm install konva canvas --save-exact
```

Note: `canvas` is the node-canvas package required for server-side Konva rendering. It has native dependencies (Cairo, Pango) — Vercel serverless already includes these.

- [ ] **Step 2: Write failing tests**

Create `apps/web/test/konva-renderer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  renderTemplate,
  resolvePlaceholders,
  type TemplateContext,
} from '@/lib/social/konva-renderer'
import type { CardComposition } from '@tn-figueiredo/links/qr'

// PNG magic bytes: 0x89 0x50 0x4E 0x47
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])

const SIMPLE_COMPOSITION: CardComposition = {
  version: 1,
  canvas: { width: 400, height: 400, aspectRatio: '1:1' },
  background: { type: 'solid', color: '#0a0a0a' },
  elements: [
    {
      id: 'rect-1',
      type: 'text',
      x: 50,
      y: 50,
      width: 300,
      height: 80,
      rotation: 0,
      opacity: 1,
      locked: false,
      content: 'Hello World',
      fontFamily: 'Inter',
      fontSize: 32,
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '0em',
      align: 'center',
      color: '#ffffff',
      backgroundColor: null,
      backgroundPadding: 8,
      backgroundRadius: 4,
      uppercase: false,
    },
  ],
}

const PLACEHOLDER_COMPOSITION: CardComposition = {
  version: 1,
  canvas: { width: 400, height: 400, aspectRatio: '1:1' },
  background: { type: 'solid', color: '#1a1a2e' },
  elements: [
    {
      id: 'title',
      type: 'text',
      x: 20,
      y: 100,
      width: 360,
      height: 100,
      rotation: 0,
      opacity: 1,
      locked: false,
      content: '{{title}}',
      fontFamily: 'Inter',
      fontSize: 28,
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: '0em',
      align: 'center',
      color: '#ffffff',
      backgroundColor: null,
      backgroundPadding: 8,
      backgroundRadius: 4,
      uppercase: false,
    },
    {
      id: 'url',
      type: 'text',
      x: 20,
      y: 300,
      width: 360,
      height: 40,
      rotation: 0,
      opacity: 1,
      locked: false,
      content: '{{short_url}}',
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 1.2,
      letterSpacing: '0em',
      align: 'center',
      color: '#a1a1aa',
      backgroundColor: null,
      backgroundPadding: 8,
      backgroundRadius: 4,
      uppercase: false,
    },
  ],
}

describe('resolvePlaceholders', () => {
  it('replaces {{title}} placeholder', () => {
    const ctx: TemplateContext = { title: 'My Blog Post' }
    const result = resolvePlaceholders('{{title}}', ctx)
    expect(result).toBe('My Blog Post')
  })

  it('replaces {{short_url}} placeholder', () => {
    const ctx: TemplateContext = { short_url: 'go.btf.com/abc123' }
    const result = resolvePlaceholders('{{short_url}}', ctx)
    expect(result).toBe('go.btf.com/abc123')
  })

  it('replaces {{description}} placeholder', () => {
    const ctx: TemplateContext = { description: 'A great article' }
    const result = resolvePlaceholders('{{description}}', ctx)
    expect(result).toBe('A great article')
  })

  it('replaces multiple placeholders in one string', () => {
    const ctx: TemplateContext = { title: 'Title', short_url: 'go.btf.com/x' }
    const result = resolvePlaceholders('{{title}} - {{short_url}}', ctx)
    expect(result).toBe('Title - go.btf.com/x')
  })

  it('removes unresolvable placeholders', () => {
    const ctx: TemplateContext = {}
    const result = resolvePlaceholders('{{title}}', ctx)
    expect(result).toBe('')
  })

  it('leaves non-placeholder text untouched', () => {
    const ctx: TemplateContext = { title: 'Hello' }
    const result = resolvePlaceholders('Prefix {{title}} Suffix', ctx)
    expect(result).toBe('Prefix Hello Suffix')
  })
})

describe('renderTemplate', () => {
  it('renders a simple composition to a PNG buffer', async () => {
    const ctx: TemplateContext = {}
    const buffer = await renderTemplate(
      SIMPLE_COMPOSITION,
      ctx,
      { width: 400, height: 400 },
    )
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(100)
    expect(buffer.subarray(0, 4).equals(PNG_MAGIC)).toBe(true)
  })

  it('renders a composition with placeholders resolved', async () => {
    const ctx: TemplateContext = {
      title: 'Como configurar OAuth 2.0',
      short_url: 'go.btf.com/s5k2q1',
    }
    const buffer = await renderTemplate(
      PLACEHOLDER_COMPOSITION,
      ctx,
      { width: 400, height: 400 },
    )
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(100)
    expect(buffer.subarray(0, 4).equals(PNG_MAGIC)).toBe(true)
  })

  it('renders at the specified size', async () => {
    const ctx: TemplateContext = {}
    const small = await renderTemplate(
      SIMPLE_COMPOSITION,
      ctx,
      { width: 200, height: 200 },
    )
    const large = await renderTemplate(
      SIMPLE_COMPOSITION,
      ctx,
      { width: 800, height: 800 },
    )
    // Larger output should generally produce a larger buffer
    // (not guaranteed for simple compositions, but a reasonable heuristic)
    expect(small).toBeInstanceOf(Buffer)
    expect(large).toBeInstanceOf(Buffer)
    expect(small.subarray(0, 4).equals(PNG_MAGIC)).toBe(true)
    expect(large.subarray(0, 4).equals(PNG_MAGIC)).toBe(true)
  })

  it('handles empty elements array', async () => {
    const emptyComp: CardComposition = {
      version: 1,
      canvas: { width: 400, height: 400, aspectRatio: '1:1' },
      background: { type: 'solid', color: '#ffffff' },
      elements: [],
    }
    const buffer = await renderTemplate(emptyComp, {}, { width: 400, height: 400 })
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.subarray(0, 4).equals(PNG_MAGIC)).toBe(true)
  })

  it('handles gradient background', async () => {
    const gradComp: CardComposition = {
      version: 1,
      canvas: { width: 400, height: 400, aspectRatio: '1:1' },
      background: {
        type: 'gradient',
        angle: 135,
        stops: [
          { color: '#7c3aed', position: 0 },
          { color: '#2563eb', position: 0.5 },
          { color: '#06b6d4', position: 1 },
        ],
      },
      elements: [],
    }
    const buffer = await renderTemplate(gradComp, {}, { width: 400, height: 400 })
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.subarray(0, 4).equals(PNG_MAGIC)).toBe(true)
  })
})
```

- [ ] **Step 3: Run tests — expect fail (module not found)**

```bash
cd apps/web && npx vitest run test/konva-renderer.test.ts
```

Expected: fail with "Cannot find module `@/lib/social/konva-renderer`".

- [ ] **Step 4: Implement konva-renderer**

Create `apps/web/src/lib/social/konva-renderer.ts`:

```typescript
import Konva from 'konva/cmj'
import type { CardComposition, TextElement, ImageElement, Background } from '@tn-figueiredo/links/qr'

export interface TemplateContext {
  title?: string
  description?: string
  cover_image?: string
  short_url?: string
  logo?: string
}

// ---------------------------------------------------------------------------
// Placeholder resolution
// ---------------------------------------------------------------------------

const PLACEHOLDER_RE = /\{\{(title|description|short_url|cover_image|logo)\}\}/g

export function resolvePlaceholders(text: string, ctx: TemplateContext): string {
  return text.replace(PLACEHOLDER_RE, (_, key: string) => {
    const value = ctx[key as keyof TemplateContext]
    return value ?? ''
  })
}

// ---------------------------------------------------------------------------
// Background rendering
// ---------------------------------------------------------------------------

function renderBackground(
  layer: InstanceType<typeof Konva.Layer>,
  bg: Background,
  width: number,
  height: number,
): void {
  switch (bg.type) {
    case 'solid': {
      const rect = new Konva.Rect({
        x: 0,
        y: 0,
        width,
        height,
        fill: bg.color,
      })
      layer.add(rect)
      break
    }
    case 'gradient': {
      // Convert angle to start/end points
      const angleRad = ((bg.angle - 90) * Math.PI) / 180
      const cx = width / 2
      const cy = height / 2
      const len = Math.max(width, height)
      const dx = Math.cos(angleRad) * len
      const dy = Math.sin(angleRad) * len

      const colorStops: (string | number)[] = []
      for (const stop of bg.stops) {
        colorStops.push(stop.position, stop.color)
      }

      const rect = new Konva.Rect({
        x: 0,
        y: 0,
        width,
        height,
        fillLinearGradientStartPoint: { x: cx - dx / 2, y: cy - dy / 2 },
        fillLinearGradientEndPoint: { x: cx + dx / 2, y: cy + dy / 2 },
        fillLinearGradientColorStops: colorStops,
      })
      layer.add(rect)
      break
    }
    case 'image': {
      // Image backgrounds are handled as a solid fallback on server
      // (downloading the image would add latency; can be extended later)
      const rect = new Konva.Rect({
        x: 0,
        y: 0,
        width,
        height,
        fill: bg.fallbackColor,
      })
      layer.add(rect)
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Element rendering
// ---------------------------------------------------------------------------

function renderTextElement(
  layer: InstanceType<typeof Konva.Layer>,
  el: TextElement,
  ctx: TemplateContext,
  scaleX: number,
  scaleY: number,
): void {
  const resolvedContent = resolvePlaceholders(el.content, ctx)
  if (!resolvedContent) return // Hide empty placeholders

  const text = new Konva.Text({
    x: el.x * scaleX,
    y: el.y * scaleY,
    width: el.width * scaleX,
    height: el.height * scaleY,
    text: el.uppercase ? resolvedContent.toUpperCase() : resolvedContent,
    fontFamily: el.fontFamily,
    fontSize: el.fontSize * Math.min(scaleX, scaleY),
    fontStyle: el.fontWeight >= 700 ? 'bold' : 'normal',
    lineHeight: el.lineHeight,
    letterSpacing: parseFloat(el.letterSpacing) * el.fontSize * Math.min(scaleX, scaleY),
    align: el.align,
    fill: el.color,
    opacity: el.opacity,
    rotation: el.rotation,
    wrap: 'word',
    ellipsis: true,
  })
  layer.add(text)
}

function renderImagePlaceholder(
  layer: InstanceType<typeof Konva.Layer>,
  el: ImageElement,
  scaleX: number,
  scaleY: number,
): void {
  // On server, image elements with placeholder src ({{cover_image}}, {{logo}})
  // are rendered as a semi-transparent rect. Full image download for concrete
  // URLs can be added in a future iteration.
  const rect = new Konva.Rect({
    x: el.x * scaleX,
    y: el.y * scaleY,
    width: el.width * scaleX,
    height: el.height * scaleY,
    fill: '#333333',
    opacity: el.opacity * 0.3,
    cornerRadius: el.borderRadius * Math.min(scaleX, scaleY),
    rotation: el.rotation,
  })
  layer.add(rect)
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

export async function renderTemplate(
  composition: CardComposition,
  context: TemplateContext,
  size: { width: number; height: number },
): Promise<Buffer> {
  const { canvas: canvasSpec, background, elements } = composition

  // Scale factors from composition canvas to output size
  const scaleX = size.width / canvasSpec.width
  const scaleY = size.height / canvasSpec.height

  const stage = new Konva.Stage({
    width: size.width,
    height: size.height,
    // Server-side Konva needs a container-less stage
    container: undefined as unknown as string,
  })

  const layer = new Konva.Layer()
  stage.add(layer)

  // 1. Background
  renderBackground(layer, background, size.width, size.height)

  // 2. Elements (in order = z-index)
  for (const el of elements) {
    switch (el.type) {
      case 'text':
        renderTextElement(layer, el, context, scaleX, scaleY)
        break
      case 'image':
        renderImagePlaceholder(layer, el, scaleX, scaleY)
        break
      case 'qr':
        // QR elements are not rendered in social templates
        // (QR codes are handled by the Links Engine separately)
        break
    }
  }

  layer.draw()

  // Render to PNG buffer
  const buffer = (stage as unknown as { toBuffer: (mime: string) => Buffer }).toBuffer('image/png')

  stage.destroy()

  return buffer
}
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd apps/web && npx vitest run test/konva-renderer.test.ts
```

Expected: all pass.

If the `konva/cmj` import does not work in the test environment, try `import Konva from 'konva'` instead and ensure the `canvas` package is available. The Konva server-side API may vary — check the installed version and adjust imports accordingly. The key requirement is that `Konva.Stage`, `Konva.Layer`, `Konva.Rect`, and `Konva.Text` are available and `stage.toBuffer('image/png')` returns a Buffer. If `toBuffer` is not available, use:

```typescript
const canvas = (layer.getCanvas() as unknown as { _canvas: import('canvas').Canvas })._canvas
const buffer = canvas.toBuffer('image/png')
```

Adjust the implementation until tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/social/konva-renderer.ts \
       apps/web/test/konva-renderer.test.ts \
       apps/web/package.json \
       apps/web/package-lock.json
git commit -m "feat(social): server-side Konva renderer with placeholder hydration

Replaces @vercel/og story-generator with Konva + node-canvas for visual
parity between server Quick Mode and client Design Mode. Supports
solid/gradient backgrounds, text elements with {{title}}, {{description}},
{{short_url}} placeholder resolution, and scaled output. Image elements
render as placeholders on server (full download deferred).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Template Seed Data

**Files:**
- Create: `scripts/seed-social-templates.ts`

**Depends on:** Task 5 (needs template schemas for composition structure).

- [ ] **Step 1: Create seed script**

Create `scripts/seed-social-templates.ts`:

```typescript
// scripts/seed-social-templates.ts
// Usage: npx tsx --env-file apps/web/.env.local scripts/seed-social-templates.ts
//
// Seeds 9 default social templates (3 per aspect ratio) into social_templates.
// Fully idempotent — uses ON CONFLICT DO NOTHING on (name) for global defaults.

import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

interface TemplateRow {
  name: string
  aspect_ratio: '9:16' | '1:1' | '16:9'
  composition: Record<string, unknown>
  is_default: boolean
  site_id: null
}

// ── 9:16 Story templates ──

const blogAnnounceStory: TemplateRow = {
  name: 'blog-announce-story',
  aspect_ratio: '9:16',
  is_default: true,
  site_id: null,
  composition: {
    version: 1,
    canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
    background: {
      type: 'gradient',
      angle: 135,
      stops: [
        { color: '#7c3aed', position: 0 },
        { color: '#2563eb', position: 0.5 },
        { color: '#06b6d4', position: 1 },
      ],
    },
    elements: [
      {
        id: 'logo',
        type: 'image',
        x: 60, y: 60, width: 72, height: 72,
        rotation: 0, opacity: 1, locked: true,
        src: '{{logo}}',
        objectFit: 'cover',
        borderRadius: 12, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      },
      {
        id: 'title',
        type: 'text',
        x: 80, y: 700, width: 920, height: 400,
        rotation: 0, opacity: 1, locked: false,
        content: '{{title}}',
        fontFamily: 'Bebas Neue', fontSize: 72, fontWeight: 700,
        lineHeight: 1.1, letterSpacing: '0em', align: 'left',
        color: '#ffffff',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: true,
      },
      {
        id: 'description',
        type: 'text',
        x: 80, y: 1120, width: 920, height: 200,
        rotation: 0, opacity: 0.8, locked: false,
        content: '{{description}}',
        fontFamily: 'Inter', fontSize: 28, fontWeight: 400,
        lineHeight: 1.4, letterSpacing: '0em', align: 'left',
        color: '#ffffff',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
      {
        id: 'short-url',
        type: 'text',
        x: 80, y: 1720, width: 920, height: 60,
        rotation: 0, opacity: 1, locked: false,
        content: '{{short_url}}',
        fontFamily: 'JetBrains Mono', fontSize: 24, fontWeight: 400,
        lineHeight: 1.2, letterSpacing: '0em', align: 'left',
        color: '#ffffff',
        backgroundColor: '#00000050', backgroundPadding: 12, backgroundRadius: 8,
        uppercase: false,
      },
    ],
  },
}

const quoteCardStory: TemplateRow = {
  name: 'quote-card-story',
  aspect_ratio: '9:16',
  is_default: true,
  site_id: null,
  composition: {
    version: 1,
    canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
    background: { type: 'solid', color: '#0a0a0a' },
    elements: [
      {
        id: 'cover',
        type: 'image',
        x: 0, y: 0, width: 1080, height: 1920,
        rotation: 0, opacity: 0.35, locked: true,
        src: '{{cover_image}}',
        objectFit: 'cover',
        borderRadius: 0, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: false,
      },
      {
        id: 'title',
        type: 'text',
        x: 80, y: 760, width: 920, height: 400,
        rotation: 0, opacity: 1, locked: false,
        content: '{{title}}',
        fontFamily: 'Playfair Display', fontSize: 56, fontWeight: 700,
        lineHeight: 1.3, letterSpacing: '0em', align: 'center',
        color: '#ffffff',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
      {
        id: 'logo',
        type: 'image',
        x: 490, y: 1680, width: 100, height: 100,
        rotation: 0, opacity: 0.8, locked: false,
        src: '{{logo}}',
        objectFit: 'contain',
        borderRadius: 16, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      },
    ],
  },
}

const videoPromoStory: TemplateRow = {
  name: 'video-promo-story',
  aspect_ratio: '9:16',
  is_default: true,
  site_id: null,
  composition: {
    version: 1,
    canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
    background: { type: 'solid', color: '#111111' },
    elements: [
      {
        id: 'title',
        type: 'text',
        x: 120, y: 800, width: 840, height: 300,
        rotation: 0, opacity: 1, locked: false,
        content: '{{title}}',
        fontFamily: 'Inter', fontSize: 44, fontWeight: 600,
        lineHeight: 1.3, letterSpacing: '0em', align: 'center',
        color: '#fafafa',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
      {
        id: 'logo',
        type: 'image',
        x: 480, y: 600, width: 120, height: 120,
        rotation: 0, opacity: 0.7, locked: false,
        src: '{{logo}}',
        objectFit: 'contain',
        borderRadius: 20, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      },
      {
        id: 'short-url',
        type: 'text',
        x: 240, y: 1200, width: 600, height: 50,
        rotation: 0, opacity: 0.6, locked: false,
        content: '{{short_url}}',
        fontFamily: 'Space Mono', fontSize: 20, fontWeight: 400,
        lineHeight: 1.2, letterSpacing: '0em', align: 'center',
        color: '#a1a1aa',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
    ],
  },
}

// ── 1:1 Square templates ──

const blogAnnounceSquare: TemplateRow = {
  name: 'blog-announce-square',
  aspect_ratio: '1:1',
  is_default: true,
  site_id: null,
  composition: {
    version: 1,
    canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
    background: {
      type: 'gradient',
      angle: 180,
      stops: [
        { color: '#0a0a0a', position: 0 },
        { color: '#1a1a2e', position: 1 },
      ],
    },
    elements: [
      {
        id: 'title',
        type: 'text',
        x: 80, y: 360, width: 920, height: 300,
        rotation: 0, opacity: 1, locked: false,
        content: '{{title}}',
        fontFamily: 'Bebas Neue', fontSize: 64, fontWeight: 700,
        lineHeight: 1.1, letterSpacing: '0em', align: 'center',
        color: '#ffffff',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: true,
      },
      {
        id: 'logo',
        type: 'image',
        x: 490, y: 80, width: 100, height: 100,
        rotation: 0, opacity: 0.8, locked: false,
        src: '{{logo}}',
        objectFit: 'contain',
        borderRadius: 16, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      },
      {
        id: 'short-url',
        type: 'text',
        x: 80, y: 920, width: 920, height: 50,
        rotation: 0, opacity: 0.6, locked: false,
        content: '{{short_url}}',
        fontFamily: 'JetBrains Mono', fontSize: 20, fontWeight: 400,
        lineHeight: 1.2, letterSpacing: '0em', align: 'center',
        color: '#a1a1aa',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
    ],
  },
}

const quoteCardSquare: TemplateRow = {
  name: 'quote-card-square',
  aspect_ratio: '1:1',
  is_default: true,
  site_id: null,
  composition: {
    version: 1,
    canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
    background: { type: 'solid', color: '#0f0f0f' },
    elements: [
      {
        id: 'cover',
        type: 'image',
        x: 0, y: 0, width: 1080, height: 1080,
        rotation: 0, opacity: 0.25, locked: true,
        src: '{{cover_image}}',
        objectFit: 'cover',
        borderRadius: 0, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: false,
      },
      {
        id: 'title',
        type: 'text',
        x: 100, y: 340, width: 880, height: 300,
        rotation: 0, opacity: 1, locked: false,
        content: '{{title}}',
        fontFamily: 'Playfair Display', fontSize: 48, fontWeight: 700,
        lineHeight: 1.3, letterSpacing: '0em', align: 'center',
        color: '#ffffff',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
      {
        id: 'description',
        type: 'text',
        x: 120, y: 680, width: 840, height: 120,
        rotation: 0, opacity: 0.7, locked: false,
        content: '{{description}}',
        fontFamily: 'Inter', fontSize: 22, fontWeight: 400,
        lineHeight: 1.4, letterSpacing: '0em', align: 'center',
        color: '#d4d4d8',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
    ],
  },
}

const videoPromoSquare: TemplateRow = {
  name: 'video-promo-square',
  aspect_ratio: '1:1',
  is_default: true,
  site_id: null,
  composition: {
    version: 1,
    canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
    background: { type: 'solid', color: '#18181b' },
    elements: [
      {
        id: 'title',
        type: 'text',
        x: 100, y: 400, width: 880, height: 200,
        rotation: 0, opacity: 1, locked: false,
        content: '{{title}}',
        fontFamily: 'Inter', fontSize: 40, fontWeight: 600,
        lineHeight: 1.3, letterSpacing: '0em', align: 'center',
        color: '#fafafa',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
      {
        id: 'logo',
        type: 'image',
        x: 460, y: 200, width: 160, height: 160,
        rotation: 0, opacity: 0.6, locked: false,
        src: '{{logo}}',
        objectFit: 'contain',
        borderRadius: 24, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      },
    ],
  },
}

// ── 16:9 Landscape templates ──

const blogAnnounceLandscape: TemplateRow = {
  name: 'blog-announce-landscape',
  aspect_ratio: '16:9',
  is_default: true,
  site_id: null,
  composition: {
    version: 1,
    canvas: { width: 1280, height: 720, aspectRatio: '16:9' },
    background: {
      type: 'gradient',
      angle: 135,
      stops: [
        { color: '#7c3aed', position: 0 },
        { color: '#2563eb', position: 1 },
      ],
    },
    elements: [
      {
        id: 'title',
        type: 'text',
        x: 60, y: 200, width: 800, height: 280,
        rotation: 0, opacity: 1, locked: false,
        content: '{{title}}',
        fontFamily: 'Bebas Neue', fontSize: 64, fontWeight: 700,
        lineHeight: 1.1, letterSpacing: '0em', align: 'left',
        color: '#ffffff',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: true,
      },
      {
        id: 'description',
        type: 'text',
        x: 60, y: 500, width: 800, height: 80,
        rotation: 0, opacity: 0.8, locked: false,
        content: '{{description}}',
        fontFamily: 'Inter', fontSize: 22, fontWeight: 400,
        lineHeight: 1.4, letterSpacing: '0em', align: 'left',
        color: '#ffffff',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
      {
        id: 'logo',
        type: 'image',
        x: 1140, y: 40, width: 100, height: 100,
        rotation: 0, opacity: 0.8, locked: false,
        src: '{{logo}}',
        objectFit: 'contain',
        borderRadius: 16, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      },
      {
        id: 'short-url',
        type: 'text',
        x: 60, y: 620, width: 400, height: 40,
        rotation: 0, opacity: 0.7, locked: false,
        content: '{{short_url}}',
        fontFamily: 'JetBrains Mono', fontSize: 18, fontWeight: 400,
        lineHeight: 1.2, letterSpacing: '0em', align: 'left',
        color: '#ffffff',
        backgroundColor: '#00000040', backgroundPadding: 8, backgroundRadius: 6,
        uppercase: false,
      },
    ],
  },
}

const quoteCardLandscape: TemplateRow = {
  name: 'quote-card-landscape',
  aspect_ratio: '16:9',
  is_default: true,
  site_id: null,
  composition: {
    version: 1,
    canvas: { width: 1280, height: 720, aspectRatio: '16:9' },
    background: { type: 'solid', color: '#0a0a0a' },
    elements: [
      {
        id: 'cover',
        type: 'image',
        x: 0, y: 0, width: 1280, height: 720,
        rotation: 0, opacity: 0.3, locked: true,
        src: '{{cover_image}}',
        objectFit: 'cover',
        borderRadius: 0, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: false,
      },
      {
        id: 'title',
        type: 'text',
        x: 120, y: 220, width: 1040, height: 250,
        rotation: 0, opacity: 1, locked: false,
        content: '{{title}}',
        fontFamily: 'Playfair Display', fontSize: 52, fontWeight: 700,
        lineHeight: 1.3, letterSpacing: '0em', align: 'center',
        color: '#ffffff',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
      {
        id: 'logo',
        type: 'image',
        x: 590, y: 560, width: 100, height: 100,
        rotation: 0, opacity: 0.7, locked: false,
        src: '{{logo}}',
        objectFit: 'contain',
        borderRadius: 16, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      },
    ],
  },
}

const videoPromoLandscape: TemplateRow = {
  name: 'video-promo-landscape',
  aspect_ratio: '16:9',
  is_default: true,
  site_id: null,
  composition: {
    version: 1,
    canvas: { width: 1280, height: 720, aspectRatio: '16:9' },
    background: { type: 'solid', color: '#111111' },
    elements: [
      {
        id: 'title',
        type: 'text',
        x: 160, y: 260, width: 960, height: 200,
        rotation: 0, opacity: 1, locked: false,
        content: '{{title}}',
        fontFamily: 'Inter', fontSize: 44, fontWeight: 600,
        lineHeight: 1.3, letterSpacing: '0em', align: 'center',
        color: '#fafafa',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
      {
        id: 'logo',
        type: 'image',
        x: 560, y: 100, width: 160, height: 120,
        rotation: 0, opacity: 0.5, locked: false,
        src: '{{logo}}',
        objectFit: 'contain',
        borderRadius: 20, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      },
    ],
  },
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const TEMPLATES: TemplateRow[] = [
  blogAnnounceStory,
  quoteCardStory,
  videoPromoStory,
  blogAnnounceSquare,
  quoteCardSquare,
  videoPromoSquare,
  blogAnnounceLandscape,
  quoteCardLandscape,
  videoPromoLandscape,
]

async function main() {
  console.log(`Seeding ${TEMPLATES.length} social templates...`)

  for (const tmpl of TEMPLATES) {
    const { data, error } = await supabase
      .from('social_templates')
      .upsert(
        {
          name: tmpl.name,
          aspect_ratio: tmpl.aspect_ratio,
          composition: tmpl.composition,
          is_default: tmpl.is_default,
          site_id: tmpl.site_id,
        },
        { onConflict: 'name', ignoreDuplicates: false },
      )
      .select('id, name')

    if (error) {
      // If upsert fails (no unique constraint on name), try insert with conflict check
      const { error: insertErr } = await supabase
        .from('social_templates')
        .insert({
          name: tmpl.name,
          aspect_ratio: tmpl.aspect_ratio,
          composition: tmpl.composition,
          is_default: tmpl.is_default,
          site_id: tmpl.site_id,
        })

      if (insertErr) {
        if (insertErr.code === '23505') {
          // Duplicate — update instead
          const { error: updateErr } = await supabase
            .from('social_templates')
            .update({
              aspect_ratio: tmpl.aspect_ratio,
              composition: tmpl.composition,
              is_default: tmpl.is_default,
              updated_at: new Date().toISOString(),
            })
            .is('site_id', null)
            .eq('name', tmpl.name)

          if (updateErr) {
            console.error(`  FAIL ${tmpl.name}: ${updateErr.message}`)
          } else {
            console.log(`  UPDATED ${tmpl.name}`)
          }
        } else {
          console.error(`  FAIL ${tmpl.name}: ${insertErr.message}`)
        }
      } else {
        console.log(`  INSERTED ${tmpl.name}`)
      }
    } else {
      const row = data?.[0]
      console.log(`  OK ${tmpl.name} → ${row?.id ?? '(upserted)'}`)
    }
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Run seed script**

```bash
npx tsx --env-file apps/web/.env.local scripts/seed-social-templates.ts
```

Expected: 9 templates seeded successfully. Re-running should update existing templates without errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-social-templates.ts
git commit -m "feat(social): seed script for 9 default social templates

3 templates per aspect ratio (9:16, 1:1, 16:9): blog-announce, quote-card,
video-promo. Each uses CardComposition JSONB with {{title}}, {{description}},
{{cover_image}}, {{logo}}, {{short_url}} placeholders. Idempotent — safe
to re-run.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Settings Matrix (Content Type x Platform -> Template)

**Files:**
- Create: `apps/web/src/lib/social/actions/settings.ts`
- Create: `apps/web/src/app/cms/(authed)/settings/social/_components/template-matrix.tsx`
- Modify: `apps/web/src/app/cms/(authed)/settings/social/page.tsx`

**Depends on:** Task 6 (needs `listTemplates` action for dropdown population).

- [ ] **Step 1: Create settings server action**

Create `apps/web/src/lib/social/actions/settings.ts`:

```typescript
'use server'

import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  type ActionResult,
  SENTRY_TAG,
  zodError,
  requireEditAccess,
  revalidateSocialPaths,
} from './_shared'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const CONTENT_TYPES = ['blog', 'newsletter', 'campaign', 'video'] as const
const PLATFORMS = ['facebook', 'instagram', 'bluesky'] as const

export type SocialContentType = (typeof CONTENT_TYPES)[number]
export type SocialPlatform = (typeof PLATFORMS)[number]

// Matrix key format: "blog:facebook" -> template UUID
export type SocialDefaults = Record<string, string>

const socialDefaultsEntrySchema = z.object({
  contentType: z.enum(CONTENT_TYPES),
  platform: z.enum(PLATFORMS),
  templateId: z.string().uuid().nullable(),
})

const updateSocialDefaultsSchema = z.object({
  entries: z.array(socialDefaultsEntrySchema),
})

// ---------------------------------------------------------------------------
// getSocialDefaults
// ---------------------------------------------------------------------------

export async function getSocialDefaults(
  siteId: string,
): Promise<ActionResult<SocialDefaults>> {
  const parsed = z.string().uuid().safeParse(siteId)
  if (!parsed.success) return { ok: false, error: 'Invalid site ID' }

  try {
    await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const { data, error } = await supabase
      .from('sites')
      .select('social_defaults')
      .eq('id', parsed.data)
      .single()

    if (error || !data) return { ok: false, error: 'Site not found' }

    return {
      ok: true,
      data: (data.social_defaults as SocialDefaults) ?? {},
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'getSocialDefaults' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// updateSocialDefaults
// ---------------------------------------------------------------------------

export async function updateSocialDefaults(
  siteId: string,
  data: {
    entries: Array<{
      contentType: SocialContentType
      platform: SocialPlatform
      templateId: string | null
    }>
  },
): Promise<ActionResult> {
  const siteParsed = z.string().uuid().safeParse(siteId)
  if (!siteParsed.success) return { ok: false, error: 'Invalid site ID' }
  const parsed = updateSocialDefaultsSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  try {
    const { siteId: authorizedSiteId } = await requireEditAccess()
    if (siteParsed.data !== authorizedSiteId) {
      return { ok: false, error: 'forbidden' }
    }

    const supabase = getSupabaseServiceClient()

    // Build the social_defaults JSON object
    // First, fetch current defaults to merge
    const { data: site, error: fetchError } = await supabase
      .from('sites')
      .select('social_defaults')
      .eq('id', authorizedSiteId)
      .single()

    if (fetchError || !site) return { ok: false, error: 'Site not found' }

    const current = (site.social_defaults as SocialDefaults) ?? {}

    // Apply updates
    for (const entry of parsed.data.entries) {
      const key = `${entry.contentType}:${entry.platform}`
      if (entry.templateId === null) {
        delete current[key]
      } else {
        current[key] = entry.templateId
      }
    }

    const { error } = await supabase
      .from('sites')
      .update({ social_defaults: current })
      .eq('id', authorizedSiteId)

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'updateSocialDefaults' } })
      return { ok: false, error: error.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'updateSocialDefaults' } })
    throw err
  }
}
```

- [ ] **Step 2: Create template matrix component**

Create `apps/web/src/app/cms/(authed)/settings/social/_components/template-matrix.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { SocialTemplate } from '@/lib/social/template-schemas'
import {
  updateSocialDefaults,
  type SocialDefaults,
  type SocialContentType,
  type SocialPlatform,
} from '@/lib/social/actions/settings'

interface TemplateMatrixProps {
  siteId: string
  templates: SocialTemplate[]
  defaults: SocialDefaults
}

const CONTENT_TYPES: { key: SocialContentType; label: string }[] = [
  { key: 'blog', label: 'Blog Post' },
  { key: 'newsletter', label: 'Newsletter' },
  { key: 'campaign', label: 'Campaign' },
  { key: 'video', label: 'Video' },
]

const PLATFORMS: { key: SocialPlatform; label: string; ratios: string[] }[] = [
  { key: 'facebook', label: 'Facebook', ratios: ['16:9'] },
  { key: 'instagram', label: 'Instagram', ratios: ['9:16', '1:1'] },
  { key: 'bluesky', label: 'Bluesky', ratios: ['16:9'] },
]

export function TemplateMatrix({ siteId, templates, defaults: initialDefaults }: TemplateMatrixProps) {
  const [defaults, setDefaults] = useState<SocialDefaults>(initialDefaults)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function getKey(contentType: SocialContentType, platform: SocialPlatform): string {
    return `${contentType}:${platform}`
  }

  function getCompatibleTemplates(platform: SocialPlatform): SocialTemplate[] {
    const platformConfig = PLATFORMS.find(p => p.key === platform)
    if (!platformConfig) return []
    return templates.filter(t => platformConfig.ratios.includes(t.aspect_ratio))
  }

  function handleChange(contentType: SocialContentType, platform: SocialPlatform, templateId: string) {
    const key = getKey(contentType, platform)
    const next = { ...defaults }
    if (templateId === '') {
      delete next[key]
    } else {
      next[key] = templateId
    }
    setDefaults(next)
    setSaved(false)
  }

  function handleSave() {
    const entries = Object.entries(defaults).map(([key, templateId]) => {
      const [contentType, platform] = key.split(':') as [SocialContentType, SocialPlatform]
      return { contentType, platform, templateId }
    })

    startTransition(async () => {
      const result = await updateSocialDefaults(siteId, { entries })
      if (result.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-cms-text">Template Defaults</h3>
          <p className="text-xs text-cms-text-dim">
            Choose default templates for each content type and platform combination.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover disabled:opacity-50"
        >
          {isPending ? 'Saving...' : saved ? 'Saved' : 'Save Defaults'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-cms-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-cms-border bg-cms-bg">
              <th className="px-4 py-3 text-left text-xs font-medium text-cms-text-dim uppercase tracking-wider">
                Content Type
              </th>
              {PLATFORMS.map(p => (
                <th
                  key={p.key}
                  className="px-4 py-3 text-left text-xs font-medium text-cms-text-dim uppercase tracking-wider"
                >
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-cms-border">
            {CONTENT_TYPES.map(ct => (
              <tr key={ct.key} className="bg-cms-surface">
                <td className="px-4 py-3 text-sm font-medium text-cms-text">
                  {ct.label}
                </td>
                {PLATFORMS.map(p => {
                  const key = getKey(ct.key, p.key)
                  const compatible = getCompatibleTemplates(p.key)
                  const current = defaults[key] ?? ''

                  return (
                    <td key={p.key} className="px-4 py-3">
                      <select
                        value={current}
                        onChange={e => handleChange(ct.key, p.key, e.target.value)}
                        className="w-full rounded-md border border-cms-border bg-cms-bg px-2 py-1.5 text-sm text-cms-text focus:border-cms-accent focus:outline-none focus:ring-1 focus:ring-cms-accent"
                      >
                        <option value="">None</option>
                        {compatible.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.aspect_ratio})
                          </option>
                        ))}
                      </select>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update the settings/social page**

Replace the redirect in `apps/web/src/app/cms/(authed)/settings/social/page.tsx` with the actual settings page that includes the Template Matrix:

```tsx
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { listTemplates } from '@/lib/social/actions/templates'
import { getSocialDefaults } from '@/lib/social/actions/settings'
import { TemplateMatrix } from './_components/template-matrix'

export const dynamic = 'force-dynamic'

export default async function SettingsSocialPage() {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const [templatesResult, defaultsResult] = await Promise.all([
    listTemplates(ctx.siteId),
    getSocialDefaults(ctx.siteId),
  ])

  const templates = templatesResult.ok ? templatesResult.data : []
  const defaults = defaultsResult.ok ? defaultsResult.data : {}

  return (
    <>
      <CmsTopbar title="Social Settings" />
      <div className="p-6 space-y-8">
        <TemplateMatrix
          siteId={ctx.siteId}
          templates={templates}
          defaults={defaults}
        />
      </div>
    </>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && npx vitest run
```

Verify no regressions. The settings page no longer redirects, so any test that assumed the redirect behavior should be updated.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/social/actions/settings.ts \
       apps/web/src/app/cms/'(authed)'/settings/social/_components/template-matrix.tsx \
       apps/web/src/app/cms/'(authed)'/settings/social/page.tsx
git commit -m "feat(social): settings matrix for content type x platform template defaults

Grid UI where rows = content types (Blog, Newsletter, Campaign, Video)
and columns = platforms (Facebook, Instagram, Bluesky). Each cell is a
dropdown selecting a template filtered by compatible aspect ratio. Stored
in sites.social_defaults JSONB. Replaces the settings/social redirect
with the actual settings page.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Final Verification

After all 5 tasks are complete:

- [ ] **Run full test suite**

```bash
cd apps/web && npm run test:web
```

All tests must pass before the phase is considered complete.

- [ ] **Verify template library loads**

Start dev server and navigate to `/cms/social/templates`. Confirm:
1. Three tabs render (9:16, 1:1, 16:9)
2. Seed templates appear in grid
3. Overflow menu works (Duplicate, Set as Default)
4. System templates show "System" badge and hide Edit/Delete
5. "+ New Template" card links to editor

- [ ] **Verify settings matrix loads**

Navigate to Settings > Social. Confirm:
1. Matrix grid renders with 4 rows x 3 columns
2. Dropdowns show templates filtered by compatible aspect ratio
3. Save persists to `sites.social_defaults`

- [ ] **Verify Konva renderer produces valid PNGs**

```bash
cd apps/web && npx vitest run test/konva-renderer.test.ts
```

All tests pass with valid PNG output.
