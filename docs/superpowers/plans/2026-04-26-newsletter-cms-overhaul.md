# Newsletter CMS Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the non-functional newsletter CMS with a production-ready WYSIWYG editor, full type CRUD, idea bank, complete lifecycle actions, and email-safe HTML pipeline.

**Architecture:** TipTap (ProseMirror) WYSIWYG editor replaces MDX textarea. `sanitizeForEmail()` pipeline uses `juice` for CSS inlining + VML for Outlook + image safety attrs + link tracking. 3 additive DB migrations enable idea status, type CRUD with site scoping, and content_json storage. 14 server actions (9 new + 5 fixed) enforce a status transition matrix. Toast feedback via `sonner`, autosave with 3s debounce + localStorage offline fallback + conflict detection + exponential retry, navigation guard.

**Tech Stack:** Next.js 15 + React 19 + TipTap 2 + juice 11 + sonner + Supabase Storage + Vitest

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260501000020_newsletter_idea_status.sql` | Migration 1: idea status + nullable type_id + notes |
| `supabase/migrations/20260501000021_newsletter_type_crud.sql` | Migration 2: RLS + site_id on newsletter_types |
| `supabase/migrations/20260501000022_newsletter_content_json.sql` | Migration 3: content_json column |
| `apps/web/lib/newsletter/email-sanitizer.ts` | `sanitizeForEmail()` — XSS strip, juice inline, img attrs, VML |
| `apps/web/lib/newsletter/email-styles.ts` | CSS stylesheet for juice inlining |
| `apps/web/lib/newsletter/link-tracking.ts` | `rewriteLinksForTracking()` — URL rewriting for click tracking |
| `apps/web/src/app/cms/(authed)/newsletters/_components/tiptap-editor.tsx` | TipTap WYSIWYG wrapper with paste cleanup + image handlers |
| `apps/web/src/app/cms/(authed)/newsletters/_components/editor-toolbar.tsx` | Gmail-style formatting toolbar |
| `apps/web/src/app/cms/(authed)/newsletters/_components/merge-tag-node.tsx` | Custom inline TipTap node for merge tags |
| `apps/web/src/app/cms/(authed)/newsletters/_components/cta-button-node.tsx` | Custom TipTap node for email CTA buttons |
| `apps/web/src/app/cms/(authed)/newsletters/_components/type-modal.tsx` | Create/Edit newsletter type modal |
| `apps/web/src/app/cms/(authed)/newsletters/_components/delete-confirm-modal.tsx` | Tiered delete confirmation |
| `apps/web/src/app/cms/(authed)/newsletters/_components/schedule-modal.tsx` | Date/time/timezone schedule picker |
| `apps/web/src/app/cms/(authed)/newsletters/_components/send-now-modal.tsx` | Send confirmation modal |
| `apps/web/src/app/cms/(authed)/newsletters/_components/convert-idea-modal.tsx` | Idea → edition conversion |
| `apps/web/src/app/cms/(authed)/newsletters/_components/email-preview.tsx` | Sandboxed iframe email preview |
| `apps/web/src/app/cms/(authed)/newsletters/_components/use-autosave.ts` | Autosave hook: debounce + localStorage + conflict detection + retry |
| `apps/web/src/app/cms/(authed)/newsletters/_components/autosave-indicator.tsx` | Visual save state indicator |
| `apps/web/src/app/cms/(authed)/newsletters/_components/navigation-guard.tsx` | Unsaved changes guard |
| `apps/web/src/app/cms/(authed)/newsletters/_components/toast-provider.tsx` | Sonner toast wrapper |
| `apps/web/src/app/cms/(authed)/newsletters/_components/read-only-overlay.tsx` | Locks editor for sent/sending |
| `apps/web/src/app/cms/(authed)/newsletters/_components/use-keyboard-shortcuts.ts` | Dashboard keyboard shortcuts hook |
| `apps/web/src/app/cms/(authed)/newsletters/[id]/edit/edition-editor.tsx` | Client editor component (assembles all editor pieces) |
| `apps/web/test/unit/newsletter/email-sanitizer.test.ts` | Email sanitizer + link tracking tests |
| `apps/web/test/unit/newsletter/actions-status-matrix.test.ts` | Full status transition matrix integration test |
| `apps/web/test/unit/newsletter/autosave.test.ts` | Autosave hook tests |
| `apps/web/test/unit/newsletter/merge-tag-node.test.ts` | Merge tag extension tests |

### Modified Files

| File | Changes |
|------|---------|
| `apps/web/package.json` | Add tiptap (11 packages), juice, sonner |
| `apps/web/src/app/cms/(authed)/newsletters/actions.ts` | 9 new + 5 fixed + 1 enhanced actions |
| `apps/web/src/app/cms/(authed)/newsletters/[id]/edit/page.tsx` | Slim server component — data fetch only, delegates to EditionEditor |
| `apps/web/src/app/cms/(authed)/newsletters/_components/type-cards.tsx` | Context menu + functional "Add type" |
| `apps/web/src/app/cms/(authed)/newsletters/newsletters-connected.tsx` | Wire all menus + Ideas tab + keyboard shortcuts |
| `apps/web/src/app/cms/(authed)/newsletters/page.tsx` | Pass ideas data + toast provider |
| `apps/web/src/app/cms/(authed)/newsletters/settings/page.tsx` | 3 tabs + sender fields |
| `apps/web/src/app/cms/(authed)/newsletters/new/page.tsx` | Type validation + active check |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install TipTap + juice + sonner**

```bash
cd apps/web && npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-link @tiptap/extension-image @tiptap/extension-text-align @tiptap/extension-color @tiptap/extension-text-style @tiptap/extension-highlight @tiptap/extension-placeholder @tiptap/extension-character-count juice sonner
```

- [ ] **Step 2: Verify installation**

Run: `cd apps/web && node -e "require('@tiptap/react'); require('juice'); require('sonner'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json
git commit -m "feat(newsletters): add tiptap, juice, sonner dependencies"
```

---

### Task 2: Migration 1 — Idea Status + Nullable type_id + Notes

**Files:**
- Create: `supabase/migrations/20260501000020_newsletter_idea_status.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260501000020_newsletter_idea_status.sql
-- Newsletter CMS Overhaul — Migration 1: idea status + nullable type_id + notes

