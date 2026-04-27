# Newsletter CMS Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the non-functional newsletter CMS with a production-ready WYSIWYG editor, full type CRUD, idea bank, complete lifecycle actions, and email-safe HTML pipeline.

**Architecture:** TipTap (ProseMirror) WYSIWYG editor replaces MDX textarea. `sanitizeForEmail()` pipeline uses `juice` for CSS inlining + VML for Outlook. 3 additive DB migrations enable idea status, type CRUD with site scoping, and content_json storage. 14 server actions (9 new + 5 fixed) enforce a status transition matrix. Toast feedback via `sonner`, autosave with debounce, navigation guard.

**Tech Stack:** Next.js 15 + React 19 + TipTap 2 + juice 11 + sonner + Supabase Storage + Vitest

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260501000020_newsletter_idea_status.sql` | Migration 1: idea status + nullable type_id + notes |
| `supabase/migrations/20260501000021_newsletter_type_crud.sql` | Migration 2: RLS + site_id on newsletter_types |
| `supabase/migrations/20260501000022_newsletter_content_json.sql` | Migration 3: content_json column |
| `apps/web/lib/newsletter/email-sanitizer.ts` | `sanitizeForEmail()` pipeline |
| `apps/web/lib/newsletter/email-styles.ts` | CSS stylesheet for juice inlining |
| `apps/web/src/app/cms/(authed)/newsletters/_components/tiptap-editor.tsx` | TipTap WYSIWYG wrapper |
| `apps/web/src/app/cms/(authed)/newsletters/_components/editor-toolbar.tsx` | Gmail-style formatting toolbar |
| `apps/web/src/app/cms/(authed)/newsletters/_components/merge-tag-node.tsx` | Custom inline TipTap node for merge tags |
| `apps/web/src/app/cms/(authed)/newsletters/_components/cta-button-node.tsx` | Custom TipTap node for email CTA buttons |
| `apps/web/src/app/cms/(authed)/newsletters/_components/type-modal.tsx` | Create/Edit newsletter type modal |
| `apps/web/src/app/cms/(authed)/newsletters/_components/delete-confirm-modal.tsx` | Tiered delete confirmation |
| `apps/web/src/app/cms/(authed)/newsletters/_components/schedule-modal.tsx` | Date/time/timezone schedule picker |
| `apps/web/src/app/cms/(authed)/newsletters/_components/send-now-modal.tsx` | Send confirmation modal |
| `apps/web/src/app/cms/(authed)/newsletters/_components/convert-idea-modal.tsx` | Idea → edition conversion |
| `apps/web/src/app/cms/(authed)/newsletters/_components/email-preview.tsx` | Sandboxed iframe email preview |
| `apps/web/src/app/cms/(authed)/newsletters/_components/autosave-indicator.tsx` | Save state indicator |
| `apps/web/src/app/cms/(authed)/newsletters/_components/navigation-guard.tsx` | Unsaved changes guard |
| `apps/web/src/app/cms/(authed)/newsletters/_components/toast-provider.tsx` | Sonner toast wrapper |
| `apps/web/src/app/cms/(authed)/newsletters/_components/read-only-overlay.tsx` | Locks editor for sent/sending |
| `apps/web/test/unit/newsletter/email-sanitizer.test.ts` | Email sanitizer tests |
| `apps/web/test/unit/newsletter/actions.test.ts` | Server actions unit tests |

### Modified Files

| File | Changes |
|------|---------|
| `apps/web/package.json` | Add tiptap, juice, sonner deps |
| `apps/web/src/app/cms/(authed)/newsletters/actions.ts` | 9 new + 5 fixed actions |
| `apps/web/src/app/cms/(authed)/newsletters/[id]/edit/page.tsx` | Complete rewrite: TipTap editor |
| `apps/web/src/app/cms/(authed)/newsletters/_components/type-cards.tsx` | Context menu + functional "Add type" |
| `apps/web/src/app/cms/(authed)/newsletters/newsletters-connected.tsx` | Wire all menus + Ideas tab |
| `apps/web/src/app/cms/(authed)/newsletters/page.tsx` | Pass ideas data + toast provider |
| `apps/web/src/app/cms/(authed)/newsletters/settings/page.tsx` | 3 tabs + sender fields |
| `apps/web/src/app/cms/(authed)/newsletters/new/page.tsx` | Type validation + active check |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install TipTap packages + juice + sonner**

```bash
cd apps/web && npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-link @tiptap/extension-image @tiptap/extension-text-align @tiptap/extension-color @tiptap/extension-text-style @tiptap/extension-highlight @tiptap/extension-placeholder @tiptap/extension-character-count juice sonner
```

- [ ] **Step 2: Verify installation**

Run: `cd apps/web && node -e "require('@tiptap/react'); require('juice'); require('sonner'); console.log('OK')"`
Expected: `OK` printed with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json
git commit -m "feat(newsletters): add tiptap, juice, sonner dependencies"
```

---

### Task 2: Migration 1 — Idea Status + Nullable type_id + Notes

**Files:**
- Create: `supabase/migrations/20260501000020_newsletter_idea_status.sql`
- Test: `apps/web/test/unit/newsletter/migrations.test.ts`

- [ ] **Step 1: Write the migration test**

```typescript
// apps/web/test/unit/newsletter/migrations.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Newsletter CMS Overhaul Migrations', () => {
  describe('Migration 20260501000020 — idea status', () => {
    const sql = readFileSync(
      resolve(__dirname, '../../../../supabase/migrations/20260501000020_newsletter_idea_status.sql'),
      'utf-8',
    )

    it('adds idea to status CHECK constraint', () => {
      expect(sql).toContain("'idea'")
      expect(sql).toContain('newsletter_editions_status_check')
    })

    it('drops NOT NULL on newsletter_type_id', () => {
      expect(sql).toContain('DROP NOT NULL')
      expect(sql).toContain('newsletter_type_id')
    })

    it('adds notes column', () => {
      expect(sql).toContain('notes text')
    })

    it('is idempotent (uses IF NOT EXISTS / DROP IF EXISTS)', () => {
      expect(sql).toContain('DROP CONSTRAINT IF EXISTS')
      expect(sql).toContain('IF NOT EXISTS')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/migrations.test.ts`
Expected: FAIL — migration file does not exist.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260501000020_newsletter_idea_status.sql
-- Newsletter CMS Overhaul — Migration 1: idea status + nullable type_id + notes

