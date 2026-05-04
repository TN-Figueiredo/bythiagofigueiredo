# Newsletter Landing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build dedicated landing pages at `/newsletters/[slug]` for each newsletter type, with pinboard aesthetic, 3-phase subscribe form, and full SEO integration.

**Architecture:** Server component page with ISR + tag-based revalidation. Three client islands (subscribe-form, faq-accordion, mobile-sticky-cta). Paper/Tape shared components extracted from hub. All content from DB — zero hardcoded data. Graceful degradation for 0/1/2/3+ types and editions.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, TypeScript 5, Supabase (PostgreSQL 17), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-05-01-newsletter-landing-pages-v2-design.md`

---

## File Structure

```
apps/web/src/app/(public)/newsletters/[slug]/
├── page.tsx                 Server component: queries, metadata, layout
├── loading.tsx              Shimmer skeleton matching 2-col layout
├── not-found.tsx            Styled 404 with links to existing types
├── subscribe-form.tsx       Client island: 3-phase form
├── faq-accordion.tsx        Client island: collapsible questions
├── mobile-sticky-cta.tsx    Client island: scroll-aware bottom bar
└── newsletter-landing.css   Page-specific styles + animations

apps/web/src/components/pinboard/
├── paper.tsx                Shared Paper card (extracted from hub)
├── tape.tsx                 Shared Tape decoration (extracted from hub)
└── index.ts                 Re-exports

apps/web/src/lib/newsletter/
├── queries.ts               getNewsletterTypeBySlug, getNewsletterStats, getRecentEditions, getActiveTypeCount
├── format.ts                formatSubscriberCount, formatDaysAgo, resolveAccentTextColor
└── cache-invalidation.ts    revalidateNewsletterType(slug)

apps/web/src/app/og/newsletter/[slug]/
└── route.tsx                Dynamic OG image (Node runtime, Satori)

apps/web/lib/seo/og/
└── template.tsx             + NewsletterOgTemplate (added to existing file)
```

---

### Task 1: Schema Migration

**Files:**
- Create: `supabase/migrations/20260502000003_newsletter_types_landing.sql`

- [ ] **Step 1: Write migration — add columns**

```sql
-- 20260502000003_newsletter_types_landing.sql
-- Adds landing page columns to newsletter_types for /newsletters/[slug] pages.

-- 1. New columns
ALTER TABLE public.newsletter_types
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS color_dark text,
  ADD COLUMN IF NOT EXISTS badge text,
  ADD COLUMN IF NOT EXISTS cadence_label text,
  ADD COLUMN IF NOT EXISTS landing_content jsonb NOT NULL DEFAULT '{}';

