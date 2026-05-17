# A/B Lab C+ (Title, Description & Combo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing thumbnail-only A/B Lab to support title testing, description testing, and combo packages (thumb+title+desc as atomic variant slots), plus expose test data via Pipeline API for Cowork.

**Architecture:** The existing ABBA rotation engine and Bayesian statistics are already element-agnostic. This extension adds: (1) a `test_type` discriminator + text fields on existing tables, (2) a template engine for `{{link:name}}` in descriptions, (3) a `updateVideoMetadata` YouTube API helper, (4) type-aware dispatch in the rotation cron, (5) wizard UI extensions for text variants, (6) Pipeline API endpoints.

**Tech Stack:** Next.js 15, React 19, Supabase (PostgreSQL 17), YouTube Data API v3, Links Engine, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-17-ab-lab-title-desc-design.md`

---

## File Structure

```
New files:
  supabase/migrations/YYYYMMDDNNNNNN_ab_lab_title_desc.sql
  apps/web/src/lib/youtube/ab-templates.ts
  apps/web/src/lib/youtube/ab-metadata.ts
  apps/web/src/app/api/pipeline/youtube/ab-tests/route.ts
  apps/web/src/app/api/pipeline/youtube/ab-tests/[id]/route.ts
  apps/web/src/app/api/pipeline/youtube/ab-tests/[id]/funnel/route.ts
  apps/web/src/app/api/pipeline/youtube/ab-performance/route.ts
  apps/web/test/ab-templates.test.ts
  apps/web/test/ab-metadata.test.ts
  apps/web/test/ab-pipeline.test.ts

Modified files:
  apps/web/src/lib/youtube/ab-types.ts
  apps/web/src/lib/youtube/ab-youtube.ts
  apps/web/src/app/api/cron/ab-rotate/route.ts
  apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts
  apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard.tsx
  apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard.tsx
  apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-test-detail.tsx
  apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-variant-card.tsx
  apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-test-card.tsx

Unchanged (already element-agnostic):
  apps/web/src/lib/youtube/ab-rotation.ts
  apps/web/src/lib/youtube/ab-statistics.ts
  apps/web/src/app/api/cron/ab-evaluate/route.ts
  apps/web/src/app/api/cron/ab-backfill/route.ts
```

**Dependency graph:**

```
Task 1 (migration)
  └─► Task 2 (types)
        ├─► Task 3 (template engine + tests)
        ├─► Task 4 (YouTube metadata helper + tests)
        ├─► Task 5 (pipeline API endpoints + tests)
        └─► after 3+4:
              ├─► Task 6 (rotation cron dispatch)
              ├─► Task 7 (server actions extension)
              │     └─► Task 8 (wizard UI extensions)
              │     └─► Task 9 (detail page + variant card extensions)
              └─► Task 10 (dashboard UI extensions)
```

**Parallelism:** Tasks 3, 4, 5 are fully independent. Tasks 6, 7, 10 can run in parallel after 3+4 complete. Tasks 8, 9 depend on 7.

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/YYYYMMDDNNNNNN_ab_lab_title_desc.sql` (via `npm run db:new`)

- [ ] **Step 1: Generate migration file**

```bash
npm run db:new ab_lab_title_desc
```

- [ ] **Step 2: Write the migration SQL**

```sql
BEGIN;

-- ══ 1. ab_tests: add test_type + original metadata ══

ALTER TABLE public.ab_tests
  ADD COLUMN IF NOT EXISTS test_type TEXT NOT NULL DEFAULT 'thumbnail'
    CHECK (test_type IN ('thumbnail', 'title', 'description', 'combo')),
  ADD COLUMN IF NOT EXISTS original_title TEXT,
  ADD COLUMN IF NOT EXISTS original_description TEXT;

COMMENT ON COLUMN public.ab_tests.test_type IS 'Discriminator: thumbnail|title|description|combo';
COMMENT ON COLUMN public.ab_tests.original_title IS 'Captured from YouTube on test creation';
COMMENT ON COLUMN public.ab_tests.original_description IS 'Captured from YouTube on test creation';

-- ══ 2. ab_test_variants: add text fields + metadata ══

ALTER TABLE public.ab_test_variants
  ADD COLUMN IF NOT EXISTS title_text TEXT,
  ADD COLUMN IF NOT EXISTS description_text TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN public.ab_test_variants.title_text IS 'Title for this variant (null = use original)';
COMMENT ON COLUMN public.ab_test_variants.description_text IS 'Description template with {{link:name}} placeholders';
COMMENT ON COLUMN public.ab_test_variants.metadata IS 'Cowork-facing metadata: thumbnail_tags, title_pattern, emotional_triggers, visual_description';

-- ══ 3. ab_test_cycles: add applied_metadata ══

ALTER TABLE public.ab_test_cycles
  ADD COLUMN IF NOT EXISTS applied_metadata JSONB;

COMMENT ON COLUMN public.ab_test_cycles.applied_metadata IS 'Records what was actually set on YouTube for this cycle';

-- ══ 4. ab_test_tracked_links: maps {{link:name}} → tracked short code per variant ══

CREATE TABLE IF NOT EXISTS public.ab_test_tracked_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ab_test_id UUID NOT NULL REFERENCES public.ab_tests(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.ab_test_variants(id) ON DELETE CASCADE,
  link_id UUID NOT NULL REFERENCES public.tracked_links(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  short_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ab_test_id, variant_id, template_name)
);

-- RLS for ab_test_tracked_links
ALTER TABLE public.ab_test_tracked_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ab_test_tracked_links_select_staff" ON public.ab_test_tracked_links;
CREATE POLICY "ab_test_tracked_links_select_staff" ON public.ab_test_tracked_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ab_tests t
      WHERE t.id = ab_test_tracked_links.ab_test_id
        AND public.can_view_site(t.site_id)
    )
  );

DROP POLICY IF EXISTS "ab_test_tracked_links_insert_staff" ON public.ab_test_tracked_links;
CREATE POLICY "ab_test_tracked_links_insert_staff" ON public.ab_test_tracked_links
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ab_tests t
      WHERE t.id = ab_test_tracked_links.ab_test_id
        AND public.can_edit_site(t.site_id)
    )
  );

DROP POLICY IF EXISTS "ab_test_tracked_links_delete_staff" ON public.ab_test_tracked_links;
CREATE POLICY "ab_test_tracked_links_delete_staff" ON public.ab_test_tracked_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.ab_tests t
      WHERE t.id = ab_test_tracked_links.ab_test_id
        AND public.can_edit_site(t.site_id)
    )
  );

-- ══ 5. Update rotation_pattern CHECK to include 'random' ══

ALTER TABLE public.ab_tests
  DROP CONSTRAINT IF EXISTS ab_tests_config_rotation_pattern_check;

-- The rotation_pattern lives inside the config JSONB, so no column-level CHECK needed.
-- If there's a trigger or function validating it, we'd update there. Otherwise, validation
-- is handled at the application layer (AbTestConfig type).

COMMIT;
```

