# Global Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the global header matching the design spec at 98/100 visual similarity — two-layer header (fixed top strip + sticky main header), SVG brand wordmark, page-context-aware CTAs & nav, theme toggle, mobile hamburger drawer, dark/light theme support.

**Architecture:** Server-rendered layout mounts `<TopStrip>` + `<GlobalHeader>` replacing `<PinboardHeader>`. GlobalHeader receives context props (`locale`, `currentTheme`, `current`, `variant`, `ctas`) and renders Brand + Nav + CTAs + ThemeToggle on desktop, hamburger drawer on mobile. All components are pure presentational — no data fetching.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, TypeScript 5, Vitest + @testing-library/react (happy-dom)

---

## File Structure

| File | Responsibility | New/Modify |
|---|---|---|
| `src/components/layout/header-types.ts` | Shared types & constants (nav items, YT channels, locale helpers) | New |
| `src/components/layout/top-strip.tsx` | Fixed language pill strip (z-999, 44px) | New |
| `src/components/layout/header-ctas.tsx` | Page-context CTA buttons (home/archive/post variants) | New |
| `src/components/layout/theme-toggle.tsx` | Restyled theme toggle (dashed border, pinboard aesthetic) | New |
| `src/components/layout/mobile-nav-drawer.tsx` | Hamburger drawer with nav + CTAs | New |
| `src/components/layout/global-header.tsx` | Main header: Brand + Nav + CTAs + ThemeToggle + Mobile | New |
| `src/components/layout/index.ts` | Re-exports for clean imports | New |
| `src/components/brand/brand-wordmark.tsx` | SVG wordmark component (inline, theme-reactive) | New |
| `test/components/layout/top-strip.test.tsx` | Tests for TopStrip | New |
| `test/components/layout/header-ctas.test.tsx` | Tests for HeaderCTAs | New |
| `test/components/layout/theme-toggle.test.tsx` | Tests for ThemeToggle | New |
| `test/components/layout/mobile-nav-drawer.test.tsx` | Tests for MobileNavDrawer | New |
| `test/components/layout/global-header.test.tsx` | Tests for GlobalHeader | New |
| `test/components/brand/brand-wordmark.test.tsx` | Tests for BrandWordmark | New |
| `src/app/(public)/layout.tsx` | Wire TopStrip + GlobalHeader, remove PinboardHeader | Modify |
| `src/app/(public)/components/PinboardHeader.tsx` | Delete (replaced) | Delete |

---

## Parallelization Map

```
Phase 1 (parallel — 6 tracks):
  Track A: header-types.ts (shared types & constants)
  Track B: top-strip.tsx + test
  Track C: header-ctas.tsx + test
  Track D: theme-toggle.tsx + test
  Track E: brand-wordmark.tsx + test
  Track F: locale additions (en.json + pt-BR.json)

Phase 2 (parallel — 2 tracks, depends on Phase 1):
  Track G: mobile-nav-drawer.tsx + test
  Track H: global-header.tsx + test

Phase 3 (sequential, depends on Phase 2):
  Track I: layout.tsx integration + PinboardHeader deletion + final test run
```

---

### Task 1: Shared Types & Constants (`header-types.ts`)

**Files:**
- Create: `apps/web/src/components/layout/header-types.ts`

- [ ] **Step 1: Create the shared types file**

```typescript
// apps/web/src/components/layout/header-types.ts

export type HeaderLocale = 'en' | 'pt-BR'
export type HeaderTheme = 'dark' | 'light'
export type HeaderCurrent = 'home' | 'writing' | 'videos' | 'newsletters' | 'about' | 'contact'
export type HeaderVariant = 'full' | 'reduced'
export type HeaderCtaVariant = 'home' | 'archive' | 'post'

export type GlobalHeaderProps = {
  locale: HeaderLocale
  currentTheme: HeaderTheme
  current: HeaderCurrent
  variant: HeaderVariant
  ctas: HeaderCtaVariant
  t: Record<string, string>
}

export type NavItem = {
  key: string
  href: string
  label: string
  external?: boolean
}

export const YT_CHANNELS: Record<HeaderLocale, { url: string; flag: string }> = {
  'pt-BR': { url: 'https://youtube.com/@bythiagofigueiredo', flag: '🇧🇷' },
  en: { url: 'https://youtube.com/@thiagofigueiredo', flag: '🇺🇸' },
}

export function buildNavItems(
  locale: HeaderLocale,
  variant: HeaderVariant,
  t: Record<string, string>,
): NavItem[] {
  const home = locale === 'pt-BR' ? '/pt-BR' : '/'
  const items: NavItem[] = [
    { key: 'home', href: home, label: t['nav.home'] },
    { key: 'writing', href: `/blog/${locale === 'pt-BR' ? 'pt-BR' : 'en'}`, label: t['nav.writing'] },
    { key: 'videos', href: YT_CHANNELS[locale].url, label: t['nav.videos'], external: true },
    { key: 'newsletters', href: locale === 'pt-BR' ? '/pt-BR/newsletters' : '/newsletters', label: t['nav.newsletter'] },
    { key: 'about', href: '/about', label: t['nav.about'] },
  ]

  if (variant === 'full') {
    items.push(
      { key: 'contact', href: '/contact', label: t['nav.contact'] },
      { key: 'devSite', href: 'https://dev.bythiagofigueiredo.com', label: t['nav.devSite'], external: true },
    )
  }

  return items
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors related to header-types.ts

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/header-types.ts
git commit -m "feat(header): add shared types and constants for global header"
```

---

### Task 2: TopStrip Component

