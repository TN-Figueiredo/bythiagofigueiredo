# Playlist Prompt Generator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a notes field and prompt generator to the playlist editor so the user can accumulate editorial context across sessions and generate structured prompts for the Cowork AI assistant.

**Architecture:** DB migration adds `notes jsonb` to playlists. The existing PATCH endpoint auto-accepts it via schema update. A new `prompt-builder.ts` compiles playlist state + notes + selected items + reuse candidates into a copy-pasteable prompt. The modal UI follows the existing pipeline `PromptGeneratorModal` pattern exactly.

**Tech Stack:** Next.js 15 + React 19 + TypeScript 5 + Supabase + Tiptap + Zod

**Spec:** `docs/superpowers/specs/2026-05-22-playlist-prompt-generator-design.md`

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/XXXXXX_playlist_notes.sql` (generated via `npm run db:new`)

- [ ] **Step 1: Generate migration file**

```bash
npm run db:new playlist_notes
```

This generates a timestamped file in `supabase/migrations/`.

- [ ] **Step 2: Write migration SQL**

Open the generated file and replace its contents with:

```sql
-- Playlist notes field for editorial context accumulation
ALTER TABLE public.playlists ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT NULL;
```

- [ ] **Step 3: Apply migration locally**

```bash
npm run db:reset
```

Expected: migration applies cleanly. Verify with:

```bash
npx supabase db diff --local
```

Expected: no diff (all migrations applied).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*_playlist_notes.sql
git commit -m "feat(playlist): add notes jsonb column to playlists table"
```

---

### Task 2: Type & Schema Updates

**Files:**
- Modify: `apps/web/src/lib/playlists/types.ts:87-102` — add `notes` to `PlaylistRow`
- Modify: `apps/web/src/lib/playlists/types.ts:128-137` — add `tags`, `hook`, `synopsis` to `PlaylistItemEnriched`
- Modify: `apps/web/src/lib/playlists/queries.ts:35-43` — extend `PipelineRef` with `tags`, `hook`, `synopsis`
- Modify: `apps/web/src/lib/playlists/queries.ts:190-193` — extend pipeline SELECT
- Modify: `apps/web/src/lib/playlists/queries.ts:243-250` — map new fields in enrichment
- Modify: `apps/web/src/lib/pipeline/schemas.ts:152-160` — add `notes` to `PipelineUpdatePlaylistSchema`

- [ ] **Step 1: Add `notes` to `PlaylistRow`**

In `apps/web/src/lib/playlists/types.ts`, add `notes` after `viewport_state` in the `PlaylistRow` interface:

```typescript
// In PlaylistRow, after line 98 (viewport_state):
  notes: Record<string, unknown> | null
```

The full interface becomes:

```typescript
export interface PlaylistRow {
  id: string
  site_id: string
  name_pt: string
  name_en: string
  slug: string
  description_pt: string | null
  description_en: string | null
  cover_image_url: string | null
  status: PlaylistStatus
  category: string | null
  viewport_state: { zoom: number; x: number; y: number } | null
  notes: Record<string, unknown> | null
  created_by: string | null
  created_at: string
  updated_at: string
}
```

Type is `Record<string, unknown> | null` (not `JSONContent`) to avoid importing `@tiptap/core` in server-side code.

- [ ] **Step 2: Add `tags`, `hook`, `synopsis` to `PlaylistItemEnriched`**

In `apps/web/src/lib/playlists/types.ts`, add three optional fields to `PlaylistItemEnriched` (after `language`):

```typescript
export interface PlaylistItemEnriched extends PlaylistItemRow {
  content_type: ContentType | null
  title: string
  status: string | null
  category: string | null
  metadata: string | null
  is_ghost: boolean
  other_playlist_count: number
  language: 'pt-br' | 'en' | null
  tags: string[]
  hook: string | null
  synopsis: string | null
}
```

These fields are populated only for pipeline items; blog posts and newsletters get `tags: []`, `hook: null`, `synopsis: null`.

- [ ] **Step 3: Extend pipeline enrichment query**

In `apps/web/src/lib/playlists/queries.ts`:

**3a.** Extend `PipelineRef` interface (line ~35) to add the new fields:

```typescript
interface PipelineRef {
  id: string
  title_pt: string | null
  title_en: string | null
  format: string | null
  stage: string | null
  version: number
  language: string | null
  tags: string[]
  hook: string | null
  synopsis: string | null
}
```

**3b.** Extend the pipeline SELECT (line ~192) to fetch the new columns:

```typescript
    pipelineIds.length > 0
      ? supabase
          .from('content_pipeline')
          .select('id, title_pt, title_en, format, stage, version, language, tags, hook, synopsis')
          .in('id', pipelineIds)
      : { data: [] },
```

**3c.** In the enrichment mapping (line ~243), add the new fields to the pipeline branch:

```typescript
    } else if (item.pipeline_id && pipelineMap.has(item.pipeline_id)) {
      const pl = pipelineMap.get(item.pipeline_id)!
      title = pl.title_pt ?? pl.title_en ?? 'Untitled'
      status = pl.stage
      category = pl.format
      metadata = `v${pl.version}`
      language = normalizeLang(pl.language)
      refId = item.pipeline_id
      tags = pl.tags ?? []
      hook = pl.hook ?? null
      synopsis = pl.synopsis ?? null
    }
```

**3d.** Declare `tags`, `hook`, `synopsis` variables with defaults at the top of the mapping function (next to the existing `let title`, `let status`, etc.):

```typescript
    let tags: string[] = []
    let hook: string | null = null
    let synopsis: string | null = null
```

**3e.** Include them in the returned object:

```typescript
    return {
      ...item,
      content_type: contentType,
      title,
      status,
      category,
      metadata,
      language,
      is_ghost: isGhost,
      other_playlist_count: refId ? (crossCounts.get(refId) ?? 0) : 0,
      tags,
      hook,
      synopsis,
    }
```

- [ ] **Step 4: Add `notes` to `PipelineUpdatePlaylistSchema`**

In `apps/web/src/lib/pipeline/schemas.ts`, add `notes` to `PipelineUpdatePlaylistSchema` after `cover_image_url`:

```typescript
export const PipelineUpdatePlaylistSchema = z.object({
  name_en: z.string().min(1).max(200).optional(),
  name_pt: z.string().max(200).optional(),
  description_en: z.string().max(1000).nullable().optional(),
  description_pt: z.string().max(1000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  status: z.enum(PLAYLIST_STATUSES).optional(),
  cover_image_url: z.string().url().nullable().optional(),
  notes: z.any().nullable().optional(),
})
```

