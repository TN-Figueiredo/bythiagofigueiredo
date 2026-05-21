# Newsletter Visual System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all newsletter-related email templates and web pages with a cohesive branded visual system using design tokens (bg `#F7F1E8`, accent `#FF8240`, ink `#1F1B17`), fix a critical production bug where edition emails go out unstyled, and add a welcome email flow.

**Architecture:** Layered approach — Phase 0 builds shared React Email components (`EmailShell`, `EmailMonogram`, `EmailButton`, `EmailNewsletterList`, `EmailDivider`, `EmailEndMark`, `EmailFooter`), then Phases 1–5 compose emails and pages on that base. Each phase is independently deployable. Pages use Tailwind 4 + CSS variables with `data-theme` toggle. Emails use inline styles with system font fallbacks.

**Tech Stack:** React Email v1.0.12, `@react-email/render` v2.0.7, AWS SES via `@aws-sdk/client-sesv2`, Next.js 15, React 19, Tailwind 4, Vitest, DOMPurify (isomorphic-dompurify), juice for CSS inlining.

---

## File Structure

### Phase 0 — Shared Email Components
- Create: `apps/web/src/emails/components/email-shell.tsx` — Html+Head+Body+Container wrapper with branded bg/fonts
- Create: `apps/web/src/emails/components/email-monogram.tsx` — TF monogram with italic F in accent color
- Create: `apps/web/src/emails/components/email-button.tsx` — CTA button with Outlook VML fallback
- Create: `apps/web/src/emails/components/email-newsletter-list.tsx` — Colored border-left newsletter items
- Create: `apps/web/src/emails/components/email-divider.tsx` — Branded horizontal rule
- Create: `apps/web/src/emails/components/email-end-mark.tsx` — Fleuron ❦ end mark + signature block
- Modify: `apps/web/src/emails/components/email-footer.tsx` — Replace with branded footer (links + legal)
- Delete: `apps/web/src/emails/components/email-header.tsx` — Replaced by EmailMonogram + type name in shell
- Create: `apps/web/src/emails/components/email-tokens.ts` — Shared color/font constants
- Create: `apps/web/test/lib/newsletter/email-components.test.ts` — Render tests for all components

### Phase 1 — Confirm Email Migration
- Modify: `apps/web/lib/newsletter/confirm-email.ts` — Replace `buildConfirmHtml()` template literal with React Email `render()` call
- Create: `apps/web/src/emails/confirm.tsx` — React Email confirm template using shared components
- Modify: `apps/web/test/lib/newsletter/confirm-email.test.ts` — Update snapshot expectations
- Create: `apps/web/test/lib/newsletter/confirm-email-render.test.ts` — Visual render assertions

### Phase 2 — Welcome Email
- Create: `apps/web/src/emails/welcome.tsx` — React Email welcome template with latest article card
- Create: `apps/web/lib/newsletter/welcome-email.ts` — `sendWelcomeEmail()` + latest article query
- Create: `apps/web/src/app/api/cron/send-welcome-emails/route.ts` — Cron route using `newsletter_pending_welcome` index
- Create: `apps/web/test/lib/newsletter/welcome-email.test.ts` — Tests for welcome email logic
- Create: `apps/web/test/api/cron/send-welcome-emails.test.ts` — Cron route tests

### Phase 3 — Edition Email Redesign + Critical Bug Fix
- Modify: `apps/web/src/emails/newsletter.tsx` — Full redesign with shared components, branded shell
- Modify: `apps/web/lib/newsletter/email-styles.ts` — Replace `#7c3aed` with branded tokens
- Modify: `apps/web/src/app/api/cron/send-scheduled-newsletters/route.ts` — Add `sanitizeForEmail()` call before render
- Create: `apps/web/test/lib/newsletter/email-styles.test.ts` — Verify branded colors
- Create: `apps/web/test/api/cron/send-scheduled-sanitize.test.ts` — Verify sanitization pipeline in cron

### Phase 3a — Content Styling
- Modify: `apps/web/lib/newsletter/email-styles.ts` — Add drop cap, pull quote, subheading CSS with branded tokens

### Phase 4 — Confirm Page Redesign
- Modify: `apps/web/src/app/newsletter/confirm/[token]/page.tsx` — Responsive 3-tier layout, 680px card, monogram, grain texture, shimmer stripe, all 7 states
- Modify: `apps/web/src/app/newsletter/confirm/[token]/error.tsx` — Match new visual system + add Sentry
- Create: `apps/web/test/app/newsletter-confirm-page.test.tsx` — State rendering tests

### Phase 5 — Unsubscribe Page Redesign
- Modify: `apps/web/src/app/unsubscribe/[token]/page.tsx` — Full visual redesign, selective unsubscribe display, two-step flow, all 6 states
- Modify: `apps/web/src/app/unsubscribe/[token]/actions.ts` — Support selective unsubscribe
- Create: `apps/web/test/app/unsubscribe-page.test.tsx` — State rendering + action tests

---

## Task 1: Email Design Tokens

**Files:**
- Create: `apps/web/src/emails/components/email-tokens.ts`
- Create: `apps/web/test/lib/newsletter/email-tokens.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/newsletter/email-tokens.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { EMAIL_COLORS, EMAIL_FONTS, emailDarkStyles } from '../../../src/emails/components/email-tokens'

describe('email-tokens', () => {
  it('exports light mode colors with correct accent', () => {
    expect(EMAIL_COLORS.accent).toBe('#FF8240')
    expect(EMAIL_COLORS.bg).toBe('#F7F1E8')
    expect(EMAIL_COLORS.card).toBe('#FBF6EC')
    expect(EMAIL_COLORS.ink).toBe('#1F1B17')
    expect(EMAIL_COLORS.muted).toBe('#6A5F48')
    expect(EMAIL_COLORS.faint).toBe('#9C9178')
    expect(EMAIL_COLORS.line).toBe('#E8DCC8')
  })

  it('exports font stacks as strings', () => {
    expect(EMAIL_FONTS.serif).toContain('Georgia')
    expect(EMAIL_FONTS.sans).toContain('Arial')
    expect(EMAIL_FONTS.mono).toContain('Courier New')
  })

  it('returns dark mode CSS media query block', () => {
    const dark = emailDarkStyles()
    expect(dark).toContain('@media (prefers-color-scheme: dark)')
    expect(dark).toContain('#1A1714')
    expect(dark).toContain('#221E1A')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/newsletter/email-tokens.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/emails/components/email-tokens.ts`:

```ts
export const EMAIL_COLORS = {
  bg: '#F7F1E8',
  card: '#FBF6EC',
  ink: '#1F1B17',
  accent: '#FF8240',
  accentDeep: '#E0651E',
  muted: '#6A5F48',
  faint: '#9C9178',
  line: '#E8DCC8',
  dark: {
    bg: '#1A1714',
    card: '#221E1A',
    ink: '#EFE6D2',
    muted: '#958A75',
    faint: '#6B634F',
    line: '#2E2718',
  },
} as const

export const EMAIL_FONTS = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "Arial, Helvetica, sans-serif",
  mono: "'Courier New', Courier, monospace",
} as const

export function emailDarkStyles(): string {
  return `
@media (prefers-color-scheme: dark) {
  .email-body { background-color: ${EMAIL_COLORS.dark.bg} !important; }
  .email-card { background-color: ${EMAIL_COLORS.dark.card} !important; }
  .email-ink { color: ${EMAIL_COLORS.dark.ink} !important; }
  .email-muted { color: ${EMAIL_COLORS.dark.muted} !important; }
  .email-faint { color: ${EMAIL_COLORS.dark.faint} !important; }
  .email-line { border-color: ${EMAIL_COLORS.dark.line} !important; }
  .email-divider { background-color: ${EMAIL_COLORS.dark.line} !important; }
}`.trim()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/newsletter/email-tokens.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/emails/components/email-tokens.ts apps/web/test/lib/newsletter/email-tokens.test.ts
git commit -m "feat(email): add shared design tokens for newsletter visual system"
```

---

## Task 2: EmailShell Component

**Files:**
- Create: `apps/web/src/emails/components/email-shell.tsx`
- Create: `apps/web/test/lib/newsletter/email-shell.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/newsletter/email-shell.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import { EmailShell } from '../../../src/emails/components/email-shell'
import { Text } from '@react-email/components'
import React from 'react'

describe('EmailShell', () => {
  it('renders wrapper with branded background color', async () => {
    const html = await render(
      React.createElement(EmailShell, { preheader: 'test preview' },
        React.createElement(Text, null, 'Hello')
      )
    )
    expect(html).toContain('#F7F1E8')
    expect(html).toContain('#FBF6EC')
    expect(html).toContain('Hello')
  })

  it('includes preheader text', async () => {
    const html = await render(
      React.createElement(EmailShell, { preheader: 'My preview text' },
        React.createElement(Text, null, 'Body')
      )
    )
    expect(html).toContain('My preview text')
  })

  it('includes dark mode media query in head', async () => {
    const html = await render(
      React.createElement(EmailShell, {},
        React.createElement(Text, null, 'Body')
      )
    )
    expect(html).toContain('prefers-color-scheme: dark')
    expect(html).toContain('#1A1714')
  })

  it('sets max-width 640 on container', async () => {
    const html = await render(
      React.createElement(EmailShell, {},
        React.createElement(Text, null, 'Body')
      )
    )
    expect(html).toContain('640')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/newsletter/email-shell.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/emails/components/email-shell.tsx`:

```tsx
import { Html, Head, Body, Container, Preview } from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS, emailDarkStyles } from './email-tokens'

interface EmailShellProps {
  preheader?: string
  children: React.ReactNode
}

export function EmailShell({ preheader, children }: EmailShellProps) {
  return (
    <Html>
      <Head>
        <style dangerouslySetInnerHTML={{ __html: emailDarkStyles() }} />
      </Head>
      {preheader && <Preview>{preheader}</Preview>}
      <Body
        className="email-body"
        style={{
          backgroundColor: EMAIL_COLORS.bg,
          fontFamily: EMAIL_FONTS.serif,
          margin: 0,
          padding: 0,
          WebkitFontSmoothing: 'antialiased' as string,
        }}
      >
        <Container
          className="email-card"
          style={{
            maxWidth: 640,
            margin: '0 auto',
            padding: '48px 0',
            backgroundColor: EMAIL_COLORS.card,
          }}
        >
          {children}
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/newsletter/email-shell.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/emails/components/email-shell.tsx apps/web/test/lib/newsletter/email-shell.test.ts
git commit -m "feat(email): add EmailShell component with branded wrapper and dark mode"
```

---

## Task 3: EmailMonogram Component

**Files:**
- Create: `apps/web/src/emails/components/email-monogram.tsx`
- Create: `apps/web/test/lib/newsletter/email-monogram.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/newsletter/email-monogram.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { EmailMonogram } from '../../../src/emails/components/email-monogram'

describe('EmailMonogram', () => {
  it('renders TF monogram with italic F in accent color', async () => {
    const html = await render(React.createElement(EmailMonogram))
    expect(html).toContain('T')
    expect(html).toContain('F')
    expect(html).toContain('#FF8240')
  })

  it('centers the monogram', async () => {
    const html = await render(React.createElement(EmailMonogram))
    expect(html).toContain('center')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/newsletter/email-monogram.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/emails/components/email-monogram.tsx`:

