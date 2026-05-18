# Phase 3: Composer UI Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Composer with caption variable highlighting, OG preview sidebar, pre-publish confirmation dialog, template carousel, and duplicate detection.

**Architecture:** This phase extends the existing Composer shell (`composer-shell.tsx`) and caption tabs (`caption-tabs.tsx`) with five new subsystems: (1) a transparent textarea overlay that highlights `{{link}}`, `{{title}}`, `{{url}}` variables using regex matching, (2) a 380px sticky OG preview sidebar with per-platform card renderings and validation badges, (3) a pre-publish confirmation dialog that creates short links JIT and shows resolved captions, (4) a horizontal template carousel below the caption area, and (5) a duplicate detection system that queries `social_posts` at Composer load time. All new components are client-only (`'use client'`) and follow the existing CMS design system (dark theme, `cms-*` Tailwind tokens). Caption variable resolution from Phase 1's `resolveCaption()` utility is consumed here for preview rendering.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, Vitest, @testing-library/react

**Spec:** `docs/superpowers/specs/2026-05-17-social-composer-stories-templates-design.md` (Sections 2, 3, 6.6, 6.8)

**Dependencies:** Phase 1 must be complete (caption variables backend, pipeline redesign).

---

## File Structure

```
New files:
  apps/web/src/app/cms/(authed)/social/new/_components/caption-variable-textarea.tsx
  apps/web/src/app/cms/(authed)/social/new/_components/og-preview-sidebar.tsx
  apps/web/src/app/cms/(authed)/social/new/_components/og-facebook-card.tsx
  apps/web/src/app/cms/(authed)/social/new/_components/og-bluesky-card.tsx
  apps/web/src/app/cms/(authed)/social/new/_components/og-instagram-preview.tsx
  apps/web/src/app/cms/(authed)/social/new/_components/publish-confirmation-dialog.tsx
  apps/web/src/app/cms/(authed)/social/new/_components/template-carousel.tsx
  apps/web/src/lib/social/duplicate-detection.ts
  apps/web/test/caption-variable-textarea.test.ts
  apps/web/test/publish-confirmation.test.ts
  apps/web/test/duplicate-detection.test.ts

Modified files:
  apps/web/src/app/cms/(authed)/social/new/_components/caption-tabs.tsx
  apps/web/src/app/cms/(authed)/social/new/_components/composer-shell.tsx
```

**Dependency graph:**

```
Task 10 (caption textarea) ──┐
                              ├──► Task 12 (pre-publish confirmation)
Task 11 (OG sidebar) ────────┘
                              
Task 13 (template carousel) ──── parallel with Task 10
Task 14 (duplicate detection) ── parallel with Task 10
```

**Parallelism:** Tasks 10 and 11 are parallel. Task 12 depends on both. Tasks 13 and 14 are parallel with each other and with Task 10 (only depend on Phase 1).

---

### Task 10: Caption Textarea with Variable Highlighting

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/new/_components/caption-variable-textarea.tsx`
- Modify: `apps/web/src/app/cms/(authed)/social/new/_components/caption-tabs.tsx` — replace plain textarea with new component
- Create: `apps/web/test/caption-variable-textarea.test.ts`

- [ ] **Step 1: Write failing tests for CaptionVariableTextarea**

Create `apps/web/test/caption-variable-textarea.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'

describe('CaptionVariableTextarea', () => {
  const defaultProps = {
    value: '{{title}}\n\n{{link}}',
    onChange: vi.fn(),
    platform: 'facebook' as const,
    charLimit: 63_206,
    contentTitle: 'Como configurar OAuth 2.0',
    contentUrl: 'https://bythiagofigueiredo.com/blog/oauth-guide',
    shortDomain: 'go.btf.com',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders textarea with the provided value', async () => {
    const { CaptionVariableTextarea } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-variable-textarea'
    )
    render(<CaptionVariableTextarea {...defaultProps} />)
    expect(screen.getByRole('textbox')).toBeDefined()
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      '{{title}}\n\n{{link}}',
    )
  })

  it('renders overlay with highlighted variable spans', async () => {
    const { CaptionVariableTextarea } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-variable-textarea'
    )
    const { container } = render(<CaptionVariableTextarea {...defaultProps} />)
    const overlay = container.querySelector('[data-testid="variable-overlay"]')
    expect(overlay).toBeDefined()
    // Should contain highlighted spans for {{title}} and {{link}}
    const highlights = overlay?.querySelectorAll('[data-variable]')
    expect(highlights?.length).toBe(2)
  })

  it('does NOT highlight unknown variables like {{foo}}', async () => {
    const { CaptionVariableTextarea } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-variable-textarea'
    )
    const { container } = render(
      <CaptionVariableTextarea
        {...defaultProps}
        value="Hello {{foo}} world {{link}}"
      />,
    )
    const overlay = container.querySelector('[data-testid="variable-overlay"]')
    const highlights = overlay?.querySelectorAll('[data-variable]')
    // Only {{link}} should be highlighted, not {{foo}}
    expect(highlights?.length).toBe(1)
  })

  it('shows resolved preview panel with placeholder link', async () => {
    const { CaptionVariableTextarea } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-variable-textarea'
    )
    render(<CaptionVariableTextarea {...defaultProps} />)
    const preview = screen.getByTestId('resolved-preview')
    expect(preview.textContent).toContain('Como configurar OAuth 2.0')
    expect(preview.textContent).toContain('go.btf.com/______')
  })

  it('shows character count based on resolved length', async () => {
    const { CaptionVariableTextarea } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-variable-textarea'
    )
    render(<CaptionVariableTextarea {...defaultProps} />)
    const charCount = screen.getByTestId('resolved-char-count')
    // Resolved: "Como configurar OAuth 2.0\n\ngo.btf.com/______" = 25 + 2 + 17 = 44
    expect(charCount.textContent).toContain('/63206')
  })

  it('shows yellow warning when no {{link}} present', async () => {
    const { CaptionVariableTextarea } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-variable-textarea'
    )
    render(
      <CaptionVariableTextarea {...defaultProps} value="Just a plain caption" />,
    )
    expect(screen.getByTestId('no-link-warning')).toBeDefined()
    expect(screen.getByTestId('no-link-warning').textContent).toContain(
      'No link in caption',
    )
  })

  it('has an "Add {{link}}" quick-insert button', async () => {
    const { CaptionVariableTextarea } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-variable-textarea'
    )
    render(
      <CaptionVariableTextarea {...defaultProps} value="No link here" />,
    )
    const btn = screen.getByRole('button', { name: /add \{\{link\}\}/i })
    expect(btn).toBeDefined()
    fireEvent.click(btn)
    expect(defaultProps.onChange).toHaveBeenCalledWith('No link here\n\n{{link}}')
  })

  it('fires onChange on textarea input', async () => {
    const { CaptionVariableTextarea } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-variable-textarea'
    )
    render(<CaptionVariableTextarea {...defaultProps} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'New value {{url}}' } })
    expect(defaultProps.onChange).toHaveBeenCalledWith('New value {{url}}')
  })

  it('shows red counter when over platform limit', async () => {
    const { CaptionVariableTextarea } = await import(
      '@/app/cms/(authed)/social/new/_components/caption-variable-textarea'
    )
    const { container } = render(
      <CaptionVariableTextarea
        {...defaultProps}
        value={'A'.repeat(301)}
        charLimit={300}
        platform="bluesky"
      />,
    )
    const charCount = container.querySelector('[data-testid="resolved-char-count"]')
    expect(charCount?.className).toContain('text-red')
  })
})
```

Run: `npm run test:web -- --run apps/web/test/caption-variable-textarea.test.ts`

Expected: All tests fail (module not found).

- [ ] **Step 2: Implement CaptionVariableTextarea component**

Create `apps/web/src/app/cms/(authed)/social/new/_components/caption-variable-textarea.tsx`:

```typescript
'use client'

