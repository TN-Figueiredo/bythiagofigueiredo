# Newsletter Edition Editor Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the newsletter edition editor to fix two problems: (1) orphan drafts from immediate DB INSERT on "New Edition", and (2) ugly 30/100 light-theme UI clashing with the dark hub.

**Architecture:** Replace server-side INSERT on `/cms/newsletters/new` with an ephemeral editor that defers persistence until first meaningful edit (isDirty pattern). Overhaul the entire editor from flat light-theme CSS vars to a focused dark-theme writer (Approach A: Focused Writer) with hero inputs, inline segment, compact toolbar, and state-aware chrome.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, TipTap, Sonner toasts, Supabase, Vitest.

**Design Spec:** `docs/superpowers/specs/2026-05-02-newsletter-editor-redesign-design.md`

**Visual Mockups:** `.superpowers/brainstorm/24183-1777743683/content/editor-states.html` (100/100 rating)

---

## File Structure

### Files to Modify

| File | Responsibility |
|------|---------------|
| `newsletters/actions.ts` | Modify `createEdition` to accept optional `newsletter_type_id` and richer payload |
| `newsletters/_components/editor-styles.css` | Replace light-theme CSS vars with dark hardcoded values |
| `newsletters/_components/autosave-indicator.tsx` | Dark theme + timestamp format |
| `newsletters/_components/use-autosave.ts` | Support ephemeral mode (`editionId: string \| null`) |
| `newsletters/_components/editor-toolbar.tsx` | Dark theme + word/char count display |
| `newsletters/_components/schedule-modal.tsx` | Dark theme restyle |
| `newsletters/_components/send-now-modal.tsx` | Dark theme restyle + summary card |
| `newsletters/_components/delete-confirm-modal.tsx` | Dark theme restyle + edition info |
| `newsletters/_components/email-preview.tsx` | Dark frame + device toggle + Send Test button |
| `newsletters/_components/navigation-guard.tsx` | Custom dark dialog replacing `window.confirm` |
| `newsletters/_components/read-only-overlay.tsx` | Dark theme + lock icon + per-status message |
| `newsletters/[id]/edit/edition-editor.tsx` | Complete rewrite: dark layout, isDirty, top bar, hero inputs, state machine |
| `newsletters/new/page.tsx` | Remove DB INSERT, render ephemeral editor |
| `newsletters/[id]/edit/page.tsx` | Dark background wrapper |

### New Files

| File | Responsibility |
|------|---------------|
| `newsletters/_components/contextual-banner.tsx` | State-aware banner (hint, schedule countdown, sending progress, error) |
| `newsletters/_components/more-menu.tsx` | "..." dropdown with state-dependent items |
| `newsletters/_components/type-selector.tsx` | Type badge dropdown for top bar |
| `newsletters/_components/stats-strip.tsx` | Inline stats for Sent/Failed states |
| `newsletters/_components/send-test-modal.tsx` | Send test email dialog |

### Test Files

| File | Change |
|------|--------|
| `test/unit/newsletter/actions-status-matrix.test.ts` | Add `createEdition` tests for ephemeral payload |
| `test/cms/newsletters.test.tsx` | Update for new editor props if needed |
| `test/unit/newsletter/editor-components.test.tsx` | NEW — tests for contextual-banner, more-menu, type-selector, stats-strip |

---

### Task 1: Modify `createEdition` Server Action

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts:80-117`
- Test: `apps/web/test/unit/newsletter/actions-status-matrix.test.ts`

The existing `createEdition(newsletterTypeId: string, subject: string)` requires `newsletterTypeId` as mandatory. For ephemeral mode, the editor may not have a type selected yet. We modify the signature to accept a data object with optional `newsletter_type_id`.

- [ ] **Step 1: Write failing tests for new `createEdition` signature**

Add tests to `apps/web/test/unit/newsletter/actions-status-matrix.test.ts`:

```typescript
// Add createEdition to the import at line 108-116
import {
  saveEdition,
  createEdition,
  scheduleEdition,
  cancelEdition,
  sendNow,
  revertToDraft,
  sendTestEmail,
} from '@/app/cms/(authed)/newsletters/actions'