`z.any()` because Tiptap `JSONContent` is a recursive tree — the editor guarantees valid shape.

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

Expected: no new errors. Existing code doesn't reference `notes` yet, so adding it to the interface is additive.

- [ ] **Step 4: Run tests**

```bash
npm run test:web 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/playlists/types.ts apps/web/src/lib/playlists/queries.ts apps/web/src/lib/pipeline/schemas.ts
git commit -m "feat(playlist): add notes to PlaylistRow, tags/hook/synopsis to enriched items, notes to API schema"
```

---

### Task 3: Server Action — `updatePlaylistNotes`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/playlists/actions.ts` — add new server action

- [ ] **Step 1: Add `updatePlaylistNotes` server action**

Add this function at the end of the file, before the `getPlaylistWithItems` function (before line ~556):

```typescript
// ─── Notes ───────────────────────────────────────────────────────────────────

export async function updatePlaylistNotes(
  playlistId: string,
  siteId: string,
  notes: Record<string, unknown> | null,
): Promise<ActionResult<void>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('playlists')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', playlistId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: undefined }
}
```

- [ ] **Step 2: Add `getReuseCandidates` server action**

Add this function after `updatePlaylistNotes`. It fetches pipeline items NOT in the current playlist, with their tags, for the prompt generator:

```typescript
export interface ReuseCandidateItem {
  id: string
  title: string
  format: string
  language: string
  stage: string
  tags: string[]
}

export async function getReuseCandidates(
  siteId: string,
  playlistId: string,
): Promise<ActionResult<ReuseCandidateItem[]>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()

  const [pipelineRes, playlistItemsRes] = await Promise.all([
    supabase
      .from('content_pipeline')
      .select('id, title_pt, title_en, format, stage, language, tags')
      .eq('site_id', siteId)
      .eq('is_archived', false)
      .limit(200),
    supabase
      .from('playlist_items')
      .select('pipeline_id, content_pipeline(tags)')
      .eq('playlist_id', playlistId)
      .not('pipeline_id', 'is', null),
  ])

  // Collect IDs already in the playlist
  const existingIds = new Set(
    ((playlistItemsRes.data ?? []) as { pipeline_id: string }[]).map(r => r.pipeline_id),
  )

  // Build the playlist's tag set from items already in it
  const playlistTagSet = new Set<string>()
  for (const row of (playlistItemsRes.data ?? []) as {
    pipeline_id: string
    content_pipeline: { tags: string[] } | null
  }[]) {
    for (const tag of row.content_pipeline?.tags ?? []) {
      playlistTagSet.add(tag)
    }
  }

  type PipelineRow = {
    id: string
    title_pt: string | null
    title_en: string | null
    format: string
    stage: string
    language: string
    tags: string[]
  }

  // Score candidates by tag overlap, then sort descending
  const scored: Array<{ item: ReuseCandidateItem; score: number }> = []
  for (const p of (pipelineRes.data ?? []) as PipelineRow[]) {
    if (existingIds.has(p.id)) continue
    if ((p.tags ?? []).length === 0) continue

    const score = p.tags.filter(t => playlistTagSet.has(t)).length

    scored.push({
      item: {
        id: p.id,
        title: p.title_en || p.title_pt || 'Untitled',
        format: p.format,
        language: p.language,
        stage: p.stage,
        tags: p.tags,
      },
      score,
    })
  }

  scored.sort((a, b) => b.score - a.score)

  return { ok: true, data: scored.slice(0, 15).map(s => s.item) }
}
```

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
npm run test:web 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/actions.ts
git commit -m "feat(playlist): add updatePlaylistNotes and getReuseCandidates server actions"
```

---

### Task 4: Prompt Builder

**Files:**
- Create: `apps/web/src/lib/playlists/prompt-builder.ts`

- [ ] **Step 1: Create prompt builder with types and helpers**

Create `apps/web/src/lib/playlists/prompt-builder.ts`:

```typescript
import type { PlaylistRow, PlaylistItemEnriched, PlaylistEdgeRow } from './types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ReuseCandidateItem {
  id: string
  title: string
  format: string
  language: string
  stage: string
  tags: string[]
}

export interface PlaylistPromptInput {
  playlist: PlaylistRow
  items: PlaylistItemEnriched[]
  edges: PlaylistEdgeRow[]
  focusedItemIds: string[]
  reuseCandidates: ReuseCandidateItem[]
  userInstructions: string
}

export interface PromptResult {
  text: string
  wordCount: number
  tbdCount: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOTES_WORD_LIMIT = 1500

function tiptapToMarkdown(json: Record<string, unknown> | null): string {
  if (!json) return ''
  const content = json.content as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(content)) return ''

  const lines: string[] = []
  for (const node of content) {
    const text = extractText(node)
    if (!text) continue

    switch (node.type) {
      case 'heading': {
        const level = ((node.attrs as Record<string, unknown>)?.level as number) ?? 3
        lines.push(`${'#'.repeat(level)} ${text}`)
        break
      }
      case 'bulletList':
      case 'orderedList':
        lines.push(text)
        break
      default:
        lines.push(text)
    }
  }
  return lines.join('\n')
}

function extractText(node: Record<string, unknown>): string {
  if (node.type === 'text') return (node.text as string) ?? ''
  const content = node.content as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(content)) return ''

  if (node.type === 'bulletList') {
    return content.map(li => `- ${extractText(li)}`).join('\n')
  }
  if (node.type === 'orderedList') {
    return content.map((li, i) => `${i + 1}. ${extractText(li)}`).join('\n')
  }
  return content.map(extractText).join('')
}

function truncateWords(text: string, limit: number): { text: string; truncated: boolean } {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length <= limit) return { text, truncated: false }
  return { text: words.slice(0, limit).join(' ') + '\n...(truncado)', truncated: true }
}

export function extractTextFromJSON(json: Record<string, unknown>): string {
  if (json.type === 'text') return (json.text as string) ?? ''
  const content = json.content as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(content)) return ''
  return content.map(extractTextFromJSON).join(' ')
}

// ---------------------------------------------------------------------------
// buildPlaylistPrompt
// ---------------------------------------------------------------------------