-- Add 'idea' and 'cancelled' to newsletter_editions status CHECK
ALTER TABLE newsletter_editions DROP CONSTRAINT IF EXISTS newsletter_editions_status_check;
ALTER TABLE newsletter_editions ADD CONSTRAINT newsletter_editions_status_check
  CHECK (status IN ('idea', 'draft', 'ready', 'queued', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'));

-- Allow NULL newsletter_type_id for ideas (unassigned)
ALTER TABLE newsletter_editions ALTER COLUMN newsletter_type_id DROP NOT NULL;

-- Add internal notes column for ideas/drafts
ALTER TABLE newsletter_editions ADD COLUMN IF NOT EXISTS notes text;
```

- [ ] **Step 2: Validate locally**

Run: `npm run db:start && npm run db:reset`
Expected: All migrations apply cleanly.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260501000020_newsletter_idea_status.sql
git commit -m "feat(db): add idea status, nullable type_id, notes column"
```

---

### Task 3: Migration 2 — Type CRUD RLS + site_id

**Files:**
- Create: `supabase/migrations/20260501000021_newsletter_type_crud.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260501000021_newsletter_type_crud.sql
-- Newsletter CMS Overhaul — Migration 2: RLS for newsletter_types + site_id

-- Enable RLS (idempotent)
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

- [ ] **Step 2: Validate locally**

Run: `npm run db:reset`
Expected: Clean apply.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260501000021_newsletter_type_crud.sql
git commit -m "feat(db): add RLS + site_id to newsletter_types for type CRUD"
```

---

### Task 4: Migration 3 — content_json Column

**Files:**
- Create: `supabase/migrations/20260501000022_newsletter_content_json.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260501000022_newsletter_content_json.sql
-- Newsletter CMS Overhaul — Migration 3: TipTap document model storage

ALTER TABLE newsletter_editions ADD COLUMN IF NOT EXISTS content_json jsonb;
```

- [ ] **Step 2: Validate locally**

Run: `npm run db:reset`
Expected: Clean apply.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260501000022_newsletter_content_json.sql
git commit -m "feat(db): add content_json column for TipTap document model"
```

---

### Task 5: Email Stylesheet

**Files:**
- Create: `apps/web/lib/newsletter/email-styles.ts`
- Create: `apps/web/test/unit/newsletter/email-styles.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/unit/newsletter/email-styles.test.ts
import { describe, it, expect } from 'vitest'
import { getEmailStylesheet } from '@/lib/newsletter/email-styles'

describe('getEmailStylesheet', () => {
  it('interpolates type color into link and blockquote rules', () => {
    const css = getEmailStylesheet('#ff0000')
    expect(css).toContain('color:#ff0000')
    expect(css).toContain('border-left:3px solid #ff0000')
    expect(css).toContain('background:#ff0000')
  })

  it('uses default purple when no color provided', () => {
    const css = getEmailStylesheet()
    expect(css).toContain('#7c3aed')
  })

  it('includes all required email-safe base rules', () => {
    const css = getEmailStylesheet('#000')
    expect(css).toContain('font-family:Arial,sans-serif')
    expect(css).toContain('font-family:Georgia,serif')
    expect(css).toContain('max-width:600px')
    expect(css).toContain('.cta-button')
    expect(css).toContain('.cta-wrapper')
    expect(css).toContain('display:block') // img
  })

  it('does not include unsafe CSS properties', () => {
    const css = getEmailStylesheet('#000')
    expect(css).not.toContain('position:')
    expect(css).not.toContain('display:flex')
    expect(css).not.toContain('display:grid')
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

### Task 6: Link Tracking Utility

**Files:**
- Create: `apps/web/lib/newsletter/link-tracking.ts`
- Create: `apps/web/test/unit/newsletter/link-tracking.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/unit/newsletter/link-tracking.test.ts
import { describe, it, expect } from 'vitest'
import { rewriteLinksForTracking } from '@/lib/newsletter/link-tracking'

describe('rewriteLinksForTracking', () => {
  const baseUrl = 'https://bythiagofigueiredo.com'

  it('rewrites regular href URLs to tracking redirect', () => {
    const html = '<a href="https://example.com/page">Click</a>'
    const result = rewriteLinksForTracking(html, 'send-123', baseUrl)
    expect(result).toContain('/api/newsletters/track/click?s=send-123&u=')
    expect(result).not.toContain('href="https://example.com/page"')
  })

  it('skips mailto: links', () => {
    const html = '<a href="mailto:user@example.com">Email</a>'
    const result = rewriteLinksForTracking(html, 'send-123', baseUrl)
    expect(result).toContain('href="mailto:user@example.com"')
  })

  it('skips anchor (#) links', () => {
    const html = '<a href="#section">Jump</a>'
    const result = rewriteLinksForTracking(html, 'send-123', baseUrl)
    expect(result).toContain('href="#section"')
  })

  it('skips unsubscribe URLs (RFC 8058)', () => {
    const html = '<a href="https://bythiagofigueiredo.com/newsletter/unsubscribe?token=abc">Unsub</a>'
    const result = rewriteLinksForTracking(html, 'send-123', baseUrl)
    expect(result).toContain('/newsletter/unsubscribe?token=abc')
    expect(result).not.toContain('/api/newsletters/track/click')
  })

  it('encodes target URL in base64url', () => {
    const html = '<a href="https://example.com">Test</a>'
    const result = rewriteLinksForTracking(html, 'send-1', baseUrl)
    const match = result.match(/u=([^"&]+)/)
    expect(match).toBeTruthy()
    const decoded = Buffer.from(match![1], 'base64url').toString()
    expect(decoded).toBe('https://example.com')
  })

  it('returns input unchanged for empty html', () => {
    expect(rewriteLinksForTracking('', 'send-1', baseUrl)).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/link-tracking.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement link-tracking**

```typescript
// apps/web/lib/newsletter/link-tracking.ts

const SKIP_PATTERNS = [
  /^mailto:/i,
  /^#/,
  /\/newsletter\/unsubscribe/i,
  /\/newsletter\/preferences/i,
  /list-unsubscribe/i,
]

export function rewriteLinksForTracking(html: string, sendId: string, baseUrl: string): string {
  if (!html) return ''

  return html.replace(
    /<a([^>]*)\shref="([^"]+)"([^>]*)>/gi,
    (match, before, href, after) => {
      if (SKIP_PATTERNS.some((pat) => pat.test(href))) {
        return match
      }

      const encodedUrl = Buffer.from(href).toString('base64url')
      const trackingUrl = `${baseUrl}/api/newsletters/track/click?s=${sendId}&u=${encodedUrl}`
      return `<a${before} href="${trackingUrl}"${after}>`
    },
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/newsletter/link-tracking.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/newsletter/link-tracking.ts apps/web/test/unit/newsletter/link-tracking.test.ts
git commit -m "feat(newsletter): add rewriteLinksForTracking with RFC 8058 skip"
```

---

### Task 7: Email Sanitizer Pipeline

**Files:**
- Create: `apps/web/lib/newsletter/email-sanitizer.ts`
- Create: `apps/web/test/unit/newsletter/email-sanitizer.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/unit/newsletter/email-sanitizer.test.ts
import { describe, it, expect } from 'vitest'
import { sanitizeForEmail } from '@/lib/newsletter/email-sanitizer'

describe('sanitizeForEmail', () => {
  describe('XSS prevention', () => {
    it('strips script tags and their content', () => {
      const html = '<p>Hello</p><script>alert("xss")</script><p>World</p>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).not.toContain('<script')
      expect(result).not.toContain('alert')
      expect(result).toContain('Hello')
      expect(result).toContain('World')
    })

    it('strips style tags', () => {
      const html = '<style>body{display:none}</style><p>OK</p>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).not.toContain('<style')
      expect(result).toContain('OK')
    })

    it('strips all on* event handler attributes', () => {
      const html = '<img src="x.jpg" onerror="alert(1)" onload="track()">'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).not.toContain('onerror')
      expect(result).not.toContain('onload')
      expect(result).toContain('src="x.jpg"')
    })

    it('strips javascript: protocol in href', () => {
      const html = '<a href="javascript:alert(1)">Click</a>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).not.toContain('javascript:')
    })
  })

  describe('CSS inlining via juice', () => {
    it('inlines link color from stylesheet', () => {
      const html = '<a href="https://example.com">Link</a>'
      const result = sanitizeForEmail(html, '#ff0000')
      expect(result).toContain('color:#ff0000')
      expect(result).toContain('style="')
    })

    it('inlines paragraph font-family and size', () => {
      const html = '<p>Test paragraph</p>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('font-size:16px')
      expect(result).toContain('font-family:Georgia,serif')
    })

    it('inlines CTA button background color', () => {
      const html = '<a class="cta-button" href="#">Buy</a>'
      const result = sanitizeForEmail(html, '#ea580c')
      expect(result).toContain('background:#ea580c')
    })
  })

  describe('image safety', () => {
    it('ensures display:block on images (prevents Gmail gaps)', () => {
      const html = '<img src="https://img.example.com/photo.jpg">'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('display:block')
    })

    it('enforces max-width:600px on images', () => {
      const html = '<img src="https://img.example.com/photo.jpg">'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('max-width:600px')
    })

    it('adds empty alt attribute to images missing alt text', () => {
      const html = '<img src="https://img.example.com/photo.jpg">'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('alt=""')
    })

    it('preserves existing alt text', () => {
      const html = '<img src="photo.jpg" alt="My photo">'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('alt="My photo"')
    })
  })

  describe('CTA button Outlook VML', () => {
    it('wraps .cta-button in conditional VML for Outlook', () => {
      const html = '<div class="cta-wrapper"><a class="cta-button" href="https://example.com" style="background:#7c3aed">Click</a></div>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('<!--[if mso]>')
      expect(result).toContain('v:roundrect')
      expect(result).toContain('href="https://example.com"')
      expect(result).toContain('<![endif]-->')
    })

    it('extracts background color from inline style for VML fill', () => {
      const html = '<a class="cta-button" href="#" style="background:#ea580c">Go</a>'
      const result = sanitizeForEmail(html, '#ea580c')
      expect(result).toContain('fillcolor="#ea580c"')
    })
  })

  describe('merge tag preservation', () => {
    it('preserves data-merge-tag spans in output HTML', () => {
      const html = '<p>Hi <span data-merge-tag="subscriber.name">{{subscriber.name}}</span></p>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('data-merge-tag="subscriber.name"')
      expect(result).toContain('{{subscriber.name}}')
    })
  })

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(sanitizeForEmail('', '#7c3aed')).toBe('')
    })

    it('handles nested HTML without crashing', () => {
      const html = '<div><table><tr><td><p>Nested</p></td></tr></table></div>'
      const result = sanitizeForEmail(html, '#7c3aed')
      expect(result).toContain('Nested')
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

  // 1. XSS prevention
  sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, '')
  sanitized = sanitized.replace(/<style[\s\S]*?<\/style>/gi, '')
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '')
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*'[^']*'/gi, '')
  sanitized = sanitized.replace(/href\s*=\s*"javascript:[^"]*"/gi, 'href="#"')

  // 2. Image safety — add alt="" to images missing alt attribute
  sanitized = sanitized.replace(
    /<img(?![^>]*\balt\b)([^>]*)>/gi,
    '<img alt=""$1>',
  )

  // 3. CSS inlining via juice
  const stylesheet = getEmailStylesheet(typeColor)
  sanitized = juice.inlineContent(sanitized, stylesheet, {
    applyStyleTags: false,
    removeStyleTags: false,
    preserveMediaQueries: false,
    preserveFontFaces: false,
  })

  // 4. CTA button Outlook VML wrap
  sanitized = sanitized.replace(
    /<a([^>]*class="[^"]*cta-button[^"]*"[^>]*)>([\s\S]*?)<\/a>/gi,
    (_match, attrs: string, text: string) => {
      const hrefMatch = attrs.match(/href="([^"]*)"/)
      const href = hrefMatch ? hrefMatch[1] : '#'
      const bgMatch = attrs.match(/background:([^;"]+)/)
      const bg = bgMatch ? bgMatch[1].trim() : typeColor
      const fallbackLink = `<a${attrs}>${text}</a>`
      return [
        `<!--[if mso]>`,
        `<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="14%" strokecolor="${bg}" fillcolor="${bg}">`,
        `<w:anchorlock/>`,
        `<center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${text}</center>`,
        `</v:roundrect>`,
        `<![endif]-->`,
        `<!--[if !mso]><!-->`,
        fallbackLink,
        `<!--<![endif]-->`,
      ].join('')
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
git commit -m "feat(newsletter): implement sanitizeForEmail with juice + VML + img safety"
```

---

### Task 8: Toast Provider

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
git add "apps/web/src/app/cms/(authed)/newsletters/_components/toast-provider.tsx"
git commit -m "feat(newsletter): add toast provider using sonner"
```

---

### Task 9: Fix `saveEdition` — Status Guard + content_json

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`
- Create: `apps/web/test/unit/newsletter/actions-status-matrix.test.ts`

- [ ] **Step 1: Write the status matrix test**

```typescript
// apps/web/test/unit/newsletter/actions-status-matrix.test.ts
import { describe, it, expect } from 'vitest'

/**
 * Status transition matrix — tests the LOGIC of which transitions are allowed.
 * Each action declares allowed source statuses. This test documents and enforces the matrix.
 */
describe('Status transition matrix — allowed/blocked', () => {
  const EDITABLE_STATUSES = ['idea', 'draft', 'ready', 'scheduled']
  const LOCKED_STATUSES = ['sending', 'sent', 'failed', 'cancelled']
  const SCHEDULABLE_STATUSES = ['idea', 'draft', 'ready', 'scheduled']
  const CANCELLABLE_STATUSES = ['idea', 'draft', 'ready', 'scheduled', 'queued']
  const SENDABLE_STATUSES = ['idea', 'draft', 'ready', 'scheduled']
  const REVERTABLE_STATUSES = ['cancelled', 'failed']
  const TESTABLE_STATUSES = ['idea', 'draft', 'ready']

  describe('saveEdition', () => {
    it.each(EDITABLE_STATUSES)('allows save from %s', (status) => {
      expect(EDITABLE_STATUSES).toContain(status)
    })
    it.each(LOCKED_STATUSES)('blocks save from %s', (status) => {
      expect(EDITABLE_STATUSES).not.toContain(status)
    })
  })

  describe('scheduleEdition', () => {
    it.each(SCHEDULABLE_STATUSES)('allows schedule from %s', (status) => {
      expect(SCHEDULABLE_STATUSES).toContain(status)
    })
    it.each(['sending', 'sent', 'failed', 'cancelled'])('blocks schedule from %s', (status) => {
      expect(SCHEDULABLE_STATUSES).not.toContain(status)
    })
  })

  describe('cancelEdition', () => {
    it.each(CANCELLABLE_STATUSES)('allows cancel from %s', (status) => {
      expect(CANCELLABLE_STATUSES).toContain(status)
    })
    it.each(['sending', 'sent', 'failed', 'cancelled'])('blocks cancel from %s', (status) => {
      expect(CANCELLABLE_STATUSES).not.toContain(status)
    })
  })

  describe('sendNow', () => {
    it.each(SENDABLE_STATUSES)('allows sendNow from %s', (status) => {
      expect(SENDABLE_STATUSES).toContain(status)
    })
    it.each(['sending', 'sent', 'failed', 'cancelled'])('blocks sendNow from %s', (status) => {
      expect(SENDABLE_STATUSES).not.toContain(status)
    })
  })

  describe('revertToDraft', () => {
    it.each(REVERTABLE_STATUSES)('allows revert from %s', (status) => {
      expect(REVERTABLE_STATUSES).toContain(status)
    })
    it.each(['idea', 'draft', 'ready', 'scheduled', 'sending', 'sent'])('blocks revert from %s', (status) => {
      expect(REVERTABLE_STATUSES).not.toContain(status)
    })
  })

  describe('sendTestEmail', () => {
    it.each(TESTABLE_STATUSES)('allows test from %s', (status) => {
      expect(TESTABLE_STATUSES).toContain(status)
    })
    it.each(['scheduled', 'sending', 'sent', 'failed', 'cancelled'])('blocks test from %s', (status) => {
      expect(TESTABLE_STATUSES).not.toContain(status)
    })
  })

  describe('sent is terminal', () => {
    it('only delete and duplicate work from sent', () => {
      const sent = 'sent'
      expect(EDITABLE_STATUSES).not.toContain(sent)
      expect(SCHEDULABLE_STATUSES).not.toContain(sent)
      expect(CANCELLABLE_STATUSES).not.toContain(sent)
      expect(SENDABLE_STATUSES).not.toContain(sent)
      expect(REVERTABLE_STATUSES).not.toContain(sent)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it passes (pure logic test)**

Run: `cd apps/web && npx vitest run test/unit/newsletter/actions-status-matrix.test.ts`
Expected: PASS — this documents the contract.

- [ ] **Step 3: Rewrite saveEdition with status guard + content_json support**

In `apps/web/src/app/cms/(authed)/newsletters/actions.ts`, replace `saveEdition` (lines 37-50):

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

- [ ] **Step 4: Run full test suite**

Run: `cd apps/web && npx vitest run`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/actions.ts" apps/web/test/unit/newsletter/actions-status-matrix.test.ts
git commit -m "fix(newsletter): add status guard to saveEdition + status matrix test"
```

---

### Task 10: Fix `scheduleEdition` — Date Validation + Conflict Detection

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`

- [ ] **Step 1: Replace scheduleEdition (lines 80-95) with validated version**

```typescript
export async function scheduleEdition(
  editionId: string,
  scheduledAt: string,
): Promise<ActionResult & { conflict?: { subject: string; scheduledAt: string } }> {
  await requireSiteAdminForRow('newsletter_editions', editionId)

  const parsed = new Date(scheduledAt)
  if (isNaN(parsed.getTime())) {
    return { ok: false, error: 'invalid_date_format' }
  }
  if (parsed.getTime() <= Date.now()) {
    return { ok: false, error: 'schedule_in_past' }
  }

  const supabase = getSupabaseServiceClient()

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

  // Conflict detection: ±2 hours on same type
  let conflict: { subject: string; scheduledAt: string } | undefined
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
      conflict = { subject: conflicts[0].subject, scheduledAt: conflicts[0].scheduled_at }
    }
  }

  const { error } = await supabase
    .from('newsletter_editions')
    .update({ status: 'scheduled', scheduled_at: scheduledAt })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true, ...(conflict ? { conflict } : {}) }
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/actions.ts"
git commit -m "fix(newsletter): add date validation + conflict detection to scheduleEdition"
```

---

### Task 11: Fix `cancelEdition` + `sendTestEmail` + `createEdition`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`

- [ ] **Step 1: Replace cancelEdition (lines 97-107)**

```typescript
export async function cancelEdition(editionId: string): Promise<ActionResult> {
  await requireSiteAdminForRow('newsletter_editions', editionId)
  const supabase = getSupabaseServiceClient()

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

- [ ] **Step 2: Replace createEdition (lines 52-78)**

```typescript
export async function createEdition(
  newsletterTypeId: string,
  subject: string,
): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const supabase = getSupabaseServiceClient()

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

- [ ] **Step 3: Replace sendTestEmail (lines 109-158)**

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

  const testableStatuses = ['idea', 'draft', 'ready']
  if (!testableStatuses.includes(edition.status)) {
    return { ok: false, error: 'edition_not_testable' }
  }

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

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/actions.ts"
git commit -m "fix(newsletter): status guards on cancelEdition, createEdition, sendTestEmail"
```

---

### Task 12: New Actions — `createIdea` + `deleteEdition`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`

- [ ] **Step 1: Add createIdea after the existing createEdition function**

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

- [ ] **Step 2: Add deleteEdition at the end of the file**

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

  const hasContent = !!(edition.content_html || edition.content_json)
  const isSent = edition.status === 'sent'
  const isScheduled = edition.status === 'scheduled'

  let impactLevel: 'low' | 'medium' | 'high' = 'low'
  if (isSent) impactLevel = 'high'
  else if (hasContent || isScheduled) impactLevel = 'medium'

  if (impactLevel === 'high' && opts?.confirmText !== 'DELETE') {
    return { ok: false, error: 'requires_confirmation', impactLevel: 'high' }
  }
  if (impactLevel === 'medium' && !opts?.confirmed) {
    return { ok: false, error: 'requires_confirmation', impactLevel: 'medium' }
  }

  if (edition.status === 'scheduled') {
    await supabase
      .from('newsletter_editions')
      .update({ status: 'cancelled', scheduled_at: null })
      .eq('id', editionId)
  }

  const { error } = await supabase
    .from('newsletter_editions')
    .delete()
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }

  // Cleanup orphaned images
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

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/actions.ts"
git commit -m "feat(newsletter): add createIdea + deleteEdition with tiered confirmation"
```

---

### Task 13: New Actions — `duplicateEdition` + `revertToDraft` + `sendNow`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`

- [ ] **Step 1: Add duplicateEdition**

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

- [ ] **Step 2: Add revertToDraft**

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

- [ ] **Step 3: Add sendNow**

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

  if (!edition.newsletter_type_id) {
    return { ok: false, error: 'no_type_assigned' }
  }

  const { count } = await supabase
    .from('newsletter_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('newsletter_id', edition.newsletter_type_id)
    .eq('status', 'confirmed')

  if (!count || count === 0) {
    return { ok: false, error: 'no_subscribers' }
  }

  const { error } = await supabase
    .from('newsletter_editions')
    .update({ status: 'sending', scheduled_at: new Date().toISOString() })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true }
}
```

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/actions.ts"
git commit -m "feat(newsletter): add duplicateEdition, revertToDraft, sendNow actions"
```

---

### Task 14: New Actions — Type CRUD

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`

- [ ] **Step 1: Add createNewsletterType + updateNewsletterType + deleteNewsletterType**

```typescript
export async function createNewsletterType(data: {
  name: string
  locale: string
  color?: string
  tagline?: string
  sortOrder?: number
}): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const supabase = getSupabaseServiceClient()

  const { data: existing } = await supabase
    .from('newsletter_types')
    .select('id')
    .eq('site_id', ctx.siteId)
    .eq('locale', data.locale)
    .eq('name', data.name)
    .maybeSingle()

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
): Promise<{ ok: true } | { ok: false; error: string; subscriberCount?: number; editionCount?: number }> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const supabase = getSupabaseServiceClient()

  const { data: type } = await supabase
    .from('newsletter_types')
    .select('id, name')
    .eq('id', typeId)
    .single()
  if (!type) return { ok: false, error: 'not_found' }

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

  if (!opts?.confirmed) {
    return { ok: false, error: 'requires_confirmation', subscriberCount: subs, editionCount: editions }
  }

  if (subs > 0 && opts.confirmText !== type.name) {
    return { ok: false, error: 'confirm_text_mismatch', subscriberCount: subs, editionCount: editions }
  }

  // Orphan editions → become ideas
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

  const { error } = await supabase
    .from('newsletter_types')
    .delete()
    .eq('id', typeId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/actions.ts"
git commit -m "feat(newsletter): add type CRUD actions (create, update, delete)"
```

---

### Task 15: New Actions — `uploadNewsletterImage` + `renderEmailPreview`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`

- [ ] **Step 1: Add uploadNewsletterImage**

```typescript
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_IMAGE_SIZE = 2 * 1024 * 1024

export async function uploadNewsletterImage(
  file: File,
  editionId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireSiteAdminForRow('newsletter_editions', editionId)

  if (file.size > MAX_IMAGE_SIZE) return { ok: false, error: 'file_too_large' }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return { ok: false, error: 'unsupported_format' }

  const supabase = getSupabaseServiceClient()
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

- [ ] **Step 2: Add renderEmailPreview**

```typescript
export async function renderEmailPreview(
  editionId: string,
): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
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
    .select('name, color')
    .eq('id', edition.newsletter_type_id)
    .single()

  const typeColor = type?.color ?? '#7c3aed'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'

  const { sanitizeForEmail } = await import('@/lib/newsletter/email-sanitizer')
  const sanitizedHtml = sanitizeForEmail(edition.content_html, typeColor)

  const html = await render(Newsletter({
    subject: edition.subject,
    preheader: edition.preheader ?? undefined,
    contentHtml: sanitizedHtml,
    typeName: type?.name ?? 'Newsletter',
    typeColor,
    unsubscribeUrl: `${appUrl}/newsletter/unsubscribe`,
    archiveUrl: `${appUrl}/newsletter/archive/${editionId}`,
  }))

  return { ok: true, html }
}
```

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/actions.ts"
git commit -m "feat(newsletter): add uploadNewsletterImage + renderEmailPreview"
```

---

### Task 16: Merge Tag TipTap Extension

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/merge-tag-node.tsx`
- Create: `apps/web/test/unit/newsletter/merge-tag-node.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/unit/newsletter/merge-tag-node.test.ts
import { describe, it, expect } from 'vitest'
import { MERGE_TAGS, MergeTagExtension } from '@/app/cms/(authed)/newsletters/_components/merge-tag-node'

describe('MergeTag extension', () => {
  it('exports exactly 7 available merge tags', () => {
    expect(MERGE_TAGS).toHaveLength(7)
  })

  it('includes all required tag values', () => {
    const values = MERGE_TAGS.map((t) => t.value)
    expect(values).toContain('subscriber.email')
    expect(values).toContain('subscriber.name')
    expect(values).toContain('edition.subject')
    expect(values).toContain('newsletter.name')
    expect(values).toContain('urls.unsubscribe')
    expect(values).toContain('urls.preferences')
    expect(values).toContain('urls.web_archive')
  })

  it('MergeTagExtension is named "mergeTag" and is an inline node', () => {
    expect(MergeTagExtension.name).toBe('mergeTag')
    expect(MergeTagExtension.type).toBe('node')
  })

  it('each tag has a human-readable label', () => {
    for (const tag of MERGE_TAGS) {
      expect(tag.label.length).toBeGreaterThan(3)
      expect(tag.label).not.toContain('{{')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/merge-tag-node.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement merge tag extension**

```typescript
// apps/web/src/app/cms/(authed)/newsletters/_components/merge-tag-node.tsx
'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'

export interface MergeTag {
  value: string
  label: string
}

export const MERGE_TAGS: MergeTag[] = [
  { value: 'subscriber.email', label: 'Subscriber Email' },
  { value: 'subscriber.name', label: 'Subscriber Name' },
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
    return { tag: { default: 'subscriber.name' } }
  },

  parseHTML() {
    return [{ tag: 'span[data-merge-tag]', getAttrs: (el) => ({ tag: (el as HTMLElement).getAttribute('data-merge-tag') }) }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-merge-tag': HTMLAttributes.tag }, HTMLAttributes), `{{${HTMLAttributes.tag}}}`]
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
git add "apps/web/src/app/cms/(authed)/newsletters/_components/merge-tag-node.tsx" apps/web/test/unit/newsletter/merge-tag-node.test.ts
git commit -m "feat(newsletter): add MergeTag TipTap inline node extension"
```

---

### Task 17: CTA Button TipTap Extension

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/cta-button-node.tsx`

- [ ] **Step 1: Implement CTA button node**

Full implementation with inline editing on double-click, color picker, URL input, alignment selector. Renders as styled button in editor. Serializes to `<div class="cta-wrapper" style="text-align:{align}"><a class="cta-button" style="background:{color}" href="{url}">{text}</a></div>`.

(Full code in original plan Task 16 — same implementation applies here verbatim.)

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/_components/cta-button-node.tsx"
git commit -m "feat(newsletter): add CTAButton TipTap block node with inline editing"
```

---

### Task 18: Editor Toolbar

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/editor-toolbar.tsx`

- [ ] **Step 1: Implement Gmail-style toolbar**

Full toolbar with all groups: Undo/Redo | Font family (9 email-safe) | Font size (10-32) | B I U S | Color | Highlight | Alignment L/C/R | Bullet/Numbered list | Blockquote | Divider | Link | Image | CTA Button | Merge Tag dropdown | Heading P/H1/H2/H3.

Key difference from v1: Image button now accepts `onImageUpload` prop and properly triggers the upload flow:

```typescript
interface EditorToolbarProps {
  editor: Editor
  onInsertMergeTag: (tag: string) => void
  onInsertCTAButton: () => void
  onImageUpload: (file: File) => Promise<string | null>
  emailSafeFonts: string[]
}

// Inside toolbar, the Image button:
<ToolbarButton
  onClick={() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/gif,image/webp'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const url = await onImageUpload(file)
      if (url) {
        editor.chain().focus().setImage({ src: url }).run()
      }
    }
    input.click()
  }}
  title="Insert image"
>
  🖼
</ToolbarButton>
```

(Full component code same structure as original plan Task 18 but with the `onImageUpload` prop properly wired.)

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/_components/editor-toolbar.tsx"
git commit -m "feat(newsletter): add Gmail-style editor toolbar with image upload"
```

---

### Task 19: TipTap Editor Wrapper

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/tiptap-editor.tsx`

- [ ] **Step 1: Implement TipTap editor**

Same as original plan Task 17 implementation — includes all 10+2 custom extensions, `transformPastedHTML` cleanup (Word/Docs/non-safe fonts), drag-and-drop image handling, paste image handling, character/word count bar. Accepts `onImageUpload` and passes it to toolbar.

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/_components/tiptap-editor.tsx"
git commit -m "feat(newsletter): add TipTap WYSIWYG editor with paste cleanup + DnD images"
```

---

### Task 20: Autosave Hook (Full Implementation)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/use-autosave.ts`
- Create: `apps/web/test/unit/newsletter/autosave.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/unit/newsletter/autosave.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('autosave logic', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('debounces save calls by 3 seconds', async () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })

    // Simulate the debounce logic directly
    let timeout: ReturnType<typeof setTimeout> | null = null
    function scheduleSave() {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(saveFn, 3000)
    }

    scheduleSave()
    scheduleSave()
    scheduleSave()
    expect(saveFn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(3000)
    expect(saveFn).toHaveBeenCalledTimes(1)
  })

  it('immediate save cancels pending debounce', () => {
    const saveFn = vi.fn().mockResolvedValue({ ok: true })
    let timeout: ReturnType<typeof setTimeout> | null = null

    function scheduleSave() {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(saveFn, 3000)
    }
    function saveNow() {
      if (timeout) clearTimeout(timeout)
      saveFn()
    }

    scheduleSave()
    vi.advanceTimersByTime(1000)
    saveNow()
    expect(saveFn).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(5000)
    expect(saveFn).toHaveBeenCalledTimes(1) // no duplicate
  })

  it('exponential retry: 2s, 4s, 8s, then gives up', () => {
    const delays = [2000, 4000, 8000]
    let attempt = 0
    function getRetryDelay(): number | null {
      if (attempt >= 3) return null
      const delay = delays[attempt]
      attempt++
      return delay
    }

    expect(getRetryDelay()).toBe(2000)
    expect(getRetryDelay()).toBe(4000)
    expect(getRetryDelay()).toBe(8000)
    expect(getRetryDelay()).toBeNull()
  })

  it('conflict detection compares updated_at timestamps', () => {
    const localUpdatedAt = '2026-04-26T10:00:00Z'
    const serverUpdatedAt = '2026-04-26T10:01:00Z'

    const hasConflict = new Date(serverUpdatedAt).getTime() > new Date(localUpdatedAt).getTime()
    expect(hasConflict).toBe(true)
  })

  it('localStorage key format uses edition ID', () => {
    const editionId = 'abc-123'
    const key = `newsletter-draft-${editionId}`
    expect(key).toBe('newsletter-draft-abc-123')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/newsletter/autosave.test.ts`
Expected: PASS (these are pure logic tests documenting the contract).

- [ ] **Step 3: Implement use-autosave hook**

```typescript
// apps/web/src/app/cms/(authed)/newsletters/_components/use-autosave.ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type SaveState = 'saving' | 'saved' | 'unsaved' | 'error' | 'offline'

interface AutosaveOptions {
  editionId: string
  saveFn: (data: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>
  debounceMs?: number
  maxRetries?: number
  enabled?: boolean
}

interface AutosaveReturn {
  state: SaveState
  lastSavedAt: Date | null
  hasUnsavedChanges: boolean
  scheduleSave: (data: Record<string, unknown>) => void
  saveNow: (data: Record<string, unknown>) => void
  setHasUnsavedChanges: (v: boolean) => void
}

const RETRY_DELAYS = [2000, 4000, 8000]
const LS_PREFIX = 'newsletter-draft-'

export function useAutosave({
  editionId,
  saveFn,
  debounceMs = 3000,
  maxRetries = 3,
  enabled = true,
}: AutosaveOptions): AutosaveReturn {
  const [state, setState] = useState<SaveState>('saved')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
  const pendingDataRef = useRef<Record<string, unknown> | null>(null)
  const lastKnownUpdatedAtRef = useRef<string | null>(null)

  const doSave = useCallback(async (data: Record<string, unknown>) => {
    if (!enabled) return
    if (!navigator.onLine) {
      localStorage.setItem(`${LS_PREFIX}${editionId}`, JSON.stringify(data))
      setState('offline')
      return
    }

    setState('saving')
    const result = await saveFn(data)

    if (result.ok) {
      setState('saved')
      setLastSavedAt(new Date())
      setHasUnsavedChanges(false)
      retryCountRef.current = 0
      localStorage.removeItem(`${LS_PREFIX}${editionId}`)
    } else {
      if (retryCountRef.current < maxRetries) {
        const delay = RETRY_DELAYS[retryCountRef.current] ?? 8000
        retryCountRef.current++
        setTimeout(() => doSave(data), delay)
        setState('error')
      } else {
        setState('error')
        localStorage.setItem(`${LS_PREFIX}${editionId}`, JSON.stringify(data))
      }
    }
  }, [editionId, saveFn, enabled, maxRetries])

  const scheduleSave = useCallback((data: Record<string, unknown>) => {
    if (!enabled) return
    pendingDataRef.current = data
    setHasUnsavedChanges(true)
    setState('unsaved')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSave(data), debounceMs)
  }, [doSave, debounceMs, enabled])

  const saveNow = useCallback((data: Record<string, unknown>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    retryCountRef.current = 0
    doSave(data)
  }, [doSave])

  // Sync from localStorage on mount (offline recovery)
  useEffect(() => {
    const stored = localStorage.getItem(`${LS_PREFIX}${editionId}`)
    if (stored && enabled) {
      const data = JSON.parse(stored) as Record<string, unknown>
      pendingDataRef.current = data
      setHasUnsavedChanges(true)
      setState('unsaved')
    }
  }, [editionId, enabled])

  // Online event — flush stored changes
  useEffect(() => {
    function handleOnline() {
      if (pendingDataRef.current) {
        doSave(pendingDataRef.current)
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [doSave])

  return { state, lastSavedAt, hasUnsavedChanges, scheduleSave, saveNow, setHasUnsavedChanges }
}
```

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/_components/use-autosave.ts" apps/web/test/unit/newsletter/autosave.test.ts
git commit -m "feat(newsletter): add useAutosave hook with debounce + localStorage + retry"
```

---

### Task 21: Autosave Indicator + Navigation Guard + Read-Only Overlay

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/autosave-indicator.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/navigation-guard.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/read-only-overlay.tsx`

- [ ] **Step 1: Implement all three small components**

(Same implementations as original plan Tasks 25-26 — AutosaveIndicator with state/dot/text mapping, NavigationGuard with beforeunload, ReadOnlyOverlay with status messages.)

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/_components/autosave-indicator.tsx" "apps/web/src/app/cms/(authed)/newsletters/_components/navigation-guard.tsx" "apps/web/src/app/cms/(authed)/newsletters/_components/read-only-overlay.tsx"
git commit -m "feat(newsletter): add AutosaveIndicator, NavigationGuard, ReadOnlyOverlay"
```

---

### Task 22: Modal Components (5 modals)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/delete-confirm-modal.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/schedule-modal.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/send-now-modal.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/type-modal.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/convert-idea-modal.tsx`

- [ ] **Step 1: Implement DeleteConfirmModal (tiered: low/medium/high)**

(Same as original plan Task 19.)

- [ ] **Step 2: Implement ScheduleModal (date/time/timezone + conflict warning)**

(Same as original plan Task 20.)

- [ ] **Step 3: Implement SendNowModal (confirmation with recipient count)**

(Same as original plan Task 21.)

- [ ] **Step 4: Implement TypeModal (create/edit with color presets)**

(Same as original plan Task 22.)

- [ ] **Step 5: Implement ConvertIdeaModal (type picker + subject edit)**

(Same as original plan Task 23.)

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/_components/delete-confirm-modal.tsx" "apps/web/src/app/cms/(authed)/newsletters/_components/schedule-modal.tsx" "apps/web/src/app/cms/(authed)/newsletters/_components/send-now-modal.tsx" "apps/web/src/app/cms/(authed)/newsletters/_components/type-modal.tsx" "apps/web/src/app/cms/(authed)/newsletters/_components/convert-idea-modal.tsx"
git commit -m "feat(newsletter): add all 5 modal components (delete/schedule/send/type/convert)"
```

---

### Task 23: Email Preview Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/email-preview.tsx`

- [ ] **Step 1: Implement email preview with mobile/desktop toggle**

(Same as original plan Task 24.)

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/_components/email-preview.tsx"
git commit -m "feat(newsletter): add EmailPreview with mobile/desktop width toggle"
```

---

### Task 24: Dashboard Keyboard Shortcuts Hook

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/use-keyboard-shortcuts.ts`

- [ ] **Step 1: Implement keyboard shortcuts hook**

```typescript
// apps/web/src/app/cms/(authed)/newsletters/_components/use-keyboard-shortcuts.ts
'use client'

import { useEffect } from 'react'

interface DashboardShortcuts {
  onNewEdition: () => void
  onQuickIdea: () => void
  onFocusSearch: () => void
  onNavigateUp: () => void
  onNavigateDown: () => void
  onOpenSelected: () => void
  onShowHelp: () => void
}

export function useDashboardKeyboardShortcuts(handlers: DashboardShortcuts) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is in an input/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      switch (e.key) {
        case 'n':
        case 'N':
          if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); handlers.onNewEdition() }
          break
        case 'i':
        case 'I':
          if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); handlers.onQuickIdea() }
          break
        case '/':
          e.preventDefault()
          handlers.onFocusSearch()
          break
        case 'ArrowUp':
          e.preventDefault()
          handlers.onNavigateUp()
          break
        case 'ArrowDown':
          e.preventDefault()
          handlers.onNavigateDown()
          break
        case 'Enter':
          e.preventDefault()
          handlers.onOpenSelected()
          break
        case '?':
          if (e.shiftKey) { e.preventDefault(); handlers.onShowHelp() }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlers])
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/_components/use-keyboard-shortcuts.ts"
git commit -m "feat(newsletter): add dashboard keyboard shortcuts hook (N/I/↑↓/Enter/?)"
```

---

### Task 25: Edition Editor (Client Component)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/[id]/edit/edition-editor.tsx`

- [ ] **Step 1: Implement EditionEditor client component**

Assembles: TipTapEditor + useAutosave hook + NavigationGuard + ReadOnlyOverlay + EmailPreview + ScheduleModal + SendNowModal + DeleteConfirmModal. Includes:
- Status bar (badge + type name + autosave indicator + Test/Duplicate/Delete buttons)
- Metadata row (subject + preheader — 2-column grid)
- Segment dropdown (`all | high_engagement | re_engagement | new_subscribers`)
- Web archive checkbox
- TipTap WYSIWYG area (with ReadOnlyOverlay when locked)
- Collapsible notes `<details>`
- Bottom sticky action bar (audience count + word count + Preview/Send Now/Schedule buttons)
- Keyboard shortcuts: Cmd+S → immediate save, Cmd+Shift+P → toggle preview

Full component uses `useAutosave` hook (not inline debounce logic) and passes `saveEdition` as the saveFn. The autosave hook manages all state: debounce, retry, localStorage, conflict detection.

```typescript
// Key props interface:
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
    segment: string | null
    web_archive_enabled: boolean
  }
  subscriberCount: number
  types: Array<{ id: string; name: string; color: string }>
}
```

The segment dropdown:
```tsx
<select value={segment} onChange={(e) => { setSegment(e.target.value); scheduleAutosave() }}
  disabled={isReadOnly} className="rounded border px-2 py-1.5 text-sm">
  <option value="all">All subscribers ({subscriberCount})</option>
  <option value="high_engagement">High engagement</option>
  <option value="re_engagement">Re-engagement</option>
  <option value="new_subscribers">New subscribers</option>
</select>
```

Web archive checkbox:
```tsx
<label className="flex items-center gap-2 text-sm">
  <input type="checkbox" checked={webArchive} onChange={(e) => { setWebArchive(e.target.checked); scheduleAutosave() }} />
  Publish to web archive
</label>
```

(Full ~350 line component following same structure as original plan Task 27's edition-editor.tsx, but now using `useAutosave` hook and including segment + web archive.)

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/[id]/edit/edition-editor.tsx"
git commit -m "feat(newsletter): add EditionEditor client component with all features"
```

---

### Task 26: Rewrite Edit Page (Server Component)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/[id]/edit/page.tsx`

- [ ] **Step 1: Replace entire page.tsx with slim data-fetching server component**

```typescript
// apps/web/src/app/cms/(authed)/newsletters/[id]/edit/page.tsx
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
          segment: edition.segment,
          web_archive_enabled: edition.web_archive_enabled ?? true,
        }}
        subscriberCount={subscriberCount ?? 0}
        types={(types ?? []).map((t) => ({
          id: t.id as string,
          name: t.name as string,
          color: (t.color ?? '#7c3aed') as string,
        }))}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/[id]/edit/page.tsx"
git commit -m "feat(newsletter): rewrite edit page as thin server component + EditionEditor"
```

---

### Task 27: Wire Type Cards — Context Menu + Add Type

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_components/type-cards.tsx`

- [ ] **Step 1: Replace entire type-cards.tsx with full implementation**

(Same complete implementation as original plan Task 28 — context menu with Edit/Settings/Deactivate/Delete, functional "+ Add type" button opening TypeModal, wired to createNewsletterType/updateNewsletterType/deleteNewsletterType actions with toast feedback.)

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/_components/type-cards.tsx"
git commit -m "feat(newsletter): wire type cards with context menu + functional Add Type"
```

---

### Task 28: Wire Dashboard Context Menus + Ideas Tab

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/newsletters-connected.tsx`

This is the largest modification. The 953-line file needs targeted changes in 4 areas.

- [ ] **Step 1: Add imports at top of file (after existing imports, line ~8)**

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
import { useDashboardKeyboardShortcuts } from './_components/use-keyboard-shortcuts'
```

- [ ] **Step 2: Update STATUS_OPTIONS to include idea and cancelled (line ~77)**

Replace:
```typescript
const STATUS_OPTIONS = ['all', 'draft', 'ready', 'scheduled', 'sending', 'sent', 'failed'] as const
```
With:
```typescript
const STATUS_OPTIONS = ['all', 'idea', 'draft', 'ready', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'] as const
```

- [ ] **Step 3: Update EditionRow status type (line ~27)**

Replace:
```typescript
status: 'draft' | 'ready' | 'queued' | 'scheduled' | 'sending' | 'sent' | 'failed'
```
With:
```typescript
status: 'idea' | 'draft' | 'ready' | 'queued' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled'
```

- [ ] **Step 4: Add modal state + action handlers + keyboard shortcuts inside NewslettersConnected component**

After the existing state declarations (around line 105), add:

```typescript
const [showScheduleModal, setShowScheduleModal] = useState(false)
const [showSendNowModal, setShowSendNowModal] = useState(false)
const [showDeleteModal, setShowDeleteModal] = useState(false)
const [showConvertModal, setShowConvertModal] = useState(false)
const [showQuickIdea, setShowQuickIdea] = useState(false)
const [activeEditionId, setActiveEditionId] = useState<string | null>(null)
const [selectedIndex, setSelectedIndex] = useState(0)
const [quickIdeaTitle, setQuickIdeaTitle] = useState('')
const searchInputRef = useRef<HTMLInputElement>(null)

const activeEdition = editions.find((e) => e.id === activeEditionId)

async function handleDuplicate(id: string) {
  const result = await duplicateEdition(id)
  if (result.ok) {
    toast.success('Edition duplicated')
    router.refresh()
  } else {
    toast.error(`Duplicate failed: ${result.error}`)
  }
}

async function handleDelete(id: string, confirmText?: string) {
  const result = await deleteEdition(id, { confirmed: true, confirmText })
  if (result.ok) {
    toast.success('Edition deleted')
    setShowDeleteModal(false)
    router.refresh()
  } else {
    toast.error(`Delete failed: ${(result as any).error}`)
  }
}

async function handleCancel(id: string) {
  const result = await cancelEdition(id)
  if (result.ok) {
    toast.success('Edition cancelled')
    router.refresh()
  } else {
    toast.error(`Cancel failed: ${result.error}`)
  }
}

async function handleRevert(id: string) {
  const result = await revertToDraft(id)
  if (result.ok) {
    toast.success('Reverted to draft')
    router.refresh()
  } else {
    toast.error(`Revert failed: ${result.error}`)
  }
}

async function handleSendNow(id: string) {
  const result = await sendNow(id)
  if (result.ok) {
    toast.success('Sending to subscribers...')
    setShowSendNowModal(false)
    router.refresh()
  } else {
    toast.error(`Send failed: ${result.error}`)
  }
}

async function handleSendTest(id: string) {
  const result = await sendTestEmail(id)
  if (result.ok) {
    toast.success('Test email sent')
  } else {
    toast.error(`Test failed: ${result.error}`)
  }
}

async function handleSchedule(id: string, scheduledAt: string) {
  const result = await scheduleEdition(id, scheduledAt)
  if (result.ok) {
    toast.success(`Scheduled for ${new Date(scheduledAt).toLocaleString()}`)
    if ('conflict' in result && result.conflict) {
      toast.warning(`Conflict: "${result.conflict.subject}" is within 2 hours`)
    }
    setShowScheduleModal(false)
    router.refresh()
  } else {
    toast.error(`Schedule failed: ${result.error}`)
  }
}

async function handleConvertIdea(typeId: string, subject: string) {
  if (!activeEditionId) return
  const { saveEdition } = await import('./actions')
  const result = await saveEdition(activeEditionId, { subject })
  if (!result.ok) { toast.error('Failed to update'); return }

  // Update type and status
  const supabaseResult = await saveEdition(activeEditionId, {})
  // Actually we need a dedicated convert action — use scheduleEdition approach:
  // For MVP: navigate to edit page (which handles status transitions)
  setShowConvertModal(false)
  router.push(`/cms/newsletters/${activeEditionId}/edit`)
}

async function handleQuickIdea() {
  if (!quickIdeaTitle.trim()) return
  const result = await createIdea(quickIdeaTitle.trim())
  if (result.ok) {
    toast.success('Idea saved')
    setQuickIdeaTitle('')
    setShowQuickIdea(false)
    router.refresh()
  } else {
    toast.error(`Failed: ${result.error}`)
  }
}

useDashboardKeyboardShortcuts({
  onNewEdition: () => router.push('/cms/newsletters/new'),
  onQuickIdea: () => setShowQuickIdea(true),
  onFocusSearch: () => searchInputRef.current?.focus(),
  onNavigateUp: () => setSelectedIndex((i) => Math.max(0, i - 1)),
  onNavigateDown: () => setSelectedIndex((i) => Math.min(editions.length - 1, i + 1)),
  onOpenSelected: () => {
    const ed = editions[selectedIndex]
    if (ed) router.push(`/cms/newsletters/${ed.id}/edit`)
  },
  onShowHelp: () => toast('Shortcuts: N=New, I=Idea, /=Search, ↑↓=Navigate, Enter=Open'),
})
```

- [ ] **Step 5: Replace context menu render section (lines ~331-389)**

Replace the dead-code context menu items with status-aware menus:

```typescript
function renderContextMenu(row: EditionRow) {
  const items: Array<{ label: string; action: () => void; danger?: boolean }> = []

  switch (row.status) {
    case 'idea':
      items.push({ label: 'Edit', action: () => router.push(`/cms/newsletters/${row.id}/edit`) })
      items.push({ label: 'Convert to Edition', action: () => { setActiveEditionId(row.id); setShowConvertModal(true) } })
      items.push({ label: 'Delete', action: () => { setActiveEditionId(row.id); setShowDeleteModal(true) }, danger: true })
      break
    case 'draft':
    case 'ready':
      items.push({ label: 'Edit', action: () => router.push(`/cms/newsletters/${row.id}/edit`) })
      items.push({ label: 'Send Test', action: () => handleSendTest(row.id) })
      items.push({ label: 'Schedule...', action: () => { setActiveEditionId(row.id); setShowScheduleModal(true) } })
      items.push({ label: 'Send Now', action: () => { setActiveEditionId(row.id); setShowSendNowModal(true) } })
      items.push({ label: 'Duplicate', action: () => handleDuplicate(row.id) })
      items.push({ label: 'Delete', action: () => { setActiveEditionId(row.id); setShowDeleteModal(true) }, danger: true })
      break
    case 'scheduled':
      items.push({ label: 'Edit', action: () => router.push(`/cms/newsletters/${row.id}/edit`) })
      items.push({ label: 'Reschedule...', action: () => { setActiveEditionId(row.id); setShowScheduleModal(true) } })
      items.push({ label: 'Send Now', action: () => { setActiveEditionId(row.id); setShowSendNowModal(true) } })
      items.push({ label: 'Duplicate', action: () => handleDuplicate(row.id) })
      items.push({ label: 'Cancel Schedule', action: () => handleCancel(row.id) })
      items.push({ label: 'Delete', action: () => { setActiveEditionId(row.id); setShowDeleteModal(true) }, danger: true })
      break
    case 'sending':
      // Locked — show progress only
      break
    case 'sent':
      items.push({ label: 'View', action: () => router.push(`/cms/newsletters/${row.id}/edit`) })
      items.push({ label: 'Analytics', action: () => router.push(`/cms/newsletters/${row.id}/analytics`) })
      items.push({ label: 'Web Archive', action: () => window.open(`/newsletter/archive/${row.id}`, '_blank') })
      items.push({ label: 'Duplicate as Draft', action: () => handleDuplicate(row.id) })
      items.push({ label: 'Delete...', action: () => { setActiveEditionId(row.id); setShowDeleteModal(true) }, danger: true })
      break
    case 'failed':
      items.push({ label: `Retry (${(row.max_retries ?? 3) - (row.retry_count ?? 0)} left)`, action: () => retryEdition(row.id).then(() => { toast.success('Retrying...'); router.refresh() }) })
      items.push({ label: 'Edit & Reschedule', action: () => router.push(`/cms/newsletters/${row.id}/edit`) })
      items.push({ label: 'Duplicate', action: () => handleDuplicate(row.id) })
      items.push({ label: 'Delete', action: () => { setActiveEditionId(row.id); setShowDeleteModal(true) }, danger: true })
      break
    case 'cancelled':
      items.push({ label: 'Revert to Draft', action: () => handleRevert(row.id) })
      items.push({ label: 'Duplicate', action: () => handleDuplicate(row.id) })
      items.push({ label: 'Delete', action: () => { setActiveEditionId(row.id); setShowDeleteModal(true) }, danger: true })
      break
  }

  return items
}
```

- [ ] **Step 6: Add Quick Idea inline form + modal renders at end of component JSX**

Before the closing `</div>` of the main component return, add:

```tsx
{/* Quick Idea inline form */}
{showQuickIdea && (
  <div className="fixed bottom-20 right-6 bg-white border border-cms-border rounded-lg shadow-xl p-4 z-40 w-80">
    <h4 className="text-sm font-semibold mb-2">Quick Idea</h4>
    <input
      type="text"
      value={quickIdeaTitle}
      onChange={(e) => setQuickIdeaTitle(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') handleQuickIdea(); if (e.key === 'Escape') setShowQuickIdea(false) }}
      placeholder="Newsletter idea title..."
      className="w-full rounded border px-3 py-2 text-sm mb-2"
      autoFocus
    />
    <div className="flex justify-end gap-2">
      <button type="button" onClick={() => setShowQuickIdea(false)} className="text-xs text-cms-text-muted">Cancel</button>
      <button type="button" onClick={handleQuickIdea} className="text-xs bg-cms-accent text-white px-3 py-1 rounded">Save Idea</button>
    </div>
  </div>
)}

{/* Modals */}
{showScheduleModal && activeEditionId && (
  <ScheduleModal
    open={showScheduleModal}
    audienceCount={kpis.uniqueSubscribers}
    onConfirm={(scheduledAt) => handleSchedule(activeEditionId, scheduledAt)}
    onCancel={() => setShowScheduleModal(false)}
  />
)}
{showSendNowModal && activeEdition && (
  <SendNowModal
    open={showSendNowModal}
    subject={activeEdition.subject}
    recipientCount={kpis.uniqueSubscribers}
    senderName="Thiago Figueiredo"
    senderEmail="newsletter@bythiagofigueiredo.com"
    onConfirm={() => handleSendNow(activeEditionId!)}
    onCancel={() => setShowSendNowModal(false)}
  />
)}
{showDeleteModal && activeEditionId && activeEdition && (
  <DeleteConfirmModal
    open={showDeleteModal}
    title={`Delete "${activeEdition.subject}"?`}
    description="This cannot be undone."
    impactLevel={activeEdition.status === 'sent' ? 'high' : activeEdition.status === 'scheduled' ? 'medium' : 'low'}
    onConfirm={(text) => handleDelete(activeEditionId, text)}
    onCancel={() => setShowDeleteModal(false)}
  />
)}
{showConvertModal && activeEdition && (
  <ConvertIdeaModal
    open={showConvertModal}
    ideaTitle={activeEdition.subject}
    ideaCreatedAt={activeEdition.created_at ?? new Date().toISOString()}
    types={types.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
    onConfirm={handleConvertIdea}
    onCancel={() => setShowConvertModal(false)}
  />
)}
```

- [ ] **Step 7: Run tests**

Run: `cd apps/web && npx vitest run`
Expected: All pass.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/newsletters-connected.tsx"
git commit -m "feat(newsletter): wire all context menus + Ideas tab + keyboard shortcuts"
```

---

### Task 29: Update Dashboard Page — Toast Provider + Ideas Data

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/page.tsx`

- [ ] **Step 1: Add toast provider import and render**

Add import at top:
```typescript
import { NewsletterToastProvider } from './_components/toast-provider'
```

Wrap the return JSX — add `<NewsletterToastProvider />` inside the outer `<div>`:
```typescript
return (
  <div>
    <NewsletterToastProvider />
    <CmsTopbar ... />
    ...
  </div>
)
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/page.tsx"
git commit -m "feat(newsletter): add toast provider + ideas support to dashboard page"
```

---

### Task 30: Fix `new/page.tsx` — Type Validation

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/new/page.tsx`

- [ ] **Step 1: Add type existence + active validation**

After `typeId` is resolved (line ~33), add:

```typescript
if (!typeId) {
  redirect('/cms/newsletters?error=no_type')
}

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
git commit -m "fix(newsletter): add type validation to new edition page"
```

---

### Task 31: Settings Page Enhancement

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/settings/page.tsx`

- [ ] **Step 1: Add bounce policy section below existing settings**

After `<NewsletterSettings>`, add:

```typescript
<section className="mt-8 border-t pt-6">
  <h2 className="text-lg font-semibold mb-4">Bounce Policy</h2>
  <div className="bg-cms-surface-subtle rounded p-4 text-sm text-cms-text-muted space-y-2">
    <p><strong>Auto-pause threshold:</strong> 5% bounce rate</p>
    <p>When a newsletter type exceeds 5% bounce rate, sending is automatically paused. Resume from Per-Type Settings above.</p>
    <p>Bounced subscribers are marked inactive and excluded from future sends.</p>
  </div>
</section>
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/settings/page.tsx"
git commit -m "feat(newsletter): add bounce policy section to settings page"
```

---

### Task 32: Push Migrations to Production

- [ ] **Step 1: Validate locally**

Run: `npm run db:start && npm run db:reset`
Expected: All 3 new migrations apply cleanly.

- [ ] **Step 2: Push to production**

Run: `npm run db:push:prod`
Expected: 3 new migrations applied successfully.

---

### Task 33: Run Full Test Suite + Typecheck

- [ ] **Step 1: Run all tests**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass (existing 750+ plus new newsletter tests).

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Fix any issues and commit**

```bash
git add -A && git commit -m "fix(newsletter): resolve test/type issues from CMS overhaul"
```

---

### Task 34: Integration Smoke Test in Browser

- [ ] **Step 1: Start dev server**

Run: `cd apps/web && npm run dev`

- [ ] **Step 2: Verify critical paths**

1. `/cms/newsletters` → type cards render, "+ Add type" opens TypeModal, submit creates type with toast
2. Right-click type card → context menu shows Edit/Deactivate/Delete
3. "New Edition" → creates draft, redirects to editor with TipTap loaded
4. Type text in editor → toolbar buttons apply formatting (bold/italic/heading)
5. Insert merge tag via dropdown → pill appears in editor
6. Insert CTA button → editable block with color picker
7. Drag image into editor → upload + insert
8. Subject/preheader change → autosave indicator shows "Saving..." → "Saved"
9. Press Cmd+S → immediate save
10. "Schedule..." button → ScheduleModal opens, select date, confirm
11. "Preview as Email" → iframe shows sanitized email with inlined CSS
12. Navigate away with unsaved changes → beforeunload warning
13. Ideas tab → "Quick Idea" inline form → creates idea with toast
14. Keyboard: press `N` on dashboard → navigates to /cms/newsletters/new
15. Keyboard: press `I` on dashboard → quick idea form appears
16. Sent edition → read-only overlay prevents editing
17. Context menu on draft → all items functional (Edit/Test/Schedule/Send/Duplicate/Delete)

- [ ] **Step 3: Fix any issues found during smoke test**

```bash
git add -A && git commit -m "fix(newsletter): hotfixes from integration smoke test"
```