// Add test section after the imports
describe('createEdition — ephemeral payload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates edition with subject only (no type)', async () => {
    mockSupabase = createMockSupabase('draft')
    const result = await createEdition({ subject: 'My Newsletter' })
    expect(result.ok).toBe(true)
    expect(result).toHaveProperty('editionId')
  })

  it('creates edition with full payload', async () => {
    mockSupabase = createMockSupabase('draft')
    const result = await createEdition({
      subject: 'Full Edition',
      preheader: 'Preview text',
      newsletter_type_id: 'type-1',
      content_json: '{"type":"doc","content":[]}',
      content_html: '<p>Hello</p>',
      segment: 'all',
    })
    expect(result.ok).toBe(true)
    expect(result).toHaveProperty('editionId')
  })

  it('rejects empty subject', async () => {
    mockSupabase = createMockSupabase('draft')
    const result = await createEdition({ subject: '' })
    expect(result.ok).toBe(false)
    expect(result).toHaveProperty('error', 'subject_required')
  })

  it('rejects inactive type when type_id is provided', async () => {
    mockSupabase = createMockSupabase('draft')
    // Override the type lookup to return inactive
    const originalFrom = mockSupabase.from
    vi.spyOn(mockSupabase as any, 'from').mockImplementation((table: string) => {
      if (table === 'newsletter_types') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { id: 'type-1', active: false }, error: null }),
              }),
            }),
          }),
        }
      }
      return (originalFrom as any)(table)
    })
    const result = await createEdition({ subject: 'Test', newsletter_type_id: 'type-1' })
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/unit/newsletter/actions-status-matrix.test.ts`
Expected: FAIL — `createEdition` doesn't accept the new object signature

- [ ] **Step 3: Implement new `createEdition` signature**

Replace the existing `createEdition` function at `actions.ts:80-117` with:

```typescript
export async function createEdition(
  data: {
    subject: string
    preheader?: string
    content_json?: string
    content_html?: string
    newsletter_type_id?: string | null
    segment?: string
  },
): Promise<ActionResult> {
  if (!data.subject?.trim()) return { ok: false, error: 'subject_required' }

  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const supabase = getSupabaseServiceClient()

  if (data.newsletter_type_id) {
    const { data: type } = await supabase
      .from('newsletter_types')
      .select('id, active')
      .eq('id', data.newsletter_type_id)
      .eq('site_id', ctx.siteId)
      .single()

    if (!type) return { ok: false, error: 'type_not_found' }
    if (!type.active) return { ok: false, error: 'type_inactive' }
  }

  const userClient = await getUserClient()
  const { data: { user } } = await userClient.auth.getUser()

  const insertPayload: Record<string, unknown> = {
    site_id: ctx.siteId,
    newsletter_type_id: data.newsletter_type_id ?? null,
    subject: data.subject.trim(),
    status: 'draft',
    created_by: user?.id,
  }
  if (data.preheader) insertPayload.preheader = data.preheader
  if (data.content_json) insertPayload.content_json = JSON.parse(data.content_json)
  if (data.content_html) insertPayload.content_html = data.content_html
  if (data.segment) insertPayload.segment = data.segment

  const { data: row, error } = await supabase
    .from('newsletter_editions')
    .insert(insertPayload)
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  revalidateNewsletterHub()
  return { ok: true, editionId: row.id }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/unit/newsletter/actions-status-matrix.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Verify existing callers still compile**

The only caller of `createEdition` is `newsletters/new/page.tsx` which will be rewritten in Task 18. For now, ensure the old call site still exists but will be removed later.

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/actions.ts apps/web/test/unit/newsletter/actions-status-matrix.test.ts
git commit -m "feat(newsletter-editor): modify createEdition to accept ephemeral payload"
```

---

### Task 2: Dark Theme — `editor-styles.css`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_components/editor-styles.css`

Replace all light-theme CSS variables with dark hardcoded values per the spec color token system.

- [ ] **Step 1: Replace the entire CSS file**

Replace `editor-styles.css` with dark theme values. Key changes:
- Root variables: `--editor-bg: #030712`, `--editor-text: #d1d5db`, `--editor-border: #1f2937`
- ProseMirror body: `color: #d1d5db`, `font-size: 15px`, `line-height: 1.75`, `max-width: 740px`, `padding: 24px 64px`
- Headings: `color: #f3f4f6`
- Blockquote: `border-left: 3px solid #6366f1`, `color: #9ca3af`
- Code inline: `background-color: #111827`, `color: #c4b5fd`
- Code block: `background-color: #0f172a`, `color: #e2e8f0`, `border: 1px solid #1f2937`
- Placeholder: `color: #4b5563`
- Selection: `background-color: rgba(99, 102, 241, 0.25)`
- Gap cursor: `border-top-color: #6366f1`
- Images: selected outline `#7c3aed`
- Empty image placeholder: `background: #111827`, `border: 2px dashed #1f2937`
- HR: `border-top: 1px solid #1f2937`
- Remove `max-height: calc(100vh - 320px)` — the new layout handles height via flex

```css
.newsletter-editor {
  --editor-bg: #030712;
  --editor-text: #d1d5db;
  --editor-text-secondary: #9ca3af;
  --editor-text-tertiary: #6b7280;
  --editor-border: #1f2937;
  --editor-surface-hover: #111827;
  background-color: #030712;
  color: #d1d5db;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.newsletter-editor .ProseMirror {
  outline: none;
  min-height: 400px;
  padding: 24px 64px;
  max-width: 740px;
  margin: 0 auto;
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 15px;
  line-height: 1.75;
  color: #d1d5db;
}

.newsletter-editor .ProseMirror h1 {
  font-size: 1.875rem;
  font-weight: 700;
  line-height: 1.2;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  color: #f3f4f6;
}

.newsletter-editor .ProseMirror h2 {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.3;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  color: #f3f4f6;
}

.newsletter-editor .ProseMirror h3 {
  font-size: 1.0625rem;
  font-weight: 600;
  line-height: 1.4;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  color: #f3f4f6;
}

.newsletter-editor .ProseMirror p {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  line-height: 1.75;
}

.newsletter-editor .ProseMirror ul {
  list-style-type: disc;
  padding-left: 1.5rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.newsletter-editor .ProseMirror ol {
  list-style-type: decimal;
  padding-left: 1.5rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.newsletter-editor .ProseMirror li {
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
}

.newsletter-editor .ProseMirror li p {
  margin: 0;
}

.newsletter-editor .ProseMirror a {
  color: #a78bfa;
  text-decoration: underline;
  text-decoration-color: rgba(167, 139, 250, 0.3);
  text-underline-offset: 2px;
  cursor: pointer;
  transition: text-decoration-color 0.15s;
}

.newsletter-editor .ProseMirror a:hover {
  color: #c4b5fd;
  text-decoration-color: rgba(196, 181, 253, 0.6);
}

.newsletter-editor .ProseMirror blockquote {
  border-left: 3px solid #6366f1;
  padding-left: 1rem;
  margin-left: 0;
  margin-top: 0.75rem;
  margin-bottom: 0.75rem;
  color: #9ca3af;
  font-style: italic;
}

.newsletter-editor .ProseMirror hr {
  border: none;
  border-top: 1px solid #1f2937;
  margin: 1.5rem 0;
}

.newsletter-editor .ProseMirror img {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin: 1rem 0;
  display: block;
}

.newsletter-editor .ProseMirror img.ProseMirror-selectednode {
  outline: 2px solid #7c3aed;
  outline-offset: 2px;
  border-radius: 0.5rem;
}

.newsletter-editor .ProseMirror img:not([src]),
.newsletter-editor .ProseMirror img[src=""] {
  min-height: 80px;
  background: #111827;
  border: 2px dashed #1f2937;
  border-radius: 0.5rem;
}

.newsletter-editor .ProseMirror code {
  background-color: #111827;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
  font-family: ui-monospace, monospace;
  color: #c4b5fd;
}

.newsletter-editor .ProseMirror pre {
  background-color: #0f172a;
  color: #e2e8f0;
  border-radius: 0.5rem;
  padding: 1rem;
  overflow-x: auto;
  margin: 0.75rem 0;
  border: 1px solid #1f2937;
}

.newsletter-editor .ProseMirror pre code {
  background: none;
  padding: 0;
  color: inherit;
}

.newsletter-editor .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #4b5563;
  pointer-events: none;
  height: 0;
}

.newsletter-editor .ProseMirror ::selection {
  background-color: rgba(99, 102, 241, 0.25);
}

.newsletter-editor .ProseMirror .ProseMirror-gapcursor:after {
  border-top-color: #6366f1;
}

.newsletter-editor.fullscreen {
  position: fixed;
  inset: 0;
  z-index: 50;
}

.newsletter-editor.fullscreen .ProseMirror {
  min-height: unset;
  flex: 1;
}

.newsletter-editor.read-only .ProseMirror h1,
.newsletter-editor.read-only .ProseMirror h2,
.newsletter-editor.read-only .ProseMirror h3 {
  color: #9ca3af;
}

.newsletter-editor.read-only .ProseMirror {
  color: #6b7280;
}

.newsletter-editor.read-only .ProseMirror a {
  color: #818cf8;
}

.newsletter-editor.read-only .ProseMirror blockquote {
  border-left-color: #374151;
}
```

- [ ] **Step 2: Visual verification**

Start dev server and navigate to `/cms/newsletters/<any-edition-id>/edit`. Verify:
- Dark background `#030712`
- Content text is `#d1d5db`
- Headings are `#f3f4f6`
- Links are purple `#a78bfa`
- Code blocks have dark surface

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_components/editor-styles.css
git commit -m "feat(newsletter-editor): migrate editor-styles.css to dark theme"
```

---

### Task 3: Dark Theme — `autosave-indicator.tsx`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_components/autosave-indicator.tsx`

- [ ] **Step 1: Update component with dark theme colors**

Replace the entire component. Key changes:
- Dot colors match spec: green `#22c55e`, yellow pulsing `#eab308`, gray `#6b7280`, red `#ef4444`, orange `#f97316`
- Text colors per state: saved `#4b5563`, saving `#eab308`, unsaved `#6b7280`, error `#ef4444` (with clickable "retry"), offline `#f97316`
- Show time in "Saved HH:MM" format
- Error state shows "Save failed — retry" as clickable text

```typescript
'use client'

import type { SaveState } from './use-autosave'

interface AutosaveIndicatorProps {
  state: SaveState
  lastSavedAt: Date | null
  onRetry?: () => void
}

const STATE_CONFIG: Record<SaveState, { dotClass: string; textColor: string; label: string }> = {
  saving: { dotClass: 'bg-[#eab308] animate-pulse', textColor: 'text-[#eab308]', label: 'Saving...' },
  saved: { dotClass: 'bg-[#22c55e]', textColor: 'text-[#4b5563]', label: 'Saved' },
  unsaved: { dotClass: 'bg-[#6b7280]', textColor: 'text-[#6b7280]', label: 'Unsaved' },
  error: { dotClass: 'bg-[#ef4444]', textColor: 'text-[#ef4444]', label: 'Save failed' },
  offline: { dotClass: 'bg-[#f97316]', textColor: 'text-[#f97316]', label: 'Offline — saved locally' },
}

export function AutosaveIndicator({ state, lastSavedAt, onRetry }: AutosaveIndicatorProps) {
  const config = STATE_CONFIG[state]
  return (
    <div className={`flex items-center gap-1.5 text-[10px] ${config.textColor}`}>
      <span className={`h-[5px] w-[5px] rounded-full ${config.dotClass}`} />
      {state === 'error' && onRetry ? (
        <button type="button" onClick={onRetry} className="underline decoration-dotted hover:decoration-solid">
          Save failed — retry
        </button>
      ) : (
        <span>
          {config.label}
          {state === 'saved' && lastSavedAt && (
            <> {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
          )}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_components/autosave-indicator.tsx
git commit -m "feat(newsletter-editor): dark theme autosave indicator with retry"
```

---

### Task 4: Ephemeral Mode — `use-autosave.ts`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_components/use-autosave.ts`

The hook currently requires `editionId: string`. For ephemeral mode, it must accept `editionId: string | null` and disable saving when null.

- [ ] **Step 1: Update `AutosaveOptions` interface**

Change `editionId: string` to `editionId: string | null`. When `editionId` is null, `scheduleSave` and `saveNow` are no-ops. The `enabled` flag already covers most of this, but `editionId` being null should also prevent localStorage operations.

```typescript
interface AutosaveOptions {
  editionId: string | null
  saveFn: (data: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>
  debounceMs?: number
  maxRetries?: number
  enabled?: boolean
}
```

- [ ] **Step 2: Guard `doSave` and localStorage against null editionId**

In `doSave`, add early return: `if (!editionId) return`

In the localStorage effect (line 86-95), add: `if (!editionId) return`

In `scheduleSave`, the `!enabled` guard already handles this, but add `if (!editionId) return` for safety.

- [ ] **Step 3: Update localStorage key to handle null**

Change `LS_PREFIX` usage: `const lsKey = editionId ? \`${LS_PREFIX}${editionId}\` : null`

Guard all `localStorage.getItem/setItem/removeItem` calls with `if (lsKey)`.

- [ ] **Step 4: Run existing autosave tests to verify no regression**

Run: `cd apps/web && npx vitest run test/unit/newsletter/actions-status-matrix.test.ts`
Expected: PASS (autosave is not tested here but edition-editor uses it)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_components/use-autosave.ts
git commit -m "feat(newsletter-editor): autosave supports ephemeral mode (null editionId)"
```

---

### Task 5: New Component — `contextual-banner.tsx`

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/contextual-banner.tsx`
- Test: `apps/web/test/unit/newsletter/editor-components.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/test/unit/newsletter/editor-components.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContextualBanner } from '@/app/cms/(authed)/newsletters/_components/contextual-banner'

describe('ContextualBanner', () => {
  it('renders ephemeral hint for null editionId', () => {
    render(<ContextualBanner status={null} scheduledAt={null} sendProgress={null} errorMessage={null} />)
    expect(screen.getByText(/will be created when you start typing/)).toBeTruthy()
  })

  it('renders schedule countdown for scheduled status', () => {
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString()
    render(<ContextualBanner status="scheduled" scheduledAt={future} sendProgress={null} errorMessage={null} />)
    expect(screen.getByText(/Scheduled for/)).toBeTruthy()
  })

  it('renders sending progress', () => {
    render(<ContextualBanner status="sending" scheduledAt={null} sendProgress={{ sent: 84, total: 120 }} errorMessage={null} />)
    expect(screen.getByText(/84 \/ 120 sent/)).toBeTruthy()
  })

  it('renders error banner for failed status', () => {
    render(<ContextualBanner status="failed" scheduledAt={null} sendProgress={null} errorMessage="SMTP timeout" />)
    expect(screen.getByText(/SMTP timeout/)).toBeTruthy()
  })

  it('renders nothing for draft status', () => {
    const { container } = render(<ContextualBanner status="draft" scheduledAt={null} sendProgress={null} errorMessage={null} />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/editor-components.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `contextual-banner.tsx`**

```typescript
'use client'

import { Info, Clock, Loader2, XCircle } from 'lucide-react'

interface ContextualBannerProps {
  status: string | null
  scheduledAt: string | null
  sendProgress: { sent: number; total: number } | null
  errorMessage: string | null
}

export function ContextualBanner({ status, scheduledAt, sendProgress, errorMessage }: ContextualBannerProps) {
  if (status === null) {
    return (
      <div className="flex items-center gap-2 px-5 py-2.5 border-b" style={{ background: 'rgba(99,102,241,0.04)', borderColor: 'rgba(99,102,241,0.1)' }}>
        <Info size={14} className="text-[#818cf8] shrink-0" />
        <span className="text-xs text-[#9ca3af]">
          This edition will be created when you start typing. Navigate away to discard.
        </span>
      </div>
    )
  }

  if (status === 'scheduled' && scheduledAt) {
    const scheduledDate = new Date(scheduledAt)
    const diff = scheduledDate.getTime() - Date.now()
    const days = Math.max(0, Math.ceil(diff / 86_400_000))
    const timeLabel = days === 0 ? 'today' : days === 1 ? 'in 1 day' : `in ${days} days`

    return (
      <div className="flex items-center justify-between px-5 py-2.5 border-b" style={{ background: 'rgba(168,85,247,0.05)', borderColor: 'rgba(168,85,247,0.12)' }}>
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-[#c084fc] shrink-0" />
          <span className="text-xs text-[#d1d5db]">
            Scheduled for{' '}
            <strong>{scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
          </span>
        </div>
        <span className="text-xs text-[#9ca3af]">Sends {timeLabel}</span>
      </div>
    )
  }

  if (status === 'sending' && sendProgress) {
    const pct = sendProgress.total > 0 ? (sendProgress.sent / sendProgress.total) * 100 : 0
    return (
      <div className="border-b" style={{ background: 'rgba(59,130,246,0.05)', borderColor: 'rgba(59,130,246,0.12)' }}>
        <div className="flex items-center gap-2 px-5 py-2.5">
          <Loader2 size={14} className="text-[#60a5fa] shrink-0 animate-spin" />
          <span className="text-xs text-[#d1d5db]">Sending to subscribers...</span>
          <span className="text-xs text-[#9ca3af] ml-auto">{sendProgress.sent} / {sendProgress.total} sent</span>
        </div>
        <div className="h-[3px] bg-[#1e3a5f]">
          <div className="h-full bg-[#3b82f6] transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  if (status === 'failed' && errorMessage) {
    return (
      <div className="flex items-center gap-2 px-5 py-2.5 border-b" style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.15)' }}>
        <XCircle size={14} className="text-[#f87171] shrink-0" />
        <span className="text-xs text-[#f87171]">{errorMessage}</span>
      </div>
    )
  }

  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/newsletter/editor-components.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_components/contextual-banner.tsx apps/web/test/unit/newsletter/editor-components.test.tsx
git commit -m "feat(newsletter-editor): contextual banner component (hint/schedule/sending/error)"
```

---

### Task 6: New Component — `more-menu.tsx`

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/more-menu.tsx`
- Test: `apps/web/test/unit/newsletter/editor-components.test.tsx` (append)

- [ ] **Step 1: Write failing test**

Append to `editor-components.test.tsx`:

```typescript
import { MoreMenu } from '@/app/cms/(authed)/newsletters/_components/more-menu'

describe('MoreMenu', () => {
  const noop = vi.fn()

  it('shows draft menu items', () => {
    render(
      <MoreMenu
        status="draft"
        onSendTest={noop}
        onDuplicate={noop}
        onSendNow={noop}
        onDelete={noop}
      />
    )
    const trigger = screen.getByTitle('More actions')
    fireEvent.click(trigger)
    expect(screen.getByText('Send Test Email')).toBeTruthy()
    expect(screen.getByText('Duplicate')).toBeTruthy()
    expect(screen.getByText('Send Now...')).toBeTruthy()
    expect(screen.getByText('Delete')).toBeTruthy()
  })

  it('shows sent menu items', () => {
    render(
      <MoreMenu
        status="sent"
        onDuplicate={noop}
        webArchiveUrl="/newsletter/archive/123"
      />
    )
    const trigger = screen.getByTitle('More actions')
    fireEvent.click(trigger)
    expect(screen.getByText('Duplicate as New Draft')).toBeTruthy()
    expect(screen.getByText('View Web Archive')).toBeTruthy()
    expect(screen.queryByText('Delete')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/editor-components.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `more-menu.tsx`**

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Mail, Copy, Send, Trash2, ExternalLink } from 'lucide-react'

interface MoreMenuProps {
  status: string
  onSendTest?: () => void
  onDuplicate?: () => void
  onSendNow?: () => void
  onDelete?: () => void
  webArchiveUrl?: string | null
}

interface MenuItem {
  label: string
  icon: React.ReactNode
  onClick?: () => void
  href?: string
  className?: string
  separator?: boolean
}

export function MoreMenu({ status, onSendTest, onDuplicate, onSendNow, onDelete, webArchiveUrl }: MoreMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const items: Array<MenuItem | 'separator'> = []

  if (status === 'sent') {
    if (onDuplicate) items.push({ label: 'Duplicate as New Draft', icon: <Copy size={14} />, onClick: onDuplicate })
    if (webArchiveUrl) items.push({ label: 'View Web Archive', icon: <ExternalLink size={14} />, href: webArchiveUrl })
  } else if (status === 'failed') {
    if (onSendTest) items.push({ label: 'Send Test Email', icon: <Mail size={14} />, onClick: onSendTest })
    if (onDuplicate) items.push({ label: 'Duplicate', icon: <Copy size={14} />, onClick: onDuplicate })
    items.push('separator')
    if (onDelete) items.push({ label: 'Delete', icon: <Trash2 size={14} />, onClick: onDelete, className: 'text-[#ef4444]' })
  } else {
    if (onSendTest) items.push({ label: 'Send Test Email', icon: <Mail size={14} />, onClick: onSendTest })
    if (onDuplicate) items.push({ label: 'Duplicate', icon: <Copy size={14} />, onClick: onDuplicate })
    items.push('separator')
    if (onSendNow) items.push({
      label: status === 'scheduled' ? 'Send Now (skip schedule)...' : 'Send Now...',
      icon: <Send size={14} />,
      onClick: onSendNow,
      className: 'text-[#f59e0b]',
    })
    items.push('separator')
    if (onDelete) items.push({ label: 'Delete', icon: <Trash2 size={14} />, onClick: onDelete, className: 'text-[#ef4444]' })
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="More actions"
        className="p-1.5 rounded-md text-[#4b5563] hover:text-[#9ca3af] hover:bg-white/5 transition-colors"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-[#111827] border border-[#374151] rounded-lg shadow-lg py-1 min-w-48">
          {items.map((item, i) => {
            if (item === 'separator') return <div key={`sep-${i}`} className="h-px bg-[#1f2937] my-1" />
            if (item.href) {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 px-3.5 py-[7px] text-xs hover:bg-white/5 transition-colors ${item.className ?? 'text-[#d1d5db]'}`}
                  onClick={() => setOpen(false)}
                >
                  {item.icon}
                  {item.label}
                </a>
              )
            }
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => { item.onClick?.(); setOpen(false) }}
                className={`w-full flex items-center gap-2 px-3.5 py-[7px] text-xs hover:bg-white/5 transition-colors text-left ${item.className ?? 'text-[#d1d5db]'}`}
              >
                {item.icon}
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/newsletter/editor-components.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_components/more-menu.tsx apps/web/test/unit/newsletter/editor-components.test.tsx
git commit -m "feat(newsletter-editor): more menu dropdown with state-aware items"
```

---

### Task 7: New Component — `type-selector.tsx`

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/type-selector.tsx`
- Test: `apps/web/test/unit/newsletter/editor-components.test.tsx` (append)