export function buildPlaylistPrompt(input: PlaylistPromptInput): PromptResult {
  const { playlist, items, edges, focusedItemIds, reuseCandidates, userInstructions } = input
  const sections: string[] = []

  const tbdCount = items.filter(i => /^TBD\b/i.test(i.title)).length

  // 1. Header
  const header = [
    `# Playlist: ${playlist.name_en || playlist.name_pt}`,
    `Status: ${playlist.status}${playlist.category ? ` | Categoria: ${playlist.category}` : ''}`,
    `Items: ${items.length} | Edges: ${edges.length}`,
  ]
  if (tbdCount > 0) header.push(`⚠ ${tbdCount} item(s) TBD — renomear com títulos descritivos`)
  sections.push(header.join('\n'))

  // 2. Notas & Decisões do Produtor
  if (playlist.notes) {
    const rawNotes = tiptapToMarkdown(playlist.notes)
    if (rawNotes.trim()) {
      const { text: notesText } = truncateWords(rawNotes, NOTES_WORD_LIMIT)
      sections.push(`## Notas & Decisões do Produtor\n\n${notesText}`)
    }
  }

  // 3. Items em Foco
  if (focusedItemIds.length > 0) {
    const focused = items.filter(i => focusedItemIds.includes(i.id))
    if (focused.length > 0) {
      const lines = focused.map(item => {
        const header = [
          `- **${item.title}**`,
          item.content_type ? `[${item.content_type}]` : null,
          item.language ? `[${item.language}]` : null,
          item.status ? `Stage: ${item.status}` : null,
          item.category ? `Format: ${item.category}` : null,
          item.tags.length > 0 ? `Tags: ${item.tags.join(', ')}` : null,
        ].filter(Boolean).join(' | ')
        const details: string[] = []
        if (item.hook) details.push(`  Hook: ${item.hook}`)
        if (item.synopsis) details.push(`  Synopsis: ${item.synopsis}`)
        return details.length > 0 ? `${header}\n${details.join('\n')}` : header
      })
      sections.push(`## Items em Foco (${focused.length})\n\n${lines.join('\n')}`)
    }
  }

  // 4. Grafo Completo (resumo)
  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order)
  const itemLines = sortedItems.map((item, i) => {
    const lang = item.language ? item.language.toUpperCase() : '??'
    const type = item.content_type ?? 'ghost'
    const tbd = /^TBD\b/i.test(item.title) ? ' ⚠TBD' : ''
    const ghost = item.is_ghost ? ' GHOST—content removed' : ''
    return `[${i + 1}] [${type}-${lang}] "${item.title}" — ${item.status ?? 'n/a'}${tbd}${ghost}`
  })

  let graphSection = `## Grafo Completo\n\n${itemLines.join('\n')}`

  if (edges.length > 0) {
    const edgeLines = edges.map(e => {
      const si = sortedItems.findIndex(i => i.id === e.source_item_id) + 1
      const ti = sortedItems.findIndex(i => i.id === e.target_item_id) + 1
      return `${si}->${ti}(${e.edge_type.slice(0, 3)})`
    })
    graphSection += `\n\nEdges: ${edgeLines.join(' ')}`
  }
  sections.push(graphSection)

  // 5. Candidatos para Reuso
  if (reuseCandidates.length > 0) {
    const top15 = reuseCandidates.slice(0, 15)
    const lines = top15.map(c =>
      `- "${c.title}" [${c.format}-${c.language.toUpperCase()}] Stage: ${c.stage} | Tags: ${c.tags.join(', ')}`,
    )
    sections.push(
      `## Candidatos para Reuso (${top15.length})\n\n` +
      `**PRIORIZE reutilizar items existentes antes de criar novos.**\n\n` +
      lines.join('\n'),
    )
  } else {
    sections.push('Nenhum candidato para reuso encontrado — considere criar novos items.')
  }

  // 6. Regras
  sections.push(
    `## Regras\n\n` +
    `1. GET first — sempre leia o estado atual antes de modificar\n` +
    `2. Priorize reuso de items existentes sobre criação de novos\n` +
    `3. Renomeie items TBD com títulos descritivos\n` +
    `4. Verifique notas do produtor antes de sugerir mudanças\n` +
    `5. Use modos Architect: BUILD, CONNECT, GAP, REORG, CAMPAIGN, COURSE\n` +
    `6. Auto-layout após modificações estruturais\n` +
    `7. Reporte resultado e sugira próximos passos`,
  )

  // 7. Instruções do Produtor
  if (userInstructions.trim()) {
    sections.push(`## Instruções do Produtor\n\n${userInstructions.trim()}`)
  } else {
    sections.push('## Instruções do Produtor\n\n(sem instruções adicionais)')
  }

  const text = sections.join('\n\n---\n\n')
  const wordCount = text.split(/\s+/).filter(Boolean).length

  return { text, wordCount, tbdCount }
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/playlists/prompt-builder.ts
git commit -m "feat(playlist): add prompt builder for playlist context compilation"
```

---

### Task 5: Prompt Builder Tests

**Files:**
- Create: `apps/web/test/unit/playlists/prompt-builder.test.ts`

- [ ] **Step 1: Create test file with fixtures and all test cases**

Create `apps/web/test/unit/playlists/prompt-builder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

import { buildPlaylistPrompt } from '@/lib/playlists/prompt-builder'
import type {
  PlaylistPromptInput,
  ReuseCandidateItem,
} from '@/lib/playlists/prompt-builder'
import type {
  PlaylistRow,
  PlaylistItemEnriched,
  PlaylistEdgeRow,
} from '@/lib/playlists/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const basePlaylist: PlaylistRow = {
  id: 'pl-001',
  site_id: 'site-001',
  name_pt: 'Minha Playlist',
  name_en: 'My Playlist',
  slug: 'my-playlist',
  description_pt: null,
  description_en: null,
  cover_image_url: null,
  status: 'draft',
  category: 'series',
  viewport_state: null,
  notes: null,
  created_by: 'user-001',
  created_at: '2026-05-22T00:00:00Z',
  updated_at: '2026-05-22T00:00:00Z',
}

function makeItem(overrides: Partial<PlaylistItemEnriched> = {}): PlaylistItemEnriched {
  return {
    id: 'item-001',
    playlist_id: 'pl-001',
    blog_post_id: null,
    newsletter_edition_id: null,
    pipeline_id: 'pip-001',
    sort_order: 0,
    position_x: 0,
    position_y: 0,
    created_at: '2026-05-22T00:00:00Z',
    content_type: 'pipeline',
    title: 'How to Record Pro Audio',
    status: 'draft',
    category: 'video',
    metadata: null,
    is_ghost: false,
    other_playlist_count: 0,
    language: 'en',
    tags: [],
    hook: null,
    synopsis: null,
    ...overrides,
  }
}

const baseEdge: PlaylistEdgeRow = {
  id: 'edge-001',
  playlist_id: 'pl-001',
  source_item_id: 'item-001',
  target_item_id: 'item-002',
  edge_type: 'sequence',
  label: null,
  created_at: '2026-05-22T00:00:00Z',
}