-- Add 'idea' to newsletter_editions status CHECK
ALTER TABLE newsletter_editions DROP CONSTRAINT IF EXISTS newsletter_editions_status_check;
ALTER TABLE newsletter_editions ADD CONSTRAINT newsletter_editions_status_check
  CHECK (status IN ('idea', 'draft', 'ready', 'queued', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'));

-- Allow NULL newsletter_type_id for ideas (unassigned)
ALTER TABLE newsletter_editions ALTER COLUMN newsletter_type_id DROP NOT NULL;

-- Add internal notes column for ideas/drafts
ALTER TABLE newsletter_editions ADD COLUMN IF NOT EXISTS notes text;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/newsletter/migrations.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260501000020_newsletter_idea_status.sql apps/web/test/unit/newsletter/migrations.test.ts
git commit -m "feat(db): add idea status, nullable type_id, notes column"
```

---

### Task 3: Migration 2 — Type CRUD RLS + site_id

**Files:**
- Create: `supabase/migrations/20260501000021_newsletter_type_crud.sql`
- Modify: `apps/web/test/unit/newsletter/migrations.test.ts`

- [ ] **Step 1: Write the test**

Add to `apps/web/test/unit/newsletter/migrations.test.ts`:

```typescript
describe('Migration 20260501000021 — type CRUD', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../../../supabase/migrations/20260501000021_newsletter_type_crud.sql'),
    'utf-8',
  )

  it('creates staff_manage_types RLS policy', () => {
    expect(sql).toContain('staff_manage_types')
    expect(sql).toContain('is_member_staff()')
  })

  it('adds site_id column to newsletter_types', () => {
    expect(sql).toContain('site_id uuid')
    expect(sql).toContain('REFERENCES sites(id)')
  })

  it('backfills existing types with master site', () => {
    expect(sql).toContain('bythiagofigueiredo')
    expect(sql).toContain('SET site_id')
  })

  it('sets site_id NOT NULL after backfill', () => {
    expect(sql).toContain('SET NOT NULL')
  })

  it('is idempotent', () => {
    expect(sql).toContain('DROP POLICY IF EXISTS')
    expect(sql).toContain('IF NOT EXISTS')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/migrations.test.ts`
Expected: FAIL — migration file doesn't exist.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260501000021_newsletter_type_crud.sql
-- Newsletter CMS Overhaul — Migration 2: RLS for newsletter_types + site_id

-- Enable RLS (may already be enabled)
ALTER TABLE newsletter_types ENABLE ROW LEVEL SECURITY;

-- Staff can manage types
DROP POLICY IF EXISTS "staff_manage_types" ON newsletter_types;
CREATE POLICY "staff_manage_types" ON newsletter_types
  FOR ALL USING (public.is_member_staff())
  WITH CHECK (public.is_member_staff());

-- Public can read active types (for subscription pages)
DROP POLICY IF EXISTS "public_read_active_types" ON newsletter_types;
CREATE POLICY "public_read_active_types" ON newsletter_types
  FOR SELECT USING (active = true);

-- Add site_id for multi-site scoping
ALTER TABLE newsletter_types ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id);

-- Backfill existing types with master site
UPDATE newsletter_types
SET site_id = (SELECT id FROM sites WHERE slug = 'bythiagofigueiredo')
WHERE site_id IS NULL;

-- Now enforce NOT NULL
ALTER TABLE newsletter_types ALTER COLUMN site_id SET NOT NULL;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/newsletter/migrations.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260501000021_newsletter_type_crud.sql apps/web/test/unit/newsletter/migrations.test.ts
git commit -m "feat(db): add RLS + site_id to newsletter_types for type CRUD"
```

---

### Task 4: Migration 3 — content_json Column

**Files:**
- Create: `supabase/migrations/20260501000022_newsletter_content_json.sql`
- Modify: `apps/web/test/unit/newsletter/migrations.test.ts`

- [ ] **Step 1: Write the test**

Add to `apps/web/test/unit/newsletter/migrations.test.ts`:

```typescript
describe('Migration 20260501000022 — content_json', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../../../supabase/migrations/20260501000022_newsletter_content_json.sql'),
    'utf-8',
  )

  it('adds content_json jsonb column', () => {
    expect(sql).toContain('content_json jsonb')
  })

  it('is idempotent', () => {
    expect(sql).toContain('IF NOT EXISTS')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/migrations.test.ts`
Expected: FAIL — migration file doesn't exist.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260501000022_newsletter_content_json.sql
-- Newsletter CMS Overhaul — Migration 3: TipTap document model storage

-- TipTap stores ProseMirror document as JSON for re-editing
ALTER TABLE newsletter_editions ADD COLUMN IF NOT EXISTS content_json jsonb;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/newsletter/migrations.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260501000022_newsletter_content_json.sql apps/web/test/unit/newsletter/migrations.test.ts
git commit -m "feat(db): add content_json column for TipTap document model"
```

---

### Task 5: Email Stylesheet

**Files:**
- Create: `apps/web/lib/newsletter/email-styles.ts`
- Test: `apps/web/test/unit/newsletter/email-styles.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/test/unit/newsletter/email-styles.test.ts
import { describe, it, expect } from 'vitest'
import { getEmailStylesheet } from '@/lib/newsletter/email-styles'

describe('getEmailStylesheet', () => {
  it('returns CSS string with interpolated type color', () => {
    const css = getEmailStylesheet('#7c3aed')
    expect(css).toContain('color:#7c3aed')
    expect(css).toContain('border-left:3px solid #7c3aed')
  })

  it('uses default color when none provided', () => {
    const css = getEmailStylesheet()
    expect(css).toContain('#7c3aed')
  })

  it('includes all email-safe base rules', () => {
    const css = getEmailStylesheet('#000')
    expect(css).toContain('font-family:Arial,sans-serif')
    expect(css).toContain('max-width:600px')
    expect(css).toContain('.cta-button')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/email-styles.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement email-styles**

```typescript
// apps/web/lib/newsletter/email-styles.ts

const DEFAULT_COLOR = '#7c3aed'

export function getEmailStylesheet(typeColor: string = DEFAULT_COLOR): string {
  return `
h1 { font-size:28px; font-weight:700; color:#1a1a1a; margin:0 0 16px; font-family:Arial,sans-serif; }
h2 { font-size:22px; font-weight:700; color:#1a1a1a; margin:0 0 12px; font-family:Arial,sans-serif; }
h3 { font-size:18px; font-weight:600; color:#333; margin:0 0 8px; font-family:Arial,sans-serif; }
p { font-size:16px; line-height:1.7; color:#333; margin:0 0 16px; font-family:Georgia,serif; }
a { color:${typeColor}; text-decoration:underline; }
blockquote { border-left:3px solid ${typeColor}; padding:8px 16px; margin:16px 0; color:#666; font-style:italic; }
img { max-width:600px; height:auto; border-radius:4px; display:block; margin:16px auto; }
ul, ol { padding-left:24px; margin:0 0 16px; }
li { margin-bottom:8px; font-size:16px; color:#333; font-family:Georgia,serif; }
hr { border:none; border-top:1px solid #eee; margin:24px 0; }
.cta-button { display:inline-block; padding:12px 32px; background:${typeColor}; color:#ffffff; border-radius:6px; text-decoration:none; font-weight:600; font-family:Arial,sans-serif; font-size:16px; }
.cta-wrapper { text-align:center; margin:24px 0; }
`.trim()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/newsletter/email-styles.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/newsletter/email-styles.ts apps/web/test/unit/newsletter/email-styles.test.ts
git commit -m "feat(newsletter): add email stylesheet for juice CSS inlining"
```

---

### Task 6: Email Sanitizer Pipeline

**Files:**
- Create: `apps/web/lib/newsletter/email-sanitizer.ts`
- Create: `apps/web/test/unit/newsletter/email-sanitizer.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/test/unit/newsletter/email-sanitizer.test.ts
import { describe, it, expect } from 'vitest'
import { sanitizeForEmail } from '@/lib/newsletter/email-sanitizer'

describe('sanitizeForEmail', () => {
  describe('XSS prevention', () => {
    it('strips script tags', () => {
      const html = '<p>Hello</p><script>alert("xss")</script>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).not.toContain('<script')
      expect(result).toContain('<p')
    })

    it('strips style tags', () => {
      const html = '<style>body{display:none}</style><p>OK</p>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).not.toContain('<style')
    })

    it('strips event handlers', () => {
      const html = '<img src="x" onerror="alert(1)">'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).not.toContain('onerror')
    })
  })

  describe('CSS inlining via juice', () => {
    it('inlines link color from stylesheet', () => {
      const html = '<a href="https://example.com">Link</a>'
      const result = sanitizeForEmail(html, '#ff0000')
      expect(result).toContain('color:#ff0000')
      expect(result).toContain('style=')
    })

    it('inlines paragraph styles', () => {
      const html = '<p>Test paragraph</p>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('font-size:16px')
      expect(result).toContain('font-family:Georgia,serif')
    })
  })

  describe('image safety', () => {
    it('adds display:block to images', () => {
      const html = '<img src="https://img.example.com/photo.jpg">'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('display:block')
    })

    it('enforces max-width on images', () => {
      const html = '<img src="https://img.example.com/photo.jpg">'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('max-width:600px')
    })
  })

  describe('CTA button VML', () => {
    it('wraps .cta-button in Outlook VML conditional', () => {
      const html = '<div class="cta-wrapper"><a class="cta-button" href="https://example.com">Click</a></div>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('<!--[if mso]>')
      expect(result).toContain('v:roundrect')
      expect(result).toContain('<![endif]-->')
    })
  })

  describe('merge tag serialization', () => {
    it('preserves merge tag spans in output', () => {
      const html = '<p>Hi <span data-merge-tag="subscriber.name">{{subscriber.name}}</span></p>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('data-merge-tag="subscriber.name"')
      expect(result).toContain('{{subscriber.name}}')
    })
  })

  describe('empty/null input', () => {
    it('returns empty string for empty input', () => {
      expect(sanitizeForEmail('', '#7c3aed')).toBe('')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/email-sanitizer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement email-sanitizer**

```typescript
// apps/web/lib/newsletter/email-sanitizer.ts
import juice from 'juice'
import { getEmailStylesheet } from './email-styles'

export function sanitizeForEmail(html: string, typeColor: string): string {
  if (!html) return ''

  let sanitized = html

  // 1. XSS prevention — strip dangerous elements and attributes
  sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, '')
  sanitized = sanitized.replace(/<style[\s\S]*?<\/style>/gi, '')
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '')
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*'[^']*'/gi, '')

  // 2. CSS inlining via juice
  const stylesheet = getEmailStylesheet(typeColor)
  sanitized = juice.inlineContent(sanitized, stylesheet, {
    applyStyleTags: false,
    removeStyleTags: false,
    preserveMediaQueries: false,
    preserveFontFaces: false,
  })

  // 3. CTA button Outlook VML — wrap .cta-button links
  sanitized = sanitized.replace(
    /<a([^>]*class="[^"]*cta-button[^"]*"[^>]*)>([\s\S]*?)<\/a>/gi,
    (match, attrs, text) => {
      const hrefMatch = attrs.match(/href="([^"]*)"/)
      const href = hrefMatch ? hrefMatch[1] : '#'
      const bgMatch = attrs.match(/background:([^;"]+)/)
      const bg = bgMatch ? bgMatch[1].trim() : typeColor
      return `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="14%" strokecolor="${bg}" fillcolor="${bg}"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${text}</center></v:roundrect><![endif]--><!--[if !mso]><!-->${match}<!--<![endif]-->`
    },
  )

  return sanitized
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/newsletter/email-sanitizer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/newsletter/email-sanitizer.ts apps/web/test/unit/newsletter/email-sanitizer.test.ts
git commit -m "feat(newsletter): implement sanitizeForEmail pipeline with juice + VML"
```

---

### Task 7: Toast Provider Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/toast-provider.tsx`

- [ ] **Step 1: Create toast provider**

```typescript
// apps/web/src/app/cms/(authed)/newsletters/_components/toast-provider.tsx
'use client'

import { Toaster } from 'sonner'

export function NewsletterToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      visibleToasts={3}
      toastOptions={{
        classNames: {
          success: 'bg-green-50 border-green-200 text-green-800',
          error: 'bg-red-50 border-red-200 text-red-800',
          warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        },
      }}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_components/toast-provider.tsx
git commit -m "feat(newsletter): add toast provider using sonner"
```

---

### Task 8: Server Actions — Fix `saveEdition`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`
- Test: `apps/web/test/unit/newsletter/actions.test.ts`

- [ ] **Step 1: Write the test for status guard + content_json**

```typescript
// apps/web/test/unit/newsletter/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockUpdate = vi.fn().mockReturnThis()
const mockEq = vi.fn().mockReturnThis()
const mockSelect = vi.fn().mockReturnThis()
const mockSingle = vi.fn()
const mockFrom = vi.fn(() => ({
  update: mockUpdate,
  select: mockSelect,
  eq: mockEq,
  single: mockSingle,
  insert: vi.fn().mockReturnThis(),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 'site-1', orgId: 'org-1' }),
}))

vi.mock('@/lib/cms/auth-guards', () => ({
  requireSiteAdminForRow: vi.fn().mockResolvedValue({ siteId: 'site-1' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({
    getAll: () => [],
    set: vi.fn(),
  }),
}))

describe('saveEdition — status guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects save for sent editions', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { status: 'sent' }, error: null }) }) }),
    })
    mockFrom.mockReturnValue({ update: mockUpdate, eq: mockEq })

    const { saveEdition } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await saveEdition('ed-1', { subject: 'New' })
    expect(result).toEqual({ ok: false, error: 'edition_locked' })
  })

  it('rejects save for sending editions', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { status: 'sending' }, error: null }) }) }),
    })

    const { saveEdition } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await saveEdition('ed-1', { subject: 'New' })
    expect(result).toEqual({ ok: false, error: 'edition_locked' })
  })

  it('rejects save for cancelled editions', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { status: 'cancelled' }, error: null }) }) }),
    })

    const { saveEdition } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await saveEdition('ed-1', { subject: 'New' })
    expect(result).toEqual({ ok: false, error: 'edition_locked' })
  })

  it('allows save for idea status', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { status: 'idea' }, error: null }) }) }),
    })
    mockFrom.mockReturnValue({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    })

    const { saveEdition } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await saveEdition('ed-1', { subject: 'New' })
    expect(result).toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/actions.test.ts`
Expected: FAIL — saveEdition currently has no status guard.

- [ ] **Step 3: Fix saveEdition in actions.ts**

Replace the `saveEdition` function (lines 37-50) with:

```typescript
export async function saveEdition(
  editionId: string,
  patch: {
    subject?: string
    preheader?: string
    content_json?: Record<string, unknown>
    content_html?: string
    content_mdx?: string
    segment?: string
    notes?: string
  },
): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  // Status guard: only idea, draft, ready, scheduled are editable
  const { data: current } = await supabase
    .from('newsletter_editions')
    .select('status')
    .eq('id', editionId)
    .single()

  const editableStatuses = ['idea', 'draft', 'ready', 'scheduled']
  if (!current || !editableStatuses.includes(current.status)) {
    return { ok: false, error: 'edition_locked' }
  }

  const { error } = await supabase
    .from('newsletter_editions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/newsletter/actions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/actions.ts apps/web/test/unit/newsletter/actions.test.ts
git commit -m "fix(newsletter): add status guard to saveEdition, accept content_json"
```

---

### Task 9: Server Actions — Fix `scheduleEdition` (Date Validation + Conflict Detection)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`
- Modify: `apps/web/test/unit/newsletter/actions.test.ts`

- [ ] **Step 1: Write the test**

Add to `apps/web/test/unit/newsletter/actions.test.ts`:

```typescript
describe('scheduleEdition — date validation', () => {
  it('rejects past dates', async () => {
    const { scheduleEdition } = await import('@/app/cms/(authed)/newsletters/actions')
    const pastDate = new Date(Date.now() - 60_000).toISOString()
    const result = await scheduleEdition('ed-1', pastDate)
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toBe('schedule_in_past')
  })

  it('rejects invalid ISO format', async () => {
    const { scheduleEdition } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await scheduleEdition('ed-1', 'not-a-date')
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toBe('invalid_date_format')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/actions.test.ts`
Expected: FAIL — scheduleEdition currently has no date validation.

- [ ] **Step 3: Fix scheduleEdition**

Replace `scheduleEdition` (lines 80-95) with:

```typescript
export async function scheduleEdition(
  editionId: string,
  scheduledAt: string,
): Promise<ActionResult & { conflict?: { subject: string; scheduledAt: string } }> {
  await requireSiteAdminForRow('newsletter_editions', editionId)

  // Validate ISO 8601 format
  const parsed = new Date(scheduledAt)
  if (isNaN(parsed.getTime())) {
    return { ok: false, error: 'invalid_date_format' }
  }

  // Validate date is in the future
  if (parsed.getTime() <= Date.now()) {
    return { ok: false, error: 'schedule_in_past' }
  }

  const supabase = getSupabaseServiceClient()

  // Fetch edition to check status and type
  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('status, newsletter_type_id')
    .eq('id', editionId)
    .single()

  if (!edition) return { ok: false, error: 'not_found' }

  const schedulableStatuses = ['idea', 'draft', 'ready', 'scheduled']
  if (!schedulableStatuses.includes(edition.status)) {
    return { ok: false, error: 'edition_not_schedulable' }
  }

  // Conflict detection: check for other editions within ±2 hours on same type
  if (edition.newsletter_type_id) {
    const twoHoursMs = 2 * 60 * 60 * 1000
    const rangeStart = new Date(parsed.getTime() - twoHoursMs).toISOString()
    const rangeEnd = new Date(parsed.getTime() + twoHoursMs).toISOString()

    const { data: conflicts } = await supabase
      .from('newsletter_editions')
      .select('id, subject, scheduled_at')
      .eq('newsletter_type_id', edition.newsletter_type_id)
      .eq('status', 'scheduled')
      .neq('id', editionId)
      .gte('scheduled_at', rangeStart)
      .lte('scheduled_at', rangeEnd)
      .limit(1)

    if (conflicts && conflicts.length > 0) {
      // Return conflict info but still allow scheduling
      const { error } = await supabase
        .from('newsletter_editions')
        .update({ status: 'scheduled', scheduled_at: scheduledAt })
        .eq('id', editionId)
      if (error) return { ok: false, error: error.message }
      revalidatePath('/cms/newsletters')
      return {
        ok: true,
        conflict: {
          subject: conflicts[0].subject,
          scheduledAt: conflicts[0].scheduled_at,
        },
      }
    }
  }

  const { error } = await supabase
    .from('newsletter_editions')
    .update({ status: 'scheduled', scheduled_at: scheduledAt })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/newsletter/actions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/actions.ts apps/web/test/unit/newsletter/actions.test.ts
git commit -m "fix(newsletter): add date validation + conflict detection to scheduleEdition"
```

---

### Task 10: Server Actions — Fix `cancelEdition` + `sendTestEmail` + `createEdition`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`
- Modify: `apps/web/test/unit/newsletter/actions.test.ts`

- [ ] **Step 1: Write the tests**

Add to `apps/web/test/unit/newsletter/actions.test.ts`:

```typescript
describe('cancelEdition — status guard', () => {
  it('rejects cancel for sent editions', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { status: 'sent' }, error: null }) }) }),
    })

    const { cancelEdition } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await cancelEdition('ed-1')
    expect(result).toEqual({ ok: false, error: 'cannot_cancel' })
  })

  it('allows cancel for scheduled editions', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { status: 'scheduled' }, error: null }) }) }),
    })
    mockFrom.mockReturnValue({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    })

    const { cancelEdition } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await cancelEdition('ed-1')
    expect(result.ok).toBe(true)
  })
})

describe('createEdition — type validation', () => {
  it('rejects when type does not exist', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }),
    })

    const { createEdition } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await createEdition('nonexistent-type', 'Test')
    expect(result).toEqual({ ok: false, error: 'type_not_found' })
  })

  it('rejects when type is inactive', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 't-1', active: false }, error: null }) }) }) }),
    })

    const { createEdition } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await createEdition('t-1', 'Test')
    expect(result).toEqual({ ok: false, error: 'type_inactive' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/actions.test.ts`
Expected: FAIL — cancelEdition has no status check; createEdition has no type validation.

- [ ] **Step 3: Fix cancelEdition**

Replace `cancelEdition` (lines 97-107) with:

```typescript
export async function cancelEdition(editionId: string): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  // Status guard: only scheduled, queued, idea, draft, ready can be cancelled
  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('status')
    .eq('id', editionId)
    .single()

  const cancellableStatuses = ['idea', 'draft', 'ready', 'scheduled', 'queued']
  if (!edition || !cancellableStatuses.includes(edition.status)) {
    return { ok: false, error: 'cannot_cancel' }
  }

  const { error } = await supabase
    .from('newsletter_editions')
    .update({ status: 'cancelled', scheduled_at: null })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true }
}
```

- [ ] **Step 4: Fix createEdition**

Replace `createEdition` (lines 52-78) with:

```typescript
export async function createEdition(
  newsletterTypeId: string,
  subject: string,
): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const supabase = getSupabaseServiceClient()

  // Validate type exists and is active
  const { data: type } = await supabase
    .from('newsletter_types')
    .select('id, active')
    .eq('id', newsletterTypeId)
    .eq('site_id', ctx.siteId)
    .single()

  if (!type) return { ok: false, error: 'type_not_found' }
  if (!type.active) return { ok: false, error: 'type_inactive' }

  const userClient = await getUserClient()
  const { data: { user } } = await userClient.auth.getUser()

  const { data, error } = await supabase
    .from('newsletter_editions')
    .insert({
      site_id: ctx.siteId,
      newsletter_type_id: newsletterTypeId,
      subject,
      status: 'draft',
      created_by: user?.id,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true, editionId: data.id }
}
```

- [ ] **Step 5: Fix sendTestEmail — add rate limit + status guard**

Replace `sendTestEmail` (lines 109-158) with:

```typescript
export async function sendTestEmail(editionId: string): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('subject, content_html, content_mdx, newsletter_type_id, status, test_sent_at')
    .eq('id', editionId)
    .single()
  if (!edition) return { ok: false, error: 'not_found' }

  // Status guard
  const testableStatuses = ['idea', 'draft', 'ready']
  if (!testableStatuses.includes(edition.status)) {
    return { ok: false, error: 'edition_not_testable' }
  }

  // Rate limit: 1 per minute
  if (edition.test_sent_at) {
    const lastSent = new Date(edition.test_sent_at).getTime()
    if (Date.now() - lastSent < 60_000) {
      return { ok: false, error: 'rate_limited' }
    }
  }

  const { data: type } = await supabase
    .from('newsletter_types')
    .select('name, sender_name, sender_email, color')
    .eq('id', edition.newsletter_type_id)
    .single()

  const senderName = type?.sender_name ?? 'Thiago Figueiredo'
  const senderEmail = type?.sender_email ?? 'newsletter@bythiagofigueiredo.com'
  const typeColor = type?.color ?? '#ea580c'

  const userClient = await getUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  const toEmail = user?.email
  if (!toEmail) return { ok: false, error: 'no_user_email' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'

  // Use sanitizeForEmail for content_html, fallback to raw content_mdx
  let contentHtml = edition.content_html
  if (contentHtml) {
    const { sanitizeForEmail } = await import('@/lib/newsletter/email-sanitizer')
    contentHtml = sanitizeForEmail(contentHtml, typeColor)
  } else {
    contentHtml = `<p>${edition.content_mdx ?? ''}</p>`
  }

  const html = await render(Newsletter({
    subject: edition.subject,
    preheader: undefined,
    contentHtml,
    typeName: type?.name ?? 'Newsletter',
    typeColor,
    unsubscribeUrl: `${appUrl}/newsletter/unsubscribe`,
    archiveUrl: `${appUrl}/newsletter/archive/${editionId}`,
  }))

  const emailService = getEmailService()
  await emailService.send({
    from: { name: senderName, email: senderEmail },
    to: toEmail,
    subject: `[TEST] ${edition.subject}`,
    html,
  })

  await supabase
    .from('newsletter_editions')
    .update({ test_sent_at: new Date().toISOString() })
    .eq('id', editionId)

  return { ok: true }
}
```

- [ ] **Step 6: Run tests to verify passes**

Run: `cd apps/web && npx vitest run test/unit/newsletter/actions.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/actions.ts apps/web/test/unit/newsletter/actions.test.ts
git commit -m "fix(newsletter): add status guards to cancelEdition, createEdition, sendTestEmail"
```

---

### Task 11: Server Actions — New `createIdea` + `deleteEdition`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`
- Modify: `apps/web/test/unit/newsletter/actions.test.ts`

- [ ] **Step 1: Write the tests**

Add to `apps/web/test/unit/newsletter/actions.test.ts`:

```typescript
describe('createIdea', () => {
  it('creates edition with idea status and nullable type_id', async () => {
    mockFrom.mockReturnValue({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'idea-1' }, error: null }) }) }),
    })

    const { createIdea } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await createIdea('My Newsletter Idea', 'Some notes')
    expect(result.ok).toBe(true)
    expect((result as { ok: true; editionId: string }).editionId).toBe('idea-1')
  })
})

describe('deleteEdition', () => {
  it('requires type match for sent editions (high tier)', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({
        data: { status: 'sent', subject: 'Test', content_html: '<p>x</p>' },
        error: null,
      }) }) }),
    })

    const { deleteEdition } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await deleteEdition('ed-1')
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toBe('requires_confirmation')
  })

  it('deletes empty draft without confirmation', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({
        data: { status: 'draft', subject: 'Untitled Edition', content_html: null, content_json: null },
        error: null,
      }) }) }),
    })
    mockFrom.mockReturnValue({
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    })

    const { deleteEdition } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await deleteEdition('ed-1', { confirmed: true })
    expect(result.ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/actions.test.ts`
Expected: FAIL — functions don't exist.

- [ ] **Step 3: Implement createIdea**

Add to `actions.ts`:

```typescript
export async function createIdea(
  title: string,
  notes?: string,
  typeId?: string,
): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const userClient = await getUserClient()
  const { data: { user } } = await userClient.auth.getUser()

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('newsletter_editions')
    .insert({
      site_id: ctx.siteId,
      newsletter_type_id: typeId ?? null,
      subject: title,
      notes: notes ?? null,
      status: 'idea',
      created_by: user?.id ?? null,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true, editionId: data.id }
}
```

- [ ] **Step 4: Implement deleteEdition**

Add to `actions.ts`:

```typescript
type DeleteResult =
  | { ok: true }
  | { ok: false; error: string; impactLevel?: 'low' | 'medium' | 'high' }

export async function deleteEdition(
  editionId: string,
  opts?: { confirmed?: boolean; confirmText?: string },
): Promise<DeleteResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('status, subject, content_html, content_json, scheduled_at, site_id')
    .eq('id', editionId)
    .single()

  if (!edition) return { ok: false, error: 'not_found' }

  // Determine impact tier
  const hasContent = !!(edition.content_html || edition.content_json)
  const isEmptyDraft = (edition.status === 'draft' || edition.status === 'idea') && !hasContent
  const isSent = edition.status === 'sent'
  const isScheduled = edition.status === 'scheduled'

  let impactLevel: 'low' | 'medium' | 'high' = 'low'
  if (isSent) impactLevel = 'high'
  else if (hasContent || isScheduled) impactLevel = 'medium'

  // For high-impact deletions, require typed confirmation
  if (impactLevel === 'high' && opts?.confirmText !== 'DELETE') {
    return { ok: false, error: 'requires_confirmation', impactLevel: 'high' }
  }

  // For medium-impact, require explicit confirmed flag
  if (impactLevel === 'medium' && !opts?.confirmed) {
    return { ok: false, error: 'requires_confirmation', impactLevel: 'medium' }
  }

  // Cancel if scheduled before deleting
  if (edition.status === 'scheduled') {
    await supabase
      .from('newsletter_editions')
      .update({ status: 'cancelled', scheduled_at: null })
      .eq('id', editionId)
  }

  // Delete edition
  const { error } = await supabase
    .from('newsletter_editions')
    .delete()
    .eq('id', editionId)

  if (error) return { ok: false, error: error.message }

  // Cleanup orphaned images from storage
  const { data: files } = await supabase.storage
    .from('newsletter-assets')
    .list(`${edition.site_id}/${editionId}`)

  if (files && files.length > 0) {
    const paths = files.map((f) => `${edition.site_id}/${editionId}/${f.name}`)
    await supabase.storage.from('newsletter-assets').remove(paths)
  }

  revalidatePath('/cms/newsletters')
  return { ok: true }
}
```

- [ ] **Step 5: Run tests to verify passes**

Run: `cd apps/web && npx vitest run test/unit/newsletter/actions.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/actions.ts apps/web/test/unit/newsletter/actions.test.ts
git commit -m "feat(newsletter): add createIdea + deleteEdition with tiered confirmation"
```

---

### Task 12: Server Actions — `duplicateEdition` + `revertToDraft` + `sendNow`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`
- Modify: `apps/web/test/unit/newsletter/actions.test.ts`

- [ ] **Step 1: Write the tests**

Add to `apps/web/test/unit/newsletter/actions.test.ts`:

```typescript
describe('duplicateEdition', () => {
  it('creates a draft copy with new subject prefix', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({
        data: {
          subject: 'Original', preheader: 'Preview', content_json: { type: 'doc' },
          content_html: '<p>test</p>', newsletter_type_id: 'type-1', segment: 'all',
          site_id: 'site-1',
        },
        error: null,
      }) }) }),
    })
    mockFrom.mockReturnValue({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'dup-1' }, error: null }) }) }),
    })

    const { duplicateEdition } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await duplicateEdition('ed-1')
    expect(result.ok).toBe(true)
    expect((result as { ok: true; editionId: string }).editionId).toBe('dup-1')
  })
})

describe('revertToDraft', () => {
  it('only allows revert from cancelled status', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { status: 'sent' }, error: null }) }) }),
    })

    const { revertToDraft } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await revertToDraft('ed-1')
    expect(result).toEqual({ ok: false, error: 'cannot_revert' })
  })

  it('reverts cancelled to draft and clears schedule', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { status: 'cancelled' }, error: null }) }) }),
    })
    mockFrom.mockReturnValue({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    })

    const { revertToDraft } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await revertToDraft('ed-1')
    expect(result.ok).toBe(true)
  })
})

describe('sendNow', () => {
  it('rejects sendNow for sent editions', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { status: 'sent' }, error: null }) }) }),
    })

    const { sendNow } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await sendNow('ed-1')
    expect(result).toEqual({ ok: false, error: 'cannot_send' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/actions.test.ts`
Expected: FAIL — functions don't exist.

- [ ] **Step 3: Implement duplicateEdition**

Add to `actions.ts`:

```typescript
export async function duplicateEdition(editionId: string): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  const { data: source } = await supabase
    .from('newsletter_editions')
    .select('subject, preheader, content_json, content_html, content_mdx, newsletter_type_id, segment, site_id')
    .eq('id', editionId)
    .single()

  if (!source) return { ok: false, error: 'not_found' }

  const userClient = await getUserClient()
  const { data: { user } } = await userClient.auth.getUser()

  const { data, error } = await supabase
    .from('newsletter_editions')
    .insert({
      site_id: source.site_id,
      newsletter_type_id: source.newsletter_type_id,
      subject: `Copy of ${source.subject}`,
      preheader: source.preheader,
      content_json: source.content_json,
      content_html: source.content_html,
      content_mdx: source.content_mdx,
      segment: source.segment,
      status: 'draft',
      created_by: user?.id ?? null,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true, editionId: data.id }
}
```

- [ ] **Step 4: Implement revertToDraft**

Add to `actions.ts`:

```typescript
export async function revertToDraft(editionId: string): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('status')
    .eq('id', editionId)
    .single()

  if (!edition) return { ok: false, error: 'not_found' }

  // Only cancelled or failed can revert to draft
  if (!['cancelled', 'failed'].includes(edition.status)) {
    return { ok: false, error: 'cannot_revert' }
  }

  const { error } = await supabase
    .from('newsletter_editions')
    .update({ status: 'draft', scheduled_at: null, slot_date: null })
    .eq('id', editionId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true }
}
```

- [ ] **Step 5: Implement sendNow**

Add to `actions.ts`:

```typescript
export async function sendNow(editionId: string): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('status, newsletter_type_id, site_id')
    .eq('id', editionId)
    .single()

  if (!edition) return { ok: false, error: 'not_found' }

  const sendableStatuses = ['idea', 'draft', 'ready', 'scheduled']
  if (!sendableStatuses.includes(edition.status)) {
    return { ok: false, error: 'cannot_send' }
  }

  // Check subscriber count
  if (edition.newsletter_type_id) {
    const { count } = await supabase
      .from('newsletter_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('newsletter_id', edition.newsletter_type_id)
      .eq('status', 'confirmed')

    if (!count || count === 0) {
      return { ok: false, error: 'no_subscribers' }
    }
  } else {
    return { ok: false, error: 'no_type_assigned' }
  }

  // Transition to sending — the send cron or inline pipeline picks it up
  const { error } = await supabase
    .from('newsletter_editions')
    .update({
      status: 'sending',
      scheduled_at: new Date().toISOString(),
    })
    .eq('id', editionId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true }
}
```

- [ ] **Step 6: Run tests to verify passes**

Run: `cd apps/web && npx vitest run test/unit/newsletter/actions.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/actions.ts apps/web/test/unit/newsletter/actions.test.ts
git commit -m "feat(newsletter): add duplicateEdition, revertToDraft, sendNow actions"
```

---

### Task 13: Server Actions — Type CRUD (`createNewsletterType`, `updateNewsletterType`, `deleteNewsletterType`)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`
- Modify: `apps/web/test/unit/newsletter/actions.test.ts`

- [ ] **Step 1: Write the tests**

Add to `apps/web/test/unit/newsletter/actions.test.ts`:

```typescript
describe('createNewsletterType', () => {
  it('creates type with generated slug and site_id', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }) }),
    })
    mockFrom.mockReturnValue({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'new-type-1' }, error: null }) }) }),
    })

    const { createNewsletterType } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await createNewsletterType({ name: 'Weekly Digest', locale: 'pt-BR' })
    expect(result.ok).toBe(true)
  })
})

describe('deleteNewsletterType', () => {
  it('returns impact data when not confirmed', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 't-1', name: 'Test' }, error: null }) }) }),
    })
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ eq: () => Promise.resolve({ count: 50, error: null }) }) }),
    })
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => Promise.resolve({ count: 10, error: null }) }),
    })

    const { deleteNewsletterType } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await deleteNewsletterType('t-1')
    expect(result.ok).toBe(false)
    expect((result as any).subscriberCount).toBe(50)
    expect((result as any).editionCount).toBe(10)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/actions.test.ts`
Expected: FAIL — functions don't exist.

- [ ] **Step 3: Implement type CRUD actions**

Add to `actions.ts`:

```typescript
interface TypeData {
  name: string
  locale: string
  color?: string
  tagline?: string
  sortOrder?: number
}

type TypeDeleteResult =
  | { ok: true }
  | { ok: false; error: string; subscriberCount?: number; editionCount?: number }

export async function createNewsletterType(data: TypeData): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const supabase = getSupabaseServiceClient()

  // Check name uniqueness per site+locale
  const { data: existing } = await supabase
    .from('newsletter_types')
    .select('id')
    .eq('site_id', ctx.siteId)
    .eq('locale', data.locale)
    .eq('name', data.name)
    .single()

  if (existing) return { ok: false, error: 'name_already_exists' }

  const { data: created, error } = await supabase
    .from('newsletter_types')
    .insert({
      site_id: ctx.siteId,
      name: data.name,
      locale: data.locale,
      color: data.color ?? '#7c3aed',
      tagline: data.tagline ?? null,
      sort_order: data.sortOrder ?? 99,
      active: true,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true, editionId: created.id }
}

export async function updateNewsletterType(
  typeId: string,
  patch: { name?: string; tagline?: string; color?: string; sortOrder?: number; active?: boolean },
): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const supabase = getSupabaseServiceClient()
  const updateData: Record<string, unknown> = {}
  if (patch.name !== undefined) updateData.name = patch.name
  if (patch.tagline !== undefined) updateData.tagline = patch.tagline
  if (patch.color !== undefined) updateData.color = patch.color
  if (patch.sortOrder !== undefined) updateData.sort_order = patch.sortOrder
  if (patch.active !== undefined) updateData.active = patch.active

  const { error } = await supabase
    .from('newsletter_types')
    .update(updateData)
    .eq('id', typeId)
    .eq('site_id', ctx.siteId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true }
}

export async function deleteNewsletterType(
  typeId: string,
  opts?: { confirmed?: boolean; confirmText?: string },
): Promise<TypeDeleteResult> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const supabase = getSupabaseServiceClient()

  // Fetch type info
  const { data: type } = await supabase
    .from('newsletter_types')
    .select('id, name')
    .eq('id', typeId)
    .single()

  if (!type) return { ok: false, error: 'not_found' }

  // Count impact
  const { count: subscriberCount } = await supabase
    .from('newsletter_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('newsletter_id', typeId)
    .eq('status', 'confirmed')

  const { count: editionCount } = await supabase
    .from('newsletter_editions')
    .select('id', { count: 'exact', head: true })
    .eq('newsletter_type_id', typeId)

  const subs = subscriberCount ?? 0
  const editions = editionCount ?? 0

  // If not confirmed, return impact for client to show tier-appropriate modal
  if (!opts?.confirmed) {
    return { ok: false, error: 'requires_confirmation', subscriberCount: subs, editionCount: editions }
  }

  // High-tier: subscribers > 0 requires typed name match
  if (subs > 0 && opts.confirmText !== type.name) {
    return { ok: false, error: 'confirm_text_mismatch', subscriberCount: subs, editionCount: editions }
  }

  // Orphan editions → set type_id to NULL (become ideas)
  if (editions > 0) {
    await supabase
      .from('newsletter_editions')
      .update({ newsletter_type_id: null, status: 'idea' })
      .eq('newsletter_type_id', typeId)
      .in('status', ['draft', 'ready', 'idea'])
  }

  // Unlink subscriptions
  await supabase
    .from('newsletter_subscriptions')
    .update({ newsletter_id: null })
    .eq('newsletter_id', typeId)

  // Delete the type
  const { error } = await supabase
    .from('newsletter_types')
    .delete()
    .eq('id', typeId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true }
}
```

- [ ] **Step 4: Run tests to verify passes**

Run: `cd apps/web && npx vitest run test/unit/newsletter/actions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/actions.ts apps/web/test/unit/newsletter/actions.test.ts
git commit -m "feat(newsletter): add type CRUD actions (create, update, delete)"
```

---

### Task 14: Server Actions — `uploadNewsletterImage` + `renderEmailPreview`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`
- Modify: `apps/web/test/unit/newsletter/actions.test.ts`

- [ ] **Step 1: Write the tests**

Add to `apps/web/test/unit/newsletter/actions.test.ts`:

```typescript
describe('uploadNewsletterImage', () => {
  it('rejects files larger than 2MB', async () => {
    const bigFile = new File([new ArrayBuffer(3_000_000)], 'large.jpg', { type: 'image/jpeg' })

    const { uploadNewsletterImage } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await uploadNewsletterImage(bigFile, 'ed-1')
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toBe('file_too_large')
  })

  it('rejects unsupported formats', async () => {
    const svgFile = new File(['<svg></svg>'], 'image.svg', { type: 'image/svg+xml' })

    const { uploadNewsletterImage } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await uploadNewsletterImage(svgFile, 'ed-1')
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toBe('unsupported_format')
  })
})

describe('renderEmailPreview', () => {
  it('returns HTML string for valid edition', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({
        data: {
          subject: 'Test', preheader: 'Preview', content_html: '<p>Hello</p>',
          newsletter_type_id: 'type-1', site_id: 'site-1',
        },
        error: null,
      }) }) }),
    })
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({
        data: { name: 'Weekly', color: '#7c3aed', sender_name: 'Test' },
        error: null,
      }) }) }),
    })

    const { renderEmailPreview } = await import('@/app/cms/(authed)/newsletters/actions')
    const result = await renderEmailPreview('ed-1')
    expect(result.ok).toBe(true)
    expect((result as { ok: true; html: string }).html).toContain('Hello')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/actions.test.ts`
Expected: FAIL — functions don't exist.

- [ ] **Step 3: Implement uploadNewsletterImage**

Add to `actions.ts`:

```typescript
type UploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_IMAGE_SIZE = 2 * 1024 * 1024 // 2MB

export async function uploadNewsletterImage(
  file: File,
  editionId: string,
): Promise<UploadResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)

  // Validate file size
  if (file.size > MAX_IMAGE_SIZE) {
    return { ok: false, error: 'file_too_large' }
  }

  // Validate format
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, error: 'unsupported_format' }
  }

  const supabase = getSupabaseServiceClient()

  // Get site_id for path
  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('site_id')
    .eq('id', editionId)
    .single()

  if (!edition) return { ok: false, error: 'not_found' }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const uuid = crypto.randomUUID()
  const path = `${edition.site_id}/${editionId}/${uuid}.${ext}`

  const { error } = await supabase.storage
    .from('newsletter-assets')
    .upload(path, file, { contentType: file.type })

  if (error) return { ok: false, error: error.message }

  const { data: { publicUrl } } = supabase.storage
    .from('newsletter-assets')
    .getPublicUrl(path)

  return { ok: true, url: publicUrl }
}
```

- [ ] **Step 4: Implement renderEmailPreview**

Add to `actions.ts`:

```typescript
type PreviewResult =
  | { ok: true; html: string }
  | { ok: false; error: string }

export async function renderEmailPreview(editionId: string): Promise<PreviewResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('subject, preheader, content_html, newsletter_type_id, site_id')
    .eq('id', editionId)
    .single()

  if (!edition) return { ok: false, error: 'not_found' }
  if (!edition.content_html) return { ok: false, error: 'no_content' }

  const { data: type } = await supabase
    .from('newsletter_types')
    .select('name, color, sender_name')
    .eq('id', edition.newsletter_type_id)
    .single()

  const typeColor = type?.color ?? '#7c3aed'
  const typeName = type?.name ?? 'Newsletter'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'

  const { sanitizeForEmail } = await import('@/lib/newsletter/email-sanitizer')
  const sanitizedHtml = sanitizeForEmail(edition.content_html, typeColor)

  const html = await render(Newsletter({
    subject: edition.subject,
    preheader: edition.preheader ?? undefined,
    contentHtml: sanitizedHtml,
    typeName,
    typeColor,
    unsubscribeUrl: `${appUrl}/newsletter/unsubscribe`,
    archiveUrl: `${appUrl}/newsletter/archive/${editionId}`,
  }))

  return { ok: true, html }
}
```

- [ ] **Step 5: Run tests to verify passes**

Run: `cd apps/web && npx vitest run test/unit/newsletter/actions.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/actions.ts apps/web/test/unit/newsletter/actions.test.ts
git commit -m "feat(newsletter): add uploadNewsletterImage + renderEmailPreview actions"
```

---

### Task 15: Merge Tag Node (TipTap Custom Extension)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/merge-tag-node.tsx`
- Test: `apps/web/test/unit/newsletter/merge-tag-node.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/test/unit/newsletter/merge-tag-node.test.ts
import { describe, it, expect } from 'vitest'
import { MERGE_TAGS, MergeTagExtension } from '@/app/cms/(authed)/newsletters/_components/merge-tag-node'

describe('MergeTag extension', () => {
  it('exports all 7 available merge tags', () => {
    expect(MERGE_TAGS).toHaveLength(7)
    expect(MERGE_TAGS.map((t) => t.value)).toContain('subscriber.email')
    expect(MERGE_TAGS.map((t) => t.value)).toContain('subscriber.name')
    expect(MERGE_TAGS.map((t) => t.value)).toContain('urls.unsubscribe')
    expect(MERGE_TAGS.map((t) => t.value)).toContain('urls.preferences')
    expect(MERGE_TAGS.map((t) => t.value)).toContain('urls.web_archive')
    expect(MERGE_TAGS.map((t) => t.value)).toContain('edition.subject')
    expect(MERGE_TAGS.map((t) => t.value)).toContain('newsletter.name')
  })

  it('MergeTagExtension is a valid TipTap Node extension', () => {
    expect(MergeTagExtension.name).toBe('mergeTag')
    expect(MergeTagExtension.type).toBe('node')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/merge-tag-node.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement merge tag extension**

```typescript
// apps/web/src/app/cms/(authed)/newsletters/_components/merge-tag-node.tsx
'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'

export interface MergeTag {
  value: string
  label: string
  fallback?: string
}

export const MERGE_TAGS: MergeTag[] = [
  { value: 'subscriber.email', label: 'Subscriber Email' },
  { value: 'subscriber.name', label: 'Subscriber Name', fallback: 'Email prefix' },
  { value: 'edition.subject', label: 'Edition Subject' },
  { value: 'newsletter.name', label: 'Newsletter Name' },
  { value: 'urls.unsubscribe', label: 'Unsubscribe URL' },
  { value: 'urls.preferences', label: 'Preferences URL' },
  { value: 'urls.web_archive', label: 'View in Browser URL' },
]

function MergeTagNodeView({ node }: { node: { attrs: { tag: string } } }) {
  const tag = MERGE_TAGS.find((t) => t.value === node.attrs.tag)
  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        className="inline-flex items-center rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 select-none"
        contentEditable={false}
      >
        {`{{${tag?.label ?? node.attrs.tag}}}`}
      </span>
    </NodeViewWrapper>
  )
}

export const MergeTagExtension = Node.create({
  name: 'mergeTag',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      tag: { default: 'subscriber.name' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-merge-tag]', getAttrs: (el) => ({ tag: (el as HTMLElement).getAttribute('data-merge-tag') }) }]
  },

  renderHTML({ HTMLAttributes }) {
    const tag = HTMLAttributes.tag
    return ['span', mergeAttributes({ 'data-merge-tag': tag }, HTMLAttributes), `{{${tag}}}`]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MergeTagNodeView)
  },
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/newsletter/merge-tag-node.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_components/merge-tag-node.tsx apps/web/test/unit/newsletter/merge-tag-node.test.ts
git commit -m "feat(newsletter): add MergeTag TipTap custom inline node"
```

---

### Task 16: CTA Button Node (TipTap Custom Extension)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/cta-button-node.tsx`

- [ ] **Step 1: Implement CTA button node**

```typescript
// apps/web/src/app/cms/(authed)/newsletters/_components/cta-button-node.tsx
'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { useState } from 'react'

function CTAButtonNodeView({
  node,
  updateAttributes,
}: {
  node: { attrs: { text: string; url: string; color: string; align: string } }
  updateAttributes: (attrs: Record<string, unknown>) => void
}) {
  const [editing, setEditing] = useState(false)
  const { text, url, color, align } = node.attrs

  if (editing) {
    return (
      <NodeViewWrapper>
        <div className="rounded border border-cms-border p-3 my-2 bg-cms-surface-subtle space-y-2">
          <input
            type="text"
            value={text}
            onChange={(e) => updateAttributes({ text: e.target.value })}
            placeholder="Button text"
            className="w-full rounded border px-2 py-1 text-sm"
          />
          <input
            type="url"
            value={url}
            onChange={(e) => updateAttributes({ url: e.target.value })}
            placeholder="https://..."
            className="w-full rounded border px-2 py-1 text-sm"
          />
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={color}
              onChange={(e) => updateAttributes({ color: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer"
            />
            <select
              value={align}
              onChange={(e) => updateAttributes({ align: e.target.value })}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="ml-auto text-sm text-cms-accent"
            >
              Done
            </button>
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper>
      <div
        className="my-2"
        style={{ textAlign: align as 'left' | 'center' | 'right' }}
        onDoubleClick={() => setEditing(true)}
      >
        <a
          href={url}
          className="inline-block rounded-md px-8 py-3 font-semibold text-white no-underline cursor-pointer"
          style={{ backgroundColor: color }}
          onClick={(e) => e.preventDefault()}
        >
          {text || 'Button Text'}
        </a>
      </div>
    </NodeViewWrapper>
  )
}

export const CTAButtonExtension = Node.create({
  name: 'ctaButton',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      text: { default: 'Click Here' },
      url: { default: '' },
      color: { default: '#7c3aed' },
      align: { default: 'center' },
    }
  },

  parseHTML() {
    return [{ tag: 'div.cta-wrapper' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { text, url, color, align } = HTMLAttributes
    return [
      'div',
      mergeAttributes({ class: 'cta-wrapper', style: `text-align:${align}` }),
      ['a', { class: 'cta-button', href: url, style: `background:${color}` }, text],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CTAButtonNodeView)
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_components/cta-button-node.tsx
git commit -m "feat(newsletter): add CTAButton TipTap custom block node"
```

---

### Task 17: TipTap Editor Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/tiptap-editor.tsx`

- [ ] **Step 1: Implement TipTap editor wrapper**

```typescript
// apps/web/src/app/cms/(authed)/newsletters/_components/tiptap-editor.tsx
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Color from '@tiptap/extension-color'
import TextStyle from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { MergeTagExtension } from './merge-tag-node'
import { CTAButtonExtension } from './cta-button-node'
import { EditorToolbar } from './editor-toolbar'
import { useCallback, useEffect, useRef } from 'react'
import type { JSONContent } from '@tiptap/core'

const EMAIL_SAFE_FONTS = [
  'Arial, Helvetica, sans-serif',
  'Verdana, Geneva, sans-serif',
  'Trebuchet MS, sans-serif',
  'Tahoma, Geneva, sans-serif',
  'Georgia, serif',
  'Times New Roman, Times, serif',
  'Palatino Linotype, serif',
  'Courier New, monospace',
  'Lucida Console, monospace',
]

function cleanPastedHtml(html: string): string {
  let cleaned = html
  // Strip Word XML namespaces
  cleaned = cleaned.replace(/<o:p>[\s\S]*?<\/o:p>/gi, '')
  cleaned = cleaned.replace(/\s*mso-[^:]+:[^;"]+;?/gi, '')
  // Strip Google Docs wrapper
  cleaned = cleaned.replace(/<b[^>]*id="docs-internal-guid-[^"]*"[^>]*>/gi, '')
  // Normalize font-weight spans to strong
  cleaned = cleaned.replace(/<span[^>]*font-weight:\s*(?:700|bold)[^>]*>([\s\S]*?)<\/span>/gi, '<strong>$1</strong>')
  // Strip non-safe fonts → Arial
  const fontRegex = /font-family:\s*[^;"]+/gi
  cleaned = cleaned.replace(fontRegex, (match) => {
    const isSafe = EMAIL_SAFE_FONTS.some((f) => match.toLowerCase().includes(f.split(',')[0].toLowerCase()))
    return isSafe ? match : 'font-family:Arial, Helvetica, sans-serif'
  })
  // Strip class/id attributes
  cleaned = cleaned.replace(/\s+(class|id)="[^"]*"/gi, '')
  // Strip empty paragraphs
  cleaned = cleaned.replace(/<p[^>]*>\s*(<br\s*\/?>)?\s*<\/p>/gi, '')
  return cleaned
}

interface TipTapEditorProps {
  initialContent?: JSONContent | null
  editable?: boolean
  onUpdate?: (json: JSONContent, html: string) => void
  onImageUpload?: (file: File) => Promise<string | null>
  placeholder?: string
}

export function TipTapEditor({
  initialContent,
  editable = true,
  onUpdate,
  onImageUpload,
  placeholder = 'Start writing your newsletter...',
}: TipTapEditorProps) {
  const isInitializedRef = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Image.configure({ allowBase64: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Color,
      TextStyle,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
      MergeTagExtension,
      CTAButtonExtension,
    ],
    content: initialContent ?? undefined,
    editable,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] px-6 py-4',
      },
      transformPastedHTML: cleanPastedHtml,
      handleDrop: (view, event, _slice, moved) => {
        if (moved || !event.dataTransfer?.files.length) return false
        const file = event.dataTransfer.files[0]
        if (file && file.type.startsWith('image/') && onImageUpload) {
          onImageUpload(file).then((url) => {
            if (url) {
              const { tr } = view.state
              const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? tr.selection.from
              const node = view.state.schema.nodes.image.create({ src: url })
              view.dispatch(tr.insert(pos, node))
            }
          })
          return true
        }
        return false
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of items) {
          if (item.type.startsWith('image/') && onImageUpload) {
            const file = item.getAsFile()
            if (file) {
              onImageUpload(file).then((url) => {
                if (url) {
                  const node = view.state.schema.nodes.image.create({ src: url })
                  const tr = view.state.tr.replaceSelectionWith(node)
                  view.dispatch(tr)
                }
              })
              return true
            }
          }
        }
        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (isInitializedRef.current) {
        onUpdate?.(ed.getJSON(), ed.getHTML())
      }
    },
  })

  useEffect(() => {
    if (editor && !isInitializedRef.current) {
      isInitializedRef.current = true
    }
  }, [editor])

  const insertMergeTag = useCallback(
    (tag: string) => {
      editor?.chain().focus().insertContent({ type: 'mergeTag', attrs: { tag } }).run()
    },
    [editor],
  )

  const insertCTAButton = useCallback(() => {
    editor?.chain().focus().insertContent({ type: 'ctaButton', attrs: { text: 'Click Here', url: '', color: '#7c3aed', align: 'center' } }).run()
  }, [editor])

  if (!editor) return null

  return (
    <div className="rounded border border-cms-border bg-white overflow-hidden">
      <EditorToolbar
        editor={editor}
        onInsertMergeTag={insertMergeTag}
        onInsertCTAButton={insertCTAButton}
        emailSafeFonts={EMAIL_SAFE_FONTS}
      />
      <EditorContent editor={editor} />
      <div className="flex items-center justify-between border-t border-cms-border-subtle px-4 py-2 text-xs text-cms-text-dim">
        <span>{editor.storage.characterCount.words()} words</span>
        <span>{editor.storage.characterCount.characters()} characters</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_components/tiptap-editor.tsx
git commit -m "feat(newsletter): add TipTap WYSIWYG editor component with paste cleanup"
```

---

### Task 18: Editor Toolbar Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/editor-toolbar.tsx`

- [ ] **Step 1: Implement toolbar**

```typescript
// apps/web/src/app/cms/(authed)/newsletters/_components/editor-toolbar.tsx
'use client'

import type { Editor } from '@tiptap/react'
import { MERGE_TAGS } from './merge-tag-node'
import { useState } from 'react'

interface EditorToolbarProps {
  editor: Editor
  onInsertMergeTag: (tag: string) => void
  onInsertCTAButton: () => void
  emailSafeFonts: string[]
}

const FONT_SIZES = ['10', '12', '14', '16', '18', '20', '24', '28', '32']

export function EditorToolbar({ editor, onInsertMergeTag, onInsertCTAButton, emailSafeFonts }: EditorToolbarProps) {
  const [showMergeDropdown, setShowMergeDropdown] = useState(false)

  function ToolbarButton({
    onClick,
    active,
    title,
    children,
  }: {
    onClick: () => void
    active?: boolean
    title: string
    children: React.ReactNode
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={`px-2 py-1.5 rounded text-sm hover:bg-cms-surface-hover transition-colors
          ${active ? 'bg-cms-accent/10 text-cms-accent font-semibold' : 'text-cms-text'}`}
      >
        {children}
      </button>
    )
  }

  function Separator() {
    return <div className="w-px h-5 bg-cms-border-subtle mx-1" />
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-cms-border px-3 py-1.5 bg-cms-surface-subtle">
      {/* Undo/Redo */}
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo (⌘Z)">↩</ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo (⌘⇧Z)">↪</ToolbarButton>

      <Separator />

      {/* Font Family */}
      <select
        onChange={(e) => editor.chain().focus().setMark('textStyle', { fontFamily: e.target.value }).run()}
        className="text-xs border rounded px-1 py-1 bg-white max-w-[120px]"
        title="Font family"
      >
        {emailSafeFonts.map((f) => (
          <option key={f} value={f}>{f.split(',')[0]}</option>
        ))}
      </select>

      {/* Font Size */}
      <select
        onChange={(e) => editor.chain().focus().setMark('textStyle', { fontSize: `${e.target.value}px` }).run()}
        defaultValue="16"
        className="text-xs border rounded px-1 py-1 bg-white w-14"
        title="Font size"
      >
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>{s}px</option>
        ))}
      </select>

      <Separator />

      {/* Text Formatting */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (⌘B)">
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (⌘I)">
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (⌘U)">
        <u>U</u>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
        <s>S</s>
      </ToolbarButton>

      <Separator />

      {/* Color */}
      <input
        type="color"
        onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        className="w-6 h-6 rounded cursor-pointer border-0 p-0"
        title="Text color"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
        active={editor.isActive('highlight')}
        title="Highlight"
      >
        🖍
      </ToolbarButton>

      <Separator />

      {/* Alignment */}
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">
        ≡
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">
        ≡
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">
        ≡
      </ToolbarButton>

      <Separator />

      {/* Lists */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
        •
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
        1.
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
        "
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
        —
      </ToolbarButton>

      <Separator />

      {/* Link */}
      <ToolbarButton
        onClick={() => {
          const url = window.prompt('URL:')
          if (url) editor.chain().focus().setLink({ href: url }).run()
        }}
        active={editor.isActive('link')}
        title="Link (⌘K)"
      >
        🔗
      </ToolbarButton>

      {/* Image */}
      <ToolbarButton
        onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'image/jpeg,image/png,image/gif,image/webp'
          input.onchange = () => {
            const file = input.files?.[0]
            if (file) {
              editor.commands.insertContent(`<img src="" alt="Uploading..." />`)
            }
          }
          input.click()
        }}
        title="Insert image"
      >
        🖼
      </ToolbarButton>

      {/* CTA Button */}
      <ToolbarButton onClick={onInsertCTAButton} title="Insert CTA button">
        ▢
      </ToolbarButton>

      <Separator />

      {/* Merge Tag Dropdown */}
      <div className="relative">
        <ToolbarButton onClick={() => setShowMergeDropdown(!showMergeDropdown)} title="Insert merge tag">
          🏷
        </ToolbarButton>
        {showMergeDropdown && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-cms-border rounded shadow-lg z-50 min-w-[200px]">
            {MERGE_TAGS.map((tag) => (
              <button
                key={tag.value}
                type="button"
                onClick={() => {
                  onInsertMergeTag(tag.value)
                  setShowMergeDropdown(false)
                }}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-cms-surface-hover"
              >
                {tag.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Heading Dropdown */}
      <select
        onChange={(e) => {
          const level = parseInt(e.target.value)
          if (level === 0) editor.chain().focus().setParagraph().run()
          else editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()
        }}
        className="text-xs border rounded px-1 py-1 bg-white"
        title="Heading level"
        value={
          editor.isActive('heading', { level: 1 }) ? '1' :
          editor.isActive('heading', { level: 2 }) ? '2' :
          editor.isActive('heading', { level: 3 }) ? '3' : '0'
        }
      >
        <option value="0">Paragraph</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_components/editor-toolbar.tsx
git commit -m "feat(newsletter): add Gmail-style editor toolbar for TipTap"
```

---

### Task 19: Delete Confirm Modal

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/delete-confirm-modal.tsx`

- [ ] **Step 1: Implement tiered delete modal**

```typescript
// apps/web/src/app/cms/(authed)/newsletters/_components/delete-confirm-modal.tsx
'use client'

import { useState } from 'react'

interface DeleteConfirmModalProps {
  open: boolean
  title: string
  description: string
  impactLevel: 'low' | 'medium' | 'high'
  confirmText?: string
  stats?: { subscribers?: number; editions?: number; sentCount?: number }
  onConfirm: (confirmText?: string) => void
  onCancel: () => void
}

export function DeleteConfirmModal({
  open,
  title,
  description,
  impactLevel,
  confirmText,
  stats,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  const [typed, setTyped] = useState('')

  if (!open) return null

  const isHighTierValid = impactLevel !== 'high' || typed === (confirmText ?? 'DELETE')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-cms-text">{title}</h3>
        <p className="mt-2 text-sm text-cms-text-muted">{description}</p>

        {stats && (impactLevel === 'medium' || impactLevel === 'high') && (
          <div className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">
            {stats.subscribers != null && <p>{stats.subscribers} active subscribers</p>}
            {stats.editions != null && <p>{stats.editions} editions linked</p>}
            {stats.sentCount != null && <p>{stats.sentCount} emails sent</p>}
          </div>
        )}

        {impactLevel === 'high' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-cms-text mb-1">
              Type <span className="font-mono text-red-600">{confirmText ?? 'DELETE'}</span> to confirm
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full rounded border border-red-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-red-500"
              placeholder={confirmText ?? 'DELETE'}
              autoFocus
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border px-4 py-2 text-sm hover:bg-cms-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(typed || undefined)}
            disabled={!isHighTierValid}
            className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {impactLevel === 'medium' ? 'Delete & Cancel Send' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_components/delete-confirm-modal.tsx
git commit -m "feat(newsletter): add tiered DeleteConfirmModal component"
```

---

### Task 20: Schedule Modal

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/schedule-modal.tsx`

- [ ] **Step 1: Implement schedule modal**

```typescript
// apps/web/src/app/cms/(authed)/newsletters/_components/schedule-modal.tsx
'use client'

import { useState } from 'react'

interface ScheduleModalProps {
  open: boolean
  audienceCount: number
  conflict?: { subject: string; scheduledAt: string } | null
  onConfirm: (scheduledAt: string) => void
  onCancel: () => void
}

const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
]

export function ScheduleModal({ open, audienceCount, conflict, onConfirm, onCancel }: ScheduleModalProps) {
  const now = new Date()
  const defaultDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const [date, setDate] = useState(defaultDate.toISOString().split('T')[0])
  const [time, setTime] = useState('09:00')
  const [timezone, setTimezone] = useState('America/Sao_Paulo')

  const selectedDateTime = new Date(`${date}T${time}:00`)
  const isInFuture = selectedDateTime.getTime() > Date.now()

  function handleConfirm() {
    const isoDate = new Date(`${date}T${time}:00`).toISOString()
    onConfirm(isoDate)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-cms-text">Schedule Edition</h3>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={now.toISOString().split('T')[0]}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
        </div>

        {conflict && (
          <div className="mt-3 rounded bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
            <strong>Conflict:</strong> "{conflict.subject}" is scheduled within 2 hours ({new Date(conflict.scheduledAt).toLocaleString()})
          </div>
        )}

        <div className="mt-4 rounded bg-cms-surface-subtle p-3 text-sm text-cms-text-muted">
          Will send to <strong>{audienceCount}</strong> subscribers
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded border px-4 py-2 text-sm hover:bg-cms-surface-hover">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isInFuture}
            className="rounded bg-cms-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            Confirm Schedule
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_components/schedule-modal.tsx
git commit -m "feat(newsletter): add ScheduleModal with date/time/timezone picker"
```

---

### Task 21: Send Now Modal

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/send-now-modal.tsx`

- [ ] **Step 1: Implement send now modal**

```typescript
// apps/web/src/app/cms/(authed)/newsletters/_components/send-now-modal.tsx
'use client'

interface SendNowModalProps {
  open: boolean
  subject: string
  recipientCount: number
  senderName: string
  senderEmail: string
  onConfirm: () => void
  onCancel: () => void
}

export function SendNowModal({
  open,
  subject,
  recipientCount,
  senderName,
  senderEmail,
  onConfirm,
  onCancel,
}: SendNowModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-cms-text">Send Now</h3>

        <div className="mt-4 space-y-2 text-sm text-cms-text-muted">
          <p><strong>Subject:</strong> {subject}</p>
          <p><strong>From:</strong> {senderName} &lt;{senderEmail}&gt;</p>
          <p><strong>Recipients:</strong> {recipientCount} subscribers</p>
        </div>

        <div className="mt-4 rounded bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
          This action cannot be undone. Emails will begin sending immediately.
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded border px-4 py-2 text-sm hover:bg-cms-surface-hover">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700"
          >
            Send to {recipientCount} subscribers
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_components/send-now-modal.tsx
git commit -m "feat(newsletter): add SendNowModal confirmation component"
```

---

### Task 22: Type Modal (Create/Edit)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/type-modal.tsx`

- [ ] **Step 1: Implement type modal**

```typescript
// apps/web/src/app/cms/(authed)/newsletters/_components/type-modal.tsx
'use client'

import { useState } from 'react'

interface TypeModalProps {
  open: boolean
  mode: 'create' | 'edit'
  initialData?: { name: string; locale: string; color: string; tagline: string; sortOrder: number }
  onSubmit: (data: { name: string; locale: string; color: string; tagline: string; sortOrder: number }) => void
  onCancel: () => void
}

const COLOR_PRESETS = ['#7c3aed', '#ea580c', '#059669', '#2563eb', '#dc2626', '#d97706']

export function TypeModal({ open, mode, initialData, onSubmit, onCancel }: TypeModalProps) {
  const [name, setName] = useState(initialData?.name ?? '')
  const [locale, setLocale] = useState(initialData?.locale ?? 'pt-BR')
  const [color, setColor] = useState(initialData?.color ?? COLOR_PRESETS[0])
  const [tagline, setTagline] = useState(initialData?.tagline ?? '')
  const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? 99)

  if (!open) return null

  const isValid = name.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-cms-text">
          {mode === 'create' ? 'Create Newsletter Type' : 'Edit Newsletter Type'}
        </h3>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekly Digest"
              className="w-full rounded border px-3 py-2 text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Locale</label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              disabled={mode === 'edit'}
              className="w-full rounded border px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="pt-BR">Português (BR)</option>
              <option value="en">English</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Color</label>
            <div className="flex items-center gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-cms-text scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tagline</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Short description..."
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Sort Order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              min={0}
              className="w-20 rounded border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded border px-4 py-2 text-sm hover:bg-cms-surface-hover">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit({ name, locale, color, tagline, sortOrder })}
            disabled={!isValid}
            className="rounded bg-cms-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {mode === 'create' ? 'Create Type' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_components/type-modal.tsx
git commit -m "feat(newsletter): add TypeModal for create/edit newsletter types"
```

---

### Task 23: Convert Idea Modal

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/convert-idea-modal.tsx`

- [ ] **Step 1: Implement convert idea modal**

```typescript
// apps/web/src/app/cms/(authed)/newsletters/_components/convert-idea-modal.tsx
'use client'

import { useState } from 'react'

interface ConvertIdeaModalProps {
  open: boolean
  ideaTitle: string
  ideaCreatedAt: string
  types: Array<{ id: string; name: string; color: string }>
  onConfirm: (typeId: string, subject: string) => void
  onCancel: () => void
}

export function ConvertIdeaModal({
  open,
  ideaTitle,
  ideaCreatedAt,
  types,
  onConfirm,
  onCancel,
}: ConvertIdeaModalProps) {
  const [typeId, setTypeId] = useState(types[0]?.id ?? '')
  const [subject, setSubject] = useState(ideaTitle)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-cms-text">Convert Idea to Edition</h3>

        <div className="mt-3 rounded bg-cms-surface-subtle p-3 text-sm">
          <p className="font-medium">{ideaTitle}</p>
          <p className="text-cms-text-dim text-xs mt-1">Created {new Date(ideaCreatedAt).toLocaleDateString()}</p>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Newsletter Type *</label>
            <select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-cms-text-dim">
          Idea becomes a draft edition. Content and notes are preserved. Opens in editor immediately.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded border px-4 py-2 text-sm hover:bg-cms-surface-hover">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(typeId, subject)}
            disabled={!typeId}
            className="rounded bg-cms-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            Convert to Edition
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_components/convert-idea-modal.tsx
git commit -m "feat(newsletter): add ConvertIdeaModal for idea-to-edition flow"
```

---

### Task 24: Email Preview Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/email-preview.tsx`

- [ ] **Step 1: Implement email preview**

```typescript
// apps/web/src/app/cms/(authed)/newsletters/_components/email-preview.tsx
'use client'

import { useState, useEffect } from 'react'
import { renderEmailPreview } from '../actions'

interface EmailPreviewProps {
  editionId: string
  open: boolean
  onClose: () => void
}

export function EmailPreview({ editionId, open, onClose }: EmailPreviewProps) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [width, setWidth] = useState<375 | 600>(600)

  useEffect(() => {
    if (open) {
      setLoading(true)
      setError(null)
      renderEmailPreview(editionId).then((result) => {
        if (result.ok) {
          setHtml((result as { ok: true; html: string }).html)
        } else {
          setError((result as { ok: false; error: string }).error)
        }
        setLoading(false)
      })
    }
  }, [open, editionId])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-3xl h-[80vh] rounded-lg bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold text-cms-text">Email Preview</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWidth(375)}
              className={`px-2 py-1 text-xs rounded ${width === 375 ? 'bg-cms-accent text-white' : 'border'}`}
            >
              Mobile
            </button>
            <button
              type="button"
              onClick={() => setWidth(600)}
              className={`px-2 py-1 text-xs rounded ${width === 600 ? 'bg-cms-accent text-white' : 'border'}`}
            >
              Desktop
            </button>
            <button type="button" onClick={onClose} className="ml-4 text-cms-text-muted hover:text-cms-text">
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-100 p-4 flex justify-center">
          {loading && <p className="text-sm text-cms-text-muted">Loading preview...</p>}
          {error && <p className="text-sm text-red-600">Error: {error}</p>}
          {html && (
            <iframe
              srcDoc={html}
              style={{ width, height: '100%', border: 'none', backgroundColor: '#fff' }}
              sandbox="allow-same-origin"
              title="Email Preview"
            />
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_components/email-preview.tsx
git commit -m "feat(newsletter): add EmailPreview with mobile/desktop toggle"
```

---

### Task 25: Autosave Indicator + Navigation Guard

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/autosave-indicator.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/navigation-guard.tsx`

- [ ] **Step 1: Implement autosave indicator**

```typescript
// apps/web/src/app/cms/(authed)/newsletters/_components/autosave-indicator.tsx
'use client'

interface AutosaveIndicatorProps {
  state: 'saving' | 'saved' | 'unsaved' | 'error' | 'offline'
  lastSavedAt?: Date | null
  onRetry?: () => void
}

export function AutosaveIndicator({ state, lastSavedAt, onRetry }: AutosaveIndicatorProps) {
  const indicators = {
    saving: { dot: 'bg-blue-400 animate-pulse', text: 'Saving...' },
    saved: { dot: 'bg-green-500', text: lastSavedAt ? `Saved ${formatRelative(lastSavedAt)}` : 'Saved' },
    unsaved: { dot: 'bg-yellow-500', text: 'Unsaved changes' },
    error: { dot: 'bg-red-500', text: 'Save failed' },
    offline: { dot: 'bg-gray-400', text: 'Offline — saved locally' },
  }

  const { dot, text } = indicators[state]

  return (
    <div className="flex items-center gap-1.5 text-xs text-cms-text-dim">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span>{text}</span>
      {state === 'error' && onRetry && (
        <button type="button" onClick={onRetry} className="text-cms-accent underline ml-1">
          Retry
        </button>
      )}
    </div>
  )
}

function formatRelative(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return date.toLocaleTimeString()
}
```

- [ ] **Step 2: Implement navigation guard**

```typescript
// apps/web/src/app/cms/(authed)/newsletters/_components/navigation-guard.tsx
'use client'

import { useEffect } from 'react'

interface NavigationGuardProps {
  hasUnsavedChanges: boolean
}

export function NavigationGuard({ hasUnsavedChanges }: NavigationGuardProps) {
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  return null
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_components/autosave-indicator.tsx apps/web/src/app/cms/(authed)/newsletters/_components/navigation-guard.tsx
git commit -m "feat(newsletter): add AutosaveIndicator + NavigationGuard components"
```

---

### Task 26: Read-Only Overlay

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/read-only-overlay.tsx`

- [ ] **Step 1: Implement read-only overlay**

```typescript
// apps/web/src/app/cms/(authed)/newsletters/_components/read-only-overlay.tsx
'use client'

interface ReadOnlyOverlayProps {
  status: string
  visible: boolean
}

export function ReadOnlyOverlay({ status, visible }: ReadOnlyOverlayProps) {
  if (!visible) return null

  const messages: Record<string, string> = {
    sent: 'This edition has been sent and cannot be edited.',
    sending: 'This edition is currently being sent.',
    cancelled: 'This edition was cancelled. Revert to draft to edit.',
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded">
      <div className="text-center p-6">
        <p className="text-sm font-medium text-cms-text-muted">
          {messages[status] ?? 'This edition is read-only.'}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_components/read-only-overlay.tsx
git commit -m "feat(newsletter): add ReadOnlyOverlay for locked editions"
```

---

### Task 27: Rewrite Edition Editor Page

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/[id]/edit/page.tsx`

- [ ] **Step 1: Create client editor wrapper**

Create a new client component that assembles all editor pieces. The server page fetches data and passes it as props.

```typescript
// apps/web/src/app/cms/(authed)/newsletters/[id]/edit/edition-editor.tsx
'use client'

import { useState, useCallback, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TipTapEditor } from '../../_components/tiptap-editor'
import { AutosaveIndicator } from '../../_components/autosave-indicator'
import { NavigationGuard } from '../../_components/navigation-guard'
import { ReadOnlyOverlay } from '../../_components/read-only-overlay'
import { EmailPreview } from '../../_components/email-preview'
import { ScheduleModal } from '../../_components/schedule-modal'
import { SendNowModal } from '../../_components/send-now-modal'
import { DeleteConfirmModal } from '../../_components/delete-confirm-modal'
import {
  saveEdition,
  sendTestEmail,
  scheduleEdition,
  sendNow,
  deleteEdition,
  duplicateEdition,
  uploadNewsletterImage,
} from '../../actions'
import type { JSONContent } from '@tiptap/core'

interface EditionEditorProps {
  edition: {
    id: string
    subject: string
    preheader: string | null
    content_json: JSONContent | null
    content_html: string | null
    status: string
    notes: string | null
    newsletter_type_id: string | null
    newsletter_types: { name: string; color: string; sender_name: string | null; sender_email: string | null } | null
  }
  subscriberCount: number
  types: Array<{ id: string; name: string; color: string }>
}

export function EditionEditor({ edition, subscriberCount, types }: EditionEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [subject, setSubject] = useState(edition.subject)
  const [preheader, setPreheader] = useState(edition.preheader ?? '')
  const [notes, setNotes] = useState(edition.notes ?? '')
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'unsaved' | 'error' | 'offline'>('saved')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const [showPreview, setShowPreview] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [showSendNow, setShowSendNow] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const contentRef = useRef<{ json: JSONContent | null; html: string | null }>({
    json: edition.content_json,
    html: edition.content_html,
  })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isReadOnly = ['sent', 'sending', 'cancelled'].includes(edition.status)
  const isEditable = !isReadOnly

  const doSave = useCallback(async () => {
    if (isReadOnly) return
    setSaveState('saving')
    const result = await saveEdition(edition.id, {
      subject,
      preheader: preheader || undefined,
      content_json: contentRef.current.json ?? undefined,
      content_html: contentRef.current.html ?? undefined,
      notes: notes || undefined,
    })
    if (result.ok) {
      setSaveState('saved')
      setLastSavedAt(new Date())
      setHasUnsavedChanges(false)
    } else {
      setSaveState('error')
      toast.error(`Failed to save: ${result.error}`)
    }
  }, [edition.id, subject, preheader, notes, isReadOnly])

  const scheduleSave = useCallback(() => {
    if (isReadOnly) return
    setHasUnsavedChanges(true)
    setSaveState('unsaved')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(doSave, 3000)
  }, [doSave, isReadOnly])

  // Cmd+S handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (debounceRef.current) clearTimeout(debounceRef.current)
        doSave()
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault()
        setShowPreview((v) => !v)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [doSave])

  const handleContentUpdate = useCallback(
    (json: JSONContent, html: string) => {
      contentRef.current = { json, html }
      scheduleSave()
    },
    [scheduleSave],
  )

  const handleImageUpload = useCallback(
    async (file: File): Promise<string | null> => {
      const result = await uploadNewsletterImage(file, edition.id)
      if (result.ok) {
        toast.success('Image uploaded')
        return (result as { ok: true; url: string }).url
      }
      toast.error(`Upload failed: ${(result as { ok: false; error: string }).error}`)
      return null
    },
    [edition.id],
  )

  async function handleSchedule(scheduledAt: string) {
    startTransition(async () => {
      const result = await scheduleEdition(edition.id, scheduledAt)
      if (result.ok) {
        toast.success(`Scheduled for ${new Date(scheduledAt).toLocaleString()}`)
        setShowSchedule(false)
        router.refresh()
      } else {
        toast.error(`Failed to schedule: ${result.error}`)
      }
    })
  }

  async function handleSendNow() {
    startTransition(async () => {
      const result = await sendNow(edition.id)
      if (result.ok) {
        toast.success(`Sending to ${subscriberCount} subscribers...`)
        setShowSendNow(false)
        router.refresh()
      } else {
        toast.error(`Send failed: ${result.error}`)
      }
    })
  }

  async function handleDelete() {
    startTransition(async () => {
      const result = await deleteEdition(edition.id, { confirmed: true, confirmText: 'DELETE' })
      if (result.ok) {
        toast.success('Edition deleted')
        router.push('/cms/newsletters')
      } else {
        toast.error(`Delete failed: ${(result as any).error}`)
      }
    })
  }

  async function handleTestEmail() {
    startTransition(async () => {
      const result = await sendTestEmail(edition.id)
      if (result.ok) {
        toast.success('Test email sent')
      } else {
        toast.error(`Test failed: ${result.error}`)
      }
    })
  }

  async function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateEdition(edition.id)
      if (result.ok) {
        toast.success('Edition duplicated')
        router.push(`/cms/newsletters/${(result as { ok: true; editionId: string }).editionId}/edit`)
      } else {
        toast.error(`Duplicate failed: ${result.error}`)
      }
    })
  }

  return (
    <div className="space-y-4">
      <NavigationGuard hasUnsavedChanges={hasUnsavedChanges} />

      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-cms-surface-subtle">
            {edition.status}
          </span>
          {edition.newsletter_types && (
            <span className="text-sm text-cms-text-muted">{edition.newsletter_types.name}</span>
          )}
          <AutosaveIndicator state={saveState} lastSavedAt={lastSavedAt} onRetry={doSave} />
        </div>
        <div className="flex items-center gap-2">
          {isEditable && (
            <button type="button" onClick={handleTestEmail} disabled={isPending} className="rounded border px-3 py-1.5 text-xs hover:bg-cms-surface-hover disabled:opacity-50">
              Send Test
            </button>
          )}
          <button type="button" onClick={handleDuplicate} disabled={isPending} className="rounded border px-3 py-1.5 text-xs hover:bg-cms-surface-hover disabled:opacity-50">
            Duplicate
          </button>
          <button type="button" onClick={() => setShowDelete(true)} className="rounded border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
            Delete
          </button>
        </div>
      </div>

      {/* Metadata row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="subject" className="block text-xs font-medium mb-1">Subject</label>
          <input
            id="subject"
            value={subject}
            onChange={(e) => { setSubject(e.target.value); scheduleSave() }}
            disabled={isReadOnly}
            className="w-full rounded border px-3 py-2 text-sm disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="preheader" className="block text-xs font-medium mb-1">Preheader</label>
          <input
            id="preheader"
            value={preheader}
            onChange={(e) => { setPreheader(e.target.value); scheduleSave() }}
            disabled={isReadOnly}
            placeholder="Preview text shown in inbox..."
            className="w-full rounded border px-3 py-2 text-sm disabled:opacity-50"
          />
        </div>
      </div>

      {/* Editor area */}
      <div className="relative">
        <TipTapEditor
          initialContent={edition.content_json}
          editable={isEditable}
          onUpdate={handleContentUpdate}
          onImageUpload={handleImageUpload}
        />
        <ReadOnlyOverlay status={edition.status} visible={isReadOnly} />
      </div>

      {/* Notes */}
      {isEditable && (
        <details className="text-sm">
          <summary className="cursor-pointer text-cms-text-dim">Internal Notes</summary>
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); scheduleSave() }}
            rows={3}
            className="mt-2 w-full rounded border px-3 py-2 text-sm"
            placeholder="Notes (not included in email)..."
          />
        </details>
      )}

      {/* Action bar */}
      <div className="sticky bottom-0 bg-white border-t border-cms-border py-3 px-4 flex items-center justify-between">
        <span className="text-xs text-cms-text-dim">
          {subscriberCount} subscribers
        </span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowPreview(true)} className="rounded border px-3 py-1.5 text-sm hover:bg-cms-surface-hover">
            Preview as Email
          </button>
          {isEditable && (
            <>
              <button type="button" onClick={() => setShowSendNow(true)} className="rounded bg-orange-600 px-3 py-1.5 text-sm text-white hover:bg-orange-700">
                Send Now
              </button>
              <button type="button" onClick={() => setShowSchedule(true)} className="rounded bg-cms-accent px-3 py-1.5 text-sm text-white hover:opacity-90">
                Schedule...
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <EmailPreview editionId={edition.id} open={showPreview} onClose={() => setShowPreview(false)} />
      <ScheduleModal
        open={showSchedule}
        audienceCount={subscriberCount}
        onConfirm={handleSchedule}
        onCancel={() => setShowSchedule(false)}
      />
      <SendNowModal
        open={showSendNow}
        subject={subject}
        recipientCount={subscriberCount}
        senderName={edition.newsletter_types?.sender_name ?? 'Thiago Figueiredo'}
        senderEmail={edition.newsletter_types?.sender_email ?? 'newsletter@bythiagofigueiredo.com'}
        onConfirm={handleSendNow}
        onCancel={() => setShowSendNow(false)}
      />
      <DeleteConfirmModal
        open={showDelete}
        title="Delete Edition"
        description={`Delete "${subject}"? This cannot be undone.`}
        impactLevel={edition.status === 'sent' ? 'high' : edition.content_html ? 'medium' : 'low'}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Rewrite the server page to use client editor**

Replace entire content of `apps/web/src/app/cms/(authed)/newsletters/[id]/edit/page.tsx`:

```typescript
import { notFound } from 'next/navigation'
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

  return (
    <div className="p-6 lg:p-8">
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
        }}
        subscriberCount={subscriberCount ?? 0}
        types={(types ?? []).map((t) => ({ id: t.id as string, name: t.name as string, color: (t.color ?? '#7c3aed') as string }))}
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/[id]/edit/edition-editor.tsx" "apps/web/src/app/cms/(authed)/newsletters/[id]/edit/page.tsx"
git commit -m "feat(newsletter): rewrite edition editor with TipTap WYSIWYG + all modals"
```

---

### Task 28: Wire Type Cards — Context Menu + Functional "Add Type"

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_components/type-cards.tsx`

- [ ] **Step 1: Rewrite type-cards with context menu**

Replace entire content of `apps/web/src/app/cms/(authed)/newsletters/_components/type-cards.tsx`:

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { TypeModal } from './type-modal'
import { DeleteConfirmModal } from './delete-confirm-modal'
import { createNewsletterType, updateNewsletterType, deleteNewsletterType } from '../actions'

interface TypeCardData {
  id: string
  name: string
  color: string
  subscribers: number
  avgOpenRate: number
  lastSent: string | null
  cadence: string
  editionCount: number
  isPaused: boolean
}

interface TypeCardsProps {
  types: TypeCardData[]
  selectedTypeId: string | null
  currentStatus?: string
}

export function TypeCards({ types, selectedTypeId, currentStatus }: TypeCardsProps) {
  const router = useRouter()
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [editingType, setEditingType] = useState<TypeCardData | null>(null)
  const [deletingType, setDeletingType] = useState<TypeCardData | null>(null)
  const [deleteImpact, setDeleteImpact] = useState<{ subscribers: number; editions: number } | null>(null)
  const [contextMenuId, setContextMenuId] = useState<string | null>(null)

  function onSelect(id: string | null) {
    const params = new URLSearchParams()
    if (id) params.set('type', id)
    if (currentStatus && currentStatus !== 'all') params.set('status', currentStatus)
    const qs = params.toString()
    router.push(`/cms/newsletters${qs ? `?${qs}` : ''}`)
  }

  async function handleCreateType(data: { name: string; locale: string; color: string; tagline: string; sortOrder: number }) {
    const result = await createNewsletterType(data)
    if (result.ok) {
      toast.success('Newsletter type created')
      setShowTypeModal(false)
      router.refresh()
    } else {
      toast.error(`Failed: ${result.error}`)
    }
  }

  async function handleEditType(data: { name: string; locale: string; color: string; tagline: string; sortOrder: number }) {
    if (!editingType) return
    const result = await updateNewsletterType(editingType.id, { name: data.name, color: data.color, tagline: data.tagline, sortOrder: data.sortOrder })
    if (result.ok) {
      toast.success('Type updated')
      setEditingType(null)
      router.refresh()
    } else {
      toast.error(`Failed: ${result.error}`)
    }
  }

  async function handleDeleteType() {
    if (!deletingType) return
    const result = await deleteNewsletterType(deletingType.id, { confirmed: true, confirmText: deletingType.name })
    if (result.ok) {
      toast.success('Type deleted')
      setDeletingType(null)
      setDeleteImpact(null)
      router.refresh()
    } else {
      toast.error(`Failed: ${(result as any).error}`)
    }
  }

  async function initiateDelete(type: TypeCardData) {
    const result = await deleteNewsletterType(type.id)
    if (!result.ok && 'subscriberCount' in result) {
      setDeleteImpact({ subscribers: (result as any).subscriberCount, editions: (result as any).editionCount })
      setDeletingType(type)
    }
    setContextMenuId(null)
  }

  async function handleDeactivate(typeId: string) {
    const result = await updateNewsletterType(typeId, { active: false })
    if (result.ok) {
      toast.success('Type deactivated')
      router.refresh()
    }
    setContextMenuId(null)
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {types.map((t) => (
          <div key={t.id} className="relative shrink-0">
            <button
              type="button"
              onClick={() => onSelect(selectedTypeId === t.id ? null : t.id)}
              onContextMenu={(e) => { e.preventDefault(); setContextMenuId(contextMenuId === t.id ? null : t.id) }}
              className={`w-56 bg-cms-surface border rounded-[var(--cms-radius)] p-4 text-left transition-all
                ${selectedTypeId === t.id ? 'border-cms-accent ring-1 ring-cms-accent' : 'border-cms-border hover:border-cms-accent/50'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-cms-text">{t.name}</span>
                {t.isPaused && <span className="text-[9px] px-1.5 py-0.5 rounded bg-cms-amber-subtle text-cms-amber uppercase">Paused</span>}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                <div><div className="font-semibold text-cms-text">{t.subscribers}</div><div className="text-cms-text-dim">Subs</div></div>
                <div><div className="font-semibold text-cms-green">{t.avgOpenRate}%</div><div className="text-cms-text-dim">Opens</div></div>
                <div><div className="font-semibold text-cms-text">{t.editionCount}</div><div className="text-cms-text-dim">Editions</div></div>
              </div>
              <div className="mt-3 pt-2 border-t border-cms-border-subtle text-[10px] text-cms-text-dim">
                {t.cadence} · {t.lastSent ? `Last: ${t.lastSent}` : 'Never sent'}
              </div>
            </button>

            {contextMenuId === t.id && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-cms-border rounded shadow-lg z-50 min-w-[160px]">
                <button type="button" onClick={() => { setEditingType(t); setContextMenuId(null) }} className="block w-full text-left px-3 py-2 text-sm hover:bg-cms-surface-hover">Edit Type</button>
                <button type="button" onClick={() => { router.push(`/cms/newsletters/settings`); setContextMenuId(null) }} className="block w-full text-left px-3 py-2 text-sm hover:bg-cms-surface-hover">Type Settings</button>
                <button type="button" onClick={() => handleDeactivate(t.id)} className="block w-full text-left px-3 py-2 text-sm hover:bg-cms-surface-hover">Deactivate</button>
                <hr className="my-1 border-cms-border-subtle" />
                <button type="button" onClick={() => initiateDelete(t)} className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">Delete Type...</button>
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={() => setShowTypeModal(true)}
          className="shrink-0 w-40 border border-dashed border-cms-border rounded-[var(--cms-radius)] flex items-center justify-center text-sm text-cms-text-dim hover:border-cms-accent hover:text-cms-accent transition-colors"
        >
          + Add type
        </button>
      </div>

      <TypeModal open={showTypeModal} mode="create" onSubmit={handleCreateType} onCancel={() => setShowTypeModal(false)} />
      {editingType && (
        <TypeModal
          open={!!editingType}
          mode="edit"
          initialData={{ name: editingType.name, locale: 'pt-BR', color: editingType.color, tagline: '', sortOrder: 0 }}
          onSubmit={handleEditType}
          onCancel={() => setEditingType(null)}
        />
      )}
      {deletingType && (
        <DeleteConfirmModal
          open={!!deletingType}
          title={`Delete "${deletingType.name}"?`}
          description="This will orphan all editions (they become ideas) and unlink subscribers."
          impactLevel={deleteImpact && deleteImpact.subscribers > 0 ? 'high' : 'medium'}
          confirmText={deletingType.name}
          stats={deleteImpact ? { subscribers: deleteImpact.subscribers, editions: deleteImpact.editions } : undefined}
          onConfirm={handleDeleteType}
          onCancel={() => { setDeletingType(null); setDeleteImpact(null) }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/_components/type-cards.tsx"
git commit -m "feat(newsletter): wire type cards with context menu + functional Add Type"
```

---

### Task 29: Wire Dashboard Context Menus + Ideas Tab

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/newsletters-connected.tsx`

- [ ] **Step 1: Add 'idea' to STATUS_OPTIONS and EditionRow status type**

In `newsletters-connected.tsx`, update the `STATUS_OPTIONS` constant and `EditionRow` interface to include `'idea'` and `'cancelled'`:

```typescript
// Change STATUS_OPTIONS to include idea and cancelled
const STATUS_OPTIONS = ['all', 'idea', 'draft', 'ready', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'] as const

// Update EditionRow status type
status: 'idea' | 'draft' | 'ready' | 'queued' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled'
```

- [ ] **Step 2: Import toast and action functions**

Add at the top of `newsletters-connected.tsx`:

```typescript
import { toast } from 'sonner'
import {
  createIdea,
  deleteEdition,
  duplicateEdition,
  revertToDraft,
  sendNow,
  cancelEdition,
  sendTestEmail,
  scheduleEdition,
} from './actions'
import { ScheduleModal } from './_components/schedule-modal'
import { SendNowModal } from './_components/send-now-modal'
import { DeleteConfirmModal } from './_components/delete-confirm-modal'
import { ConvertIdeaModal } from './_components/convert-idea-modal'
```

- [ ] **Step 3: Wire context menu items to real actions**

Replace the dead-code context menu handlers with functional implementations that call the imported server actions and show toast feedback. Each menu item should:
- Call the appropriate action
- Show success/error toast
- Call `router.refresh()` on success

The "Quick Idea" button should show an inline form (title + optional type + notes) that calls `createIdea()`.

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/newsletters-connected.tsx"
git commit -m "feat(newsletter): wire all dashboard context menus + add Ideas tab"
```

---

### Task 30: Update Dashboard Page — Pass Ideas Data + Toast Provider

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/page.tsx`

- [ ] **Step 1: Add toast provider and ideas support**

In `page.tsx`, wrap the page content with the toast provider and update the edition query to include `'idea'` status:

Add import:
```typescript
import { NewsletterToastProvider } from './_components/toast-provider'
```

Wrap the JSX return in the toast provider and ensure the `fetchEditionsWithMeta` function includes ideas by not excluding `'idea'` status from queries.

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/page.tsx"
git commit -m "feat(newsletter): add toast provider + ideas data to dashboard"
```

---

### Task 31: Fix `new/page.tsx` — Type Validation

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/new/page.tsx`

- [ ] **Step 1: Add type validation**

In `new/page.tsx`, after finding `typeId`, validate that the type exists and is active before creating the edition:

```typescript
// After finding typeId
if (!typeId) {
  redirect('/cms/newsletters?error=no_type')
}

// Validate type exists and is active
const { data: typeCheck } = await supabase
  .from('newsletter_types')
  .select('id, active')
  .eq('id', typeId)
  .eq('site_id', ctx.siteId)
  .single()

if (!typeCheck) {
  redirect('/cms/newsletters?error=type_not_found')
}
if (!typeCheck.active) {
  redirect('/cms/newsletters?error=type_inactive')
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/new/page.tsx"
git commit -m "fix(newsletter): add type existence + active validation to new edition"
```

---

### Task 32: Settings Page Enhancement — 3 Tabs

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/settings/page.tsx`

- [ ] **Step 1: Rewrite settings page with tabs**

Replace `settings/page.tsx` with a tabbed layout (Per-Type Settings, Sender Defaults, Bounce Policy):

```typescript
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { updateCadence } from '../actions'
import { NewsletterSettings } from '@tn-figueiredo/newsletter-admin/client'
import type { NewsletterTypeSettings } from '@tn-figueiredo/newsletter-admin'

export const dynamic = 'force-dynamic'

export default async function NewsletterSettingsPage() {
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data: types } = await supabase
    .from('newsletter_types')
    .select('id, name, locale, color, cadence_days, preferred_send_time, cadence_paused, sender_name, sender_email, reply_to')
    .eq('site_id', ctx.siteId)
    .eq('active', true)
    .order('sort_order')

  const settingsTypes: NewsletterTypeSettings[] = (types ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    locale: t.locale as string,
    color: (t.color as string) ?? '#ea580c',
    cadence_days: (t.cadence_days as number) ?? 7,
    preferred_send_time: (t.preferred_send_time as string) ?? '09:00',
    cadence_paused: (t.cadence_paused as boolean) ?? false,
    sender_name: t.sender_name as string | null,
    sender_email: t.sender_email as string | null,
    reply_to: t.reply_to as string | null,
  }))

  async function handleSave(typeId: string, data: { cadence_days: number; preferred_send_time: string; cadence_paused: boolean }) {
    'use server'
    await updateCadence(typeId, data)
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl font-bold">Newsletter Settings</h1>
      <NewsletterSettings types={settingsTypes} onSave={handleSave} />

      <section className="mt-8 border-t pt-6">
        <h2 className="text-lg font-semibold mb-4">Bounce Policy</h2>
        <div className="bg-cms-surface-subtle rounded p-4 text-sm text-cms-text-muted space-y-2">
          <p><strong>Auto-pause threshold:</strong> 5% bounce rate</p>
          <p>When a newsletter type exceeds this threshold, sending is automatically paused. You can resume from the Per-Type Settings above.</p>
          <p>Bounced subscribers are marked as inactive and excluded from future sends.</p>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/settings/page.tsx"
git commit -m "feat(newsletter): enhance settings page with bounce policy section"
```

---

### Task 33: Push Migrations to Production

**Files:**
- Uses existing migrations from Tasks 2-4.

- [ ] **Step 1: Validate migrations locally**

Run: `npm run db:start && npm run db:reset`
Expected: All migrations apply cleanly with no errors.

- [ ] **Step 2: Push to production**

Run: `npm run db:push:prod`
Expected: 3 new migrations applied, prompted with YES.

- [ ] **Step 3: Commit confirmation (no code change — operational step)**

---

### Task 34: Run Full Test Suite

- [ ] **Step 1: Run all tests**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass (existing + new newsletter tests).

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Fix any failures, commit**

If tests or typecheck fail, fix issues and commit:
```bash
git add -A && git commit -m "fix(newsletter): resolve test/type issues from CMS overhaul"
```

---

### Task 35: Integration Smoke Test

- [ ] **Step 1: Start dev server**

Run: `cd apps/web && npm run dev`

- [ ] **Step 2: Verify critical paths in browser**

1. Navigate to `/cms/newsletters` — type cards render, "+ Add type" button opens TypeModal
2. Click "+ New Edition" — creates draft, redirects to editor
3. Editor loads with TipTap toolbar, type text, verify formatting buttons work
4. Type in subject/preheader, wait 3s — autosave indicator shows "Saved"
5. Press Cmd+S — immediate save
6. Click "Schedule..." — ScheduleModal opens with date picker
7. Click "Preview as Email" — EmailPreview renders sanitized HTML in iframe
8. Navigate to Ideas tab — quick idea form visible
9. Create idea via Quick Idea — appears in list

- [ ] **Step 3: Commit any hotfixes**

```bash
git add -A && git commit -m "fix(newsletter): hotfixes from integration testing"
```