- [ ] **Step 3: Push to production**

```bash
npm run db:push:prod
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit --no-verify -m "feat(ab-lab): migration for title/desc/combo test support"
```

---

### Task 2: Type Extensions

**Files:**
- Modify: `apps/web/src/lib/youtube/ab-types.ts`

- [ ] **Step 1: Add TestType and extend AbTestConfig**

Add `TestType` type and extend `rotation_pattern` to include `'random'`:

```typescript
export type TestType = 'thumbnail' | 'title' | 'description' | 'combo'
```

Update `AbTestConfig`:
```typescript
export interface AbTestConfig {
  max_duration_days: number
  confidence_threshold: number
  burn_in_days: number
  auto_apply_winner: boolean
  rotation_pattern: 'abba' | 'round_robin' | 'random'
  stability_threshold: number
}
```

- [ ] **Step 2: Extend AbTestRow**

Add after `original_thumbnail_url`:
```typescript
  test_type: TestType
  original_title: string | null
  original_description: string | null
```

- [ ] **Step 3: Extend AbTestVariantRow**

Add after `dimensions`:
```typescript
  title_text: string | null
  description_text: string | null
  metadata: VariantMetadata
```

Add new interface:
```typescript
export interface VariantMetadata {
  thumbnail_tags?: string[]
  title_pattern?: string
  emotional_triggers?: string[]
  visual_description?: string
}
```

- [ ] **Step 4: Extend AbTestCycleRow**

Add after `created_at`:
```typescript
  applied_metadata: AppliedMetadata | null
```

Add new interface:
```typescript
export interface AppliedMetadata {
  thumbnail_set?: boolean
  title_set?: string | null
  description_set?: string | null
  links_resolved?: Record<string, string>
}
```

- [ ] **Step 5: Add AbTestTrackedLinkRow**

```typescript
export interface AbTestTrackedLinkRow {
  id: string
  ab_test_id: string
  variant_id: string
  link_id: string
  template_name: string
  short_code: string
  created_at: string
}
```

- [ ] **Step 6: Extend AbTestCreateInput**

```typescript
export interface AbTestCreateInput {
  site_id: string
  youtube_video_id: string
  name: string
  test_type?: TestType
  config?: Partial<AbTestConfig>
}
```

- [ ] **Step 7: Add CreateTextVariantInput**

```typescript
export interface CreateTextVariantInput {
  test_id: string
  label?: string
  title_text?: string
  description_text?: string
  metadata?: Partial<VariantMetadata>
}
```

- [ ] **Step 8: Extend VariantStats**

Add to the existing interface:
```typescript
  title_text: string | null
  description_text: string | null
  metadata: VariantMetadata
```

- [ ] **Step 9: Run existing tests to ensure no regressions**

```bash
cd apps/web && npx vitest run test/ab-statistics.test.ts test/ab-rotation.test.ts test/ab-config.test.ts test/ab-youtube.test.ts
```

All should pass (interfaces expanded, not changed).

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/lib/youtube/ab-types.ts
git commit --no-verify -m "feat(ab-lab): extend types for title/desc/combo testing"
```

---

### Task 3: Template Engine (`{{link:name}}`)

**Files:**
- Create: `apps/web/src/lib/youtube/ab-templates.ts`
- Create: `apps/web/test/ab-templates.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/ab-templates.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseTemplateTokens, resolveTemplates } from '@/lib/youtube/ab-templates'

describe('parseTemplateTokens', () => {
  it('extracts unique template names from text', () => {
    const text = '📩 Newsletter: {{link:newsletter}}\n🎓 Curso: {{link:curso}}'
    const result = parseTemplateTokens(text)
    expect(result).toEqual(['newsletter', 'curso'])
  })

  it('returns empty array for text without templates', () => {
    expect(parseTemplateTokens('plain text')).toEqual([])
  })

  it('deduplicates repeated template names', () => {
    const text = '{{link:news}} and {{link:news}} again'
    expect(parseTemplateTokens(text)).toEqual(['news'])
  })

  it('handles edge cases: empty string, only whitespace', () => {
    expect(parseTemplateTokens('')).toEqual([])
    expect(parseTemplateTokens('   ')).toEqual([])
  })

  it('ignores malformed templates', () => {
    const text = '{{link:}} and {{link}} and {{ link:foo }}'
    expect(parseTemplateTokens(text)).toEqual([])
  })
})