import { useRef, useCallback, useEffect } from 'react'

// ---------------------------------------------------------------------------
// Variable highlighting regex — only known variables
// ---------------------------------------------------------------------------

const VARIABLE_REGEX = /\{\{(link|title|url)\}\}/g

// ---------------------------------------------------------------------------
// Per-platform caption defaults (spec Section 2)
// ---------------------------------------------------------------------------

export const PLATFORM_CAPTION_DEFAULTS: Record<string, string> = {
  facebook: '{{title}}\n\n{{link}}',
  bluesky: '{{title}}\n\n{{link}}',
  instagram: '{{title}}\n\nLink na bio',
  youtube: '{{title}}\n\n{{link}}',
}

// ---------------------------------------------------------------------------
// Placeholder short link length (24 chars — "go.btf.com/______" pattern)
// ---------------------------------------------------------------------------

const SHORT_LINK_PLACEHOLDER_LENGTH = 24

// ---------------------------------------------------------------------------
// Resolve caption for preview (mirrors caption-variables.ts from Phase 1)
// ---------------------------------------------------------------------------

function resolveForPreview(
  template: string,
  contentTitle: string,
  contentUrl: string,
  shortDomain: string,
): string {
  return template.replace(VARIABLE_REGEX, (match, varName: string) => {
    switch (varName) {
      case 'link':
        return `${shortDomain}/______`
      case 'title':
        return contentTitle
      case 'url':
        return contentUrl
      default:
        return match
    }
  })
}

function resolvedLength(
  template: string,
  contentTitle: string,
  contentUrl: string,
): number {
  let length = 0
  let lastIndex = 0
  const regex = new RegExp(VARIABLE_REGEX.source, 'g')
  let m: RegExpExecArray | null

  while ((m = regex.exec(template)) !== null) {
    length += m.index - lastIndex
    const varName = m[1]
    switch (varName) {
      case 'link':
        length += SHORT_LINK_PLACEHOLDER_LENGTH
        break
      case 'title':
        length += contentTitle.length
        break
      case 'url':
        length += contentUrl.length
        break
      default:
        length += m[0].length // literal passthrough
    }
    lastIndex = regex.lastIndex
  }

  length += template.length - lastIndex
  return length
}

// ---------------------------------------------------------------------------
// Char count color (90% = amber, 100% = red)
// ---------------------------------------------------------------------------