const baseReuse: ReuseCandidateItem = {
  id: 'reuse-001',
  title: 'Existing Pipeline Item',
  format: 'video',
  language: 'en',
  stage: 'published',
  tags: ['audio', 'production'],
}

function makeInput(overrides: Partial<PlaylistPromptInput> = {}): PlaylistPromptInput {
  return {
    playlist: basePlaylist,
    items: [makeItem()],
    edges: [baseEdge],
    focusedItemIds: [],
    reuseCandidates: [],
    userInstructions: '',
    ...overrides,
  }
}

function tiptapDoc(text: string): Record<string, unknown> {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  }
}

function longTiptapDoc(wordCount: number): Record<string, unknown> {
  const words = Array.from({ length: wordCount }, (_, i) => `word${i}`)
  return tiptapDoc(words.join(' '))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildPlaylistPrompt', () => {
  it('generates header with playlist name and stats', () => {
    const items = [makeItem(), makeItem({ id: 'item-002', title: 'Second Item', sort_order: 1 })]
    const edges = [baseEdge]
    const result = buildPlaylistPrompt(makeInput({ items, edges }))

    expect(result.text).toContain('# Playlist: My Playlist')
    expect(result.text).toContain('Status: draft')
    expect(result.text).toContain('Items: 2')
    expect(result.text).toContain('Edges: 1')
  })

  it('omits notes section when notes is null', () => {
    const result = buildPlaylistPrompt(
      makeInput({ playlist: { ...basePlaylist, notes: null } }),
    )
    expect(result.text).not.toContain('Notas & Decisões')
  })

  it('includes notes section when notes exist', () => {
    const playlist = {
      ...basePlaylist,
      notes: tiptapDoc('Decisão importante sobre o formato do curso'),
    }
    const result = buildPlaylistPrompt(makeInput({ playlist }))

    expect(result.text).toContain('Notas & Decisões')
    expect(result.text).toContain('Decisão importante sobre o formato do curso')
  })

  it('truncates notes over 1500 words', () => {
    const playlist = { ...basePlaylist, notes: longTiptapDoc(2000) }
    const result = buildPlaylistPrompt(makeInput({ playlist }))

    expect(result.text).toContain('(truncado)')
    // Should NOT contain the last word
    expect(result.text).not.toContain('word1999')
    // Should contain early words
    expect(result.text).toContain('word0')
  })

  it('omits focused items section when no items selected', () => {
    const result = buildPlaylistPrompt(makeInput({ focusedItemIds: [] }))
    expect(result.text).not.toContain('Items em Foco')
  })

  it('includes focused items when selectedItemIds provided', () => {
    const items = [
      makeItem({ id: 'item-A', title: 'Alpha Video' }),
      makeItem({ id: 'item-B', title: 'Beta Article', sort_order: 1 }),
    ]
    const result = buildPlaylistPrompt(
      makeInput({ items, focusedItemIds: ['item-A', 'item-B'] }),
    )

    expect(result.text).toContain('Items em Foco')
    expect(result.text).toContain('Alpha Video')
    expect(result.text).toContain('Beta Article')
  })

  it('includes tags, hook, and synopsis in focused items when available', () => {
    const items = [
      makeItem({
        id: 'item-A',
        title: 'Pro Audio Guide',
        tags: ['audio', 'production'],
        hook: 'Master your audio setup',
        synopsis: 'A deep dive into professional audio recording techniques',
      }),
    ]
    const result = buildPlaylistPrompt(
      makeInput({ items, focusedItemIds: ['item-A'] }),
    )

    expect(result.text).toContain('Tags: audio, production')
    expect(result.text).toContain('Hook: Master your audio setup')
    expect(result.text).toContain('Synopsis: A deep dive into professional audio recording techniques')
  })

  it('counts TBD items correctly', () => {
    const items = [
      makeItem({ id: 'i1', title: 'TBD', sort_order: 0 }),
      makeItem({ id: 'i2', title: 'tbd', sort_order: 1 }),
      makeItem({ id: 'i3', title: 'TBD something', sort_order: 2 }),
      makeItem({ id: 'i4', title: 'TBDX', sort_order: 3 }),
      makeItem({ id: 'i5', title: 'Real Title', sort_order: 4 }),
    ]
    const result = buildPlaylistPrompt(makeInput({ items }))

    // "TBD", "tbd", "TBD something" match /^TBD\b/i -> 3
    // "TBDX" does NOT match (no word boundary after D before X)
    // "Real Title" does NOT match
    expect(result.tbdCount).toBe(3)
  })

  it('marks ghost items in graph section', () => {
    const items = [
      makeItem({ id: 'ghost-1', title: 'Deleted Reference', is_ghost: true }),
    ]
    const result = buildPlaylistPrompt(makeInput({ items, edges: [] }))

    expect(result.text).toContain('GHOST')
    expect(result.text).toContain('Deleted Reference')
  })

  it('includes reuse candidates when provided', () => {
    const reuseCandidates = [
      { ...baseReuse, id: 'r1', title: 'Reusable Audio Guide' },
      { ...baseReuse, id: 'r2', title: 'Existing Video Course' },
    ]
    const result = buildPlaylistPrompt(makeInput({ reuseCandidates }))

    expect(result.text).toContain('Candidatos para Reuso')
    expect(result.text).toContain('Reusable Audio Guide')
    expect(result.text).toContain('Existing Video Course')
  })

  it('shows inline note when no reuse candidates', () => {
    const result = buildPlaylistPrompt(makeInput({ reuseCandidates: [] }))
    expect(result.text).toContain('Nenhum candidato')
  })

  it('includes user instructions in output', () => {
    const result = buildPlaylistPrompt(
      makeInput({ userInstructions: 'Foque em vídeos curtos de 3 minutos' }),
    )
    expect(result.text).toContain('Foque em vídeos curtos de 3 minutos')
    expect(result.text).toContain('Instruções do Produtor')
  })

  it('returns correct wordCount and tbdCount', () => {
    const items = [
      makeItem({ id: 'i1', title: 'TBD', sort_order: 0 }),
      makeItem({ id: 'i2', title: 'Real Item', sort_order: 1 }),
    ]
    const result = buildPlaylistPrompt(makeInput({ items, edges: [] }))

    // wordCount = total words in generated text
    const manualCount = result.text.split(/\s+/).filter(Boolean).length
    expect(result.wordCount).toBe(manualCount)
    expect(result.tbdCount).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests**

```bash
npm run test:web -- --run apps/web/test/unit/playlists/prompt-builder.test.ts 2>&1 | tail -20
```

Expected: all 12 tests pass. If any fail, fix the prompt builder (Task 4) or the test fixtures until green.

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/unit/playlists/prompt-builder.test.ts
git commit -m "test(playlist): add unit tests for buildPlaylistPrompt"
```

---

### Task 6: Settings Panel — Tabs + Notes Editor

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-settings.tsx` — restructure with tabs, add Tiptap notes editor

- [ ] **Step 1: Rewrite PlaylistSettings with tabs**

Replace the entire contents of `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-settings.tsx` with:

```typescript
'use client'

import { useState, useTransition, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { PlaylistRow, PlaylistStatus, ActionResult } from '@/lib/playlists/types'
import { PipelineEditor } from '@/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-editor'
import type { JSONContent } from '@tiptap/react'
import { extractTextFromJSON } from '@/lib/playlists/prompt-builder'

interface PlaylistSettingsProps {
  playlist: PlaylistRow
  itemCount: number
  edgeCount: number
  isOpen: boolean
  onClose: () => void
  onUpdate: (playlistId: string, siteId: string, input: unknown) => Promise<ActionResult<PlaylistRow>>
  onDelete: (playlistId: string, siteId: string) => Promise<ActionResult<void>>
  onSaveNotes: (playlistId: string, siteId: string, notes: Record<string, unknown> | null) => Promise<ActionResult<void>>
}

type SettingsTab = 'config' | 'notes'

export function PlaylistSettings({
  playlist,
  itemCount,
  edgeCount,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  onSaveNotes,
}: PlaylistSettingsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [namePt, setNamePt] = useState(playlist.name_pt)
  const [nameEn, setNameEn] = useState(playlist.name_en)
  const [slug, setSlug] = useState(playlist.slug)
  const [descriptionPt, setDescriptionPt] = useState(playlist.description_pt ?? '')
  const [descriptionEn, setDescriptionEn] = useState(playlist.description_en ?? '')
  const [category, setCategory] = useState(playlist.category ?? '')
  const [status, setStatus] = useState<PlaylistStatus>(playlist.status)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [activeTab, setActiveTab] = useState<SettingsTab>(playlist.notes ? 'notes' : 'config')
  const [noteSaveState, setNoteSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [noteWordCount, setNoteWordCount] = useState(() => {
    if (!playlist.notes) return 0
    return extractTextFromJSON(playlist.notes).split(/\s+/).filter(Boolean).length
  })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleNotesChange = useCallback(
    (content: JSONContent) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)

      const text = extractTextFromJSON(content)
      setNoteWordCount(text.split(/\s+/).filter(Boolean).length)

      debounceRef.current = setTimeout(() => {
        setNoteSaveState('saving')
        onSaveNotes(playlist.id, playlist.site_id, content as Record<string, unknown>).then(
          (result) => {
            setNoteSaveState(result.ok ? 'saved' : 'error')
            if (result.ok) setTimeout(() => setNoteSaveState('idle'), 2000)
          },
        )
      }, 2000)
    },
    [onSaveNotes, playlist.id, playlist.site_id],
  )

  if (!isOpen) return null

  function handleSave() {
    startTransition(async () => {
      try {
        const result = await onUpdate(playlist.id, playlist.site_id, {
          name_pt: namePt,
          name_en: nameEn,
          slug,
          description_pt: descriptionPt || null,
          description_en: descriptionEn || null,
          category: category || null,
          status,
        })
        if (result.ok) {
          setMessage({ type: 'success', text: 'Settings saved' })
          setTimeout(() => setMessage(null), 2000)
        } else {
          setMessage({ type: 'error', text: result.error })
        }
      } catch {
        setMessage({ type: 'error', text: 'Failed to save settings' })
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        const result = await onDelete(playlist.id, playlist.site_id)
        if (result.ok) {
          router.push('/cms/playlists')
        } else {
          setMessage({ type: 'error', text: result.error })
        }
      } catch {
        setMessage({ type: 'error', text: 'Failed to delete playlist' })
      }
    })
  }

  const fieldClasses = 'rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white'

  return (
    <div className="flex h-full w-80 flex-col border-l border-white/10 bg-[#0a0a12]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Settings</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-white/40 hover:text-white/70"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          type="button"
          onClick={() => setActiveTab('config')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'config'
              ? 'border-b-2 border-indigo-400 text-white'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          Config
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'notes'
              ? 'border-b-2 border-indigo-400 text-white'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          Notas
          {noteWordCount > 0 && (
            <span className="ml-1.5 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-300">
              {noteWordCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'config' ? (
          <>
            {/* Stats */}
            <div className="mb-4 flex gap-4 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/40">
              <span>{itemCount} items</span>
              <span>{edgeCount} edges</span>
            </div>

            {/* Fields */}
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-white/50">Name (EN)</span>
                <input type="text" value={nameEn} onChange={e => setNameEn(e.target.value)} className={fieldClasses} />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-white/50">Name (PT)</span>
                <input type="text" value={namePt} onChange={e => setNamePt(e.target.value)} className={fieldClasses} />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-white/50">Slug</span>
                <input
                  type="text"
                  value={slug}
                  onChange={e => setSlug(e.target.value)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs text-white/60"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-white/50">Description (EN)</span>
                <textarea value={descriptionEn} onChange={e => setDescriptionEn(e.target.value)} rows={2} className={fieldClasses} />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-white/50">Description (PT)</span>
                <textarea value={descriptionPt} onChange={e => setDescriptionPt(e.target.value)} rows={2} className={fieldClasses} />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-white/50">Category</span>
                <input type="text" value={category} onChange={e => setCategory(e.target.value)} className={fieldClasses} />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-white/50">Status</span>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as PlaylistStatus)}
                  className={fieldClasses}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            </div>

            {/* Message */}
            {message && (
              <p className={`mt-3 text-xs ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {message.text}
              </p>
            )}

            {/* Save button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Save Settings'}
            </button>

            {/* Delete */}
            <div className="mt-8 border-t border-white/10 pt-4">
              {showDeleteConfirm ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-red-400">
                    This will permanently delete the playlist and all its items and edges.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isPending}
                      className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Delete forever
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-xs text-red-400/60 hover:text-red-400"
                >
                  Delete playlist...
                </button>
              )}
            </div>
          </>
        ) : (
          /* Notes tab */
          <div className="flex flex-col gap-3">
            <div className="min-h-[140px]">
              <PipelineEditor
                content={playlist.notes as JSONContent | null}
                isEditing={true}
                onContentChange={handleNotesChange}
                preset="compact"
                placeholder="Anote ideias, decisões e contexto para a próxima discussão..."
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-white/30">
              <span>{noteWordCount} palavras</span>
              <span>
                {noteSaveState === 'saving' && 'Salvando...'}
                {noteSaveState === 'saved' && 'Auto-salvo ✓'}
                {noteSaveState === 'error' && <span className="text-red-400">Erro ao salvar</span>}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

Expected: no errors (but may warn about unused `onSaveNotes` not being wired yet from canvas — that's Task 9).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-settings.tsx
git commit -m "feat(playlist): restructure settings panel with config/notes tabs"
```

---

### Task 7: Toolbar — Add Prompt + Refresh Buttons

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-toolbar.tsx` — add `hasNotes`, `onOpenPrompt`, `onRefresh` props and buttons

- [ ] **Step 1: Update PlaylistToolbarProps and component**

In `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-toolbar.tsx`:

Add three new props to the interface (after `onToggleSettings`):

```typescript
interface PlaylistToolbarProps {
  playlistName: string
  status: PlaylistStatus
  saveState: SaveState
  canUndo: boolean
  canRedo: boolean
  zoomPercent: number
  onUndo: () => void
  onRedo: () => void
  onAutoLayout: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomToFit: () => void
  onToggleExportMenu: () => void
  onPrint: () => void
  exportButtonRef: React.RefObject<HTMLButtonElement | null>
  onToggleSettings: () => void
  hasNotes: boolean
  onOpenPrompt: () => void
  onRefresh: () => void
}
```

Update the destructured props in the function signature to include the three new props:

```typescript
export function PlaylistToolbar({
  playlistName,
  status,
  saveState,
  canUndo,
  canRedo,
  zoomPercent,
  onUndo,
  onRedo,
  onAutoLayout,
  onZoomIn,
  onZoomOut,
  onZoomToFit,
  onToggleExportMenu,
  onPrint,
  exportButtonRef,
  onToggleSettings,
  hasNotes,
  onOpenPrompt,
  onRefresh,
}: PlaylistToolbarProps) {
```

- [ ] **Step 2: Add Prompt and Refresh buttons to the toolbar**

In the JSX, between the Export button and the Settings button (after line 119), add:

```typescript
        <button
          type="button"
          onClick={onOpenPrompt}
          aria-label="Generate prompt"
          title="Generate prompt"
          className="rounded-md px-2 py-1 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-600/20"
        >
          Prompt
        </button>
        <ToolbarButton label="Refresh" onClick={onRefresh}>
          <RefreshIcon />
        </ToolbarButton>
```

- [ ] **Step 3: Wrap Settings button with notes indicator**

Replace the Settings button (line 120-122) with:

```typescript
        <div className="relative">
          <ToolbarButton label="Settings" onClick={onToggleSettings}>
            <SettingsIcon />
          </ToolbarButton>
          {hasNotes && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-indigo-400" />
          )}
        </div>
```

- [ ] **Step 4: Add RefreshIcon component**

Add this new icon function at the end of the file, with the other icons:

```typescript
function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}
```

- [ ] **Step 5: Run type check**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

Expected: type errors from canvas not passing the new props yet — that's expected and fixed in Task 9.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-toolbar.tsx
git commit -m "feat(playlist): add Prompt, Refresh buttons and notes indicator to toolbar"
```

---

### Task 8: Prompt Generator Modal

**Files:**
- Create: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/prompt-generator-modal.tsx`

- [ ] **Step 1: Create the modal component**

Create `apps/web/src/app/cms/(authed)/playlists/[id]/_components/prompt-generator-modal.tsx`:

```typescript
'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useFocusTrap } from '@/app/cms/(authed)/pipeline/_components/use-focus-trap'
import { buildPlaylistPrompt, extractTextFromJSON } from '@/lib/playlists/prompt-builder'
import type { ReuseCandidateItem } from '@/lib/playlists/prompt-builder'
import type { PlaylistRow, PlaylistItemEnriched, PlaylistEdgeRow } from '@/lib/playlists/types'

interface PlaylistPromptModalProps {
  playlist: PlaylistRow
  items: PlaylistItemEnriched[]
  edges: PlaylistEdgeRow[]
  selectedItemIds: string[]
  reuseCandidates: ReuseCandidateItem[]
  onClose: () => void
}

export function PlaylistPromptModal({
  playlist,
  items,
  edges,
  selectedItemIds,
  reuseCandidates,
  onClose,
}: PlaylistPromptModalProps) {
  const [instructions, setInstructions] = useState('')
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const handleTrapKeyDown = useFocusTrap(dialogRef)

  const focusedItems = useMemo(
    () => items.filter(item => selectedItemIds.includes(item.id)),
    [items, selectedItemIds],
  )

  const tbdCount = useMemo(
    () => items.filter(item => /^TBD\b/i.test(item.title)).length,
    [items],
  )

  const promptResult = useMemo(
    () => buildPlaylistPrompt({
      playlist,
      items,
      edges,
      focusedItemIds: selectedItemIds,
      reuseCandidates,
      userInstructions: instructions,
    }),
    [playlist, items, edges, selectedItemIds, reuseCandidates, instructions],
  )

  const fullPrompt = promptResult.text

  const notesWordCount = useMemo(() => {
    if (!playlist.notes) return 0
    return extractTextFromJSON(playlist.notes).split(/\s+/).filter(Boolean).length
  }, [playlist.notes])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fullPrompt).then(() => {
      setCopied(true)
    }).catch(() => {
      window.prompt('Copie o prompt abaixo:', fullPrompt)
    })
  }, [fullPrompt])

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  useEffect(() => {
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Gerar Prompt — ${playlist.name_en || playlist.name_pt}`}
        className="w-full max-w-lg rounded-lg border p-4 shadow-xl"
        style={{ borderColor: 'var(--gem-border)', backgroundColor: 'var(--gem-surface)' }}
        onKeyDown={handleTrapKeyDown}
      >
        {/* Header */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-indigo-600/20 text-base">
              🤖
            </span>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--gem-text)' }}>
              Gerar Prompt — Playlist
            </h2>
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--gem-dim)' }}>
            {playlist.name_en || playlist.name_pt}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded px-1.5 py-0.5" style={{ background: 'var(--gem-well)' }}>
              {playlist.status}
            </span>
            {playlist.category && (
              <span className="rounded px-1.5 py-0.5" style={{ background: 'var(--gem-well)' }}>
                {playlist.category}
              </span>
            )}
            <span className="rounded px-1.5 py-0.5" style={{ background: 'var(--gem-well)' }}>
              {items.length} items
            </span>
            <span className="rounded px-1.5 py-0.5" style={{ background: 'var(--gem-well)' }}>
              {edges.length} edges
            </span>
          </div>
        </div>

        {/* Items em foco */}
        {focusedItems.length > 0 && (
          <div className="mb-3 rounded-md p-2" style={{ background: 'var(--gem-well)' }}>
            <h3 className="text-xs font-medium" style={{ color: 'var(--gem-text)' }}>
              Items em foco ({focusedItems.length})
            </h3>
            <ul className="mt-1.5 flex flex-col gap-1">
              {focusedItems.map((item, i) => (
                <li key={item.id} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-[10px]" style={{ color: 'var(--gem-dim)' }}>
                    {i + 1}.
                  </span>
                  <span className="rounded px-1 py-0.5 text-[10px]" style={{ background: 'var(--gem-surface)' }}>
                    {item.content_type ?? 'ghost'}
                  </span>
                  <span style={{ color: 'var(--gem-text)' }}>{item.title}</span>
                  {item.status && (
                    <span className="rounded px-1 py-0.5 text-[10px]" style={{ background: 'var(--gem-surface)' }}>
                      {item.status}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[10px]" style={{ color: 'var(--gem-dim)' }}>
              Shift+click nos cards do canvas para selecionar/remover
            </p>
          </div>
        )}

        {/* Instructions input */}
        <textarea
          ref={textareaRef}
          value={instructions}
          onChange={(e) => { setInstructions(e.target.value); setCopied(false) }}
          placeholder="Descreva o que quer discutir ou alterar..."
          aria-label="Instruções para o prompt"
          className="w-full text-xs p-2.5 rounded-md resize-y"
          style={{
            background: 'var(--gem-well)',
            border: '1px solid var(--gem-border)',
            color: 'var(--gem-text)',
            minHeight: '60px',
            maxHeight: '120px',
          }}
          rows={3}
        />

        {/* Stats line */}
        <div className="mt-1.5 flex items-center gap-3 text-[10px]" style={{ color: 'var(--gem-dim)' }}>
          {tbdCount > 0 && <span>TBD: {tbdCount}</span>}
          {notesWordCount > 0 && <span>Notas: {notesWordCount} palavras</span>}
          <span>~{promptResult.wordCount} palavras no prompt</span>
        </div>

        {/* Preview toggle */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-[10px] hover:underline"
            style={{ color: 'var(--gem-accent)' }}
          >
            {showPreview ? 'Ocultar prompt' : 'Ver prompt completo'}
          </button>
        </div>

        {showPreview && (
          <pre
            className="mt-2 p-2.5 rounded-md text-[10px] overflow-y-auto"
            style={{
              maxHeight: '200px',
              background: 'var(--gem-well)',
              border: '1px solid var(--gem-border)',
              color: 'var(--gem-dim)',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
            }}
          >{fullPrompt}</pre>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center mt-3">
          <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>
            Cole no Claude Code
          </span>
          <div className="flex gap-1.5 items-center">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-xs rounded"
              style={{ border: '1px solid var(--gem-border)', color: 'var(--gem-muted)' }}
            >
              Cancelar
            </button>
            {copied ? (
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 text-xs font-semibold rounded"
                style={{ background: 'var(--gem-done)', color: 'white' }}
              >
                Copiado — fechar
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1 text-xs font-semibold rounded"
                style={{ background: 'var(--gem-accent)', color: 'white' }}
              >
                Copiar prompt
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/prompt-generator-modal.tsx
git commit -m "feat(playlist): add prompt generator modal component"
```

---

### Task 9: Wire Everything in Canvas + Page

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-canvas.tsx` — wire modal, notes, refresh, reuse candidates
- Modify: `apps/web/src/app/cms/(authed)/playlists/[id]/page.tsx` — pass new actions as props

- [ ] **Step 1: Update PlaylistCanvasProps**

In `playlist-canvas.tsx`, add new imports at the top:

```typescript
import { PlaylistPromptModal } from './prompt-generator-modal'
import type { ReuseCandidateItem } from '@/lib/playlists/prompt-builder'
```

Add new props to `PlaylistCanvasProps` (after `onFetchContent`):

```typescript
interface PlaylistCanvasProps {
  graph: PlaylistGraph
  siteId: string
  onSaveDelta: (siteId: string, input: unknown) => Promise<ActionResult<void>>
  onRemoveItem: (itemId: string, siteId: string) => Promise<ActionResult<void>>
  onCreateEdge: (siteId: string, input: unknown) => Promise<ActionResult<{ id: string }>>
  onDeleteEdge: (edgeId: string, siteId: string) => Promise<ActionResult<void>>
  onSaveViewport: (
    playlistId: string,
    siteId: string,
    viewport: { zoom: number; x: number; y: number },
  ) => Promise<ActionResult<void>>
  onUpdate: (playlistId: string, siteId: string, input: unknown) => Promise<ActionResult<PlaylistRow>>
  onDelete: (playlistId: string, siteId: string) => Promise<ActionResult<void>>
  onAddItem: (siteId: string, input: unknown) => Promise<ActionResult<{ id: string }>>
  onFetchContent: (siteId: string, playlistId: string) => Promise<ActionResult<PickerItem[]>>
  onSaveNotes: (playlistId: string, siteId: string, notes: Record<string, unknown> | null) => Promise<ActionResult<void>>
  onFetchReuseCandidates: (siteId: string, playlistId: string) => Promise<ActionResult<ReuseCandidateItem[]>>
}
```

Update the function destructuring to include the new props:

```typescript
export function PlaylistCanvas({
  graph,
  siteId,
  onSaveDelta,
  onRemoveItem,
  onCreateEdge,
  onDeleteEdge,
  onSaveViewport,
  onUpdate,
  onDelete,
  onAddItem,
  onFetchContent,
  onSaveNotes,
  onFetchReuseCandidates,
}: PlaylistCanvasProps) {
```

- [ ] **Step 2: Add new state variables**

After the existing `useState` calls (around line 101), add:

```typescript
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [reuseCandidates, setReuseCandidates] = useState<ReuseCandidateItem[]>([])
```

- [ ] **Step 3: Add reuse candidate loader**

After the state variables, add a useEffect to load reuse candidates:

```typescript
  useEffect(() => {
    onFetchReuseCandidates(siteId, graph.playlist.id).then((result) => {
      if (result.ok) setReuseCandidates(result.data)
    })
  }, [siteId, graph.playlist.id, onFetchReuseCandidates])
```

- [ ] **Step 4: Wire new props to PlaylistToolbar**

In the JSX where `<PlaylistToolbar>` is rendered (around line 750), add the three new props:

```typescript
      <PlaylistToolbar
        playlistName={graph.playlist.name_en || graph.playlist.name_pt}
        status={graph.playlist.status}
        saveState={saveState}
        canUndo={canUndo()}
        canRedo={canRedo()}
        zoomPercent={Math.round(camera.zoom * 100)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onAutoLayout={handleAutoLayout}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomToFit={handleZoomToFit}
        onToggleExportMenu={() => setShowExportMenu(prev => !prev)}
        onPrint={handlePrint}
        exportButtonRef={exportBtnRef}
        onToggleSettings={() => setShowSettings(prev => !prev)}
        hasNotes={!!graph.playlist.notes}
        onOpenPrompt={() => setShowPromptModal(true)}
        onRefresh={() => router.refresh()}
      />
```

- [ ] **Step 5: Wire `onSaveNotes` to PlaylistSettings**

In the JSX where `<PlaylistSettings>` is rendered, add the new prop:

```typescript
        <PlaylistSettings
          playlist={graph.playlist}
          itemCount={state.items.length}
          edgeCount={state.edges.length}
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onSaveNotes={onSaveNotes}
        />
```

- [ ] **Step 6: Add prompt modal render**

Before the closing `</div>` of the outer shell (before the `<PrintView>`, around line 1041), add:

```typescript
      {showPromptModal && (
        <PlaylistPromptModal
          playlist={graph.playlist}
          items={state.items}
          edges={state.edges}
          selectedItemIds={Array.from(state.selectedItemIds)}
          reuseCandidates={reuseCandidates}
          onClose={() => setShowPromptModal(false)}
        />
      )}
```

- [ ] **Step 7: Update page.tsx to pass new actions**

In `apps/web/src/app/cms/(authed)/playlists/[id]/page.tsx`, add the new imports:

```typescript
import {
  savePlaylistDelta,
  removeItemFromPlaylist,
  createEdge,
  deleteEdge,
  saveViewportState,
  updatePlaylist,
  deletePlaylist,
  addItemToPlaylist,
  getAvailableContent,
  updatePlaylistNotes,
  getReuseCandidates,
} from '../actions'
```

And add the new props to `<PlaylistCanvas>`:

```typescript
      <PlaylistCanvas
        graph={graph}
        siteId={siteId}
        onSaveDelta={savePlaylistDelta}
        onRemoveItem={removeItemFromPlaylist}
        onCreateEdge={createEdge}
        onDeleteEdge={deleteEdge}
        onSaveViewport={saveViewportState}
        onUpdate={updatePlaylist}
        onDelete={deletePlaylist}
        onAddItem={addItemToPlaylist}
        onFetchContent={getAvailableContent}
        onSaveNotes={updatePlaylistNotes}
        onFetchReuseCandidates={getReuseCandidates}
      />
```

- [ ] **Step 8: Run type check**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

Expected: no errors — all props are now wired.

- [ ] **Step 9: Run tests**

```bash
npm run test:web 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-canvas.tsx apps/web/src/app/cms/(authed)/playlists/[id]/page.tsx
git commit -m "feat(playlist): wire prompt modal, notes editor, and reuse candidates into canvas"
```

---

### Task 10: Cowork Reference Docs Update

**Files:**
- Modify: `docs/cowork-playlist-reference.md`
- Modify: `docs/cowork-playlist-architect-skill.md`

- [ ] **Step 1: Add `notes` to playlist reference**

In `docs/cowork-playlist-reference.md`, add a new section after the "Criar Playlist" section. Find the line `## Adicionar Item` and insert this BEFORE it:

```markdown
## Campo Notes

O campo `notes` armazena anotações editoriais do produtor em formato Tiptap JSONContent.

**Leitura:** GET /playlists/:id retorna `notes` como parte do objeto playlist.

**IMPORTANTE:** Notes são READ-ONLY para o Cowork. O produtor escreve notes manualmente no CMS ao longo de múltiplas sessões. O Cowork lê notes para contexto mas NUNCA escreve neste campo.

Exemplo de payload com notes no GET:
```json
{
  "id": "uuid",
  "name_en": "...",
  "notes": { "type": "doc", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Decisão: focar em vídeos curtos primeiro" }] }] },
  ...
}
```

Notes NULL = nenhuma anotação do produtor.
```

- [ ] **Step 2: Add PA7 and reuse rules to architect skill**

In `docs/cowork-playlist-architect-skill.md`:

1. Find the `| PA6 |` line in the Princípios table and add after it:

```markdown
| PA7 | Notes-first | Sempre leia playlist.notes (campo do GET /playlists/:id) antes de sugerir mudanças. Contém decisões acumuladas pelo produtor ao longo de múltiplas sessões. |
```

2. Find the BUILD mode section, specifically the line starting with `Fluxo:`. Add this sentence at the beginning of the fluxo:

```
Antes de criar novos pipeline items como placeholders (TBD), verifique items existentes com GET /items?search={tema}. O produtor prefere reutilizar items existentes. →
```

3. Find the GAP mode section, specifically the line starting with `Fluxo:`. Add this sentence at the end:

```
Ao listar gaps, considere as notas do produtor — podem conter decisões que explicam lacunas intencionais.
```

- [ ] **Step 3: Seed reference to DB**

```bash
npm run db:seed:reference
```

Expected: reference content synced to `reference_content` table.

- [ ] **Step 4: Commit**

```bash
git add docs/cowork-playlist-reference.md docs/cowork-playlist-architect-skill.md
git commit -m "docs(playlist): add notes field and reuse rules to Cowork reference"
```

---

### Task 11: Push Migration to Prod + Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npm test 2>&1 | tail -30
```

Expected: all tests pass (both api and web).

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Push migration to prod**

```bash
npm run db:push:prod
```

Expected: migration applies cleanly. Type `YES` when prompted.

- [ ] **Step 4: Start dev server and test manually**

```bash
npm run dev -w apps/web
```

Test these scenarios:
1. Open a playlist editor → open Settings → see Config/Notas tabs
2. Switch to Notas tab → type notes → see word count update → wait 2s → see "Auto-salvo ✓"
3. Close settings, see notes indicator dot on settings gear icon
4. Shift+click 2 cards to select → click Prompt button → see modal with focused items
5. Type instructions → click "Ver prompt completo" → verify all sections present
6. Click "Copiar prompt" → paste somewhere → verify prompt text is complete
7. Click Refresh → page reloads
8. Open prompt with no items selected → verify "Items em Foco" section is absent