**Files:**
- Create: `apps/web/src/components/layout/top-strip.tsx`
- Create: `apps/web/test/components/layout/top-strip.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/components/layout/top-strip.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TopStrip } from '../../../src/components/layout/top-strip'

describe('TopStrip', () => {
  it('renders language pill with PT and EN buttons', () => {
    render(<TopStrip locale="en" />)
    expect(screen.getByText('PT')).toBeTruthy()
    expect(screen.getByText('EN')).toBeTruthy()
  })

  it('marks the active locale button with active styling', () => {
    const { container } = render(<TopStrip locale="pt-BR" />)
    const activeBtn = container.querySelector('[data-active="true"]')
    expect(activeBtn).toBeTruthy()
    expect(activeBtn!.textContent).toBe('PT')
  })

  it('links inactive locale to the correct path', () => {
    render(<TopStrip locale="en" />)
    const ptLink = screen.getByText('PT').closest('a')
    expect(ptLink).toBeTruthy()
    expect(ptLink!.getAttribute('href')).toBe('/pt-BR')
  })

  it('links EN locale correctly when PT is active', () => {
    render(<TopStrip locale="pt-BR" />)
    const enLink = screen.getByText('EN').closest('a')
    expect(enLink).toBeTruthy()
    expect(enLink!.getAttribute('href')).toBe('/')
  })

  it('has fixed positioning', () => {
    const { container } = render(<TopStrip locale="en" />)
    const strip = container.firstElementChild as HTMLElement
    expect(strip.style.position).toBe('fixed')
  })

  it('uses z-index 999', () => {
    const { container } = render(<TopStrip locale="en" />)
    const strip = container.firstElementChild as HTMLElement
    expect(strip.style.zIndex).toBe('999')
  })

  it('uses JetBrains Mono font', () => {
    const { container } = render(<TopStrip locale="en" />)
    const pill = container.querySelector('[data-testid="lang-pill"]')
    expect(pill).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/components/layout/top-strip.test.tsx 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Write the TopStrip component**

```tsx
// apps/web/src/components/layout/top-strip.tsx
import Link from 'next/link'
import type { HeaderLocale } from './header-types'

type Props = {
  locale: HeaderLocale
}