function getCountColor(current: number, limit: number): string {
  if (current > limit) return 'text-red-400'
  if (current > limit * 0.9) return 'text-amber-400'
  return 'text-cms-text-muted'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CaptionVariableTextareaProps {
  value: string
  onChange: (value: string) => void
  platform: string
  charLimit: number
  contentTitle: string
  contentUrl: string
  shortDomain: string
  placeholder?: string
}

export function CaptionVariableTextarea({
  value,
  onChange,
  platform,
  charLimit,
  contentTitle,
  contentUrl,
  shortDomain,
  placeholder,
}: CaptionVariableTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Sync scroll between textarea and overlay
  const handleScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.addEventListener('scroll', handleScroll)
    return () => textarea.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Build overlay content with highlighted spans
  const overlayContent = buildOverlayContent(value)

  // Resolved preview
  const resolvedText = resolveForPreview(value, contentTitle, contentUrl, shortDomain)
  const charCount = resolvedLength(value, contentTitle, contentUrl)

  // Soft validation: no {{link}}
  const hasLink = /\{\{link\}\}/.test(value)

  function handleInsertLink() {
    const suffix = value.length > 0 ? '\n\n{{link}}' : '{{link}}'
    onChange(value + suffix)
  }

  return (
    <div className="space-y-2">
      {/* Textarea with overlay */}
      <div className="relative">
        {/* Overlay (behind textarea, renders highlights) */}
        <div
          ref={overlayRef}
          data-testid="variable-overlay"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden whitespace-pre-wrap break-words rounded-md border border-transparent p-3 font-mono text-[13px] leading-relaxed"
          style={{ wordBreak: 'break-word' }}
        >
          {overlayContent}
        </div>

        {/* Actual textarea (transparent bg, on top) */}
        <textarea
          ref={textareaRef}
          role="textbox"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? `Escreva uma mensagem para o ${platform}...`}
          className="relative z-10 min-h-[120px] w-full resize-y rounded-md border border-cms-border bg-transparent p-3 font-mono text-[13px] leading-relaxed text-cms-text placeholder:text-cms-text-muted"
        />
      </div>

      {/* Resolved Preview Panel */}
      <div className="rounded-md border border-cms-border bg-cms-bg/50 p-3">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-cms-text-muted">
          Preview
        </p>
        <p
          data-testid="resolved-preview"
          className="whitespace-pre-wrap font-mono text-xs text-cms-text"
        >
          {resolvedText || (
            <span className="italic text-cms-text-muted">Empty</span>
          )}
        </p>
        <div className="mt-2 flex items-center justify-between">
          {/* Soft validation: no link warning */}
          {!hasLink && value.length > 0 && (
            <div
              data-testid="no-link-warning"
              className="flex items-center gap-1.5 text-yellow-500"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <span className="text-[11px]">No link in caption</span>
              <button
                type="button"
                onClick={handleInsertLink}
                className="ml-1 rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-400 hover:bg-yellow-500/20"
              >
                {'Add {{link}}'}
              </button>
            </div>
          )}

          {/* Character count (resolved length) */}
          <span
            data-testid="resolved-char-count"
            className={`ml-auto text-xs ${getCountColor(charCount, charLimit)}`}
          >
            {charCount}/{charLimit}
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overlay content builder
// ---------------------------------------------------------------------------

function buildOverlayContent(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  const regex = new RegExp(VARIABLE_REGEX.source, 'g')
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // Text before the match (invisible for spacing)
    if (match.index > lastIndex) {
      nodes.push(
        <span key={`t-${lastIndex}`} className="text-transparent">
          {text.slice(lastIndex, match.index)}
        </span>,
      )
    }

    // Highlighted variable
    nodes.push(
      <span
        key={`v-${match.index}`}
        data-variable={match[1]}
        className="rounded bg-blue-900/40 px-0.5 text-transparent"
      >
        {match[0]}
      </span>,
    )

    lastIndex = regex.lastIndex
  }

  // Remaining text
  if (lastIndex < text.length) {
    nodes.push(
      <span key={`t-${lastIndex}`} className="text-transparent">
        {text.slice(lastIndex)}
      </span>,
    )
  }

  return nodes
}
```

Run: `npm run test:web -- --run apps/web/test/caption-variable-textarea.test.ts`

Expected: All tests pass.

- [ ] **Step 3: Integrate CaptionVariableTextarea into CaptionTabs**

Modify `apps/web/src/app/cms/(authed)/social/new/_components/caption-tabs.tsx`:

Replace the plain `<textarea>` with `<CaptionVariableTextarea>`. The existing `CaptionTabs` component already manages per-platform/per-locale captions. The integration adds variable highlighting and resolved preview to each platform tab.

Key changes:

1. Import `CaptionVariableTextarea` and `PLATFORM_CAPTION_DEFAULTS`
2. Add new props: `contentTitle`, `contentUrl`, `shortDomain`
3. Replace the `<textarea>` block (lines 133-140 in original) with `<CaptionVariableTextarea>`
4. Add auto-fill logic: when a platform is first activated and its caption is empty, pre-fill with `PLATFORM_CAPTION_DEFAULTS[platform]`
5. Remove the old manual char count display (now handled by the textarea component)

The modified `CaptionTabsProps` interface:

```typescript
interface CaptionTabsProps {
  captions: Record<string, Record<string, string>>
  onChange: (captions: Record<string, Record<string, string>>) => void
  platforms: Platform[]
  autoFilled?: boolean
  contentTitle?: string
  contentUrl?: string
  shortDomain?: string
}
```

The existing `CHAR_LIMITS` map stays in `caption-tabs.tsx` for the tab-level character counter display.

The `getCharCountColor` function is still used in the platform tab headers.

Replace the textarea section:

```typescript
// OLD: plain textarea
<textarea
  role="textbox"
  value={currentCaption}
  onChange={(e) => handleChange(e.target.value)}
  ...
/>

// NEW: variable-aware textarea
<CaptionVariableTextarea
  value={currentCaption}
  onChange={handleChange}
  platform={activePlatform}
  charLimit={charLimit}
  contentTitle={contentTitle ?? ''}
  contentUrl={contentUrl ?? ''}
  shortDomain={shortDomain ?? 'go.btf.com'}
  placeholder={`Escreva uma mensagem para o ${activePlatform}...`}
/>
```

Remove the old `<div className="mt-1 flex items-center justify-end">` char count block — the new textarea component handles this internally.

- [ ] **Step 4: Update ComposerShell to pass content metadata to CaptionTabs**

Modify `apps/web/src/app/cms/(authed)/social/new/_components/composer-shell.tsx`:

Pass the new props to `<CaptionTabs>`:

```typescript
{sourceMode === 'cms' && selectedContent && platforms.length > 0 && (
  <CaptionTabs
    captions={captions}
    onChange={setCaptions}
    platforms={platforms}
    autoFilled={captionsAutoFilled}
    contentTitle={selectedContent.title}
    contentUrl={selectedContent.url ?? url}
    shortDomain={process.env.NEXT_PUBLIC_SHORT_DOMAIN ?? 'go.btf.com'}
  />
)}
```

- [ ] **Step 5: Run all tests and verify**

```bash
npm run test:web -- --run apps/web/test/caption-variable-textarea.test.ts
npm run test:web -- --run apps/web/test/cms/social-composer/caption-tabs.test.tsx
```

Ensure all existing `caption-tabs.test.tsx` tests still pass. The new `contentTitle`/`contentUrl`/`shortDomain` props are optional in the interface, so existing tests that don't provide them should continue to work (the old `<textarea>` is only replaced when these props are present; otherwise the component can fall back gracefully).

- [ ] **Step 6: Commit**

```
feat(social): caption textarea with variable highlighting and resolved preview
```

---

### Task 11: OG Preview Sidebar

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/new/_components/og-preview-sidebar.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/new/_components/og-facebook-card.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/new/_components/og-bluesky-card.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/new/_components/og-instagram-preview.tsx`
- Modify: `apps/web/src/app/cms/(authed)/social/new/_components/composer-shell.tsx` — add sidebar to layout

- [ ] **Step 1: Create OG Facebook Card component**

Create `apps/web/src/app/cms/(authed)/social/new/_components/og-facebook-card.tsx`:

```typescript
'use client'

interface OgFacebookCardProps {
  imageUrl: string | null
  title: string
  description: string
  domain: string
}

export function OgFacebookCard({
  imageUrl,
  title,
  description,
  domain,
}: OgFacebookCardProps) {
  return (
    <div className="w-full overflow-hidden rounded-none border border-gray-700 bg-gray-800">
      {/* Image — 1.91:1 ratio */}
      <div className="relative aspect-[1.91/1] w-full bg-gray-700">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="OG preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            No og:image
          </div>
        )}
      </div>

      {/* Text content */}
      <div className="space-y-0.5 px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
          {domain}
        </p>
        <p className="line-clamp-2 text-sm font-bold leading-tight text-gray-200">
          {title || 'Untitled'}
        </p>
        <p className="line-clamp-1 text-xs text-gray-400">
          {description || 'No description'}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create OG Bluesky Card component**

Create `apps/web/src/app/cms/(authed)/social/new/_components/og-bluesky-card.tsx`:

```typescript
'use client'

interface OgBlueskyCardProps {
  imageUrl: string | null
  title: string
  description: string
  domain: string
}

export function OgBlueskyCard({
  imageUrl,
  title,
  description,
  domain,
}: OgBlueskyCardProps) {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-700 bg-gray-800">
      {/* Image — 2:1 ratio */}
      <div className="relative aspect-[2/1] w-full bg-gray-700">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="OG preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            No og:image
          </div>
        )}
      </div>

      {/* Text content */}
      <div className="space-y-1 px-3 py-2">
        <p className="line-clamp-1 text-sm font-semibold text-gray-200">
          {title || 'Untitled'}
        </p>
        <p className="line-clamp-2 text-xs text-gray-400">
          {description || 'No description'}
        </p>
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          {/* Globe icon */}
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
            />
          </svg>
          <span>{domain}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create OG Instagram Preview component**

Create `apps/web/src/app/cms/(authed)/social/new/_components/og-instagram-preview.tsx`:

```typescript
'use client'

interface OgInstagramPreviewProps {
  imageUrl: string | null
  title: string
  ctaText?: string
}

export function OgInstagramPreview({
  imageUrl,
  title,
  ctaText = 'Link na bio',
}: OgInstagramPreviewProps) {
  return (
    <div className="mx-auto w-full max-w-[200px] overflow-hidden rounded-lg border border-gray-700 bg-gray-900">
      {/* Story frame — 9:16 ratio miniature */}
      <div className="relative aspect-[9/16] w-full bg-gray-800">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Story preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 opacity-30" />
          </div>
        )}

        {/* CTA overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-4">
          <p className="mb-1 line-clamp-2 text-center text-[10px] font-semibold text-white">
            {title || 'Title'}
          </p>
          <div className="mx-auto w-fit rounded-full bg-white/90 px-3 py-1">
            <p className="text-[9px] font-bold text-gray-900">{ctaText}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create OG Preview Sidebar container**

Create `apps/web/src/app/cms/(authed)/social/new/_components/og-preview-sidebar.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import type { Provider } from '@tn-figueiredo/social'
import { PlatformIcon, platformLabel } from '@/app/cms/(authed)/_shared/social/platform-icon'
import { OgFacebookCard } from './og-facebook-card'
import { OgBlueskyCard } from './og-bluesky-card'
import { OgInstagramPreview } from './og-instagram-preview'
import { scrapeOgTags } from '@/lib/social/actions'