- [ ] **Step 1: Write failing test**

Append to `editor-components.test.tsx`:

```typescript
import { TypeSelector } from '@/app/cms/(authed)/newsletters/_components/type-selector'

describe('TypeSelector', () => {
  const types = [
    { id: 'type-1', name: 'Weekly Digest', color: '#ea580c' },
    { id: 'type-2', name: 'Product Updates', color: '#22c55e' },
  ]

  it('renders current type name', () => {
    render(<TypeSelector types={types} selectedTypeId="type-1" onChange={vi.fn()} />)
    expect(screen.getByText('Weekly Digest')).toBeTruthy()
  })

  it('shows dropdown on click with all types', () => {
    render(<TypeSelector types={types} selectedTypeId="type-1" onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Product Updates')).toBeTruthy()
  })

  it('renders "No type" when selectedTypeId is null', () => {
    render(<TypeSelector types={types} selectedTypeId={null} onChange={vi.fn()} />)
    expect(screen.getByText('No type')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/editor-components.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `type-selector.tsx`**

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface TypeSelectorProps {
  types: Array<{ id: string; name: string; color: string }>
  selectedTypeId: string | null
  onChange: (typeId: string | null) => void
  disabled?: boolean
}

export function TypeSelector({ types, selectedTypeId, onChange, disabled }: TypeSelectorProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selected = types.find((t) => t.id === selectedTypeId)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors hover:bg-white/5 disabled:opacity-50"
        style={{
          background: selected ? `${selected.color}20` : 'rgba(99,102,241,0.15)',
          color: selected ? selected.color : '#818cf8',
        }}
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full" style={{ background: selected.color }} />}
        {selected?.name ?? 'No type'}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-[#111827] border border-[#374151] rounded-lg shadow-lg py-1 min-w-44">
          {types.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { onChange(t.id); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors text-left ${
                t.id === selectedTypeId ? 'text-white' : 'text-[#d1d5db]'
              }`}
            >
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: t.color }} />
              {t.name}
              {t.id === selectedTypeId && <span className="ml-auto text-[#818cf8]">&#10003;</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/newsletter/editor-components.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_components/type-selector.tsx apps/web/test/unit/newsletter/editor-components.test.tsx
git commit -m "feat(newsletter-editor): type selector dropdown for top bar"
```

---

### Task 8: New Component — `stats-strip.tsx`

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/stats-strip.tsx`
- Test: `apps/web/test/unit/newsletter/editor-components.test.tsx` (append)

- [ ] **Step 1: Write failing test**

```typescript
import { StatsStrip } from '@/app/cms/(authed)/newsletters/_components/stats-strip'

describe('StatsStrip', () => {
  it('renders sent stats', () => {
    render(
      <StatsStrip
        stats={{ delivered: 118, openRate: 64, clickRate: 12, bounces: 2 }}
        variant="sent"
      />
    )
    expect(screen.getByText('118')).toBeTruthy()
    expect(screen.getByText('64%')).toBeTruthy()
    expect(screen.getByText('12%')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('renders failed stats with pending count', () => {
    render(
      <StatsStrip
        stats={{ delivered: 84, pending: 36, openRate: 42 }}
        variant="failed"
      />
    )
    expect(screen.getByText('84')).toBeTruthy()
    expect(screen.getByText('36')).toBeTruthy()
    expect(screen.getByText('42%')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/editor-components.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `stats-strip.tsx`**

```typescript
'use client'

interface StatsStripProps {
  stats: {
    delivered?: number
    openRate?: number
    clickRate?: number
    bounces?: number
    pending?: number
  }
  variant: 'sent' | 'failed'
}

interface StatItem {
  label: string
  value: string
  color: string
}

export function StatsStrip({ stats, variant }: StatsStripProps) {
  const items: StatItem[] = []

  if (stats.delivered !== undefined) {
    items.push({ label: 'Delivered', value: stats.delivered.toLocaleString(), color: '#f3f4f6' })
  }
  if (variant === 'failed' && stats.pending !== undefined) {
    items.push({ label: 'Pending', value: stats.pending.toLocaleString(), color: '#f87171' })
  }
  if (stats.openRate !== undefined) {
    items.push({ label: 'Open Rate', value: `${stats.openRate}%`, color: '#4ade80' })
  }
  if (stats.clickRate !== undefined) {
    items.push({ label: 'Click Rate', value: `${stats.clickRate}%`, color: '#818cf8' })
  }
  if (stats.bounces !== undefined) {
    items.push({ label: 'Bounces', value: stats.bounces.toLocaleString(), color: '#fbbf24' })
  }

  return (
    <div className="flex items-center gap-6 px-5 py-3 border-b border-[#1f2937] bg-[#030712]">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-[#6b7280]">{item.label}</span>
          <span className="text-sm font-semibold tabular-nums" style={{ color: item.color }}>{item.value}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/newsletter/editor-components.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_components/stats-strip.tsx apps/web/test/unit/newsletter/editor-components.test.tsx
git commit -m "feat(newsletter-editor): stats strip for sent/failed states"
```

---

### Task 9: New Component — `send-test-modal.tsx`

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/send-test-modal.tsx`

- [ ] **Step 1: Implement `send-test-modal.tsx`**

Dark theme modal with email input pre-filled with user's email, subject preview, and Send Test button.

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { Mail } from 'lucide-react'

interface SendTestModalProps {
  open: boolean
  subject: string
  userEmail: string
  onConfirm: (email: string) => void
  onCancel: () => void
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function SendTestModal({ open, subject, userEmail, onConfirm, onCancel }: SendTestModalProps) {
  const [email, setEmail] = useState(userEmail)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) setEmail(userEmail)
  }, [open, userEmail])

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return
    const focusable = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    focusable?.focus()
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onCancel(); return }
      if (e.key !== 'Tab') return
      const focusableEls = dialog!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      const first = focusableEls[0]
      const last = focusableEls[focusableEls.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-test-title"
        className="w-full max-w-sm rounded-xl bg-[#111827] border border-[#374151] p-6 shadow-2xl"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-full bg-blue-500/15 flex items-center justify-center">
            <Mail size={16} className="text-[#60a5fa]" />
          </div>
          <h3 id="send-test-title" className="text-base font-semibold text-[#f3f4f6]">Send Test Email</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#9ca3af] mb-1">Send to</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[#374151] bg-[#0a0f1a] text-[#d1d5db] px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              placeholder="email@example.com"
            />
          </div>
          <p className="text-[10px] text-[#6b7280]">A preview email will be sent with [TEST] prefix in the subject line.</p>
          <div className="rounded-lg bg-[#0a0f1a] border border-[#1f2937] px-3 py-2">
            <span className="text-xs text-[#6b7280]">Subject: </span>
            <span className="text-xs text-[#d1d5db]">[TEST] {subject || 'Untitled'}</span>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm font-medium text-[#9ca3af] hover:bg-white/5">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(email)}
            disabled={!email.includes('@')}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Send Test
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_components/send-test-modal.tsx
git commit -m "feat(newsletter-editor): send test email modal"
```

---

### Task 10: Dark Theme — `editor-toolbar.tsx`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_components/editor-toolbar.tsx`

- [ ] **Step 1: Update `ToolbarButton` colors**

Replace the light-theme CSS var colors with dark theme hardcoded values:

- Default: `text-[#6b7280]`
- Hover: `hover:bg-[#1f2937] hover:text-[#d1d5db]`
- Active: `bg-indigo-500/15 text-[#818cf8]`
- Disabled: `opacity-30`

- [ ] **Step 2: Update `ToolbarDivider`**

Change: `bg-[var(--border,#e5e7eb)]` → `bg-[#1f2937]`

- [ ] **Step 3: Update toolbar container**

Change the container `div` classes from:
`border-b border-[var(--border,#e5e7eb)] bg-[var(--bg-surface,#ffffff)]/95 backdrop-blur-sm px-3 py-2 rounded-t-lg`
To:
`border border-[#1f2937] rounded-lg bg-[#0a0f1a] px-3 py-2 mx-16 mt-3`

Remove `sticky top-0 z-40` — toolbar is no longer stuck to viewport top.

- [ ] **Step 4: Update `LinkPopover` colors**

Change:
- Container: `bg-[#111827] border border-[#374151] rounded-lg shadow-lg`
- Input: `border-[#374151] bg-[#0a0f1a] text-[#d1d5db] focus:border-indigo-400`
- Apply button: `bg-indigo-600 text-white hover:bg-indigo-700`
- Remove button: `text-[#ef4444] hover:bg-red-500/10`

- [ ] **Step 5: Update `MergeTagDropdown` colors**

Change:
- Container: `bg-[#111827] border border-[#374151]`
- Header: `text-[#6b7280]`
- Items: `text-[#d1d5db] hover:bg-indigo-500/10 hover:text-[#818cf8]`
- Tag badge: `text-[#a78bfa] bg-purple-500/10`

- [ ] **Step 6: Add word/char count display**

Add before the fullscreen toggle button:

```tsx
<div className="flex-1" />
<span className="text-[10px] text-[#6b7280] tabular-nums mr-2">
  {editor.storage.characterCount?.words() ?? 0} words
</span>
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_components/editor-toolbar.tsx
git commit -m "feat(newsletter-editor): dark theme toolbar with word count"
```

---

### Task 11: Dark Theme — `schedule-modal.tsx`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_components/schedule-modal.tsx`

- [ ] **Step 1: Restyle to dark theme**

Replace all light-theme colors:
- Backdrop: `bg-black/60`
- Container: `bg-[#111827] border border-[#374151]` (remove `bg-white`)
- Title: `text-[#f3f4f6]`
- Subtitle: `text-[#9ca3af]`
- Labels: `text-[#9ca3af]`
- Inputs: `border-[#374151] bg-[#0a0f1a] text-[#d1d5db]`
- Past date error: `text-[#f87171]`
- Cancel button: `text-[#9ca3af] hover:bg-white/5`
- Schedule button: `bg-indigo-600 text-white hover:bg-indigo-700`
- Summary section: add a summary card below inputs showing "Will be sent to **N subscribers** on **date at time**"

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_components/schedule-modal.tsx
git commit -m "feat(newsletter-editor): dark theme schedule modal"
```

---

### Task 12: Dark Theme — `send-now-modal.tsx`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_components/send-now-modal.tsx`

- [ ] **Step 1: Restyle to dark theme**

Replace all light-theme colors:
- Backdrop: `bg-black/60`
- Container: `bg-[#111827] border border-[#374151]`
- Warning icon: amber circle `bg-amber-500/15` with `⚠` icon in `#f59e0b`
- Title: `text-[#f3f4f6]` "Send this edition now?"
- Description: `text-[#9ca3af]` "This action cannot be undone."
- Summary card: `bg-[#0a0f1a] border border-[#1f2937]`, labels `text-[#6b7280]`, values `text-[#d1d5db]`
- Cancel button: `text-[#9ca3af] hover:bg-white/5`
- Send Now button: `bg-[#f59e0b] text-[#111827] hover:bg-[#eab308]` (amber, dark text)

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_components/send-now-modal.tsx
git commit -m "feat(newsletter-editor): dark theme send-now modal with amber CTA"
```

---

### Task 13: Dark Theme — `delete-confirm-modal.tsx`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_components/delete-confirm-modal.tsx`

- [ ] **Step 1: Restyle to dark theme**

Replace all light-theme colors:
- Backdrop: `bg-black/60`
- Container: `bg-[#111827] border border-[#374151]`
- Trash icon: red circle `bg-red-500/15` with trash icon in `#f87171`
- Title: `text-[#f3f4f6]`
- Description: `text-[#9ca3af]`
- High-impact warning input: `border-[#7f1d1d] bg-[#0a0f1a] text-[#d1d5db]`, label `text-[#f87171]`
- Medium-impact warning: `bg-amber-500/10 border border-amber-500/20`, text `text-[#f59e0b]`
- Cancel button: `text-[#9ca3af] hover:bg-white/5`
- Delete button: `bg-red-600 text-white hover:bg-red-700`

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_components/delete-confirm-modal.tsx
git commit -m "feat(newsletter-editor): dark theme delete confirmation modal"
```

---

### Task 14: Dark Theme — `email-preview.tsx`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_components/email-preview.tsx`

- [ ] **Step 1: Restyle to dark theme with device frames**

Key changes:
- Header bar: `border-b border-[#1f2937]`, `bg-[#030712]`
- Title: `text-[#9ca3af]`
- Device tabs: active `bg-indigo-500/15 text-[#818cf8]`, inactive `text-[#6b7280]`
- Add "Send Test" button in header (indigo text)
- Add "Back to Editor" button (pencil icon, indigo border)
- Preview area: `bg-[#111827]` (dark frame around white email)
- Desktop: iframe `width:600px` centered in dark bg
- Mobile: iframe `width:375px` with rounded phone-frame border
- Loading/error states: dark theme text colors

- [ ] **Step 2: Update props interface**

Add `onSendTest` and `onBack` callback props:

```typescript
interface EmailPreviewProps {
  editionId: string
  renderPreview: (editionId: string) => Promise<{ ok: true; html: string } | { ok: false; error: string }>
  onSendTest?: () => void
  onBack?: () => void
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_components/email-preview.tsx
git commit -m "feat(newsletter-editor): dark preview with device frames and action buttons"
```

---

### Task 15: Custom Dialog — `navigation-guard.tsx`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_components/navigation-guard.tsx`

- [ ] **Step 1: Add custom dialog state and rendering**

Replace `window.confirm()` calls with a custom dark-themed dialog:
- Warning icon (amber)
- Title: "Unsaved changes"
- Description: "You have edits that haven't been saved yet."
- Three buttons: Discard (red outlined), Cancel (secondary), Save & Leave (indigo primary)
- Dialog uses `bg-[#111827] border border-[#374151]`

Add new props: `onSave?: () => Promise<void>` for the Save & Leave action.

The guard still uses `beforeunload` for browser tab close, but for client-side navigation it renders a custom modal.

```typescript
interface NavigationGuardProps {
  hasUnsavedChanges: boolean
  onSave?: () => Promise<void>
}
```

The component tracks `pendingNavigation` state. When a guarded pushState/replaceState fires, it stores the target URL and shows the modal. Discard → proceed with navigation. Save & Leave → call `onSave()` then proceed. Cancel → dismiss modal.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_components/navigation-guard.tsx
git commit -m "feat(newsletter-editor): custom unsaved changes dialog replacing window.confirm"
```

---

### Task 16: Dark Theme — `read-only-overlay.tsx`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_components/read-only-overlay.tsx`

- [ ] **Step 1: Restyle to dark theme with lock icon**

```typescript
'use client'

import { Lock } from 'lucide-react'

interface ReadOnlyOverlayProps {
  status: string
}

const STATUS_MESSAGES: Record<string, string> = {
  sending: 'Locked during send — this edition is being delivered.',
  sent: 'Read-only — this edition has been sent.',
  failed: 'This edition failed to send. Use Retry to resend to remaining subscribers.',
  cancelled: 'This edition was cancelled. Revert to draft to edit.',
}

export function ReadOnlyOverlay({ status }: ReadOnlyOverlayProps) {
  const message = STATUS_MESSAGES[status]
  if (!message) return null

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-[#030712]/80 backdrop-blur-[1px] pt-20">
      <div className="rounded-lg border border-[#374151] bg-[#111827] px-6 py-4 shadow-lg max-w-md text-center flex flex-col items-center gap-2">
        <Lock size={20} className="text-[#6b7280]" />
        <p className="text-sm font-medium text-[#9ca3af]">{message}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_components/read-only-overlay.tsx
git commit -m "feat(newsletter-editor): dark read-only overlay with lock icon"
```

---

### Task 17: Rewrite `edition-editor.tsx` — Main Component

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/[id]/edit/edition-editor.tsx`

This is the largest task. The component gets a full rewrite with: dark layout, isDirty pattern, new top bar, hero inputs, segment selector, contextual banners, bottom bar, state machine, and integration of all new components.

**Dependencies:** Tasks 1–16 must be complete.

- [ ] **Step 1: Update `EditionEditorProps` interface**

```typescript
interface EditionData {
  id: string
  subject: string
  preheader: string | null
  content_json: JSONContent | null
  content_html: string | null
  status: string
  notes: string | null
  newsletter_type_id: string | null
  newsletter_types: { name: string; color: string; sender_name: string | null; sender_email: string | null } | null
  segment: string | null
  web_archive_enabled: boolean
  scheduled_at?: string | null
  stats_delivered?: number | null
  stats_opens?: number | null
  stats_clicks?: number | null
  stats_bounces?: number | null
  error_message?: string | null
}

interface EditionEditorProps {
  edition: EditionData | null
  subscriberCount: number
  types: Array<{ id: string; name: string; color: string }>
  initialTypeId?: string | null
  userEmail?: string
}
```

- [ ] **Step 2: Implement isDirty pattern for ephemeral mode**

When `edition` is null:
- All state fields start empty
- `editionId` is `null` in state
- Autosave is disabled
- On first meaningful edit (subject typed, preheader typed, or TipTap `onUpdate` with non-empty content):
  1. Call `createEdition(data)` server action
  2. On success, set `editionId` in state, `router.replace(...)`, enable autosave
  3. On error, show toast

```typescript
const [editionId, setEditionId] = useState(edition?.id ?? null)
const isEphemeral = editionId === null
```

- [ ] **Step 3: Rewrite layout structure**

Top-to-bottom:
1. `NavigationGuard`
2. Top bar (full-width, `bg-[#030712]`, `border-b border-[#1f2937]`)
3. `ContextualBanner`
4. `StatsStrip` (for sent/failed only)
5. Hero inputs area (`px-16 pt-7`)
6. Segment selector
7. `EditorToolbar` (via `TipTapEditor`)
8. Writing area (flex:1, scrollable)
9. Notes section (collapsible)
10. Bottom bar (sticky bottom)
11. Modals: ScheduleModal, SendNowModal, DeleteConfirmModal, SendTestModal

The outermost container: `flex flex-col h-[calc(100vh-64px)] bg-[#030712]` (full viewport minus CMS nav).

- [ ] **Step 4: Implement top bar**

Left side: `← Hub` link, vertical divider, edition ID (if not ephemeral), `TypeSelector`, status pill, `AutosaveIndicator`.

Right side: conditional buttons based on state:
- Draft: Preview (secondary) + Schedule (indigo primary) + MoreMenu
- Scheduled: Preview + Unschedule (purple outlined) + MoreMenu
- Sending: Preview only
- Sent: Analytics link + MoreMenu (duplicate/archive only)
- Failed: Preview + Retry Send (red) + MoreMenu
- Ephemeral: Preview (disabled) + Schedule (disabled) + MoreMenu (minimal)

- [ ] **Step 5: Implement hero inputs**

Replace grid layout with hero-style inputs:
- Subject: `<input>` with `text-[26px] font-bold tracking-[-0.5px] text-[#f9fafb]` on transparent background
- Preheader: `<input>` with `text-sm text-[#6b7280]` on transparent background
- Both in `px-16 pt-7` area

- [ ] **Step 6: Implement segment selector**

Inline chip below hero inputs:
- "Send to:" label in `#4b5563` + pill button with border, chevron, segment name
- Dropdown with segment options

- [ ] **Step 7: Implement bottom bar**

Left: subscriber count + segment + reading time estimate
Right: keyboard shortcuts in `<kbd>` badges
Sticky bottom, `border-t border-[#1f2937] bg-[#030712]`

- [ ] **Step 8: Implement isDirty transition callback**

```typescript
const handleFirstEdit = useCallback(async () => {
  if (!isEphemeral || isCreatingRef.current) return
  isCreatingRef.current = true
  const payload = {
    subject: fieldsRef.current.subject,
    preheader: fieldsRef.current.preheader || undefined,
    content_json: fieldsRef.current.contentJson ? JSON.stringify(fieldsRef.current.contentJson) : undefined,
    content_html: fieldsRef.current.contentHtml || undefined,
    newsletter_type_id: selectedTypeId,
    segment: fieldsRef.current.segment,
  }
  const result = await createEdition(payload)
  if (result.ok && result.editionId) {
    setEditionId(result.editionId)
    router.replace(`/cms/newsletters/${result.editionId}/edit`)
  } else {
    toast.error('Failed to create edition')
  }
  isCreatingRef.current = false
}, [isEphemeral, selectedTypeId, router])
```

Hook into subject/preheader onChange and TipTap onUpdate to trigger `handleFirstEdit` when meaningful content exists.

- [ ] **Step 9: Wire all modals and actions**

Connect MoreMenu, SendTestModal, ScheduleModal, SendNowModal, DeleteConfirmModal to their respective server actions. All callbacks follow existing patterns from the current `edition-editor.tsx`.

- [ ] **Step 10: Handle keyboard shortcuts**

- `⌘S` — save immediately (no-op in ephemeral)
- `⌘⇧P` — toggle preview (disabled in ephemeral)
- `⌘⇧N` — new edition (navigate to `/cms/newsletters/new`)
- `Esc` — in ephemeral: navigate to hub; in fullscreen: exit fullscreen

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/\[id\]/edit/edition-editor.tsx
git commit -m "feat(newsletter-editor): complete rewrite with dark theme and isDirty pattern"
```

---

### Task 18: Route Change — `new/page.tsx`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/new/page.tsx`

- [ ] **Step 1: Remove DB INSERT, render ephemeral editor**

Replace the entire page. Instead of inserting a row and redirecting, it should:
1. Validate auth and type param (keep existing guards)
2. Fetch subscriber count and types (for the editor)
3. Render `<EditionEditor edition={null} initialTypeId={typeId} ... />`

```typescript
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { EditionEditor } from '../[id]/edit/edition-editor'

export const dynamic = 'force-dynamic'

export default async function NewEditionPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const params = await searchParams
  const supabase = getSupabaseServiceClient()
  const typeId = params.type ?? null

  if (typeId) {
    const { data: type } = await supabase
      .from('newsletter_types')
      .select('id, active')
      .eq('id', typeId)
      .eq('site_id', ctx.siteId)
      .single()
    if (!type || !type.active) throw new Error('Invalid or inactive newsletter type')
  }

  const { data: types } = await supabase
    .from('newsletter_types')
    .select('id, name, color')
    .eq('site_id', ctx.siteId)
    .eq('active', true)
    .order('sort_order')

  const defaultTypeId = typeId ?? types?.[0]?.id ?? null
  let subscriberCount = 0
  if (defaultTypeId) {
    const { count } = await supabase
      .from('newsletter_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('newsletter_id', defaultTypeId)
      .eq('status', 'confirmed')
    subscriberCount = count ?? 0
  }

  const cookieStore = await cookies()
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(c: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value, options } of c) cookieStore.set(name, value, options)
        },
      },
    },
  )
  const { data: { user } } = await userClient.auth.getUser()

  return (
    <EditionEditor
      edition={null}
      subscriberCount={subscriberCount}
      types={(types ?? []).map((t) => ({
        id: t.id as string,
        name: t.name as string,
        color: (t.color ?? '#7c3aed') as string,
      }))}
      initialTypeId={defaultTypeId}
      userEmail={user?.email ?? ''}
    />
  )
}
```

- [ ] **Step 2: Verify route works**

Navigate to `/cms/newsletters/new` in dev server. Verify:
- No DB row is created
- Editor renders in ephemeral mode with hint banner
- Typing in subject creates a draft and URL changes to `/cms/newsletters/{id}/edit`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/new/page.tsx
git commit -m "feat(newsletter-editor): new edition route renders ephemeral editor (no DB insert)"
```

---

### Task 19: Dark Wrapper — `[id]/edit/page.tsx`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/[id]/edit/page.tsx`

- [ ] **Step 1: Update wrapper and pass new props**

Remove `<div className="p-6 lg:p-8">` wrapper (the editor now handles its own layout). Add `userEmail` prop. Fetch additional fields for stats/schedule/error.

```typescript
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { EditionEditor } from './edition-editor'

export const dynamic = 'force-dynamic'

export default async function EditEditionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('*, newsletter_types(name, color, sender_name, sender_email)')
    .eq('id', id)
    .maybeSingle()

  if (!edition || edition.site_id !== ctx.siteId) return notFound()

  const { count: subscriberCount } = await supabase
    .from('newsletter_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('newsletter_id', edition.newsletter_type_id)
    .eq('status', 'confirmed')

  const { data: types } = await supabase
    .from('newsletter_types')
    .select('id, name, color')
    .eq('site_id', ctx.siteId)
    .eq('active', true)
    .order('sort_order')

  const cookieStore = await cookies()
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(c: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value, options } of c) cookieStore.set(name, value, options)
        },
      },
    },
  )
  const { data: { user } } = await userClient.auth.getUser()

  return (
    <EditionEditor
      edition={{
        id: edition.id,
        subject: edition.subject,
        preheader: edition.preheader,
        content_json: edition.content_json,
        content_html: edition.content_html,
        status: edition.status,
        notes: edition.notes,
        newsletter_type_id: edition.newsletter_type_id,
        newsletter_types: edition.newsletter_types,
        segment: edition.segment,
        web_archive_enabled: edition.web_archive_enabled ?? true,
        scheduled_at: edition.scheduled_at ?? null,
        stats_delivered: edition.stats_delivered ?? null,
        stats_opens: edition.stats_opens ?? null,
        stats_clicks: edition.stats_clicks ?? null,
        stats_bounces: edition.stats_bounces ?? null,
        error_message: edition.error_message ?? null,
      }}
      subscriberCount={subscriberCount ?? 0}
      types={(types ?? []).map((t) => ({
        id: t.id as string,
        name: t.name as string,
        color: (t.color ?? '#7c3aed') as string,
      }))}
      userEmail={user?.email ?? ''}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/\[id\]/edit/page.tsx
git commit -m "feat(newsletter-editor): edit page passes stats/schedule/email props, removes padding wrapper"
```

---

### Task 20: Update Existing Tests

**Files:**
- Modify: `apps/web/test/unit/newsletter/actions-status-matrix.test.ts`
- Modify: `apps/web/test/cms/newsletters.test.tsx` (if needed)

- [ ] **Step 1: Verify all existing tests pass**

Run: `cd apps/web && npx vitest run`
Expected: ALL PASS. If any failures from the action signature change, fix them.

- [ ] **Step 2: Fix any broken imports**

The old `createEdition(typeId, subject)` call in `new/page.tsx` was removed in Task 18, so no legacy callers remain. If any test imports the old signature, update it to the new object form.

- [ ] **Step 3: Run full test suite**

Run: `npm run test:web`
Expected: ALL PASS

- [ ] **Step 4: Commit any test fixes**

```bash
git add apps/web/test/
git commit -m "test(newsletter-editor): update tests for editor redesign"
```

---

### Task 21: Visual QA and Final Verification

**Files:** None (manual verification)

- [ ] **Step 1: Start dev server**

Run: `cd apps/web && npm run dev`

- [ ] **Step 2: Test ephemeral flow (golden path)**

1. Navigate to `/cms/newsletters`
2. Click "New Edition"
3. Verify: hint banner shows, no DB record created, Preview/Schedule disabled
4. Type a subject line
5. Verify: URL changes to `/cms/newsletters/{id}/edit`, hint banner fades, autosave shows "Saving..."
6. Verify: DRAFT pill appears, "..." menu is available

- [ ] **Step 3: Test existing edition editing**

1. Open an existing draft edition
2. Verify: dark theme, hero inputs with subject/preheader, toolbar below
3. Type in the editor, verify autosave works
4. Toggle preview, verify desktop/mobile device frames

- [ ] **Step 4: Test modals**

1. Open "..." menu → Send Test → verify dark modal
2. Open Schedule → verify dark modal with date/time
3. Open "..." menu → Send Now → verify dark modal with amber CTA
4. Open "..." menu → Delete → verify dark modal with red CTA

- [ ] **Step 5: Test navigation guard**

1. Edit a field, then click "← Hub"
2. Verify: custom dark dialog appears with Discard / Cancel / Save & Leave
3. Click Cancel → stays on editor
4. Click Discard → navigates to hub

- [ ] **Step 6: Test read-only states**

Navigate to a sent edition. Verify: lock overlay, muted content colors, stats strip, correct bottom bar message.

- [ ] **Step 7: Run full test suite one final time**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 8: Commit any final fixes**

```bash
git add -A
git commit -m "feat(newsletter-editor): visual QA fixes"
```