describe('resolveTemplates', () => {
  it('replaces template tokens with resolved URLs', () => {
    const text = '📩 Newsletter: {{link:newsletter}}\n🎓 Curso: {{link:curso}}'
    const linkMap = {
      newsletter: 'go.bythiagofigueiredo.com/news-b',
      curso: 'go.bythiagofigueiredo.com/curso-b',
    }
    const result = resolveTemplates(text, linkMap)
    expect(result).toBe('📩 Newsletter: go.bythiagofigueiredo.com/news-b\n🎓 Curso: go.bythiagofigueiredo.com/curso-b')
  })

  it('leaves unresolved templates as-is', () => {
    const text = '{{link:known}} and {{link:unknown}}'
    const linkMap = { known: 'go.example.com/abc' }
    const result = resolveTemplates(text, linkMap)
    expect(result).toBe('go.example.com/abc and {{link:unknown}}')
  })

  it('returns original text when linkMap is empty', () => {
    const text = 'No links here'
    expect(resolveTemplates(text, {})).toBe('No links here')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && npx vitest run test/ab-templates.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the template engine**

Create `apps/web/src/lib/youtube/ab-templates.ts`:

```typescript
const TEMPLATE_REGEX = /\{\{link:([a-zA-Z0-9_-]+)\}\}/g

export function parseTemplateTokens(text: string): string[] {
  if (!text.trim()) return []
  const names = new Set<string>()
  let match: RegExpExecArray | null
  const regex = new RegExp(TEMPLATE_REGEX.source, 'g')
  while ((match = regex.exec(text)) !== null) {
    names.add(match[1])
  }
  return Array.from(names)
}

export function resolveTemplates(
  text: string,
  linkMap: Record<string, string>,
): string {
  return text.replace(TEMPLATE_REGEX, (full, name: string) => {
    return linkMap[name] ?? full
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && npx vitest run test/ab-templates.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/ab-templates.ts apps/web/test/ab-templates.test.ts
git commit --no-verify -m "feat(ab-lab): template engine for {{link:name}} in descriptions"
```

---

### Task 4: YouTube Metadata Helper

**Files:**
- Create: `apps/web/src/lib/youtube/ab-metadata.ts`
- Create: `apps/web/test/ab-metadata.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/ab-metadata.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('YouTube metadata helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('updateVideoMetadata', () => {
    it('fetches current snippet then updates with new title', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [{
              id: 'V1',
              snippet: { title: 'Old Title', description: 'Desc', categoryId: '22', tags: ['a'] },
            }],
          }),
        })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      vi.stubGlobal('fetch', mockFetch)

      const mod = await import('@/lib/youtube/ab-metadata')
      await mod.updateVideoMetadata('V1', 'New Title', null, 'TOKEN')

      expect(mockFetch).toHaveBeenCalledTimes(2)
      const updateBody = JSON.parse(mockFetch.mock.calls[1][1].body)
      expect(updateBody.snippet.title).toBe('New Title')
      expect(updateBody.snippet.description).toBe('Desc')
      expect(updateBody.snippet.categoryId).toBe('22')

      vi.unstubAllGlobals()
    })

    it('updates description while preserving title', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [{
              id: 'V1',
              snippet: { title: 'Title', description: 'Old', categoryId: '22', tags: [] },
            }],
          }),
        })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      vi.stubGlobal('fetch', mockFetch)

      const mod = await import('@/lib/youtube/ab-metadata')
      await mod.updateVideoMetadata('V1', null, 'New Desc', 'TOKEN')

      const updateBody = JSON.parse(mockFetch.mock.calls[1][1].body)
      expect(updateBody.snippet.title).toBe('Title')
      expect(updateBody.snippet.description).toBe('New Desc')

      vi.unstubAllGlobals()
    })

    it('updates both title and description atomically', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [{
              id: 'V1',
              snippet: { title: 'Old', description: 'Old', categoryId: '22', tags: [] },
            }],
          }),
        })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      vi.stubGlobal('fetch', mockFetch)

      const mod = await import('@/lib/youtube/ab-metadata')
      await mod.updateVideoMetadata('V1', 'New Title', 'New Desc', 'TOKEN')

      const updateBody = JSON.parse(mockFetch.mock.calls[1][1].body)
      expect(updateBody.snippet.title).toBe('New Title')
      expect(updateBody.snippet.description).toBe('New Desc')

      vi.unstubAllGlobals()
    })

    it('throws when snippet fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: { message: 'forbidden' } }),
      }))

      const mod = await import('@/lib/youtube/ab-metadata')
      await expect(mod.updateVideoMetadata('V1', 'T', null, 'TOKEN'))
        .rejects.toThrow('videos.list failed: 403')

      vi.unstubAllGlobals()
    })

    it('throws when videos.update fails', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [{ id: 'V1', snippet: { title: 'T', description: 'D', categoryId: '22', tags: [] } }],
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: { message: 'bad' } }),
        })
      vi.stubGlobal('fetch', mockFetch)

      const mod = await import('@/lib/youtube/ab-metadata')
      await expect(mod.updateVideoMetadata('V1', 'New', null, 'TOKEN'))
        .rejects.toThrow('videos.update failed: 400')

      vi.unstubAllGlobals()
    })
  })

  describe('captureOriginalMetadata', () => {
    it('returns title and description from YouTube', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          items: [{
            id: 'V1',
            snippet: { title: 'My Video', description: 'Hello World', categoryId: '22', tags: [] },
          }],
        }),
      }))

      const mod = await import('@/lib/youtube/ab-metadata')
      const result = await mod.captureOriginalMetadata('V1', 'TOKEN')
      expect(result).toEqual({ title: 'My Video', description: 'Hello World' })

      vi.unstubAllGlobals()
    })

    it('returns null when video not found', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      }))

      const mod = await import('@/lib/youtube/ab-metadata')
      const result = await mod.captureOriginalMetadata('MISSING', 'TOKEN')
      expect(result).toBeNull()

      vi.unstubAllGlobals()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && npx vitest run test/ab-metadata.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the metadata helper**

Create `apps/web/src/lib/youtube/ab-metadata.ts`:

```typescript
import * as Sentry from '@sentry/nextjs'

export async function updateVideoMetadata(
  videoId: string,
  title: string | null,
  description: string | null,
  accessToken: string,
): Promise<void> {
  const listUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}))
    const msg = `videos.list failed: ${listRes.status}`
    Sentry.captureException(new Error(msg), { extra: { videoId, error: err } })
    throw new Error(msg)
  }

  const listData = await listRes.json()
  const item = listData.items?.[0]
  if (!item) throw new Error(`Video not found: ${videoId}`)

  const snippet = item.snippet
  const updateUrl = 'https://www.googleapis.com/youtube/v3/videos?part=snippet'
  const updateRes = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: videoId,
      snippet: {
        title: title ?? snippet.title,
        description: description ?? snippet.description,
        categoryId: snippet.categoryId,
        tags: snippet.tags ?? [],
      },
    }),
  })

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}))
    const msg = `videos.update failed: ${updateRes.status}`
    Sentry.captureException(new Error(msg), { extra: { videoId, error: err } })
    throw new Error(msg)
  }
}