// ---------------------------------------------------------------------------
// OG validation badge types
// ---------------------------------------------------------------------------

interface OgBadge {
  label: string
  severity: 'red' | 'amber' | 'green'
}

function computeOgBadges(ogData: OgData | null): OgBadge[] {
  if (!ogData) return [{ label: 'Not scraped', severity: 'amber' }]

  const badges: OgBadge[] = []

  if (!ogData.image) {
    badges.push({ label: 'og:image missing', severity: 'red' })
  } else if (
    ogData.imageWidth &&
    ogData.imageHeight &&
    (ogData.imageWidth < 600 || ogData.imageHeight < 314)
  ) {
    badges.push({ label: 'Image too small', severity: 'amber' })
  }

  if (!ogData.title) {
    badges.push({ label: 'Title missing', severity: 'red' })
  }

  if (ogData.description && ogData.description.length > 200) {
    badges.push({ label: 'Description too long', severity: 'amber' })
  }

  if (badges.length === 0) {
    badges.push({ label: 'All checks passed', severity: 'green' })
  }

  return badges
}

const SEVERITY_COLORS: Record<string, string> = {
  red: 'text-red-400 bg-red-500/10',
  amber: 'text-amber-400 bg-amber-500/10',
  green: 'text-emerald-400 bg-emerald-500/10',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OgData {
  title: string
  description: string
  image: string | null
  imageWidth?: number
  imageHeight?: number
  domain: string
  scrapedAt?: string
}

interface OgPreviewSidebarProps {
  platforms: Provider[]
  ogData: OgData | null
  postId?: string
  onForceRescrape?: () => void
}

// Platforms that show OG previews (YouTube excluded — no link cards)
const OG_PLATFORMS: Provider[] = ['facebook', 'bluesky', 'instagram']

export function OgPreviewSidebar({
  platforms,
  ogData,
  postId,
  onForceRescrape,
}: OgPreviewSidebarProps) {
  const visiblePlatforms = platforms.filter((p) => OG_PLATFORMS.includes(p))
  const [activeTab, setActiveTab] = useState<Provider>(
    visiblePlatforms[0] ?? 'facebook',
  )
  const [isPending, startTransition] = useTransition()

  if (visiblePlatforms.length === 0) {
    return null
  }

  const badges = computeOgBadges(ogData)

  // Cache status
  const isCached = ogData?.scrapedAt != null
  const cacheAge = ogData?.scrapedAt
    ? Math.floor(
        (Date.now() - new Date(ogData.scrapedAt).getTime()) / (1000 * 60 * 60 * 24),
      )
    : null
  const isCacheStale = cacheAge != null && cacheAge > 7

  function handleForceRescrape() {
    if (postId) {
      startTransition(async () => {
        await scrapeOgTags(postId)
        onForceRescrape?.()
      })
    }
  }

  return (
    <div className="sticky top-20 w-[380px] shrink-0 space-y-4">
      {/* Platform tabs */}
      <div className="flex border-b border-cms-border">
        {visiblePlatforms.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setActiveTab(p)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium ${
              activeTab === p
                ? 'border-b-2 border-cms-accent text-cms-accent'
                : 'text-cms-text-muted hover:text-cms-text'
            }`}
          >
            <PlatformIcon provider={p} size="sm" />
            {platformLabel(p)}
          </button>
        ))}
      </div>

      {/* Card preview */}
      <div className="rounded-lg border border-cms-border bg-cms-surface p-3">
        {activeTab === 'facebook' && (
          <OgFacebookCard
            imageUrl={ogData?.image ?? null}
            title={ogData?.title ?? ''}
            description={ogData?.description ?? ''}
            domain={ogData?.domain ?? ''}
          />
        )}
        {activeTab === 'bluesky' && (
          <OgBlueskyCard
            imageUrl={ogData?.image ?? null}
            title={ogData?.title ?? ''}
            description={ogData?.description ?? ''}
            domain={ogData?.domain ?? ''}
          />
        )}
        {activeTab === 'instagram' && (
          <OgInstagramPreview
            imageUrl={ogData?.image ?? null}
            title={ogData?.title ?? ''}
          />
        )}
      </div>

      {/* Validation badges */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium uppercase tracking-wider text-cms-text-muted">
          Validation
        </p>
        <div className="flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <span
              key={badge.label}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SEVERITY_COLORS[badge.severity]}`}
            >
              {badge.label}
            </span>
          ))}
        </div>
      </div>

      {/* Scrape status footer */}
      <div className="flex items-center justify-between border-t border-cms-border pt-3">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isCached && !isCacheStale ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <span className="text-xs text-cms-text-muted">
            {isCached && !isCacheStale
              ? `Cached (${cacheAge}d ago)`
              : 'Not scraped'}
          </span>
        </div>

        {postId && (
          <button
            type="button"
            onClick={handleForceRescrape}
            disabled={isPending}
            className="rounded-md border border-cms-border px-2.5 py-1 text-[10px] font-medium text-cms-text hover:bg-cms-surface disabled:opacity-50"
          >
            {isPending ? 'Scraping...' : 'Force Scrape'}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Integrate sidebar into ComposerShell layout**

Modify `apps/web/src/app/cms/(authed)/social/new/_components/composer-shell.tsx`:

1. Import `OgPreviewSidebar` and its `OgData` type
2. Add state: `const [ogData, setOgData] = useState<OgData | null>(null)`
3. When `selectedContent` changes, derive `ogData` from it:

```typescript
useEffect(() => {
  if (!selectedContent) {
    setOgData(null)
    return
  }
  const domain = selectedContent.url
    ? new URL(selectedContent.url).hostname
    : ''
  setOgData({
    title: selectedContent.title,
    description: selectedContent.excerpt ?? '',
    image: selectedContent.image,
    domain,
  })
}, [selectedContent])
```

4. Wrap the existing `<div className="space-y-6">` body with a flex container when content is selected:

```typescript
return (
  <div className="flex gap-6">
    {/* Main form column */}
    <div className="min-w-0 flex-1 space-y-6">
      {/* ... existing content (ContentPicker, OgCompact, captions, etc.) ... */}
    </div>

    {/* OG Preview Sidebar (only in CMS mode with selected content) */}
    {sourceMode === 'cms' && selectedContent && platforms.length > 0 && (
      <OgPreviewSidebar
        platforms={platforms}
        ogData={ogData}
        onForceRescrape={() => {
          // Re-derive from selectedContent
        }}
      />
    )}
  </div>
)
```

- [ ] **Step 6: Run tests and verify**

```bash
npm run test:web -- --run apps/web/test/cms/social-composer
```

Ensure all existing composer tests pass. The sidebar is conditionally rendered so it does not affect tests that mock minimal props.

- [ ] **Step 7: Commit**

```
feat(social): OG preview sidebar with per-platform card rendering and validation badges
```

---

### Task 12: Pre-Publish Confirmation Dialog

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/new/_components/publish-confirmation-dialog.tsx`
- Modify: `apps/web/src/app/cms/(authed)/social/new/_components/composer-shell.tsx` — wire handlePublish to show dialog
- Create: `apps/web/test/publish-confirmation.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/test/publish-confirmation.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'

describe('PublishConfirmationDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    platforms: ['facebook', 'bluesky'] as const,
    captions: {
      facebook: { pt: '{{title}}\n\n{{link}}' },
      bluesky: { pt: '{{title}}\n\n{{link}}' },
    },
    contentTitle: 'Test Post Title',
    contentUrl: 'https://example.com/post',
    shortUrl: 'go.btf.com/abc123',
    ogData: {
      title: 'Test Post Title',
      description: 'A test description',
      image: 'https://example.com/og.jpg',
      domain: 'example.com',
    },
    isLoading: false,
    activeLang: 'pt' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders resolved captions per platform', async () => {
    const { PublishConfirmationDialog } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-confirmation-dialog'
    )
    render(<PublishConfirmationDialog {...defaultProps} />)
    // Should show resolved title instead of {{title}}
    expect(screen.getByText(/Test Post Title/)).toBeDefined()
    // Should show resolved short URL instead of {{link}}
    expect(screen.getByText(/go\.btf\.com\/abc123/)).toBeDefined()
  })

  it('shows platform badges with green for auto-post', async () => {
    const { PublishConfirmationDialog } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-confirmation-dialog'
    )
    const { container } = render(<PublishConfirmationDialog {...defaultProps} />)
    const badges = container.querySelectorAll('[data-testid="platform-badge"]')
    expect(badges.length).toBe(2)
  })

  it('shows amber badge for Instagram Design mode', async () => {
    const { PublishConfirmationDialog } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-confirmation-dialog'
    )
    const { container } = render(
      <PublishConfirmationDialog
        {...defaultProps}
        platforms={['instagram']}
        captions={{ instagram: { pt: '{{title}}\n\nLink na bio' } }}
        instagramMode="design"
      />,
    )
    const badge = container.querySelector('[data-testid="platform-badge"]')
    expect(badge?.textContent).toContain('Notification')
  })

  it('calls onClose when Cancel is clicked', async () => {
    const { PublishConfirmationDialog } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-confirmation-dialog'
    )
    render(<PublishConfirmationDialog {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('calls onConfirm when Confirm is clicked', async () => {
    const { PublishConfirmationDialog } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-confirmation-dialog'
    )
    render(<PublishConfirmationDialog {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    expect(defaultProps.onConfirm).toHaveBeenCalled()
  })

  it('disables Confirm button when loading', async () => {
    const { PublishConfirmationDialog } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-confirmation-dialog'
    )
    render(<PublishConfirmationDialog {...defaultProps} isLoading={true} />)
    const btn = screen.getByRole('button', { name: /confirmar/i })
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('shows warning for missing OG image', async () => {
    const { PublishConfirmationDialog } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-confirmation-dialog'
    )
    render(
      <PublishConfirmationDialog
        {...defaultProps}
        ogData={{ ...defaultProps.ogData, image: null }}
      />,
    )
    expect(screen.getByText(/og:image missing/i)).toBeDefined()
  })
})
```

Run: `npm run test:web -- --run apps/web/test/publish-confirmation.test.ts`

Expected: All tests fail (module not found).

- [ ] **Step 2: Implement PublishConfirmationDialog**

Create `apps/web/src/app/cms/(authed)/social/new/_components/publish-confirmation-dialog.tsx`:

```typescript
'use client'

import type { Provider } from '@tn-figueiredo/social'
import {
  PlatformIcon,
  platformLabel,
} from '@/app/cms/(authed)/_shared/social/platform-icon'
import type { OgData } from './og-preview-sidebar'
import { OgFacebookCard } from './og-facebook-card'
import { OgBlueskyCard } from './og-bluesky-card'

// ---------------------------------------------------------------------------
// Variable resolution for confirmation
// ---------------------------------------------------------------------------

const VARIABLE_REGEX = /\{\{(link|title|url)\}\}/g

function resolveCaption(
  template: string,
  title: string,
  shortUrl: string,
  rawUrl: string,
): string {
  return template.replace(VARIABLE_REGEX, (_match, varName: string) => {
    switch (varName) {
      case 'link':
        return shortUrl
      case 'title':
        return title
      case 'url':
        return rawUrl
      default:
        return _match
    }
  })
}

// ---------------------------------------------------------------------------
// Char limits (duplicated from caption-tabs for self-containment)
// ---------------------------------------------------------------------------

const CHAR_LIMITS: Record<string, number> = {
  facebook: 63_206,
  instagram: 2_200,
  bluesky: 300,
  youtube: 5_000,
}

// ---------------------------------------------------------------------------
// Platform delivery mode badge
// ---------------------------------------------------------------------------

type DeliveryMode = 'auto' | 'notification'

function getDeliveryMode(
  platform: Provider,
  instagramMode?: 'quick' | 'design',
): DeliveryMode {
  if (platform === 'instagram' && instagramMode === 'design') {
    return 'notification'
  }
  return 'auto'
}

const MODE_LABELS: Record<DeliveryMode, string> = {
  auto: 'Auto-post',
  notification: 'Notification',
}

const MODE_COLORS: Record<DeliveryMode, string> = {
  auto: 'text-emerald-400 bg-emerald-500/10',
  notification: 'text-amber-400 bg-amber-500/10',
}

// ---------------------------------------------------------------------------
// OG warnings
// ---------------------------------------------------------------------------

interface OgWarning {
  label: string
  severity: 'red' | 'amber'
}

function getOgWarnings(ogData: OgData | null): OgWarning[] {
  if (!ogData) return [{ label: 'OG metadata not available', severity: 'amber' }]
  const warnings: OgWarning[] = []
  if (!ogData.image) {
    warnings.push({ label: 'og:image missing', severity: 'red' })
  }
  if (!ogData.title) {
    warnings.push({ label: 'og:title missing', severity: 'red' })
  }
  return warnings
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PublishConfirmationDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  platforms: readonly Provider[]
  captions: Record<string, Record<string, string>>
  contentTitle: string
  contentUrl: string
  shortUrl: string
  ogData: OgData | null
  isLoading: boolean
  activeLang?: string
  instagramMode?: 'quick' | 'design'
}

export function PublishConfirmationDialog({
  open,
  onClose,
  onConfirm,
  platforms,
  captions,
  contentTitle,
  contentUrl,
  shortUrl,
  ogData,
  isLoading,
  activeLang = 'pt',
  instagramMode = 'quick',
}: PublishConfirmationDialogProps) {
  if (!open) return null

  const ogWarnings = getOgWarnings(ogData)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-cms-border bg-cms-surface shadow-2xl">
        {/* Header */}
        <div className="border-b border-cms-border px-6 py-4">
          <h2 className="text-lg font-semibold text-cms-text">
            Confirmar Publicacao
          </h2>
          <p className="text-sm text-cms-text-muted">
            Revise o conteudo antes de publicar em {platforms.length} plataforma
            {platforms.length > 1 ? 's' : ''}.
          </p>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-4">
          {/* Warnings */}
          {ogWarnings.length > 0 && (
            <div className="space-y-1">
              {ogWarnings.map((w) => (
                <div
                  key={w.label}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium ${
                    w.severity === 'red'
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-amber-500/10 text-amber-400'
                  }`}
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01"
                    />
                  </svg>
                  {w.label}
                </div>
              ))}
            </div>
          )}

          {/* Per-platform resolved captions */}
          {platforms.map((p) => {
            const template = captions[p]?.[activeLang] ?? ''
            const resolved = resolveCaption(
              template,
              contentTitle,
              shortUrl,
              contentUrl,
            )
            const charLimit = CHAR_LIMITS[p] ?? 63_206
            const isOver = resolved.length > charLimit
            const deliveryMode = getDeliveryMode(p, instagramMode)

            return (
              <div
                key={p}
                className="rounded-lg border border-cms-border bg-cms-bg p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PlatformIcon provider={p} size="sm" />
                    <span className="text-sm font-medium capitalize text-cms-text">
                      {platformLabel(p)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      data-testid="platform-badge"
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${MODE_COLORS[deliveryMode]}`}
                    >
                      {MODE_LABELS[deliveryMode]}
                    </span>
                    <span
                      className={`text-[10px] ${isOver ? 'text-red-400' : 'text-cms-text-muted'}`}
                    >
                      {resolved.length}/{charLimit}
                    </span>
                  </div>
                </div>

                <p className="whitespace-pre-wrap font-mono text-xs text-cms-text">
                  {resolved}
                </p>

                {isOver && (
                  <p className="mt-1 text-[10px] text-red-400">
                    Caption exceeds {platformLabel(p)} limit by{' '}
                    {resolved.length - charLimit} characters
                  </p>
                )}
              </div>
            )
          })}

          {/* OG Card Preview */}
          {ogData && (
            <div className="rounded-lg border border-cms-border bg-cms-bg p-4">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-cms-text-muted">
                Link Card Preview
              </p>
              <div className="grid grid-cols-2 gap-3">
                {platforms.includes('facebook') && (
                  <OgFacebookCard
                    imageUrl={ogData.image}
                    title={ogData.title}
                    description={ogData.description}
                    domain={ogData.domain}
                  />
                )}
                {platforms.includes('bluesky') && (
                  <OgBlueskyCard
                    imageUrl={ogData.image}
                    title={ogData.title}
                    description={ogData.description}
                    domain={ogData.domain}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-cms-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-cms-border px-4 py-2 text-sm font-medium text-cms-text hover:bg-cms-surface"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-md bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isLoading ? 'Publicando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

Run: `npm run test:web -- --run apps/web/test/publish-confirmation.test.ts`

Expected: All tests pass.

- [ ] **Step 3: Wire the dialog into ComposerShell's handlePublish**

Modify `apps/web/src/app/cms/(authed)/social/new/_components/composer-shell.tsx`:

1. Import `PublishConfirmationDialog` and `ensureTrackedLink`
2. Add state:

```typescript
const [showConfirmation, setShowConfirmation] = useState(false)
const [confirmationShortUrl, setConfirmationShortUrl] = useState<string | null>(null)
const [confirmationLinkId, setConfirmationLinkId] = useState<string | null>(null)
const [isPrePublishLoading, setIsPrePublishLoading] = useState(false)
```

3. Replace `handlePublish` with a two-phase flow:

```typescript
async function handlePrePublish() {
  setSubmitError(null)
  if (!validate()) return

  if (sourceMode === 'cms' && selectedContent) {
    setIsPrePublishLoading(true)
    try {
      // JIT short link creation + OG fetch in parallel
      // For now, show dialog with placeholder link until Phase 1
      // provides the server action for JIT link creation
      setConfirmationShortUrl(
        `${process.env.NEXT_PUBLIC_SHORT_DOMAIN ?? 'go.btf.com'}/______`,
      )
      setShowConfirmation(true)
    } catch (err) {
      setSubmitError('Erro ao preparar publicacao')
    } finally {
      setIsPrePublishLoading(false)
    }
  } else {
    // Freeform mode: publish directly (no confirmation for now)
    handlePublishConfirm()
  }
}

async function handlePublishConfirm() {
  setShowConfirmation(false)
  handlePublish()
}

async function handlePublishCancel() {
  setShowConfirmation(false)
  // If a short link was created, soft-delete it
  if (confirmationLinkId) {
    // Deactivate via deactivateSourceLinks (best-effort)
    setConfirmationLinkId(null)
    setConfirmationShortUrl(null)
  }
}
```

4. Update the `ScheduleBar` to call `handlePrePublish` instead of `handlePublish`:

```typescript
<ScheduleBar
  ...
  onPublish={handlePrePublish}
  ...
/>
```

5. Add the dialog at the end of the return JSX:

```typescript
{showConfirmation && selectedContent && (
  <PublishConfirmationDialog
    open={showConfirmation}
    onClose={handlePublishCancel}
    onConfirm={handlePublishConfirm}
    platforms={platforms}
    captions={captions}
    contentTitle={selectedContent.title}
    contentUrl={selectedContent.url ?? url}
    shortUrl={confirmationShortUrl ?? ''}
    ogData={ogData}
    isLoading={isPending}
  />
)}
```

- [ ] **Step 4: Run tests and verify**

```bash
npm run test:web -- --run apps/web/test/publish-confirmation.test.ts
npm run test:web -- --run apps/web/test/cms/social-composer
```

- [ ] **Step 5: Commit**

```
feat(social): pre-publish confirmation dialog with resolved captions and OG preview
```

---

### Task 13: Template Carousel in Composer

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/new/_components/template-carousel.tsx`
- Modify: `apps/web/src/app/cms/(authed)/social/new/_components/composer-shell.tsx` — add carousel below caption

- [ ] **Step 1: Implement TemplateCarousel component**

Create `apps/web/src/app/cms/(authed)/social/new/_components/template-carousel.tsx`:

```typescript
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Template {
  id: string
  name: string
  aspect_ratio: '9:16' | '1:1' | '16:9'
  thumbnail_url: string | null
  is_default: boolean
}

interface TemplateCarouselProps {
  templates: Template[]
  selectedId: string | null
  onSelect: (templateId: string) => void
  isLoading?: boolean
}

// ---------------------------------------------------------------------------
// Aspect ratio to platform compatibility
// ---------------------------------------------------------------------------

export const PLATFORM_ASPECT_RATIOS: Record<string, string[]> = {
  facebook: ['16:9'],
  bluesky: ['16:9'],
  instagram: ['9:16', '1:1'],
  youtube: ['16:9'],
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateCarousel({
  templates,
  selectedId,
  onSelect,
  isLoading = false,
}: TemplateCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    updateScrollButtons()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollButtons, { passive: true })
    const ro = new ResizeObserver(updateScrollButtons)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollButtons)
      ro.disconnect()
    }
  }, [updateScrollButtons, templates])

  function scroll(direction: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    const distance = 200
    el.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    })
  }

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const idx = templates.findIndex((t) => t.id === selectedId)
      if (idx > 0) onSelect(templates[idx - 1]!.id)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      const idx = templates.findIndex((t) => t.id === selectedId)
      if (idx < templates.length - 1) onSelect(templates[idx + 1]!.id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 w-36 shrink-0 animate-pulse rounded-lg bg-cms-border/30"
          />
        ))}
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <p className="py-2 text-center text-xs text-cms-text-muted">
        Nenhum template disponivel para esta plataforma
      </p>
    )
  }

  return (
    <div className="relative" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Left arrow */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll('left')}
          aria-label="Previous templates"
          className="absolute -left-3 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-cms-border bg-cms-surface shadow-md"
        >
          <svg
            className="h-4 w-4 text-cms-text"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      )}

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto py-1 scrollbar-none"
        role="listbox"
        aria-label="Template selection"
      >
        {templates.map((tmpl) => {
          const isSelected = tmpl.id === selectedId
          return (
            <button
              key={tmpl.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelect(tmpl.id)}
              className={`group relative shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/30'
                  : 'border-cms-border hover:border-cms-accent/50'
              }`}
            >
              {/* Thumbnail */}
              <div
                className={`flex items-center justify-center bg-cms-bg ${
                  tmpl.aspect_ratio === '9:16'
                    ? 'h-28 w-16'
                    : tmpl.aspect_ratio === '1:1'
                      ? 'h-24 w-24'
                      : 'h-16 w-28'
                }`}
              >
                {tmpl.thumbnail_url ? (
                  <img
                    src={tmpl.thumbnail_url}
                    alt={tmpl.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cms-accent/20 to-cms-accent/5">
                    <span className="text-[9px] font-medium text-cms-text-muted">
                      {tmpl.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Name label */}
              <div className="px-1.5 py-1">
                <p className="truncate text-[10px] font-medium text-cms-text">
                  {tmpl.name}
                </p>
              </div>

              {/* Default star */}
              {tmpl.is_default && (
                <span className="absolute right-1 top-1 text-[10px] text-amber-400">
                  ★
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Right arrow */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll('right')}
          aria-label="Next templates"
          className="absolute -right-3 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-cms-border bg-cms-surface shadow-md"
        >
          <svg
            className="h-4 w-4 text-cms-text"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Integrate carousel into ComposerShell**

Modify `apps/web/src/app/cms/(authed)/social/new/_components/composer-shell.tsx`:

1. Import `TemplateCarousel` and `PLATFORM_ASPECT_RATIOS`
2. Add state:

```typescript
const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
const [templates, setTemplates] = useState<Array<{
  id: string; name: string; aspect_ratio: '9:16' | '1:1' | '16:9';
  thumbnail_url: string | null; is_default: boolean;
}>>([])
const [templatesLoading, setTemplatesLoading] = useState(false)
```

3. Fetch templates when platforms change (the server action `listTemplates` comes from Phase 2; for now use a stub that returns empty until Phase 2 is implemented):

```typescript
useEffect(() => {
  if (platforms.length === 0) return
  // Determine compatible aspect ratios from selected platforms
  const ratios = new Set<string>()
  for (const p of platforms) {
    const platformRatios = PLATFORM_ASPECT_RATIOS[p] ?? []
    for (const r of platformRatios) ratios.add(r)
  }
  // TODO: Replace with listTemplates() from Phase 2
  setTemplates([])
}, [platforms])
```

4. Render the carousel below the caption tabs:

```typescript
{sourceMode === 'cms' && selectedContent && platforms.length > 0 && (
  <>
    <CaptionTabs ... />

    {/* Template Carousel */}
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-cms-text-muted">
        Template
      </p>
      <TemplateCarousel
        templates={templates}
        selectedId={selectedTemplateId}
        onSelect={setSelectedTemplateId}
        isLoading={templatesLoading}
      />
    </div>
  </>
)}
```

- [ ] **Step 3: Run tests and verify**

```bash
npm run test:web -- --run apps/web/test/cms/social-composer
```

- [ ] **Step 4: Commit**

```
feat(social): template carousel with horizontal scroll and keyboard navigation
```

---

### Task 14: Duplicate Detection

**Files:**
- Create: `apps/web/src/lib/social/duplicate-detection.ts`
- Modify: `apps/web/src/app/cms/(authed)/social/new/_components/composer-shell.tsx` — show warnings
- Create: `apps/web/test/duplicate-detection.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/test/duplicate-detection.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase
const mockSelect = vi.fn()
const mockFrom = vi.fn(() => ({
  select: mockSelect,
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

describe('duplicate-detection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty when no existing posts', async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            data: [],
            error: null,
          }),
        }),
      }),
    })

    const { checkDuplicates } = await import(
      '@/lib/social/duplicate-detection'
    )

    const result = await checkDuplicates(
      { from: mockFrom } as never,
      'blog',
      'content-123',
    )

    expect(result.hasDuplicates).toBe(false)
    expect(result.posts).toEqual([])
  })

  it('detects same-content same-platform duplicate', async () => {
    const existingPosts = [
      {
        id: 'post-1',
        platform: 'facebook',
        status: 'completed',
        published_at: '2026-05-15T10:00:00Z',
      },
    ]

    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            data: existingPosts,
            error: null,
          }),
        }),
      }),
    })

    const { checkDuplicates, getDuplicateWarnings } = await import(
      '@/lib/social/duplicate-detection'
    )

    const result = await checkDuplicates(
      { from: mockFrom } as never,
      'blog',
      'content-123',
    )

    expect(result.hasDuplicates).toBe(true)
    expect(result.posts).toHaveLength(1)

    const warnings = getDuplicateWarnings(result.posts, ['facebook'])
    expect(warnings.samePlatformPosts).toHaveLength(1)
    expect(warnings.samePlatformPosts[0]!.platform).toBe('facebook')
    expect(warnings.severity).toBe('confirm')
  })

  it('allows cross-platform posting without confirmation', async () => {
    const existingPosts = [
      {
        id: 'post-1',
        platform: 'facebook',
        status: 'completed',
        published_at: '2026-05-15T10:00:00Z',
      },
    ]

    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            data: existingPosts,
            error: null,
          }),
        }),
      }),
    })

    const { checkDuplicates, getDuplicateWarnings } = await import(
      '@/lib/social/duplicate-detection'
    )

    const result = await checkDuplicates(
      { from: mockFrom } as never,
      'blog',
      'content-123',
    )

    // Posting to bluesky (different platform) — warning only, no confirmation needed
    const warnings = getDuplicateWarnings(result.posts, ['bluesky'])
    expect(warnings.samePlatformPosts).toHaveLength(0)
    expect(warnings.severity).toBe('warning')
  })

  it('returns severity "none" when no duplicates at all', async () => {
    const { getDuplicateWarnings } = await import(
      '@/lib/social/duplicate-detection'
    )

    const warnings = getDuplicateWarnings([], ['facebook', 'bluesky'])
    expect(warnings.severity).toBe('none')
    expect(warnings.totalExisting).toBe(0)
  })
})
```

Run: `npm run test:web -- --run apps/web/test/duplicate-detection.test.ts`

Expected: All tests fail (module not found).

- [ ] **Step 2: Implement duplicate detection module**

Create `apps/web/src/lib/social/duplicate-detection.ts`:

```typescript
// apps/web/src/lib/social/duplicate-detection.ts
//
// Detects existing social posts for the same CMS content.
// Used at Composer load time (CMS mode) to warn users about
// potential duplicate postings per spec Section 6.8.

import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExistingPost {
  id: string
  platform: string
  status: string
  published_at: string | null
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean
  posts: ExistingPost[]
}

export type DuplicateSeverity = 'none' | 'warning' | 'confirm'

export interface DuplicateWarnings {
  /** All existing posts for this content (any platform) */
  totalExisting: number
  /** Existing posts on the same platform(s) the user selected */
  samePlatformPosts: ExistingPost[]
  /** Severity: 'none' = no duplicates, 'warning' = cross-platform only, 'confirm' = same-platform */
  severity: DuplicateSeverity
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/**
 * Queries social_posts for existing posts linked to the same content.
 * Excludes cancelled and failed posts (they don't count as duplicates).
 */
export async function checkDuplicates(
  supabase: SupabaseClient,
  sourceType: string,
  sourceId: string,
): Promise<DuplicateCheckResult> {
  const { data, error } = await supabase
    .from('social_posts')
    .select('id, platform, status, published_at')
    .eq('source_content_type', sourceType)
    .eq('source_content_id', sourceId)
    .not('status', 'in', '("cancelled","failed")')

  if (error || !data) {
    return { hasDuplicates: false, posts: [] }
  }

  const posts: ExistingPost[] = data.map((row) => ({
    id: row.id as string,
    platform: row.platform as string,
    status: row.status as string,
    published_at: row.published_at as string | null,
  }))

  return {
    hasDuplicates: posts.length > 0,
    posts,
  }
}

// ---------------------------------------------------------------------------
// Warning computation (client-side, no DB access needed)
// ---------------------------------------------------------------------------

/**
 * Given existing posts and the platforms the user wants to post to,
 * computes the appropriate warning level.
 *
 * - Same content, same platform = 'confirm' (requires explicit confirmation)
 * - Same content, different platform = 'warning' (informational banner)
 * - No existing posts = 'none'
 */
export function getDuplicateWarnings(
  existingPosts: ExistingPost[],
  targetPlatforms: string[],
): DuplicateWarnings {
  if (existingPosts.length === 0) {
    return {
      totalExisting: 0,
      samePlatformPosts: [],
      severity: 'none',
    }
  }

  const samePlatformPosts = existingPosts.filter((p) =>
    targetPlatforms.includes(p.platform),
  )

  const severity: DuplicateSeverity =
    samePlatformPosts.length > 0 ? 'confirm' : 'warning'

  return {
    totalExisting: existingPosts.length,
    samePlatformPosts,
    severity,
  }
}
```

Run: `npm run test:web -- --run apps/web/test/duplicate-detection.test.ts`

Expected: All tests pass.

- [ ] **Step 3: Add duplicate detection server action**

Add to `apps/web/src/lib/social/actions.ts` (or a nearby actions file):

```typescript
export async function checkContentDuplicates(
  contentType: string,
  contentId: string,
): Promise<ActionResult<{ posts: Array<{ id: string; platform: string; status: string; published_at: string | null }> }>> {
  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const { data, error } = await supabase
      .from('social_posts')
      .select('id, platform, status, published_at')
      .eq('site_id', siteId)
      .eq('source_content_type', contentType)
      .eq('source_content_id', contentId)
      .not('status', 'in', '("cancelled","failed")')

    if (error) {
      return { ok: false, error: 'Failed to check duplicates' }
    }

    return {
      ok: true,
      data: {
        posts: (data ?? []).map((row) => ({
          id: row.id as string,
          platform: row.platform as string,
          status: row.status as string,
          published_at: row.published_at as string | null,
        })),
      },
    }
  } catch (err) {
    return { ok: false, error: 'Failed to check duplicates' }
  }
}
```

- [ ] **Step 4: Integrate duplicate warnings into ComposerShell**

Modify `apps/web/src/app/cms/(authed)/social/new/_components/composer-shell.tsx`:

1. Import `checkContentDuplicates` from actions and `getDuplicateWarnings`, `type ExistingPost`, `type DuplicateWarnings` from `duplicate-detection.ts`
2. Add state:

```typescript
const [duplicateWarnings, setDuplicateWarnings] = useState<DuplicateWarnings | null>(null)
const [existingPosts, setExistingPosts] = useState<ExistingPost[]>([])
```

3. Check for duplicates when content is selected:

```typescript
useEffect(() => {
  if (!selectedContent) {
    setDuplicateWarnings(null)
    setExistingPosts([])
    return
  }

  checkContentDuplicates(
    selectedContent.contentType,
    selectedContent.contentId,
  ).then((result) => {
    if (result.ok) {
      setExistingPosts(result.data.posts)
    }
  })
}, [selectedContent])

// Recompute warnings when platforms change
useEffect(() => {
  if (existingPosts.length === 0) {
    setDuplicateWarnings(null)
    return
  }
  const warnings = getDuplicateWarnings(existingPosts, platforms)
  setDuplicateWarnings(warnings)
}, [existingPosts, platforms])
```

4. Render the warning banner after the content preview:

```typescript
{/* Duplicate detection warnings */}
{duplicateWarnings && duplicateWarnings.severity !== 'none' && (
  <div
    className={`flex items-start gap-2 rounded-lg border px-4 py-3 ${
      duplicateWarnings.severity === 'confirm'
        ? 'border-amber-500/30 bg-amber-500/[0.08]'
        : 'border-blue-500/30 bg-blue-500/[0.08]'
    }`}
  >
    <svg
      className={`mt-0.5 h-4 w-4 shrink-0 ${
        duplicateWarnings.severity === 'confirm'
          ? 'text-amber-400'
          : 'text-blue-400'
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
      />
    </svg>
    <div className="flex-1">
      <p className="text-sm font-medium text-cms-text">
        {duplicateWarnings.severity === 'confirm'
          ? `Este conteudo ja tem post(s) no ${
              duplicateWarnings.samePlatformPosts
                .map((p) => p.platform)
                .join(', ')
            }`
          : `Este conteudo ja tem ${duplicateWarnings.totalExisting} post(s) social ativo(s)`}
      </p>
      <p className="text-xs text-cms-text-muted">
        {duplicateWarnings.severity === 'confirm'
          ? 'Sera necessario confirmar antes de publicar nessa plataforma novamente.'
          : 'Cross-posting para outras plataformas e permitido normalmente.'}
      </p>
      {duplicateWarnings.totalExisting > 0 && (
        <a
          href="/cms/social"
          className="mt-1 inline-block text-xs text-cms-accent hover:underline"
        >
          Ver posts existentes
        </a>
      )}
    </div>
  </div>
)}
```

5. In the `handlePrePublish` function, if `duplicateWarnings.severity === 'confirm'`, show a confirmation dialog before proceeding to the standard publish confirmation:

```typescript
async function handlePrePublish() {
  setSubmitError(null)
  if (!validate()) return

  // Same-platform duplicate check
  if (
    duplicateWarnings?.severity === 'confirm' &&
    !window.confirm(
      `Um post para ${duplicateWarnings.samePlatformPosts
        .map((p) => p.platform)
        .join(', ')} ja existe para este conteudo. Criar outro?`,
    )
  ) {
    return
  }

  // ... proceed with pre-publish flow (from Task 12)
}
```

- [ ] **Step 5: Run all tests**

```bash
npm run test:web -- --run apps/web/test/duplicate-detection.test.ts
npm run test:web -- --run apps/web/test/cms/social-composer
```

- [ ] **Step 6: Commit**

```
feat(social): duplicate detection with same-platform confirmation and cross-post warnings
```

---

## Final Verification

After all 5 tasks are complete:

```bash
npm run test:web
```

All existing tests plus the 3 new test files must pass before marking Phase 3 as done.
