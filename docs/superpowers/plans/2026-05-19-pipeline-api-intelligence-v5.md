# Pipeline API Intelligence v5 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the pipeline reference system into a self-evolving 3-tier API intelligence layer (catalog + docs + references) with system directives, context filters, and 6 domain docs.

**Architecture:** Enhanced `GET /api/pipeline/` returns full catalog + directives in 1 call. New `GET /api/pipeline/docs/[domain]` serves 6 domain doc files. Existing `GET /api/pipeline/context` gains `?group=` and `?skill=` filters. System directives live in `reference_content` with group `sistema` and `_system/` key prefix.

**Tech Stack:** Next.js 15, TypeScript 5, Supabase PostgreSQL 17, Vitest, Zod

**Spec:** `docs/superpowers/specs/2026-05-19-pipeline-api-intelligence-v5-design.md`

---

## Parallelization Guide

```
Batch 1 (parallel): Tasks 1, 2, 3
Batch 2 (parallel): Tasks 4, 5, 6 (depend on batch 1)
Batch 3 (parallel): Tasks 7, 8 (depend on batch 2)
Task 9: Reference reorganization (depends on all above)
Task 10: Domain doc content (can start anytime, pure content)
Task 11: Integration tests (last)
```

---

### Task 1: DB Migration — Permissive CHECK + Sistema Group

**Files:**
- Create: `supabase/migrations/YYYYMMDD_api_intelligence_v5.sql` (use `npm run db:new api_intelligence_v5`)

- [ ] **Step 1: Generate migration file**

```bash
npm run db:new api_intelligence_v5
```

- [ ] **Step 2: Write migration SQL**

```sql
-- Pipeline API Intelligence v5: permissive ref_group CHECK + sistema group
-- Replaces rigid enum CHECK with regex to allow Cowork-driven category evolution

BEGIN;

-- 1. Replace rigid CHECK with permissive regex
ALTER TABLE public.reference_content
  DROP CONSTRAINT IF EXISTS reference_content_ref_group_check;

ALTER TABLE public.reference_content
  ADD CONSTRAINT reference_content_ref_group_check
  CHECK (ref_group ~ '^[a-z][a-z0-9_]{0,29}$');

-- 2. Update index to include sistema group (index is on ref_group, already generic)
-- No index change needed — existing idx_reference_content_group_sort handles any group string

COMMIT;
```

- [ ] **Step 3: Push to prod**

```bash
npm run db:push:prod
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*api_intelligence_v5*
git commit -m "feat(pipeline): permissive ref_group CHECK for dynamic categories"
```

---

### Task 2: API Registry Module

**Files:**
- Create: `apps/web/src/lib/pipeline/api-registry.ts`
- Test: `apps/web/test/lib/pipeline/api-registry.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/test/lib/pipeline/api-registry.test.ts
import { describe, it, expect } from 'vitest'
import { API_REGISTRY, type ApiCatalog } from '@/lib/pipeline/api-registry'

describe('API_REGISTRY', () => {
  it('has version 2.0.0', () => {
    expect(API_REGISTRY.version).toBe('2.0.0')
  })

  it('has exactly 6 capability domains', () => {
    expect(API_REGISTRY.capabilities).toHaveLength(6)
    const domains = API_REGISTRY.capabilities.map((c) => c.domain)
    expect(domains).toEqual([
      'items-and-sections',
      'playlists',
      'libraries',
      'research',
      'youtube',
      'utilities',
    ])
  })

  it('endpoint_count matches actual endpoints array length for each domain', () => {
    for (const cap of API_REGISTRY.capabilities) {
      expect(cap.endpoint_count, `${cap.domain} count mismatch`).toBe(cap.endpoints.length)
    }
  })

  it('every endpoint has method, path, summary, and auth', () => {
    for (const cap of API_REGISTRY.capabilities) {
      for (const ep of cap.endpoints) {
        expect(ep.method).toMatch(/^(GET|POST|PATCH|PUT|DELETE)$/)
        expect(ep.path).toMatch(/^\//)
        expect(ep.summary.length).toBeGreaterThan(5)
        expect(ep.auth).toMatch(/^(read|write)$/)
      }
    }
  })

  it('every domain has suggest_when', () => {
    for (const cap of API_REGISTRY.capabilities) {
      expect(cap.suggest_when.length).toBeGreaterThan(10)
    }
  })

  it('has cross_domain_workflows', () => {
    expect(API_REGISTRY.cross_domain_workflows.length).toBeGreaterThan(0)
  })

  it('satisfies ApiCatalog type', () => {
    const catalog: ApiCatalog = API_REGISTRY
    expect(catalog.name).toBe('Content Pipeline API')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run test/lib/pipeline/api-registry.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the registry module**

```typescript
// apps/web/src/lib/pipeline/api-registry.ts

export interface ApiEndpointMeta {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  path: string
  summary: string
  auth: 'read' | 'write'
}

export interface CapabilityDomain {
  domain: string
  name: string
  description: string
  suggest_when: string
  docs: string
  endpoint_count: number
  endpoints: ApiEndpointMeta[]
}

export interface CrossDomainWorkflow {
  name: string
  description: string
  domains: string[]
  steps: string[]
}

export interface ApiCatalog {
  name: string
  version: string
  auth: {
    methods: string[]
    header: string
    rate_limit: string
    version_header: string
  }
  capabilities: CapabilityDomain[]
  cross_domain_workflows: CrossDomainWorkflow[]
}