export function TopStrip({ locale }: Props) {
  const isPt = locale === 'pt-BR'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999,
        height: 44,
        background: 'rgba(20,18,16,0.94)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 28px',
      }}
    >
      <div
        data-testid="lang-pill"
        className="font-jetbrains"
        style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 999,
          padding: 3,
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
        }}
      >
        {isPt ? (
          <span
            data-active="true"
            style={{
              background: '#F2EBDB',
              color: '#141210',
              borderRadius: 999,
              padding: '4px 10px',
              fontWeight: 600,
            }}
          >
            PT
          </span>
        ) : (
          <Link
            href="/pt-BR"
            hrefLang="pt-BR"
            style={{
              color: '#F2EBDB',
              borderRadius: 999,
              padding: '4px 10px',
              textDecoration: 'none',
            }}
          >
            PT
          </Link>
        )}
        {!isPt ? (
          <span
            data-active="true"
            style={{
              background: '#F2EBDB',
              color: '#141210',
              borderRadius: 999,
              padding: '4px 10px',
              fontWeight: 600,
            }}
          >
            EN
          </span>
        ) : (
          <Link
            href="/"
            hrefLang="en"
            style={{
              color: '#F2EBDB',
              borderRadius: 999,
              padding: '4px 10px',
              textDecoration: 'none',
            }}
          >
            EN
          </Link>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/components/layout/top-strip.test.tsx 2>&1 | tail -10`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/top-strip.tsx apps/web/test/components/layout/top-strip.test.tsx
git commit -m "feat(header): add TopStrip component with language pill toggle"
```

---

### Task 3: HeaderCTAs Component

**Files:**
- Create: `apps/web/src/components/layout/header-ctas.tsx`
- Create: `apps/web/test/components/layout/header-ctas.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/components/layout/header-ctas.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeaderCTAs } from '../../../src/components/layout/header-ctas'

describe('HeaderCTAs', () => {
  describe('home variant', () => {
    it('renders YouTube and Newsletter buttons', () => {
      render(<HeaderCTAs variant="home" locale="pt-BR" t={{ 'header.subscribe': 'Inscrever no YouTube', 'header.newsletter': 'Receber newsletter' }} />)
      expect(screen.getByText(/YouTube/)).toBeTruthy()
      expect(screen.getByText(/Newsletter/)).toBeTruthy()
    })

    it('shows 🇧🇷 flag for pt-BR locale', () => {
      render(<HeaderCTAs variant="home" locale="pt-BR" t={{ 'header.subscribe': 'Inscrever no YouTube', 'header.newsletter': 'Receber newsletter' }} />)
      expect(screen.getByText(/🇧🇷/)).toBeTruthy()
    })

    it('shows 🇺🇸 flag for en locale', () => {
      render(<HeaderCTAs variant="home" locale="en" t={{ 'header.subscribe': 'Subscribe on YouTube', 'header.newsletter': 'Get the newsletter' }} />)
      expect(screen.getByText(/🇺🇸/)).toBeTruthy()
    })

    it('YouTube button links to correct channel', () => {
      render(<HeaderCTAs variant="home" locale="pt-BR" t={{ 'header.subscribe': 'Inscrever no YouTube', 'header.newsletter': 'Receber newsletter' }} />)
      const ytLink = screen.getByText(/YouTube/).closest('a')
      expect(ytLink!.getAttribute('href')).toContain('bythiagofigueiredo')
    })

    it('Newsletter button has marker yellow background', () => {
      const { container } = render(<HeaderCTAs variant="home" locale="en" t={{ 'header.subscribe': 'Subscribe on YouTube', 'header.newsletter': 'Get the newsletter' }} />)
      const nlBtn = screen.getByText(/Newsletter/).closest('a')
      expect(nlBtn!.style.background).toBe('#FFE37A')
    })
  })

  describe('archive variant', () => {
    it('renders single NEWSLETTER button with accent background', () => {
      const { container } = render(<HeaderCTAs variant="archive" locale="en" t={{ 'header.subscribe': 'Subscribe on YouTube', 'header.newsletter': 'Get the newsletter' }} />)
      const btns = container.querySelectorAll('a')
      expect(btns).toHaveLength(1)
      expect(btns[0].textContent).toContain('NEWSLETTER')
    })

    it('uses JetBrains Mono font', () => {
      const { container } = render(<HeaderCTAs variant="archive" locale="en" t={{ 'header.subscribe': 'Subscribe on YouTube', 'header.newsletter': 'Get the newsletter' }} />)
      const btn = container.querySelector('a')
      expect(btn!.className).toContain('font-jetbrains')
    })
  })

  describe('post variant', () => {
    it('renders "Assinar" for pt-BR locale', () => {
      render(<HeaderCTAs variant="post" locale="pt-BR" t={{ 'header.subscribe': 'Inscrever no YouTube', 'header.newsletter': 'Receber newsletter' }} />)
      expect(screen.getByText('Assinar')).toBeTruthy()
    })

    it('renders "Subscribe" for en locale', () => {
      render(<HeaderCTAs variant="post" locale="en" t={{ 'header.subscribe': 'Subscribe on YouTube', 'header.newsletter': 'Get the newsletter' }} />)
      expect(screen.getByText('Subscribe')).toBeTruthy()
    })

    it('links to /newsletters', () => {
      render(<HeaderCTAs variant="post" locale="en" t={{ 'header.subscribe': 'Subscribe on YouTube', 'header.newsletter': 'Get the newsletter' }} />)
      const link = screen.getByText('Subscribe').closest('a')
      expect(link!.getAttribute('href')).toBe('/newsletters')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/components/layout/header-ctas.test.tsx 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Write the HeaderCTAs component**

```tsx
// apps/web/src/components/layout/header-ctas.tsx
import type { HeaderLocale, HeaderCtaVariant } from './header-types'
import { YT_CHANNELS } from './header-types'

type Props = {
  variant: HeaderCtaVariant
  locale: HeaderLocale
  t: Record<string, string>
}

export function HeaderCTAs({ variant, locale, t }: Props) {
  const channel = YT_CHANNELS[locale]

  if (variant === 'home') {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={channel.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t['header.subscribe']}
          className="font-jetbrains text-white no-underline"
          style={{
            background: '#FF3333',
            padding: '7px 12px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            transform: 'rotate(-1deg)',
            boxShadow: '0 2px 0 rgba(0,0,0,0.1)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M6.5 3.5v9l7-4.5z" />
          </svg>
          {channel.flag} {locale === 'pt-BR' ? 'Inscrever' : 'Subscribe'}
        </a>
        <a
          href="/newsletters"
          className="font-jetbrains no-underline"
          style={{
            background: '#FFE37A',
            color: '#1A140C',
            padding: '7px 12px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            transform: 'rotate(1deg)',
            boxShadow: '0 2px 0 rgba(0,0,0,0.1)',
            display: 'inline-block',
          }}
        >
          ✉ Newsletter
        </a>
      </div>
    )
  }

  if (variant === 'archive') {
    return (
      <div className="shrink-0">
        <a
          href="/newsletters"
          className="font-jetbrains no-underline"
          style={{
            background: 'var(--pb-accent)',
            color: '#FFF',
            border: '1.5px solid var(--pb-accent)',
            padding: '7px 12px',
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase' as const,
            fontWeight: 700,
            borderRadius: 6,
            display: 'inline-block',
          }}
        >
          ✉ NEWSLETTER
        </a>
      </div>
    )
  }

  // post variant
  return (
    <div className="shrink-0">
      <a
        href="/newsletters"
        className="font-jetbrains no-underline"
        style={{
          background: '#FFE37A',
          color: '#1A140C',
          padding: '7px 12px',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.04em',
          borderRadius: 6,
          transform: 'rotate(-1deg)',
          display: 'inline-block',
        }}
      >
        {locale === 'pt-BR' ? 'Assinar' : 'Subscribe'}
      </a>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/components/layout/header-ctas.test.tsx 2>&1 | tail -10`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/header-ctas.tsx apps/web/test/components/layout/header-ctas.test.tsx
git commit -m "feat(header): add HeaderCTAs component with home/archive/post variants"
```

---

### Task 4: ThemeToggle (Restyled)

**Files:**
- Create: `apps/web/src/components/layout/theme-toggle.tsx`
- Create: `apps/web/test/components/layout/theme-toggle.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/components/layout/theme-toggle.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeToggle } from '../../../src/components/layout/theme-toggle'

vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response())))

describe('ThemeToggle', () => {
  it('renders sun icon in dark mode', () => {
    render(<ThemeToggle currentTheme="dark" />)
    expect(screen.getByText('☀')).toBeTruthy()
  })

  it('renders moon icon in light mode', () => {
    render(<ThemeToggle currentTheme="light" />)
    expect(screen.getByText('☾')).toBeTruthy()
  })

  it('has correct aria-label for dark mode', () => {
    render(<ThemeToggle currentTheme="dark" />)
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-label')).toBe('Switch to light mode')
  })

  it('has correct aria-label for light mode', () => {
    render(<ThemeToggle currentTheme="light" />)
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-label')).toBe('Switch to dark mode')
  })

  it('has dashed border styling', () => {
    const { container } = render(<ThemeToggle currentTheme="dark" />)
    const btn = container.querySelector('button')
    expect(btn!.style.border).toContain('dashed')
  })

  it('toggles theme on click', () => {
    render(<ThemeToggle currentTheme="dark" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('☾')).toBeTruthy()
  })

  it('accepts optional size prop', () => {
    const { container } = render(<ThemeToggle currentTheme="dark" size={28} />)
    const btn = container.querySelector('button')
    expect(btn!.style.width).toBe('28px')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/components/layout/theme-toggle.test.tsx 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Write the restyled ThemeToggle**

```tsx
// apps/web/src/components/layout/theme-toggle.tsx
'use client'

import { useState, useTransition } from 'react'

type Props = {
  currentTheme: 'dark' | 'light'
  size?: number
}

export function ThemeToggle({ currentTheme, size = 32 }: Props) {
  const [theme, setTheme] = useState<'dark' | 'light'>(currentTheme)
  const [pending, startTransition] = useTransition()

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    startTransition(async () => {
      await fetch('/api/theme', {
        method: 'POST',
        body: JSON.stringify({ theme: next }),
        headers: { 'Content-Type': 'application/json' },
      })
      document.documentElement.dataset.theme = next
      document.documentElement.classList.toggle('dark', next === 'dark')
    })
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        width: size,
        height: size,
        border: '1px dashed var(--pb-line)',
        background: 'transparent',
        borderRadius: 6,
        color: 'var(--pb-muted)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.5,
        transition: 'color 0.15s ease, border-color 0.15s ease',
      }}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/components/layout/theme-toggle.test.tsx 2>&1 | tail -10`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/theme-toggle.tsx apps/web/test/components/layout/theme-toggle.test.tsx
git commit -m "feat(header): add restyled ThemeToggle with dashed border pinboard aesthetic"
```

---

### Task 5: BrandWordmark Component (Inline SVG)

**Files:**
- Create: `apps/web/src/components/brand/brand-wordmark.tsx`
- Create: `apps/web/test/components/brand/brand-wordmark.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/components/brand/brand-wordmark.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrandWordmark } from '../../../src/components/brand/brand-wordmark'

describe('BrandWordmark', () => {
  it('renders an SVG element', () => {
    const { container } = render(<BrandWordmark theme="dark" />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('has aria-label "by Thiago Figueiredo"', () => {
    const { container } = render(<BrandWordmark theme="dark" />)
    const svg = container.querySelector('svg')
    expect(svg!.getAttribute('aria-label')).toBe('by Thiago Figueiredo')
  })

  it('uses light fill (#EFE6D2) for dark theme', () => {
    const { container } = render(<BrandWordmark theme="dark" />)
    const g = container.querySelector('g[data-testid="brand-text"]')
    expect(g!.getAttribute('fill')).toBe('#EFE6D2')
  })

  it('uses dark fill (#1A140C) for light theme', () => {
    const { container } = render(<BrandWordmark theme="light" />)
    const g = container.querySelector('g[data-testid="brand-text"]')
    expect(g!.getAttribute('fill')).toBe('#1A140C')
  })

  it('uses accent orange (#FF8240) asterisk for dark theme', () => {
    const { container } = render(<BrandWordmark theme="dark" />)
    const asteriskG = container.querySelector('g[data-testid="brand-asterisk"]')
    const paths = asteriskG!.querySelectorAll('path')
    expect(paths[0].getAttribute('fill')).toBe('#FF8240')
  })

  it('uses accent rust (#C14513) asterisk for light theme', () => {
    const { container } = render(<BrandWordmark theme="light" />)
    const asteriskG = container.querySelector('g[data-testid="brand-asterisk"]')
    const paths = asteriskG!.querySelectorAll('path')
    expect(paths[0].getAttribute('fill')).toBe('#C14513')
  })

  it('defaults to height 28', () => {
    const { container } = render(<BrandWordmark theme="dark" />)
    const svg = container.querySelector('svg')
    expect(svg!.getAttribute('height')).toBe('28')
  })

  it('accepts custom height', () => {
    const { container } = render(<BrandWordmark theme="dark" height={22} />)
    const svg = container.querySelector('svg')
    expect(svg!.getAttribute('height')).toBe('22')
  })

  it('contains "by" and "Thiago Figueiredo" text elements', () => {
    const { container } = render(<BrandWordmark theme="dark" />)
    const texts = container.querySelectorAll('text')
    const allText = Array.from(texts).map((t) => t.textContent).join(' ')
    expect(allText).toContain('by')
    expect(allText).toContain('Thiago Figueiredo')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/components/brand/brand-wordmark.test.tsx 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Write the BrandWordmark component**

The SVG is inlined for theme reactivity (no flash on theme switch). Proportions match `design/brand/wordmark-dark-bg.svg` (viewBox 0 0 588 80).

```tsx
// apps/web/src/components/brand/brand-wordmark.tsx

type Props = {
  theme: 'dark' | 'light'
  height?: number
  className?: string
}

const FILLS = {
  dark: { text: '#EFE6D2', asterisk: '#FF8240' },
  light: { text: '#1A140C', asterisk: '#C14513' },
}

export function BrandWordmark({ theme, height = 28, className }: Props) {
  const { text, asterisk } = FILLS[theme]
  const aspectRatio = 588 / 80
  const width = Math.round(height * aspectRatio)

  return (
    <svg
      viewBox="0 0 588 80"
      width={width}
      height={height}
      role="img"
      aria-label="by Thiago Figueiredo"
      className={className}
      style={{ display: 'block' }}
    >
      <g data-testid="brand-text" fontFamily="'Source Serif 4', Georgia, serif" fill={text}>
        <text x="6" y="68.80" fontSize="46.08" fontWeight="300" fontStyle="italic" opacity="0.75">by</text>
        <text x="62.52" y="72" fontSize="64" fontWeight="500" letterSpacing="-0.96">Thiago Figueiredo</text>
      </g>
      <g data-testid="brand-asterisk" transform="translate(567.80 24.64)">
        <path d="M 0 -11 C -1.8 -7, -1.8 7, 0 11 C 1.8 7, 1.8 -7, 0 -11 Z" fill={asterisk} transform="rotate(0) scale(1.222)" />
        <path d="M 0 -11 C -1.8 -7, -1.8 7, 0 11 C 1.8 7, 1.8 -7, 0 -11 Z" fill={asterisk} transform="rotate(60) scale(1.222)" />
        <path d="M 0 -11 C -1.8 -7, -1.8 7, 0 11 C 1.8 7, 1.8 -7, 0 -11 Z" fill={asterisk} transform="rotate(120) scale(1.222)" />
        <circle cx="0" cy="0" r="0.99" fill={asterisk} />
      </g>
    </svg>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/components/brand/brand-wordmark.test.tsx 2>&1 | tail -10`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/brand/brand-wordmark.tsx apps/web/test/components/brand/brand-wordmark.test.tsx
git commit -m "feat(brand): add inline SVG BrandWordmark with theme-reactive fills"
```

---

### Task 6: Add Locale Strings

**Files:**
- Modify: `apps/web/src/locales/en.json`
- Modify: `apps/web/src/locales/pt-BR.json`

The existing locale files already have the needed keys (`nav.home`, `nav.writing`, `nav.videos`, `nav.newsletter`, `nav.about`, `nav.contact`, `nav.devSite`, `header.subscribe`, `header.newsletter`). No changes needed — this task is a verification only.

- [ ] **Step 1: Verify keys exist**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && node -e "const en=require('./apps/web/src/locales/en.json'); const pt=require('./apps/web/src/locales/pt-BR.json'); const keys=['nav.home','nav.writing','nav.videos','nav.newsletter','nav.about','nav.contact','nav.devSite','header.subscribe','header.newsletter']; keys.forEach(k => { if(!en[k]) console.log('MISSING en:',k); if(!pt[k]) console.log('MISSING pt:',k); }); console.log('All keys verified')"`
Expected: "All keys verified" (no MISSING lines)

---

### Task 7: MobileNavDrawer Component

**Depends on:** Tasks 1, 3, 4 (header-types, HeaderCTAs, ThemeToggle)

**Files:**
- Create: `apps/web/src/components/layout/mobile-nav-drawer.tsx`
- Create: `apps/web/test/components/layout/mobile-nav-drawer.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/components/layout/mobile-nav-drawer.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileNavDrawer } from '../../../src/components/layout/mobile-nav-drawer'

vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response())))

const defaultProps = {
  locale: 'pt-BR' as const,
  currentTheme: 'dark' as const,
  current: 'home' as const,
  variant: 'full' as const,
  ctas: 'home' as const,
  t: {
    'nav.home': 'Início',
    'nav.writing': 'Escritos',
    'nav.videos': 'Vídeos',
    'nav.newsletter': 'Newsletter',
    'nav.about': 'Sobre',
    'nav.contact': 'Contato',
    'nav.devSite': 'Site Dev',
    'header.subscribe': 'Inscrever no YouTube',
    'header.newsletter': 'Receber newsletter',
  },
}

describe('MobileNavDrawer', () => {
  it('renders hamburger button', () => {
    render(<MobileNavDrawer {...defaultProps} />)
    const btn = screen.getByLabelText('Open menu')
    expect(btn).toBeTruthy()
  })

  it('hamburger button has aria-expanded=false initially', () => {
    render(<MobileNavDrawer {...defaultProps} />)
    const btn = screen.getByLabelText('Open menu')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })

  it('opens drawer on hamburger click', () => {
    render(<MobileNavDrawer {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(screen.getByLabelText('Close menu')).toBeTruthy()
  })

  it('shows all full nav items when open', () => {
    render(<MobileNavDrawer {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(screen.getByText('Início')).toBeTruthy()
    expect(screen.getByText('Escritos')).toBeTruthy()
    expect(screen.getByText('Vídeos')).toBeTruthy()
    expect(screen.getByText('Newsletter')).toBeTruthy()
    expect(screen.getByText('Sobre')).toBeTruthy()
    expect(screen.getByText('Contato')).toBeTruthy()
    expect(screen.getByText(/Site Dev/)).toBeTruthy()
  })

  it('shows reduced nav items in reduced variant', () => {
    render(<MobileNavDrawer {...defaultProps} variant="reduced" />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(screen.getByText('Início')).toBeTruthy()
    expect(screen.queryByText('Contato')).toBeNull()
    expect(screen.queryByText(/Site Dev/)).toBeNull()
  })

  it('marks active item with accent border', () => {
    const { container } = render(<MobileNavDrawer {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    const activeItem = container.querySelector('[data-active="true"]')
    expect(activeItem).toBeTruthy()
    expect(activeItem!.textContent).toBe('Início')
  })

  it('shows tagline in drawer', () => {
    render(<MobileNavDrawer {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(screen.getByText('— blog + canal —')).toBeTruthy()
  })

  it('shows CTAs in drawer', () => {
    render(<MobileNavDrawer {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(screen.getByText(/YouTube/)).toBeTruthy()
  })

  it('closes on close button click', () => {
    render(<MobileNavDrawer {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    fireEvent.click(screen.getByLabelText('Close menu'))
    expect(screen.getByLabelText('Open menu')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/components/layout/mobile-nav-drawer.test.tsx 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Write the MobileNavDrawer component**

```tsx
// apps/web/src/components/layout/mobile-nav-drawer.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { HeaderLocale, HeaderTheme, HeaderCurrent, HeaderVariant, HeaderCtaVariant } from './header-types'
import { buildNavItems } from './header-types'
import { HeaderCTAs } from './header-ctas'
import { ThemeToggle } from './theme-toggle'

type Props = {
  locale: HeaderLocale
  currentTheme: HeaderTheme
  current: HeaderCurrent
  variant: HeaderVariant
  ctas: HeaderCtaVariant
  t: Record<string, string>
}

export function MobileNavDrawer({ locale, currentTheme, current, variant, ctas, t }: Props) {
  const [open, setOpen] = useState(false)
  const items = buildNavItems(locale, variant, t)

  return (
    <>
      <div className="flex items-center gap-2 md:hidden">
        <ThemeToggle currentTheme={currentTheme} size={28} />
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open ? 'true' : 'false'}
          style={{
            width: 28,
            height: 28,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            gap: 4,
            padding: 2,
          }}
        >
          <span style={{ width: 20, height: 2, background: 'var(--pb-ink)', borderRadius: 1 }} />
          <span style={{ width: 20, height: 2, background: 'var(--pb-ink)', borderRadius: 1 }} />
          <span style={{ width: 14, height: 2, background: 'var(--pb-ink)', borderRadius: 1 }} />
        </button>
      </div>

      {open && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            background: 'var(--pb-bg)',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '14px 28px' }}>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              style={{
                width: 28,
                height: 28,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--pb-ink)',
                fontSize: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ padding: '0 28px 28px' }}>
            <div
              className="font-caveat"
              style={{ fontSize: 17, color: 'var(--pb-accent)', opacity: 0.85, transform: 'rotate(-1deg)', marginBottom: 24 }}
            >
              — blog + canal —
            </div>

            <nav aria-label="Mobile navigation">
              {items.map((item) => {
                const isActive = item.key === current
                const linkProps = item.external
                  ? { target: '_blank' as const, rel: 'noopener' }
                  : {}
                return (
                  <div key={item.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {item.external ? (
                      <a
                        href={item.href}
                        data-active={isActive ? 'true' : undefined}
                        style={{
                          display: 'block',
                          padding: '14px 0',
                          paddingLeft: isActive ? 14 : 0,
                          borderLeft: isActive ? '3px solid var(--pb-accent)' : '3px solid transparent',
                          color: isActive ? 'var(--pb-ink)' : 'var(--pb-muted)',
                          fontWeight: isActive ? 600 : 400,
                          fontSize: 15,
                          textDecoration: 'none',
                          transition: 'color 0.15s ease',
                        }}
                        {...linkProps}
                      >
                        {item.label}{item.external && <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>↗</span>}
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        data-active={isActive ? 'true' : undefined}
                        onClick={() => setOpen(false)}
                        style={{
                          display: 'block',
                          padding: '14px 0',
                          paddingLeft: isActive ? 14 : 0,
                          borderLeft: isActive ? '3px solid var(--pb-accent)' : '3px solid transparent',
                          color: isActive ? 'var(--pb-ink)' : 'var(--pb-muted)',
                          fontWeight: isActive ? 600 : 400,
                          fontSize: 15,
                          textDecoration: 'none',
                          transition: 'color 0.15s ease',
                        }}
                      >
                        {item.label}
                      </Link>
                    )}
                  </div>
                )
              })}
            </nav>

            <div style={{ borderTop: '1px dashed var(--pb-line)', marginTop: 16, paddingTop: 16 }}>
              <HeaderCTAs variant={ctas} locale={locale} t={t} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/components/layout/mobile-nav-drawer.test.tsx 2>&1 | tail -10`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/mobile-nav-drawer.tsx apps/web/test/components/layout/mobile-nav-drawer.test.tsx
git commit -m "feat(header): add MobileNavDrawer with hamburger, tagline, and CTAs"
```

---

### Task 8: GlobalHeader Component

**Depends on:** Tasks 1–5 (all leaf components)

**Files:**
- Create: `apps/web/src/components/layout/global-header.tsx`
- Create: `apps/web/test/components/layout/global-header.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/components/layout/global-header.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GlobalHeader } from '../../../src/components/layout/global-header'

vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response())))

const defaultT: Record<string, string> = {
  'nav.home': 'Início',
  'nav.writing': 'Escritos',
  'nav.videos': 'Vídeos',
  'nav.newsletter': 'Newsletter',
  'nav.about': 'Sobre',
  'nav.contact': 'Contato',
  'nav.devSite': 'Site Dev',
  'header.subscribe': 'Inscrever no YouTube',
  'header.newsletter': 'Receber newsletter',
}

const defaultProps = {
  locale: 'pt-BR' as const,
  currentTheme: 'dark' as const,
  current: 'home' as const,
  variant: 'full' as const,
  ctas: 'home' as const,
  t: defaultT,
}

describe('GlobalHeader', () => {
  it('renders a header element', () => {
    render(<GlobalHeader {...defaultProps} />)
    expect(document.querySelector('header')).toBeTruthy()
  })

  it('is sticky and positioned below the top strip (top: 44px)', () => {
    const { container } = render(<GlobalHeader {...defaultProps} />)
    const header = container.querySelector('header')!
    expect(header.style.position).toBe('sticky')
    expect(header.style.top).toBe('44px')
  })

  it('renders the SVG brand wordmark', () => {
    const { container } = render(<GlobalHeader {...defaultProps} />)
    const svg = container.querySelector('svg[aria-label="by Thiago Figueiredo"]')
    expect(svg).toBeTruthy()
  })

  it('wraps brand in a link to home', () => {
    const { container } = render(<GlobalHeader {...defaultProps} />)
    const brandLink = container.querySelector('a[aria-label="by Thiago Figueiredo"]')
    expect(brandLink).toBeTruthy()
    expect(brandLink!.getAttribute('href')).toBe('/pt-BR')
  })

  it('shows tagline on desktop', () => {
    render(<GlobalHeader {...defaultProps} />)
    expect(screen.getByText('— blog + canal —')).toBeTruthy()
  })

  it('renders desktop nav with main navigation label', () => {
    render(<GlobalHeader {...defaultProps} />)
    const nav = screen.getByLabelText('Main navigation')
    expect(nav).toBeTruthy()
  })

  it('renders 7 nav items in full variant', () => {
    render(<GlobalHeader {...defaultProps} />)
    const nav = screen.getByLabelText('Main navigation')
    const links = nav.querySelectorAll('a')
    expect(links).toHaveLength(7)
  })

  it('renders 5 nav items in reduced variant', () => {
    render(<GlobalHeader {...defaultProps} variant="reduced" />)
    const nav = screen.getByLabelText('Main navigation')
    const links = nav.querySelectorAll('a')
    expect(links).toHaveLength(5)
  })

  it('marks active nav item with accent border and bold', () => {
    const { container } = render(<GlobalHeader {...defaultProps} current="home" />)
    const activeLink = container.querySelector('nav a[data-active="true"]')
    expect(activeLink).toBeTruthy()
    expect(activeLink!.textContent).toBe('Início')
  })

  it('shows ↗ on external links', () => {
    render(<GlobalHeader {...defaultProps} />)
    const devLink = screen.getByText(/Site Dev/)
    expect(devLink.textContent).toContain('↗')
  })

  it('renders CTAs for home variant', () => {
    render(<GlobalHeader {...defaultProps} ctas="home" />)
    expect(screen.getByText(/YouTube/)).toBeTruthy()
    expect(screen.getByText(/Newsletter/)).toBeTruthy()
  })

  it('renders theme toggle', () => {
    render(<GlobalHeader {...defaultProps} />)
    expect(screen.getByLabelText('Switch to light mode')).toBeTruthy()
  })

  it('has dashed bottom border', () => {
    const { container } = render(<GlobalHeader {...defaultProps} />)
    const header = container.querySelector('header')!
    expect(header.style.borderBottom).toContain('dashed')
  })

  it('renders en locale brand link to /', () => {
    const { container } = render(<GlobalHeader {...defaultProps} locale="en" />)
    const brandLink = container.querySelector('a[aria-label="by Thiago Figueiredo"]')
    expect(brandLink!.getAttribute('href')).toBe('/')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/components/layout/global-header.test.tsx 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Write the GlobalHeader component**

```tsx
// apps/web/src/components/layout/global-header.tsx
import Link from 'next/link'
import { BrandWordmark } from '@/components/brand/brand-wordmark'
import type { GlobalHeaderProps, NavItem } from './header-types'
import { buildNavItems } from './header-types'
import { HeaderCTAs } from './header-ctas'
import { ThemeToggle } from './theme-toggle'
import { MobileNavDrawer } from './mobile-nav-drawer'

export function GlobalHeader({ locale, currentTheme, current, variant, ctas, t }: GlobalHeaderProps) {
  const homeHref = locale === 'pt-BR' ? '/pt-BR' : '/'
  const items = buildNavItems(locale, variant, t)

  return (
    <header
      style={{
        position: 'sticky',
        top: 44,
        zIndex: 5,
        background: 'var(--pb-bg)',
        borderBottom: '1px dashed var(--pb-line)',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '14px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        {/* Brand + tagline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <Link href={homeHref} aria-label="by Thiago Figueiredo" className="no-underline">
            <BrandWordmark theme={currentTheme} height={28} className="hidden md:block" />
            <BrandWordmark theme={currentTheme} height={22} className="block md:hidden" />
          </Link>
          <span
            className="font-caveat hidden md:inline-block"
            style={{
              fontSize: 17,
              color: 'var(--pb-accent)',
              transform: 'rotate(-1deg)',
              opacity: 0.85,
              whiteSpace: 'nowrap',
            }}
          >
            — blog + canal —
          </span>
        </div>

        {/* Desktop nav */}
        <nav
          aria-label="Main navigation"
          className="hidden md:flex items-center gap-5"
          style={{ fontSize: 14 }}
        >
          {items.map((item) => {
            const isActive = item.key === current
            const style = {
              color: isActive ? 'var(--pb-ink)' : 'var(--pb-muted)',
              fontWeight: isActive ? 600 : 400,
              borderBottom: isActive ? '2px solid var(--pb-accent)' : '2px solid transparent',
              paddingBottom: 2,
              textDecoration: 'none' as const,
              transition: 'color 0.15s ease, border-color 0.15s ease',
              whiteSpace: 'nowrap' as const,
            }
            if (item.external) {
              return (
                <a
                  key={item.key}
                  href={item.href}
                  target="_blank"
                  rel="noopener"
                  data-active={isActive ? 'true' : undefined}
                  style={style}
                >
                  {item.label}
                  <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 3 }}>↗</span>
                </a>
              )
            }
            return (
              <Link
                key={item.key}
                href={item.href}
                data-active={isActive ? 'true' : undefined}
                style={style}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* CTAs + ThemeToggle (desktop) + Mobile hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div className="hidden md:flex items-center gap-3">
            <HeaderCTAs variant={ctas} locale={locale} t={t} />
            <ThemeToggle currentTheme={currentTheme} />
          </div>
          <MobileNavDrawer
            locale={locale}
            currentTheme={currentTheme}
            current={current}
            variant={variant}
            ctas={ctas}
            t={t}
          />
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/components/layout/global-header.test.tsx 2>&1 | tail -10`
Expected: PASS (14 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/global-header.tsx apps/web/test/components/layout/global-header.test.tsx
git commit -m "feat(header): add GlobalHeader with brand, nav, CTAs, theme toggle, mobile drawer"
```

---

### Task 9: Index Re-exports

**Files:**
- Create: `apps/web/src/components/layout/index.ts`

- [ ] **Step 1: Create the barrel file**

```typescript
// apps/web/src/components/layout/index.ts
export { TopStrip } from './top-strip'
export { GlobalHeader } from './global-header'
export { HeaderCTAs } from './header-ctas'
export { ThemeToggle } from './theme-toggle'
export { MobileNavDrawer } from './mobile-nav-drawer'
export type {
  GlobalHeaderProps,
  HeaderLocale,
  HeaderTheme,
  HeaderCurrent,
  HeaderVariant,
  HeaderCtaVariant,
} from './header-types'
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/layout/index.ts
git commit -m "feat(header): add layout barrel re-exports"
```

---

### Task 10: Layout Integration

**Depends on:** Tasks 2, 8, 9

**Files:**
- Modify: `apps/web/src/app/(public)/layout.tsx`
- Delete: `apps/web/src/app/(public)/components/PinboardHeader.tsx`

- [ ] **Step 1: Update the public layout**

Replace the `PinboardHeader` import and usage with `TopStrip` + `GlobalHeader`. The layout passes `current='home'` and `variant='full'` and `ctas='home'` as defaults. Individual pages that need different values (e.g., blog post pages) will need to pass context down — but since the layout is the shared parent, we default to home context. Blog post detail pages already have their own layout concerns.

In `apps/web/src/app/(public)/layout.tsx`, make these changes:

**Replace import line:**
```typescript
// OLD:
import { PinboardHeader } from './components/PinboardHeader'
// NEW:
import { TopStrip } from '@/components/layout/top-strip'
import { GlobalHeader } from '@/components/layout/global-header'
```

**Replace the `<PinboardHeader ... />` JSX with:**
```tsx
<TopStrip locale={locale} />
<GlobalHeader
  locale={locale}
  currentTheme={theme}
  current="home"
  variant="full"
  ctas="home"
  t={t}
/>
```

**Add top padding** to the main wrapper div so content isn't hidden behind the fixed top strip. Change the `<div className="min-h-screen" ...>` to include `paddingTop: 44`:

```tsx
<div className="min-h-screen" style={{ background: 'var(--pb-bg)', color: 'var(--pb-ink)', paddingTop: 44 }}>
```

- [ ] **Step 2: Delete old PinboardHeader**

Run: `rm apps/web/src/app/(public)/components/PinboardHeader.tsx`

Also verify no other file imports it:

Run: `grep -r "PinboardHeader" apps/web/src/ --include="*.tsx" --include="*.ts" -l`
Expected: No results (only layout.tsx was importing it, and we just changed that)

- [ ] **Step 3: Also delete the old ThemeToggle from PinboardHeader components**

Run: `grep -r "from.*components/ThemeToggle" apps/web/src/ --include="*.tsx" --include="*.ts" -l`

If the only consumer was PinboardHeader, delete `apps/web/src/app/(public)/components/ThemeToggle.tsx` as well. If other files import it, leave it in place.

- [ ] **Step 4: Run the full web test suite**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web 2>&1 | tail -30`
Expected: All tests pass. If any test references `PinboardHeader`, update that test.

- [ ] **Step 5: Fix any broken tests**

If tests in `apps/web/test/` reference `PinboardHeader` or the old `ThemeToggle` from `(public)/components/`, update them to use the new components from `@/components/layout/`.

Common files to check:
- `apps/web/test/components/blog/blog-article-client.test.tsx`
- `apps/web/test/app/blog-detail.test.tsx`
- Any test that renders the public layout

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(public\)/layout.tsx
git add -u apps/web/src/app/\(public\)/components/PinboardHeader.tsx
git add -u apps/web/src/app/\(public\)/components/ThemeToggle.tsx
git commit -m "feat(header): wire TopStrip + GlobalHeader in public layout, remove PinboardHeader"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web 2>&1 | tail -30`
Expected: All tests pass

- [ ] **Step 2: Type check**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | tail -20`
Expected: No errors

- [ ] **Step 3: Start dev server and verify**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx next dev --port 3000 -H 0.0.0.0` (in background)

Verify in browser:
1. Top strip is fixed at top with lang pills (PT|EN)
2. Main header is sticky below strip with brand SVG wordmark
3. "— blog + canal —" tagline visible on desktop
4. 7 nav items on home page
5. YouTube + Newsletter CTAs on home
6. Theme toggle with dashed border
7. Mobile hamburger with asymmetric lines at <768px
8. Clicking hamburger opens drawer with tagline, nav, CTAs
9. Theme switch works (icon changes, page colors flip)
10. Lang pill switches locale

---

## Summary of Parallelization

**Phase 1 — 6 independent tracks (Tasks 1-6):**
All can run simultaneously. No dependencies between them.

| Track | Task | Component |
|-------|------|-----------|
| A | Task 1 | `header-types.ts` |
| B | Task 2 | `top-strip.tsx` + test |
| C | Task 3 | `header-ctas.tsx` + test |
| D | Task 4 | `theme-toggle.tsx` + test |
| E | Task 5 | `brand-wordmark.tsx` + test |
| F | Task 6 | Locale verification |

**Phase 2 — 2 tracks (Tasks 7-8):**
Depend on Phase 1 outputs.

| Track | Task | Component |
|-------|------|-----------|
| G | Task 7 | `mobile-nav-drawer.tsx` + test |
| H | Task 8 | `global-header.tsx` + test |

**Phase 3 — Sequential (Tasks 9-11):**

| Task | Action |
|------|--------|
| 9 | Index re-exports |
| 10 | Layout integration + PinboardHeader deletion |
| 11 | Final verification |
