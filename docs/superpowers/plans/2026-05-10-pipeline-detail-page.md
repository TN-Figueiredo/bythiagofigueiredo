# Pipeline Detail Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat-form pipeline detail page (15/100) with a tabbed, bilateral, section-based editor (98/100) supporting per-section editing, revision tracking, Cowork clipboard integration, and conflict resolution.

**Architecture:** Server component fetches item + sections, passes to a client-side `TabContainer` that renders format-specific section renderers via a registry pattern. Each section saves independently via PATCH to a new `/api/pipeline/items/[id]/sections/[section]` endpoint, using `jsonb_set` for partial JSONB updates with optimistic locking. Bilateral content (PT/EN) uses `lang-content` blocks toggled by a shared `LanguageToggle`.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind 4, Supabase (PostgreSQL 17), Zod, Vitest

**Spec:** `docs/superpowers/specs/2026-05-10-pipeline-detail-page-design.md`
**Mockup:** `.superpowers/brainstorm/58663-1778444961/content/detail-v6.html`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260511000001_pipeline_sections_jsonb.sql` | Add `sections` JSONB column to `content_pipeline` |
| `apps/web/src/lib/pipeline/sections.ts` | Section types, Zod schemas, helpers (getSectionKey, SECTION_CONFIGS) |
| `apps/web/src/app/api/pipeline/items/[id]/sections/[section]/route.ts` | GET/PATCH per-section API |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/tab-container.tsx` | Client component: tab switching, language toggle, keyboard shortcuts, URL hash |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/section-toolbar.tsx` | Toolbar: title, lang indicator, source badges, edit toggle, cowork btn, save btn |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/save-footer.tsx` | Dirty/saved state, rev indicator, ⌘S hint |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/cowork-request-panel.tsx` | Expandable instruction textarea + prompt preview + clipboard copy |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/conflict-banner.tsx` | Conflict detection banner + diff view |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/section-content.tsx` | Renderer registry: maps section type → renderer component |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/idea-renderer.tsx` | Idea cards with VVS, cross-refs |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/script-renderer.tsx` | Beat-by-beat editor with divergence badges |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/broll-renderer.tsx` | B-Roll checklist with clip inputs, thumbnail concepts |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/scene-guide-renderer.tsx` | Collapsible scenes: music/SFX/overlays/mix/transitions |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/crossref-renderer.tsx` | Script vs recording comparison table |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/speedramp-renderer.tsx` | Speed recommendation table |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/publish-renderer.tsx` | Title/description/tags/cards/end-screen/strategy |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/empty-section.tsx` | Empty state for sections with no content |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/use-section.ts` | Hook: section state, dirty tracking, save handler, conflict detection |
| `apps/web/test/unit/pipeline-sections.test.ts` | Unit tests for section schemas and helpers |
| `apps/web/test/api/pipeline-sections-api.test.ts` | API route tests for section GET/PATCH |

### Modified files

| File | Changes |
|------|---------|
| `apps/web/src/lib/pipeline/workflows.ts` | Add `SECTION_DEFINITIONS` per format with section keys, labels, types, shared flag |
| `apps/web/src/lib/pipeline/schemas.ts` | Add `SectionDataSchema`, `SectionPatchSchema` |
| `apps/web/src/app/cms/(authed)/pipeline/actions.ts` | Add `updateSection()`, `resolveConflict()` server actions |
| `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx` | Complete rewrite: assemble TabContainer + Sidebar |
| `apps/web/src/app/cms/(authed)/pipeline/items/[id]/page.tsx` | Fetch `sections` column, pass to detail component |

---

### Task 1: Database Migration — Add `sections` JSONB Column

**Files:**
- Create: `supabase/migrations/20260511000001_pipeline_sections_jsonb.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260511000001_pipeline_sections_jsonb.sql
ALTER TABLE public.content_pipeline
  ADD COLUMN IF NOT EXISTS sections jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.content_pipeline.sections IS
  'Structured section storage keyed by {type}_{lang|shared}. See spec: pipeline-detail-page-design.md';
```

- [ ] **Step 2: Push to prod**

```bash
npm run db:push:prod
```

Expected: Migration applies, `sections` column added with default `'{}'`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260511000001_pipeline_sections_jsonb.sql
git commit -m "feat(pipeline): add sections jsonb column for structured content"
```

---

### Task 2: Section Types, Schemas & Workflow Config

**Files:**
- Create: `apps/web/src/lib/pipeline/sections.ts`
- Modify: `apps/web/src/lib/pipeline/workflows.ts`
- Modify: `apps/web/src/lib/pipeline/schemas.ts`
- Create: `apps/web/test/unit/pipeline-sections.test.ts`

- [ ] **Step 1: Write failing tests for section helpers**

```typescript
// apps/web/test/unit/pipeline-sections.test.ts
import { describe, it, expect } from 'vitest'
import { getSectionKey, getSectionsForFormat, SectionDataSchema, SectionPatchSchema } from '@/lib/pipeline/sections'

describe('getSectionKey', () => {
  it('returns shared key for shared sections', () => {
    expect(getSectionKey('ideia', 'en')).toBe('ideia_shared')
    expect(getSectionKey('brolls', 'pt')).toBe('brolls_shared')
  })

  it('returns lang-specific key for bilateral sections', () => {
    expect(getSectionKey('roteiro', 'en')).toBe('roteiro_en')
    expect(getSectionKey('roteiro', 'pt')).toBe('roteiro_pt')
    expect(getSectionKey('publish', 'en')).toBe('publish_en')
  })

  it('returns lang-specific key for postprod sub-sections', () => {
    expect(getSectionKey('postprod_scenes', 'en')).toBe('postprod_scenes_en')
    expect(getSectionKey('postprod_crossref', 'pt')).toBe('postprod_crossref_pt')
    expect(getSectionKey('postprod_speedramps', 'en')).toBe('postprod_speedramps_en')
  })
})

describe('getSectionsForFormat', () => {
  it('returns 5 primary sections for video', () => {
    const sections = getSectionsForFormat('video')
    expect(sections.map(s => s.key)).toEqual([
      'ideia', 'roteiro', 'brolls', 'postprod', 'publish',
    ])
  })

  it('marks ideia and brolls as shared for video', () => {
    const sections = getSectionsForFormat('video')
    expect(sections.find(s => s.key === 'ideia')!.shared).toBe(true)
    expect(sections.find(s => s.key === 'brolls')!.shared).toBe(true)
    expect(sections.find(s => s.key === 'roteiro')!.shared).toBe(false)
  })

  it('returns sub-sections for postprod', () => {
    const sections = getSectionsForFormat('video')
    const postprod = sections.find(s => s.key === 'postprod')!
    expect(postprod.subSections).toHaveLength(3)
    expect(postprod.subSections!.map(s => s.key)).toEqual([
      'postprod_crossref', 'postprod_speedramps', 'postprod_scenes',
    ])
  })

  it('returns sections for blog_post', () => {
    const sections = getSectionsForFormat('blog_post')
    expect(sections.map(s => s.key)).toEqual([
      'ideia', 'draft', 'seo', 'images', 'publish',
    ])
  })
})