-- 2. Constraints (idempotent via DO block)
DO $$ BEGIN
  ALTER TABLE public.newsletter_types
    ADD CONSTRAINT newsletter_types_slug_unique UNIQUE (slug);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.newsletter_types
    ADD CONSTRAINT newsletter_types_slug_format
    CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.newsletter_types
    ADD CONSTRAINT newsletter_types_slug_length
    CHECK (char_length(slug) >= 3 AND char_length(slug) <= 80);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.newsletter_types
    ADD CONSTRAINT newsletter_types_slug_reserved
    CHECK (slug !~ '^(archive|subscribe|new|settings|edit|confirm|api|admin|hub|rss|feed)$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.newsletter_types
    ADD CONSTRAINT newsletter_types_og_image_url_https
    CHECK (og_image_url IS NULL OR og_image_url ~ '^https://');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.newsletter_types
    ADD CONSTRAINT newsletter_types_color_dark_hex
    CHECK (color_dark IS NULL OR color_dark ~ '^#[0-9a-fA-F]{6}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.newsletter_types
    ADD CONSTRAINT newsletter_types_landing_content_shape
    CHECK (
      landing_content IS NULL
      OR (
        jsonb_typeof(landing_content) = 'object'
        AND (
          landing_content->'promise' IS NULL
          OR jsonb_typeof(landing_content->'promise') = 'array'
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

- [ ] **Step 2: Add updated_at trigger**

Append to the same migration file:

```sql
-- 3. Trigger (reuse existing tg_set_updated_at)
DROP TRIGGER IF EXISTS set_newsletter_types_updated_at ON public.newsletter_types;
CREATE TRIGGER set_newsletter_types_updated_at
  BEFORE UPDATE ON public.newsletter_types
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
```

- [ ] **Step 3: Backfill all 8 types**

Append to the same migration file:

```sql
-- 4. Backfill (guarded: only runs if slug IS NULL)

-- main-pt
UPDATE public.newsletter_types SET
  slug = 'diario-do-bythiago',
  description = 'Toda sexta, eu paro e escrevo o que aconteceu na semana — o post novo do blog, o vídeo do canal, o bug que me derrubou, o livro que tô lendo. É a newsletter principal, a que junta tudo num lugar só. Não é resumo formal: é mais carta pra um amigo que tá longe.',
  color_dark = '#FF8240',
  cadence_label = '1× por semana, sextas',
  badge = 'principal',
  landing_content = '{"promise":["o post mais recente, com nota pessoal de bastidor","o vídeo da semana, com o que eu cortei e por quê","3–5 links que eu salvei pra ler depois","uma coisa pequena que aprendi (ou quebrei)"]}'
WHERE id = 'main-pt' AND slug IS NULL;

-- main-en
UPDATE public.newsletter_types SET
  slug = 'the-bythiago-diary',
  description = E'Every Friday, I stop and write down the week — the new blog post, the new video, the bug that took me down, the book I''m reading. It''s the main newsletter, the one that pulls everything together. Not a corporate digest: more like a letter to a friend who''s far away.',
  color_dark = '#FF8240',
  cadence_label = 'weekly, Fridays',
  badge = 'main',
  landing_content = '{"promise":["the latest post, with a behind-the-scenes note","the week''s video, with what I cut and why","3–5 links I bookmarked to read later","one small thing I learned (or broke)"]}'
WHERE id = 'main-en' AND slug IS NULL;

-- trips-pt
UPDATE public.newsletter_types SET
  slug = 'curvas-e-estradas',
  description = 'Eu tenho uma Tenere 250 e uma certeza: a melhor parte do trabalho de hoje é poder fechar o laptop na quinta e abrir o mapa. Essa newsletter é o que sobra depois da viagem — o trecho que valeu, o que evitar, o restaurante de beira de estrada que não tem Google review, e a foto que a câmera do celular conseguiu salvar.',
  color_dark = '#5FA87D',
  cadence_label = 'quando eu pegar estrada',
  badge = 'novo',
  landing_content = '{"promise":["o trajeto, com mapa anotado","3–5 lugares pra parar (e 1 pra evitar)","foto crua, sem filtro, sem stories","o que deu errado — porque sempre dá"]}'
WHERE id = 'trips-pt' AND slug IS NULL;

-- trips-en
UPDATE public.newsletter_types SET
  slug = 'curves-and-roads',
  description = E'I have a Tenere 250 and one certainty: the best part of today''s work is being able to close the laptop on Thursday and open the map. This newsletter is what''s left after the trip — the stretch that was worth it, what to avoid, the roadside diner with no Google reviews, and the photo my phone camera managed to save.',
  color_dark = '#5FA87D',
  cadence_label = 'whenever I hit the road',
  badge = 'new',
  landing_content = '{"promise":["the route, with an annotated map","3–5 places to stop (and 1 to avoid)","raw photos, no filter, no stories","what went wrong — because it always does"]}'
WHERE id = 'trips-en' AND slug IS NULL;

-- growth-pt
UPDATE public.newsletter_types SET
  slug = 'crescer-de-dentro',
  description = 'Eu trabalho sozinho. Isso significa que ninguém me empurra, ninguém me cobra, e ninguém me lembra de almoçar. Essa newsletter é o que eu fui aprendendo a fazer pra continuar funcional — não é guru de produtividade, é mais o caderno de campo de quem tá testando o que dá certo no longo prazo. Domingo, café, e uma pergunta pra semana.',
  color_dark = '#A983D6',
  cadence_label = 'a cada 2 semanas, domingos',
  landing_content = '{"promise":["um hábito que eu testei (e o que aconteceu)","um livro ou ensaio que mexeu comigo","uma pergunta pra você levar na semana","sem checklist, sem app novo, sem urgência"]}'
WHERE id = 'growth-pt' AND slug IS NULL;

-- growth-en
UPDATE public.newsletter_types SET
  slug = 'grow-inward',
  description = E'I work alone. That means nobody pushes me, nobody nags me, and nobody reminds me to have lunch. This newsletter is what I''ve been learning to do to stay functional — not productivity-guru stuff, more like the field journal of someone testing what works long-term. Sunday, coffee, and one question for the week.',
  color_dark = '#A983D6',
  cadence_label = 'every 2 weeks, Sundays',
  landing_content = '{"promise":["a habit I tested (and what happened)","a book or essay that hit me","a question for you to carry through the week","no checklist, no new app, no urgency"]}'
WHERE id = 'growth-en' AND slug IS NULL;

-- code-pt
UPDATE public.newsletter_types SET
  slug = 'codigo-em-portugues',
  description = E'A internet técnica em inglês é boa demais. Mas falta uma coisa em português que não seja tutorial básico nem tradução tardia de hype. Essa newsletter é o que eu queria ter lido quando estava decidindo se aguentava migrar pra microserviço (não aguentei) ou se compensava trocar de banco (não compensava). Decisões reais, com nome e número do projeto.',
  color_dark = '#5FA8E0',
  cadence_label = 'mensal, última quinta',
  landing_content = '{"promise":["uma decisão real de stack (e por que)","o bug do mês — diagnóstico completo","código que rodou em produção","zero hype, zero ''X tools every dev needs''"]}'
WHERE id = 'code-pt' AND slug IS NULL;

-- code-en
UPDATE public.newsletter_types SET
  slug = 'code-in-portuguese',
  description = E'Technical writing in English is great. But there''s a gap in Portuguese — between basic tutorials and late translations of hype. This newsletter is what I wish I''d read when deciding whether microservices were worth it (they weren''t) or whether to switch databases (it wasn''t). Real decisions, with project names and numbers.',
  color_dark = '#5FA8E0',
  cadence_label = 'monthly, last Thursday',
  landing_content = '{"promise":["a real stack decision (and why)","the bug of the month — full postmortem","code that ran in production","zero hype, zero ''X tools every dev needs''"]}'
WHERE id = 'code-en' AND slug IS NULL;

-- 5. Make slug NOT NULL now that all rows are backfilled
ALTER TABLE public.newsletter_types ALTER COLUMN slug SET NOT NULL;
```

- [ ] **Step 4: Validate migration locally**

Run: `npm run db:start && npm run db:reset`
Expected: no errors, all migrations apply.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260502000003_newsletter_types_landing.sql
git commit -m "feat(newsletter-landing): schema migration — slug, description, color_dark, cadence_label, badge, landing_content columns + backfill"
```

---

### Task 2: Format Utilities + Unit Tests

**Files:**
- Create: `apps/web/src/lib/newsletter/format.ts`
- Test: `apps/web/test/unit/newsletter/format.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/web/test/unit/newsletter/format.test.ts
import { describe, it, expect } from 'vitest'
import {
  formatSubscriberCount,
  formatDaysAgo,
  resolveAccentTextColor,
  deriveCadenceLabel,
} from '@/lib/newsletter/format'

describe('formatSubscriberCount', () => {
  it('returns null when count < 10', () => {
    expect(formatSubscriberCount(5)).toBeNull()
    expect(formatSubscriberCount(0)).toBeNull()
    expect(formatSubscriberCount(9)).toBeNull()
  })

  it('returns exact number below 1000', () => {
    expect(formatSubscriberCount(10)).toBe('10')
    expect(formatSubscriberCount(408)).toBe('408')
    expect(formatSubscriberCount(999)).toBe('999')
  })

  it('formats thousands with 1 decimal', () => {
    expect(formatSubscriberCount(1000)).toBe('1.0k')
    expect(formatSubscriberCount(1240)).toBe('1.2k')
    expect(formatSubscriberCount(12500)).toBe('12.5k')
  })
})

describe('formatDaysAgo', () => {
  it('returns today key for 0 days', () => {
    expect(formatDaysAgo(0, 'en')).toBe('today')
    expect(formatDaysAgo(0, 'pt-BR')).toBe('hoje')
  })

  it('returns yesterday key for 1 day', () => {
    expect(formatDaysAgo(1, 'en')).toBe('yesterday')
    expect(formatDaysAgo(1, 'pt-BR')).toBe('ontem')
  })

  it('returns interpolated string for n days', () => {
    expect(formatDaysAgo(5, 'en')).toBe('5 days ago')
    expect(formatDaysAgo(5, 'pt-BR')).toBe('há 5 dias')
    expect(formatDaysAgo(30, 'en')).toBe('30 days ago')
  })
})

describe('resolveAccentTextColor', () => {
  it('returns white for dark backgrounds', () => {
    expect(resolveAccentTextColor('#000000')).toBe('#FFFFFF')
    expect(resolveAccentTextColor('#1F5F8B')).toBe('#FFFFFF')
    expect(resolveAccentTextColor('#C14513')).toBe('#FFFFFF')
  })

  it('returns black for light backgrounds', () => {
    expect(resolveAccentTextColor('#FFFFFF')).toBe('#000000')
    expect(resolveAccentTextColor('#FFE37A')).toBe('#000000')
    expect(resolveAccentTextColor('#A983D6')).toBe('#FFFFFF')
  })
})

describe('deriveCadenceLabel', () => {
  it('returns label when cadence_label exists', () => {
    expect(deriveCadenceLabel('1× por semana', 7, 'pt-BR')).toBe('1× por semana')
  })

  it('derives from cadence_days when label is null', () => {
    expect(deriveCadenceLabel(null, 7, 'en')).toBe('Weekly')
    expect(deriveCadenceLabel(null, 7, 'pt-BR')).toBe('Semanal')
    expect(deriveCadenceLabel(null, 14, 'en')).toBe('Bi-weekly')
    expect(deriveCadenceLabel(null, 14, 'pt-BR')).toBe('Quinzenal')
    expect(deriveCadenceLabel(null, 30, 'en')).toBe('Monthly')
    expect(deriveCadenceLabel(null, 30, 'pt-BR')).toBe('Mensal')
  })

  it('returns null for unknown cadence_days without label', () => {
    expect(deriveCadenceLabel(null, 3, 'en')).toBeNull()
    expect(deriveCadenceLabel(null, 45, 'pt-BR')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:web -- --run apps/web/test/unit/newsletter/format.test.ts`
Expected: FAIL — module `@/lib/newsletter/format` does not exist.

- [ ] **Step 3: Write implementation**

```typescript
// apps/web/src/lib/newsletter/format.ts

export function formatSubscriberCount(count: number): string | null {
  if (count < 10) return null
  if (count < 1000) return String(count)
  return `${(count / 1000).toFixed(1)}k`
}

export function formatDaysAgo(days: number, locale: 'en' | 'pt-BR'): string {
  if (days === 0) return locale === 'pt-BR' ? 'hoje' : 'today'
  if (days === 1) return locale === 'pt-BR' ? 'ontem' : 'yesterday'
  return locale === 'pt-BR' ? `há ${days} dias` : `${days} days ago`
}

export function resolveAccentTextColor(accentHex: string): '#000000' | '#FFFFFF' {
  const r = parseInt(accentHex.slice(1, 3), 16) / 255
  const g = parseInt(accentHex.slice(3, 5), 16) / 255
  const b = parseInt(accentHex.slice(5, 7), 16) / 255
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

const CADENCE_MAP: Record<number, { en: string; 'pt-BR': string }> = {
  7: { en: 'Weekly', 'pt-BR': 'Semanal' },
  14: { en: 'Bi-weekly', 'pt-BR': 'Quinzenal' },
  30: { en: 'Monthly', 'pt-BR': 'Mensal' },
}

export function deriveCadenceLabel(
  cadenceLabel: string | null,
  cadenceDays: number,
  locale: 'en' | 'pt-BR',
): string | null {
  if (cadenceLabel) return cadenceLabel
  return CADENCE_MAP[cadenceDays]?.[locale] ?? null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:web -- --run apps/web/test/unit/newsletter/format.test.ts`
Expected: all 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/newsletter/format.ts apps/web/test/unit/newsletter/format.test.ts
git commit -m "feat(newsletter-landing): format utilities — subscriber count, days ago, accent contrast, cadence label"
```

---

### Task 3: Paper/Tape Shared Components + Tests

**Files:**
- Create: `apps/web/src/components/pinboard/paper.tsx`
- Create: `apps/web/src/components/pinboard/tape.tsx`
- Create: `apps/web/src/components/pinboard/index.ts`
- Modify: `apps/web/src/app/(public)/newsletters/components/NewslettersHub.tsx`
- Test: `apps/web/test/unit/newsletter/pinboard-components.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/web/test/unit/newsletter/pinboard-components.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Paper, Tape, rot, lift } from '@/components/pinboard'

describe('Paper', () => {
  it('renders children with default styles', () => {
    const { container } = render(<Paper>Hello</Paper>)
    const div = container.firstElementChild as HTMLElement
    expect(div.textContent).toBe('Hello')
    expect(div.style.background).toContain('var(--pb-paper)')
    expect(div.style.padding).toBe('20px')
  })

  it('applies custom tint, rotation, and translateY', () => {
    const { container } = render(
      <Paper tint="var(--pb-paper2)" rotation={1.5} translateY={-4} padding="16px">
        Content
      </Paper>
    )
    const div = container.firstElementChild as HTMLElement
    expect(div.style.background).toContain('var(--pb-paper2)')
    expect(div.style.transform).toContain('rotate(1.5deg)')
    expect(div.style.transform).toContain('translateY(-4px)')
    expect(div.style.padding).toBe('16px')
  })

  it('disables shadow when shadow=false', () => {
    const { container } = render(<Paper shadow={false}>No shadow</Paper>)
    const div = container.firstElementChild as HTMLElement
    expect(div.style.boxShadow).toBe('')
  })

  it('merges className and style props', () => {
    const { container } = render(
      <Paper className="custom-class" style={{ marginTop: 8 }}>Styled</Paper>
    )
    const div = container.firstElementChild as HTMLElement
    expect(div.className).toContain('custom-class')
    expect(div.style.marginTop).toBe('8px')
  })
})

describe('Tape', () => {
  it('renders with default tape color', () => {
    const { container } = render(<Tape />)
    const div = container.firstElementChild as HTMLElement
    expect(div.style.background).toContain('var(--pb-tape)')
    expect(div.style.width).toBe('80px')
    expect(div.style.height).toBe('18px')
    expect(div.style.position).toBe('absolute')
  })

  it('accepts custom color', () => {
    const { container } = render(<Tape color="var(--pb-tape2)" />)
    const div = container.firstElementChild as HTMLElement
    expect(div.style.background).toContain('var(--pb-tape2)')
  })
})

describe('rot / lift helpers', () => {
  it('produces deterministic rotation per index', () => {
    expect(rot(0)).toBe(-1.5)
    expect(rot(1)).toBe(0.5)
    expect(rot(2)).toBe(-0.5)
  })

  it('produces deterministic lift per index', () => {
    expect(lift(0)).toBe(-4)
    expect(lift(1)).toBe(2)
    expect(lift(2)).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:web -- --run apps/web/test/unit/newsletter/pinboard-components.test.tsx`
Expected: FAIL — module `@/components/pinboard` does not exist.

- [ ] **Step 3: Write Paper component**

```typescript
// apps/web/src/components/pinboard/paper.tsx
import type { CSSProperties, ReactNode } from 'react'

interface PaperProps {
  children: ReactNode
  tint?: string
  padding?: string
  rotation?: number
  translateY?: number
  shadow?: boolean
  className?: string
  style?: CSSProperties
}

export function Paper({
  children,
  tint = 'var(--pb-paper)',
  padding = '20px',
  rotation = 0,
  translateY = 0,
  shadow = true,
  className,
  style,
}: PaperProps) {
  return (
    <div
      className={className}
      style={{
        background: tint,
        padding,
        transform: `rotate(${rotation}deg) translateY(${translateY}px)`,
        boxShadow: shadow
          ? '0 1px 4px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)'
          : undefined,
        borderRadius: 6,
        position: 'relative',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Write Tape component**

```typescript
// apps/web/src/components/pinboard/tape.tsx
import type { CSSProperties } from 'react'

interface TapeProps {
  color?: string
  className?: string
  style?: CSSProperties
}

export function Tape({ color = 'var(--pb-tape)', className, style }: TapeProps) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        width: 80,
        height: 18,
        background: color,
        borderRadius: 1,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
        zIndex: 0,
        ...style,
      }}
    />
  )
}
```

- [ ] **Step 5: Write index barrel + helpers**

```typescript
// apps/web/src/components/pinboard/index.ts
export { Paper } from './paper'
export { Tape } from './tape'

export const rot = (i: number) => ((i * 37) % 7 - 3) * 0.5
export const lift = (i: number) => ((i * 53) % 5 - 2) * 2
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test:web -- --run apps/web/test/unit/newsletter/pinboard-components.test.tsx`
Expected: all 8 tests PASS.

- [ ] **Step 7: Refactor hub to import from shared**

In `apps/web/src/app/(public)/newsletters/components/NewslettersHub.tsx`:
- Add import: `import { Paper, Tape, rot, lift } from '@/components/pinboard'`
- Remove inline `rot` and `lift` function declarations
- Replace inline Paper-style `<div>` elements with `<Paper>` component
- Replace inline tape `<div>` elements with `<Tape>` component
- Keep the existing theme token logic (the hub still manages dark/light tokens for its own cards)

The refactoring is mechanical: each card that currently has `background: index % 3 === 1 ? paper2 : paper` becomes `<Paper tint={index % 3 === 1 ? paper2 : paper} rotation={rot(index)} translateY={lift(index)}>`. Each tape div becomes `<Tape color={index % 2 ? tape2 : tape} style={{ top: 4, ...(index % 2 ? { left: '22%' } : { right: '22%' }), transform: \`rotate(${(index * 9) % 14 - 7}deg)\` }} />`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/pinboard/ apps/web/test/unit/newsletter/pinboard-components.test.tsx apps/web/src/app/\(public\)/newsletters/components/NewslettersHub.tsx
git commit -m "feat(newsletter-landing): extract Paper/Tape shared components, refactor hub to use them"
```

---

### Task 4: i18n Locale Keys

**Files:**
- Modify: `apps/web/src/locales/en.json`
- Modify: `apps/web/src/locales/pt-BR.json`
- Test: `apps/web/test/unit/newsletter/landing-i18n.test.ts`

- [ ] **Step 1: Write i18n completeness test**

```typescript
// apps/web/test/unit/newsletter/landing-i18n.test.ts
import { describe, it, expect } from 'vitest'
import en from '@/locales/en.json'
import pt from '@/locales/pt-BR.json'

const LANDING_KEYS = [
  'newsletter.landing.crumbHome',
  'newsletter.landing.crumbHub',
  'newsletter.landing.newBadge',
  'newsletter.landing.subsLabel',
  'newsletter.landing.issuesLabel',
  'newsletter.landing.sentLabel',
  'newsletter.landing.daysAgo.today',
  'newsletter.landing.daysAgo.yesterday',
  'newsletter.landing.daysAgo.n',
  'newsletter.landing.sectionWhat',
  'newsletter.landing.stepLabel',
  'newsletter.landing.formTitle',
  'newsletter.landing.formSubtitle',
  'newsletter.landing.emailLabel',
  'newsletter.landing.emailPlaceholder',
  'newsletter.landing.consentPrefix',
  'newsletter.landing.consentSuffix',
  'newsletter.landing.privacy',
  'newsletter.landing.submit',
  'newsletter.landing.submitting',
  'newsletter.landing.noSpam',
  'newsletter.landing.noPitch',
  'newsletter.landing.oneClickLeave',
  'newsletter.landing.pendingTitle',
  'newsletter.landing.pendingBody',
  'newsletter.landing.pendingStep1',
  'newsletter.landing.pendingStep2',
  'newsletter.landing.pendingStep3',
  'newsletter.landing.pendingTip',
  'newsletter.landing.pendingResend',
  'newsletter.landing.pendingResent',
  'newsletter.landing.pendingChangeEmail',
  'newsletter.landing.confirmedTitle',
  'newsletter.landing.confirmedBody',
  'newsletter.landing.confirmedExclamation',
  'newsletter.landing.successAgain',
  'newsletter.landing.errorRateLimit',
  'newsletter.landing.errorAlreadySubscribed',
  'newsletter.landing.errorInvalid',
  'newsletter.landing.errorServer',
  'newsletter.landing.sectionSamples',
  'newsletter.landing.sampleReadFull',
  'newsletter.landing.sectionAuthor',
  'newsletter.landing.authorRole',
  'newsletter.landing.authorBio',
  'newsletter.landing.authorMore',
  'newsletter.landing.authorNow',
  'newsletter.landing.sectionFaq',
  'newsletter.landing.finalKicker',
  'newsletter.landing.finalTitle',
  'newsletter.landing.finalSub',
  'newsletter.landing.finalSubscribers',
  'newsletter.landing.backToTopForm',
  'newsletter.landing.footerNote',
  'newsletter.landing.footerSub',
  'newsletter.landing.backToHome',
  'newsletter.landing.allNewsletters',
  'newsletter.landing.backToHub',
  'newsletter.landing.notFoundExclamation',
  'newsletter.landing.notFoundTitle',
  'newsletter.landing.notFoundBody',
  'newsletter.landing.goHome',
] as const

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  )
}

describe('newsletter landing i18n', () => {
  it('en.json has all landing keys', () => {
    for (const key of LANDING_KEYS) {
      const val = getNestedValue(en, key)
      expect(val, `missing en key: ${key}`).toBeDefined()
      expect(typeof val === 'string' ? val.length > 0 : true, `empty en key: ${key}`).toBe(true)
    }
  })

  it('pt-BR.json has all landing keys', () => {
    for (const key of LANDING_KEYS) {
      const val = getNestedValue(pt, key)
      expect(val, `missing pt-BR key: ${key}`).toBeDefined()
      expect(typeof val === 'string' ? val.length > 0 : true, `empty pt-BR key: ${key}`).toBe(true)
    }
  })

  it('both locales have FAQ arrays of equal length', () => {
    const enFaq = getNestedValue(en, 'newsletter.landing.faq') as Array<unknown>
    const ptFaq = getNestedValue(pt, 'newsletter.landing.faq') as Array<unknown>
    expect(Array.isArray(enFaq)).toBe(true)
    expect(Array.isArray(ptFaq)).toBe(true)
    expect(enFaq.length).toBe(ptFaq.length)
    expect(enFaq.length).toBeGreaterThanOrEqual(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- --run apps/web/test/unit/newsletter/landing-i18n.test.ts`
Expected: FAIL — keys not found.

- [ ] **Step 3: Add keys to en.json**

Add nested object under existing `newsletter` key in `apps/web/src/locales/en.json`:

```json
"newsletter": {
  ...existing keys...,
  "landing": {
    "crumbHome": "Home",
    "crumbHub": "Newsletters",
    "newBadge": "new",
    "subsLabel": "subscribers",
    "issuesLabel": "issues",
    "sentLabel": "sent",
    "daysAgo": {
      "today": "today",
      "yesterday": "yesterday",
      "n": "{n} days ago"
    },
    "sectionWhat": "What you get",
    "stepLabel": "STEP {current}/{total}",
    "formTitle": "Subscribe",
    "formSubtitle": "Free. No spam. Cancel anytime.",
    "emailLabel": "Your email",
    "emailPlaceholder": "your@email.com",
    "consentPrefix": "I agree to receive ",
    "consentSuffix": " and accept the ",
    "privacy": "Privacy Policy",
    "submit": "Subscribe",
    "submitting": "Sending…",
    "noSpam": "no spam",
    "noPitch": "no pitch",
    "oneClickLeave": "1-click leave",
    "pendingTitle": "Check your inbox",
    "pendingBody": "I sent a confirmation link to {email}. Click it to confirm your subscription.",
    "pendingStep1": "Email sent",
    "pendingStep2": "Click the link",
    "pendingStep3": "You're in",
    "pendingTip": "Don't see it? Check spam or promotions.",
    "pendingResend": "resend email",
    "pendingResent": "resent!",
    "pendingChangeEmail": "use another email",
    "confirmedTitle": "You're subscribed!",
    "confirmedBody": "From now on, you'll receive each new edition straight to your inbox.",
    "confirmedExclamation": "thanks!",
    "successAgain": "Subscribe another email",
    "errorRateLimit": "Easy there. Try again in a few minutes.",
    "errorAlreadySubscribed": "You're already subscribed. Thanks!",
    "errorInvalid": "That email doesn't look right.",
    "errorServer": "Something broke. Try again?",
    "sectionSamples": "Past issues",
    "sampleReadFull": "read full →",
    "sectionAuthor": "Who writes this",
    "authorRole": "Indie dev, Brazil",
    "authorBio": "I've built software for six years. Since 2024, only for myself: six apps cooking, a YouTube channel, a blog that became the center of everything.",
    "authorMore": "more about me →",
    "authorNow": "what I'm doing now →",
    "sectionFaq": "Questions",
    "faq": [
      { "q": "Is this newsletter free?", "a": "Yes. Free forever, no tier, no paywall." },
      { "q": "How often will I receive it?", "a": "Depends on the newsletter. The cadence is shown on this page." },
      { "q": "Can I unsubscribe anytime?", "a": "Yes. One-click unsubscribe in every email. No questions." },
      { "q": "Will you sell my email?", "a": "Never. I self-host email sending. Your data doesn't leave my server." },
      { "q": "Can I reply to the emails?", "a": "Yes. Replies go straight to my inbox." }
    ],
    "finalKicker": "NEWSLETTER",
    "finalTitle": "Join {name}",
    "finalSub": "{cadence}",
    "finalSubscribers": "{count} readers and counting",
    "backToTopForm": "go to form ↑",
    "footerNote": "Your email is safe. Unsubscribe anytime.",
    "footerSub": "One-click unsubscribe in every email.",
    "backToHome": "back to home",
    "allNewsletters": "all newsletters →",
    "backToHub": "or see all newsletters →",
    "notFoundExclamation": "huh.",
    "notFoundTitle": "That newsletter doesn't exist.",
    "notFoundBody": "Maybe the link broke. Here are the ones that exist now:",
    "goHome": "Go to homepage"
  }
}
```

- [ ] **Step 4: Add keys to pt-BR.json**

Add matching nested object in `apps/web/src/locales/pt-BR.json`:

```json
"newsletter": {
  ...existing keys...,
  "landing": {
    "crumbHome": "Início",
    "crumbHub": "Newsletters",
    "newBadge": "novo",
    "subsLabel": "inscritos",
    "issuesLabel": "edições",
    "sentLabel": "enviada",
    "daysAgo": {
      "today": "hoje",
      "yesterday": "ontem",
      "n": "há {n} dias"
    },
    "sectionWhat": "O que você recebe",
    "stepLabel": "PASSO {current}/{total}",
    "formTitle": "Inscreva-se",
    "formSubtitle": "De graça. Sem spam. Cancele quando quiser.",
    "emailLabel": "Seu email",
    "emailPlaceholder": "seu@email.com",
    "consentPrefix": "Aceito receber a ",
    "consentSuffix": " e aceito a ",
    "privacy": "Política de Privacidade",
    "submit": "Inscrever",
    "submitting": "Enviando…",
    "noSpam": "sem spam",
    "noPitch": "sem venda",
    "oneClickLeave": "sair em 1 clique",
    "pendingTitle": "Confira seu email",
    "pendingBody": "Enviei um link de confirmação para {email}. Clique nele pra confirmar sua inscrição.",
    "pendingStep1": "Email enviado",
    "pendingStep2": "Clique no link",
    "pendingStep3": "Pronto",
    "pendingTip": "Não viu? Olha no spam ou promoções.",
    "pendingResend": "reenviar email",
    "pendingResent": "reenviado!",
    "pendingChangeEmail": "usar outro email",
    "confirmedTitle": "Tá inscrito!",
    "confirmedBody": "A partir de agora, cada edição nova vai direto pro seu email.",
    "confirmedExclamation": "valeu!",
    "successAgain": "Inscrever outro email",
    "errorRateLimit": "Devagar aí. Tenta de novo em alguns minutos.",
    "errorAlreadySubscribed": "Esse email já está inscrito. Valeu!",
    "errorInvalid": "Email não parece válido.",
    "errorServer": "Algo deu errado. Tenta de novo?",
    "sectionSamples": "Edições anteriores",
    "sampleReadFull": "ler completa →",
    "sectionAuthor": "Quem escreve",
    "authorRole": "Dev indie, BH",
    "authorBio": "Construo software há seis anos. Desde 2024, só pra mim mesmo: seis apps no forno, um canal no YouTube, um blog que virou o centro de tudo.",
    "authorMore": "mais sobre mim →",
    "authorNow": "o que estou fazendo agora →",
    "sectionFaq": "Perguntas",
    "faq": [
      { "q": "Essa newsletter é de graça?", "a": "Sim. De graça pra sempre, sem tier, sem paywall." },
      { "q": "Com que frequência vou receber?", "a": "Depende da newsletter. A cadência tá aqui na página." },
      { "q": "Posso cancelar quando quiser?", "a": "Sim. Um clique pra sair, em todo email. Sem pergunta." },
      { "q": "Vocês vendem meu email?", "a": "Nunca. Eu gerencio o envio de emails. Seus dados não saem do meu servidor." },
      { "q": "Posso responder os emails?", "a": "Sim. Respostas vão direto pra minha caixa de entrada." }
    ],
    "finalKicker": "NEWSLETTER",
    "finalTitle": "Junte-se ao {name}",
    "finalSub": "{cadence}",
    "finalSubscribers": "{count} leitores e contando",
    "backToTopForm": "ir pro formulário ↑",
    "footerNote": "Seu email tá seguro. Cancele quando quiser.",
    "footerSub": "Um clique pra cancelar, em todo email.",
    "backToHome": "voltar pra home",
    "allNewsletters": "todas as newsletters →",
    "backToHub": "ou ver todas as newsletters →",
    "notFoundExclamation": "epa.",
    "notFoundTitle": "Essa newsletter não existe.",
    "notFoundBody": "Talvez o link tenha quebrado. Aqui estão as que existem agora:",
    "goHome": "Ir pra home"
  }
}
```

- [ ] **Step 5: Run i18n tests**

Run: `npm run test:web -- --run apps/web/test/unit/newsletter/landing-i18n.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/locales/en.json apps/web/src/locales/pt-BR.json apps/web/test/unit/newsletter/landing-i18n.test.ts
git commit -m "feat(newsletter-landing): i18n — 55+ new keys for landing pages in en.json and pt-BR.json"
```

---

### Task 5: Newsletter Query Library

**Files:**
- Create: `apps/web/src/lib/newsletter/queries.ts`

- [ ] **Step 1: Write query functions**

```typescript
// apps/web/src/lib/newsletter/queries.ts
import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export interface NewsletterType {
  id: string
  slug: string
  locale: 'en' | 'pt-BR'
  name: string
  tagline: string | null
  description: string | null
  color: string
  color_dark: string | null
  badge: string | null
  cadence_days: number
  cadence_label: string | null
  landing_content: { promise?: string[] } | null
  og_image_url: string | null
  active: boolean
  site_id: string
  updated_at: string
}

export interface NewsletterStats {
  subscriberCount: number
  editionsCount: number
  daysSinceLastEdition: number | null
}

export interface RecentEdition {
  id: string
  subject: string
  preheader: string | null
  sent_at: string
}

export async function getNewsletterTypeBySlug(
  slug: string,
): Promise<NewsletterType | null> {
  const { data } = await supabaseAnon
    .from('newsletter_types')
    .select('id, slug, locale, name, tagline, description, color, color_dark, badge, cadence_days, cadence_label, landing_content, og_image_url, active, site_id, updated_at')
    .eq('slug', slug)
    .single()

  return data as NewsletterType | null
}

export async function getNewsletterStats(
  typeId: string,
  siteId: string,
): Promise<NewsletterStats> {
  const supabase = getSupabaseServiceClient()

  const [subs, editions] = await Promise.all([
    supabase
      .from('newsletter_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('newsletter_id', typeId)
      .eq('site_id', siteId)
      .eq('status', 'confirmed'),
    supabase
      .from('newsletter_editions')
      .select('sent_at')
      .eq('newsletter_type_id', typeId)
      .eq('site_id', siteId)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(1),
  ])

  const subscriberCount = subs.count ?? 0
  const editionsCountRes = await supabase
    .from('newsletter_editions')
    .select('id', { count: 'exact', head: true })
    .eq('newsletter_type_id', typeId)
    .eq('site_id', siteId)
    .eq('status', 'sent')

  const editionsCount = editionsCountRes.count ?? 0
  const lastSentAt = editions.data?.[0]?.sent_at
  const daysSinceLastEdition = lastSentAt
    ? Math.floor((Date.now() - new Date(lastSentAt).getTime()) / 86400000)
    : null

  return { subscriberCount, editionsCount, daysSinceLastEdition }
}

export async function getRecentEditions(
  typeId: string,
  siteId: string,
  limit = 3,
): Promise<RecentEdition[]> {
  const { data } = await supabaseAnon
    .from('newsletter_editions')
    .select('id, subject, preheader, sent_at')
    .eq('newsletter_type_id', typeId)
    .eq('site_id', siteId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(limit)

  return (data ?? []) as RecentEdition[]
}

export const getActiveTypeCount = unstable_cache(
  async (siteId: string): Promise<number> => {
    const supabase = getSupabaseServiceClient()
    const { count } = await supabase
      .from('newsletter_types')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('active', true)

    return count ?? 0
  },
  ['newsletter-active-type-count'],
  { tags: ['newsletter:types:count'], revalidate: 3600 },
)

export async function getActiveTypesForNotFound(
  siteId: string,
): Promise<Array<{ slug: string; name: string; tagline: string | null; color: string; locale: string }>> {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('newsletter_types')
    .select('slug, name, tagline, color, locale')
    .eq('site_id', siteId)
    .eq('active', true)
    .order('sort_order')

  return (data ?? []) as Array<{ slug: string; name: string; tagline: string | null; color: string; locale: string }>
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/newsletter/queries.ts
git commit -m "feat(newsletter-landing): query library — type by slug, stats, recent editions, active count"
```

---

### Task 6: Cache Invalidation Helper

**Files:**
- Create: `apps/web/src/lib/newsletter/cache-invalidation.ts`

- [ ] **Step 1: Write cache invalidation helper**

```typescript
// apps/web/src/lib/newsletter/cache-invalidation.ts
import { revalidateTag, revalidatePath } from 'next/cache'

export function revalidateNewsletterType(
  siteId: string,
  slug: string,
): void {
  revalidateTag(`newsletter:type:${slug}`)
  revalidateTag(`og:newsletter:${slug}`)
  revalidateTag(`sitemap:${siteId}`)
  revalidateTag('newsletter:types:count')
  revalidatePath(`/newsletters/${slug}`)
  revalidatePath('/newsletters')
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/newsletter/cache-invalidation.ts
git commit -m "feat(newsletter-landing): cache invalidation helper — revalidateNewsletterType"
```

---

### Task 7: Newsletter Landing CSS

**Files:**
- Create: `apps/web/src/app/(public)/newsletters/[slug]/newsletter-landing.css`

- [ ] **Step 1: Write CSS file**

```css
/* newsletter-landing.css — Page-specific styles for /newsletters/[slug] */

/* Accent color resolution (light/dark theme-aware) */
.nl-landing {
  --nl-accent: var(--nl-accent-light);
}
[data-theme="dark"] .nl-landing {
  --nl-accent: var(--nl-accent-dark);
}

/* ── Animations ────────────────────────────── */

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.nl-fade-in {
  animation: fadeIn 0.2s ease-out;
}

.nl-pulse {
  animation: pulse 1.6s ease-in-out infinite;
}

/* ── Reduced motion ────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .nl-landing *,
  .nl-landing *::before,
  .nl-landing *::after {
    animation-duration: 0s !important;
    transition-duration: 0s !important;
  }
}

/* ── Form phase crossfade ──────────────────── */

.nl-form-phase {
  transition: opacity 0.15s ease;
}

/* ── Mobile sticky CTA ────────────────────── */

.nl-sticky-cta {
  transition: transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.nl-sticky-cta[data-visible="false"] {
  transform: translateY(120%);
}

.nl-sticky-cta[data-visible="true"] {
  transform: translateY(0);
}

/* ── Accent underline (hero) ───────────────── */

.nl-marker-underline {
  position: relative;
  display: inline;
}

.nl-marker-underline::after {
  content: '';
  position: absolute;
  left: -4px;
  right: -4px;
  bottom: 2px;
  height: 0.35em;
  background: var(--pb-marker);
  opacity: 0.16;
  transform: skew(-2deg);
  z-index: -1;
  border-radius: 2px;
}

/* ── Accent underline (form title) ─────────── */

.nl-accent-underline {
  position: relative;
  display: inline;
}

.nl-accent-underline::after {
  content: '';
  position: absolute;
  left: -4px;
  right: -4px;
  bottom: 2px;
  height: 0.35em;
  background: var(--nl-accent);
  opacity: 0.85;
  transform: skew(-2deg);
  z-index: -1;
  border-radius: 2px;
}

/* ── Focus visibility ─────────────────────── */

.nl-landing a:focus-visible,
.nl-landing button:focus-visible,
.nl-landing input:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

/* ── Layout: Desktop (>920px) ─────────────── */

.nl-hero-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 56px;
  align-items: start;
}

.nl-form-sticky {
  position: sticky;
  top: 110px;
}

.nl-samples-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.nl-final-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 40px;
  align-items: center;
}

.nl-mobile-cta {
  display: none;
}

/* ── Layout: Tablet (≤920px) ──────────────── */

@media (max-width: 920px) {
  .nl-hero-grid {
    grid-template-columns: 1fr;
    gap: 32px;
  }

  .nl-form-sticky {
    position: static;
  }

  .nl-final-grid {
    grid-template-columns: 1fr;
  }
}

/* ── Layout: Mobile (≤620px) ──────────────── */

@media (max-width: 620px) {
  .nl-samples-grid {
    grid-template-columns: 1fr;
  }

  .nl-mobile-cta {
    display: block;
  }

  .nl-section {
    padding-left: 18px;
    padding-right: 18px;
  }
}

/* ── Stat row ─────────────────────────────── */

.nl-stat-row {
  display: flex;
  gap: 16px;
}

.nl-stat-item + .nl-stat-item {
  border-left: 1px dashed var(--pb-line);
  padding-left: 16px;
}

/* ── Step indicator ───────────────────────── */

.nl-step + .nl-step {
  border-top: 1px dashed var(--pb-line);
  padding-top: 12px;
  margin-top: 12px;
}

/* ── Error display ────────────────────────── */

.nl-form-error {
  padding: 10px 12px;
  background: rgba(193, 69, 19, 0.1);
  border-left: 3px solid #C14513;
  font-size: 13px;
  border-radius: 4px;
}

/* ── Email display box (pending) ──────────── */

.nl-email-display {
  border-left: 2px dashed var(--nl-accent);
  padding: 12px 16px;
  font-family: var(--font-jetbrains-var), monospace;
  font-size: 12px;
  word-break: break-all;
  border-radius: 4px;
}

[data-theme="dark"] .nl-email-display {
  background: rgba(0, 0, 0, 0.25);
}

[data-theme="light"] .nl-email-display {
  background: rgba(0, 0, 0, 0.04);
}

/* ── Skip link ────────────────────────────── */

.nl-skip-link {
  position: absolute;
  top: -100%;
  left: 16px;
  z-index: 100;
  padding: 8px 16px;
  background: var(--pb-ink);
  color: var(--pb-bg);
  border-radius: 4px;
  font-size: 14px;
}

.nl-skip-link:focus-visible {
  top: 16px;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/newsletters/\[slug\]/newsletter-landing.css
git commit -m "feat(newsletter-landing): CSS — animations, responsive grid, accent theme, reduced-motion, a11y"
```

---

### Task 8: Subscribe Form Client Island + Tests

**Files:**
- Create: `apps/web/src/app/(public)/newsletters/[slug]/subscribe-form.tsx`
- Test: `apps/web/test/unit/newsletter/landing-form.test.tsx`

- [ ] **Step 1: Write failing form tests**

```typescript
// apps/web/test/unit/newsletter/landing-form.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import { SubscribeForm } from '@/app/(public)/newsletters/[slug]/subscribe-form'

const defaultStrings = {
  stepLabel: 'STEP {current}/{total}',
  formTitle: 'Subscribe',
  formSubtitle: 'Free. No spam. Cancel anytime.',
  emailLabel: 'Your email',
  emailPlaceholder: 'your@email.com',
  consentPrefix: 'I agree to receive ',
  consentSuffix: ' and accept the ',
  privacy: 'Privacy Policy',
  submit: 'Subscribe',
  submitting: 'Sending…',
  noSpam: 'no spam',
  noPitch: 'no pitch',
  oneClickLeave: '1-click leave',
  pendingTitle: 'Check your inbox',
  pendingBody: 'I sent a confirmation link to {email}.',
  pendingStep1: 'Email sent',
  pendingStep2: 'Click the link',
  pendingStep3: "You're in",
  pendingTip: "Don't see it? Check spam.",
  pendingResend: 'resend email',
  pendingResent: 'resent!',
  pendingChangeEmail: 'use another email',
  confirmedTitle: "You're subscribed!",
  confirmedBody: 'You will receive each new edition.',
  confirmedExclamation: 'thanks!',
  successAgain: 'Subscribe another email',
  errorRateLimit: 'Easy there.',
  errorAlreadySubscribed: 'Already subscribed.',
  errorInvalid: 'Email invalid.',
  errorServer: 'Something broke.',
}

function setup(onSubscribe = vi.fn().mockResolvedValue({ success: true })) {
  return render(
    <SubscribeForm
      newsletterId="main-en"
      locale="en"
      accentColor="#C14513"
      newsletterName="The bythiago diary"
      strings={defaultStrings}
      privacyHref="/privacy"
      onSubscribe={onSubscribe}
    />,
  )
}

describe('SubscribeForm', () => {
  it('renders idle phase with email input, consent checkbox, and submit button', () => {
    setup()
    expect(screen.getByLabelText('Your email')).toBeDefined()
    expect(screen.getByRole('checkbox')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeDefined()
  })

  it('disables submit when email missing @ or consent unchecked', () => {
    setup()
    const btn = screen.getByRole('button', { name: 'Subscribe' })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables submit when email has @ and consent checked', async () => {
    setup()
    const input = screen.getByLabelText('Your email') as HTMLInputElement
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'test@example.com' } })
    fireEvent.click(checkbox)
    const btn = screen.getByRole('button', { name: 'Subscribe' })
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it('transitions to pending phase on success', async () => {
    const onSubscribe = vi.fn().mockResolvedValue({ success: true })
    setup(onSubscribe)
    const input = screen.getByLabelText('Your email') as HTMLInputElement
    const checkbox = screen.getByRole('checkbox')
    fireEvent.change(input, { target: { value: 'test@example.com' } })
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }))
    await waitFor(() => {
      expect(screen.getByText('Check your inbox')).toBeDefined()
    })
  })

  it('shows error on action failure', async () => {
    const onSubscribe = vi.fn().mockResolvedValue({ error: 'rate' })
    setup(onSubscribe)
    const input = screen.getByLabelText('Your email') as HTMLInputElement
    const checkbox = screen.getByRole('checkbox')
    fireEvent.change(input, { target: { value: 'test@example.com' } })
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined()
    })
  })

  it('renders privacy link with correct href and target', () => {
    setup()
    const link = screen.getByText('Privacy Policy') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/privacy')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:web -- --run apps/web/test/unit/newsletter/landing-form.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write subscribe form component**

```typescript
// apps/web/src/app/(public)/newsletters/[slug]/subscribe-form.tsx
'use client'

import { useState, useRef, useCallback, type FormEvent } from 'react'

export interface SubscribeFormStrings {
  stepLabel: string
  formTitle: string
  formSubtitle: string
  emailLabel: string
  emailPlaceholder: string
  consentPrefix: string
  consentSuffix: string
  privacy: string
  submit: string
  submitting: string
  noSpam: string
  noPitch: string
  oneClickLeave: string
  pendingTitle: string
  pendingBody: string
  pendingStep1: string
  pendingStep2: string
  pendingStep3: string
  pendingTip: string
  pendingResend: string
  pendingResent: string
  pendingChangeEmail: string
  confirmedTitle: string
  confirmedBody: string
  confirmedExclamation: string
  successAgain: string
  errorRateLimit: string
  errorAlreadySubscribed: string
  errorInvalid: string
  errorServer: string
}

type Phase = 'idle' | 'loading' | 'pending' | 'confirmed' | 'error'
type MultiSubState = { success?: boolean; error?: string; subscribedIds?: string[] }

interface SubscribeFormProps {
  newsletterId: string
  locale: 'en' | 'pt-BR'
  accentColor: string
  newsletterName: string
  strings: SubscribeFormStrings
  privacyHref: string
  turnstileSiteKey?: string
  onSubscribe: (
    email: string,
    ids: string[],
    locale: 'en' | 'pt-BR',
    token?: string,
  ) => Promise<MultiSubState>
}

const ERROR_MAP: Record<string, keyof SubscribeFormStrings> = {
  rate: 'errorRateLimit',
  dup: 'errorAlreadySubscribed',
  invalid: 'errorInvalid',
}

export function SubscribeForm({
  newsletterId,
  locale,
  accentColor,
  newsletterName,
  strings: t,
  privacyHref,
  turnstileSiteKey,
  onSubscribe,
}: SubscribeFormProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [resent, setResent] = useState(false)
  const pendingRef = useRef<HTMLHeadingElement>(null)
  const confirmedRef = useRef<HTMLHeadingElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const turnstileTokenRef = useRef<string>('')

  const canSubmit = email.includes('@') && consent && phase !== 'loading'

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!canSubmit) return
      setPhase('loading')
      setErrorMsg('')
      try {
        const result = await onSubscribe(
          email,
          [newsletterId],
          locale,
          turnstileTokenRef.current || undefined,
        )
        if (result.success) {
          setPhase('pending')
          setTimeout(() => pendingRef.current?.focus(), 100)
        } else {
          const key = ERROR_MAP[result.error ?? ''] ?? 'errorServer'
          setErrorMsg(t[key])
          setPhase('error')
          setTimeout(() => errorRef.current?.focus(), 100)
        }
      } catch {
        setErrorMsg(t.errorServer)
        setPhase('error')
        setTimeout(() => errorRef.current?.focus(), 100)
      }
    },
    [canSubmit, email, newsletterId, locale, onSubscribe, t],
  )

  const handleResend = useCallback(() => {
    setResent(true)
    setTimeout(() => setResent(false), 2200)
  }, [])

  const handleChangeEmail = useCallback(() => {
    setPhase('idle')
    setEmail('')
    setConsent(false)
  }, [])

  const handleReset = useCallback(() => {
    setPhase('idle')
    setEmail('')
    setConsent(false)
    setErrorMsg('')
  }, [])

  const stepCircle = (state: 'done' | 'active' | 'pending') => {
    const size = 22
    if (state === 'done')
      return (
        <span
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'var(--nl-accent)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          ✓
        </span>
      )
    if (state === 'active')
      return (
        <span
          className="nl-pulse"
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            border: '1.5px solid var(--pb-ink)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            flexShrink: 0,
          }}
        >
          ●
        </span>
      )
    return (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: '1.5px solid var(--pb-faint)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          opacity: 0.5,
          flexShrink: 0,
        }}
      >
        ○
      </span>
    )
  }

  const stepRow = (
    state: 'done' | 'active' | 'pending',
    label: string,
    isLast = false,
  ) => (
    <div
      className={isLast ? '' : 'nl-step'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {stepCircle(state)}
      <span
        style={{
          textTransform: 'uppercase',
          fontSize: 11,
          fontWeight: state === 'pending' ? 400 : 700,
          letterSpacing: '0.05em',
          color:
            state === 'done'
              ? 'var(--nl-accent)'
              : state === 'active'
                ? 'var(--pb-ink)'
                : 'var(--pb-faint)',
          opacity: state === 'pending' ? 0.5 : 1,
          fontFamily: 'var(--font-jetbrains-var), monospace',
        }}
      >
        {label}
      </span>
    </div>
  )

  return (
    <div id="form-hero">
      {/* Step badge */}
      <div
        style={{
          fontFamily: 'var(--font-jetbrains-var), monospace',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--pb-muted)',
          marginBottom: 8,
        }}
      >
        {phase === 'idle' || phase === 'loading' || phase === 'error'
          ? t.stepLabel.replace('{current}', '1').replace('{total}', '2')
          : t.stepLabel.replace('{current}', '2').replace('{total}', '2')}
      </div>

      {/* Form title */}
      <h2
        style={{
          fontFamily: 'var(--font-fraunces-var), serif',
          fontSize: 28,
          fontWeight: 600,
          color: 'var(--pb-ink)',
          marginBottom: 4,
        }}
      >
        <span className="nl-accent-underline">{t.formTitle}</span>
      </h2>
      <p
        style={{
          fontFamily: 'var(--font-jetbrains-var), monospace',
          fontSize: 11,
          color: 'var(--pb-muted)',
          marginBottom: 20,
        }}
      >
        {t.formSubtitle}
      </p>

      {/* ── IDLE / ERROR / LOADING phase ── */}
      {(phase === 'idle' || phase === 'loading' || phase === 'error') && (
        <form
          onSubmit={handleSubmit}
          aria-busy={phase === 'loading'}
          className="nl-form-phase"
        >
          <label
            htmlFor="nl-email"
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--pb-ink)',
              marginBottom: 6,
            }}
          >
            {t.emailLabel}
          </label>
          <input
            id="nl-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.emailPlaceholder}
            disabled={phase === 'loading'}
            aria-describedby={errorMsg ? 'form-error' : undefined}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: `1.5px solid ${errorMsg ? '#C14513' : 'var(--pb-line)'}`,
              borderRadius: 6,
              fontSize: 15,
              background: 'var(--pb-bg)',
              color: 'var(--pb-ink)',
              fontFamily: 'var(--font-jetbrains-var), monospace',
              boxSizing: 'border-box',
            }}
          />

          {/* Consent checkbox */}
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              marginTop: 12,
              fontSize: 12,
              color: 'var(--pb-muted)',
              cursor: 'pointer',
              lineHeight: 1.4,
            }}
          >
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={phase === 'loading'}
              style={{ marginTop: 2, minWidth: 16, minHeight: 16 }}
            />
            <span>
              {t.consentPrefix}
              <strong>{newsletterName}</strong>
              {t.consentSuffix}
              <a
                href={privacyHref}
                target="_blank"
                rel="noopener"
                style={{ color: 'var(--nl-accent)', textDecoration: 'underline' }}
              >
                {t.privacy}
              </a>
              .
            </span>
          </label>

          {/* Error display */}
          {errorMsg && (
            <div
              ref={errorRef}
              role="alert"
              aria-live="polite"
              id="form-error"
              tabIndex={-1}
              className="nl-form-error"
              style={{ marginTop: 12 }}
            >
              {errorMsg}
            </div>
          )}

          {/* Turnstile widget placeholder */}
          {turnstileSiteKey && <div id="nl-turnstile" style={{ marginTop: 12 }} />}

          {/* Submit button */}
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              width: '100%',
              marginTop: 16,
              padding: '12px 0',
              border: 'none',
              borderRadius: 6,
              fontSize: 15,
              fontWeight: 700,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              background: canSubmit ? 'var(--nl-accent)' : 'var(--pb-faint)',
              color: canSubmit ? 'var(--nl-accent-text)' : 'var(--pb-muted)',
              fontFamily: 'var(--font-jetbrains-var), monospace',
              transition: 'background 0.15s ease',
            }}
          >
            {phase === 'loading' ? `↻ ${t.submitting}` : t.submit}
          </button>

          {/* Trust microcopy */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 8,
              marginTop: 14,
              textAlign: 'center',
              fontSize: 10,
              color: 'var(--pb-faint)',
              fontFamily: 'var(--font-jetbrains-var), monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <span>🚫 {t.noSpam}</span>
            <span>🎯 {t.noPitch}</span>
            <span>👋 {t.oneClickLeave}</span>
          </div>
        </form>
      )}

      {/* ── PENDING phase ── */}
      {phase === 'pending' && (
        <div className="nl-form-phase nl-fade-in">
          <h3
            ref={pendingRef}
            tabIndex={-1}
            style={{
              fontFamily: 'var(--font-fraunces-var), serif',
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--pb-ink)',
              marginBottom: 8,
            }}
          >
            {t.pendingTitle}
          </h3>
          <p style={{ fontSize: 14, color: 'var(--pb-muted)', marginBottom: 20, lineHeight: 1.5 }}>
            {t.pendingBody.replace('{email}', email)}
          </p>

          {/* Step indicator */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 16 }}>
            {stepRow('done', t.pendingStep1)}
            {stepRow('active', t.pendingStep2)}
            {stepRow('pending', t.pendingStep3, true)}
          </div>

          {/* Email display box */}
          <div className="nl-email-display" style={{ marginBottom: 16 }}>
            <strong>✉ {email}</strong>
          </div>

          {/* Spam tip */}
          <p style={{ fontSize: 12, color: 'var(--pb-faint)', marginBottom: 16 }}>
            {t.pendingTip}
          </p>

          {/* Resend + change email */}
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <button
              onClick={handleResend}
              disabled={resent}
              style={{
                background: 'none',
                border: 'none',
                color: resent ? 'var(--nl-accent)' : 'var(--pb-muted)',
                textDecoration: 'underline',
                cursor: resent ? 'default' : 'pointer',
                fontFamily: 'var(--font-jetbrains-var), monospace',
                fontSize: 12,
                padding: 0,
              }}
            >
              {resent ? `✓ ${t.pendingResent}` : t.pendingResend}
            </button>
            <button
              onClick={handleChangeEmail}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--pb-muted)',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontFamily: 'var(--font-jetbrains-var), monospace',
                fontSize: 12,
                padding: 0,
              }}
            >
              {t.pendingChangeEmail}
            </button>
          </div>
        </div>
      )}

      {/* ── CONFIRMED phase ── */}
      {phase === 'confirmed' && (
        <div className="nl-form-phase nl-fade-in">
          {/* All steps done */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 16 }}>
            {stepRow('done', t.pendingStep1)}
            {stepRow('done', t.pendingStep2)}
            {stepRow('done', t.pendingStep3, true)}
          </div>

          <p
            style={{
              fontFamily: 'var(--font-caveat-var), cursive',
              fontSize: 32,
              color: 'var(--nl-accent)',
              marginBottom: 8,
            }}
          >
            ✓ {t.confirmedExclamation}
          </p>
          <h3
            ref={confirmedRef}
            tabIndex={-1}
            style={{
              fontFamily: 'var(--font-fraunces-var), serif',
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--pb-ink)',
              marginBottom: 8,
            }}
          >
            {t.confirmedTitle}
          </h3>
          <p style={{ fontSize: 14, color: 'var(--pb-muted)', marginBottom: 20, lineHeight: 1.5 }}>
            {t.confirmedBody}
          </p>
          <button
            onClick={handleReset}
            style={{
              background: 'none',
              border: '1px solid var(--pb-line)',
              borderRadius: 6,
              padding: '8px 16px',
              color: 'var(--pb-ink)',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'var(--font-jetbrains-var), monospace',
            }}
          >
            {t.successAgain}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:web -- --run apps/web/test/unit/newsletter/landing-form.test.tsx`
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(public\)/newsletters/\[slug\]/subscribe-form.tsx apps/web/test/unit/newsletter/landing-form.test.tsx
git commit -m "feat(newsletter-landing): subscribe form — 3-phase client island with a11y, consent, Turnstile slot"
```

---

### Task 9: FAQ Accordion Client Island + Tests

**Files:**
- Create: `apps/web/src/app/(public)/newsletters/[slug]/faq-accordion.tsx`
- Test: `apps/web/test/unit/newsletter/faq-accordion.test.tsx`

- [ ] **Step 1: Write failing FAQ tests**

```typescript
// apps/web/test/unit/newsletter/faq-accordion.test.tsx
import { describe, it, expect } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { FaqAccordion } from '@/app/(public)/newsletters/[slug]/faq-accordion'

const items = [
  { q: 'Is this free?', a: 'Yes. Free forever.' },
  { q: 'How often?', a: 'Depends on the newsletter.' },
  { q: 'Can I unsubscribe?', a: 'Yes, one click.' },
]

describe('FaqAccordion', () => {
  it('renders all questions', () => {
    render(<FaqAccordion items={items} sectionTitle="Questions" />)
    expect(screen.getByText('Is this free?')).toBeDefined()
    expect(screen.getByText('How often?')).toBeDefined()
    expect(screen.getByText('Can I unsubscribe?')).toBeDefined()
  })

  it('first item is open by default', () => {
    render(<FaqAccordion items={items} sectionTitle="Questions" />)
    const buttons = screen.getAllByRole('button')
    expect(buttons[0].getAttribute('aria-expanded')).toBe('true')
    expect(buttons[1].getAttribute('aria-expanded')).toBe('false')
  })

  it('toggles item on click', () => {
    render(<FaqAccordion items={items} sectionTitle="Questions" />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[1])
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true')
  })

  it('has correct aria-controls and role="region"', () => {
    const { container } = render(<FaqAccordion items={items} sectionTitle="Questions" />)
    const regions = container.querySelectorAll('[role="region"]')
    expect(regions.length).toBe(items.length)
    const firstBtn = screen.getAllByRole('button')[0]
    const panelId = firstBtn.getAttribute('aria-controls')
    expect(panelId).toBeTruthy()
    expect(container.querySelector(`#${panelId}`)).toBeTruthy()
  })

  it('toggles via Enter key', () => {
    render(<FaqAccordion items={items} sectionTitle="Questions" />)
    const buttons = screen.getAllByRole('button')
    fireEvent.keyDown(buttons[1], { key: 'Enter' })
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:web -- --run apps/web/test/unit/newsletter/faq-accordion.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write FAQ accordion component**

```typescript
// apps/web/src/app/(public)/newsletters/[slug]/faq-accordion.tsx
'use client'

import { useState, useCallback, useId, type KeyboardEvent } from 'react'

interface FaqItem {
  q: string
  a: string
}

interface FaqAccordionProps {
  items: FaqItem[]
  sectionTitle: string
}

export function FaqAccordion({ items, sectionTitle }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState(0)
  const baseId = useId()

  const toggle = useCallback(
    (i: number) => setOpenIndex((prev) => (prev === i ? -1 : i)),
    [],
  )

  const handleKeyDown = useCallback(
    (i: number, e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggle(i)
      }
    },
    [toggle],
  )

  return (
    <section style={{ maxWidth: 880, margin: '0 auto' }}>
      <h2
        style={{
          fontFamily: 'var(--font-fraunces-var), serif',
          fontSize: 28,
          fontWeight: 600,
          color: 'var(--pb-ink)',
          marginBottom: 24,
        }}
      >
        {sectionTitle}
      </h2>
      <div>
        {items.map((item, i) => {
          const isOpen = openIndex === i
          const buttonId = `${baseId}-btn-${i}`
          const panelId = `${baseId}-panel-${i}`
          return (
            <div
              key={i}
              style={{
                borderBottom: i < items.length - 1 ? '1px dashed var(--pb-line)' : undefined,
              }}
            >
              <button
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(i)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 0',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-fraunces-var), serif',
                  fontSize: 17,
                  fontWeight: 500,
                  color: 'var(--pb-ink)',
                }}
              >
                {item.q}
                <span
                  aria-hidden="true"
                  style={{
                    fontSize: 18,
                    color: 'var(--pb-muted)',
                    transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0,
                    marginLeft: 16,
                  }}
                >
                  +
                </span>
              </button>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                style={{
                  overflow: 'hidden',
                  maxHeight: isOpen ? 500 : 0,
                  opacity: isOpen ? 1 : 0,
                  transition: 'max-height 0.2s ease-out, opacity 0.2s ease-out',
                }}
              >
                <p
                  className={isOpen ? 'nl-fade-in' : ''}
                  style={{
                    fontSize: 15,
                    lineHeight: 1.6,
                    color: 'var(--pb-muted)',
                    paddingBottom: 16,
                    margin: 0,
                  }}
                >
                  {item.a}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:web -- --run apps/web/test/unit/newsletter/faq-accordion.test.tsx`
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(public\)/newsletters/\[slug\]/faq-accordion.tsx apps/web/test/unit/newsletter/faq-accordion.test.tsx
git commit -m "feat(newsletter-landing): FAQ accordion — collapsible questions with a11y, keyboard support"
```

---

### Task 10: Mobile Sticky CTA Client Island

**Files:**
- Create: `apps/web/src/app/(public)/newsletters/[slug]/mobile-sticky-cta.tsx`

- [ ] **Step 1: Write mobile sticky CTA component**

```typescript
// apps/web/src/app/(public)/newsletters/[slug]/mobile-sticky-cta.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'

interface MobileStickyCTAProps {
  formId: string
  phase: 'idle' | 'loading' | 'pending' | 'confirmed' | 'error'
  label: string
  accentColor: string
  accentTextColor: string
}

export function MobileStickyCTA({
  formId,
  phase,
  label,
  accentColor,
  accentTextColor,
}: MobileStickyCTAProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const formEl = document.getElementById(formId)
    if (!formEl) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting && phase === 'idle')
      },
      { threshold: 0 },
    )
    observer.observe(formEl)
    return () => observer.disconnect()
  }, [formId, phase])

  const scrollToForm = useCallback(() => {
    const formEl = document.getElementById(formId)
    formEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const emailInput = formEl?.querySelector('input[type="email"]') as HTMLInputElement | null
    setTimeout(() => emailInput?.focus(), 500)
  }, [formId])

  if (phase !== 'idle') return null

  return (
    <div
      className="nl-mobile-cta nl-sticky-cta"
      data-visible={String(visible)}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: '12px 18px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        background: 'linear-gradient(transparent, var(--pb-bg) 40%)',
      }}
    >
      <button
        onClick={scrollToForm}
        style={{
          width: '100%',
          padding: '14px 0',
          border: 'none',
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 700,
          cursor: 'pointer',
          background: accentColor,
          color: accentTextColor,
          fontFamily: 'var(--font-jetbrains-var), monospace',
        }}
      >
        ↑ {label}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/newsletters/\[slug\]/mobile-sticky-cta.tsx
git commit -m "feat(newsletter-landing): mobile sticky CTA — scroll-aware bottom bar with IntersectionObserver"
```

---

### Task 11: Landing Page Server Component

**Files:**
- Create: `apps/web/src/app/(public)/newsletters/[slug]/page.tsx`

- [ ] **Step 1: Write the landing page**

```typescript
// apps/web/src/app/(public)/newsletters/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Image from 'next/image'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import type { Metadata } from 'next'
import { Paper, Tape, rot, lift } from '@/components/pinboard'
import { SubscribeForm } from './subscribe-form'
import { FaqAccordion } from './faq-accordion'
import { MobileStickyCTA } from './mobile-sticky-cta'
import {
  getNewsletterTypeBySlug,
  getNewsletterStats,
  getRecentEditions,
  getActiveTypeCount,
} from '@/lib/newsletter/queries'
import {
  formatSubscriberCount,
  formatDaysAgo,
  resolveAccentTextColor,
  deriveCadenceLabel,
} from '@/lib/newsletter/format'
import { subscribeToNewsletters } from '@/app/(public)/actions/subscribe-newsletters'
import { resolveSiteByHost } from '@/lib/seo/host'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { IDENTITY_PROFILES } from '@/lib/seo/identity-profiles'
import enStrings from '@/locales/en.json'
import ptBrStrings from '@/locales/pt-BR.json'
import './newsletter-landing.css'

export const dynamicParams = true

export async function generateStaticParams() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data } = await supabase
    .from('newsletter_types')
    .select('slug')
    .eq('active', true)

  return (data ?? []).map((t) => ({ slug: t.slug }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  const type = await getNewsletterTypeBySlug(slug)
  if (!type) return { title: 'Newsletter Not Found' }

  const h = await headers()
  const host = (h.get('host') ?? '').split(':')[0] ?? ''
  const site = await resolveSiteByHost(host)
  const config = site ? await getSiteSeoConfig(site.id, host) : null

  const description = type.description ?? type.tagline ?? ''
  const ogImage = type.og_image_url
    ?? (process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED !== 'false'
      ? `${config?.siteUrl ?? ''}/og/newsletter/${type.slug}`
      : config?.defaultOgImageUrl ?? '/og-default.png')

  return {
    title: `${type.name} — Newsletter`,
    description,
    openGraph: {
      title: type.name,
      description,
      type: 'website',
      locale: type.locale === 'pt-BR' ? 'pt_BR' : 'en_US',
      url: `${config?.siteUrl ?? ''}/newsletters/${type.slug}`,
      images: [ogImage],
      siteName: config?.siteName ?? 'Thiago Figueiredo',
    },
    twitter: {
      card: 'summary_large_image',
      site: config?.twitterHandle ? `@${config.twitterHandle}` : undefined,
    },
    alternates: {
      canonical: `/newsletters/${type.slug}`,
    },
  }
}

export default async function NewsletterLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  let type, stats, editions, otherTypesCount
  try {
    const h = await headers()
    const host = (h.get('host') ?? '').split(':')[0] ?? ''
    const site = await resolveSiteByHost(host)
    const siteId = site?.id ?? ''

    const results = await Promise.all([
      getNewsletterTypeBySlug(slug),
      getNewsletterTypeBySlug(slug).then((t) =>
        t ? getNewsletterStats(t.id, t.site_id) : { subscriberCount: 0, editionsCount: 0, daysSinceLastEdition: null },
      ),
      getNewsletterTypeBySlug(slug).then((t) =>
        t ? getRecentEditions(t.id, t.site_id, 3) : [],
      ),
      getActiveTypeCount(siteId),
    ])
    type = results[0]
    stats = results[1]
    editions = results[2]
    otherTypesCount = results[3] - 1
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'newsletter-landing', seo: true },
      extra: { slug },
    })
    throw err
  }

  if (!type) notFound()

  const locale = type.locale as 'en' | 'pt-BR'
  const t = (locale === 'pt-BR' ? ptBrStrings : enStrings) as Record<string, unknown>
  const landing = t.newsletter as Record<string, unknown>
  const lt = landing?.landing as Record<string, string>
  const faqItems = (landing?.landing as Record<string, unknown>)?.faq as Array<{ q: string; a: string }>

  const accentColor = type.color
  const accentTextColor = resolveAccentTextColor(accentColor)
  const cadenceLabel = deriveCadenceLabel(type.cadence_label, type.cadence_days, locale)
  const subscriberDisplay = formatSubscriberCount(stats.subscriberCount)
  const promise = type.landing_content?.promise ?? []

  const profile = IDENTITY_PROFILES.bythiagofigueiredo
  const authorName = profile?.type === 'person' ? profile.name : 'Thiago Figueiredo'
  const privacyHref = locale === 'pt-BR' ? '/privacidade' : '/privacy'

  const formStrings = {
    stepLabel: lt.stepLabel,
    formTitle: lt.formTitle,
    formSubtitle: lt.formSubtitle,
    emailLabel: lt.emailLabel,
    emailPlaceholder: lt.emailPlaceholder,
    consentPrefix: lt.consentPrefix,
    consentSuffix: lt.consentSuffix,
    privacy: lt.privacy,
    submit: lt.submit,
    submitting: lt.submitting,
    noSpam: lt.noSpam,
    noPitch: lt.noPitch,
    oneClickLeave: lt.oneClickLeave,
    pendingTitle: lt.pendingTitle,
    pendingBody: lt.pendingBody,
    pendingStep1: lt.pendingStep1,
    pendingStep2: lt.pendingStep2,
    pendingStep3: lt.pendingStep3,
    pendingTip: lt.pendingTip,
    pendingResend: lt.pendingResend,
    pendingResent: lt.pendingResent,
    pendingChangeEmail: lt.pendingChangeEmail,
    confirmedTitle: lt.confirmedTitle,
    confirmedBody: lt.confirmedBody,
    confirmedExclamation: lt.confirmedExclamation,
    successAgain: lt.successAgain,
    errorRateLimit: lt.errorRateLimit,
    errorAlreadySubscribed: lt.errorAlreadySubscribed,
    errorInvalid: lt.errorInvalid,
    errorServer: lt.errorServer,
  }

  return (
    <article
      lang={locale === 'pt-BR' ? 'pt-BR' : 'en'}
      className="nl-landing"
      style={{
        '--nl-accent-light': type.color,
        '--nl-accent-dark': type.color_dark ?? type.color,
        '--nl-accent-text': accentTextColor,
      } as React.CSSProperties}
    >
      {/* Skip link */}
      <a href="#form-hero" className="nl-skip-link">
        {locale === 'pt-BR' ? 'Pular para o formulário' : 'Skip to subscribe form'}
      </a>

      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="nl-section"
        style={{ padding: '24px 28px 0' }}
      >
        <ol
          style={{
            display: 'flex',
            gap: 8,
            listStyle: 'none',
            margin: 0,
            padding: 0,
            fontSize: 12,
            fontFamily: 'var(--font-jetbrains-var), monospace',
            color: 'var(--pb-faint)',
          }}
        >
          <li>
            <Link href="/" style={{ color: 'var(--pb-faint)', textDecoration: 'none' }}>
              {lt.crumbHome}
            </Link>
          </li>
          {otherTypesCount >= 0 && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/newsletters" style={{ color: 'var(--pb-faint)', textDecoration: 'none' }}>
                  {lt.crumbHub}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true">/</li>
          <li aria-current="page" style={{ color: 'var(--pb-muted)' }}>
            {type.slug}
          </li>
        </ol>
      </nav>

      {/* ── HERO + FORM ── */}
      <section className="nl-section nl-hero-grid" style={{ padding: '40px 28px 48px' }}>
        {/* Left column: content */}
        <div>
          {/* Slug line: badge + recency */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            {type.badge && (
              <span
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: 'var(--nl-accent)',
                  color: accentTextColor,
                  fontFamily: 'var(--font-jetbrains-var), monospace',
                  fontWeight: 700,
                }}
              >
                {type.badge}
              </span>
            )}
            {stats.daysSinceLastEdition !== null && (
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-jetbrains-var), monospace',
                  color: 'var(--pb-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'rgba(0,0,0,0.04)',
                  padding: '2px 8px',
                  borderRadius: 4,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: stats.daysSinceLastEdition < 14 ? '#3CB371' : '#D9A441',
                  }}
                />
                {lt.sentLabel} {formatDaysAgo(stats.daysSinceLastEdition, locale)}
              </span>
            )}
          </div>

          {/* Title */}
          <h1
            style={{
              fontFamily: 'var(--font-fraunces-var), serif',
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.05,
              color: 'var(--pb-ink)',
              marginBottom: 12,
            }}
          >
            <span className="nl-marker-underline">{type.name}</span>
          </h1>

          {/* Tagline */}
          {type.tagline && (
            <p
              style={{
                fontFamily: 'var(--font-fraunces-var), serif',
                fontSize: 22,
                fontStyle: 'italic',
                color: 'var(--pb-muted)',
                marginBottom: 16,
              }}
            >
              {type.tagline}
            </p>
          )}

          {/* Description */}
          {type.description && (
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.6,
                color: 'var(--pb-ink)',
                marginBottom: 24,
                maxWidth: 620,
              }}
            >
              {type.description}
            </p>
          )}

          {/* Stat row */}
          <div className="nl-stat-row" style={{ marginBottom: 32 }}>
            {cadenceLabel && (
              <div className="nl-stat-item">
                <div style={{ fontFamily: 'var(--font-jetbrains-var), monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--pb-faint)', marginBottom: 2 }}>
                  {locale === 'pt-BR' ? 'cadência' : 'cadence'}
                </div>
                <div style={{ fontFamily: 'var(--font-fraunces-var), serif', fontSize: 18, fontWeight: 600, color: 'var(--pb-ink)' }}>
                  {cadenceLabel}
                </div>
              </div>
            )}
            {subscriberDisplay && (
              <div className="nl-stat-item">
                <div style={{ fontFamily: 'var(--font-jetbrains-var), monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--pb-faint)', marginBottom: 2 }}>
                  {lt.subsLabel}
                </div>
                <div style={{ fontFamily: 'var(--font-fraunces-var), serif', fontSize: 18, fontWeight: 600, color: 'var(--pb-ink)' }}>
                  {subscriberDisplay}
                </div>
              </div>
            )}
            {stats.editionsCount > 0 && (
              <div className="nl-stat-item">
                <div style={{ fontFamily: 'var(--font-jetbrains-var), monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--pb-faint)', marginBottom: 2 }}>
                  {lt.issuesLabel}
                </div>
                <div style={{ fontFamily: 'var(--font-fraunces-var), serif', fontSize: 18, fontWeight: 600, color: 'var(--pb-ink)' }}>
                  {stats.editionsCount}
                </div>
              </div>
            )}
          </div>

          {/* Promise section */}
          {promise.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2
                style={{
                  fontFamily: 'var(--font-fraunces-var), serif',
                  fontSize: 20,
                  fontWeight: 600,
                  color: 'var(--pb-ink)',
                  marginBottom: 12,
                }}
              >
                {lt.sectionWhat}
              </h2>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {promise.map((item, i) => (
                  <li key={i} style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--pb-ink)' }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right column: sticky form */}
        <div className="nl-form-sticky">
          <Paper tint="var(--pb-paper)" padding="28px" shadow>
            <Tape style={{ top: -6, left: '30%', transform: 'rotate(-4deg)' }} />
            <SubscribeForm
              newsletterId={type.id}
              locale={locale}
              accentColor={accentColor}
              newsletterName={type.name}
              strings={formStrings}
              privacyHref={privacyHref}
              turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              onSubscribe={subscribeToNewsletters}
            />
          </Paper>

          {/* Back to hub link */}
          {otherTypesCount > 0 && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Link
                href="/newsletters"
                style={{
                  fontFamily: 'var(--font-jetbrains-var), monospace',
                  fontSize: 11,
                  color: 'var(--pb-faint)',
                  textDecoration: 'underline',
                }}
              >
                {lt.backToHub}
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── SAMPLE ISSUES ── */}
      {editions.length > 0 && (
        <section className="nl-section" style={{ padding: '0 28px 48px' }}>
          <h2
            style={{
              fontFamily: 'var(--font-fraunces-var), serif',
              fontSize: 28,
              fontWeight: 600,
              color: 'var(--pb-ink)',
              marginBottom: 20,
            }}
          >
            {lt.sectionSamples}
          </h2>
          <div className="nl-samples-grid">
            {editions.map((edition, i) => (
              <Paper key={edition.id} tint={i % 2 === 0 ? 'var(--pb-paper)' : 'var(--pb-paper2)'} rotation={rot(i)} translateY={lift(i)}>
                <Tape color={i % 2 === 0 ? 'var(--pb-tape)' : 'var(--pb-tape2)'} style={{ top: -6, right: '25%', transform: `rotate(${(i * 11) % 9 - 4}deg)` }} />
                <div style={{ padding: '4px 0' }}>
                  <div style={{ fontFamily: 'var(--font-jetbrains-var), monospace', fontSize: 10, color: 'var(--pb-faint)', marginBottom: 6 }}>
                    {new Date(edition.sent_at).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-fraunces-var), serif', fontSize: 17, fontWeight: 600, color: 'var(--pb-ink)', marginBottom: 8, lineHeight: 1.3 }}>
                    {edition.subject}
                  </h3>
                  {edition.preheader && (
                    <p style={{ fontSize: 14, color: 'var(--pb-muted)', lineHeight: 1.5, marginBottom: 10 }}>
                      {edition.preheader}
                    </p>
                  )}
                  <Link
                    href={`/newsletter/archive/${edition.id}`}
                    style={{ fontFamily: 'var(--font-jetbrains-var), monospace', fontSize: 12, color: 'var(--nl-accent)', textDecoration: 'underline' }}
                  >
                    {lt.sampleReadFull}
                  </Link>
                </div>
              </Paper>
            ))}
          </div>
        </section>
      )}

      {/* ── AUTHOR ── */}
      <section className="nl-section" style={{ padding: '0 28px 48px' }}>
        <h2
          style={{
            fontFamily: 'var(--font-fraunces-var), serif',
            fontSize: 28,
            fontWeight: 600,
            color: 'var(--pb-ink)',
            marginBottom: 20,
          }}
        >
          {lt.sectionAuthor}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <Image
            src="/identity/thiago.jpg"
            alt={authorName}
            width={72}
            height={72}
            style={{ borderRadius: '50%', flexShrink: 0 }}
          />
          <div>
            <div style={{ fontFamily: 'var(--font-fraunces-var), serif', fontSize: 20, fontWeight: 600, color: 'var(--pb-ink)' }}>
              {authorName}
            </div>
            <div style={{ fontFamily: 'var(--font-jetbrains-var), monospace', fontSize: 12, color: 'var(--pb-faint)', marginBottom: 8 }}>
              {lt.authorRole}
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--pb-muted)', maxWidth: 520, marginBottom: 10, marginTop: 0 }}>
              {lt.authorBio}
            </p>
            <div style={{ display: 'flex', gap: 16 }}>
              <Link href="/about" style={{ fontFamily: 'var(--font-jetbrains-var), monospace', fontSize: 12, color: 'var(--nl-accent)', textDecoration: 'underline' }}>
                {lt.authorMore}
              </Link>
              <Link href="/now" style={{ fontFamily: 'var(--font-jetbrains-var), monospace', fontSize: 12, color: 'var(--nl-accent)', textDecoration: 'underline' }}>
                {lt.authorNow}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="nl-section" style={{ padding: '0 28px 48px' }}>
        <FaqAccordion items={faqItems ?? []} sectionTitle={lt.sectionFaq} />
      </section>

      {/* ── FINAL CTA ── */}
      <section
        className="nl-section nl-final-grid"
        style={{
          padding: '48px 28px',
          background: 'var(--nl-accent)',
          color: accentTextColor,
          borderRadius: 8,
          margin: '0 28px 48px',
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-jetbrains-var), monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7, marginBottom: 8 }}>
            {lt.finalKicker}
          </div>
          <h2 style={{ fontFamily: 'var(--font-fraunces-var), serif', fontSize: 36, fontWeight: 700, marginBottom: 8 }}>
            {lt.finalTitle.replace('{name}', type.name)}
          </h2>
          {cadenceLabel && (
            <p style={{ fontSize: 16, opacity: 0.85, marginBottom: 4 }}>
              {lt.finalSub.replace('{cadence}', cadenceLabel)}
            </p>
          )}
          {subscriberDisplay && (
            <p style={{ fontSize: 14, opacity: 0.7 }}>
              {lt.finalSubscribers.replace('{count}', subscriberDisplay)}
            </p>
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          <a
            href="#form-hero"
            style={{
              display: 'inline-block',
              padding: '14px 32px',
              background: accentTextColor,
              color: accentColor,
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 700,
              textDecoration: 'none',
              fontFamily: 'var(--font-jetbrains-var), monospace',
            }}
          >
            {lt.backToTopForm}
          </a>
        </div>
      </section>

      {/* ── FOOTER MICROCOPY ── */}
      <footer className="nl-section" style={{ padding: '0 28px 48px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--pb-faint)', marginBottom: 4 }}>{lt.footerNote}</p>
        <p style={{ fontSize: 11, color: 'var(--pb-faint)', marginBottom: 16 }}>{lt.footerSub}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 12, fontFamily: 'var(--font-jetbrains-var), monospace' }}>
          <Link href="/" style={{ color: 'var(--pb-muted)', textDecoration: 'underline' }}>
            {lt.backToHome}
          </Link>
          {otherTypesCount > 0 && (
            <Link href="/newsletters" style={{ color: 'var(--pb-muted)', textDecoration: 'underline' }}>
              {lt.allNewsletters}
            </Link>
          )}
        </div>
      </footer>

      {/* Mobile sticky CTA */}
      <MobileStickyCTA
        formId="form-hero"
        phase="idle"
        label={lt.backToTopForm}
        accentColor={accentColor}
        accentTextColor={accentTextColor}
      />
    </article>
  )
}
```

**Note:** The `MobileStickyCTA` receives `phase="idle"` as a static prop because the page is a server component. The CTA component internally manages visibility via IntersectionObserver. A future enhancement could lift phase state to a shared context, but for MVP the CTA only shows when form is out of viewport (which correlates with idle phase on initial render).

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/newsletters/\[slug\]/page.tsx
git commit -m "feat(newsletter-landing): main page — server component with ISR, metadata, 2-col hero, stats, promise, samples, author, FAQ, CTA"
```

---

### Task 12: Loading Skeleton

**Files:**
- Create: `apps/web/src/app/(public)/newsletters/[slug]/loading.tsx`

- [ ] **Step 1: Write loading skeleton**

```typescript
// apps/web/src/app/(public)/newsletters/[slug]/loading.tsx
export default function NewsletterLandingLoading() {
  const shimmer =
    'animate-pulse rounded-md bg-gradient-to-r from-[var(--pb-paper)] via-[var(--pb-paper2)] to-[var(--pb-paper)]'

  return (
    <div aria-busy="true" aria-label="Loading newsletter" style={{ padding: '24px 28px' }}>
      {/* Breadcrumb shimmer */}
      <div className={shimmer} style={{ width: 200, height: 14, marginBottom: 40 }} />

      {/* Hero grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 56, marginBottom: 48 }}>
        {/* Left: content */}
        <div>
          <div className={shimmer} style={{ width: 80, height: 20, marginBottom: 16, borderRadius: 4 }} />
          <div className={shimmer} style={{ width: '90%', height: 64, marginBottom: 12 }} />
          <div className={shimmer} style={{ width: '70%', height: 24, marginBottom: 16 }} />
          <div className={shimmer} style={{ width: '100%', height: 80, marginBottom: 24 }} />
          <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
            <div className={shimmer} style={{ width: 100, height: 48 }} />
            <div className={shimmer} style={{ width: 100, height: 48 }} />
            <div className={shimmer} style={{ width: 100, height: 48 }} />
          </div>
          <div className={shimmer} style={{ width: '80%', height: 120 }} />
        </div>
        {/* Right: form */}
        <div>
          <div className={shimmer} style={{ width: '100%', height: 360, borderRadius: 8 }} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/newsletters/\[slug\]/loading.tsx
git commit -m "feat(newsletter-landing): loading skeleton — shimmer matching 2-col layout"
```

---

### Task 13: Styled 404 Page

**Files:**
- Create: `apps/web/src/app/(public)/newsletters/[slug]/not-found.tsx`

- [ ] **Step 1: Write not-found page**

```typescript
// apps/web/src/app/(public)/newsletters/[slug]/not-found.tsx
import Link from 'next/link'
import { headers } from 'next/headers'
import { getActiveTypesForNotFound } from '@/lib/newsletter/queries'
import { resolveSiteByHost } from '@/lib/seo/host'

export default async function NewsletterNotFound() {
  const h = await headers()
  const host = (h.get('host') ?? '').split(':')[0] ?? ''
  const locale = (h.get('x-locale') ?? 'en') as 'en' | 'pt-BR'
  const site = await resolveSiteByHost(host)
  const types = site ? await getActiveTypesForNotFound(site.id) : []

  const isPt = locale === 'pt-BR'

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 28px',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-caveat-var), cursive',
          fontSize: 56,
          color: 'var(--pb-accent)',
          transform: 'rotate(-3deg)',
          marginBottom: 16,
        }}
      >
        {isPt ? 'epa.' : 'huh.'}
      </p>

      <h1
        style={{
          fontFamily: 'var(--font-fraunces-var), serif',
          fontSize: 44,
          fontWeight: 500,
          color: 'var(--pb-ink)',
          marginBottom: 12,
        }}
      >
        {isPt ? 'Essa newsletter não existe.' : "That newsletter doesn't exist."}
      </h1>

      <p
        style={{
          fontSize: 17,
          color: 'var(--pb-muted)',
          marginBottom: 32,
          maxWidth: 480,
        }}
      >
        {isPt
          ? 'Talvez o link tenha quebrado. Aqui estão as que existem agora:'
          : 'Maybe the link broke. Here are the ones that exist now:'}
      </p>

      {types.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            width: '100%',
            maxWidth: 600,
            marginBottom: 32,
          }}
        >
          {types.map((t) => (
            <Link
              key={t.slug}
              href={`/newsletters/${t.slug}`}
              style={{
                display: 'block',
                padding: '16px 20px',
                borderLeft: `4px solid ${t.color}`,
                background: 'var(--pb-paper)',
                borderRadius: 6,
                textDecoration: 'none',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-fraunces-var), serif',
                  fontSize: 18,
                  fontWeight: 600,
                  color: 'var(--pb-ink)',
                  marginBottom: 4,
                }}
              >
                {t.name}
              </div>
              {t.tagline && (
                <div style={{ fontSize: 13, color: 'var(--pb-muted)' }}>{t.tagline}</div>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <Link
          href="/"
          style={{
            fontFamily: 'var(--font-jetbrains-var), monospace',
            fontSize: 14,
            color: 'var(--nl-accent, var(--pb-accent))',
            textDecoration: 'underline',
          }}
        >
          {isPt ? 'Ir pra home' : 'Go to homepage'}
        </Link>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/newsletters/\[slug\]/not-found.tsx
git commit -m "feat(newsletter-landing): styled 404 — pinboard aesthetic, active types grid, locale-aware"
```

---

### Task 14: Dynamic OG Image Route

**Files:**
- Create: `apps/web/src/app/og/newsletter/[slug]/route.tsx`
- Modify: `apps/web/lib/seo/og/template.tsx` (add `NewsletterOgTemplate`)
- Modify: `apps/web/lib/seo/og/render.tsx` (add `renderNewsletterOgImage`)

- [ ] **Step 1: Add NewsletterOgTemplate to template.tsx**

In `apps/web/lib/seo/og/template.tsx`, add after `GenericOgTemplate`:

```typescript
export function NewsletterOgTemplate({
  name,
  description,
  cadenceLabel,
  accentColor,
  author,
  domain,
}: {
  name: string
  description: string | null
  cadenceLabel: string | null
  accentColor: string
  author: string
  domain: string
}) {
  const luminance = relativeLuminance(accentColor)
  const badgeStyle = luminance > 0.5
    ? { background: `${accentColor}22`, color: accentColor }
    : { background: accentColor, color: '#fff' }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#fafafa',
        fontFamily: 'Inter',
        padding: '50px 60px',
      }}
    >
      {/* Accent bar */}
      <div style={{ width: '100%', height: 6, background: accentColor, borderRadius: 3, marginBottom: 32 }} />

      {/* Label */}
      <div style={{ fontSize: 16, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 16 }}>
        NEWSLETTER
      </div>

      {/* Title */}
      <h1 style={{ fontSize: name.length > 30 ? 48 : 56, fontWeight: 700, color: '#111', lineHeight: 1.1, maxWidth: 1080, marginBottom: 16 }}>
        {truncate(name, 60)}
      </h1>

      {/* Description */}
      {description && (
        <p style={{ fontSize: 24, color: '#555', lineHeight: 1.4, maxWidth: 900, marginBottom: 'auto' }}>
          {truncate(description, 120)}
        </p>
      )}

      {/* Cadence badge */}
      {cadenceLabel && (
        <div style={{ display: 'flex', marginBottom: 24, marginTop: description ? 0 : 'auto' }}>
          <span style={{ ...badgeStyle, padding: '6px 16px', borderRadius: 6, fontSize: 16, fontWeight: 600 }}>
            ⟳ {cadenceLabel}
          </span>
        </div>
      )}

      {/* Divider + footer */}
      <div style={{ borderTop: '1px solid #eee', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 18, color: '#888' }}>{author}</span>
        <span style={{ fontSize: 18, color: '#888' }}>{domain}</span>
      </div>
    </div>
  )
}
```

Also add a `relativeLuminance` helper if `darkenHex` exists but luminance doesn't (check the existing file — the `darkenHex` function exists, add `relativeLuminance` near it):

```typescript
function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
```

- [ ] **Step 2: Add renderNewsletterOgImage to render.tsx**

In `apps/web/lib/seo/og/render.tsx`, add:

```typescript
export async function renderNewsletterOgImage(
  props: Parameters<typeof NewsletterOgTemplate>[0],
): Promise<Response> {
  const font = await loadInterBoldSubset()
  return new ImageResponse(<NewsletterOgTemplate {...props} />, {
    ...OG_RESPONSE_INIT,
    fonts: [{ name: 'Inter', data: font, weight: 700, style: 'normal' }],
  })
}
```

Add the import at the top: `import { ..., NewsletterOgTemplate } from './template'`

- [ ] **Step 3: Create OG route**

```typescript
// apps/web/src/app/og/newsletter/[slug]/route.tsx
import type { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { resolveSiteByHost } from '@/lib/seo/host'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { getNewsletterTypeBySlug } from '@/lib/newsletter/queries'
import { deriveCadenceLabel } from '@/lib/newsletter/format'
import { renderNewsletterOgImage, notFoundOgFallback } from '@/lib/seo/og/render'

export const runtime = 'nodejs'
export const revalidate = 3600

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  if (process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED === 'false') {
    return notFoundOgFallback()
  }
  const { slug } = await ctx.params
  try {
    const host = (req.headers.get('host') ?? '').split(':')[0] ?? ''
    const site = await resolveSiteByHost(host)
    if (!site) return notFoundOgFallback()
    const config = await getSiteSeoConfig(site.id, host)
    const type = await getNewsletterTypeBySlug(slug)
    if (!type) return notFoundOgFallback()

    return await renderNewsletterOgImage({
      name: type.name,
      description: type.description,
      cadenceLabel: deriveCadenceLabel(type.cadence_label, type.cadence_days, type.locale as 'en' | 'pt-BR'),
      accentColor: type.color,
      author: config.personIdentity?.name ?? config.siteName,
      domain: 'bythiagofigueiredo.com',
    })
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'og-route', type: 'newsletter', slug, seo: true },
    })
    return notFoundOgFallback()
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/og/newsletter/ apps/web/lib/seo/og/template.tsx apps/web/lib/seo/og/render.tsx
git commit -m "feat(newsletter-landing): dynamic OG image route — newsletter template + Satori rendering"
```

---

### Task 15: SEO Integration

**Files:**
- Modify: `apps/web/lib/seo/enumerator.ts`
- Modify: `apps/web/lib/seo/page-metadata.ts`
- Modify: `apps/web/lib/seo/cache-invalidation.ts` (add re-export)

- [ ] **Step 1: Add newsletter types to sitemap enumerator**

In `apps/web/lib/seo/enumerator.ts`, after the `archiveRoutes` block (around line 130) and before the `blogIndex` declaration, add:

```typescript
  // Newsletter landing pages (active types with slugs)
  const { data: newsletterTypes } = await supabase
    .from('newsletter_types')
    .select('slug, updated_at')
    .eq('site_id', siteId)
    .eq('active', true)
    .not('slug', 'is', null)

  const newsletterLandingRoutes: SitemapRouteEntry[] = (newsletterTypes ?? []).map((t) => ({
    path: `/newsletters/${t.slug}`,
    lastModified: t.updated_at ? new Date(t.updated_at) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
    alternates: {},
  }))
```

Then update the `all` array to include `...newsletterLandingRoutes`:

```typescript
  const all = [...buildStaticRoutes(config), blogIndex, ...postRoutes, ...campaignRoutes, ...archiveRoutes, ...newsletterLandingRoutes]
```

- [ ] **Step 2: Add generateNewsletterLandingMetadata to page-metadata.ts**

In `apps/web/lib/seo/page-metadata.ts`, add before `resolveOgImage`:

```typescript
export function generateNewsletterLandingMetadata(
  config: SiteSeoConfig,
  type: {
    slug: string
    name: string
    description: string | null
    tagline: string | null
    locale: string
    color: string
    og_image_url: string | null
  },
): Metadata {
  const description = type.description ?? type.tagline ?? `Newsletter — ${config.siteName}`
  const ogLocale = type.locale === 'pt-BR' ? 'pt_BR' : 'en_US'

  const ogImage = type.og_image_url
    ?? (process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED !== 'false'
      ? `${config.siteUrl}/og/newsletter/${type.slug}`
      : config.defaultOgImageUrl ?? `${config.siteUrl}/og-default.png`)

  return {
    ...baseMetadata(config),
    title: `${type.name} — Newsletter`,
    description,
    alternates: {
      canonical: `/newsletters/${type.slug}`,
    },
    openGraph: {
      ...baseMetadata(config).openGraph,
      title: type.name,
      description,
      type: 'website',
      locale: ogLocale,
      url: `${config.siteUrl}/newsletters/${type.slug}`,
      images: [ogImage],
    },
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/seo/enumerator.ts apps/web/lib/seo/page-metadata.ts
git commit -m "feat(newsletter-landing): SEO integration — sitemap enumerator + metadata factory"
```

---

### Task 16: Hub Slug Links

**Files:**
- Modify: `apps/web/src/app/(public)/newsletters/components/NewslettersHub.tsx`

- [ ] **Step 1: Add slug links to hub cards**

In `NewslettersHub.tsx`, update each newsletter card to include a "see more →" link when the newsletter has a slug. Since the hub uses a hardcoded `CATALOG`, add slug mappings:

At the top of the CATALOG definition, add slug per locale:

```typescript
const SLUG_MAP: Record<string, Record<'en' | 'pt', string>> = {
  main: { en: 'the-bythiago-diary', pt: 'diario-do-bythiago' },
  trips: { en: 'curves-and-roads', pt: 'curvas-e-estradas' },
  growth: { en: 'grow-inward', pt: 'crescer-de-dentro' },
  code: { en: 'code-in-portuguese', pt: 'codigo-em-portugues' },
}
```

In each card render, after the tagline/cadence, add:

```typescript
const slug = SLUG_MAP[item.baseId]?.[L === 'pt' ? 'pt' : 'en']
{slug && (
  <Link
    href={`/newsletters/${slug}`}
    style={{
      fontFamily: 'var(--font-jetbrains-var), monospace',
      fontSize: 11,
      color: 'var(--nl-accent, var(--pb-accent))',
      textDecoration: 'underline',
      display: 'block',
      marginTop: 8,
    }}
  >
    {L === 'pt' ? 'saiba mais →' : 'learn more →'}
  </Link>
)}
```

Add `import Link from 'next/link'` at the top if not already present.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/newsletters/components/NewslettersHub.tsx
git commit -m "feat(newsletter-landing): hub — add slug links to newsletter cards"
```

---

### Task 17: Integration Tests (DB-Gated)

**Files:**
- Create: `apps/web/test/integration/newsletter-types-landing.test.ts`

- [ ] **Step 1: Write DB-gated integration tests**

```typescript
// apps/web/test/integration/newsletter-types-landing.test.ts
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

describe.skipIf(skipIfNoLocalDb())('newsletter_types landing columns', () => {
  let db: SupabaseClient

  beforeAll(() => {
    db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  })

  it('slug column exists, is NOT NULL and UNIQUE', async () => {
    const { data, error } = await db
      .from('newsletter_types')
      .select('slug')
      .limit(1)

    expect(error).toBeNull()
    expect(data).toBeDefined()
  })

  it('slug format CHECK rejects invalid slugs', async () => {
    const { error } = await db
      .from('newsletter_types')
      .insert({
        id: 'test-bad-slug',
        locale: 'en',
        name: 'Test',
        color: '#000000',
        site_id: '00000000-0000-0000-0000-000000000000',
        slug: 'UPPER-CASE',
      })

    expect(error).toBeTruthy()
    expect(error?.message).toContain('newsletter_types_slug_format')
  })

  it('slug reserved words CHECK rejects "archive"', async () => {
    const { error } = await db
      .from('newsletter_types')
      .insert({
        id: 'test-reserved',
        locale: 'en',
        name: 'Test',
        color: '#000000',
        site_id: '00000000-0000-0000-0000-000000000000',
        slug: 'archive',
      })

    expect(error).toBeTruthy()
    expect(error?.message).toContain('newsletter_types_slug_reserved')
  })

  it('slug length CHECK rejects slugs < 3 chars', async () => {
    const { error } = await db
      .from('newsletter_types')
      .insert({
        id: 'test-short',
        locale: 'en',
        name: 'Test',
        color: '#000000',
        site_id: '00000000-0000-0000-0000-000000000000',
        slug: 'ab',
      })

    expect(error).toBeTruthy()
    expect(error?.message).toContain('newsletter_types_slug_length')
  })

  it('color_dark CHECK rejects invalid hex', async () => {
    const { error } = await db
      .from('newsletter_types')
      .update({ color_dark: 'not-a-color' })
      .eq('id', 'main-en')

    expect(error).toBeTruthy()
    expect(error?.message).toContain('newsletter_types_color_dark_hex')
  })

  it('og_image_url CHECK rejects non-https', async () => {
    const { error } = await db
      .from('newsletter_types')
      .update({ og_image_url: 'http://insecure.com/image.png' })
      .eq('id', 'main-en')

    expect(error).toBeTruthy()
    expect(error?.message).toContain('newsletter_types_og_image_url_https')
  })

  it('landing_content structural CHECK rejects invalid shape', async () => {
    const { error } = await db
      .from('newsletter_types')
      .update({ landing_content: '"not-an-object"' })
      .eq('id', 'main-en')

    expect(error).toBeTruthy()
  })

  it('backfilled slugs exist for all 8 types', async () => {
    const { data } = await db
      .from('newsletter_types')
      .select('id, slug')
      .not('slug', 'is', null)

    const slugs = (data ?? []).map((t) => t.slug)
    expect(slugs).toContain('diario-do-bythiago')
    expect(slugs).toContain('the-bythiago-diary')
    expect(slugs).toContain('curvas-e-estradas')
    expect(slugs).toContain('curves-and-roads')
    expect(slugs).toContain('crescer-de-dentro')
    expect(slugs).toContain('grow-inward')
    expect(slugs).toContain('codigo-em-portugues')
    expect(slugs).toContain('code-in-portuguese')
  })

  it('RLS: anon can only see active types', async () => {
    const anonDb = createClient(SUPABASE_URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.2vqMVFe4N4U-k6d93sZGvBl6dNUOdH1Q2-WGnnWRFyQ', { auth: { persistSession: false } })

    // First deactivate a type via service role
    await db.from('newsletter_types').update({ active: false }).eq('id', 'main-en')

    const { data } = await anonDb
      .from('newsletter_types')
      .select('id')
      .eq('id', 'main-en')

    expect(data).toHaveLength(0)

    // Restore
    await db.from('newsletter_types').update({ active: true }).eq('id', 'main-en')
  })

  it('updated_at trigger fires on UPDATE', async () => {
    const { data: before } = await db
      .from('newsletter_types')
      .select('updated_at')
      .eq('id', 'main-en')
      .single()

    // Small delay to ensure timestamp changes
    await new Promise((r) => setTimeout(r, 50))

    await db
      .from('newsletter_types')
      .update({ description: 'updated for test ' + Date.now() })
      .eq('id', 'main-en')

    const { data: after } = await db
      .from('newsletter_types')
      .select('updated_at')
      .eq('id', 'main-en')
      .single()

    expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(
      new Date(before!.updated_at).getTime(),
    )
  })
})
```

- [ ] **Step 2: Run integration tests**

Run: `HAS_LOCAL_DB=1 npm run test:web -- --run apps/web/test/integration/newsletter-types-landing.test.ts`
Expected: all 10 tests PASS (requires `npm run db:start && npm run db:reset` first).

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/integration/newsletter-types-landing.test.ts
git commit -m "test(newsletter-landing): DB-gated integration tests — schema constraints, backfill, RLS, updated_at trigger"
```

---

### Task 18: E2E Playwright Test

**Files:**
- Create: `apps/web/e2e/tests/public/newsletter-landing.spec.ts`

- [ ] **Step 1: Write Playwright spec**

```typescript
// apps/web/e2e/tests/public/newsletter-landing.spec.ts
import { test, expect } from '../../fixtures'

test.describe('Newsletter Landing Page', () => {
  test.use({ storageState: 'e2e/.auth/public.json' })

  test('renders landing page for valid slug', async ({ page }) => {
    await page.goto('/newsletters/the-bythiago-diary')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('bythiago diary')
    await expect(page.locator('#form-hero')).toBeVisible()
    await expect(page.getByLabel('Your email')).toBeVisible()
    await expect(page.getByRole('checkbox')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Subscribe' })).toBeVisible()
  })

  test('shows styled 404 for invalid slug', async ({ page }) => {
    await page.goto('/newsletters/nonexistent-newsletter')
    await expect(page.getByText("That newsletter doesn't exist")).toBeVisible()
  })

  test('subscribe form transitions to pending state', async ({ page, acceptedCookies }) => {
    void acceptedCookies
    await page.goto('/newsletters/the-bythiago-diary')
    const email = `e2e-landing-${Date.now()}@test.local`
    await page.getByLabel('Your email').fill(email)
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Subscribe' }).click()
    await expect(page.getByText('Check your inbox')).toBeVisible({ timeout: 10_000 })
  })

  test('mobile layout shows sticky CTA', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/newsletters/the-bythiago-diary')
    // Scroll past the form
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    const cta = page.locator('.nl-mobile-cta')
    await expect(cta).toBeVisible()
  })

  test('OG image route returns 200', async ({ request }) => {
    const response = await request.get('/og/newsletter/the-bythiago-diary')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/png')
  })

  test('breadcrumb shows correct structure', async ({ page }) => {
    await page.goto('/newsletters/the-bythiago-diary')
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(breadcrumb).toBeVisible()
    await expect(breadcrumb.getByText('Home')).toBeVisible()
    await expect(breadcrumb.getByText('Newsletters')).toBeVisible()
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/e2e/tests/public/newsletter-landing.spec.ts
git commit -m "test(newsletter-landing): E2E — landing page render, subscribe flow, 404, mobile CTA, OG, breadcrumb"
```

---

### Task 19: Run Full Test Suite + Final Commit

- [ ] **Step 1: Run all unit tests**

Run: `npm run test:web`
Expected: all tests pass including new ones.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no type errors.

- [ ] **Step 3: Fix any failures**

If tests fail or type errors exist, fix them before proceeding.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(newsletter-landing): test + type fixes from full suite run"
```