export async function captureOriginalMetadata(
  videoId: string,
  accessToken: string,
): Promise<{ title: string; description: string } | null> {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null

  const data = await res.json()
  const snippet = data.items?.[0]?.snippet
  if (!snippet) return null

  return { title: snippet.title, description: snippet.description }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && npx vitest run test/ab-metadata.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/ab-metadata.ts apps/web/test/ab-metadata.test.ts
git commit --no-verify -m "feat(ab-lab): YouTube metadata update helper (title/desc)"
```

---

### Task 5: Pipeline API Endpoints

**Files:**
- Create: `apps/web/src/app/api/pipeline/youtube/ab-tests/route.ts`
- Create: `apps/web/src/app/api/pipeline/youtube/ab-tests/[id]/route.ts`
- Create: `apps/web/src/app/api/pipeline/youtube/ab-tests/[id]/funnel/route.ts`
- Create: `apps/web/src/app/api/pipeline/youtube/ab-performance/route.ts`
- Create: `apps/web/test/ab-pipeline.test.ts`

- [ ] **Step 1: Write tests for pipeline auth and response shape**

Create `apps/web/test/ab-pipeline.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/pipeline/helpers', () => ({
  authenticateRead: vi.fn().mockResolvedValue({ ok: true, auth: { siteId: 'site1', permissions: ['read'] } }),
  pipelineError: vi.fn((code, msg, status) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ error: { code, message: msg } }, { status })
  }),
  pipelineSuccess: vi.fn((data, status) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ data }, { status })
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [
              { id: 'test1', name: 'Test 1', test_type: 'title', status: 'active' },
            ],
            error: null,
          })),
        })),
      })),
    })),
  })),
}))