const ITEMS_AND_SECTIONS: CapabilityDomain = {
  domain: 'items-and-sections',
  name: 'Pipeline Items & Content Sections',
  description: 'Create, manage, advance content through workflow stages. Update content sections (ideia, roteiro, postprod, etc.).',
  suggest_when: 'Creating, editing, advancing pipeline content, writing sections, managing item lifecycle',
  docs: '/api/pipeline/docs/items-and-sections',
  endpoint_count: 17,
  endpoints: [
    { method: 'GET', path: '/api/pipeline/items', summary: 'List items with cursor pagination and filtering', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/items', summary: 'Create single or batch items (max 50)', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/items/:id', summary: 'Get item detail with history and dependencies', auth: 'read' },
    { method: 'PATCH', path: '/api/pipeline/items/:id', summary: 'Update item fields (X-Expected-Version required)', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/items/:id', summary: 'Archive item (soft delete)', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/items/:id/advance', summary: 'Advance to next workflow stage', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/items/:id/retreat', summary: 'Retreat to previous stage', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/items/:id/checklist', summary: 'Toggle production checklist item', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/items/:id/graduate', summary: 'Graduate to blog post, newsletter, or campaign', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/items/:id/restore', summary: 'Unarchive a previously archived item', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/items/:id/history', summary: 'Get audit trail for item changes', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/items/:id/link', summary: 'Link a blog post to pipeline item', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/items/:id/unlink', summary: 'Unlink blog post from pipeline item', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/items/:id/sections/:section', summary: 'Get specific content section', auth: 'read' },
    { method: 'PATCH', path: '/api/pipeline/items/:id/sections/:section', summary: 'Update content section with revision tracking', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/items/bulk', summary: 'Batch operations (advance, archive, tag, update)', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/items/batch-sections', summary: 'Batch update sections across multiple items', auth: 'write' },
  ],
}

const PLAYLISTS: CapabilityDomain = {
  domain: 'playlists',
  name: 'Playlists & Graph',
  description: 'Organize items into playlists with directed edges for sequencing and dependencies.',
  suggest_when: 'Organizing content into series, courses, creating dependency graphs, managing content sequences',
  docs: '/api/pipeline/docs/playlists',
  endpoint_count: 12,
  endpoints: [
    { method: 'GET', path: '/api/pipeline/playlists', summary: 'List playlists with item counts', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/playlists', summary: 'Create new playlist', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/playlists/:id', summary: 'Get playlist with items and edges graph', auth: 'read' },
    { method: 'PATCH', path: '/api/pipeline/playlists/:id', summary: 'Update playlist metadata', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/playlists/:id', summary: 'Delete playlist', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/playlists/:id/items', summary: 'Add item to playlist', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/playlists/:id/items/:itemId', summary: 'Remove item from playlist', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/playlists/:id/items/bulk', summary: 'Batch add items to playlist', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/playlists/:id/edges', summary: 'Create directed edge between items', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/playlists/:id/edges/:edgeId', summary: 'Remove edge', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/playlists/:id/edges/bulk', summary: 'Batch create edges', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/playlists/:id/reorder', summary: 'Reorder items in playlist', auth: 'write' },
  ],
}

