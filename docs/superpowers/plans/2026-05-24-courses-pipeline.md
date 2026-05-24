# Courses Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable course planning, production tracking, and PLF launch integration in the existing pipeline system with zero new database tables.

**Architecture:** Courses are pipeline items (format='course') with enriched JSONB sections (curriculum, lessons, launch) and metadata (product tier, pricing, funnel). Three new renderers (CurriculumRenderer, LessonsRenderer, LaunchRenderer) follow existing patterns (ScriptRenderer for accordion/dnd, DraftRenderer for rich text). Graduation to playlist is optional.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Zod, Tailwind 4, Tiptap, dnd-kit, Vitest, Supabase JSONB

**Spec:** `docs/superpowers/specs/2026-05-24-courses-pipeline-design.md`

---

## Parallelism Map

```
Wave 1 (start immediately, 4 parallel tasks):
  Task 1: Fix "New Item" button
  Task 2: Update sections.ts
  Task 3: Enrich CourseMetadataSchema
  Task 10: Cowork AI docs

Wave 2 (after Tasks 2-3, 4 parallel tasks):
  Task 4: CurriculumRenderer
  Task 5: LaunchRenderer
  Task 6: Kanban card enrichment
  Task 7: PublishRenderer enrichment

Wave 3 (after Task 4, 2 parallel tasks):
  Task 8: LessonsRenderer
  Task 9: Course graduation logic
```

---

### Task 1: Fix "New Item" Button (All Formats)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/create-item-modal.tsx`
- Test: `apps/web/test/cms/create-item-modal.test.tsx`

- [ ] **Step 1: Write test for CreateItemModal**

```typescript
// apps/web/test/cms/create-item-modal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CreateItemModal } from '@/app/cms/(authed)/pipeline/_components/create-item-modal'

describe('CreateItemModal', () => {
  it('renders form fields when open', () => {
    render(<CreateItemModal format="course" open={true} onClose={vi.fn()} />)
    expect(screen.getByLabelText(/título/i)).toBeTruthy()
    expect(screen.getByLabelText(/idioma/i)).toBeTruthy()
  })

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn()
    render(<CreateItemModal format="course" open={true} onClose={onClose} />)
    fireEvent.mouseDown(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render when closed', () => {
    render(<CreateItemModal format="course" open={false} onClose={vi.fn()} />)
    expect(screen.queryByLabelText(/título/i)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/test/cms/create-item-modal.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Create CreateItemModal component**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/_components/create-item-modal.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createPipelineItem } from '../actions'

interface CreateItemModalProps {
  format: string
  open: boolean
  onClose: () => void
}

export function CreateItemModal({ format, open, onClose }: CreateItemModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState<'pt-br' | 'en' | 'both'>('pt-br')

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    startTransition(async () => {
      const titleField = language === 'en' ? 'title_en' : 'title_pt'
      const result = await createPipelineItem({
        format,
        [titleField]: title.trim(),
        language,
        stage: 'idea',
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Item criado')
      setTitle('')
      onClose()
      router.refresh()
    })
  }

  return (
    <div
      data-testid="modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl p-6 space-y-4"
        style={{ background: 'var(--gem-surface)', color: 'var(--gem-text)' }}
      >
        <h2 className="text-lg font-semibold">
          Novo {format.replace('_', ' ')}
        </h2>

        <div>
          <label htmlFor="create-title" className="block text-sm mb-1 opacity-70">
            Título
          </label>
          <input
            id="create-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{
              background: 'var(--gem-well)',
              border: '1px solid var(--gem-border)',
              color: 'var(--gem-text)',
            }}
          />
        </div>

        <div>
          <label htmlFor="create-language" className="block text-sm mb-1 opacity-70">
            Idioma
          </label>
          <select
            id="create-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'pt-br' | 'en' | 'both')}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{
              background: 'var(--gem-well)',
              border: '1px solid var(--gem-border)',
              color: 'var(--gem-text)',
            }}
          >
            <option value="pt-br">Português</option>
            <option value="en">English</option>
            <option value="both">Bilíngue</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg opacity-70 hover:opacity-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending || !title.trim()}
            className="px-4 py-2 text-sm rounded-lg font-medium disabled:opacity-40"
            style={{ background: 'var(--gem-accent)', color: 'white' }}
          >
            {isPending ? 'Criando...' : 'Criar'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/test/cms/create-item-modal.test.tsx`
Expected: PASS

- [ ] **Step 5: Wire modal into FormatBoardPage**

Modify `apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx`:

Add `searchParams` to the page component and pass `showCreate` to PipelineBoard:

```typescript
// Change the component signature from:
export default async function FormatBoardPage({ params }: { params: Promise<{ format: string }> }) {
// To:
export default async function FormatBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ format: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { format } = await params
  const search = await searchParams
  const showCreate = search.action === 'create'
```

Then pass `showCreate` as prop to `PipelineBoard`:

```typescript
// Change:
<PipelineBoard format={format as Format} items={boardItems} />
// To:
<PipelineBoard format={format as Format} items={boardItems} showCreate={showCreate} />
```

- [ ] **Step 6: Add CreateItemModal to PipelineBoard**

In `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-board.tsx`:

Add import at the top:
```typescript
import { CreateItemModal } from './create-item-modal'
```

Add `showCreate` to the component props interface and add state + modal rendering:

```typescript
// Add to props:
showCreate?: boolean

// Inside the component, add state:
const [createOpen, setCreateOpen] = useState(showCreate ?? false)

// Before the closing </> of the component, add:
<CreateItemModal
  format={format}
  open={createOpen}
  onClose={() => {
    setCreateOpen(false)
    router.replace(`/cms/pipeline/${format}`, { scroll: false })
  }}
/>
```

Also change the "New Item" link to a button that sets `createOpen`:

```typescript
// Change the Link at lines 237-244 to:
<button
  onClick={() => setCreateOpen(true)}
  className="text-xs px-3 py-1.5 rounded-lg shrink-0 transition-opacity hover:opacity-80"
  style={{ backgroundColor: 'var(--gem-accent)', color: 'white' }}
>
  + New item
</button>
```

- [ ] **Step 7: Run full pipeline tests**