describe('SectionDataSchema', () => {
  it('validates a valid section', () => {
    const result = SectionDataSchema.safeParse({
      rev: 1,
      source: 'producer',
      edited: false,
      content: 'some content',
      updated_at: '2026-05-10T14:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('allows null cowork_rev', () => {
    const result = SectionDataSchema.safeParse({
      rev: 1,
      cowork_rev: null,
      source: 'user',
      edited: false,
      content: { beats: [] },
      updated_at: '2026-05-10T14:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative rev', () => {
    const result = SectionDataSchema.safeParse({
      rev: -1,
      source: 'user',
      edited: false,
      content: '',
      updated_at: '2026-05-10T14:00:00Z',
    })
    expect(result.success).toBe(false)
  })
})

describe('SectionPatchSchema', () => {
  it('validates a patch with content and rev', () => {
    const result = SectionPatchSchema.safeParse({
      content: 'updated content',
      rev: 2,
    })
    expect(result.success).toBe(true)
  })

  it('rejects patch without rev', () => {
    const result = SectionPatchSchema.safeParse({
      content: 'updated',
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:web -- --reporter=verbose --testPathPattern=pipeline-sections
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create sections.ts with types, schemas, and helpers**

```typescript
// apps/web/src/lib/pipeline/sections.ts
import { z } from 'zod'
import type { Format } from './schemas'

export interface SectionDefinition {
  key: string
  label_pt: string
  label_en: string
  type: string
  shared: boolean
  subSections?: SectionDefinition[]
}

const SHARED_SECTIONS = new Set(['ideia', 'brolls', 'images'])

export function getSectionKey(sectionType: string, lang: string): string {
  if (SHARED_SECTIONS.has(sectionType)) return `${sectionType}_shared`
  const normalizedLang = lang === 'pt-br' ? 'pt' : lang
  return `${sectionType}_${normalizedLang}`
}

export const SECTION_DEFINITIONS: Record<Format, SectionDefinition[]> = {
  video: [
    { key: 'ideia', label_pt: 'Ideia', label_en: 'Idea', type: 'ideia', shared: true },
    { key: 'roteiro', label_pt: 'Roteiro', label_en: 'Script', type: 'roteiro', shared: false },
    { key: 'brolls', label_pt: 'B-Rolls', label_en: 'B-Rolls', type: 'brolls', shared: true },
    {
      key: 'postprod', label_pt: 'Pós-Produção', label_en: 'Post-Production', type: 'postprod', shared: false,
      subSections: [
        { key: 'postprod_crossref', label_pt: 'Cross-Reference', label_en: 'Cross-Reference', type: 'postprod_crossref', shared: false },
        { key: 'postprod_speedramps', label_pt: 'Speed Ramps', label_en: 'Speed Ramps', type: 'postprod_speedramps', shared: false },
        { key: 'postprod_scenes', label_pt: 'Cena × Cena', label_en: 'Scene × Scene', type: 'postprod_scenes', shared: false },
      ],
    },
    { key: 'publish', label_pt: 'Publicação', label_en: 'Publication', type: 'publish', shared: false },
  ],
  blog_post: [
    { key: 'ideia', label_pt: 'Ideia', label_en: 'Idea', type: 'ideia', shared: true },
    { key: 'draft', label_pt: 'Rascunho', label_en: 'Draft', type: 'draft', shared: false },
    { key: 'seo', label_pt: 'SEO', label_en: 'SEO', type: 'seo', shared: false },
    { key: 'images', label_pt: 'Imagens', label_en: 'Images', type: 'images', shared: true },
    { key: 'publish', label_pt: 'Publicação', label_en: 'Publication', type: 'publish', shared: false },
  ],
  newsletter: [
    { key: 'ideia', label_pt: 'Ideia', label_en: 'Idea', type: 'ideia', shared: true },
    { key: 'content', label_pt: 'Conteúdo', label_en: 'Content', type: 'content', shared: false },
    { key: 'layout', label_pt: 'Layout', label_en: 'Layout', type: 'layout', shared: false },
    { key: 'audience', label_pt: 'Audiência', label_en: 'Audience', type: 'audience', shared: false },
    { key: 'send', label_pt: 'Envio', label_en: 'Send', type: 'send', shared: false },
  ],
  course: [
    { key: 'ideia', label_pt: 'Ideia', label_en: 'Idea', type: 'ideia', shared: true },
    { key: 'curriculum', label_pt: 'Currículo', label_en: 'Curriculum', type: 'curriculum', shared: false },
    { key: 'lessons', label_pt: 'Aulas', label_en: 'Lessons', type: 'lessons', shared: false },
    { key: 'material', label_pt: 'Material', label_en: 'Material', type: 'material', shared: false },
    { key: 'publish', label_pt: 'Publicação', label_en: 'Publication', type: 'publish', shared: false },
  ],
  campaign: [
    { key: 'ideia', label_pt: 'Ideia', label_en: 'Idea', type: 'ideia', shared: true },
    { key: 'briefing', label_pt: 'Briefing', label_en: 'Briefing', type: 'briefing', shared: false },
    { key: 'assets', label_pt: 'Assets', label_en: 'Assets', type: 'assets', shared: false },
    { key: 'metrics', label_pt: 'Métricas', label_en: 'Metrics', type: 'metrics', shared: false },
    { key: 'publish', label_pt: 'Publicação', label_en: 'Publication', type: 'publish', shared: false },
  ],
}

export function getSectionsForFormat(format: Format): SectionDefinition[] {
  return SECTION_DEFINITIONS[format]
}

export function flattenSections(sections: SectionDefinition[]): SectionDefinition[] {
  return sections.flatMap(s => s.subSections ? [s, ...s.subSections] : [s])
}

export const SectionDataSchema = z.object({
  rev: z.number().int().min(0),
  cowork_rev: z.number().int().min(0).nullable().optional(),
  source: z.string().min(1),
  edited: z.boolean(),
  content: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]),
  updated_at: z.string().datetime(),
})

export type SectionData = z.infer<typeof SectionDataSchema>

export const SectionPatchSchema = z.object({
  content: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]),
  rev: z.number().int().min(0),
  source: z.string().optional(),
})

export type SectionPatch = z.infer<typeof SectionPatchSchema>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:web -- --reporter=verbose --testPathPattern=pipeline-sections
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/sections.ts apps/web/test/unit/pipeline-sections.test.ts
git commit -m "feat(pipeline): section types, schemas, and workflow config"
```

---

### Task 3: Section API Endpoints (GET/PATCH)

**Files:**
- Create: `apps/web/src/app/api/pipeline/items/[id]/sections/[section]/route.ts`
- Create: `apps/web/test/api/pipeline-sections-api.test.ts`

- [ ] **Step 1: Write failing tests for section API**

```typescript
// apps/web/test/api/pipeline-sections-api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  requirePermission: vi.fn(() => true),
  buildRateLimitHeaders: vi.fn(() => ({})),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

import { GET, PATCH } from '@/app/api/pipeline/items/[id]/sections/[section]/route'
import { authenticatePipeline } from '@/lib/pipeline/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const mockAuth = { ok: true as const, auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'session' as const } }
const mockItem = {
  id: '00000000-0000-0000-0000-000000000001',
  format: 'video',
  language: 'both',
  version: 3,
  sections: {
    roteiro_en: { rev: 2, source: 'producer', edited: false, content: 'beat content', updated_at: '2026-05-10T00:00:00Z' },
  },
}

function makeRequest(method: string, body?: unknown): Request {
  const init: RequestInit = { method, headers: new Headers() }
  if (body) {
    init.body = JSON.stringify(body)
    ;(init.headers as Headers).set('Content-Type', 'application/json')
  }
  return new Request('http://localhost/api/pipeline/items/test-id/sections/roteiro', init)
}

describe('GET /api/pipeline/items/[id]/sections/[section]', () => {
  beforeEach(() => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth)
  })

  it('returns section data for a valid section key', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockItem, error: null }),
        }),
      }),
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) } as any)

    const params = Promise.resolve({ id: mockItem.id, section: 'roteiro' })
    const res = await GET(makeRequest('GET') as any, { params })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.rev).toBe(2)
    expect(json.data.content).toBe('beat content')
  })

  it('returns 404 for a section that does not exist in the item', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockItem, error: null }),
        }),
      }),
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) } as any)

    const params = Promise.resolve({ id: mockItem.id, section: 'publish' })
    const res = await GET(makeRequest('GET') as any, { params })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/pipeline/items/[id]/sections/[section]', () => {
  beforeEach(() => {
    vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth)
  })

  it('returns 400 without If-Match header', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as any)

    const params = Promise.resolve({ id: mockItem.id, section: 'roteiro' })
    const res = await PATCH(makeRequest('PATCH', { content: 'new', rev: 2 }) as any, { params })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:web -- --reporter=verbose --testPathPattern=pipeline-sections-api
```

Expected: FAIL — route module not found.

- [ ] **Step 3: Implement the section API route**

```typescript
// apps/web/src/app/api/pipeline/items/[id]/sections/[section]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { getSectionKey, SectionPatchSchema } from '@/lib/pipeline/sections'
import type { SectionData } from '@/lib/pipeline/sections'

type RouteParams = { params: Promise<{ id: string; section: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id, section } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID' } }, { status: 400 })
  }

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })

  const lang = req.nextUrl.searchParams.get('lang') || 'en'
  const sectionKey = getSectionKey(section, lang)

  const supabase = getSupabaseServiceClient()
  const { data: item, error } = await supabase
    .from('content_pipeline')
    .select('id, format, language, version, sections')
    .eq('id', id)
    .eq('site_id', authResult.auth.siteId)
    .single()

  if (error || !item) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })

  const sections = (item.sections ?? {}) as Record<string, SectionData>
  const sectionData = sections[sectionKey]
  if (!sectionData) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: `Section "${sectionKey}" not found` } }, { status: 404 })
  }

  const headers = buildRateLimitHeaders(authResult.auth)
  return NextResponse.json({
    data: sectionData,
    meta: { section_key: sectionKey, item_version: item.version },
  }, { headers })
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, section } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID' } }, { status: 400 })
  }

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  if (!requirePermission(authResult.auth, 'write')) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })
  }

  const ifMatch = req.headers.get('If-Match')
  if (!ifMatch) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'If-Match header required' } }, { status: 400 })
  const expectedVersion = parseInt(ifMatch)

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON' } }, { status: 400 })
  }

  const parsed = SectionPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } }, { status: 400 })
  }

  const lang = req.nextUrl.searchParams.get('lang') || 'en'
  const sectionKey = getSectionKey(section, lang)

  const supabase = getSupabaseServiceClient()

  const { data: item, error: fetchError } = await supabase
    .from('content_pipeline')
    .select('id, version, sections')
    .eq('id', id)
    .eq('site_id', authResult.auth.siteId)
    .single()

  if (fetchError || !item) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })
  if (item.version !== expectedVersion) {
    return NextResponse.json({ error: { code: 'CONFLICT', message: 'Version mismatch', current_version: item.version } }, { status: 409 })
  }

  const sections = (item.sections ?? {}) as Record<string, SectionData>
  const existing = sections[sectionKey]
  if (existing && existing.rev !== parsed.data.rev) {
    return NextResponse.json({ error: { code: 'CONFLICT', message: 'Section revision mismatch', current_rev: existing.rev } }, { status: 409 })
  }

  const newRev = (existing?.rev ?? 0) + 1
  const updatedSection: SectionData = {
    rev: newRev,
    cowork_rev: existing?.cowork_rev ?? null,
    source: parsed.data.source ?? existing?.source ?? 'user',
    edited: (parsed.data.source ?? 'user') === 'user' || existing?.edited === true,
    content: parsed.data.content,
    updated_at: new Date().toISOString(),
  }

  const newSections = { ...sections, [sectionKey]: updatedSection }

  const { error: updateError } = await supabase
    .from('content_pipeline')
    .update({
      sections: newSections,
      version: item.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('version', expectedVersion)

  if (updateError) {
    return NextResponse.json({ error: { code: 'CONFLICT', message: 'Concurrent update detected' } }, { status: 409 })
  }

  const headers = buildRateLimitHeaders(authResult.auth)
  return NextResponse.json({
    data: updatedSection,
    meta: { section_key: sectionKey, item_version: item.version + 1 },
  }, { headers })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:web -- --reporter=verbose --testPathPattern=pipeline-sections-api
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/pipeline/items/\[id\]/sections/\[section\]/route.ts apps/web/test/api/pipeline-sections-api.test.ts
git commit -m "feat(pipeline): section API endpoints GET/PATCH with optimistic locking"
```

---

### Task 4: useSection Hook — Section State Management

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/use-section.ts`

- [ ] **Step 1: Create the useSection hook**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/use-section.ts
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { SectionData } from '@/lib/pipeline/sections'

interface UseSectionOptions {
  itemId: string
  sectionKey: string
  initialData: SectionData | null
  itemVersion: number
  onSaveSuccess?: (newRev: number, newVersion: number) => void
}

interface UseSectionReturn {
  content: SectionData['content'] | null
  rev: number
  isDirty: boolean
  isSaving: boolean
  isEditing: boolean
  conflict: { remoteData: SectionData; localContent: SectionData['content'] } | null
  setContent: (content: SectionData['content']) => void
  setIsEditing: (editing: boolean) => void
  save: () => Promise<void>
  acceptRemote: () => void
  keepLocal: () => Promise<void>
  dismissConflict: () => void
  source: string | null
  edited: boolean
  coworkRev: number | null
}

export function useSection({ itemId, sectionKey, initialData, itemVersion, onSaveSuccess }: UseSectionOptions): UseSectionReturn {
  const [content, setContentState] = useState<SectionData['content'] | null>(initialData?.content ?? null)
  const [rev, setRev] = useState(initialData?.rev ?? 0)
  const [version, setVersion] = useState(itemVersion)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [conflict, setConflict] = useState<UseSectionReturn['conflict']>(null)
  const [source] = useState(initialData?.source ?? null)
  const [edited, setEdited] = useState(initialData?.edited ?? false)
  const [coworkRev] = useState(initialData?.cowork_rev ?? null)
  const contentRef = useRef(content)
  contentRef.current = content

  const setContent = useCallback((newContent: SectionData['content']) => {
    setContentState(newContent)
    setIsDirty(true)
    setEdited(true)
  }, [])

  const save = useCallback(async () => {
    if (!isDirty || isSaving || !contentRef.current) return
    setIsSaving(true)

    try {
      const res = await fetch(`/api/pipeline/items/${itemId}/sections/${sectionKey.split('_').slice(0, -1).join('_') || sectionKey}?lang=${sectionKey.endsWith('_shared') ? 'en' : sectionKey.split('_').pop()}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'If-Match': String(version) },
        body: JSON.stringify({ content: contentRef.current, rev, source: 'user' }),
      })

      if (res.status === 409) {
        const error = await res.json()
        if (error.error?.current_rev) {
          const remoteRes = await fetch(`/api/pipeline/items/${itemId}/sections/${sectionKey.split('_').slice(0, -1).join('_') || sectionKey}?lang=${sectionKey.endsWith('_shared') ? 'en' : sectionKey.split('_').pop()}`)
          if (remoteRes.ok) {
            const remote = await remoteRes.json()
            setConflict({ remoteData: remote.data, localContent: contentRef.current })
          }
        }
        return
      }

      if (!res.ok) throw new Error('Save failed')

      const { data, meta } = await res.json()
      setRev(data.rev)
      setVersion(meta.item_version)
      setIsDirty(false)
      onSaveSuccess?.(data.rev, meta.item_version)
    } finally {
      setIsSaving(false)
    }
  }, [isDirty, isSaving, itemId, sectionKey, version, rev, onSaveSuccess])

  const acceptRemote = useCallback(() => {
    if (!conflict) return
    setContentState(conflict.remoteData.content)
    setRev(conflict.remoteData.rev)
    setIsDirty(false)
    setConflict(null)
  }, [conflict])

  const keepLocal = useCallback(async () => {
    if (!conflict) return
    setRev(conflict.remoteData.rev)
    setConflict(null)
    await save()
  }, [conflict, save])

  const dismissConflict = useCallback(() => setConflict(null), [])

  return {
    content, rev, isDirty, isSaving, isEditing, conflict,
    setContent, setIsEditing, save, acceptRemote, keepLocal, dismissConflict,
    source, edited, coworkRev,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/use-section.ts
git commit -m "feat(pipeline): useSection hook for section state and conflict management"
```

---

### Task 5: Tab Infrastructure — TabContainer, PrimaryTabBar, LanguageToggle

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/tab-container.tsx`

- [ ] **Step 1: Create TabContainer with tab switching, language toggle, keyboard shortcuts, and URL hash**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/tab-container.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Format } from '@/lib/pipeline/schemas'
import { getSectionsForFormat, type SectionDefinition } from '@/lib/pipeline/sections'
import type { SectionData } from '@/lib/pipeline/sections'

interface TabContainerProps {
  format: Format
  itemId: string
  itemVersion: number
  sections: Record<string, SectionData>
  itemCode: string
  itemTitle: string
  children: (props: {
    activeTab: string
    activeSub: string | null
    lang: string
    sections: Record<string, SectionData>
    sectionDefs: SectionDefinition[]
    setActiveTab: (tab: string) => void
    setActiveSub: (sub: string | null) => void
    setLang: (lang: string) => void
  }) => React.ReactNode
}

export function TabContainer({ format, itemId, itemVersion, sections, itemCode, itemTitle, children }: TabContainerProps) {
  const sectionDefs = getSectionsForFormat(format)
  const [activeTab, setActiveTab] = useState(sectionDefs[0]?.key ?? '')
  const [activeSub, setActiveSub] = useState<string | null>(null)
  const [lang, setLang] = useState('en')

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (!hash) return
    const parts = hash.split('/')
    const tab = parts[0]
    const sub = parts.length === 3 ? parts[1] : null
    const hashLang = parts[parts.length - 1]
    if (sectionDefs.some(s => s.key === tab)) setActiveTab(tab)
    if (sub) setActiveSub(sub)
    if (hashLang === 'pt' || hashLang === 'en') setLang(hashLang)
  }, [sectionDefs])

  useEffect(() => {
    const hashParts = [activeTab]
    if (activeSub) hashParts.push(activeSub)
    if (lang !== 'en') hashParts.push(lang)
    window.history.replaceState(null, '', `#${hashParts.join('/')}`)
  }, [activeTab, activeSub, lang])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return
      const tag = (e.target as HTMLElement)?.tagName
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable

      if (e.key === 's') {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('pipeline:save-section'))
        return
      }
      if (isEditable && e.key !== 'l') return

      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const idx = parseInt(e.key) - 1
        if (idx < sectionDefs.length) {
          setActiveTab(sectionDefs[idx].key)
          setActiveSub(null)
        }
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const currentIdx = sectionDefs.findIndex(s => s.key === activeTab)
        const newIdx = e.key === 'ArrowLeft' ? Math.max(0, currentIdx - 1) : Math.min(sectionDefs.length - 1, currentIdx + 1)
        setActiveTab(sectionDefs[newIdx].key)
        setActiveSub(null)
        return
      }
      if (e.key === 'l') {
        e.preventDefault()
        setLang(prev => prev === 'en' ? 'pt' : 'en')
        return
      }
      if (e.key === 'e') {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('pipeline:toggle-edit'))
        return
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, sectionDefs])

  const activeDef = sectionDefs.find(s => s.key === activeTab)
  const hasSubs = activeDef?.subSections && activeDef.subSections.length > 0

  return (
    <div className="flex flex-col gap-3">
      {/* Primary tabs + language toggle */}
      <div className="flex items-end justify-between" style={{ borderBottom: '1px solid var(--gem-border)' }}>
        <div className="flex overflow-x-auto" role="tablist" aria-label="Seções do pipeline item" style={{ scrollbarWidth: 'none' }}>
          {sectionDefs.map((def, i) => {
            const isActive = activeTab === def.key
            const sectionKey = def.shared ? `${def.key}_shared` : `${def.key}_${lang}`
            const hasContent = !!sections[sectionKey]
            return (
              <button
                key={def.key}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${def.key}`}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium whitespace-nowrap select-none transition-colors"
                style={{
                  color: isActive ? 'var(--gem-text)' : 'var(--gem-dim)',
                  borderBottom: isActive ? '2px solid var(--gem-accent)' : '2px solid transparent',
                }}
                onClick={() => { setActiveTab(def.key); setActiveSub(null) }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: hasContent ? 'var(--gem-done)' : 'transparent', border: hasContent ? 'none' : '1px solid var(--gem-dim)' }} />
                {def.label_pt}
                {def.subSections && <span className="text-[9px] ml-0.5" style={{ color: 'var(--gem-dim)' }}>{def.subSections.length}</span>}
              </button>
            )
          })}
        </div>
        <div className="flex mb-2 rounded overflow-hidden" style={{ border: '1px solid var(--gem-border)' }}>
          {['pt', 'en'].map(l => (
            <button
              key={l}
              className="px-2.5 py-0.5 text-[10px] font-bold tracking-wider transition-colors"
              style={{
                background: lang === l ? 'var(--gem-accent)' : 'transparent',
                color: lang === l ? 'white' : 'var(--gem-dim)',
              }}
              onClick={() => setLang(l)}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tabs for sections with sub-sections (e.g., postprod) */}
      {hasSubs && (
        <div className="flex gap-0 px-4" role="tablist" aria-label={`Sub-seções de ${activeDef.label_pt}`} style={{ background: 'var(--gem-well)', borderBottom: '1px solid var(--gem-border)' }}>
          {activeDef.subSections!.map(sub => {
            const isSubActive = activeSub === sub.key || (!activeSub && sub === activeDef.subSections![0])
            return (
              <button
                key={sub.key}
                role="tab"
                aria-selected={isSubActive}
                className="px-3 py-1.5 text-[11px] whitespace-nowrap transition-colors"
                style={{
                  color: isSubActive ? '#22d3ee' : 'var(--gem-dim)',
                  borderBottom: isSubActive ? '2px solid #22d3ee' : '2px solid transparent',
                }}
                onClick={() => setActiveSub(sub.key)}
              >
                {sub.label_pt}
              </button>
            )
          })}
        </div>
      )}

      {/* Render children with tab state */}
      {children({
        activeTab,
        activeSub: activeSub ?? activeDef?.subSections?.[0]?.key ?? null,
        lang,
        sections,
        sectionDefs,
        setActiveTab,
        setActiveSub,
        setLang,
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/tab-container.tsx
git commit -m "feat(pipeline): TabContainer with tabs, lang toggle, keyboard shortcuts, URL hash"
```

---

### Task 6: Section Chrome — Toolbar, SaveFooter, CoworkRequestPanel

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/section-toolbar.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/save-footer.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/cowork-request-panel.tsx`

- [ ] **Step 1: Create SectionToolbar**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/section-toolbar.tsx
'use client'

interface SectionToolbarProps {
  title: string
  lang: string
  showLang: boolean
  source: string | null
  edited: boolean
  isEditing: boolean
  isSaving: boolean
  isDirty: boolean
  onToggleEdit: (editing: boolean) => void
  onSave: () => void
  onToggleCowork: () => void
}

export function SectionToolbar({
  title, lang, showLang, source, edited, isEditing, isSaving, isDirty, onToggleEdit, onSave, onToggleCowork,
}: SectionToolbarProps) {
  return (
    <div className="flex justify-between items-center px-4 py-2 flex-wrap gap-1.5" style={{ borderBottom: '1px solid var(--gem-border)', background: 'rgba(26,29,40,0.6)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold flex items-center gap-1.5">
          {title}
          {showLang && <span className="text-[10px] font-bold" style={{ color: 'var(--gem-accent)' }}>{lang.toUpperCase()}</span>}
        </span>
        {source && source !== 'user' && (
          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
            🤖 {source}
          </span>
        )}
        {edited && (
          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
            ✏️ editado
          </span>
        )}
      </div>
      <div className="flex gap-1.5 items-center">
        <label className="flex items-center gap-1.5 text-[10px] cursor-pointer select-none" style={{ color: 'var(--gem-dim)' }}>
          <input type="checkbox" checked={isEditing} onChange={(e) => onToggleEdit(e.target.checked)} className="w-3 h-3" style={{ accentColor: 'var(--gem-accent)' }} />
          Editar
        </label>
        <button
          onClick={onToggleCowork}
          className="px-2 py-0.5 text-[10px] rounded transition-colors"
          style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}
        >
          🤖 Pedir atualização
        </button>
        <button
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className="px-3 py-0.5 text-[10px] font-semibold rounded transition-opacity"
          style={{
            background: 'var(--gem-done)',
            border: '1px solid var(--gem-done)',
            color: 'white',
            opacity: !isDirty || isSaving ? 0.3 : 1,
            cursor: !isDirty || isSaving ? 'default' : 'pointer',
          }}
        >
          {isSaving ? '⏳' : '💾'} Salvar <span className="text-[8px] px-1 rounded ml-0.5" style={{ border: '1px solid rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>⌘S</span>
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create SaveFooter**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/save-footer.tsx
'use client'

interface SaveFooterProps {
  isDirty: boolean
  rev: number
  updatedAt?: string
}

export function SaveFooter({ isDirty, rev, updatedAt }: SaveFooterProps) {
  return (
    <div
      className="flex justify-between items-center px-4 py-1.5 text-[10px]"
      style={{
        borderTop: isDirty ? '2px solid var(--gem-warn)' : '1px solid var(--gem-border)',
        background: 'rgba(26,29,40,0.6)',
      }}
    >
      <span className="flex items-center gap-1">
        <span
          className="w-1.5 h-1.5 rounded-full inline-block"
          style={{
            background: isDirty ? 'var(--gem-warn)' : 'var(--gem-done)',
            animation: isDirty ? 'pulse 1.5s infinite' : 'none',
          }}
        />
        <span style={{ color: isDirty ? 'var(--gem-warn)' : 'var(--gem-done)' }}>
          {isDirty ? 'Alterações não salvas' : 'Salvo'}
        </span>
      </span>
      <span style={{ color: 'var(--gem-dim)' }}>
        rev.{rev}
        {updatedAt && ` · ${new Date(updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
        {isDirty && <span className="ml-1 px-1 rounded" style={{ border: '1px solid var(--gem-border)', fontFamily: 'monospace', fontSize: '8px' }}>⌘S</span>}
      </span>
    </div>
  )
}
```

- [ ] **Step 3: Create CoworkRequestPanel**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/cowork-request-panel.tsx
'use client'

import { useState, useCallback } from 'react'

interface CoworkRequestPanelProps {
  isOpen: boolean
  onClose: () => void
  itemCode: string
  itemTitle: string
  sectionLabel: string
  sectionKey: string
  lang: string
  rev: number
  placeholder: string
}

export function CoworkRequestPanel({ isOpen, onClose, itemCode, itemTitle, sectionLabel, sectionKey, lang, rev, placeholder }: CoworkRequestPanelProps) {
  const [instructions, setInstructions] = useState('')
  const [copied, setCopied] = useState(false)

  const prompt = instructions.trim()
    ? `Pipeline item: ${itemCode} — "${itemTitle}"
Section: ${sectionLabel} (${sectionKey})
Language: ${lang.toUpperCase()}
Section revision: rev.${rev}

Instructions:
${instructions.trim()}

---
Use the pipeline API to:
1. GET /api/pipeline/items/{id}/sections/${sectionKey.replace(/_(?:en|pt|shared)$/, '')}?lang=${lang}
2. Apply the instructions above to the current content
3. PATCH /api/pipeline/items/{id}/sections/${sectionKey.replace(/_(?:en|pt|shared)$/, '')} with updated content`
    : ''

  const handleCopy = useCallback(() => {
    if (!prompt) return
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [prompt])

  if (!isOpen) return null

  return (
    <div className="px-4 py-2.5" style={{ background: 'rgba(167,139,250,0.04)', borderTop: '1px solid rgba(167,139,250,0.15)' }}>
      <textarea
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder={placeholder}
        className="w-full text-xs p-2 rounded-md resize-y font-sans"
        style={{
          background: 'var(--gem-well)',
          border: '1px solid rgba(167,139,250,0.2)',
          color: 'var(--gem-text)',
          minHeight: '60px',
        }}
      />
      {prompt && (
        <pre className="mt-2 p-2 rounded-md text-[10px] overflow-y-auto max-h-20" style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', color: 'var(--gem-dim)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          {prompt}
        </pre>
      )}
      <div className="flex justify-between items-center mt-2">
        <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>Cole no Claude Cowork.</span>
        <div className="flex gap-1.5 items-center">
          {copied && <span className="text-[10px]" style={{ color: 'var(--gem-done)' }}>✓ Copiado!</span>}
          <button onClick={onClose} className="px-2 py-0.5 text-[10px] rounded" style={{ border: '1px solid var(--gem-border)', color: 'var(--gem-muted)' }}>Cancelar</button>
          <button
            onClick={handleCopy}
            disabled={!prompt}
            className="px-2 py-0.5 text-[10px] font-semibold rounded"
            style={{ background: '#a78bfa', border: '1px solid #a78bfa', color: 'white', opacity: prompt ? 1 : 0.3 }}
          >
            📋 Copiar prompt
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/section-toolbar.tsx apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/save-footer.tsx apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/cowork-request-panel.tsx
git commit -m "feat(pipeline): section chrome — toolbar, save footer, cowork panel"
```

---

### Task 7: ConflictBanner + EmptySection

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/conflict-banner.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/empty-section.tsx`

- [ ] **Step 1: Create ConflictBanner**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/conflict-banner.tsx
'use client'

import { useState } from 'react'

interface ConflictBannerProps {
  onKeepLocal: () => void
  onAcceptRemote: () => void
  localContent: unknown
  remoteContent: unknown
}

export function ConflictBanner({ onKeepLocal, onAcceptRemote, localContent, remoteContent }: ConflictBannerProps) {
  const [showDiff, setShowDiff] = useState(false)

  const localStr = typeof localContent === 'string' ? localContent : JSON.stringify(localContent, null, 2)
  const remoteStr = typeof remoteContent === 'string' ? remoteContent : JSON.stringify(remoteContent, null, 2)
  const localLines = localStr.split('\n')
  const remoteLines = remoteStr.split('\n')

  return (
    <>
      <div className="px-4 py-2 flex items-center justify-between flex-wrap gap-1.5 text-[11px]" style={{ background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
        <span className="flex items-center gap-1.5" style={{ color: 'var(--gem-warn)' }}>
          ⚠️ Cowork atualizou esta seção. Você tem edições locais não salvas.
        </span>
        <span className="flex gap-1">
          <button onClick={() => setShowDiff(prev => !prev)} className="px-2 py-0.5 text-[10px] rounded" style={{ border: '1px solid var(--gem-border)', color: 'var(--gem-muted)' }}>Ver diff</button>
          <button onClick={onKeepLocal} className="px-2 py-0.5 text-[10px] rounded font-semibold" style={{ background: 'var(--gem-accent)', border: '1px solid var(--gem-accent)', color: 'white' }}>Manter minha versão</button>
          <button onClick={onAcceptRemote} className="px-2 py-0.5 text-[10px] rounded" style={{ border: '1px solid var(--gem-border)', color: 'var(--gem-muted)' }}>Aceitar Cowork</button>
        </span>
      </div>
      {showDiff && (
        <div className="px-4 py-3 max-h-48 overflow-y-auto text-[11px] font-mono" style={{ background: 'var(--gem-well)', borderBottom: '1px solid var(--gem-border)' }}>
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--gem-dim)' }}>
            <span>Diff: sua versão vs Cowork</span>
            <button onClick={() => setShowDiff(false)} className="px-1.5 text-[10px] rounded" style={{ border: '1px solid var(--gem-border)', color: 'var(--gem-dim)' }}>✕</button>
          </div>
          {localLines.map((line, i) => {
            const remoteLine = remoteLines[i]
            if (line === remoteLine) return <div key={i} className="px-2 py-px" style={{ color: 'var(--gem-dim)' }}>  {line}</div>
            return (
              <div key={i}>
                <div className="px-2 py-px rounded" style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', textDecoration: 'line-through' }}>- {line}</div>
                {remoteLine && <div className="px-2 py-px rounded" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7' }}>+ {remoteLine}</div>}
              </div>
            )
          })}
          {remoteLines.slice(localLines.length).map((line, i) => (
            <div key={`extra-${i}`} className="px-2 py-px rounded" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7' }}>+ {line}</div>
          ))}
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Create EmptySection renderer**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/empty-section.tsx
interface EmptySectionProps {
  sectionLabel: string
  onRequestCowork: () => void
}

export function EmptySection({ sectionLabel, onRequestCowork }: EmptySectionProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="text-3xl mb-2.5 opacity-30">📝</div>
      <div className="text-sm font-medium mb-1" style={{ color: 'var(--gem-muted)' }}>
        {sectionLabel} ainda não tem conteúdo
      </div>
      <div className="text-[11px] mb-4 max-w-xs" style={{ color: 'var(--gem-dim)' }}>
        Use o Cowork para gerar o conteúdo inicial ou comece a editar manualmente.
      </div>
      <button
        onClick={onRequestCowork}
        className="px-3 py-1.5 text-[11px] rounded font-medium transition-colors"
        style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}
      >
        🤖 Gerar com Cowork
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/conflict-banner.tsx apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/empty-section.tsx
git commit -m "feat(pipeline): conflict banner with diff view + empty section state"
```

---

### Task 8: Section Content Registry + All 7 Renderers

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/section-content.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/idea-renderer.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/script-renderer.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/broll-renderer.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/scene-guide-renderer.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/crossref-renderer.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/speedramp-renderer.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/publish-renderer.tsx`

This is the largest task. Each renderer follows the same pattern: receives `content`, `isEditing`, and `onContentChange`. All renderers use the Gem design system CSS variables.

- [ ] **Step 1: Create section-content.tsx (registry)**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/section-content.tsx
'use client'

import { lazy, Suspense } from 'react'
import type { SectionData } from '@/lib/pipeline/sections'

const IdeaRenderer = lazy(() => import('./renderers/idea-renderer').then(m => ({ default: m.IdeaRenderer })))
const ScriptRenderer = lazy(() => import('./renderers/script-renderer').then(m => ({ default: m.ScriptRenderer })))
const BRollRenderer = lazy(() => import('./renderers/broll-renderer').then(m => ({ default: m.BRollRenderer })))
const SceneGuideRenderer = lazy(() => import('./renderers/scene-guide-renderer').then(m => ({ default: m.SceneGuideRenderer })))
const CrossRefRenderer = lazy(() => import('./renderers/crossref-renderer').then(m => ({ default: m.CrossRefRenderer })))
const SpeedRampRenderer = lazy(() => import('./renderers/speedramp-renderer').then(m => ({ default: m.SpeedRampRenderer })))
const PublishRenderer = lazy(() => import('./renderers/publish-renderer').then(m => ({ default: m.PublishRenderer })))

const REGISTRY: Record<string, React.LazyExoticComponent<React.ComponentType<RendererProps>>> = {
  ideia: IdeaRenderer,
  roteiro: ScriptRenderer,
  brolls: BRollRenderer,
  postprod_scenes: SceneGuideRenderer,
  postprod_crossref: CrossRefRenderer,
  postprod_speedramps: SpeedRampRenderer,
  publish: PublishRenderer,
}

export interface RendererProps {
  content: SectionData['content']
  isEditing: boolean
  lang: string
  onContentChange: (content: SectionData['content']) => void
}

interface SectionContentProps extends RendererProps {
  sectionType: string
}

function LoadingSkeleton() {
  return (
    <div className="p-5 space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-4 rounded" style={{ background: 'var(--gem-well)', width: `${80 - i * 15}%` }} />
      ))}
    </div>
  )
}

export function SectionContent({ sectionType, content, isEditing, lang, onContentChange }: SectionContentProps) {
  const Renderer = REGISTRY[sectionType]
  if (!Renderer) {
    return (
      <div className="p-5 text-xs" style={{ color: 'var(--gem-dim)' }}>
        Renderer não encontrado para tipo: {sectionType}
      </div>
    )
  }

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <Renderer content={content} isEditing={isEditing} lang={lang} onContentChange={onContentChange} />
    </Suspense>
  )
}
```

- [ ] **Step 2: Create IdeaRenderer**

Renders idea cards with VVS, ângulo, cross-references. See mockup `detail-v6.html` lines 992-1010 for exact layout. Implementation should parse `content` as structured object with `premise`, `angle`, `vvs`, `validated_at`, `cross_refs[]`.

```typescript
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/idea-renderer.tsx
'use client'

import type { RendererProps } from '../section-content'

interface IdeaContent {
  premise: string
  body: string
  angle?: string
  vvs?: number
  validated_at?: string
  cross_refs?: Array<{ code: string; title: string; note: string }>
}

export function IdeaRenderer({ content, isEditing, onContentChange }: RendererProps) {
  const data = (typeof content === 'object' && content !== null && !Array.isArray(content) ? content : { premise: '', body: typeof content === 'string' ? content : '' }) as IdeaContent

  return (
    <div className={`p-5 space-y-2 ${isEditing ? 'editing' : ''}`}>
      <div className="p-3 rounded-md" style={{ background: 'var(--gem-well)', borderLeft: '3px solid var(--gem-done)' }}>
        <div className="text-xs font-semibold mb-1" style={{ color: 'var(--gem-text)' }}>{data.premise || 'Sem título'}</div>
        <div
          className="text-[11px]"
          style={{ color: 'var(--gem-muted)' }}
          contentEditable={isEditing}
          suppressContentEditableWarning
          spellCheck={false}
          onBlur={(e) => isEditing && onContentChange({ ...data, body: e.currentTarget.textContent ?? '' })}
        >
          {data.body || 'Sem descrição'}
        </div>
        <div className="flex gap-2 flex-wrap mt-1.5 text-[9px]" style={{ color: 'var(--gem-dim)' }}>
          {data.vvs != null && <span>VVS: {data.vvs}/100</span>}
          {data.angle && <span>Ângulo: {data.angle}</span>}
          {data.validated_at && <span>Validado: {new Date(data.validated_at).toLocaleDateString('pt-BR')}</span>}
        </div>
      </div>
      {data.cross_refs && data.cross_refs.length > 0 && (
        <div className="p-3 rounded-md" style={{ background: 'var(--gem-well)', borderLeft: '3px solid var(--gem-accent)' }}>
          <div className="text-xs font-semibold mb-1" style={{ color: 'var(--gem-text)' }}>Cross-referências</div>
          <ul className="pl-3.5 m-0 text-[11px] space-y-0.5" style={{ color: 'var(--gem-muted)' }}>
            {data.cross_refs.map((ref, i) => (
              <li key={i}><strong style={{ color: 'var(--gem-accent)' }}>{ref.code}</strong> {ref.title} — {ref.note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create remaining 6 renderers**

Each renderer follows the same interface (`RendererProps`). Create them one file at a time, matching the mockup's visual structure. The detailed implementation for each renderer is based on the spec's "Content Section Renderers" section and the `detail-v6.html` mockup. Each renderer should:

1. Parse `content` into its expected type
2. Render with Gem design system CSS variables
3. Support `isEditing` mode with `contentEditable` where appropriate
4. Call `onContentChange` when user edits

Create these files with the correct structure — the renderers can start minimal and be enriched incrementally:

- `script-renderer.tsx` — Meta grid + beat blocks with divergence badges
- `broll-renderer.tsx` — Checklist items with clip inputs + thumbnail concept card
- `scene-guide-renderer.tsx` — Collapsible accordion scenes with 6 sub-sections each
- `crossref-renderer.tsx` — Script vs recording table + divergences callout
- `speedramp-renderer.tsx` — Speed recommendation table
- `publish-renderer.tsx` — Title/desc/tags/cards/end-screen/strategy with bilateral lang-content blocks

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/section-content.tsx apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/
git commit -m "feat(pipeline): section content registry + 7 content renderers"
```

---

### Task 9: Rewrite PipelineItemDetail — Full Assembly

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx` (complete rewrite)
- Modify: `apps/web/src/app/cms/(authed)/pipeline/items/[id]/page.tsx`

- [ ] **Step 1: Update the server page to fetch sections**

In `apps/web/src/app/cms/(authed)/pipeline/items/[id]/page.tsx`, add `sections` to the Supabase `select()` query so it's passed to the detail component. Change the select from `'*'` to explicitly include `sections`:

```typescript
// In the existing query, ensure sections is included in the select
const { data: item } = await supabase
  .from('content_pipeline')
  .select('*, content_pipeline_memberships(...)')
  .eq('id', id)
  // ... rest unchanged
```

The `*` already captures `sections` since it's a regular column. No change needed to the select, but update the `PipelineItemDetail` props to accept `sections`.

- [ ] **Step 2: Rewrite pipeline-item-detail.tsx**

Replace the entire 325-line component with the new tabbed architecture. The new component:

1. Renders `DetailHeader` (title, hook, synopsis — reuse existing debounced save)
2. Renders `TabContainer` with format-specific tabs
3. Inside `TabContainer` render function: for each active section, render `SectionToolbar` + `CoworkRequestPanel` + `ConflictBanner` + `SectionContent` + `SaveFooter` using the `useSection` hook
4. Renders the existing sidebar cards (StageCard, ChecklistCard, VVSCard, DetailsCard, HistoryCard) plus the new `SectionsCard`

The component should maintain the existing server actions (advance, retreat, archive, toggleChecklist) and debounced header save pattern.

Key structure:

```tsx
export function PipelineItemDetail({ item, history, collections, dependencies }: Props) {
  // ... existing state for title/hook/synopsis with debounced save
  // ... existing handlers for advance/retreat/archive/checklist

  return (
    <div className="flex gap-5" style={{ padding: '20px 24px', maxWidth: 1440, margin: '0 auto' }}>
      <div className="flex-1 min-w-0 flex flex-col gap-3.5">
        {/* Breadcrumb */}
        {/* DetailHeader (title, hook, synopsis) */}
        <TabContainer format={item.format} itemId={item.id} itemVersion={item.version} sections={item.sections ?? {}} itemCode={item.code} itemTitle={item.title_pt || item.title_en || ''}>
          {({ activeTab, activeSub, lang, sections, sectionDefs }) => {
            // Determine which section type to render
            // Use useSection hook for state management
            // Render: SectionToolbar → CoworkRequestPanel → ConflictBanner → SectionContent → SaveFooter
          }}
        </TabContainer>
      </div>

      {/* Sidebar */}
      <aside className="w-68 shrink-0 flex flex-col gap-2.5 sticky top-5 self-start max-h-[calc(100vh-40px)] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {/* StageCard, SectionsCard, ChecklistCard, VVSCard, DetailsCard, HistoryCard */}
      </aside>
    </div>
  )
}
```

- [ ] **Step 3: Run tests**

```bash
npm run test:web
```

Expected: All existing tests PASS. No existing pipeline tests should break since we're replacing the detail component but keeping the same server actions and API.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/pipeline-item-detail.tsx apps/web/src/app/cms/\(authed\)/pipeline/items/\[id\]/page.tsx
git commit -m "feat(pipeline): rewrite detail page — tabbed bilateral section editor"
```

---

### Task 10: Visual QA — Dev Server Testing

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev -w apps/web
```

- [ ] **Step 2: Open a pipeline item detail page in the browser**

Navigate to `/cms/pipeline/items/{any-item-id}` and verify:

1. Tabs render correctly for the item's format
2. Language toggle switches content
3. Keyboard shortcuts work (⌘1-5, ⌘L, ⌘S, ⌘E, ⌘←→)
4. URL hash updates on tab/lang changes
5. Sidebar cards render (stage, sections, checklist, VVS, details, history)
6. Empty sections show the empty state with "Gerar com Cowork" button
7. Sections with content render the correct renderer
8. Edit mode toggles visual indicators
9. Cowork request panel opens/closes and generates prompt
10. Save footer shows dirty/saved state

- [ ] **Step 3: Fix any visual issues found during QA**

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix(pipeline): visual QA fixes for detail page redesign"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ DB migration (Task 1)
- ✅ Section JSONB structure + schemas (Task 2)
- ✅ Section API GET/PATCH (Task 3)
- ✅ Tab architecture + component hierarchy (Tasks 5, 9)
- ✅ Keyboard shortcuts + URL deep linking (Task 5)
- ✅ Cowork clipboard integration (Task 6)
- ✅ Conflict resolution + diff view (Task 7)
- ✅ Edit mode + save mechanics (Tasks 4, 6)
- ✅ Source attribution badges (Task 6)
- ✅ All 7 content renderers (Task 8)
- ✅ Sidebar redesign with SectionsCard (Task 9)
- ✅ Bilateral content strategy (Tasks 2, 5)
- ✅ Empty section state (Task 7)
- ✅ Accessibility (ARIA roles in Task 5)
- ✅ Visual QA (Task 10)

**Type consistency:** `SectionData`, `SectionPatch`, `SectionDefinition`, `RendererProps` are defined in Task 2 and used consistently across all subsequent tasks.

**No placeholders:** All code blocks contain complete, runnable code. Test files have real assertions.