const LIBRARIES: CapabilityDomain = {
  domain: 'libraries',
  name: 'Audio & B-Roll Libraries',
  description: 'Manage audio assets (music, SFX, ambience) and B-roll video clips for post-production.',
  suggest_when: 'Audio selection, music search, B-roll management, SFX, post-production asset workflow',
  docs: '/api/pipeline/docs/libraries',
  endpoint_count: 14,
  endpoints: [
    { method: 'GET', path: '/api/pipeline/audio-library', summary: 'Search/filter audio assets', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/audio-library', summary: 'Create new audio asset', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/audio-library/:id', summary: 'Get audio asset with usage history', auth: 'read' },
    { method: 'PATCH', path: '/api/pipeline/audio-library/:id', summary: 'Update audio asset (X-Expected-Version)', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/audio-library/:id', summary: 'Retire audio asset (soft delete)', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/audio-library/resolve', summary: 'Smart audio matching by context/filters', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/audio-library/import', summary: 'Batch import audio library', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/audio-library/export', summary: 'Export full library as JSON', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/audio-library/stats', summary: 'Library statistics (counts, most used)', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/broll-library', summary: 'List B-roll assets with filters', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/broll-library', summary: 'Create B-roll asset', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/broll-library/:id', summary: 'Get B-roll with usage info', auth: 'read' },
    { method: 'PATCH', path: '/api/pipeline/broll-library/:id', summary: 'Update B-roll asset', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/broll-library/:id', summary: 'Retire B-roll asset', auth: 'write' },
  ],
}

const RESEARCH: CapabilityDomain = {
  domain: 'research',
  name: 'Research Library',
  description: 'Manage research items with hierarchical topics and many-to-many pipeline links.',
  suggest_when: 'Research management, topic organization, linking research to pipeline items, knowledge base',
  docs: '/api/pipeline/docs/research',
  endpoint_count: 11,
  endpoints: [
    { method: 'GET', path: '/api/pipeline/research', summary: 'List research items with cursor pagination', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/research', summary: 'Create research item (upsert by topic+title)', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/research/:id', summary: 'Get research item with linked pipeline items', auth: 'read' },
    { method: 'PATCH', path: '/api/pipeline/research/:id', summary: 'Update research content', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/research/:id', summary: 'Delete research item', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/research/:id/links', summary: 'Link research to pipeline item', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/research/:id/links/:linkId', summary: 'Remove research-pipeline link', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/research/import', summary: 'Batch import research items', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/research/topics', summary: 'List research topics (hierarchical)', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/research/topics', summary: 'Create research topic (max depth 3)', auth: 'write' },
    { method: 'PATCH', path: '/api/pipeline/research/topics/:id', summary: 'Update topic metadata', auth: 'write' },
  ],
}

const YOUTUBE: CapabilityDomain = {
  domain: 'youtube',
  name: 'YouTube Analytics & A/B Testing',
  description: 'Channel intelligence, video performance analysis, and title/description A/B testing.',
  suggest_when: 'YouTube analytics, performance review, A/B test management, video optimization',
  docs: '/api/pipeline/docs/youtube',
  endpoint_count: 7,
  endpoints: [
    { method: 'GET', path: '/api/pipeline/youtube/intelligence', summary: 'Get channel intelligence snapshot', auth: 'read' },
    { method: 'PATCH', path: '/api/pipeline/youtube/intelligence', summary: 'Submit AI analysis recommendations', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/youtube/intelligence/task', summary: 'Claim next pending intelligence task', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/ab-tests', summary: 'List A/B tests with variants', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/ab-tests/:id', summary: 'Get A/B test details with variants and cycles', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/ab-tests/:id/funnel', summary: 'Get funnel metrics per variant', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/ab-performance', summary: 'Aggregate winning patterns from completed tests', auth: 'read' },
  ],
}

const UTILITIES: CapabilityDomain = {
  domain: 'utilities',
  name: 'Search, Context & Utilities',
  description: 'Cross-entity search, reference content management, pipeline statistics, and workflow definitions.',
  suggest_when: 'Searching across entities, reading/updating references, checking stats, listing workflows',
  docs: '/api/pipeline/docs/utilities',
  endpoint_count: 9,
  endpoints: [
    { method: 'GET', path: '/api/pipeline/context', summary: 'Get all reference content (supports ?group= ?skill= ?format=md)', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/context/:key', summary: 'Get specific reference doc', auth: 'read' },
    { method: 'PUT', path: '/api/pipeline/context/:key', summary: 'Upsert reference doc (X-Expected-Version)', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/context/:key', summary: 'Delete reference doc', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/search', summary: 'Cross-entity search (items, posts, newsletters)', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/stats', summary: 'Aggregate pipeline statistics', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/topics/:code', summary: 'Topic aggregation (items + posts by tag)', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/workflows', summary: 'Get all workflow definitions and checklists', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/playlists/:id/auto-layout', summary: 'Compute automatic layout positions', auth: 'write' },
  ],
}

const CROSS_DOMAIN_WORKFLOWS: CrossDomainWorkflow[] = [
  {
    name: 'Video production pipeline',
    description: 'Full lifecycle from idea to published video',
    domains: ['items-and-sections', 'libraries', 'playlists'],
    steps: [
      'POST /api/pipeline/items — create video item',
      'PATCH /api/pipeline/items/:id/sections/ideia — write premise and angle',
      'PATCH /api/pipeline/items/:id/sections/draft — write draft',
      'PATCH /api/pipeline/items/:id/sections/roteiro — write script with beats',
      'POST /api/pipeline/audio-library/resolve — find music and SFX',
      'PATCH /api/pipeline/items/:id/sections/postprod_scenes — fill timeline',
      'POST /api/pipeline/items/:id/advance — move through stages',
      'POST /api/pipeline/playlists/:id/items — add to playlist',
    ],
  },
  {
    name: 'Research to content pipeline',
    description: 'Turn research into pipeline items and link them',
    domains: ['research', 'items-and-sections'],
    steps: [
      'POST /api/pipeline/research — create research item',
      'POST /api/pipeline/items — create pipeline item from research',
      'POST /api/pipeline/research/:id/links — link research to item',
    ],
  },
]

export const API_REGISTRY: ApiCatalog = {
  name: 'Content Pipeline API',
  version: '2.0.0',
  auth: {
    methods: ['api_key', 'session_cookie'],
    header: 'X-Pipeline-Key',
    rate_limit: '100/min (api_key only)',
    version_header: 'X-Expected-Version',
  },
  capabilities: [ITEMS_AND_SECTIONS, PLAYLISTS, LIBRARIES, RESEARCH, YOUTUBE, UTILITIES],
  cross_domain_workflows: CROSS_DOMAIN_WORKFLOWS,
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && npx vitest run test/lib/pipeline/api-registry.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/api-registry.ts apps/web/test/lib/pipeline/api-registry.test.ts
git commit -m "feat(pipeline): add API registry module with 6 domains and 70 endpoints"
```

---

### Task 3: Update Reference Groups + Schema

**Files:**
- Modify: `apps/web/src/lib/pipeline/reference-groups.ts`
- Modify: `apps/web/src/lib/pipeline/schemas.ts`

- [ ] **Step 1: Add `sistema` group to reference-groups.ts**

In `apps/web/src/lib/pipeline/reference-groups.ts`, replace the `REFERENCE_GROUPS` array:

```typescript
export const REFERENCE_GROUPS = [
  { id: 'pessoal',    label: 'Pessoal',    color: '#34d399' },
  { id: 'estrategia', label: 'Estratégia', color: '#a78bfa' },
  { id: 'craft',      label: 'Craft',      color: '#fbbf24' },
  { id: 'producao',   label: 'Produção',   color: '#22d3ee' },
  { id: 'api',        label: 'API',        color: '#fb7185' },
  { id: 'memoria',    label: 'Memória',    color: '#38bdf8' },
  { id: 'sistema',    label: 'Sistema',    color: '#94a3b8' },
] as const
```

Note: keep `api` for backward compat until migration moves all refs out.

- [ ] **Step 2: Verify schemas.ts picks up the new group**

The `ReferenceContentUpsertSchema` in `apps/web/src/lib/pipeline/schemas.ts` uses `z.enum(REFERENCE_GROUP_VALUES)` which derives from `REFERENCE_GROUP_IDS`. Adding `sistema` to `REFERENCE_GROUPS` automatically includes it in the Zod enum. Verify by checking the import chain.

- [ ] **Step 3: Run existing tests**

```bash
cd apps/web && npx vitest run --reporter=verbose 2>&1 | grep -E "(FAIL|PASS|Tests)" | tail -5
```

Expected: All existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/pipeline/reference-groups.ts
git commit -m "feat(pipeline): add sistema reference group for system directives"
```

---

### Task 4: Enhanced Catalog Endpoint

**Files:**
- Modify: `apps/web/src/app/api/pipeline/route.ts`
- Test: `apps/web/test/api/pipeline/catalog.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/test/api/pipeline/catalog.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockLike = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args)
        return {
          eq: (...a: unknown[]) => {
            mockEq(...a)
            return {
              like: (...b: unknown[]) => {
                mockLike(...b)
                return { data: [], error: null }
              },
            }
          },
        }
      },
    }),
  }),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => ({ siteId: 'site-1' }),
}))

import { GET } from '@/app/api/pipeline/route'

describe('GET /api/pipeline/', () => {
  it('returns catalog with version 2.0.0', async () => {
    const res = await GET()
    const json = await res.json()
    expect(json.version).toBe('2.0.0')
  })

  it('has capabilities array with 6 domains', async () => {
    const res = await GET()
    const json = await res.json()
    expect(json.capabilities).toHaveLength(6)
  })

  it('has directives object', async () => {
    const res = await GET()
    const json = await res.json()
    expect(json.directives).toBeDefined()
    expect(typeof json.directives).toBe('object')
  })

  it('has cross_domain_workflows', async () => {
    const res = await GET()
    const json = await res.json()
    expect(json.cross_domain_workflows.length).toBeGreaterThan(0)
  })

  it('has context section with filter docs', async () => {
    const res = await GET()
    const json = await res.json()
    expect(json.context.endpoint).toBe('/api/pipeline/context')
    expect(json.context.filters).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run test/api/pipeline/catalog.test.ts
```

Expected: FAIL — current endpoint returns version 1.0.0.

- [ ] **Step 3: Rewrite the catalog endpoint**

Replace `apps/web/src/app/api/pipeline/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { WORKFLOWS } from '@/lib/pipeline/workflows'
import { API_REGISTRY } from '@/lib/pipeline/api-registry'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

async function loadDirectives(siteId: string): Promise<Record<string, { version: number; value: unknown }>> {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('reference_content')
    .select('key, content_compact, version')
    .eq('site_id', siteId)
    .like('key', '_system/%')

  const directives: Record<string, { version: number; value: unknown }> = {}
  for (const row of data ?? []) {
    const shortKey = row.key.replace('_system/', '')
    directives[shortKey] = { version: row.version, value: row.content_compact }
  }
  return directives
}

export async function GET() {
  // Try to load directives; fall back to empty if no site context
  let directives: Record<string, { version: number; value: unknown }> = {}
  try {
    const { getSiteContext } = await import('@/lib/cms/site-context')
    const { siteId } = await getSiteContext()
    directives = await loadDirectives(siteId)
  } catch {
    // No site context (e.g., unauthenticated) — return catalog without directives
  }

  return NextResponse.json({
    name: API_REGISTRY.name,
    version: API_REGISTRY.version,
    auth: API_REGISTRY.auth,
    capabilities: API_REGISTRY.capabilities,
    directives,
    cross_domain_workflows: API_REGISTRY.cross_domain_workflows,
    context: {
      endpoint: '/api/pipeline/context',
      filters: {
        group: '?group={group_id}',
        skill: '?skill={skill_name}',
        format: '?format=md (full markdown) or default (compact JSON)',
      },
    },
    formats: Object.keys(WORKFLOWS),
    workflows: WORKFLOWS,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && npx vitest run test/api/pipeline/catalog.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/pipeline/route.ts apps/web/test/api/pipeline/catalog.test.ts
git commit -m "feat(pipeline): enhanced catalog with registry, directives, and cross-domain workflows"
```

---

### Task 5: Context API Filters (?group= ?skill=)

**Files:**
- Modify: `apps/web/src/app/api/pipeline/context/route.ts`
- Test: `apps/web/test/api/pipeline/context-filters.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/test/api/pipeline/context-filters.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const MOCK_REFS = [
  { key: 'personal-profile', title: 'Profile', content_md: '# Profile', content_compact: {}, ref_group: 'pessoal', sort_order: 10, version: 1, updated_at: '2026-01-01' },
  { key: 'writer-voice-guide', title: 'Voice', content_md: '# Voice', content_compact: {}, ref_group: 'craft', sort_order: 10, version: 1, updated_at: '2026-01-01' },
  { key: '_system/groups', title: 'Groups', content_md: '', content_compact: { groups: [] }, ref_group: 'sistema', sort_order: 0, version: 1, updated_at: '2026-01-01' },
  { key: '_system/skill-mappings', title: 'Mappings', content_md: '', content_compact: { writer: ['personal-profile', 'writer-voice-guide'] }, ref_group: 'sistema', sort_order: 1, version: 1, updated_at: '2026-01-01' },
]

let capturedFilters: Record<string, unknown> = {}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: (col: string, val: string) => { capturedFilters[col] = val; return chain },
        in: (col: string, vals: string[]) => { capturedFilters[`${col}_in`] = vals; return chain },
        not: (col: string, op: string, val: string) => { capturedFilters[`${col}_not_${op}`] = val; return chain },
        like: (col: string, val: string) => { capturedFilters[`${col}_like`] = val; return chain },
        order: () => chain,
        single: () => ({ data: MOCK_REFS.find((r) => r.key === '_system/skill-mappings'), error: null }),
        then: undefined as unknown,
      }
      // Resolve the query chain as a promise
      Object.defineProperty(chain, 'then', {
        get: () => {
          const filtered = MOCK_REFS.filter((r) => {
            if (capturedFilters.ref_group && r.ref_group !== capturedFilters.ref_group) return false
            if (capturedFilters['key_in'] && !(capturedFilters['key_in'] as string[]).includes(r.key)) return false
            if (capturedFilters['key_not_like'] === '_system/%' && r.key.startsWith('_system/')) return false
            return true
          })
          return (resolve: (v: unknown) => void) => resolve({ data: filtered, error: null })
        },
      })
      return chain
    },
  }),
}))

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: () => ({ ok: true, auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'api_key', keyHash: 'abc' } }),
  buildRateLimitHeaders: () => ({}),
}))

import { GET } from '@/app/api/pipeline/context/route'
import { NextRequest } from 'next/server'

function makeReq(params = ''): NextRequest {
  return new NextRequest(`http://localhost/api/pipeline/context${params}`)
}

describe('GET /api/pipeline/context', () => {
  beforeEach(() => { capturedFilters = {} })

  it('excludes _system/ entries by default', async () => {
    const res = await GET(makeReq())
    const json = await res.json()
    const keys = json.data.map((d: { key: string }) => d.key)
    expect(keys).not.toContain('_system/groups')
  })

  it('filters by ?group=pessoal', async () => {
    const res = await GET(makeReq('?group=pessoal'))
    const json = await res.json()
    for (const item of json.data) {
      expect(item.ref_group).toBe('pessoal')
    }
  })

  it('returns _system/ entries when ?group=sistema', async () => {
    const res = await GET(makeReq('?group=sistema'))
    const json = await res.json()
    expect(json.data.some((d: { key: string }) => d.key.startsWith('_system/'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run test/api/pipeline/context-filters.test.ts
```

Expected: FAIL — no filter support yet.

- [ ] **Step 3: Update the context route**

Replace `apps/web/src/app/api/pipeline/context/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, buildRateLimitHeaders } from '@/lib/pipeline/auth'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult

  const format = req.nextUrl.searchParams.get('format')
  const group = req.nextUrl.searchParams.get('group')
  const skill = req.nextUrl.searchParams.get('skill')

  const supabase = getSupabaseServiceClient()

  // If filtering by skill, resolve keys from _system/skill-mappings
  let skillKeys: string[] | null = null
  if (skill) {
    const { data: mappingRow } = await supabase
      .from('reference_content')
      .select('content_compact')
      .eq('site_id', auth.siteId)
      .eq('key', '_system/skill-mappings')
      .single()
    const mappings = mappingRow?.content_compact as Record<string, string[]> | null
    skillKeys = mappings?.[skill] ?? []
  }

  let query = supabase
    .from('reference_content')
    .select('key, title, content_md, content_compact, ref_group, sort_order, version, updated_at')
    .eq('site_id', auth.siteId)

  if (group) {
    query = query.eq('ref_group', group)
  } else {
    // Exclude _system/* entries from default context calls
    query = query.not('key', 'like', '_system/%')
  }

  if (skillKeys !== null) {
    if (skillKeys.length === 0) {
      return NextResponse.json({ data: [] }, { headers: buildRateLimitHeaders(auth) ?? {} })
    }
    query = query.in('key', skillKeys)
  }

  query = query.order('ref_group').order('sort_order').order('key')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: { code: 'QUERY_ERROR', message: error.message } }, { status: 400 })

  const mapped = data?.map((d) => ({
    key: d.key,
    title: d.title,
    content: format === 'md' ? d.content_md : d.content_compact ?? d.content_md,
    ref_group: d.ref_group,
    sort_order: d.sort_order,
    version: d.version,
    updated_at: d.updated_at,
  }))

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: mapped }, { headers: headers ?? {} })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && npx vitest run test/api/pipeline/context-filters.test.ts
```

Expected: PASS

- [ ] **Step 5: Run all existing tests to check for regressions**

```bash
npm run test:web 2>&1 | tail -5
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/pipeline/context/route.ts apps/web/test/api/pipeline/context-filters.test.ts
git commit -m "feat(pipeline): add ?group= and ?skill= filters to context API, exclude _system/ by default"
```

---

### Task 6: Seed Script — System Directives

**Files:**
- Modify: `scripts/seed-pipeline-reference.ts`

- [ ] **Step 1: Add _system/* directive entries to the ENTRIES array**

In `scripts/seed-pipeline-reference.ts`, add these entries to the `ENTRIES` array (before the existing entries):

```typescript
  {
    key: '_system/groups',
    title: 'System — Reference Groups',
    ref_group: 'sistema',
    sort_order: 0,
    filePath: null, // Inline content below
    inlineCompact: {
      groups: [
        { id: 'pessoal', label: 'Pessoal', color: '#34d399', scope: 'Quem é o Thiago — biografia, valores, experiências de vida' },
        { id: 'estrategia', label: 'Estratégia', color: '#a78bfa', scope: 'Taxonomia, calendário, ângulos de conteúdo, scoring, monetização' },
        { id: 'craft', label: 'Craft', color: '#fbbf24', scope: 'Voz, estilo, convenções de formato, avaliação de produto' },
        { id: 'producao', label: 'Produção', color: '#22d3ee', scope: 'SEO, launch strategy, benchmarks, checklists' },
        { id: 'memoria', label: 'Memória', color: '#38bdf8', scope: 'Logs de aprendizado por skill' },
        { id: 'sistema', label: 'Sistema', color: '#94a3b8', scope: 'Directives do sistema — regras, mapeamentos, protocolo' },
      ],
    },
  },
  {
    key: '_system/skill-mappings',
    title: 'System — Skill Reference Mappings',
    ref_group: 'sistema',
    sort_order: 1,
    filePath: null,
    inlineCompact: {
      ideator: ['personal-profile', 'content-calendar-taxonomy', 'ideator-channel-profiles', 'ideator-content-angles', 'ideator-formats-frameworks', 'ideator-generation-techniques', 'ideator-monetization-research', 'ideator-scoring-rubrics', 'ideator-memory'],
      writer: ['personal-profile', 'writer-voice-guide', 'writer-article-craft', 'writer-newsletter-craft', 'writer-social-craft', 'writer-memory'],
      producer: ['personal-profile', 'producer-editing-patterns', 'producer-sound-design', 'producer-visual-style', 'producer-seo-metadata', 'producer-launch-strategy', 'producer-memory'],
      product_eval: ['personal-profile', 'product-eval-scoring', 'product-eval-catalog', 'product-eval-experience', 'product-eval-reference', 'product-eval-memory'],
      perf_review: ['personal-profile', 'perf-review-benchmarks', 'perf-review-feedback-templates', 'perf-review-analytics-guide', 'perf-review-memory'],
      curator: ['content-curator-skill', 'curator-rules', 'curator-memory'],
      architect: ['playlist-architect-skill', 'architect-templates', 'architect-memory'],
    },
  },
  {
    key: '_system/onboarding',
    title: 'System — Cowork Session Protocol',
    ref_group: 'sistema',
    sort_order: 2,
    filePath: null,
    inlineCompact: {
      system_prompt_template: 'Base: {base_url}/api/pipeline\nAuth header: X-Pipeline-Key\n\n1. GET /api/pipeline/ — capabilities + directives\n2. GET /api/pipeline/context?skill={skill} — load references\n3. GET /api/pipeline/docs/{domain} — detailed docs if needed\n4. Execute task\n5. PUT /api/pipeline/context/{skill}-memory — update memory',
      rules: [
        'Discutir mudanças de directives com o operador ANTES de aplicar',
        'Nunca deletar references sem aprovação explícita',
        'Ao criar nova categoria, justificar por que as existentes não servem',
      ],
      error_recovery: { '409': 'Re-fetch, retry com nova versão', '429': 'Aguardar X-RateLimit-Reset', '500': 'Retry 1x após 2s, depois reportar' },
    },
  },
  {
    key: '_system/memory-policy',
    title: 'System — Memory Management Policy',
    ref_group: 'sistema',
    sort_order: 3,
    filePath: null,
    inlineCompact: {
      max_size_kb: 100,
      rotation: 'Ao atingir 80% do limite, resumir entradas antigas antes de adicionar novas',
      format: 'Append-only com timestamps. Cada entrada: data + contexto + decisão + resultado',
    },
  },
```

- [ ] **Step 2: Update the seed loop to handle inline entries**

Update the `ReferenceEntry` interface and seed loop:

```typescript
interface ReferenceEntry {
  key: string
  title: string
  ref_group: string
  sort_order: number
  filePath: string | null
  inlineCompact?: Record<string, unknown>
}

// In the seed() function, update the loop:
for (const entry of ENTRIES) {
  let contentMd = ''
  if (entry.filePath) {
    const fullPath = resolve(__dirname, entry.filePath)
    console.log(`Reading ${fullPath}...`)
    contentMd = readFileSync(fullPath, 'utf8')
    console.log(`  ${contentMd.length} chars, ${contentMd.split('\n').length} lines`)
  } else {
    console.log(`Inline entry: ${entry.key}`)
  }

  const { data, error } = await supabase
    .from('reference_content')
    .upsert(
      {
        site_id: site.id,
        key: entry.key,
        title: entry.title,
        ref_group: entry.ref_group,
        sort_order: entry.sort_order,
        content_md: contentMd || null,
        content_compact: entry.inlineCompact ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'site_id,key' },
    )
    .select('id, key, version, updated_at')
    .single()

  if (error) throw new Error(`Upsert failed for ${entry.key}: ${error.message}`)
  console.log(`✓ ${data.key} (v${data.version}) updated_at: ${data.updated_at}\n`)
}
```

- [ ] **Step 3: Remove the api group seeds that move to Tier 2**

Remove `cowork-section-schemas` and `playlist-graph-api` from the ENTRIES array. Add a comment:

```typescript
  // NOTE: cowork-section-schemas and playlist-graph-api removed — their content
  // is now served via GET /api/pipeline/docs/ (Tier 2 domain docs)
```

- [ ] **Step 4: Run the seed script to verify it works**

```bash
npx tsx --env-file apps/web/.env.local scripts/seed-pipeline-reference.ts
```

Expected: All entries upserted successfully.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-pipeline-reference.ts
git commit -m "feat(pipeline): seed _system/* directives, remove API docs from seeds"
```

---

### Task 7: Docs Endpoint

**Files:**
- Create: `apps/web/src/app/api/pipeline/docs/[domain]/route.ts`
- Test: `apps/web/test/api/pipeline/docs.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/test/api/pipeline/docs.test.ts
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: () => ({ ok: true, auth: { siteId: 's1', permissions: ['read'], source: 'api_key', keyHash: 'k' } }),
  buildRateLimitHeaders: () => ({}),
  requirePermission: () => true,
}))

import { GET } from '@/app/api/pipeline/docs/[domain]/route'

function makeReq() { return new NextRequest('http://localhost/api/pipeline/docs/utilities') }

describe('GET /api/pipeline/docs/[domain]', () => {
  it('returns 404 for unknown domain', async () => {
    const res = await GET(makeReq(), { params: Promise.resolve({ domain: 'nonexistent' }) })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('DOC_NOT_FOUND')
  })

  it('returns guide for valid domain', async () => {
    const res = await GET(makeReq(), { params: Promise.resolve({ domain: 'utilities' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.domain).toBe('utilities')
    expect(json.data.guide).toContain('#')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run test/api/pipeline/docs.test.ts
```

Expected: FAIL — route doesn't exist.

- [ ] **Step 3: Create the docs route**

```typescript
// apps/web/src/app/api/pipeline/docs/[domain]/route.ts
import { NextRequest } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { authenticatePipeline, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { API_REGISTRY } from '@/lib/pipeline/api-registry'
import { pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'

const DOCS_DIR = join(process.cwd(), 'docs')

const DOMAIN_DOCS = new Map<string, string>()
for (const cap of API_REGISTRY.capabilities) {
  const filePath = join(DOCS_DIR, `cowork-docs-${cap.domain}.md`)
  if (existsSync(filePath)) {
    DOMAIN_DOCS.set(cap.domain, readFileSync(filePath, 'utf-8'))
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return pipelineError('UNAUTHORIZED', authResult.error, authResult.status)

  const guide = DOMAIN_DOCS.get(domain)
  const capability = API_REGISTRY.capabilities.find((c) => c.domain === domain)

  if (!guide || !capability) {
    const available = API_REGISTRY.capabilities.map((c) => c.domain)
    return pipelineError(
      'DOC_NOT_FOUND',
      `Domain "${domain}" not found. Available: ${available.join(', ')}`,
      404,
      authResult.auth,
    )
  }

  return pipelineSuccess({
    domain: capability.domain,
    name: capability.name,
    description: capability.description,
    guide,
  }, 200, authResult.auth)
}
```

- [ ] **Step 4: Create a minimal utilities doc for the test**

```bash
cat > docs/cowork-docs-utilities.md << 'DOCEOF'
# Utilities — Search, Context & Stats

## Search

`GET /api/pipeline/search?q={query}` — cross-entity search across pipeline items, blog posts, and newsletters.

Query params: `q` (search term), `type` (item|post|newsletter), `limit` (default 20, max 100).

## Context (References)

`GET /api/pipeline/context` — get all reference content.

Filters: `?group={group}`, `?skill={skill}`, `?format=md`.

`PUT /api/pipeline/context/:key` — upsert reference doc.

`DELETE /api/pipeline/context/:key` — delete reference doc.

## Stats

`GET /api/pipeline/stats` — aggregate pipeline statistics (total items by format/stage/priority, 7-day activity).

## Topics

`GET /api/pipeline/topics/:code` — topic aggregation showing pipeline items and blog posts for a given tag/topic.

## Workflows

`GET /api/pipeline/workflows` — get all workflow definitions and default checklists per format.
DOCEOF
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd apps/web && npx vitest run test/api/pipeline/docs.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/pipeline/docs/ apps/web/test/api/pipeline/docs.test.ts docs/cowork-docs-utilities.md
git commit -m "feat(pipeline): add GET /api/pipeline/docs/[domain] endpoint + utilities doc"
```

---

### Task 8: Reference Editor — Dynamic Groups from Directive

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/reference-editor.tsx`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/reference/page.tsx`

- [ ] **Step 1: Pass system groups from server to client**

In `apps/web/src/app/cms/(authed)/pipeline/reference/page.tsx`, fetch the `_system/groups` directive and pass it as a prop:

```typescript
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { ReferenceEditor } from '../_components/reference-editor'
import { REFERENCE_GROUPS } from '@/lib/pipeline/reference-groups'

export const dynamic = 'force-dynamic'

export default async function ReferencePage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const [{ data: docs }, { data: groupsDirective }] = await Promise.all([
    supabase
      .from('reference_content')
      .select('key, title, content_md, content_compact, ref_group, sort_order, updated_at')
      .eq('site_id', siteId)
      .order('ref_group')
      .order('sort_order')
      .order('key'),
    supabase
      .from('reference_content')
      .select('content_compact')
      .eq('site_id', siteId)
      .eq('key', '_system/groups')
      .single(),
  ])

  // Use directive groups if available, otherwise fall back to code defaults
  const dynamicGroups = (groupsDirective?.content_compact as { groups?: Array<{ id: string; label: string; color: string }> } | null)?.groups
  const groups = dynamicGroups ?? REFERENCE_GROUPS.map((g) => ({ id: g.id, label: g.label, color: g.color }))

  return (
    <>
      <CmsTopbar title="Pipeline — Reference" />
      <div className="p-6">
        <ReferenceEditor docs={docs ?? []} groups={groups} />
      </div>
    </>
  )
}
```

- [ ] **Step 2: Update ReferenceEditor to use dynamic groups prop**

In `apps/web/src/app/cms/(authed)/pipeline/_components/reference-editor.tsx`:

1. Add `groups` to the props interface:

```typescript
interface GroupDef {
  id: string
  label: string
  color: string
}

export function ReferenceEditor({ docs, groups }: { docs: ReferenceDoc[]; groups: GroupDef[] })
```

2. Replace ALL references to `REFERENCE_GROUPS` inside the component with the `groups` prop:
   - `grouped` useMemo: iterate `groups` instead of `REFERENCE_GROUPS`
   - `collapsed` state init: iterate `groups`
   - `collapseAll` / `expandAll`: iterate `groups`
   - Sidebar accordion: iterate `groups`
   - `getGroupMeta` calls: replace with inline lookup from `groups`

3. Create a local helper:

```typescript
function findGroup(groups: GroupDef[], groupId: string): GroupDef {
  return groups.find((g) => g.id === groupId) ?? groups[0]
}
```

4. Remove the import of `REFERENCE_GROUPS` from `@/lib/pipeline/reference-groups`. Keep `REFERENCE_USAGE` import for the "Used by" pills.

- [ ] **Step 3: Verify the page renders**

```bash
cd apps/web && npx next build 2>&1 | grep -E "(error|Error|✓|✗)" | head -20
```

Expected: Build succeeds.

- [ ] **Step 4: Run full test suite**

```bash
npm run test:web 2>&1 | tail -5
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/reference-editor.tsx apps/web/src/app/cms/(authed)/pipeline/reference/page.tsx
git commit -m "feat(pipeline): reference editor reads groups from _system/groups directive"
```

---

### Task 9: Reference Reorganization Migration

**Files:**
- Create: new migration via `npm run db:new reorganize_reference_groups`

**IMPORTANT:** Before writing the migration, verify actual keys in the DB. The keys below are from the migration backfill (20260514000003). Manually-created refs may have different keys — verify with a DB query first.

- [ ] **Step 1: Verify actual keys in prod**

```bash
npx tsx --env-file apps/web/.env.local -e "
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
sb.from('reference_content').select('key, ref_group, title').order('ref_group').order('key').then(({data}) => {
  for (const r of data ?? []) console.log(\`\${r.ref_group.padEnd(12)} \${r.key.padEnd(40)} \${r.title}\`);
});
"
```

Review the output and adjust the migration keys below as needed.

- [ ] **Step 2: Generate migration**

```bash
npm run db:new reorganize_reference_groups
```

- [ ] **Step 3: Write migration**

```sql
-- Reorganize reference groups: move misplaced refs, remove api group content migrated to Tier 2
-- IMPORTANT: keys verified against prod DB output in Step 1

BEGIN;

-- Get the site ID for bythiagofigueiredo.com
DO $$ DECLARE _site_id uuid;
BEGIN
  SELECT id INTO _site_id FROM public.sites WHERE domains @> ARRAY['bythiagofigueiredo.com'];
  IF _site_id IS NULL THEN RAISE EXCEPTION 'Site not found'; END IF;

  -- Pessoal → Estratégia
  UPDATE public.reference_content SET ref_group = 'estrategia'
  WHERE site_id = _site_id AND key IN (
    'content-calendar-taxonomy'
    -- Add more keys here based on Step 1 output
  );

  -- Pessoal → Craft
  UPDATE public.reference_content SET ref_group = 'craft'
  WHERE site_id = _site_id AND key IN (
    'featured-convention'
    -- Add more keys here based on Step 1 output
  );

  -- API → Craft (product eval methodology)
  UPDATE public.reference_content SET ref_group = 'craft'
  WHERE site_id = _site_id AND key IN ('product-eval-catalog', 'product-eval-reference');

  -- API → Pessoal (personal product experience)
  UPDATE public.reference_content SET ref_group = 'pessoal'
  WHERE site_id = _site_id AND key = 'product-eval-experience';

  -- Delete API docs migrated to Tier 2 domain docs
  DELETE FROM public.reference_content
  WHERE site_id = _site_id AND key IN ('cowork-section-schemas', 'playlist-graph-api');

END $$;

COMMIT;
```

- [ ] **Step 4: Push to prod**

```bash
npm run db:push:prod
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*reorganize_reference_groups*
git commit -m "fix(pipeline): reorganize reference groups — move misplaced refs, remove API docs migrated to Tier 2"
```

---

### Task 10: Domain Doc Files (Content)

**Files:**
- Create: `docs/cowork-docs-items-and-sections.md` (split from `docs/cowork-pipeline-reference.md` lines 8-1389)
- Create: `docs/cowork-docs-playlists.md` (copy from `docs/cowork-playlist-reference.md`)
- Create: `docs/cowork-docs-libraries.md` (split from `docs/cowork-pipeline-reference.md` lines 1390-1778)
- Create: `docs/cowork-docs-research.md` (split from lines 1390-1469 + expand)
- Create: `docs/cowork-docs-youtube.md` (copy from `docs/cowork-youtube-intelligence-reference.md`)
- Already created: `docs/cowork-docs-utilities.md` (Task 7)

- [ ] **Step 1: Split the 76KB pipeline reference doc**

```bash
# Items and sections: lines 1-1389 (API contract + all section schemas)
sed -n '1,1389p' docs/cowork-pipeline-reference.md > docs/cowork-docs-items-and-sections.md

# Libraries: Audio (lines 1472-1778) + prepend Research (lines 1390-1469) into separate file
sed -n '1472,1778p' docs/cowork-pipeline-reference.md > docs/cowork-docs-libraries.md

# Research: lines 1390-1469
sed -n '1390,1469p' docs/cowork-pipeline-reference.md > docs/cowork-docs-research.md
```

- [ ] **Step 2: Copy existing docs for playlists and youtube**

```bash
cp docs/cowork-playlist-reference.md docs/cowork-docs-playlists.md
cp docs/cowork-youtube-intelligence-reference.md docs/cowork-docs-youtube.md
```

- [ ] **Step 3: Add B-roll section to libraries doc**

Append B-roll documentation to `docs/cowork-docs-libraries.md`:

```bash
cat >> docs/cowork-docs-libraries.md << 'BROLLEOF'

---

# B-Roll Library

## Endpoints

### GET /api/pipeline/broll-library

List B-roll assets with filters.

Query params: `search`, `status` (active|retired), `tags`, `resolution`, `codec`, `limit` (default 50), `cursor`.

### POST /api/pipeline/broll-library

Create a B-roll asset. Required: `title`, `file_path`. Optional: `tags`, `duration_ms`, `fps`, `resolution`, `codec`, `metadata`.

### GET /api/pipeline/broll-library/:id

Get B-roll asset detail with usage info across pipeline items.

### PATCH /api/pipeline/broll-library/:id

Update B-roll asset. Requires `X-Expected-Version` header.

### DELETE /api/pipeline/broll-library/:id

Retire B-roll asset (soft delete).

### POST /api/pipeline/broll-library/import

Batch import B-roll assets. Supports `dry_run: true` to preview changes.
BROLLEOF
```

- [ ] **Step 4: Verify all 6 doc files exist**

```bash
ls -la docs/cowork-docs-*.md
```

Expected: 6 files (items-and-sections, playlists, libraries, research, youtube, utilities).

- [ ] **Step 5: Commit**

```bash
git add docs/cowork-docs-*.md
git commit -m "docs(pipeline): create 6 domain doc files for Tier 2 API docs endpoint"
```

---

### Task 11: Full Test Suite + Registry Completeness

**Files:**
- Create: `apps/web/test/api/pipeline/registry-completeness.test.ts`

- [ ] **Step 1: Write registry completeness test**

```typescript
// apps/web/test/api/pipeline/registry-completeness.test.ts
import { describe, it, expect } from 'vitest'
import { API_REGISTRY } from '@/lib/pipeline/api-registry'
import { readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'

function findRouteFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      results.push(...findRouteFiles(full))
    } else if (entry === 'route.ts') {
      results.push(full)
    }
  }
  return results
}

describe('Registry completeness', () => {
  const routeFiles = findRouteFiles(join(process.cwd(), 'src/app/api/pipeline'))
    .filter((f) => !f.includes('/docs/')) // Exclude the docs endpoint itself

  const registeredPaths = API_REGISTRY.capabilities.flatMap((c) =>
    c.endpoints.map((e) => e.path.replace(/\/api\/pipeline/, ''))
  )

  it('has at least 50 registered endpoints', () => {
    const total = API_REGISTRY.capabilities.reduce((sum, c) => sum + c.endpoints.length, 0)
    expect(total).toBeGreaterThanOrEqual(50)
  })

  it('every capability domain has a docs file', () => {
    for (const cap of API_REGISTRY.capabilities) {
      const docPath = join(process.cwd(), '..', '..', 'docs', `cowork-docs-${cap.domain}.md`)
      expect(existsSync(docPath), `Missing doc: cowork-docs-${cap.domain}.md`).toBe(true)
    }
  })

  it('route file count roughly matches registered endpoint count', () => {
    // Each route file can have multiple methods, so route files <= endpoints
    // But the root route.ts (catalog) is not a domain endpoint
    const catalogRoutes = 1 // route.ts itself
    const docsRoutes = 1 // docs/[domain]/route.ts
    const domainRouteCount = routeFiles.length - catalogRoutes - docsRoutes
    const totalEndpoints = API_REGISTRY.capabilities.reduce((s, c) => s + c.endpoints.length, 0)
    // Route files should be at most the number of endpoints (multiple methods per file)
    expect(domainRouteCount).toBeLessThanOrEqual(totalEndpoints)
    expect(domainRouteCount).toBeGreaterThan(20) // Sanity: we have many routes
  })
})
```

- [ ] **Step 2: Run the completeness test**

```bash
cd apps/web && npx vitest run test/api/pipeline/registry-completeness.test.ts
```

Expected: PASS

- [ ] **Step 3: Run the FULL test suite**

```bash
npm test
```

Expected: All 6500+ tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/test/api/pipeline/registry-completeness.test.ts
git commit -m "test(pipeline): add registry completeness and docs file validation tests"
```

---

## Post-Implementation Verification

After all tasks complete:

1. **Run seed script** to ensure _system/* directives are in prod:
   ```bash
   npx tsx --env-file apps/web/.env.local scripts/seed-pipeline-reference.ts
   ```

2. **Test the full Cowork flow manually:**
   ```bash
   # 1. Bootstrap
   curl -H "X-Pipeline-Key: pk_prod_91a4b68ad89b4ca708d128ca580a6edf34df0fcad20d5f14" \
     http://localhost:3000/api/pipeline/ | jq '.version, .capabilities | length, .directives | keys'

   # 2. Load domain docs
   curl -H "X-Pipeline-Key: pk_prod_91a4b68ad89b4ca708d128ca580a6edf34df0fcad20d5f14" \
     http://localhost:3000/api/pipeline/docs/utilities | jq '.data.domain'

   # 3. Filter context by skill
   curl -H "X-Pipeline-Key: pk_prod_91a4b68ad89b4ca708d128ca580a6edf34df0fcad20d5f14" \
     http://localhost:3000/api/pipeline/context?skill=ideator | jq '.data | length'

   # 4. Filter context by group
   curl -H "X-Pipeline-Key: pk_prod_91a4b68ad89b4ca708d128ca580a6edf34df0fcad20d5f14" \
     http://localhost:3000/api/pipeline/context?group=sistema | jq '.data | map(.key)'
   ```

3. **Verify reference editor UI** shows the new Sistema group and dynamic categories work.