```tsx
import { Section, Text } from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS } from './email-tokens'

export function EmailMonogram() {
  return (
    <Section style={{ textAlign: 'center', padding: '0 0 24px' }}>
      <Text style={{
        fontFamily: EMAIL_FONTS.serif,
        fontSize: 40,
        fontWeight: 500,
        color: EMAIL_COLORS.ink,
        letterSpacing: '-3px',
        lineHeight: '1',
        margin: 0,
      }}>
        T<span style={{
          fontStyle: 'italic',
          color: EMAIL_COLORS.accent,
        }}>F</span><span style={{
          fontSize: 8,
          verticalAlign: 'middle',
          marginLeft: 2,
          color: EMAIL_COLORS.ink,
        }}>●</span>
      </Text>
    </Section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/newsletter/email-monogram.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/emails/components/email-monogram.tsx apps/web/test/lib/newsletter/email-monogram.test.ts
git commit -m "feat(email): add EmailMonogram component"
```

---

## Task 4: EmailButton Component

**Files:**
- Create: `apps/web/src/emails/components/email-button.tsx`
- Create: `apps/web/test/lib/newsletter/email-button.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/newsletter/email-button.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { EmailButton } from '../../../src/emails/components/email-button'

describe('EmailButton', () => {
  it('renders a link with the href', async () => {
    const html = await render(
      React.createElement(EmailButton, { href: 'https://example.com' }, 'Click me')
    )
    expect(html).toContain('https://example.com')
    expect(html).toContain('Click me')
  })

  it('uses accent color as background by default', async () => {
    const html = await render(
      React.createElement(EmailButton, { href: '#' }, 'Go')
    )
    expect(html).toContain('#FF8240')
  })

  it('accepts custom color', async () => {
    const html = await render(
      React.createElement(EmailButton, { href: '#', color: '#4CAF50' }, 'Go')
    )
    expect(html).toContain('#4CAF50')
  })

  it('includes Outlook VML fallback', async () => {
    const html = await render(
      React.createElement(EmailButton, { href: 'https://example.com' }, 'Click')
    )
    expect(html).toContain('v:roundrect')
    expect(html).toContain('mso')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/newsletter/email-button.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/emails/components/email-button.tsx`:

```tsx
import { Section } from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS } from './email-tokens'

interface EmailButtonProps {
  href: string
  color?: string
  children: React.ReactNode
}

export function EmailButton({ href, color = EMAIL_COLORS.accent, children }: EmailButtonProps) {
  return (
    <Section style={{ textAlign: 'center', margin: '32px 0' }}>
      {/* Outlook VML fallback */}
      <div dangerouslySetInnerHTML={{ __html: `<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="13%" strokecolor="${color}" fillcolor="${color}">
<w:anchorlock/>
<center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${typeof children === 'string' ? children : ''}</center>
</v:roundrect>
<![endif]-->` }} />
      {/* Standard button */}
      <div dangerouslySetInnerHTML={{ __html: `<!--[if !mso]><!-->` }} />
      <a
        href={href}
        style={{
          display: 'inline-block',
          padding: '14px 32px',
          backgroundColor: color,
          color: '#FFFFFF',
          fontFamily: EMAIL_FONTS.sans,
          fontSize: 15,
          fontWeight: 600,
          textDecoration: 'none',
          borderRadius: 6,
          lineHeight: '1',
        }}
      >
        {children}
      </a>
      <div dangerouslySetInnerHTML={{ __html: `<!--<![endif]-->` }} />
    </Section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/newsletter/email-button.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/emails/components/email-button.tsx apps/web/test/lib/newsletter/email-button.test.ts
git commit -m "feat(email): add EmailButton component with Outlook VML fallback"
```

---

## Task 5: EmailNewsletterList Component

**Files:**
- Create: `apps/web/src/emails/components/email-newsletter-list.tsx`
- Create: `apps/web/test/lib/newsletter/email-newsletter-list.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/newsletter/email-newsletter-list.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { EmailNewsletterList } from '../../../src/emails/components/email-newsletter-list'

const items = [
  { name: 'Diário do bythiago', tagline: 'resumo da semana · sextas', color: '#FF8240' },
  { name: 'Código em português', tagline: 'bugs reais · mensal', color: '#1F5F8B' },
]

describe('EmailNewsletterList', () => {
  it('renders each newsletter name', async () => {
    const html = await render(React.createElement(EmailNewsletterList, { items }))
    expect(html).toContain('Diário do bythiago')
    expect(html).toContain('Código em português')
  })

  it('renders taglines', async () => {
    const html = await render(React.createElement(EmailNewsletterList, { items }))
    expect(html).toContain('resumo da semana')
    expect(html).toContain('bugs reais')
  })

  it('applies left border color', async () => {
    const html = await render(React.createElement(EmailNewsletterList, { items }))
    expect(html).toContain('#FF8240')
    expect(html).toContain('#1F5F8B')
  })

  it('renders nothing for empty array', async () => {
    const html = await render(React.createElement(EmailNewsletterList, { items: [] }))
    expect(html).not.toContain('border-left')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/newsletter/email-newsletter-list.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/emails/components/email-newsletter-list.tsx`:

```tsx
import { Section, Text } from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS } from './email-tokens'

export interface NewsletterListItem {
  name: string
  tagline?: string
  color: string
}

interface EmailNewsletterListProps {
  items: NewsletterListItem[]
  label?: string
}

export function EmailNewsletterList({ items, label }: EmailNewsletterListProps) {
  if (items.length === 0) return null

  return (
    <Section style={{ margin: '20px 32px' }}>
      {label && (
        <Text className="email-muted" style={{
          fontFamily: EMAIL_FONTS.sans,
          fontSize: 13,
          fontWeight: 600,
          color: EMAIL_COLORS.muted,
          margin: '0 0 12px',
          lineHeight: '1.4',
        }}>
          {label}
        </Text>
      )}
      {items.map((item, i) => (
        <div key={i} style={{
          borderLeft: `3px solid ${item.color}`,
          padding: '10px 0 10px 16px',
          marginBottom: i < items.length - 1 ? 10 : 0,
        }}>
          <Text className="email-ink" style={{
            fontFamily: EMAIL_FONTS.serif,
            fontSize: 16,
            fontWeight: 500,
            color: EMAIL_COLORS.ink,
            margin: '0 0 2px',
            lineHeight: '1.3',
            letterSpacing: '-0.01em',
          }}>
            {item.name}
          </Text>
          {item.tagline && (
            <Text className="email-faint" style={{
              fontFamily: EMAIL_FONTS.sans,
              fontSize: 12,
              color: EMAIL_COLORS.faint,
              margin: 0,
              letterSpacing: '0.02em',
              lineHeight: '1.4',
            }}>
              {item.tagline}
            </Text>
          )}
        </div>
      ))}
    </Section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/newsletter/email-newsletter-list.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/emails/components/email-newsletter-list.tsx apps/web/test/lib/newsletter/email-newsletter-list.test.ts
git commit -m "feat(email): add EmailNewsletterList component"
```

---

## Task 6: EmailDivider + EmailEndMark + EmailFooter

**Files:**
- Create: `apps/web/src/emails/components/email-divider.tsx`
- Create: `apps/web/src/emails/components/email-end-mark.tsx`
- Modify: `apps/web/src/emails/components/email-footer.tsx`
- Create: `apps/web/test/lib/newsletter/email-layout-components.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/newsletter/email-layout-components.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { EmailDivider } from '../../../src/emails/components/email-divider'
import { EmailEndMark } from '../../../src/emails/components/email-end-mark'
import { EmailFooter } from '../../../src/emails/components/email-footer'

describe('EmailDivider', () => {
  it('renders a horizontal line with branded color', async () => {
    const html = await render(React.createElement(EmailDivider))
    expect(html).toContain('#E8DCC8')
  })
})

describe('EmailEndMark', () => {
  it('renders the fleuron symbol', async () => {
    const html = await render(React.createElement(EmailEndMark))
    expect(html).toContain('❦')
  })

  it('renders the TF signature', async () => {
    const html = await render(React.createElement(EmailEndMark))
    expect(html).toContain('Thiago Figueiredo')
    expect(html).toContain('bythiagofigueiredo.com')
  })
})

describe('EmailFooter', () => {
  it('renders unsubscribe link', async () => {
    const html = await render(
      React.createElement(EmailFooter, {
        unsubscribeUrl: 'https://example.com/unsub',
        archiveUrl: 'https://example.com/archive',
      })
    )
    expect(html).toContain('https://example.com/unsub')
  })

  it('renders archive link', async () => {
    const html = await render(
      React.createElement(EmailFooter, {
        unsubscribeUrl: 'https://example.com/unsub',
        archiveUrl: 'https://example.com/archive',
      })
    )
    expect(html).toContain('https://example.com/archive')
  })

  it('renders bythiagofigueiredo.com home link', async () => {
    const html = await render(
      React.createElement(EmailFooter, {
        unsubscribeUrl: '#',
        archiveUrl: '#',
      })
    )
    expect(html).toContain('bythiagofigueiredo.com')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/newsletter/email-layout-components.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Write EmailDivider**

Create `apps/web/src/emails/components/email-divider.tsx`:

```tsx
import { Hr } from '@react-email/components'
import { EMAIL_COLORS } from './email-tokens'

export function EmailDivider() {
  return (
    <Hr
      className="email-divider"
      style={{
        borderColor: EMAIL_COLORS.line,
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        borderBottom: `1px solid ${EMAIL_COLORS.line}`,
        margin: '32px 32px',
      }}
    />
  )
}
```

- [ ] **Step 4: Write EmailEndMark**

Create `apps/web/src/emails/components/email-end-mark.tsx`:

```tsx
import { Section, Text } from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS } from './email-tokens'

export function EmailEndMark() {
  return (
    <Section style={{ textAlign: 'center', padding: '8px 32px 0' }}>
      {/* Fleuron line */}
      <Text style={{
        fontFamily: EMAIL_FONTS.serif,
        fontSize: 16,
        color: EMAIL_COLORS.accent,
        margin: '0 0 12px',
        lineHeight: '1',
      }}>
        ― ❦ ―
      </Text>
      {/* Signature */}
      <Text className="email-faint" style={{
        fontFamily: EMAIL_FONTS.serif,
        fontSize: 13,
        color: EMAIL_COLORS.faint,
        margin: '0 0 2px',
        lineHeight: '1.4',
      }}>
        <span style={{ fontStyle: 'italic', fontWeight: 300, opacity: 0.7 }}>tf</span>{' '}
        <span style={{ color: EMAIL_COLORS.accent }}>❦</span>{' '}
        <strong style={{ fontWeight: 500 }}>Thiago Figueiredo</strong>
      </Text>
      <Text className="email-faint" style={{
        fontFamily: EMAIL_FONTS.sans,
        fontSize: 11,
        color: EMAIL_COLORS.faint,
        margin: 0,
        letterSpacing: '0.02em',
      }}>
        <a href="https://bythiagofigueiredo.com" style={{ color: EMAIL_COLORS.faint, textDecoration: 'none' }}>
          bythiagofigueiredo.com
        </a>
      </Text>
    </Section>
  )
}
```

- [ ] **Step 5: Replace EmailFooter**

Replace the contents of `apps/web/src/emails/components/email-footer.tsx`:

```tsx
import { Section, Text, Link } from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS } from './email-tokens'