Run: `npx vitest run apps/web/test/cms/`
Expected: All pipeline tests pass

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/create-item-modal.tsx \
  apps/web/src/app/cms/\(authed\)/pipeline/\[format\]/page.tsx \
  apps/web/src/app/cms/\(authed\)/pipeline/_components/pipeline-board.tsx \
  apps/web/test/cms/create-item-modal.test.tsx
git commit -m "fix(pipeline): wire New Item button with create modal for all formats"
```

---

### Task 2: Update Course Section Definitions

**Files:**
- Modify: `apps/web/src/lib/pipeline/sections.ts`
- Test: `apps/web/test/lib/pipeline-sections.test.ts`

- [ ] **Step 1: Write test for updated course sections**

```typescript
// apps/web/test/lib/pipeline-sections.test.ts
import { describe, it, expect } from 'vitest'
import { SECTION_DEFINITIONS, getSectionsForFormat } from '@/lib/pipeline/sections'

describe('course section definitions', () => {
  const courseSections = getSectionsForFormat('course')

  it('has 6 sections', () => {
    expect(courseSections).toHaveLength(6)
  })

  it('has curriculum as shared', () => {
    const curriculum = courseSections.find((s) => s.key === 'curriculum')
    expect(curriculum).toBeDefined()
    expect(curriculum!.shared).toBe(true)
    expect(curriculum!.type).toBe('curriculum')
  })

  it('has launch as shared', () => {
    const launch = courseSections.find((s) => s.key === 'launch')
    expect(launch).toBeDefined()
    expect(launch!.shared).toBe(true)
    expect(launch!.type).toBe('launch')
  })

  it('has lessons as per-language', () => {
    const lessons = courseSections.find((s) => s.key === 'lessons')
    expect(lessons).toBeDefined()
    expect(lessons!.shared).toBe(false)
  })

  it('sections are ordered: ideia, curriculum, lessons, material, launch, publish', () => {
    const keys = courseSections.map((s) => s.key)
    expect(keys).toEqual(['ideia', 'curriculum', 'lessons', 'material', 'launch', 'publish'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/test/lib/pipeline-sections.test.ts`
Expected: FAIL — curriculum.shared is false, launch not found, length is 5

- [ ] **Step 3: Update course sections in sections.ts**

In `apps/web/src/lib/pipeline/sections.ts`, replace the course section definition (around lines 42-48):

```typescript
// Replace the existing course array with:
course: [
  { key: 'ideia', label_pt: 'Ideia', label_en: 'Idea', type: 'ideia', shared: true },
  { key: 'curriculum', label_pt: 'Currículo', label_en: 'Curriculum', type: 'curriculum', shared: true },
  { key: 'lessons', label_pt: 'Roteiros', label_en: 'Scripts', type: 'lessons', shared: false },
  { key: 'material', label_pt: 'Material', label_en: 'Material', type: 'material', shared: false },
  { key: 'launch', label_pt: 'Lançamento', label_en: 'Launch', type: 'launch', shared: true },
  { key: 'publish', label_pt: 'Publicação', label_en: 'Publication', type: 'publish', shared: false },
],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/test/lib/pipeline-sections.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/sections.ts apps/web/test/lib/pipeline-sections.test.ts
git commit -m "feat(pipeline): update course sections — curriculum/launch shared, add launch section"
```

---

### Task 3: Enrich CourseMetadataSchema

**Files:**
- Modify: `apps/web/src/lib/pipeline/schemas.ts`
- Test: `apps/web/test/lib/pipeline-schemas.test.ts`

- [ ] **Step 1: Write test for enriched schema**

```typescript
// apps/web/test/lib/pipeline-schemas.test.ts
import { describe, it, expect } from 'vitest'
import { CourseMetadataSchema, GraduateSchema } from '@/lib/pipeline/schemas'

describe('CourseMetadataSchema', () => {
  it('accepts minimal empty object', () => {
    expect(CourseMetadataSchema.safeParse({}).success).toBe(true)
  })

  it('accepts full product metadata', () => {
    const result = CourseMetadataSchema.safeParse({
      module_count: 3,
      platform: 'hotmart',
      product_type: 'course',
      tier: 'core',
      pricing_model: 'one_time',
      price_cents: 29700,
      currency: 'BRL',
      funnel_stage: 'bofu',
      topic_clusters: ['ai-fundamentals'],
      launch_type: 'seed',
      difficulty: 'beginner',
    })
    expect(result.success).toBe(true)
  })

  it('accepts upsell/downsell refs', () => {
    const result = CourseMetadataSchema.safeParse({
      upsell_ref: '550e8400-e29b-41d4-a716-446655440000',
      downsell_ref: '550e8400-e29b-41d4-a716-446655440001',
      prerequisite_courses: ['550e8400-e29b-41d4-a716-446655440002'],
    })
    expect(result.success).toBe(true)
  })

  it('accepts playlist_id for graduation', () => {
    const result = CourseMetadataSchema.safeParse({
      playlist_id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown fields (strict)', () => {
    const result = CourseMetadataSchema.safeParse({ bogus_field: 'x' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid tier', () => {
    const result = CourseMetadataSchema.safeParse({ tier: 'mega' })
    expect(result.success).toBe(false)
  })
})

describe('GraduateSchema', () => {
  it('accepts course target', () => {
    const result = GraduateSchema.safeParse({ target: 'course' })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/test/lib/pipeline-schemas.test.ts`
Expected: FAIL — new fields not recognized, 'course' not in GraduateSchema target

- [ ] **Step 3: Update CourseMetadataSchema and GraduateSchema**

In `apps/web/src/lib/pipeline/schemas.ts`, replace the CourseMetadataSchema (lines 37-42):

```typescript
export const CourseMetadataSchema = z.object({
  module_count: z.number().int().positive().optional(),
  lesson_count: z.number().int().positive().optional(),
  estimated_hours: z.number().positive().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  platform: z.enum(['self-hosted', 'hotmart', 'youtube', 'udemy', 'other']).optional(),
  product_type: z.enum(['mini_course', 'course', 'masterclass', 'workshop']).optional(),
  tier: z.enum(['free', 'lead_magnet', 'tripwire', 'core', 'premium']).optional(),
  pricing_model: z.enum(['free', 'one_time', 'subscription', 'cohort', 'pwyw']).optional(),
  price_cents: z.number().int().nonnegative().optional(),
  currency: z.string().min(3).max(3).optional(),
  compare_at_price_cents: z.number().int().nonnegative().optional(),
  funnel_stage: z.enum(['tofu', 'mofu', 'bofu']).optional(),
  topic_clusters: z.array(z.string().min(1)).optional(),
  upsell_ref: z.string().uuid().optional(),
  downsell_ref: z.string().uuid().optional(),
  prerequisite_courses: z.array(z.string().uuid()).optional(),
  launch_type: z.enum(['seed', 'internal', 'jv', 'evergreen']).optional(),
  playlist_id: z.string().uuid().optional(),
}).strict()
```

Also update GraduateSchema (around line 130) to add 'course':

```typescript
export const GraduateSchema = z.object({
  target: z.enum(['blog_post', 'newsletter', 'campaign', 'course']),
  data: z.record(z.unknown()).optional(),
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/test/lib/pipeline-schemas.test.ts`
Expected: PASS

- [ ] **Step 5: Run existing pipeline tests to check for regressions**

Run: `npx vitest run apps/web/test/api/pipeline/`
Expected: All existing tests pass (schema is backward compatible — all new fields optional)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/pipeline/schemas.ts apps/web/test/lib/pipeline-schemas.test.ts
git commit -m "feat(pipeline): enrich CourseMetadataSchema with product/funnel/launch fields"
```

---

### Task 4: CurriculumRenderer

**Files:**
- Create: `apps/web/src/lib/pipeline/course-schemas.ts`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/curriculum-renderer.tsx`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/section-content.tsx`
- Test: `apps/web/test/cms/curriculum-renderer.test.tsx`

**Depends on:** Task 2 (sections.ts), Task 3 (schemas)

- [ ] **Step 1: Create course-schemas.ts with Zod schemas**

```typescript
// apps/web/src/lib/pipeline/course-schemas.ts
import { z } from 'zod'

export const LessonResourceSchema = z.object({
  label: z.string().min(1),
  type: z.enum(['pdf', 'repo', 'link', 'template', 'tool']),
  url: z.string().nullable().default(null),
  media_id: z.string().uuid().nullable().default(null),
})

export const CurriculumLessonSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(['video', 'text', 'quiz', 'exercise', 'pdf', 'live', 'mixed']),
  sort_order: z.number().int().nonnegative(),
  is_preview: z.boolean().default(false),
  estimated_minutes: z.number().int().positive().default(10),
  production_status: z.enum(['outline', 'scripted', 'recorded', 'edited', 'ready']).default('outline'),
  pipeline_ref: z.string().uuid().nullable().default(null),
  resources: z.array(LessonResourceSchema).default([]),
})

export const CurriculumModuleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  sort_order: z.number().int().nonnegative(),
  is_preview: z.boolean().default(false),
  lessons: z.array(CurriculumLessonSchema).default([]),
})

export const CurriculumContentSchema = z.object({
  curriculum_mode: z.enum(['fixed', 'progressive']).default('fixed'),
  target_audience: z.string().default(''),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  estimated_hours: z.number().nonnegative().default(0),
  learning_outcomes: z.array(z.string()).default([]),
  modules: z.array(CurriculumModuleSchema).default([]),
})

export type CurriculumContent = z.infer<typeof CurriculumContentSchema>
export type CurriculumModule = z.infer<typeof CurriculumModuleSchema>
export type CurriculumLesson = z.infer<typeof CurriculumLessonSchema>

const PRODUCTION_ORDER = ['outline', 'scripted', 'recorded', 'edited', 'ready'] as const

export function computeModuleProgress(mod: CurriculumModule): { done: number; total: number } {
  const total = mod.lessons.length
  const done = mod.lessons.filter((l) => l.production_status === 'ready').length
  return { done, total }
}

export function computeCourseProgress(content: CurriculumContent): {
  done: number
  total: number
  byStatus: Record<string, number>
} {
  const allLessons = content.modules.flatMap((m) => m.lessons)
  const total = allLessons.length
  const done = allLessons.filter((l) => l.production_status === 'ready').length
  const byStatus: Record<string, number> = {}
  for (const s of PRODUCTION_ORDER) {
    byStatus[s] = allLessons.filter((l) => l.production_status === s).length
  }
  return { done, total, byStatus }
}

export function generateLessonId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function generateModuleId(): string {
  return Math.random().toString(36).slice(2, 10)
}
```

- [ ] **Step 2: Write test for course-schemas**

```typescript
// apps/web/test/lib/course-schemas.test.ts
import { describe, it, expect } from 'vitest'
import {
  CurriculumContentSchema,
  computeCourseProgress,
  computeModuleProgress,
} from '@/lib/pipeline/course-schemas'

describe('CurriculumContentSchema', () => {
  it('parses empty curriculum', () => {
    const result = CurriculumContentSchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data!.modules).toEqual([])
    expect(result.data!.curriculum_mode).toBe('fixed')
  })

  it('parses full curriculum', () => {
    const result = CurriculumContentSchema.safeParse({
      curriculum_mode: 'progressive',
      target_audience: 'Devs',
      difficulty: 'intermediate',
      estimated_hours: 12,
      learning_outcomes: ['Build RAG systems'],
      modules: [{
        id: 'm1', title: 'Intro', description: '', sort_order: 0, is_preview: true,
        lessons: [{
          id: 'l1', title: 'What is AI', type: 'video', sort_order: 0,
          is_preview: true, estimated_minutes: 15, production_status: 'ready',
          pipeline_ref: null, resources: [],
        }],
      }],
    })
    expect(result.success).toBe(true)
  })
})

describe('computeCourseProgress', () => {
  it('computes correct progress', () => {
    const content = CurriculumContentSchema.parse({
      modules: [{
        id: 'm1', title: 'A', sort_order: 0,
        lessons: [
          { id: 'l1', title: 'a', type: 'video', sort_order: 0, production_status: 'ready' },
          { id: 'l2', title: 'b', type: 'video', sort_order: 1, production_status: 'scripted' },
          { id: 'l3', title: 'c', type: 'video', sort_order: 2, production_status: 'outline' },
        ],
      }],
    })
    const progress = computeCourseProgress(content)
    expect(progress.done).toBe(1)
    expect(progress.total).toBe(3)
    expect(progress.byStatus.ready).toBe(1)
    expect(progress.byStatus.scripted).toBe(1)
    expect(progress.byStatus.outline).toBe(1)
  })
})

describe('computeModuleProgress', () => {
  it('returns done/total for module', () => {
    const mod = CurriculumContentSchema.parse({
      modules: [{ id: 'm1', title: 'A', sort_order: 0, lessons: [
        { id: 'l1', title: 'a', type: 'video', sort_order: 0, production_status: 'ready' },
        { id: 'l2', title: 'b', type: 'video', sort_order: 1, production_status: 'ready' },
      ]}],
    }).modules[0]
    expect(computeModuleProgress(mod)).toEqual({ done: 2, total: 2 })
  })
})
```

- [ ] **Step 3: Run test**

Run: `npx vitest run apps/web/test/lib/course-schemas.test.ts`
Expected: PASS

- [ ] **Step 4: Create CurriculumRenderer component**

Create `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/curriculum-renderer.tsx`.

This is a large component. Follow the ScriptRenderer pattern:
- Parse content with `CurriculumContentSchema.safeParse(content)`, fallback to defaults
- Render course-level fields (target_audience, difficulty, estimated_hours, curriculum_mode, learning_outcomes)
- Render modules as accordion items with drag-and-drop (dnd-kit `SortableContext`)
- Each module expands to show its lessons as a sortable list
- Each lesson shows: title, type badge, production_status badge, estimated_minutes, is_preview, pipeline_ref indicator
- "Add module" and "Add lesson" buttons
- Progress bars per module and total
- All edits call `onContentChange` with the updated curriculum object

Key imports:
```typescript
import type { RendererProps } from '../section-content'
import { CurriculumContentSchema, computeModuleProgress, computeCourseProgress, generateModuleId, generateLessonId, type CurriculumContent, type CurriculumModule } from '@/lib/pipeline/course-schemas'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
```

Component signature:
```typescript
export function CurriculumRenderer({ content, isEditing, onContentChange }: RendererProps)
```

The renderer should be ~300-400 lines following the accordion + sortable pattern from ScriptRenderer/ScriptEditMode.

- [ ] **Step 5: Register CurriculumRenderer in section-content.tsx**

In `apps/web/src/app/cms/(authed)/pipeline/_components/detail/section-content.tsx`:

Add import:
```typescript
import { CurriculumRenderer } from './renderers/curriculum-renderer'
```

Add to REGISTRY object:
```typescript
curriculum: CurriculumRenderer,
```

- [ ] **Step 6: Write component test**

```typescript
// apps/web/test/cms/curriculum-renderer.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CurriculumRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/curriculum-renderer'

describe('CurriculumRenderer', () => {
  const baseProps = {
    content: {
      curriculum_mode: 'fixed',
      target_audience: 'Developers',
      difficulty: 'beginner',
      estimated_hours: 10,
      learning_outcomes: ['Learn AI'],
      modules: [{
        id: 'm1', title: 'Module 1', description: 'First module', sort_order: 0,
        is_preview: false,
        lessons: [{
          id: 'l1', title: 'Lesson 1', type: 'video', sort_order: 0,
          is_preview: false, estimated_minutes: 15, production_status: 'ready',
          pipeline_ref: null, resources: [],
        }],
      }],
    },
    isEditing: false,
    lang: 'shared',
    onContentChange: vi.fn(),
  }

  it('renders module title', () => {
    render(<CurriculumRenderer {...baseProps} />)
    expect(screen.getByText('Module 1')).toBeTruthy()
  })

  it('renders lesson title', () => {
    render(<CurriculumRenderer {...baseProps} />)
    expect(screen.getByText('Lesson 1')).toBeTruthy()
  })

  it('shows progress', () => {
    render(<CurriculumRenderer {...baseProps} />)
    expect(screen.getByText(/1\/1/)).toBeTruthy()
  })
})
```

- [ ] **Step 7: Run all tests**

Run: `npx vitest run apps/web/test/lib/course-schemas.test.ts apps/web/test/cms/curriculum-renderer.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/pipeline/course-schemas.ts \
  apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/curriculum-renderer.tsx \
  apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/section-content.tsx \
  apps/web/test/lib/course-schemas.test.ts \
  apps/web/test/cms/curriculum-renderer.test.tsx
git commit -m "feat(pipeline): add CurriculumRenderer with module/lesson accordion and progress tracking"
```

---

### Task 5: LaunchRenderer

**Files:**
- Create: `apps/web/src/lib/pipeline/launch-schemas.ts`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/launch-renderer.tsx`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/section-content.tsx`
- Test: `apps/web/test/cms/launch-renderer.test.tsx`

**Depends on:** Task 2 (sections.ts)

- [ ] **Step 1: Create launch-schemas.ts**

```typescript
// apps/web/src/lib/pipeline/launch-schemas.ts
import { z } from 'zod'

export const PlcItemSchema = z.object({
  number: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  title: z.string().default(''),
  theme: z.enum(['opportunity', 'teaching', 'ownership']),
  content_format: z.enum(['video', 'blog', 'email', 'live']).default('video'),
  pipeline_ref: z.string().uuid().nullable().default(null),
  campaign_ref: z.string().uuid().nullable().default(null),
  planned_date: z.string().nullable().default(null),
  status: z.enum(['planned', 'drafted', 'produced', 'published']).default('planned'),
  key_message: z.string().default(''),
  mental_triggers: z.array(z.string()).default([]),
})

export const BonusSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  deadline: z.string().nullable().default(null),
  type: z.enum(['content', 'access', 'tool', 'community', 'coaching']).default('content'),
})

export const MentalTriggersSchema = z.object({
  authority: z.string().nullable().default(null),
  social_proof: z.string().nullable().default(null),
  reciprocity: z.string().nullable().default(null),
  scarcity: z.string().nullable().default(null),
  community: z.string().nullable().default(null),
  anticipation: z.string().nullable().default(null),
})

export const LaunchContentSchema = z.object({
  launch_type: z.enum(['seed', 'internal', 'jv', 'evergreen']).default('seed'),
  plc_sequence: z.array(PlcItemSchema).default([
    { number: 1, title: '', theme: 'opportunity', content_format: 'video', pipeline_ref: null, campaign_ref: null, planned_date: null, status: 'planned', key_message: '', mental_triggers: [] },
    { number: 2, title: '', theme: 'teaching', content_format: 'video', pipeline_ref: null, campaign_ref: null, planned_date: null, status: 'planned', key_message: '', mental_triggers: [] },
    { number: 3, title: '', theme: 'ownership', content_format: 'video', pipeline_ref: null, campaign_ref: null, planned_date: null, status: 'planned', key_message: '', mental_triggers: [] },
  ]),
  cart_open_date: z.string().nullable().default(null),
  cart_close_date: z.string().nullable().default(null),
  early_bird_deadline: z.string().nullable().default(null),
  bonuses: z.array(BonusSchema).default([]),
  email_campaign_id: z.string().uuid().nullable().default(null),
  mental_triggers: MentalTriggersSchema.default({}),
  notes: z.string().default(''),
})

export type LaunchContent = z.infer<typeof LaunchContentSchema>

export const MENTAL_TRIGGER_KEYS = ['authority', 'social_proof', 'reciprocity', 'scarcity', 'community', 'anticipation'] as const

export const TRIGGER_LABELS: Record<string, string> = {
  authority: 'Autoridade',
  social_proof: 'Prova Social',
  reciprocity: 'Reciprocidade',
  scarcity: 'Escassez',
  community: 'Comunidade',
  anticipation: 'Antecipação',
}
```

- [ ] **Step 2: Write test for launch-schemas**

```typescript
// apps/web/test/lib/launch-schemas.test.ts
import { describe, it, expect } from 'vitest'
import { LaunchContentSchema } from '@/lib/pipeline/launch-schemas'

describe('LaunchContentSchema', () => {
  it('parses empty launch with defaults', () => {
    const result = LaunchContentSchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data!.launch_type).toBe('seed')
    expect(result.data!.plc_sequence).toHaveLength(3)
    expect(result.data!.plc_sequence[0].theme).toBe('opportunity')
    expect(result.data!.plc_sequence[1].theme).toBe('teaching')
    expect(result.data!.plc_sequence[2].theme).toBe('ownership')
  })

  it('parses full launch', () => {
    const result = LaunchContentSchema.safeParse({
      launch_type: 'internal',
      cart_open_date: '2026-07-10',
      cart_close_date: '2026-07-17',
      bonuses: [{ title: 'Prompt Library', type: 'content' }],
      mental_triggers: { authority: '10 years of AI experience' },
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 3: Run test**

Run: `npx vitest run apps/web/test/lib/launch-schemas.test.ts`
Expected: PASS

- [ ] **Step 4: Create LaunchRenderer component**

Create `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/launch-renderer.tsx`.

Follow PublishRenderer pattern (timeline + config fields):
- Launch type selector (tabs/buttons)
- PLC sequence as 3 cards in a row with: title, theme badge, status badge, key_message, planned_date, mental_triggers tags
- Cart section with date inputs
- Mental triggers checklist (6 items with text fields)
- Bonuses editable list
- Notes markdown textarea

Key imports:
```typescript
import type { RendererProps } from '../section-content'
import { LaunchContentSchema, MENTAL_TRIGGER_KEYS, TRIGGER_LABELS, type LaunchContent } from '@/lib/pipeline/launch-schemas'
```

Component signature:
```typescript
export function LaunchRenderer({ content, isEditing, onContentChange }: RendererProps)
```

- [ ] **Step 5: Register LaunchRenderer in section-content.tsx**

Add import and registry entry:
```typescript
import { LaunchRenderer } from './renderers/launch-renderer'
// In REGISTRY:
launch: LaunchRenderer,
```

- [ ] **Step 6: Write component test**

```typescript
// apps/web/test/cms/launch-renderer.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LaunchRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/launch-renderer'

describe('LaunchRenderer', () => {
  const baseProps = {
    content: {
      launch_type: 'seed',
      plc_sequence: [
        { number: 1, title: 'The Opportunity', theme: 'opportunity', content_format: 'video', pipeline_ref: null, campaign_ref: null, planned_date: '2026-07-01', status: 'drafted', key_message: 'AI is changing everything', mental_triggers: ['authority'] },
        { number: 2, title: 'The Framework', theme: 'teaching', content_format: 'video', pipeline_ref: null, campaign_ref: null, planned_date: null, status: 'planned', key_message: '', mental_triggers: [] },
        { number: 3, title: 'Ownership', theme: 'ownership', content_format: 'video', pipeline_ref: null, campaign_ref: null, planned_date: null, status: 'planned', key_message: '', mental_triggers: [] },
      ],
      cart_open_date: null,
      cart_close_date: null,
      early_bird_deadline: null,
      bonuses: [],
      email_campaign_id: null,
      mental_triggers: { authority: null, social_proof: null, reciprocity: null, scarcity: null, community: null, anticipation: null },
      notes: '',
    },
    isEditing: false,
    lang: 'shared',
    onContentChange: vi.fn(),
  }

  it('renders PLC titles', () => {
    render(<LaunchRenderer {...baseProps} />)
    expect(screen.getByText('The Opportunity')).toBeTruthy()
  })

  it('renders launch type', () => {
    render(<LaunchRenderer {...baseProps} />)
    expect(screen.getByText(/seed/i)).toBeTruthy()
  })
})
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run apps/web/test/lib/launch-schemas.test.ts apps/web/test/cms/launch-renderer.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/pipeline/launch-schemas.ts \
  apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/launch-renderer.tsx \
  apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/section-content.tsx \
  apps/web/test/lib/launch-schemas.test.ts \
  apps/web/test/cms/launch-renderer.test.tsx
git commit -m "feat(pipeline): add LaunchRenderer with PLF PLC timeline and mental triggers"
```

---

### Task 6: Kanban Card Enrichment for Courses

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/gem-card.tsx`
- Test: `apps/web/test/cms/gem-card-course.test.tsx`

**Depends on:** Task 3 (CourseMetadataSchema), Task 4 (course-schemas.ts for progress computation)

- [ ] **Step 1: Write test for course card enrichment**

```typescript
// apps/web/test/cms/gem-card-course.test.tsx
import { describe, it, expect } from 'vitest'
import { computeCourseCardInfo } from '@/app/cms/(authed)/pipeline/_components/gem-card'

describe('computeCourseCardInfo', () => {
  it('returns null for non-course format', () => {
    expect(computeCourseCardInfo('video', {}, {})).toBeNull()
  })

  it('extracts product info from metadata', () => {
    const info = computeCourseCardInfo('course', { tier: 'core', price_cents: 29700 }, {})
    expect(info).toBeTruthy()
    expect(info!.tier).toBe('core')
    expect(info!.priceLabel).toBe('R$297')
  })

  it('computes progress from curriculum section', () => {
    const sections = {
      curriculum_shared: {
        rev: 1, source: 'user', edited: true, updated_at: new Date().toISOString(),
        content: {
          modules: [{
            id: 'm1', title: 'M1', sort_order: 0,
            lessons: [
              { id: 'l1', title: 'L1', type: 'video', sort_order: 0, production_status: 'ready' },
              { id: 'l2', title: 'L2', type: 'video', sort_order: 1, production_status: 'scripted' },
            ],
          }],
        },
      },
    }
    const info = computeCourseCardInfo('course', {}, sections)
    expect(info!.progress.done).toBe(1)
    expect(info!.progress.total).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/test/cms/gem-card-course.test.tsx`
Expected: FAIL — function not found

- [ ] **Step 3: Add computeCourseCardInfo and card enrichment to gem-card.tsx**

In `apps/web/src/app/cms/(authed)/pipeline/_components/gem-card.tsx`:

Add import:
```typescript
import { CurriculumContentSchema, computeCourseProgress } from '@/lib/pipeline/course-schemas'
```

Add exported helper function:
```typescript
export function computeCourseCardInfo(
  format: string,
  metadata: Record<string, unknown>,
  sections: Record<string, unknown>,
): { tier: string | null; priceLabel: string | null; progress: { done: number; total: number; byStatus: Record<string, number> }; moduleCount: number; lessonCount: number; launchType: string | null } | null {
  if (format !== 'course') return null

  const tier = (metadata.tier as string) || null
  const priceCents = metadata.price_cents as number | undefined
  const priceLabel = priceCents ? `R$${Math.floor(priceCents / 100)}` : null
  const launchType = (metadata.launch_type as string) || null

  const currSection = sections.curriculum_shared as { content?: unknown } | undefined
  const parsed = CurriculumContentSchema.safeParse(currSection?.content ?? {})
  const curriculum = parsed.success ? parsed.data : CurriculumContentSchema.parse({})

  const progress = computeCourseProgress(curriculum)
  const moduleCount = curriculum.modules.length
  const lessonCount = curriculum.modules.reduce((sum, m) => sum + m.lessons.length, 0)

  return { tier, priceLabel, progress, moduleCount, lessonCount, launchType }
}
```

Then in the GemCard component render, add conditional course enrichment after the title section. This requires the card to receive `format_metadata` and `sections` as additional data — either via expanding `GemCardItem` interface or computing in the parent. The simplest approach: add `format_metadata` and `sections` to `GemCardItem`:

```typescript
// Add to GemCardItem interface:
format_metadata?: Record<string, unknown>
sections?: Record<string, unknown>
```

Then in the card JSX, after the title and before the footer, add:

```typescript
{format === 'course' && (() => {
  const courseInfo = computeCourseCardInfo(format, item.format_metadata ?? {}, item.sections ?? {})
  if (!courseInfo) return null
  return (
    <div className="px-3 pb-2 space-y-1.5">
      {/* Module/lesson count + tier badge */}
      <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--gem-muted)' }}>
        <span>{courseInfo.moduleCount} módulos · {courseInfo.lessonCount} aulas</span>
        {courseInfo.tier && courseInfo.priceLabel && (
          <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--gem-well)', fontSize: '9px' }}>
            {courseInfo.tier} {courseInfo.priceLabel}
          </span>
        )}
      </div>
      {/* Progress bar */}
      {courseInfo.progress.total > 0 && (
        <div>
          <div className="flex justify-between text-[9px] mb-0.5" style={{ color: 'var(--gem-dim)' }}>
            <span>Produção</span>
            <span>{courseInfo.progress.done}/{courseInfo.progress.total}</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--gem-well)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(courseInfo.progress.done / courseInfo.progress.total) * 100}%`,
                background: courseInfo.progress.done === courseInfo.progress.total ? 'var(--gem-done)' : 'var(--gem-warn)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
})()}
```

- [ ] **Step 4: Update page.tsx to pass format_metadata and sections to board items**

In `apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx`, update the select query to include `format_metadata` and `sections`, and include them in the boardItems mapping.

- [ ] **Step 5: Run tests**

Run: `npx vitest run apps/web/test/cms/gem-card-course.test.tsx apps/web/test/cms/pipeline-board.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/gem-card.tsx \
  apps/web/src/app/cms/\(authed\)/pipeline/\[format\]/page.tsx \
  apps/web/test/cms/gem-card-course.test.tsx
git commit -m "feat(pipeline): enrich kanban card for courses with progress bar and tier badge"
```

---

### Task 7: Enrich PublishRenderer for Courses

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/publish-renderer.tsx`
- Test: `apps/web/test/cms/publish-renderer-course.test.tsx`

**Depends on:** Task 2 (sections.ts)

- [ ] **Step 1: Write test for course-specific publish fields**

```typescript
// apps/web/test/cms/publish-renderer-course.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublishRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/publish-renderer'

describe('PublishRenderer for courses', () => {
  it('renders sales copy fields when format is course', () => {
    render(
      <PublishRenderer
        content={{
          headline: 'Domine IA em 12 semanas',
          bullet_points: ['Framework testado'],
          platform: 'hotmart',
        }}
        isEditing={false}
        lang="pt"
        format="course"
        onContentChange={vi.fn()}
      />
    )
    expect(screen.getByText('Domine IA em 12 semanas')).toBeTruthy()
    expect(screen.getByText('Framework testado')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Add course-specific sections to PublishRenderer**

In the PublishRenderer component, check `format === 'course'` and render additional sections:
- Headline + subheadline
- Bullet points (editable list)
- Testimonials (add/remove cards with name, text, result)
- FAQ (accordion with add/remove)
- CTA text + guarantee
- Platform selector + URLs

Follow existing patterns in the file for editable lists and contentEditable divs.

- [ ] **Step 3: Run test**

Run: `npx vitest run apps/web/test/cms/publish-renderer-course.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/publish-renderer.tsx \
  apps/web/test/cms/publish-renderer-course.test.tsx
git commit -m "feat(pipeline): enrich PublishRenderer with sales copy fields for courses"
```

---

### Task 8: LessonsRenderer

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/lessons-renderer.tsx`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/section-content.tsx`
- Test: `apps/web/test/cms/lessons-renderer.test.tsx`

**Depends on:** Task 4 (CurriculumRenderer, course-schemas.ts)

- [ ] **Step 1: Write test for LessonsRenderer**

```typescript
// apps/web/test/cms/lessons-renderer.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LessonsRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/lessons-renderer'

describe('LessonsRenderer', () => {
  const baseProps = {
    content: {
      l1: {
        talking_points: ['Point A', 'Point B'],
        script: 'This is the script for lesson 1',
        production_notes: 'Use lapel mic',
        recording_date: null,
        actual_duration_seconds: null,
        equipment_notes: null,
      },
    },
    isEditing: false,
    lang: 'pt',
    onContentChange: vi.fn(),
  }

  it('renders lesson script content', () => {
    render(<LessonsRenderer {...baseProps} />)
    expect(screen.getByText(/Point A/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Create LessonsRenderer component**

Create `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/lessons-renderer.tsx`.

Pattern: DraftRenderer with sidebar navigation.
- Left sidebar: lesson list grouped by module (reads from curriculum_shared via sibling section)
  - Since the renderer receives only its own section content, the sidebar shows lesson IDs as keys
  - Each lesson key is clickable, shows status indicator
- Right panel: selected lesson editor with:
  - Talking points as editable bullet list
  - Script as Tiptap PipelineEditor (compact preset)
  - Production notes, recording_date, equipment_notes fields
  - production_status dropdown
- State: `selectedLessonId` tracks current lesson

Key imports:
```typescript
import type { RendererProps } from '../section-content'
import { PipelineEditor } from '../editors/pipeline-editor'
```

- [ ] **Step 3: Register LessonsRenderer in section-content.tsx**

Add import and registry entry:
```typescript
import { LessonsRenderer } from './renderers/lessons-renderer'
// In REGISTRY:
lessons: LessonsRenderer,
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run apps/web/test/cms/lessons-renderer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/lessons-renderer.tsx \
  apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/section-content.tsx \
  apps/web/test/cms/lessons-renderer.test.tsx
git commit -m "feat(pipeline): add LessonsRenderer with sidebar navigation and per-lesson script editor"
```

---

### Task 9: Course Graduation Logic

**Files:**
- Modify: `apps/web/src/app/api/pipeline/items/[id]/graduate/route.ts`
- Test: `apps/web/test/api/pipeline/course-graduation.test.ts`

**Depends on:** Task 3 (GraduateSchema with 'course' target)

- [ ] **Step 1: Write test for course graduation**

```typescript
// apps/web/test/api/pipeline/course-graduation.test.ts
import { describe, it, expect } from 'vitest'
import { GraduateSchema } from '@/lib/pipeline/schemas'
import { CurriculumContentSchema } from '@/lib/pipeline/course-schemas'

describe('course graduation schema validation', () => {
  it('accepts course as graduation target', () => {
    const result = GraduateSchema.safeParse({ target: 'course' })
    expect(result.success).toBe(true)
  })

  it('curriculum with ready lessons is graduation-eligible', () => {
    const curriculum = CurriculumContentSchema.parse({
      modules: [{
        id: 'm1', title: 'M1', sort_order: 0,
        lessons: [
          { id: 'l1', title: 'L1', type: 'video', sort_order: 0, production_status: 'ready' },
          { id: 'l2', title: 'L2', type: 'video', sort_order: 1, production_status: 'ready' },
        ],
      }],
    })
    const eligibleModules = curriculum.modules.filter((m) =>
      m.lessons.length > 0 && m.lessons.every((l) => l.production_status === 'ready')
    )
    expect(eligibleModules).toHaveLength(1)
  })

  it('modules with non-ready lessons are not eligible', () => {
    const curriculum = CurriculumContentSchema.parse({
      modules: [{
        id: 'm1', title: 'M1', sort_order: 0,
        lessons: [
          { id: 'l1', title: 'L1', type: 'video', sort_order: 0, production_status: 'ready' },
          { id: 'l2', title: 'L2', type: 'video', sort_order: 1, production_status: 'scripted' },
        ],
      }],
    })
    const eligibleModules = curriculum.modules.filter((m) =>
      m.lessons.length > 0 && m.lessons.every((l) => l.production_status === 'ready')
    )
    expect(eligibleModules).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test**

Run: `npx vitest run apps/web/test/api/pipeline/course-graduation.test.ts`
Expected: PASS (schema validation tests — graduation logic tested separately)

- [ ] **Step 3: Add course graduation case to graduate route**

In `apps/web/src/app/api/pipeline/items/[id]/graduate/route.ts`, add a course graduation block after the campaign block and before the update section.

Add import:
```typescript
import { CurriculumContentSchema } from '@/lib/pipeline/course-schemas'
```

Update the `fkMap` to include course:
```typescript
const fkMap = {
  blog_post: 'blog_post_id',
  newsletter: 'newsletter_edition_id',
  campaign: 'campaign_id',
  course: 'playlist_id',  // course graduates to playlist, stored in format_metadata
} as const
```

For course graduation, the logic differs because we create a playlist, not a row in a content table. Add a course-specific block:

```typescript
if (target === 'course') {
  // Read curriculum from sections
  const currSection = item.sections?.curriculum_shared as { content?: unknown } | undefined
  const parsed = CurriculumContentSchema.safeParse(currSection?.content ?? {})
  if (!parsed.success) {
    return pipelineError('INVALID_OPERATION', 'No valid curriculum found', 422, auth)
  }
  const curriculum = parsed.data
  const eligibleModules = curriculum.modules.filter((m) =>
    m.lessons.length > 0 && m.lessons.every((l) => l.production_status === 'ready')
  )
  if (eligibleModules.length === 0) {
    return pipelineError('INVALID_OPERATION', 'No modules with all lessons ready', 422, auth)
  }

  // Check existing playlist
  const existingPlaylistId = (item.format_metadata as Record<string, unknown>)?.playlist_id as string | undefined

  let playlistId: string

  if (existingPlaylistId) {
    playlistId = existingPlaylistId
  } else {
    // Create playlist
    const slug = (item.code || title.toLowerCase().replace(/[^a-z0-9]+/g, '-')).slice(0, 200)
    const { data: playlist, error } = await supabase
      .from('playlists')
      .insert({
        site_id: auth.siteId,
        name_pt: item.title_pt,
        name_en: item.title_en,
        slug,
        category: 'course',
        status: 'draft',
      })
      .select('id')
      .single()
    if (error || !playlist) {
      return pipelineError('INTERNAL_ERROR', 'Failed to create course playlist', 500, auth)
    }
    playlistId = playlist.id
  }

  // Add items for eligible modules
  for (const mod of eligibleModules) {
    const sortedLessons = [...mod.lessons].sort((a, b) => a.sort_order - b.sort_order)
    const insertedItemIds: string[] = []

    for (const lesson of sortedLessons) {
      const { data: playlistItem } = await supabase
        .from('playlist_items')
        .insert({
          playlist_id: playlistId,
          pipeline_id: lesson.pipeline_ref || item.id,
          sort_order: mod.sort_order * 1000 + lesson.sort_order,
        })
        .select('id')
        .single()
      if (playlistItem) insertedItemIds.push(playlistItem.id)
    }

    // Create sequence edges between consecutive lessons
    for (let i = 1; i < insertedItemIds.length; i++) {
      await supabase.from('playlist_edges').insert({
        playlist_id: playlistId,
        source_item_id: insertedItemIds[i - 1],
        target_item_id: insertedItemIds[i],
        edge_type: 'sequence',
      })
    }
  }

  // Update format_metadata with playlist_id
  const updatedMetadata = { ...(item.format_metadata as Record<string, unknown>), playlist_id: playlistId }
  await supabase.from('content_pipeline').update({ format_metadata: updatedMetadata }).eq('id', id)

  entityId = playlistId
  fkField = null // No FK column — stored in format_metadata
}
```

Adjust the final update block to skip FK update when `fkField` is null:

```typescript
if (entityId) {
  if (fkField) {
    await supabase.from('content_pipeline').update({ [fkField]: entityId }).eq('id', id)
  }
  await supabase.from('content_pipeline_history').insert({
    pipeline_id: id,
    event_type: 'graduated',
    to_value: `${target}:${entityId}`,
  })
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run apps/web/test/api/pipeline/`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/pipeline/items/\[id\]/graduate/route.ts \
  apps/web/test/api/pipeline/course-graduation.test.ts
git commit -m "feat(pipeline): add course graduation to playlist with sequence edges"
```

---

### Task 10: Cowork AI Documentation

**Files:**
- Create: `apps/web/data/pipeline-docs/cowork-docs-course.md`
- Modify: `apps/web/src/lib/pipeline/api-registry.ts` (if course domain needs registration)

**No dependencies — can start in Wave 1**

- [ ] **Step 1: Create cowork-docs-course.md**

```markdown
# Cowork Docs: Course Domain

## Sections

### curriculum_shared
**Input context:** ideia_shared (premise, body, target audience)
**Output schema:** CurriculumContentSchema (see course-schemas.ts)

When generating curriculum:
- Create 3-5 modules with 3-5 lessons each
- Set estimated_minutes per lesson (10-30 min for video, 5-10 for text/quiz)
- Set difficulty based on ideia content
- Generate 3-5 learning outcomes
- All lessons start with production_status: 'outline'
- Mark module 1 as is_preview: true
- Mark lesson 1.1 as is_preview: true

### lessons_pt | lessons_en
**Input context:** curriculum_shared (module/lesson structure) + ideia_shared
**Output schema:** Record<lesson_id, LessonScript>

When generating lesson scripts:
- Generate talking_points (5-8 bullet points per lesson)
- Generate script as markdown with headers per topic
- Include production_notes with recording suggestions
- Reference the lesson title and module context
- Keep estimated speaking time close to estimated_minutes

### launch_shared
**Input context:** ideia_shared + curriculum_shared + format_metadata (pricing, tier)
**Output schema:** LaunchContentSchema (see launch-schemas.ts)

When generating launch plan:
- Set launch_type based on audience size (no audience → seed, existing list → internal)
- PLC1 theme: opportunity — hook with the big promise
- PLC2 theme: teaching — deliver real value, show framework
- PLC3 theme: ownership — address objections, show what's inside
- Space PLCs 3 days apart
- Cart open 3 days after PLC3, close 7 days after open
- Suggest 2-3 bonuses with deadlines (first 48h for fast-action bonus)
- Fill mental_triggers based on creator's assets

### publish_pt | publish_en
**Input context:** ideia_shared + curriculum_shared + launch_shared (testimonials, social proof)
**Output schema:** Course publish section

When generating sales copy:
- Headline: max 10 words, benefit-focused
- Subheadline: clarify the how
- 5-7 bullet points with specific outcomes
- 4-6 FAQ items addressing common objections
- CTA: action-oriented, specific
- Guarantee: 30-day standard unless specified otherwise
```

- [ ] **Step 2: Verify pipeline docs structure**

Run: `ls apps/web/data/pipeline-docs/`
Expected: See existing cowork-docs files. Verify naming convention matches.

- [ ] **Step 3: Commit**

```bash
git add apps/web/data/pipeline-docs/cowork-docs-course.md
git commit -m "docs(pipeline): add Cowork AI prompts for course sections"
```

---

## Summary

| Task | Description | Wave | Effort |
|------|-------------|------|--------|
| 1 | Fix "New Item" button | 1 | ~2h |
| 2 | Update sections.ts | 1 | ~30min |
| 3 | Enrich CourseMetadataSchema | 1 | ~1h |
| 4 | CurriculumRenderer | 2 | ~6h |
| 5 | LaunchRenderer | 2 | ~4h |
| 6 | Kanban card enrichment | 2 | ~2h |
| 7 | PublishRenderer enrichment | 2 | ~2h |
| 8 | LessonsRenderer | 3 | ~4h |
| 9 | Course graduation logic | 3 | ~3h |
| 10 | Cowork AI docs | 1 | ~1h |

**Total: ~25.5h across 3 waves with maximum parallelism.**