describe('Pipeline AB Tests endpoint', () => {
  it('returns test list with summary stats', async () => {
    const { GET } = await import('@/app/api/pipeline/youtube/ab-tests/route')
    const req = new Request('http://localhost/api/pipeline/youtube/ab-tests', {
      headers: { 'x-pipeline-key': 'test-key' },
    })
    const res = await GET(req as any)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Implement the list endpoint**

Create `apps/web/src/app/api/pipeline/youtube/ab-tests/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { authenticateRead, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const authResult = await authenticateRead(req)
  if (!('ok' in authResult)) return authResult

  const supabase = getSupabaseServiceClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let query = supabase
    .from('ab_tests')
    .select(`
      *,
      variants:ab_test_variants!test_id(id, label, is_original, blob_url, title_text, description_text, metadata, sort_order)
    `)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return pipelineError('DB_ERROR', error.message, 500, authResult.auth)

  return pipelineSuccess(data, 200, authResult.auth)
}
```

- [ ] **Step 3: Implement the detail endpoint**

Create `apps/web/src/app/api/pipeline/youtube/ab-tests/[id]/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { authenticateRead, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await authenticateRead(req)
  if (!('ok' in authResult)) return authResult

  const { id } = await params
  const supabase = getSupabaseServiceClient()

  const { data: test, error } = await supabase
    .from('ab_tests')
    .select(`
      *,
      variants:ab_test_variants!test_id(*),
      cycles:ab_test_cycles!test_id(*),
      tracked_links:ab_test_tracked_links!ab_test_id(*)
    `)
    .eq('id', id)
    .single()

  if (error || !test) return pipelineError('NOT_FOUND', 'Test not found', 404, authResult.auth)

  return pipelineSuccess(test, 200, authResult.auth)
}
```

- [ ] **Step 4: Implement the funnel endpoint**

Create `apps/web/src/app/api/pipeline/youtube/ab-tests/[id]/funnel/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { authenticateRead, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await authenticateRead(req)
  if (!('ok' in authResult)) return authResult

  const { id } = await params
  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, site_id')
    .eq('id', id)
    .single()

  if (!test) return pipelineError('NOT_FOUND', 'Test not found', 404, authResult.auth)

  const { data: trackedLinks } = await supabase
    .from('ab_test_tracked_links')
    .select(`
      *,
      link:tracked_links!link_id(id, code, destination_url)
    `)
    .eq('ab_test_id', id)

  const { data: cycles } = await supabase
    .from('ab_test_cycles')
    .select('variant_id, impressions, clicks')
    .eq('test_id', id)
    .not('impressions', 'is', null)

  const variantImpressions: Record<string, { impressions: number; clicks: number }> = {}
  for (const c of cycles ?? []) {
    const v = variantImpressions[c.variant_id] ?? { impressions: 0, clicks: 0 }
    v.impressions += c.impressions ?? 0
    v.clicks += c.clicks ?? 0
    variantImpressions[c.variant_id] = v
  }

  const linkClicksByCode: Record<string, number> = {}
  if (trackedLinks?.length) {
    const codes = trackedLinks.map((tl: any) => tl.link?.code).filter(Boolean)
    if (codes.length) {
      const { data: clickAggs } = await supabase
        .from('link_click_aggregates')
        .select('link_id, total_clicks')
        .in('link_id', trackedLinks.map((tl: any) => tl.link_id))
      for (const agg of clickAggs ?? []) {
        linkClicksByCode[agg.link_id] = agg.total_clicks ?? 0
      }
    }
  }

  const perVariant = Object.entries(variantImpressions).map(([variantId, stats]) => ({
    variant_id: variantId,
    impressions: stats.impressions,
    clicks: stats.clicks,
    link_clicks: (trackedLinks ?? [])
      .filter((tl: any) => tl.variant_id === variantId)
      .reduce((sum: number, tl: any) => sum + (linkClicksByCode[tl.link_id] ?? 0), 0),
  }))

  const perLink = (trackedLinks ?? []).map((tl: any) => ({
    template_name: tl.template_name,
    variant_id: tl.variant_id,
    short_code: tl.short_code,
    clicks: linkClicksByCode[tl.link_id] ?? 0,
  }))

  return pipelineSuccess({ per_variant: perVariant, per_link: perLink }, 200, authResult.auth)
}
```

- [ ] **Step 5: Implement the cross-test performance endpoint**

Create `apps/web/src/app/api/pipeline/youtube/ab-performance/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { authenticateRead, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const authResult = await authenticateRead(req)
  if (!('ok' in authResult)) return authResult

  const supabase = getSupabaseServiceClient()

  const { data: completedTests } = await supabase
    .from('ab_tests')
    .select(`
      id, name, test_type, confidence_at_completion, result_metadata,
      winner:ab_test_variants!winner_variant_id(id, label, title_text, description_text, metadata)
    `)
    .eq('status', 'completed')
    .not('winner_variant_id', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(50)

  const patterns: Record<string, number> = {}
  const tags: Record<string, { wins: number; tests: number }> = {}

  for (const test of completedTests ?? []) {
    const winner = test.winner as any
    if (!winner) continue

    const meta = winner.metadata ?? {}
    if (meta.title_pattern) {
      patterns[meta.title_pattern] = (patterns[meta.title_pattern] ?? 0) + 1
    }
    for (const tag of meta.thumbnail_tags ?? []) {
      const entry = tags[tag] ?? { wins: 0, tests: 0 }
      entry.wins++
      entry.tests++
      tags[tag] = entry
    }
  }

  return pipelineSuccess({
    completed_tests: completedTests?.length ?? 0,
    winning_patterns: patterns,
    winning_tags: tags,
  }, 200, authResult.auth)
}
```

- [ ] **Step 6: Run tests**

```bash
cd apps/web && npx vitest run test/ab-pipeline.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/pipeline/youtube/ab-tests/ apps/web/src/app/api/pipeline/youtube/ab-performance/ apps/web/test/ab-pipeline.test.ts
git commit --no-verify -m "feat(ab-lab): pipeline API endpoints for Cowork integration"
```

---

### Task 6: Rotation Cron — Type-Aware Dispatch

**Files:**
- Modify: `apps/web/src/app/api/cron/ab-rotate/route.ts`

- [ ] **Step 1: Import new helpers**

Add imports at top:
```typescript
import { updateVideoMetadata } from '@/lib/youtube/ab-metadata'
import { resolveTemplates } from '@/lib/youtube/ab-templates'
import type { AbTestVariantRow, AppliedMetadata } from '@/lib/youtube/ab-types'
```

- [ ] **Step 2: Add type-aware dispatch logic**

Replace the "Apply thumbnail" section (lines 76-79) with type-aware dispatch:

```typescript
      // Apply variant based on test type
      const appliedMeta: AppliedMetadata = {}

      const testType = test.test_type ?? 'thumbnail'

      // Thumbnail: set if blob_url present and type is thumbnail or combo
      if ((testType === 'thumbnail' || testType === 'combo') && nextVariant.blob_url) {
        const { buffer, contentType } = await fetchVariantImageBuffer(nextVariant.blob_url)
        await setThumbnail(video.youtube_video_id, buffer, contentType, accessToken)
        appliedMeta.thumbnail_set = true
      }

      // Title/Description: update via videos.update
      if (testType === 'title' || testType === 'description' || testType === 'combo') {
        let titleToSet: string | null = null
        let descToSet: string | null = null

        if (testType === 'title' || testType === 'combo') {
          titleToSet = nextVariant.title_text ?? test.original_title ?? null
        }
        if (testType === 'description' || testType === 'combo') {
          const rawDesc = nextVariant.description_text ?? test.original_description ?? null
          if (rawDesc) {
            // Resolve {{link:name}} templates
            const { data: linkMappings } = await supabase
              .from('ab_test_tracked_links')
              .select('template_name, short_code')
              .eq('variant_id', nextVariant.id)

            const linkMap: Record<string, string> = {}
            const shortDomain = process.env.LINKS_SHORT_DOMAIN ?? 'go.bythiagofigueiredo.com'
            for (const lm of linkMappings ?? []) {
              linkMap[lm.template_name] = `${shortDomain}/${lm.short_code}`
            }
            descToSet = resolveTemplates(rawDesc, linkMap)
            appliedMeta.links_resolved = linkMap
          }
        }

        if (titleToSet || descToSet) {
          await updateVideoMetadata(video.youtube_video_id, titleToSet, descToSet, accessToken)
          appliedMeta.title_set = titleToSet
          appliedMeta.description_set = descToSet
        }
      }
```

- [ ] **Step 3: Store applied_metadata on cycle insert**

Update the cycle insert to include `applied_metadata`:

```typescript
      await supabase.from('ab_test_cycles').insert({
        test_id: test.id,
        variant_id: nextVariant.id,
        cycle_number: nextCycle,
        started_at: new Date().toISOString(),
        applied_metadata: Object.keys(appliedMeta).length ? appliedMeta : null,
      })
```

- [ ] **Step 4: Run existing rotation tests**

```bash
cd apps/web && npx vitest run test/ab-rotation.test.ts
```

Expected: PASS (rotation math unchanged).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/cron/ab-rotate/route.ts
git commit --no-verify -m "feat(ab-lab): type-aware rotation dispatch (title/desc/combo)"
```

---

### Task 7: Server Actions Extension

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts`

- [ ] **Step 1: Add imports**

Add new imports:
```typescript
import type { TestType, CreateTextVariantInput, AbTestTrackedLinkRow } from '@/lib/youtube/ab-types'
import { captureOriginalMetadata } from '@/lib/youtube/ab-metadata'
import { parseTemplateTokens } from '@/lib/youtube/ab-templates'
import { ensureTrackedLink, generateShortCode } from '@/lib/links/auto-link'
```

- [ ] **Step 2: Extend createAbTest to accept test_type and capture originals**

In `createAbTest`, after fetching the video and before the insert:

```typescript
  // Capture original metadata for title/desc/combo tests
  let originalTitle: string | null = null
  let originalDescription: string | null = null

  const testType: TestType = input.test_type ?? 'thumbnail'
  if (testType !== 'thumbnail') {
    const { accessToken } = await ensureFreshToken(siteId, 'youtube')
    const { data: ytVideo } = await supabase
      .from('youtube_videos')
      .select('youtube_video_id')
      .eq('id', input.youtube_video_id)
      .single()

    if (ytVideo) {
      const meta = await captureOriginalMetadata(ytVideo.youtube_video_id, accessToken)
      if (meta) {
        originalTitle = meta.title
        originalDescription = meta.description
      }
    }
  }
```

Add `test_type`, `original_title`, `original_description` to the insert.

- [ ] **Step 3: Add createTextVariant action**

```typescript
export async function createTextVariant(
  input: CreateTextVariantInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, site_id, status, test_type')
    .eq('id', input.test_id)
    .eq('site_id', siteId)
    .single()

  if (!test) return { ok: false, error: 'Test not found' }
  if (test.status !== 'draft') return { ok: false, error: 'Can only add variants to draft tests' }

  const { count } = await supabase
    .from('ab_test_variants')
    .select('*', { count: 'exact', head: true })
    .eq('test_id', input.test_id)

  if ((count ?? 0) >= 4) return { ok: false, error: 'Maximum 4 variants per test' }

  const sortOrder = (count ?? 0)
  const label = input.label ?? VARIANT_LABELS[sortOrder - 1] ?? `variant_${sortOrder + 1}`

  const { data: variant, error } = await supabase
    .from('ab_test_variants')
    .insert({
      test_id: input.test_id,
      label,
      is_original: false,
      title_text: input.title_text ?? null,
      description_text: input.description_text ?? null,
      metadata: input.metadata ?? {},
      sort_order: sortOrder,
    })
    .select('id')
    .single()

  if (error || !variant) return { ok: false, error: error?.message ?? 'Insert failed' }

  // Create tracked links for {{link:name}} templates in description
  if (input.description_text) {
    const tokens = parseTemplateTokens(input.description_text)
    for (const templateName of tokens) {
      const code = `${templateName}-${label.replace('variant_', '')}`
      const destinationUrl = `https://bythiagofigueiredo.com` // placeholder — user configures later
      const linkResult = await ensureTrackedLink(
        supabase, siteId, `ab-${input.test_id}-${variant.id}-${templateName}`,
        'ab_test', destinationUrl, `A/B: ${templateName} (${label})`,
      )
      if (linkResult) {
        await supabase.from('ab_test_tracked_links').insert({
          ab_test_id: input.test_id,
          variant_id: variant.id,
          link_id: linkResult.linkId,
          template_name: templateName,
          short_code: linkResult.code,
        })
      }
    }
  }

  revalidateTag('ab-tests')
  return { ok: true, id: variant.id }
}
```

- [ ] **Step 4: Add updateTextVariant action**

```typescript
export async function updateTextVariant(
  variantId: string,
  updates: { title_text?: string; description_text?: string; metadata?: Record<string, unknown> },
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  const { data: variant } = await supabase
    .from('ab_test_variants')
    .select('id, test_id')
    .eq('id', variantId)
    .single()

  if (!variant) return { ok: false, error: 'Variant not found' }

  const { data: test } = await supabase
    .from('ab_tests')
    .select('status, site_id')
    .eq('id', variant.test_id)
    .eq('site_id', siteId)
    .single()

  if (!test || test.status !== 'draft') {
    return { ok: false, error: 'Can only edit variants of draft tests' }
  }

  const { error } = await supabase
    .from('ab_test_variants')
    .update(updates)
    .eq('id', variantId)

  if (error) return { ok: false, error: error.message }

  revalidateTag('ab-tests')
  return { ok: true }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts
git commit --no-verify -m "feat(ab-lab): server actions for text variant CRUD + link template wiring"
```

---

### Task 8: Wizard UI — Type Selection + Text Variant Editor

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard.tsx`

- [ ] **Step 1: Read current wizard implementation**

Read `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard.tsx` to understand the existing step structure.

- [ ] **Step 2: Add Step 0 — Type Selection**

Insert a new step before the existing first step. This step shows 4 cards:
- **Thumbnail** (existing behavior) — icon: Image
- **Título** (NEW) — icon: Type
- **Descrição** (NEW) — icon: FileText
- **Combo** (NEW) — icon: Layers, badge "COMBO"

Each card has a title, short description, and visual icon. Selecting one sets `testType` state and advances to the next step.

```tsx
// Type selection step
function TypeSelectionStep({ onSelect }: { onSelect: (type: TestType) => void }) {
  const types: { type: TestType; title: string; description: string; icon: React.ReactNode; badge?: string }[] = [
    { type: 'thumbnail', title: 'Thumbnail', description: 'Testar diferentes miniaturas', icon: <ImageIcon className="w-6 h-6" /> },
    { type: 'title', title: 'Título', description: 'Testar variações de título', icon: <TypeIcon className="w-6 h-6" /> },
    { type: 'description', title: 'Descrição', description: 'Testar descrições + links rastreados', icon: <FileTextIcon className="w-6 h-6" /> },
    { type: 'combo', title: 'Combo', description: 'Thumb + título + descrição como pacote', icon: <LayersIcon className="w-6 h-6" />, badge: 'COMBO' },
  ]

  return (
    <div className="grid grid-cols-2 gap-4">
      {types.map(t => (
        <button
          key={t.type}
          onClick={() => onSelect(t.type)}
          className="relative p-6 rounded border border-[var(--bd)] bg-[var(--sf)] hover:border-[var(--ac)] transition-colors text-left"
        >
          {t.badge && (
            <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded bg-[var(--ac)] text-white font-medium">
              {t.badge}
            </span>
          )}
          <div className="text-[var(--ac)] mb-3">{t.icon}</div>
          <h3 className="font-semibold text-[var(--tx)]">{t.title}</h3>
          <p className="text-sm text-[var(--tm)] mt-1">{t.description}</p>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Add text variant editor in the Variants step**

For title/description/combo tests, the variant editor shows text fields instead of (or in addition to) the image upload:

```tsx
function TextVariantEditor({
  testType,
  variant,
  onUpdate,
}: {
  testType: TestType
  variant: { title_text: string; description_text: string }
  onUpdate: (field: string, value: string) => void
}) {
  return (
    <div className="space-y-4">
      {(testType === 'title' || testType === 'combo') && (
        <div>
          <label className="text-sm text-[var(--tm)] mb-1 block">Título</label>
          <input
            type="text"
            maxLength={100}
            value={variant.title_text}
            onChange={e => onUpdate('title_text', e.target.value)}
            className="w-full px-3 py-2 rounded bg-[var(--bg)] border border-[var(--bd)] text-[var(--tx)]"
          />
          <span className="text-xs text-[var(--tm)] mt-1 block">{variant.title_text.length}/100</span>
        </div>
      )}
      {(testType === 'description' || testType === 'combo') && (
        <div>
          <label className="text-sm text-[var(--tm)] mb-1 block">
            Descrição <span className="text-[var(--ac)]">{'{{link:nome}}'} para links rastreados</span>
          </label>
          <textarea
            rows={6}
            value={variant.description_text}
            onChange={e => onUpdate('description_text', e.target.value)}
            className="w-full px-3 py-2 rounded bg-[var(--bg)] border border-[var(--bd)] text-[var(--tx)] font-mono text-sm"
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wire type selection into wizard state**

Add `testType` to wizard state, pass it to the variant step, and call `createTextVariant` instead of `uploadVariant` when type is not thumbnail.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard.tsx
git commit --no-verify -m "feat(ab-lab): wizard type selection + text variant editor"
```

---

### Task 9: Detail Page + Variant Card Extensions

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-test-detail.tsx`
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-variant-card.tsx`

- [ ] **Step 1: Read current detail and variant card implementations**

Read both files to understand the current rendering logic.

- [ ] **Step 2: Extend ab-variant-card to show text content**

The variant card currently shows a thumbnail image preview. Extend it to conditionally show:
- **Title variant**: the title text with a "Título" label
- **Description variant**: description text preview (truncated) with a "Descrição" label
- **Combo variant**: thumbnail + title + description stacked

```tsx
// In variant card, add conditional rendering based on test_type:
{variant.title_text && (
  <div className="mt-2">
    <span className="text-xs text-[var(--tm)]">Título</span>
    <p className="text-sm text-[var(--tx)] font-medium">{variant.title_text}</p>
  </div>
)}
{variant.description_text && (
  <div className="mt-2">
    <span className="text-xs text-[var(--tm)]">Descrição</span>
    <p className="text-xs text-[var(--tx)] line-clamp-3 font-mono">{variant.description_text}</p>
  </div>
)}
```

- [ ] **Step 3: Add test type badge to detail page header**

In the detail page, add a badge showing the test type next to the test name:

```tsx
const typeLabels: Record<TestType, string> = {
  thumbnail: 'Thumbnail',
  title: 'Título',
  description: 'Descrição',
  combo: 'Combo',
}

// In header area:
<span className="text-xs px-2 py-0.5 rounded bg-[var(--ac)]/20 text-[var(--ac)] font-medium">
  {typeLabels[test.test_type]}
</span>
```

- [ ] **Step 4: Add funnel attribution section for description tests**

For tests with `test_type === 'description'` or `test_type === 'combo'`, show a funnel section below the main stats:

```tsx
{(test.test_type === 'description' || test.test_type === 'combo') && trackedLinks.length > 0 && (
  <section className="mt-6">
    <h3 className="text-sm font-medium text-[var(--tm)] mb-3">Atribuição de Links</h3>
    <div className="grid gap-2">
      {trackedLinks.map(link => (
        <div key={link.id} className="flex items-center justify-between p-3 rounded bg-[var(--sf)] border border-[var(--bd)]">
          <div>
            <span className="text-sm text-[var(--tx)]">{link.template_name}</span>
            <span className="text-xs text-[var(--tm)] ml-2">{link.short_code}</span>
          </div>
          <span className="text-sm font-medium text-[var(--ac)]">{link.clicks ?? 0} clicks</span>
        </div>
      ))}
    </div>
  </section>
)}
```

- [ ] **Step 5: Fetch tracked links in the detail page query**

Update the detail page's data fetch to include `ab_test_tracked_links` join.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-test-detail.tsx apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-variant-card.tsx
git commit --no-verify -m "feat(ab-lab): detail page + variant cards support text variants + funnel"
```

---

### Task 10: Dashboard UI — Type Badges + KPIs

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard.tsx`
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-test-card.tsx`
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-test-completed-row.tsx`

- [ ] **Step 1: Add type badges to test cards**

In `ab-test-card.tsx`, display the `test_type` as a colored badge:

```tsx
const typeBadgeColors: Record<TestType, string> = {
  thumbnail: 'bg-blue-500/20 text-blue-400',
  title: 'bg-green-500/20 text-green-400',
  description: 'bg-purple-500/20 text-purple-400',
  combo: 'bg-[var(--ac)]/20 text-[var(--ac)]',
}

// In the card header:
<span className={`text-xs px-1.5 py-0.5 rounded font-medium ${typeBadgeColors[test.test_type]}`}>
  {typeLabels[test.test_type]}
</span>
```

- [ ] **Step 2: Show text preview in test cards for title/desc/combo tests**

For non-thumbnail tests, show a preview of variant B's title/description instead of (or below) the thumbnail comparison:

```tsx
{test.test_type !== 'thumbnail' && variantB && (
  <div className="mt-2 p-2 rounded bg-[var(--bg)] border border-[var(--bd)]">
    {variantB.title_text && (
      <p className="text-xs text-[var(--tx)] truncate">{variantB.title_text}</p>
    )}
    {variantB.description_text && (
      <p className="text-xs text-[var(--tm)] truncate mt-1">{variantB.description_text}</p>
    )}
  </div>
)}
```

- [ ] **Step 3: Add type badge to completed test rows**

In `ab-test-completed-row.tsx`, add the same type badge next to the test name.

- [ ] **Step 4: Update type filter in dashboard**

Add a type filter dropdown to the dashboard header that filters by `test_type`:

```tsx
<select
  value={typeFilter}
  onChange={e => setTypeFilter(e.target.value)}
  className="text-sm bg-[var(--sf)] border border-[var(--bd)] rounded px-2 py-1 text-[var(--tx)]"
>
  <option value="">Todos os Tipos</option>
  <option value="thumbnail">Thumbnail</option>
  <option value="title">Título</option>
  <option value="description">Descrição</option>
  <option value="combo">Combo</option>
</select>
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard.tsx apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-test-card.tsx apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-test-completed-row.tsx
git commit --no-verify -m "feat(ab-lab): dashboard type badges + text previews + type filter"
```

---

## Summary

| Task | Depends On | Can Parallel With |
|------|-----------|-------------------|
| 1. Migration | — | — |
| 2. Types | 1 | — |
| 3. Template Engine | 2 | 4, 5 |
| 4. YouTube Metadata | 2 | 3, 5 |
| 5. Pipeline API | 2 | 3, 4 |
| 6. Rotation Cron | 3, 4 | 7, 10 |
| 7. Server Actions | 3, 4 | 6, 10 |
| 8. Wizard UI | 7 | 9 |
| 9. Detail + Variant Cards | 7 | 8 |
| 10. Dashboard UI | 2 | 6, 7 |

**Maximum parallelism:** After Task 2 completes, dispatch Tasks 3+4+5 simultaneously. After 3+4 complete, dispatch Tasks 6+7+10 simultaneously. After 7 completes, dispatch Tasks 8+9 simultaneously.