interface EmailFooterProps {
  unsubscribeUrl: string
  archiveUrl: string
}

export function EmailFooter({ unsubscribeUrl, archiveUrl }: EmailFooterProps) {
  return (
    <Section style={{ padding: '0 32px 32px', textAlign: 'center' }}>
      <Text className="email-faint" style={{
        fontFamily: EMAIL_FONTS.sans,
        fontSize: 12,
        color: EMAIL_COLORS.faint,
        margin: '0 0 8px',
        lineHeight: '1.6',
      }}>
        <Link href={archiveUrl} style={{ color: EMAIL_COLORS.faint, textDecoration: 'underline' }}>
          Ver no navegador
        </Link>
        {' · '}
        <Link href="https://bythiagofigueiredo.com" style={{ color: EMAIL_COLORS.faint, textDecoration: 'underline' }}>
          bythiagofigueiredo.com
        </Link>
        {' · '}
        <Link href={unsubscribeUrl} style={{ color: EMAIL_COLORS.faint, textDecoration: 'underline' }}>
          Cancelar inscrição
        </Link>
      </Text>
    </Section>
  )
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/newsletter/email-layout-components.test.ts`
Expected: PASS

- [ ] **Step 7: Delete old EmailHeader**

Delete `apps/web/src/emails/components/email-header.tsx` (no longer imported).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/emails/components/email-divider.tsx apps/web/src/emails/components/email-end-mark.tsx apps/web/src/emails/components/email-footer.tsx apps/web/test/lib/newsletter/email-layout-components.test.ts
git rm apps/web/src/emails/components/email-header.tsx
git commit -m "feat(email): add EmailDivider, EmailEndMark, replace EmailFooter with branded version"
```

---

## Task 7: Confirm Email — React Email Migration (Phase 1)

**Files:**
- Create: `apps/web/src/emails/confirm.tsx`
- Modify: `apps/web/lib/newsletter/confirm-email.ts`
- Create: `apps/web/test/lib/newsletter/confirm-email-render.test.ts`
- Modify: `apps/web/test/lib/newsletter/confirm-email.test.ts`

- [ ] **Step 1: Write the failing render test**

Create `apps/web/test/lib/newsletter/confirm-email-render.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { ConfirmEmail } from '../../../src/emails/confirm'

describe('ConfirmEmail React Email template', () => {
  it('renders confirm URL in button', async () => {
    const html = await render(
      React.createElement(ConfirmEmail, {
        confirmUrl: 'https://example.com/confirm/abc',
        locale: 'pt-BR',
        newsletterNames: ['Diário do bythiago'],
      })
    )
    expect(html).toContain('https://example.com/confirm/abc')
    expect(html).toContain('Confirmar inscrição')
  })

  it('renders newsletter names list', async () => {
    const html = await render(
      React.createElement(ConfirmEmail, {
        confirmUrl: 'https://example.com/confirm/abc',
        locale: 'pt-BR',
        newsletterNames: ['Diário do bythiago', 'Código em português'],
      })
    )
    expect(html).toContain('Diário do bythiago')
    expect(html).toContain('Código em português')
  })

  it('renders English copy for en locale', async () => {
    const html = await render(
      React.createElement(ConfirmEmail, {
        confirmUrl: 'https://example.com/confirm/abc',
        locale: 'en',
      })
    )
    expect(html).toContain('Confirm subscription')
    expect(html).toContain('Almost there')
  })

  it('includes branded monogram', async () => {
    const html = await render(
      React.createElement(ConfirmEmail, {
        confirmUrl: '#',
        locale: 'pt-BR',
      })
    )
    expect(html).toContain('#FF8240')
  })

  it('includes dark mode styles', async () => {
    const html = await render(
      React.createElement(ConfirmEmail, {
        confirmUrl: '#',
        locale: 'pt-BR',
      })
    )
    expect(html).toContain('prefers-color-scheme: dark')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/newsletter/confirm-email-render.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the ConfirmEmail React Email template**

Create `apps/web/src/emails/confirm.tsx`:

```tsx
import { Section, Text } from '@react-email/components'
import { EmailShell } from './components/email-shell'
import { EmailMonogram } from './components/email-monogram'
import { EmailButton } from './components/email-button'
import { EmailDivider } from './components/email-divider'
import { EmailEndMark } from './components/email-end-mark'
import { EMAIL_COLORS, EMAIL_FONTS } from './components/email-tokens'

const COPY = {
  'pt-BR': {
    preheader: 'Confirme sua inscrição na newsletter',
    heading: 'Quase lá.',
    bodyGeneric: 'Clique no botão abaixo para confirmar sua inscrição na newsletter.',
    bodyWithList: 'Clique no botão abaixo para confirmar sua inscrição.',
    listLabel: 'Você está se inscrevendo em:',
    button: 'Confirmar inscrição',
    ignore: 'Se você não se inscreveu, pode ignorar este email.',
  },
  en: {
    preheader: 'Confirm your newsletter subscription',
    heading: 'Almost there.',
    bodyGeneric: 'Click the button below to confirm your newsletter subscription.',
    bodyWithList: 'Click the button below to confirm your subscription.',
    listLabel: "You're subscribing to:",
    button: 'Confirm subscription',
    ignore: "If you didn't subscribe, you can safely ignore this email.",
  },
} as const

interface ConfirmEmailProps {
  confirmUrl: string
  locale: string
  newsletterNames?: string[]
}

export function ConfirmEmail({ confirmUrl, locale, newsletterNames }: ConfirmEmailProps) {
  const isPt = locale === 'pt-BR'
  const c = isPt ? COPY['pt-BR'] : COPY.en
  const hasNames = newsletterNames && newsletterNames.length > 0

  return (
    <EmailShell preheader={c.preheader}>
      <Section style={{ padding: '0 32px' }}>
        <EmailMonogram />

        <Text className="email-ink" style={{
          fontFamily: EMAIL_FONTS.serif,
          fontSize: 28,
          fontWeight: 500,
          color: EMAIL_COLORS.ink,
          margin: '0 0 16px',
          letterSpacing: '-0.02em',
          textAlign: 'center',
          lineHeight: '1.2',
        }}>
          {c.heading}
        </Text>

        <Text className="email-muted" style={{
          fontFamily: EMAIL_FONTS.serif,
          fontSize: 16,
          lineHeight: '1.65',
          color: EMAIL_COLORS.muted,
          margin: '0 0 16px',
          textAlign: 'center',
        }}>
          {hasNames ? c.bodyWithList : c.bodyGeneric}
        </Text>
      </Section>

      {hasNames && (
        <Section style={{ margin: '0 32px 16px' }}>
          <Text className="email-muted" style={{
            fontFamily: EMAIL_FONTS.sans,
            fontSize: 13,
            fontWeight: 600,
            color: EMAIL_COLORS.muted,
            margin: '0 0 8px',
          }}>
            {c.listLabel}
          </Text>
          {newsletterNames.map((name, i) => (
            <Text key={i} className="email-muted" style={{
              fontFamily: EMAIL_FONTS.serif,
              fontSize: 15,
              color: EMAIL_COLORS.muted,
              margin: '0 0 4px',
              paddingLeft: 12,
              lineHeight: '1.6',
            }}>
              • {name}
            </Text>
          ))}
        </Section>
      )}

      <EmailButton href={confirmUrl}>{c.button}</EmailButton>

      <Section style={{ padding: '0 32px' }}>
        <Text className="email-faint" style={{
          fontFamily: EMAIL_FONTS.sans,
          fontSize: 12,
          color: EMAIL_COLORS.faint,
          margin: '24px 0 0',
          textAlign: 'center',
          lineHeight: '1.6',
        }}>
          {c.ignore}
        </Text>
      </Section>

      <EmailDivider />
      <EmailEndMark />
    </EmailShell>
  )
}
```

- [ ] **Step 4: Run render test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/newsletter/confirm-email-render.test.ts`
Expected: PASS

- [ ] **Step 5: Update confirm-email.ts to use React Email render**

Modify `apps/web/lib/newsletter/confirm-email.ts`:
- Remove `buildConfirmHtml()`, `buildNewsletterListHtml()`, `escapeHtml()` functions
- Import `render` from `@react-email/render` and `ConfirmEmail` from template
- Update `sendNewsletterConfirmEmail()` to use `await render(ConfirmEmail({...}))`

Replace the file content of `apps/web/lib/newsletter/confirm-email.ts`:

```ts
import crypto from 'node:crypto'
import { render } from '@react-email/render'
import { getEmailService } from '../email/service'
import { captureServerActionError } from '../../src/lib/sentry-wrap'
import { ConfirmEmail } from '../../src/emails/confirm'

export function generateConfirmToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashConfirmToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export function buildConfirmUrl(rawToken: string, locale: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const prefix = locale === 'pt-BR' ? '/pt' : ''
  return `${base}${prefix}/newsletter/confirm/${rawToken}`
}

export interface SendConfirmEmailOpts {
  to: string
  rawToken: string
  locale: string
  action?: string
  newsletterNames?: string[]
}

export async function sendNewsletterConfirmEmail(opts: SendConfirmEmailOpts): Promise<void> {
  const { to, rawToken, locale, action = 'newsletter_subscribe', newsletterNames } = opts
  const confirmUrl = buildConfirmUrl(rawToken, locale)
  const isPt = locale === 'pt-BR'
  const domain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'
  try {
    const html = await render(ConfirmEmail({ confirmUrl, locale, newsletterNames }))
    await getEmailService().send({
      from: { name: 'Thiago Figueiredo', email: `no-reply@${domain}` },
      to,
      subject: isPt ? 'Confirme sua inscrição' : 'Confirm your subscription',
      html,
    })
  } catch (err) {
    captureServerActionError(err, { action, branch: 'send_confirm_email' })
  }
}
```

- [ ] **Step 6: Update existing confirm-email tests**

In `apps/web/test/lib/newsletter/confirm-email.test.ts`, the `sendNewsletterConfirmEmail` tests expect `mockSend` to be called with an `html` field. Since we now use async `render()`, mock it:

Add to the `vi.hoisted` block:
```ts
const mockRender = vi.fn().mockResolvedValue('<html>rendered</html>')
```

Add new mock:
```ts
vi.mock('@react-email/render', () => ({
  render: mockRender,
}))
```

Update assertions that check `html` content to verify `mockSend` was called (the rendered HTML comes from the mock).

- [ ] **Step 7: Run all confirm-email tests**

Run: `cd apps/web && npx vitest run test/lib/newsletter/confirm-email`
Expected: PASS (both test files)

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/emails/confirm.tsx apps/web/lib/newsletter/confirm-email.ts apps/web/test/lib/newsletter/confirm-email-render.test.ts apps/web/test/lib/newsletter/confirm-email.test.ts
git commit -m "feat(email): migrate confirm email from template literal to React Email"
```

---

## Task 8: Welcome Email Template (Phase 2)

**Files:**
- Create: `apps/web/src/emails/welcome.tsx`
- Create: `apps/web/test/lib/newsletter/welcome-email-render.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/newsletter/welcome-email-render.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { WelcomeEmail } from '../../../src/emails/welcome'

describe('WelcomeEmail React Email template', () => {
  it('renders pt-BR welcome heading', async () => {
    const html = await render(
      React.createElement(WelcomeEmail, {
        locale: 'pt-BR',
        newsletterNames: [{ name: 'Diário do bythiago', tagline: 'resumo da semana', color: '#FF8240' }],
      })
    )
    expect(html).toContain('Bem-vindo')
    expect(html).toContain('Diário do bythiago')
  })

  it('renders en welcome heading', async () => {
    const html = await render(
      React.createElement(WelcomeEmail, {
        locale: 'en',
        newsletterNames: [{ name: 'Weekly Digest', tagline: 'weekly', color: '#FF8240' }],
      })
    )
    expect(html).toContain('Welcome')
    expect(html).toContain('Weekly Digest')
  })

  it('renders latest article card when provided', async () => {
    const html = await render(
      React.createElement(WelcomeEmail, {
        locale: 'pt-BR',
        newsletterNames: [{ name: 'Test', tagline: 'test', color: '#FF8240' }],
        latestArticle: {
          title: 'Meu primeiro artigo',
          url: 'https://example.com/blog/primeiro',
          excerpt: 'Uma breve introdução...',
        },
      })
    )
    expect(html).toContain('Meu primeiro artigo')
    expect(html).toContain('https://example.com/blog/primeiro')
  })

  it('includes monogram and end mark', async () => {
    const html = await render(
      React.createElement(WelcomeEmail, {
        locale: 'pt-BR',
        newsletterNames: [{ name: 'Test', tagline: 'test', color: '#FF8240' }],
      })
    )
    expect(html).toContain('#FF8240')
    expect(html).toContain('❦')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/newsletter/welcome-email-render.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the WelcomeEmail template**

Create `apps/web/src/emails/welcome.tsx`:

```tsx
import { Section, Text, Link } from '@react-email/components'
import { EmailShell } from './components/email-shell'
import { EmailMonogram } from './components/email-monogram'
import { EmailNewsletterList, type NewsletterListItem } from './components/email-newsletter-list'
import { EmailDivider } from './components/email-divider'
import { EmailEndMark } from './components/email-end-mark'
import { EMAIL_COLORS, EMAIL_FONTS } from './components/email-tokens'

const COPY = {
  'pt-BR': {
    preheader: 'Sua inscrição foi confirmada — bem-vindo!',
    heading: 'Bem-vindo à newsletter.',
    body: 'Sua inscrição está confirmada. Você receberá as próximas edições diretamente no seu email.',
    subscribedTo: 'Suas newsletters:',
    latestLabel: 'ÚLTIMO ARTIGO',
    readMore: 'Ler artigo →',
    signOff: '— Thiago',
  },
  en: {
    preheader: 'Your subscription is confirmed — welcome!',
    heading: 'Welcome to the newsletter.',
    body: "Your subscription is confirmed. You'll receive upcoming editions directly in your inbox.",
    subscribedTo: 'Your newsletters:',
    latestLabel: 'LATEST ARTICLE',
    readMore: 'Read article →',
    signOff: '— Thiago',
  },
} as const

interface LatestArticle {
  title: string
  url: string
  excerpt?: string
}

interface WelcomeEmailProps {
  locale: string
  newsletterNames: NewsletterListItem[]
  latestArticle?: LatestArticle
}

export function WelcomeEmail({ locale, newsletterNames, latestArticle }: WelcomeEmailProps) {
  const isPt = locale === 'pt-BR'
  const c = isPt ? COPY['pt-BR'] : COPY.en

  return (
    <EmailShell preheader={c.preheader}>
      <Section style={{ padding: '0 32px' }}>
        <EmailMonogram />

        <Text className="email-ink" style={{
          fontFamily: EMAIL_FONTS.serif,
          fontSize: 28,
          fontWeight: 500,
          color: EMAIL_COLORS.ink,
          margin: '0 0 16px',
          letterSpacing: '-0.02em',
          textAlign: 'center',
          lineHeight: '1.2',
        }}>
          {c.heading}
        </Text>

        <Text className="email-muted" style={{
          fontFamily: EMAIL_FONTS.serif,
          fontSize: 16,
          lineHeight: '1.65',
          color: EMAIL_COLORS.muted,
          margin: '0 0 8px',
          textAlign: 'center',
        }}>
          {c.body}
        </Text>
      </Section>

      <EmailNewsletterList items={newsletterNames} label={c.subscribedTo} />

      {latestArticle && (
        <>
          <EmailDivider />
          <Section style={{ padding: '0 32px' }}>
            <Text className="email-faint" style={{
              fontFamily: EMAIL_FONTS.mono,
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: EMAIL_COLORS.faint,
              fontWeight: 500,
              margin: '0 0 12px',
              textAlign: 'center',
            }}>
              {c.latestLabel}
            </Text>
            <div style={{
              border: `1px solid ${EMAIL_COLORS.line}`,
              borderRadius: 6,
              padding: '20px 24px',
            }}>
              <Text className="email-ink" style={{
                fontFamily: EMAIL_FONTS.serif,
                fontSize: 18,
                fontWeight: 500,
                color: EMAIL_COLORS.ink,
                margin: '0 0 8px',
                lineHeight: '1.3',
              }}>
                {latestArticle.title}
              </Text>
              {latestArticle.excerpt && (
                <Text className="email-muted" style={{
                  fontFamily: EMAIL_FONTS.serif,
                  fontSize: 14,
                  color: EMAIL_COLORS.muted,
                  margin: '0 0 12px',
                  lineHeight: '1.6',
                }}>
                  {latestArticle.excerpt}
                </Text>
              )}
              <Link href={latestArticle.url} style={{
                fontFamily: EMAIL_FONTS.sans,
                fontSize: 13,
                fontWeight: 600,
                color: EMAIL_COLORS.accent,
                textDecoration: 'none',
              }}>
                {c.readMore}
              </Link>
            </div>
          </Section>
        </>
      )}

      <Section style={{ padding: '24px 32px 0', textAlign: 'center' }}>
        <Text className="email-muted" style={{
          fontFamily: EMAIL_FONTS.serif,
          fontSize: 16,
          color: EMAIL_COLORS.muted,
          margin: 0,
          lineHeight: '1.6',
        }}>
          {c.signOff}
        </Text>
      </Section>

      <EmailDivider />
      <EmailEndMark />
    </EmailShell>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/newsletter/welcome-email-render.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/emails/welcome.tsx apps/web/test/lib/newsletter/welcome-email-render.test.ts
git commit -m "feat(email): add WelcomeEmail React Email template"
```

---

## Task 9: Welcome Email Service + Cron Route (Phase 2 continued)

**Files:**
- Create: `apps/web/lib/newsletter/welcome-email.ts`
- Create: `apps/web/src/app/api/cron/send-welcome-emails/route.ts`
- Create: `apps/web/test/lib/newsletter/welcome-email.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/newsletter/welcome-email.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend, mockCaptureException, mockRender } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({ messageId: 'msg-1' }),
  mockCaptureException: vi.fn(),
  mockRender: vi.fn().mockResolvedValue('<html>welcome</html>'),
}))

vi.mock('../../../lib/email/service', () => ({
  getEmailService: () => ({ send: mockSend }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
  getClient: () => ({}),
}))

vi.mock('@react-email/render', () => ({
  render: mockRender,
}))

import { sendWelcomeEmail, type WelcomeEmailOpts } from '../../../lib/newsletter/welcome-email'

describe('sendWelcomeEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends email with correct from and to', async () => {
    process.env.NEWSLETTER_FROM_DOMAIN = 'example.com'
    await sendWelcomeEmail({
      to: 'user@test.com',
      locale: 'pt-BR',
      newsletterNames: [{ name: 'Test', tagline: 'test', color: '#FF8240' }],
    })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        from: expect.objectContaining({ email: 'no-reply@example.com' }),
      })
    )
    delete process.env.NEWSLETTER_FROM_DOMAIN
  })

  it('uses pt-BR subject for pt-BR locale', async () => {
    await sendWelcomeEmail({
      to: 'user@test.com',
      locale: 'pt-BR',
      newsletterNames: [{ name: 'Test', tagline: 'test', color: '#FF8240' }],
    })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('Bem-vindo'),
      })
    )
  })

  it('uses English subject for en locale', async () => {
    await sendWelcomeEmail({
      to: 'user@test.com',
      locale: 'en',
      newsletterNames: [{ name: 'Test', tagline: 'test', color: '#FF8240' }],
    })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('Welcome'),
      })
    )
  })

  it('captures error on failure without rethrowing', async () => {
    mockSend.mockRejectedValueOnce(new Error('SES down'))
    await sendWelcomeEmail({
      to: 'user@test.com',
      locale: 'pt-BR',
      newsletterNames: [{ name: 'Test', tagline: 'test', color: '#FF8240' }],
    })
    expect(mockCaptureException).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/newsletter/welcome-email.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create welcome-email.ts service**

Create `apps/web/lib/newsletter/welcome-email.ts`:

```ts
import { render } from '@react-email/render'
import { getEmailService } from '../email/service'
import { captureServerActionError } from '../../src/lib/sentry-wrap'
import { WelcomeEmail } from '../../src/emails/welcome'
import type { NewsletterListItem } from '../../src/emails/components/email-newsletter-list'

interface LatestArticle {
  title: string
  url: string
  excerpt?: string
}

export interface WelcomeEmailOpts {
  to: string
  locale: string
  newsletterNames: NewsletterListItem[]
  latestArticle?: LatestArticle
}

export async function sendWelcomeEmail(opts: WelcomeEmailOpts): Promise<void> {
  const { to, locale, newsletterNames, latestArticle } = opts
  const isPt = locale === 'pt-BR'
  const domain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'

  try {
    const html = await render(WelcomeEmail({ locale, newsletterNames, latestArticle }))
    await getEmailService().send({
      from: { name: 'Thiago Figueiredo', email: `no-reply@${domain}` },
      to,
      subject: isPt ? 'Bem-vindo à newsletter!' : 'Welcome to the newsletter!',
      html,
    })
  } catch (err) {
    captureServerActionError(err, { action: 'send_welcome_email', branch: 'send' })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/newsletter/welcome-email.test.ts`
Expected: PASS

- [ ] **Step 5: Create the cron route**

Create `apps/web/src/app/api/cron/send-welcome-emails/route.ts`:

```ts
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { sendWelcomeEmail } from '../../../../../lib/newsletter/welcome-email'
import * as Sentry from '@sentry/nextjs'
import type { NewsletterListItem } from '../../../../emails/components/email-newsletter-list'

const BATCH_SIZE = 50
const THROTTLE_MS = 100

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()

  const { data: pending } = await supabase
    .from('newsletter_subscriptions')
    .select('id, email, locale, site_id, newsletter_id')
    .eq('status', 'confirmed')
    .eq('welcome_sent', false)
    .limit(BATCH_SIZE)

  if (!pending?.length) {
    return Response.json({ status: 'ok', sent: 0 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'

  const grouped = new Map<string, typeof pending>()
  for (const sub of pending) {
    const key = `${sub.site_id}:${sub.email}`
    const group = grouped.get(key) ?? []
    group.push(sub)
    grouped.set(key, group)
  }

  let sentCount = 0

  for (const [, subs] of grouped) {
    const first = subs[0]
    const typeIds = subs.map((s) => s.newsletter_id)

    const { data: types } = await supabase
      .from('newsletter_types')
      .select('name, tagline, color, cadence_label')
      .in('id', typeIds)
      .eq('active', true)

    const newsletterNames: NewsletterListItem[] = (types ?? []).map((t) => ({
      name: t.name,
      tagline: t.tagline && t.cadence_label ? `${t.tagline} · ${t.cadence_label}` : (t.tagline ?? t.cadence_label ?? ''),
      color: t.color ?? '#FF8240',
    }))

    let latestArticle: { title: string; url: string; excerpt?: string } | undefined
    try {
      const { data: post } = await supabase
        .from('posts')
        .select('slug, title, excerpt')
        .eq('site_id', first.site_id)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (post) {
        const locale = first.locale ?? 'pt-BR'
        const prefix = locale === 'pt-BR' ? '/pt' : ''
        latestArticle = {
          title: post.title,
          url: `${appUrl}${prefix}/blog/${post.slug}`,
          excerpt: post.excerpt ?? undefined,
        }
      }
    } catch {
      // best-effort
    }

    try {
      await sendWelcomeEmail({
        to: first.email,
        locale: first.locale ?? 'pt-BR',
        newsletterNames,
        latestArticle,
      })

      const ids = subs.map((s) => s.id)
      await supabase
        .from('newsletter_subscriptions')
        .update({ welcome_sent: true })
        .in('id', ids)

      sentCount++
    } catch (err) {
      Sentry.captureException(err, {
        tags: { component: 'cron', job: 'send-welcome-emails' },
      })
    }

    await sleep(THROTTLE_MS)
  }

  return Response.json({ status: 'ok', sent: sentCount })
}
```

- [ ] **Step 6: Run full test suite to confirm no regressions**

Run: `cd apps/web && npx vitest run test/lib/newsletter/welcome-email`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/newsletter/welcome-email.ts apps/web/src/app/api/cron/send-welcome-emails/route.ts apps/web/test/lib/newsletter/welcome-email.test.ts
git commit -m "feat(email): add welcome email service and cron route using newsletter_pending_welcome index"
```

---

## Task 10: Email Styles Rebrand (Phase 3 prerequisite)

**Files:**
- Modify: `apps/web/lib/newsletter/email-styles.ts`
- Create: `apps/web/test/lib/newsletter/email-styles.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/newsletter/email-styles.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getEmailStylesheet } from '../../../lib/newsletter/email-styles'

describe('getEmailStylesheet', () => {
  it('defaults to branded accent #FF8240 instead of purple', () => {
    const css = getEmailStylesheet()
    expect(css).toContain('#FF8240')
    expect(css).not.toContain('#7c3aed')
  })

  it('uses type color when provided', () => {
    const css = getEmailStylesheet('#1F5F8B')
    expect(css).toContain('#1F5F8B')
  })

  it('uses branded ink color for headings', () => {
    const css = getEmailStylesheet()
    expect(css).toContain('#1F1B17')
  })

  it('uses branded muted color for body text', () => {
    const css = getEmailStylesheet()
    expect(css).toContain('#6A5F48')
  })

  it('includes drop cap styles', () => {
    const css = getEmailStylesheet()
    expect(css).toContain('.drop-cap')
  })

  it('includes pull quote styles', () => {
    const css = getEmailStylesheet()
    expect(css).toContain('blockquote')
  })

  it('includes subheading styles', () => {
    const css = getEmailStylesheet()
    expect(css).toContain('h2')
    expect(css).toContain('h3')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/newsletter/email-styles.test.ts`
Expected: FAIL — purple color still present, no drop-cap, etc.

- [ ] **Step 3: Rebrand email-styles.ts**

Replace the contents of `apps/web/lib/newsletter/email-styles.ts`:

```ts
const DEFAULT_COLOR = '#FF8240'

export function getEmailStylesheet(typeColor: string = DEFAULT_COLOR): string {
  return `
h1 { font-size:28px; font-weight:500; color:#1F1B17; margin:0 0 16px; font-family:Georgia,'Times New Roman',serif; letter-spacing:-0.02em; line-height:1.2; }
h2 { font-size:22px; font-weight:500; color:#1F1B17; margin:32px 0 12px; font-family:Georgia,'Times New Roman',serif; letter-spacing:-0.01em; line-height:1.3; }
h3 { font-size:18px; font-weight:600; color:#1F1B17; margin:24px 0 8px; font-family:Arial,Helvetica,sans-serif; line-height:1.4; }
p { font-size:16px; line-height:1.7; color:#6A5F48; margin:0 0 16px; font-family:Georgia,'Times New Roman',serif; }
a { color:${typeColor}; text-decoration:underline; }
blockquote { border-left:3px solid ${typeColor}; padding:12px 20px; margin:24px 0; color:#6A5F48; font-style:italic; background:#FBF6EC; }
img { max-width:600px; height:auto; border-radius:4px; display:block; margin:16px auto; }
ul, ol { padding-left:24px; margin:0 0 16px; }
li { margin-bottom:8px; font-size:16px; color:#6A5F48; font-family:Georgia,'Times New Roman',serif; line-height:1.7; }
hr { border:none; border-top:1px solid #E8DCC8; margin:32px 0; }
.cta-button { display:inline-block; padding:14px 32px; background:${typeColor}; color:#ffffff; border-radius:6px; text-decoration:none; font-weight:600; font-family:Arial,Helvetica,sans-serif; font-size:15px; }
.cta-wrapper { text-align:center; margin:28px 0; }
.drop-cap { float:left; font-size:3.2em; line-height:0.8; padding:4px 8px 0 0; color:#1F1B17; font-family:Georgia,'Times New Roman',serif; font-weight:500; }
`.trim()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/newsletter/email-styles.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/newsletter/email-styles.ts apps/web/test/lib/newsletter/email-styles.test.ts
git commit -m "fix(email): rebrand email-styles from purple #7c3aed to branded tokens #FF8240"
```

---

## Task 11: Edition Email Redesign + Critical Bug Fix (Phase 3)

**Files:**
- Modify: `apps/web/src/emails/newsletter.tsx`
- Modify: `apps/web/src/app/api/cron/send-scheduled-newsletters/route.ts`
- Create: `apps/web/test/lib/newsletter/newsletter-email-render.test.ts`

- [ ] **Step 1: Write the failing test for the new edition template**

Create `apps/web/test/lib/newsletter/newsletter-email-render.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { Newsletter } from '../../../src/emails/newsletter'

describe('Newsletter edition template', () => {
  const baseProps = {
    subject: 'Edition #1',
    contentHtml: '<p>Hello world</p>',
    typeName: 'Diário do bythiago',
    typeColor: '#FF8240',
    unsubscribeUrl: 'https://example.com/unsub',
    archiveUrl: 'https://example.com/archive',
  }

  it('renders with branded background', async () => {
    const html = await render(React.createElement(Newsletter, baseProps))
    expect(html).toContain('#F7F1E8')
  })

  it('renders TF monogram', async () => {
    const html = await render(React.createElement(Newsletter, baseProps))
    expect(html).toContain('#FF8240')
  })

  it('renders newsletter type name with border', async () => {
    const html = await render(React.createElement(Newsletter, baseProps))
    expect(html).toContain('Diário do bythiago')
  })

  it('renders content HTML', async () => {
    const html = await render(React.createElement(Newsletter, baseProps))
    expect(html).toContain('Hello world')
  })

  it('renders preheader when provided', async () => {
    const html = await render(
      React.createElement(Newsletter, { ...baseProps, preheader: 'Preview text here' })
    )
    expect(html).toContain('Preview text here')
  })

  it('includes end mark with fleuron', async () => {
    const html = await render(React.createElement(Newsletter, baseProps))
    expect(html).toContain('❦')
    expect(html).toContain('Thiago Figueiredo')
  })

  it('includes footer with unsubscribe and archive links', async () => {
    const html = await render(React.createElement(Newsletter, baseProps))
    expect(html).toContain('https://example.com/unsub')
    expect(html).toContain('https://example.com/archive')
  })

  it('includes dark mode styles', async () => {
    const html = await render(React.createElement(Newsletter, baseProps))
    expect(html).toContain('prefers-color-scheme: dark')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/newsletter/newsletter-email-render.test.ts`
Expected: FAIL — current template doesn't have branded bg, monogram, etc.

- [ ] **Step 3: Redesign newsletter.tsx**

Replace the contents of `apps/web/src/emails/newsletter.tsx`:

```tsx
import DOMPurify from 'isomorphic-dompurify'
import { Section, Text } from '@react-email/components'
import { EmailShell } from './components/email-shell'
import { EmailMonogram } from './components/email-monogram'
import { EmailDivider } from './components/email-divider'
import { EmailEndMark } from './components/email-end-mark'
import { EmailFooter } from './components/email-footer'
import { EMAIL_COLORS, EMAIL_FONTS } from './components/email-tokens'

interface NewsletterProps {
  subject: string
  preheader?: string
  contentHtml: string
  typeName: string
  typeColor: string
  unsubscribeUrl: string
  archiveUrl: string
}

export function Newsletter({
  subject,
  preheader,
  contentHtml,
  typeName,
  typeColor,
  unsubscribeUrl,
  archiveUrl,
}: NewsletterProps) {
  return (
    <EmailShell preheader={preheader}>
      <EmailMonogram />

      {/* Type indicator */}
      <Section style={{
        borderLeft: `3px solid ${typeColor}`,
        padding: '0 0 0 16px',
        margin: '0 32px 24px',
      }}>
        <Text className="email-faint" style={{
          fontFamily: EMAIL_FONTS.mono,
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: EMAIL_COLORS.faint,
          margin: 0,
          fontWeight: 500,
        }}>
          {typeName}
        </Text>
      </Section>

      {/* Content */}
      <Section style={{ padding: '0 32px' }}>
        <div
          className="email-ink"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contentHtml) }}
        />
      </Section>

      <EmailDivider />
      <EmailEndMark />
      <EmailDivider />
      <EmailFooter unsubscribeUrl={unsubscribeUrl} archiveUrl={archiveUrl} />
    </EmailShell>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/newsletter/newsletter-email-render.test.ts`
Expected: PASS

- [ ] **Step 5: Fix CRITICAL BUG — add sanitizeForEmail() to cron route**

In `apps/web/src/app/api/cron/send-scheduled-newsletters/route.ts`, add the sanitization call.

At the top of the file, add import:
```ts
import { sanitizeForEmail } from '../../../../../lib/newsletter/email-sanitizer'
```

In the `sendEdition` function, around line 208 (where `content_html` is passed to `Newsletter`), add sanitization BEFORE rendering:

Replace the block that builds the `Newsletter` props:
```ts
// Sanitize content HTML with branded styles BEFORE rendering the React Email template
const sanitizedContent = sanitizeForEmail(
  edition.content_html ?? `<p>${edition.content_mdx ?? edition.subject}</p>`,
  typeColor,
)

// Render the React Email template to HTML.
let html = await render(Newsletter({
  subject: edition.subject,
  preheader: edition.preheader ?? undefined,
  contentHtml: sanitizedContent,
  typeName,
  typeColor,
  unsubscribeUrl,
  archiveUrl,
}))
```

- [ ] **Step 6: Run existing tests to confirm no regressions**

Run: `cd apps/web && npx vitest run test/lib/newsletter/`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/emails/newsletter.tsx apps/web/src/app/api/cron/send-scheduled-newsletters/route.ts apps/web/test/lib/newsletter/newsletter-email-render.test.ts
git commit -m "fix(email): redesign edition template + fix critical cron bug skipping sanitizeForEmail()"
```

---

## Task 12: Confirm Page Redesign (Phase 4)

**Files:**
- Modify: `apps/web/src/app/newsletter/confirm/[token]/page.tsx`
- Modify: `apps/web/src/app/newsletter/confirm/[token]/error.tsx`

This is the largest task. The page needs responsive 3-tier layout (mobile/tablet/desktop), 680px card on desktop, 56px monogram outside card, latest article card on success, grain texture background, shimmer stripe animation on success, robots:noindex, loading skeleton, error boundary with Sentry.

- [ ] **Step 1: Redesign the confirm page**

Replace `apps/web/src/app/newsletter/confirm/[token]/page.tsx` with the full redesign. Key changes:

1. Add `import { Metadata } from 'next'` and export `metadata` with `robots: { index: false }`
2. Replace inline styles object with Tailwind CSS classes (the project uses Tailwind 4)
3. 680px max-width card on desktop, centered with `mx-auto`
4. 56px monogram outside the card
5. Grain texture CSS SVG filter on background
6. Shimmer stripe animation on success state
7. Newsletter list items (from DB) on success/already states
8. Latest article card on success
9. End mark + signature outside card
10. All 7 states: success, already, expired, not_found, error, invalid_state, invalid

The full implementation uses `@/lib/newsletter/queries` for newsletter types lookup after confirm succeeds, and CSS custom properties from `globals.css` for theme support.

```tsx
import { createHash } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { after } from 'next/server'
import type { Metadata } from 'next'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { captureServerActionError } from '../../../../lib/sentry-wrap'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

interface Props {
  params: Promise<{ token: string }>
}

interface ConfirmRpcResult {
  ok: boolean
  already?: boolean
  error?: 'not_found' | 'expired' | 'invalid_state'
  site_id?: string
  email?: string
  confirmed_count?: number
}

interface NlType {
  name: string
  tagline: string | null
  color: string
  colorDark: string | null
  cadenceLabel: string | null
}

const COPY = {
  'pt-BR': {
    invalid_title: 'Link inválido',
    invalid_body: 'Este link de confirmação é inválido.',
    rpc_error_title: 'Erro ao confirmar',
    rpc_error_body: 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
    not_found_title: 'Link não encontrado',
    not_found_body: 'Este link de confirmação não existe ou já foi utilizado.',
    expired_title: 'Link expirado',
    expired_body: 'Este link de confirmação expirou. Faça uma nova inscrição para receber um novo link.',
    invalid_state_title: 'Não foi possível confirmar',
    invalid_state_body: 'Ocorreu um problema com sua inscrição. Entre em contato caso o problema persista.',
    already_title: 'Já confirmado',
    already_body: 'Seu email já estava confirmado. Você continuará recebendo nossas newsletters.',
    ok_title: 'Inscrição confirmada!',
    ok_body: 'Obrigado por confirmar seu email. Você está inscrito e receberá as próximas edições.',
    back_home: 'Voltar ao início',
    subscribed_to: 'Suas newsletters:',
  },
  en: {
    invalid_title: 'Invalid link',
    invalid_body: 'This confirmation link is invalid.',
    rpc_error_title: 'Error confirming',
    rpc_error_body: 'An unexpected error occurred. Please try again later.',
    not_found_title: 'Link not found',
    not_found_body: 'This confirmation link does not exist or has already been used.',
    expired_title: 'Link expired',
    expired_body: 'This confirmation link has expired. Please subscribe again to receive a new link.',
    invalid_state_title: 'Unable to confirm',
    invalid_state_body: 'There was a problem with your subscription. Please contact us if the issue persists.',
    already_title: 'Already confirmed',
    already_body: 'Your email was already confirmed. You will continue to receive our newsletters.',
    ok_title: 'Subscription confirmed!',
    ok_body: "Thank you for confirming your email. You're subscribed and will receive upcoming editions.",
    back_home: 'Back to home',
    subscribed_to: 'Your newsletters:',
  },
} as const

type Locale = keyof typeof COPY
function pickCopy(locale: string | null | undefined) {
  return COPY[(locale && locale in COPY ? locale : 'pt-BR') as Locale]
}

type StateKind = 'success' | 'already' | 'expired' | 'not_found' | 'error' | 'invalid'

const STATE_COLORS: Record<StateKind, string> = {
  success: '#4CAF50',
  already: '#FF8240',
  expired: '#E5A100',
  not_found: '#958A75',
  error: '#C14513',
  invalid: '#C14513',
}

const STATE_ICONS: Record<StateKind, string> = {
  success: '✔',
  already: 'ℹ',
  expired: '⏳',
  not_found: '⁇',
  error: '⚠',
  invalid: '✕',
}

function localePath(locale: string | undefined): string {
  return locale === 'pt-BR' ? '/pt' : '/'
}

async function getSubscribedTypes(siteId: string, email: string): Promise<NlType[]> {
  try {
    const supabase = getSupabaseServiceClient()
    const { data: subs } = await supabase
      .from('newsletter_subscriptions')
      .select('newsletter_id')
      .eq('site_id', siteId)
      .eq('email', email)
      .eq('status', 'confirmed')

    if (!subs?.length) return []

    const typeIds = subs.map((s) => s.newsletter_id)
    const { data: types } = await supabase
      .from('newsletter_types')
      .select('name, tagline, color, color_dark, cadence_label')
      .in('id', typeIds)
      .eq('active', true)
      .order('sort_order')

    return (types ?? []).map((t) => ({
      name: t.name,
      tagline: t.tagline,
      color: t.color ?? '#FF8240',
      colorDark: t.color_dark,
      cadenceLabel: t.cadence_label,
    }))
  } catch {
    return []
  }
}

function ConfirmLayout({
  state,
  title,
  body,
  backLabel,
  lang,
  locale,
  newsletters,
  subscribedLabel,
}: {
  state: StateKind
  title: string
  body: string
  backLabel: string
  lang?: string
  locale?: string
  newsletters?: NlType[]
  subscribedLabel?: string
}) {
  const accent = STATE_COLORS[state]
  const icon = STATE_ICONS[state]
  const isSuccess = state === 'success'
  const showNl = newsletters && newsletters.length > 0

  return (
    <main
      lang={lang}
      className="min-h-screen flex items-center justify-center px-5 py-10"
      style={{
        background: 'var(--pb-bg, #1A1714)',
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
      }}
    >
      <div className="w-full max-w-[680px] text-center">
        {/* Monogram — outside card */}
        <div
          className="text-[56px] font-medium leading-none tracking-[-4px] mb-8"
          style={{
            fontFamily: 'var(--font-source-serif-var, Georgia), serif',
            color: 'var(--pb-ink, #F5EFE6)',
          }}
        >
          T<span className="italic" style={{ color: '#FF8240' }}>F</span>
          <span className="text-[8px] align-middle ml-0.5" style={{ color: 'var(--pb-ink, #F5EFE6)' }}>●</span>
        </div>

        {/* Card */}
        <div
          className="rounded-md overflow-hidden"
          style={{
            background: 'var(--pb-paper, #221E1A)',
            boxShadow: 'var(--pb-shadow, 0 2px 20px rgba(0,0,0,0.35))',
          }}
        >
          {/* Stripe */}
          <div
            className="h-1"
            style={{
              background: isSuccess
                ? `linear-gradient(90deg, transparent, ${accent}, transparent)`
                : 'var(--pb-line, #332D25)',
              animation: isSuccess ? 'shimmer 2s ease-in-out infinite' : 'none',
            }}
          />

          <div className="px-8 py-12 sm:px-14 sm:py-14">
            {/* Icon */}
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-full text-2xl leading-none mb-5"
              style={{ border: `2px solid ${accent}`, color: accent }}
              role="img"
              aria-hidden="true"
            >
              {icon}
            </div>

            {/* Accent line */}
            <div
              className="w-12 h-[3px] rounded-sm mx-auto mb-7"
              style={{ background: accent }}
            />

            {/* Title */}
            <h1
              className="text-[28px] sm:text-[34px] font-medium leading-tight mb-3"
              style={{
                fontFamily: 'var(--font-fraunces-var, Georgia), serif',
                color: 'var(--pb-ink, #F5EFE6)',
                letterSpacing: '-0.02em',
              }}
            >
              {title}
            </h1>

            {/* Body */}
            <p
              className="text-sm leading-relaxed max-w-[420px] mx-auto mb-8"
              style={{
                fontFamily: 'var(--font-jetbrains-var, monospace)',
                color: 'var(--pb-muted, #958A75)',
              }}
            >
              {body}
            </p>

            {/* Newsletter list */}
            {showNl && (
              <div className="text-left max-w-[360px] mx-auto mb-8">
                <p
                  className="text-xs font-medium uppercase tracking-[0.12em] mb-3"
                  style={{
                    fontFamily: 'var(--font-jetbrains-var, monospace)',
                    color: 'var(--pb-faint, #6B634F)',
                  }}
                >
                  {subscribedLabel}
                </p>
                <div className="flex flex-col gap-2.5">
                  {newsletters.map((nl, i) => (
                    <div
                      key={i}
                      className="pl-4 py-2.5"
                      style={{ borderLeft: `3px solid ${nl.color}` }}
                    >
                      <div
                        className="text-base font-medium leading-tight"
                        style={{
                          fontFamily: 'var(--font-fraunces-var, Georgia), serif',
                          color: 'var(--pb-ink, #F5EFE6)',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {nl.name}
                      </div>
                      {(nl.tagline || nl.cadenceLabel) && (
                        <div
                          className="text-xs mt-0.5"
                          style={{
                            fontFamily: 'var(--font-inter-var, Arial), sans-serif',
                            color: 'var(--pb-faint, #6B634F)',
                            letterSpacing: '0.02em',
                          }}
                        >
                          {[nl.tagline, nl.cadenceLabel].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Divider + home link */}
            <div
              className="w-8 h-px mx-auto mb-5"
              style={{ background: 'var(--pb-line, #332D25)' }}
            />
            <a
              href={localePath(locale)}
              className="text-xs font-medium uppercase tracking-[0.05em] no-underline pb-0.5 transition-colors duration-150"
              style={{
                fontFamily: 'var(--font-jetbrains-var, monospace)',
                color: 'var(--pb-muted, #958A75)',
                borderBottom: '1px dashed var(--pb-line, #332D25)',
              }}
            >
              {backLabel}
            </a>
          </div>
        </div>

        {/* End mark — outside card */}
        <div className="flex items-center justify-center gap-3.5 mt-9">
          <div className="w-9 h-px" style={{ background: 'var(--pb-line, #332D25)' }} />
          <span
            className="text-base leading-none"
            style={{
              fontFamily: 'var(--font-source-serif-var, Georgia), serif',
              color: '#FF8240',
            }}
          >
            ❦
          </span>
          <div className="w-9 h-px" style={{ background: 'var(--pb-line, #332D25)' }} />
        </div>

        {/* Signature — outside card */}
        <div className="mt-4 text-center">
          <p
            className="text-[13px] leading-relaxed"
            style={{
              fontFamily: 'var(--font-source-serif-var, Georgia), serif',
              color: 'var(--pb-faint, #6B634F)',
            }}
          >
            <span className="italic font-light opacity-70">tf</span>{' '}
            <span style={{ color: '#FF8240' }}>❦</span>{' '}
            <strong className="font-medium">Thiago Figueiredo</strong>
          </p>
          <p
            className="text-[11px] mt-0.5"
            style={{
              fontFamily: 'var(--font-inter-var, Arial), sans-serif',
              color: 'var(--pb-faint, #6B634F)',
              letterSpacing: '0.02em',
            }}
          >
            <a
              href="https://bythiagofigueiredo.com"
              className="no-underline"
              style={{ color: 'var(--pb-faint, #6B634F)' }}
            >
              bythiagofigueiredo.com
            </a>
          </p>
        </div>
      </div>

      {/* Shimmer animation */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}} />
    </main>
  )
}

export default async function NewsletterConfirmPage({ params }: Props) {
  const { token } = await params

  if (!token || typeof token !== 'string') {
    const c = pickCopy(null)
    return (
      <ConfirmLayout
        state="invalid"
        title={c.invalid_title}
        body={c.invalid_body}
        backLabel={c.back_home}
        locale="pt-BR"
      />
    )
  }

  try {
    const supabase = getSupabaseServiceClient()
    const tokenHash = createHash('sha256').update(token).digest('hex')

    let locale: string | null = null
    try {
      const { data: row } = await supabase
        .from('newsletter_subscriptions')
        .select('locale')
        .eq('confirmation_token_hash', tokenHash)
        .maybeSingle()
      locale = (row?.locale as string | null) ?? null
    } catch {
      /* best-effort */
    }

    const { data, error: rpcError } = await supabase.rpc('confirm_newsletter_subscription', {
      p_token_hash: tokenHash,
    })

    const result = (data ?? null) as ConfirmRpcResult | null

    if (!locale && result?.email && result.site_id) {
      try {
        const { data: row2 } = await supabase
          .from('newsletter_subscriptions')
          .select('locale')
          .eq('site_id', result.site_id)
          .eq('email', result.email)
          .limit(1)
          .maybeSingle()
        locale = (row2?.locale as string | null) ?? null
      } catch {
        /* best-effort */
      }
    }

    const c = pickCopy(locale)
    const lang = locale === 'en' ? 'en' : 'pt-BR'

    if (rpcError || !result) {
      if (rpcError) captureServerActionError(rpcError, { action: 'confirm_newsletter' })
      return (
        <ConfirmLayout
          state="error"
          title={c.rpc_error_title}
          body={c.rpc_error_body}
          backLabel={c.back_home}
          lang={lang}
          locale={lang}
        />
      )
    }

    if (!result.ok) {
      if (result.error === 'not_found') {
        return (
          <ConfirmLayout
            state="not_found"
            title={c.not_found_title}
            body={c.not_found_body}
            backLabel={c.back_home}
            lang={lang}
          />
        )
      }
      if (result.error === 'expired') {
        return (
          <ConfirmLayout
            state="expired"
            title={c.expired_title}
            body={c.expired_body}
            backLabel={c.back_home}
            lang={lang}
          />
        )
      }
      return (
        <ConfirmLayout
          state="error"
          title={c.invalid_state_title}
          body={c.invalid_state_body}
          backLabel={c.back_home}
          lang={lang}
          locale={lang}
        />
      )
    }

    let newsletters: NlType[] = []
    if (result.email && result.site_id) {
      newsletters = await getSubscribedTypes(result.site_id, result.email)
    }

    if (result.already) {
      return (
        <ConfirmLayout
          state="already"
          title={c.already_title}
          body={c.already_body}
          backLabel={c.back_home}
          lang={lang}
          locale={lang}
          newsletters={newsletters}
          subscribedLabel={c.subscribed_to}
        />
      )
    }

    after(() => revalidateTag('newsletter-suggestions'))

    return (
      <ConfirmLayout
        state="success"
        title={c.ok_title}
        body={c.ok_body}
        backLabel={c.back_home}
        lang={lang}
        newsletters={newsletters}
        subscribedLabel={c.subscribed_to}
      />
    )
  } catch (err) {
    captureServerActionError(err, { action: 'confirm_newsletter', branch: 'outer_catch' })
    const c = pickCopy(null)
    return (
      <ConfirmLayout
        state="error"
        title={c.rpc_error_title}
        body={c.rpc_error_body}
        backLabel={c.back_home}
        locale="pt-BR"
      />
    )
  }
}
```

- [ ] **Step 2: Update error.tsx to match visual system + add Sentry**

Replace `apps/web/src/app/newsletter/confirm/[token]/error.tsx`:

```tsx
'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

const COPY = {
  en: {
    title: 'Something went wrong',
    body: 'An unexpected error occurred while confirming your subscription. Please try again later.',
    retry: 'Try again',
    back: 'Back to home',
  },
  'pt-BR': {
    title: 'Algo deu errado',
    body: 'Ocorreu um erro inesperado ao confirmar sua inscrição. Tente novamente mais tarde.',
    retry: 'Tentar novamente',
    back: 'Voltar ao início',
  },
} as const

function detectLocale(): keyof typeof COPY {
  if (typeof window === 'undefined') return 'pt-BR'
  if (window.location.pathname.startsWith('/pt')) return 'pt-BR'
  return 'en'
}

export default function ConfirmError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const loc = detectLocale()
  const c = COPY[loc]

  useEffect(() => {
    Sentry.captureException(error, {
      tags: { component: 'newsletter-confirm', boundary: 'error' },
    })
  }, [error])

  return (
    <main
      lang={loc === 'pt-BR' ? 'pt-BR' : 'en'}
      className="min-h-screen flex items-center justify-center px-5 py-10"
      style={{ background: 'var(--pb-bg, #1A1714)' }}
    >
      <div className="w-full max-w-[680px] text-center">
        {/* Monogram */}
        <div
          className="text-[56px] font-medium leading-none tracking-[-4px] mb-8"
          style={{
            fontFamily: 'var(--font-source-serif-var, Georgia), serif',
            color: 'var(--pb-ink, #F5EFE6)',
          }}
        >
          T<span className="italic" style={{ color: '#FF8240' }}>F</span>
          <span className="text-[8px] align-middle ml-0.5" style={{ color: 'var(--pb-ink, #F5EFE6)' }}>●</span>
        </div>

        {/* Card */}
        <div
          className="rounded-md overflow-hidden"
          style={{
            background: 'var(--pb-paper, #221E1A)',
            boxShadow: 'var(--pb-shadow, 0 2px 20px rgba(0,0,0,0.35))',
          }}
        >
          <div className="h-1" style={{ background: 'var(--pb-line, #332D25)' }} />
          <div className="px-8 py-12 sm:px-14 sm:py-14">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-full text-2xl leading-none mb-5"
              style={{ border: '2px solid #C14513', color: '#C14513' }}
              role="img"
              aria-hidden="true"
            >
              ⚠
            </div>

            <div className="w-12 h-[3px] rounded-sm mx-auto mb-7" style={{ background: '#C14513' }} />

            <h1
              className="text-[28px] sm:text-[34px] font-medium leading-tight mb-3"
              style={{
                fontFamily: 'var(--font-fraunces-var, Georgia), serif',
                color: 'var(--pb-ink, #F5EFE6)',
                letterSpacing: '-0.02em',
              }}
            >
              {c.title}
            </h1>

            <p
              className="text-sm leading-relaxed max-w-[420px] mx-auto mb-6"
              style={{
                fontFamily: 'var(--font-jetbrains-var, monospace)',
                color: 'var(--pb-muted, #958A75)',
              }}
            >
              {c.body}
            </p>

            <button
              onClick={reset}
              className="text-sm font-semibold px-5 py-2.5 rounded-md cursor-pointer border-none mb-4"
              style={{
                fontFamily: 'var(--font-jetbrains-var, monospace)',
                background: '#C14513',
                color: '#fff',
              }}
            >
              {c.retry}
            </button>

            <div className="w-8 h-px mx-auto mb-5 mt-4" style={{ background: 'var(--pb-line, #332D25)' }} />
            <a
              href={loc === 'pt-BR' ? '/pt' : '/'}
              className="text-xs font-medium uppercase tracking-[0.05em] no-underline pb-0.5"
              style={{
                fontFamily: 'var(--font-jetbrains-var, monospace)',
                color: 'var(--pb-muted, #958A75)',
                borderBottom: '1px dashed var(--pb-line, #332D25)',
              }}
            >
              {c.back}
            </a>
          </div>
        </div>

        {/* End mark */}
        <div className="flex items-center justify-center gap-3.5 mt-9">
          <div className="w-9 h-px" style={{ background: 'var(--pb-line, #332D25)' }} />
          <span className="text-base leading-none" style={{ fontFamily: 'var(--font-source-serif-var, Georgia), serif', color: '#FF8240' }}>❦</span>
          <div className="w-9 h-px" style={{ background: 'var(--pb-line, #332D25)' }} />
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Run all tests to confirm no regressions**

Run: `cd apps/web && npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/newsletter/confirm/
git commit -m "feat(page): redesign confirm page with branded visual system, responsive layout, Sentry error boundary"
```

---

## Task 13: Unsubscribe Page Redesign (Phase 5)

**Files:**
- Modify: `apps/web/src/app/unsubscribe/[token]/page.tsx`
- Modify: `apps/web/src/app/unsubscribe/[token]/actions.ts`

- [ ] **Step 1: Redesign unsubscribe page**

Replace `apps/web/src/app/unsubscribe/[token]/page.tsx` with branded visual system. Key changes:

1. Same responsive layout as confirm page (680px card, monogram outside)
2. Two-step flow: GET renders confirm button (safe), POST triggers unsubscribe
3. On success, show list of removed newsletters (strikethrough) and still-active newsletters
4. Muted card stripe (not orange — this is a departure, not arrival)
5. Farewell fleuron ❦ in muted color
6. "Gerenciar preferências" links to newsletter hub for re-subscribe
7. All 6 states: initial, ok, already, not_found, error, invalid

```tsx
import { createHash } from 'node:crypto'
import type { Metadata } from 'next'
import { unsubscribeViaToken } from './actions'
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'

interface Props {
  params: Promise<{ token: string }>
  searchParams: Promise<{ confirmed?: string }>
}

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  other: { 'cache-control': 'no-store' },
}

const COPY = {
  'pt-BR': {
    invalid_title: 'Link inválido',
    invalid_body: 'Este link de cancelamento é inválido.',
    not_found_title: 'Link não encontrado',
    not_found_body: 'Este link de cancelamento não existe ou já foi removido.',
    error_title: 'Erro ao processar',
    error_body: 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
    already_title: 'Já cancelado',
    already_body: 'Você já estava cancelado da nossa newsletter. Não enviaremos mais emails.',
    ok_title: 'Inscrição cancelada',
    ok_body: 'Você foi removido com sucesso.',
    ok_signoff: 'Sem ressentimentos. A porta fica aberta.',
    initial_title: 'Cancelar inscrição',
    initial_body: 'Clique no botão abaixo para confirmar o cancelamento.',
    initial_button: 'Cancelar minha inscrição',
    back_home: 'Ir para o site',
    manage: 'Gerenciar preferências',
  },
  en: {
    invalid_title: 'Invalid link',
    invalid_body: 'This unsubscribe link is invalid.',
    not_found_title: 'Link not found',
    not_found_body: 'This unsubscribe link does not exist or has already been removed.',
    error_title: 'Error processing',
    error_body: 'An unexpected error occurred. Please try again later.',
    already_title: 'Already unsubscribed',
    already_body: 'You were already unsubscribed. We will not send you any more emails.',
    ok_title: 'Unsubscribed',
    ok_body: 'You have been removed successfully.',
    ok_signoff: 'No hard feelings. The door stays open.',
    initial_title: 'Unsubscribe',
    initial_body: 'Click the button below to confirm unsubscribing.',
    initial_button: 'Unsubscribe me',
    back_home: 'Go to site',
    manage: 'Manage preferences',
  },
} as const

type Locale = keyof typeof COPY
function pickCopy(locale: string | null | undefined) {
  return COPY[(locale && locale in COPY ? locale : 'pt-BR') as Locale]
}

async function lookupLocale(token: string): Promise<string | null> {
  try {
    const supabase = getSupabaseServiceClient()
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const { data: tokRow } = await supabase
      .from('unsubscribe_tokens')
      .select('site_id, email')
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (!tokRow) return null
    const { data: subRow } = await supabase
      .from('newsletter_subscriptions')
      .select('locale')
      .eq('site_id', tokRow.site_id)
      .eq('email', tokRow.email)
      .maybeSingle()
    return (subRow?.locale as string | null) ?? null
  } catch {
    return null
  }
}

type StateKind = 'initial' | 'ok' | 'already' | 'not_found' | 'error' | 'invalid'

const STATE_COLORS: Record<StateKind, string> = {
  initial: '#958A75',
  ok: '#958A75',
  already: '#FF8240',
  not_found: '#958A75',
  error: '#C14513',
  invalid: '#C14513',
}

const STATE_ICONS: Record<StateKind, string> = {
  initial: '❦',
  ok: '❦',
  already: 'ℹ',
  not_found: '⁇',
  error: '⚠',
  invalid: '✕',
}

function UnsubLayout({
  state,
  title,
  body,
  signoff,
  lang,
  homeLabel,
  manageLabel,
  children,
}: {
  state: StateKind
  title: string
  body: string
  signoff?: string
  lang?: string
  homeLabel: string
  manageLabel: string
  children?: React.ReactNode
}) {
  const accent = STATE_COLORS[state]
  const icon = STATE_ICONS[state]

  return (
    <main
      lang={lang}
      className="min-h-screen flex items-center justify-center px-5 py-10"
      style={{
        background: 'var(--pb-bg, #1A1714)',
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
      }}
    >
      <div className="w-full max-w-[680px] text-center">
        {/* Monogram */}
        <div
          className="text-[56px] font-medium leading-none tracking-[-4px] mb-8"
          style={{
            fontFamily: 'var(--font-source-serif-var, Georgia), serif',
            color: 'var(--pb-ink, #F5EFE6)',
          }}
        >
          T<span className="italic" style={{ color: '#FF8240' }}>F</span>
          <span className="text-[8px] align-middle ml-0.5" style={{ color: 'var(--pb-ink, #F5EFE6)' }}>●</span>
        </div>

        {/* Card */}
        <div
          className="rounded-md overflow-hidden"
          style={{
            background: 'var(--pb-paper, #221E1A)',
            boxShadow: 'var(--pb-shadow, 0 2px 20px rgba(0,0,0,0.35))',
          }}
        >
          {/* Muted stripe */}
          <div className="h-1" style={{ background: 'var(--pb-line, #332D25)' }} />

          <div className="px-8 py-12 sm:px-14 sm:py-14">
            {/* Icon/fleuron */}
            <div
              className="text-4xl leading-none mb-7"
              style={{
                fontFamily: 'var(--font-source-serif-var, Georgia), serif',
                color: accent,
              }}
            >
              {icon}
            </div>

            <h1
              className="text-[28px] sm:text-[34px] font-medium leading-tight mb-4"
              style={{
                fontFamily: 'var(--font-fraunces-var, Georgia), serif',
                color: 'var(--pb-ink, #F5EFE6)',
                letterSpacing: '-0.02em',
              }}
            >
              {title}
            </h1>

            <p
              className="text-[17px] leading-relaxed mb-0"
              style={{
                fontFamily: 'var(--font-source-serif-var, Georgia), serif',
                color: 'var(--pb-muted, #958A75)',
              }}
            >
              {body}
            </p>

            {children}

            {signoff && (
              <p
                className="text-base mt-6"
                style={{
                  fontFamily: 'var(--font-source-serif-var, Georgia), serif',
                  color: 'var(--pb-muted, #958A75)',
                  lineHeight: '1.6',
                }}
              >
                {signoff}
                <br />— Thiago
              </p>
            )}

            {/* Divider */}
            <div className="h-px my-8" style={{ background: 'var(--pb-line, #332D25)' }} />

            {/* Actions */}
            <div className="flex flex-col items-center gap-4">
              <a
                href="https://bythiagofigueiredo.com"
                className="text-sm no-underline transition-colors duration-200"
                style={{
                  fontFamily: 'var(--font-inter-var, Arial), sans-serif',
                  color: 'var(--pb-faint, #6B634F)',
                  fontWeight: 500,
                }}
              >
                {homeLabel} →
              </a>
            </div>
          </div>
        </div>

        {/* End mark */}
        <div className="flex items-center justify-center gap-3.5 mt-9">
          <div className="w-9 h-px" style={{ background: 'var(--pb-line, #332D25)' }} />
          <span
            className="text-base leading-none"
            style={{
              fontFamily: 'var(--font-source-serif-var, Georgia), serif',
              color: '#FF8240',
            }}
          >
            ❦
          </span>
          <div className="w-9 h-px" style={{ background: 'var(--pb-line, #332D25)' }} />
        </div>

        {/* Signature */}
        <div className="mt-4 text-center">
          <p
            className="text-[13px] leading-relaxed"
            style={{
              fontFamily: 'var(--font-source-serif-var, Georgia), serif',
              color: 'var(--pb-faint, #6B634F)',
            }}
          >
            <span className="italic font-light opacity-70">tf</span>{' '}
            <span style={{ color: '#FF8240' }}>❦</span>{' '}
            <strong className="font-medium">Thiago Figueiredo</strong>
          </p>
          <p
            className="text-[11px] mt-0.5"
            style={{
              fontFamily: 'var(--font-inter-var, Arial), sans-serif',
              color: 'var(--pb-faint, #6B634F)',
              letterSpacing: '0.02em',
            }}
          >
            <a
              href="https://bythiagofigueiredo.com"
              className="no-underline"
              style={{ color: 'var(--pb-faint, #6B634F)' }}
            >
              bythiagofigueiredo.com
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}

async function confirmUnsubscribe(token: string): Promise<void> {
  'use server'
  const result = await unsubscribeViaToken(token)
  const { redirect } = await import('next/navigation')
  redirect(`/unsubscribe/${encodeURIComponent(token)}?confirmed=${result.status}`)
}

export default async function UnsubscribePage({ params, searchParams }: Props) {
  const { token } = await params
  const { confirmed } = await searchParams

  if (!token || typeof token !== 'string') {
    const c = pickCopy(null)
    return (
      <UnsubLayout
        state="invalid"
        title={c.invalid_title}
        body={c.invalid_body}
        homeLabel={c.back_home}
        manageLabel={c.manage}
      />
    )
  }

  const locale = await lookupLocale(token)
  const c = pickCopy(locale)
  const lang = locale === 'en' ? 'en' : 'pt-BR'

  if (confirmed) {
    if (confirmed === 'not_found') {
      return (
        <UnsubLayout state="not_found" title={c.not_found_title} body={c.not_found_body} lang={lang} homeLabel={c.back_home} manageLabel={c.manage} />
      )
    }
    if (confirmed === 'error') {
      return (
        <UnsubLayout state="error" title={c.error_title} body={c.error_body} lang={lang} homeLabel={c.back_home} manageLabel={c.manage} />
      )
    }
    if (confirmed === 'already') {
      return (
        <UnsubLayout state="already" title={c.already_title} body={c.already_body} lang={lang} homeLabel={c.back_home} manageLabel={c.manage} />
      )
    }
    return (
      <UnsubLayout
        state="ok"
        title={c.ok_title}
        body={c.ok_body}
        signoff={c.ok_signoff}
        lang={lang}
        homeLabel={c.back_home}
        manageLabel={c.manage}
      />
    )
  }

  return (
    <UnsubLayout
      state="initial"
      title={c.initial_title}
      body={c.initial_body}
      lang={lang}
      homeLabel={c.back_home}
      manageLabel={c.manage}
    >
      <form
        action={async () => {
          'use server'
          await confirmUnsubscribe(token)
        }}
        method="post"
        className="mt-8"
      >
        <button
          type="submit"
          className="inline-block text-sm font-semibold px-8 py-3 rounded border-none cursor-pointer transition-transform duration-150 active:translate-y-0"
          style={{
            fontFamily: 'var(--font-inter-var, Arial), sans-serif',
            background: 'transparent',
            color: '#C14513',
            border: '1.5px solid #C14513',
          }}
        >
          {c.initial_button}
        </button>
      </form>
    </UnsubLayout>
  )
}
```

- [ ] **Step 2: Run all tests to confirm no regressions**

Run: `cd apps/web && npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/unsubscribe/
git commit -m "feat(page): redesign unsubscribe page with branded visual system, two-step flow"
```

---

## Task 14: Full Test Suite Validation

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`
Expected: ALL PASS (api + web)

- [ ] **Step 2: Run TypeScript type checking**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Verify no unused imports or dead code**

Run: `cd apps/web && grep -r "email-header" src/ lib/ --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: No references to deleted `email-header.tsx`

- [ ] **Step 4: Final commit if needed**

If any fixes were required:
```bash
git add -A && git commit -m "fix: address test/type failures in newsletter visual system"
```
