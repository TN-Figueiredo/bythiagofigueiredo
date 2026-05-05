# Blog Archive Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faithfully reproduce `design/blog.html` on localhost — 3-column paper card grid with client-side filtering/sorting/search, hardcoded ads, read indicators with percentage, and "load more" pagination.

**Architecture:** RSC server component fetches ALL post metadata + tags in one query (ISR 3600s). Serializes to client component that handles all interactivity (filter, sort, search, load more, read indicators, URL sync). ~35KB gzipped payload for 500 posts.

**Tech Stack:** Next.js 15 RSC + React 19 client component, Tailwind 4, existing `ReadProgressStore`, existing ad components (`components/blog/ads/`), `coverGradient` for image fallbacks.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/src/app/(public)/blog/page.tsx` | Rewrite | RSC shell: fetch all posts + tags, SEO, pass data to client |
| `apps/web/src/app/(public)/blog/blog-archive-client.tsx` | Create | Main client component: filter state, URL sync, grid + load more |
| `apps/web/src/app/(public)/blog/writing-card.tsx` | Create | Paper card matching design WritingCard |
| `apps/web/src/app/(public)/blog/blog-filter-bar.tsx` | Create | Search input + sort buttons + category chips + tag chips |
| `apps/web/src/app/(public)/blog/blog-ad-slots.tsx` | Create | Hardcoded ad creatives + placement algorithm |
| `apps/web/src/app/(public)/blog/blog-mock-data.ts` | Create | 18 mock posts + tags for dev fallback |
| `apps/web/src/components/blog/readable-card.tsx` | Modify | Add percentage badge (not just "✓ lido") |
| `apps/web/src/app/(public)/blog/category-filter.tsx` | Delete | Replaced by blog-filter-bar |

---

### Task 1: Mock Data + Ad Creatives

**Files:**
- Create: `apps/web/src/app/(public)/blog/blog-mock-data.ts`
- Create: `apps/web/src/app/(public)/blog/blog-ad-slots.tsx`

- [ ] **Step 1: Create mock data file with 18 posts**

```typescript
// apps/web/src/app/(public)/blog/blog-mock-data.ts

export type BlogArchivePost = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  publishedAt: string
  readingTimeMin: number
  coverImageUrl: string | null
  tagId: string | null
  tagName: string | null
  tagSlug: string | null
  tagColor: string
  tagColorDark: string | null
}

export type BlogArchiveTag = {
  id: string
  name: string
  slug: string
  color: string
  colorDark: string | null
  postCount: number
}

export const MOCK_TAGS: BlogArchiveTag[] = [
  { id: 't1', name: 'Código', slug: 'codigo', color: '#D65B1F', colorDark: null, postCount: 4 },
  { id: 't2', name: 'Produto', slug: 'produto', color: '#2F6B22', colorDark: null, postCount: 3 },
  { id: 't3', name: 'Ensaios', slug: 'ensaios', color: '#1E4D7A', colorDark: null, postCount: 4 },
  { id: 't4', name: 'Diário', slug: 'diario', color: '#8A4A8F', colorDark: null, postCount: 3 },
  { id: 't5', name: 'Ferramentas', slug: 'ferramentas', color: '#B87333', colorDark: null, postCount: 2 },
  { id: 't6', name: 'Carreira', slug: 'carreira', color: '#5B6E2B', colorDark: null, postCount: 2 },
]

export const MOCK_POSTS: BlogArchivePost[] = [
  {
    id: 'p1', slug: 'manifesto-bythiagofigueiredo',
    title: 'Por que existe bythiagofigueiredo — e o que ele não é',
    excerpt: 'Um manifesto honesto sobre o porquê desse lugar existir, o que você vai encontrar aqui, e as três coisas que eu prometi a mim mesmo nunca fazer.',
    publishedAt: '2026-04-24T10:00:00Z', readingTimeMin: 9,
    coverImageUrl: null, tagId: 't3', tagName: 'Ensaios', tagSlug: 'ensaios', tagColor: '#1E4D7A', tagColorDark: null,
  },
  {
    id: 'p2', slug: 'seis-apps-um-caderno',
    title: 'Seis apps, um caderno — por que parei de separar produto de conteúdo',
    excerpt: 'Passei dois anos tratando blog e produto como coisas diferentes. Aqui está o que sobrou depois que joguei fora essa separação.',
    publishedAt: '2026-04-17T10:00:00Z', readingTimeMin: 8,
    coverImageUrl: null, tagId: 't3', tagName: 'Ensaios', tagSlug: 'ensaios', tagColor: '#1E4D7A', tagColorDark: null,
  },
  {
    id: 'p3', slug: 'um-cms-para-governar',
    title: 'Um CMS para governar todos — arquitetura de publicação cross-site',
    excerpt: 'A arquitetura por trás de publicar o mesmo post em seis sites diferentes sem copy-paste. Supabase, uma junction table, e uma caixa de checkbox.',
    publishedAt: '2026-04-14T10:00:00Z', readingTimeMin: 6,
    coverImageUrl: null, tagId: 't1', tagName: 'Código', tagSlug: 'codigo', tagColor: '#D65B1F', tagColorDark: null,
  },
  {
    id: 'p4', slug: 'onboarding-que-nao-pede',
    title: 'Onboarding que não pede nada: de 7 telas pra 1',
    excerpt: 'Como reduzi o onboarding do TôNaGarantia em 86% — e por que isso importa mais do que qualquer feature nova.',
    publishedAt: '2026-04-10T10:00:00Z', readingTimeMin: 5,
    coverImageUrl: null, tagId: 't2', tagName: 'Produto', tagSlug: 'produto', tagColor: '#2F6B22', tagColorDark: null,
  },
  {
    id: 'p5', slug: 'semana-14-quase-desisti',
    title: 'Semana 14: quase desisti',
    excerpt: 'A semana em que o TNG quase foi pro lixo. E os sete dias depois que mudaram tudo.',
    publishedAt: '2026-04-05T10:00:00Z', readingTimeMin: 3,
    coverImageUrl: null, tagId: 't4', tagName: 'Diário', tagSlug: 'diario', tagColor: '#8A4A8F', tagColorDark: null,
  },
  {
    id: 'p6', slug: 'custo-invisivel-contratar',
    title: 'O custo invisível de contratar (quando você é um)',
    excerpt: 'Terceirizei duas features e paguei caro. Um post honesto sobre quando delegar faz sentido, quando não.',
    publishedAt: '2026-03-28T10:00:00Z', readingTimeMin: 4,
    coverImageUrl: null, tagId: 't6', tagName: 'Carreira', tagSlug: 'carreira', tagColor: '#5B6E2B', tagColorDark: null,
  },
  {
    id: 'p7', slug: 'supabase-next15-dois-anos',
    title: 'Supabase + Next 15, dois anos depois: o que eu manteria, o que eu trocaria',
    excerpt: 'O que eu ainda gosto, o que me irrita, e as três coisas que eu trocaria sem pensar duas vezes.',
    publishedAt: '2026-03-22T10:00:00Z', readingTimeMin: 7,
    coverImageUrl: null, tagId: 't1', tagName: 'Código', tagSlug: 'codigo', tagColor: '#D65B1F', tagColorDark: null,
  },
  {
    id: 'p8', slug: 'cafezinho-deploy',
    title: 'O deploy da sexta-feira (e o cafezinho às 23h)',
    excerpt: 'Regra zero de solo builder: nunca faça deploy na sexta à noite. Regra um: às vezes a regra zero é uma mentira.',
    publishedAt: '2026-03-15T10:00:00Z', readingTimeMin: 2,
    coverImageUrl: null, tagId: 't4', tagName: 'Diário', tagSlug: 'diario', tagColor: '#8A4A8F', tagColorDark: null,
  },
  {
    id: 'p9', slug: 'ferramentas-abril-2026',
    title: 'Ferramentas que eu uso em abril de 2026 (e as que deixei de usar)',
    excerpt: 'Uma lista honesta: stack, apps, serviços pagos. Também: as três assinaturas que cancelei mês passado.',
    publishedAt: '2026-03-08T10:00:00Z', readingTimeMin: 5,
    coverImageUrl: null, tagId: 't5', tagName: 'Ferramentas', tagSlug: 'ferramentas', tagColor: '#B87333', tagColorDark: null,
  },
  {
    id: 'p10', slug: 'produto-sem-mercado',
    title: 'Produto sem mercado é hobby. Mercado sem produto é discurso.',
    excerpt: 'Passei seis meses construindo algo que ninguém pediu. O que eu aprendi sobre validação.',
    publishedAt: '2026-03-01T10:00:00Z', readingTimeMin: 6,
    coverImageUrl: null, tagId: 't3', tagName: 'Ensaios', tagSlug: 'ensaios', tagColor: '#1E4D7A', tagColorDark: null,
  },
  {
    id: 'p11', slug: 'analytics-minimalista',
    title: 'Analytics minimalista: 3 métricas, zero dashboards',
    excerpt: 'Parei de olhar Mixpanel. Agora olho três números uma vez por semana. Produtividade subiu.',
    publishedAt: '2026-02-22T10:00:00Z', readingTimeMin: 4,
    coverImageUrl: null, tagId: 't2', tagName: 'Produto', tagSlug: 'produto', tagColor: '#2F6B22', tagColorDark: null,
  },
  {
    id: 'p12', slug: 'quando-escrever-codigo',
    title: 'Quando escrever código é a pior coisa que você pode fazer',
    excerpt: 'Dev indie tem um reflexo: abrir o editor. Geralmente é errado.',
    publishedAt: '2026-02-15T10:00:00Z', readingTimeMin: 5,
    coverImageUrl: null, tagId: 't6', tagName: 'Carreira', tagSlug: 'carreira', tagColor: '#5B6E2B', tagColorDark: null,
  },
  {
    id: 'p13', slug: 'bilingual-seo',
    title: 'SEO bilíngue sem sofrer: como estruturei PT+EN no mesmo domínio',
    excerpt: 'hreflang, rotas, tradução assistida por AI, e o erro que me custou tráfego orgânico.',
    publishedAt: '2026-02-08T10:00:00Z', readingTimeMin: 6,
    coverImageUrl: null, tagId: 't5', tagName: 'Ferramentas', tagSlug: 'ferramentas', tagColor: '#B87333', tagColorDark: null,
  },
  {
    id: 'p14', slug: 'roadmap-publico',
    title: 'Roadmap público: os prós, os contras, e por que eu voltei atrás',
    excerpt: 'Abri meu roadmap pro público por três meses. Aqui está o que ganhei, o que perdi.',
    publishedAt: '2026-02-01T10:00:00Z', readingTimeMin: 4,
    coverImageUrl: null, tagId: 't3', tagName: 'Ensaios', tagSlug: 'ensaios', tagColor: '#1E4D7A', tagColorDark: null,
  },
  {
    id: 'p15', slug: 'eu-escrevo-todo-dia',
    title: 'Eu escrevo todo dia há 400 dias. Aqui está o que mudou.',
    excerpt: 'Não é sobre disciplina. É sobre perder o medo da página em branco.',
    publishedAt: '2026-01-25T10:00:00Z', readingTimeMin: 3,
    coverImageUrl: null, tagId: 't4', tagName: 'Diário', tagSlug: 'diario', tagColor: '#8A4A8F', tagColorDark: null,
  },
  {
    id: 'p16', slug: 'primeiro-dolar-saas',
    title: 'O primeiro dólar do meu SaaS — e os 8 meses antes dele',
    excerpt: 'A história do primeiro pagamento real do TôNaGarantia. E todo o contexto que ninguém conta.',
    publishedAt: '2026-01-18T10:00:00Z', readingTimeMin: 7,
    coverImageUrl: null, tagId: 't2', tagName: 'Produto', tagSlug: 'produto', tagColor: '#2F6B22', tagColorDark: null,
  },
  {
    id: 'p17', slug: 'typescript-patterns-reais',
    title: 'Patterns de TypeScript que eu uso de verdade (sem over-engineering)',
    excerpt: 'Discriminated unions, branded types, e o pattern builder que eliminou 300 linhas de validação.',
    publishedAt: '2026-01-11T10:00:00Z', readingTimeMin: 8,
    coverImageUrl: null, tagId: 't1', tagName: 'Código', tagSlug: 'codigo', tagColor: '#D65B1F', tagColorDark: null,
  },
  {
    id: 'p18', slug: 'rls-supabase-multitenancy',
    title: 'RLS no Supabase: o guia que eu queria ter lido antes de perder 3 dias',
    excerpt: 'Row Level Security parece simples até seu primeiro bug de permissão em produção. Aqui está tudo que aprendi.',
    publishedAt: '2026-01-04T10:00:00Z', readingTimeMin: 9,
    coverImageUrl: null, tagId: 't1', tagName: 'Código', tagSlug: 'codigo', tagColor: '#D65B1F', tagColorDark: null,
  },
]
```

- [ ] **Step 2: Create ad slots file with hardcoded creatives + placement algorithm**

```typescript
// apps/web/src/app/(public)/blog/blog-ad-slots.tsx
import type { AdCreativeData } from '@/components/blog/ads/types'

export const BLOG_SPONSOR_ADS: AdCreativeData[] = [
  {
    campaignId: null, slotKey: 'blog-bookmark-railway', type: 'cpa', source: 'placeholder',
    interaction: 'link',
    title: 'Deploy sem stress, do dev ao prod',
    body: 'Hosting feito por dois desenvolvedores cansados de Heroku. Postgres, Redis, e um CLI que não te odeia. 14 dias grátis.',
    ctaText: 'Conhecer o Railway Ghost →', ctaUrl: '#sponsor-railway',
    imageUrl: null, logoUrl: null, brandColor: '#7B5BF7', dismissSeconds: 0,
  },
  {
    campaignId: null, slotKey: 'blog-bookmark-obsidian', type: 'cpa', source: 'placeholder',
    interaction: 'link',
    title: 'Um livro sobre escrever em público — sem performar',
    body: 'São 12 ensaios curtos sobre como manter uma prática de escrita honesta quando ninguém te paga pra escrever.',
    ctaText: 'Comprar (R$ 39) →', ctaUrl: '#sponsor-obsidian',
    imageUrl: null, logoUrl: null, brandColor: '#3B5A4A', dismissSeconds: 0,
  },
]

export const BLOG_HOUSE_ADS: AdCreativeData[] = [
  {
    campaignId: null, slotKey: 'blog-anchor-newsletter', type: 'house', source: 'placeholder',
    interaction: 'link',
    title: 'Receba o próximo ensaio antes de virar público',
    body: 'Uma carta a cada 15 dias, com o que estou escrevendo, lendo, e construindo. 1.247 leitores. Sem spam.',
    ctaText: 'Assinar a newsletter →', ctaUrl: '/newsletters',
    imageUrl: null, logoUrl: null, brandColor: '#FF8240', dismissSeconds: 0,
  },
  {
    campaignId: null, slotKey: 'blog-marginalia-video', type: 'house', source: 'placeholder',
    interaction: 'link',
    title: 'Vejo sua dúvida em vídeo — toda quinta',
    body: 'Vídeos curtos sobre o que estou construindo. Esta semana: como o CMS gerencia vários sites com um post só.',
    ctaText: 'Ver no YouTube →', ctaUrl: '/videos',
    imageUrl: null, logoUrl: null, brandColor: '#C44B3D', dismissSeconds: 0,
  },
]

/**
 * Computes ad insertion positions for the blog grid.
 * - <6 visible: ad as last position
 * - 6-12 visible: position 6
 * - >12 visible: every (6*n + dayOffset), where dayOffset = (dayOfYear % 3) + 1
 */
export function computeAdPositions(visibleCount: number): number[] {
  if (visibleCount < 6) return [visibleCount]
  if (visibleCount <= 12) return [6]
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const offset = (dayOfYear % 3) + 1
  const positions: number[] = []
  let pos = 6 + offset
  while (pos < visibleCount) {
    positions.push(pos)
    pos += 6 + offset
  }
  return positions.length > 0 ? positions : [6]
}

/**
 * Picks a sponsor ad using daily rotation (offset to differ from home page).
 */
export function pickSponsor(index: number = 0): AdCreativeData {
  const day = Math.floor(Date.now() / 86400000) + 2
  return BLOG_SPONSOR_ADS[Math.abs(day + index) % BLOG_SPONSOR_ADS.length]
}

export function pickHouse(index: number = 0): AdCreativeData {
  const day = Math.floor(Date.now() / 86400000) + 2
  return BLOG_HOUSE_ADS[Math.abs(day + index) % BLOG_HOUSE_ADS.length]
}
```

- [ ] **Step 3: Verify types compile**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -i "blog-mock-data\|blog-ad-slots" | head -10`
Expected: No errors (or only unrelated errors)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/blog-mock-data.ts apps/web/src/app/\(public\)/blog/blog-ad-slots.tsx
git commit -m "feat(blog): add mock data and ad placement algorithm for archive redesign"
```

---

### Task 2: WritingCard Component

**Files:**
- Create: `apps/web/src/app/(public)/blog/writing-card.tsx`

- [ ] **Step 1: Create WritingCard component matching design/shared.jsx**

```tsx
// apps/web/src/app/(public)/blog/writing-card.tsx
'use client'

import Link from 'next/link'
import { coverGradient } from '@/lib/home/cover-image'
import type { BlogArchivePost } from './blog-mock-data'

type Props = {
  post: BlogArchivePost
  index: number
  locale: string
  isDark: boolean
}

const TAPE_COLORS = [
  'rgba(255, 226, 140, 0.42)', // yellow
  'rgba(209, 224, 255, 0.36)', // blue
  'rgba(255, 120, 120, 0.40)', // red
]

function rot(i: number): number {
  return ((i * 37) % 7 - 3) * 0.5
}

function lift(i: number): number {
  return ((i * 53) % 5 - 2) * 2
}

export function WritingCard({ post, index, locale, isDark }: Props) {
  const isPt = locale === 'pt-BR'
  const tapeColor = TAPE_COLORS[index % 3]
  const tapeLeft = index % 2 === 0
  const paperTint = index % 3 === 1 ? 'var(--pb-paper2)' : 'var(--pb-paper)'

  const gradient = coverGradient(post.tagSlug ?? post.tagName, isDark, post.tagColor)

  const blogBase = isPt ? '/pt/blog' : '/blog'

  return (
    <div style={{ position: 'relative', paddingTop: 16 }}>
      <div
        style={{
          background: paperTint,
          padding: 0,
          position: 'relative',
          transform: `rotate(${rot(index)}deg) translateY(${lift(index)}px)`,
          boxShadow: isDark
            ? '0 2px 0 rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03)'
            : '0 1px 0 rgba(0,0,0,0.04), 0 8px 20px rgba(70,50,20,0.16), inset 0 0 0 1px rgba(0,0,0,0.03)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        {/* Tape */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: 80,
            height: 18,
            background: tapeColor,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)',
            top: -9,
            ...(tapeLeft ? { left: '28%' } : { right: '28%' }),
            transform: `rotate(${(index * 11) % 12 - 6}deg)`,
            zIndex: 2,
          }}
        />

        <Link href={`${blogBase}/${post.slug}`} className="block no-underline" style={{ color: 'inherit' }}>
          {/* Cover image area */}
          <div
            style={{
              aspectRatio: '16 / 10',
              position: 'relative',
              overflow: 'hidden',
              background: post.coverImageUrl ? undefined : gradient,
            }}
          >
            {/* Type badge */}
            <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}>
              <span
                className="font-mono"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 8px',
                  background: 'var(--pb-ink)',
                  color: 'var(--pb-paper)',
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                ▤ {isPt ? 'texto' : 'post'}
              </span>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '16px 18px 18px' }}>
            {/* Category + date row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              {post.tagName && (
                <span
                  className="font-mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    color: isDark ? post.tagColor : (post.tagColorDark ?? post.tagColor),
                  }}
                >
                  {post.tagName}
                </span>
              )}
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--pb-faint)', letterSpacing: '0.08em' }}>
                {new Date(post.publishedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>

            {/* Title */}
            <h3
              className="font-fraunces"
              style={{
                fontSize: 19,
                lineHeight: 1.2,
                margin: '6px 0 8px',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: 'var(--pb-ink)',
              }}
            >
              {post.title}
            </h3>

            {/* Reading time */}
            <div className="font-mono" style={{ fontSize: 12, color: 'var(--pb-muted)', letterSpacing: '0.04em' }}>
              {post.readingTimeMin} min · {isPt ? 'leitura' : 'read'}
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep "writing-card" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/writing-card.tsx
git commit -m "feat(blog): add WritingCard component matching pinboard design"
```

---

### Task 3: Enhanced ReadableCard with Percentage Badge

**Files:**
- Modify: `apps/web/src/components/blog/readable-card.tsx`

- [ ] **Step 1: Add percentage badge to ReadableCard**

Replace the existing `ReadableCard` component with one that shows a percentage badge for in-progress reads (1–94%) and "✓ lido" for completed reads (≥95%).

```tsx
// apps/web/src/components/blog/readable-card.tsx
'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { ReadProgressStore } from '@/lib/tracking/read-progress-store'
import { READ_INDICATORS_ENABLED, READ_COMPLETE_THRESHOLD } from '@/lib/tracking/config'

type Props = {
  postId: string
  children: ReactNode
  dimTitle?: boolean
}

export function ReadableCard({ postId, children, dimTitle = true }: Props) {
  const [depth, setDepth] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!READ_INDICATORS_ENABLED) return
    const store = new ReadProgressStore()
    const p = store.getProgress(postId)
    if (p) setDepth(p.depth)
    setMounted(true)
  }, [postId])

  const isRead = depth >= READ_COMPLETE_THRESHOLD
  const hasProgress = depth > 0

  return (
    <div style={{ position: 'relative' }}>
      {/* Badge: percentage for in-progress, "✓ lido" for complete */}
      {mounted && hasProgress && (
        <div
          data-testid={isRead ? 'read-badge' : 'progress-badge'}
          className="font-mono"
          style={{
            position: 'absolute',
            top: 24,
            right: 12,
            zIndex: 10,
            background: 'rgba(0,0,0,0.75)',
            color: isRead ? '#8eda8e' : '#ccc',
            fontSize: 9,
            padding: '2px 7px',
            borderRadius: 3,
            letterSpacing: '0.05em',
            pointerEvents: 'none',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}
        >
          {isRead ? '✓ lido' : `${Math.round(depth)}%`}
        </div>
      )}
      <div style={isRead && dimTitle ? { opacity: 0.6 } : undefined}>
        {children}
      </div>
      {/* Progress bar */}
      {hasProgress && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'var(--pb-line, #332D25)',
          }}
        >
          <div
            data-testid="read-bar"
            style={{
              width: `${Math.min(depth, 100)}%`,
              height: '100%',
              background: 'var(--pb-yt, #FF3333)',
              borderRadius: depth < 100 ? '0 2px 2px 0' : undefined,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run existing tests to verify no regression**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web -- --testPathPattern="readable-card" 2>&1 | tail -20`
Expected: All existing tests pass (badge testid unchanged for "✓ lido" state)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/blog/readable-card.tsx
git commit -m "feat(blog): add percentage badge to ReadableCard for in-progress reads"
```

---

### Task 4: Blog Filter Bar Component

**Files:**
- Create: `apps/web/src/app/(public)/blog/blog-filter-bar.tsx`

- [ ] **Step 1: Create the filter bar matching the design**

```tsx
// apps/web/src/app/(public)/blog/blog-filter-bar.tsx
'use client'

import type { BlogArchiveTag } from './blog-mock-data'

export type SortKey = 'recent' | 'longest' | 'shortest' | 'unread'
export type FilterState = {
  cat: string
  tag: string
  q: string
  sort: SortKey
}

type Props = {
  filters: FilterState
  onUpdate: (patch: Partial<FilterState>) => void
  onReset: () => void
  tags: BlogArchiveTag[]
  totalCount: number
  filteredCount: number
  locale: string
}

const SORT_LABELS_PT: Record<SortKey, string> = {
  recent: 'Mais recentes',
  longest: 'Mais longos',
  shortest: 'Mais curtos',
  unread: 'Não lidos',
}
const SORT_LABELS_EN: Record<SortKey, string> = {
  recent: 'Newest',
  longest: 'Longest',
  shortest: 'Shortest',
  unread: 'Unread first',
}

export function BlogFilterBar({ filters, onUpdate, onReset, tags, totalCount, filteredCount, locale }: Props) {
  const isPt = locale === 'pt-BR'
  const sortLabels = isPt ? SORT_LABELS_PT : SORT_LABELS_EN
  const hasFilters = filters.cat !== 'all' || filters.tag !== '' || filters.q !== '' || filters.sort !== 'recent'

  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '8px 28px 0' }}>
      {/* Search + Sort row */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 440 }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--pb-faint)', pointerEvents: 'none' }}>⌕</span>
          <input
            type="text"
            role="searchbox"
            aria-label={isPt ? 'Buscar posts' : 'Search posts'}
            value={filters.q}
            onChange={(e) => onUpdate({ q: e.target.value })}
            placeholder={isPt ? 'buscar por título, tag, slug…' : 'search title, tag, slug…'}
            className="font-mono"
            style={{
              width: '100%',
              padding: '12px 14px 12px 36px',
              border: '1.5px solid var(--pb-line)',
              background: 'transparent',
              color: 'var(--pb-ink)',
              fontSize: 13,
              outline: 'none',
            }}
          />
          {filters.q && (
            <button
              onClick={() => onUpdate({ q: '' })}
              aria-label={isPt ? 'Limpar busca' : 'Clear search'}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', color: 'var(--pb-faint)',
                fontSize: 16, cursor: 'pointer', padding: 4,
              }}
            >×</button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="font-mono" style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--pb-faint)', marginRight: 4 }}>
            {isPt ? 'ordenar:' : 'sort:'}
          </span>
          {(Object.keys(sortLabels) as SortKey[]).map((key) => {
            const active = filters.sort === key
            return (
              <button
                key={key}
                onClick={() => onUpdate({ sort: key })}
                aria-pressed={active}
                className="font-mono"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px',
                  fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s', border: 'none',
                  background: active ? 'var(--pb-ink)' : 'transparent',
                  color: active ? 'var(--pb-bg)' : 'var(--pb-muted)',
                  outline: active ? 'none' : '1px solid var(--pb-line)',
                }}
              >
                {sortLabels[key]}
              </button>
            )
          })}
        </div>

        {hasFilters && (
          <button
            onClick={onReset}
            className="font-mono"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600,
              cursor: 'pointer', background: 'transparent',
              color: 'var(--pb-accent)', border: '1px dashed var(--pb-accent)',
              marginLeft: 'auto',
            }}
          >
            ✕ {isPt ? 'limpar tudo' : 'clear all'}
          </button>
        )}
      </div>

      {/* Category chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <span className="font-mono" style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--pb-faint)', marginRight: 4 }}>
          {isPt ? 'categoria:' : 'category:'}
        </span>
        {[{ id: 'all', name: isPt ? 'Tudo' : 'All', slug: 'all', color: 'var(--pb-ink)', colorDark: null, postCount: totalCount }, ...tags].map((tag) => {
          const active = filters.cat === tag.slug
          const color = tag.slug === 'all' ? 'var(--pb-ink)' : tag.color
          return (
            <button
              key={tag.slug}
              onClick={() => onUpdate({ cat: tag.slug === 'all' ? 'all' : tag.slug })}
              aria-pressed={active}
              className="font-mono"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 13px',
                fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s', border: 'none',
                background: active ? color : 'transparent',
                color: active ? '#FFF' : 'var(--pb-ink)',
                outline: active ? 'none' : `1.5px solid var(--pb-line)`,
                transform: active ? `rotate(${((tag.slug.charCodeAt(0) || 0) % 3 - 1) * 0.6}deg)` : 'none',
              }}
            >
              {tag.name}
              <span style={{
                fontSize: 10, opacity: active ? 0.85 : 0.55,
                padding: '1px 5px', background: active ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
                borderRadius: 3, fontWeight: 500,
              }}>
                {tag.postCount}
              </span>
            </button>
          )
        })}
      </div>

      {/* Dashed separator */}
      <div style={{ borderBottom: '1px dashed var(--pb-line)', marginBottom: 28, paddingBottom: 24 }} />

      {/* Result count */}
      <div aria-live="polite" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div className="font-mono" style={{ fontSize: 12, color: 'var(--pb-muted)', letterSpacing: '0.06em' }}>
          <span style={{ color: 'var(--pb-ink)', fontWeight: 600 }}>{filteredCount}</span>
          {' '}
          {filteredCount === 1 ? (isPt ? 'resultado' : 'result') : (isPt ? 'resultados' : 'results')}
          {hasFilters && (
            <span style={{ color: 'var(--pb-faint)', marginLeft: 8 }}>
              · {isPt ? 'filtrando' : 'filtered'}
              {filters.cat !== 'all' && <> · {tags.find(t => t.slug === filters.cat)?.name}</>}
              {filters.q && <> · &quot;{filters.q}&quot;</>}
            </span>
          )}
        </div>
        {!hasFilters && (
          <div className="font-caveat" style={{ fontSize: 17, color: 'var(--pb-accent)', transform: 'rotate(-1deg)' }}>
            ↓ {isPt ? 'começa por aqui' : 'start here'}
          </div>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep "blog-filter-bar" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/blog-filter-bar.tsx
git commit -m "feat(blog): add BlogFilterBar with search, sort, categories, result count"
```

---

### Task 5: BlogArchiveClient — Main Client Component

**Files:**
- Create: `apps/web/src/app/(public)/blog/blog-archive-client.tsx`

- [ ] **Step 1: Create the main archive client component**

```tsx
// apps/web/src/app/(public)/blog/blog-archive-client.tsx
'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ReadableCard } from '@/components/blog/readable-card'
import { ReadProgressStore } from '@/lib/tracking/read-progress-store'
import { READ_INDICATORS_ENABLED, READ_COMPLETE_THRESHOLD } from '@/lib/tracking/config'
import { BookmarkAd } from '@/components/blog/ads/bookmark-ad'
import { WritingCard } from './writing-card'
import { BlogFilterBar, type FilterState, type SortKey } from './blog-filter-bar'
import { computeAdPositions, pickSponsor, pickHouse } from './blog-ad-slots'
import type { BlogArchivePost, BlogArchiveTag } from './blog-mock-data'

const BATCH_SIZE = 6

type Props = {
  posts: BlogArchivePost[]
  tags: BlogArchiveTag[]
  locale: string
  isDark: boolean
}

export function BlogArchiveClient({ posts, tags, locale, isDark }: Props) {
  const isPt = locale === 'pt-BR'
  const router = useRouter()
  const searchParams = useSearchParams()
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Read progress state (client-only)
  const [readProgress, setReadProgress] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    if (!READ_INDICATORS_ENABLED) return
    const store = new ReadProgressStore()
    const progress = new Map<string, number>()
    posts.forEach((p) => {
      const prog = store.getProgress(p.id)
      if (prog) progress.set(p.id, prog.depth)
    })
    setReadProgress(progress)
  }, [posts])

  // Filter state from URL
  const [filters, setFilters] = useState<FilterState>(() => ({
    cat: searchParams.get('cat') ?? 'all',
    tag: searchParams.get('tag') ?? '',
    q: searchParams.get('q') ?? '',
    sort: (searchParams.get('sort') as SortKey) ?? 'recent',
  }))

  // Visible count for load more
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)

  // Sync filters to URL (debounced)
  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.cat !== 'all') params.set('cat', filters.cat)
    if (filters.tag) params.set('tag', filters.tag)
    if (filters.q) params.set('q', filters.q)
    if (filters.sort !== 'recent') params.set('sort', filters.sort)
    const qs = params.toString()
    const url = `/blog${qs ? `?${qs}` : ''}`
    const timeout = setTimeout(() => {
      router.replace(url, { scroll: false })
    }, 150)
    return () => clearTimeout(timeout)
  }, [filters, router])

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(BATCH_SIZE)
  }, [filters.cat, filters.tag, filters.q, filters.sort])

  const updateFilters = useCallback((patch: Partial<FilterState>) => {
    setFilters((f) => ({ ...f, ...patch }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters({ cat: 'all', tag: '', q: '', sort: 'recent' })
  }, [])

  // Filtered + sorted posts
  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    let arr = posts.filter((p) => {
      if (filters.cat !== 'all' && p.tagSlug !== filters.cat) return false
      if (q) {
        const hay = [p.title, p.excerpt, p.slug, p.tagName].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    switch (filters.sort) {
      case 'recent':
        arr.sort((a, b) => (b.publishedAt > a.publishedAt ? 1 : -1))
        break
      case 'longest':
        arr.sort((a, b) => b.readingTimeMin - a.readingTimeMin)
        break
      case 'shortest':
        arr.sort((a, b) => a.readingTimeMin - b.readingTimeMin)
        break
      case 'unread': {
        arr.sort((a, b) => {
          const aRead = (readProgress.get(a.id) ?? 0) >= READ_COMPLETE_THRESHOLD ? 1 : 0
          const bRead = (readProgress.get(b.id) ?? 0) >= READ_COMPLETE_THRESHOLD ? 1 : 0
          if (aRead !== bRead) return aRead - bRead
          return b.publishedAt > a.publishedAt ? 1 : -1
        })
        break
      }
    }
    return arr
  }, [posts, filters, readProgress])

  // Visible slice
  const visible = filtered.slice(0, visibleCount)
  const remaining = filtered.length - visibleCount

  // Ad positions
  const adPositions = useMemo(() => computeAdPositions(visible.length), [visible.length])
  const sponsorAd = useMemo(() => pickSponsor(0), [])
  const houseAd = useMemo(() => pickHouse(0), [])

  function handleLoadMore() {
    setVisibleCount((v) => Math.min(v + BATCH_SIZE, filtered.length))
    // Focus first new card after render
    setTimeout(() => {
      loadMoreRef.current?.querySelector<HTMLElement>(`[data-card-index="${visibleCount}"]`)?.focus()
    }, 100)
  }

  // Build grid items with ads injected
  const gridItems: Array<{ type: 'post'; post: BlogArchivePost; index: number } | { type: 'ad'; adData: typeof sponsorAd }> = []
  let adIdx = 0
  visible.forEach((post, i) => {
    if (adPositions.includes(i) && adIdx < 2) {
      gridItems.push({ type: 'ad', adData: adIdx === 0 ? sponsorAd : houseAd })
      adIdx++
    }
    gridItems.push({ type: 'post', post, index: i })
  })

  return (
    <>
      {/* Anchor ad — horizontal between filters and grid */}
      {/* (using house ad as anchor slot) */}

      {/* Filter bar */}
      <BlogFilterBar
        filters={filters}
        onUpdate={updateFilters}
        onReset={resetFilters}
        tags={tags}
        totalCount={posts.length}
        filteredCount={filtered.length}
        locale={locale}
      />

      {/* Grid */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 28px 96px' }} ref={loadMoreRef}>
        {filtered.length === 0 ? (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <div className="font-caveat" style={{ fontSize: 32, color: 'var(--pb-muted)', marginBottom: 12 }}>
              {isPt ? 'nada por aqui.' : 'nothing here.'}
            </div>
            <div style={{ fontSize: 14, color: 'var(--pb-faint)', marginBottom: 24 }}>
              {isPt ? 'tenta limpar os filtros ou buscar outra palavra.' : 'try clearing the filters or searching for another word.'}
            </div>
            <button
              onClick={resetFilters}
              className="font-mono"
              style={{
                padding: '10px 22px',
                background: 'var(--pb-accent)', color: '#FFF', border: 'none',
                fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isPt ? 'limpar filtros' : 'clear filters'}
            </button>
          </div>
        ) : (
          <>
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
              style={{ gap: 40, rowGap: 56 }}
            >
              {gridItems.map((item, idx) => {
                if (item.type === 'ad') {
                  return (
                    <div key={`ad-${idx}`} style={{ display: 'flex', alignItems: 'stretch' }}>
                      <BookmarkAd creative={item.adData} locale={locale as 'en' | 'pt-BR'} />
                    </div>
                  )
                }
                return (
                  <div key={item.post.id} data-card-index={item.index} tabIndex={-1}>
                    <ReadableCard postId={item.post.id}>
                      <WritingCard
                        post={item.post}
                        index={item.index}
                        locale={locale}
                        isDark={isDark}
                      />
                    </ReadableCard>
                  </div>
                )
              })}
            </div>

            {/* Load more */}
            {remaining > 0 ? (
              <div style={{ marginTop: 56, textAlign: 'center' }}>
                <button
                  onClick={handleLoadMore}
                  className="font-mono"
                  style={{
                    padding: '14px 28px',
                    background: 'transparent',
                    color: 'var(--pb-ink)',
                    border: '1.5px solid var(--pb-line)',
                    fontSize: 12,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                >
                  {isPt
                    ? `Ver mais ${Math.min(BATCH_SIZE, remaining)} de ${remaining} restantes`
                    : `Load ${Math.min(BATCH_SIZE, remaining)} more of ${remaining} remaining`}
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 56, textAlign: 'center' }}>
                <span className="font-caveat" style={{ fontSize: 20, color: 'var(--pb-accent)', transform: 'rotate(-1deg)', display: 'inline-block' }}>
                  {isPt ? 'isso é tudo! ↑' : "that's all! ↑"}
                </span>
              </div>
            )}
          </>
        )}
      </section>

      {/* Footer link */}
      <footer style={{ borderTop: '1px dashed var(--pb-line)', padding: 28, textAlign: 'center', color: 'var(--pb-faint)', fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
        <a href="/" style={{ color: 'var(--pb-accent)', textDecoration: 'none' }}>← {isPt ? 'voltar pra home' : 'back to home'}</a>
        <span style={{ margin: '0 16px', opacity: 0.5 }}>·</span>
        <a href="/videos" style={{ color: 'var(--pb-muted)', textDecoration: 'none' }}>{isPt ? 'vídeos →' : 'videos →'}</a>
      </footer>
    </>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep "blog-archive-client" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/blog-archive-client.tsx
git commit -m "feat(blog): add BlogArchiveClient with filter/sort/search/load-more/ads"
```

---

### Task 6: Rewrite page.tsx (Server Component)

**Files:**
- Rewrite: `apps/web/src/app/(public)/blog/page.tsx`
- Delete: `apps/web/src/app/(public)/blog/category-filter.tsx`

- [ ] **Step 1: Rewrite page.tsx to fetch all posts + tags and render client component**

```tsx
// apps/web/src/app/(public)/blog/page.tsx
import { Suspense } from 'react'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { getSiteContext, tryGetSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateBlogIndexMetadata } from '@/lib/seo/page-metadata'
import { buildBreadcrumbNode } from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import { JsonLdScript } from '@/lib/seo/jsonld/render'
import { localePath } from '@/lib/i18n/locale-path'
import { BlogArchiveClient } from './blog-archive-client'
import { MOCK_POSTS, MOCK_TAGS, type BlogArchivePost, type BlogArchiveTag } from './blog-mock-data'

export const revalidate = 3600

async function getAllBlogPosts(siteId: string, locale: string): Promise<{ posts: BlogArchivePost[]; tags: BlogArchiveTag[] }> {
  const db = getSupabaseServiceClient()
  const now = new Date().toISOString()

  // Fetch all published posts with tag info
  const { data: postRows, error: postErr } = await db
    .from('blog_translations')
    .select(
      `slug, title, excerpt, reading_time_min, locale,
       blog_posts!inner(id, published_at, cover_image_url, status, site_id, tag_id,
         blog_tags(id, name, slug, color, color_dark)
       )`
    )
    .eq('locale', locale)
    .eq('blog_posts.site_id', siteId)
    .eq('blog_posts.status', 'published')
    .lte('blog_posts.published_at', now)
    .order('published_at', { referencedTable: 'blog_posts', ascending: false })

  if (postErr) throw postErr

  const posts: BlogArchivePost[] = (postRows ?? []).map((row: Record<string, unknown>) => {
    const post = row['blog_posts'] as Record<string, unknown>
    const tag = post['blog_tags'] as Record<string, unknown> | null
    return {
      id: post['id'] as string,
      slug: row['slug'] as string,
      title: row['title'] as string,
      excerpt: row['excerpt'] as string | null,
      publishedAt: post['published_at'] as string,
      readingTimeMin: (row['reading_time_min'] as number) ?? 3,
      coverImageUrl: post['cover_image_url'] as string | null,
      tagId: tag ? (tag['id'] as string) : null,
      tagName: tag ? (tag['name'] as string) : null,
      tagSlug: tag ? (tag['slug'] as string) : null,
      tagColor: tag ? (tag['color'] as string) : '#6366f1',
      tagColorDark: tag ? (tag['color_dark'] as string | null) : null,
    }
  })

  // Fetch all tags with post counts for this site
  const { data: tagRows } = await db
    .from('blog_tags')
    .select('id, name, slug, color, color_dark, sort_order')
    .eq('site_id', siteId)
    .order('sort_order', { ascending: true })

  const tagsWithCounts: BlogArchiveTag[] = (tagRows ?? []).map((t: Record<string, unknown>) => ({
    id: t['id'] as string,
    name: t['name'] as string,
    slug: t['slug'] as string,
    color: t['color'] as string,
    colorDark: t['color_dark'] as string | null,
    postCount: posts.filter((p) => p.tagId === (t['id'] as string)).length,
  })).filter((t) => t.postCount > 0)

  return { posts, tags: tagsWithCounts }
}

export default async function BlogListPage() {
  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'
  const ctx = await getSiteContext()

  let posts: BlogArchivePost[]
  let tags: BlogArchiveTag[]

  try {
    const data = await getAllBlogPosts(ctx.siteId, locale)
    posts = data.posts
    tags = data.tags
  } catch {
    posts = []
    tags = []
  }

  // Fallback to mocks in development when no real data
  if (posts.length === 0 && process.env.NODE_ENV === 'development') {
    posts = MOCK_POSTS
    tags = MOCK_TAGS
  }

  // SEO: JSON-LD breadcrumbs
  const host = h.get('host') ?? ctx.primaryDomain ?? ''
  const config = await getSiteSeoConfig(ctx.siteId, host).catch(() => null)
  const breadcrumbGraph = config
    ? composeGraph([
        buildBreadcrumbNode([
          { name: 'Home', url: config.siteUrl },
          { name: 'Blog', url: `${config.siteUrl}${localePath('/blog', locale)}` },
        ]),
      ])
    : null

  const isPt = locale === 'pt-BR'
  const isDark = true // Site is always dark theme

  return (
    <>
      {breadcrumbGraph && <JsonLdScript graph={breadcrumbGraph} />}
      <main style={{ background: 'var(--pb-bg)', color: 'var(--pb-ink)', minHeight: '100vh' }}>
        {/* Page title section */}
        <section style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 28px 24px' }}>
          <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--pb-accent)', marginBottom: 10 }}>
            / {isPt ? 'arquivo' : 'archive'} · {posts.length} posts
          </div>
          <h1
            className="font-fraunces"
            style={{
              fontSize: 'clamp(36px, 5vw, 64px)',
              margin: 0,
              fontWeight: 500,
              letterSpacing: '-0.03em',
              lineHeight: 1.0,
              position: 'relative',
              display: 'inline-block',
            }}
          >
            {isPt ? 'Tudo que eu escrevi' : "Everything I've written"}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                bottom: 4,
                left: -6,
                right: -6,
                height: 18,
                background: 'var(--pb-marker)',
                zIndex: -1,
                opacity: 0.7,
                transform: 'skew(-2deg)',
              }}
            />
          </h1>
          <p style={{ fontSize: 16, color: 'var(--pb-muted)', marginTop: 18, maxWidth: 680, lineHeight: 1.6 }}>
            {isPt
              ? 'Ensaios, código, diário, carreira. Tudo em um só lugar — filtra, busca, ou só rola e lê o que chamar atenção.'
              : "Essays, code, diary, career. All in one place — filter, search, or just scroll and read what catches your eye."}
          </p>
        </section>

        <Suspense fallback={null}>
          <BlogArchiveClient posts={posts} tags={tags} locale={locale} isDark={isDark} />
        </Suspense>
      </main>
    </>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'
  const ctx = await tryGetSiteContext()
  if (!ctx) {
    return { title: 'Blog', alternates: { canonical: localePath('/blog', locale) } }
  }
  const host = h.get('host') ?? ctx.primaryDomain ?? ''
  try {
    const config = await getSiteSeoConfig(ctx.siteId, host)
    return generateBlogIndexMetadata(config, locale)
  } catch {
    return { title: 'Blog', alternates: { canonical: localePath('/blog', locale) } }
  }
}
```

- [ ] **Step 2: Delete old category-filter.tsx**

```bash
rm apps/web/src/app/\(public\)/blog/category-filter.tsx
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -i "error" | head -10`
Expected: No errors related to blog files

- [ ] **Step 4: Run dev server and verify on localhost**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npm run dev`
Open: `http://localhost:3000/blog`
Expected: Full pinboard-style blog archive with 18 mock posts, filter bar, paper cards, load more button

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/page.tsx
git rm apps/web/src/app/\(public\)/blog/category-filter.tsx
git commit -m "feat(blog): rewrite page.tsx as RSC shell with BlogArchiveClient"
```

---

### Task 7: Visual Polish + Anchor Ad Slot

**Files:**
- Modify: `apps/web/src/app/(public)/blog/blog-archive-client.tsx`

- [ ] **Step 1: Add HorizontalAnchor ad slot between filter bar and grid**

In `blog-archive-client.tsx`, add the anchor ad (horizontal sponsor row) between the `BlogFilterBar` and the grid section. Use the existing `AnchorAd` component from `@/components/blog/ads/anchor-ad`:

```tsx
// Add import at top:
import { AnchorAd } from '@/components/blog/ads/anchor-ad'

// Add between BlogFilterBar and the grid section:
{/* Anchor ad — horizontal sponsor between filters and results */}
<section style={{ maxWidth: 1280, margin: '0 auto 28px', padding: '0 28px' }}>
  <AnchorAd creative={pickHouse(1)} locale={locale as 'en' | 'pt-BR'} />
</section>
```

- [ ] **Step 2: Add reduced motion support**

Add at the top of `BlogArchiveClient`:
```tsx
const [reducedMotion, setReducedMotion] = useState(false)
useEffect(() => {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  setReducedMotion(mq.matches)
  const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}, [])
```

Pass `reducedMotion` to `WritingCard` and skip rotation/lift when true:
```tsx
// In WritingCard, accept reducedMotion?: boolean prop
// When true: transform = 'none' instead of rotate/translate
```

- [ ] **Step 3: Verify on localhost**

Open: `http://localhost:3000/blog`
Expected: Anchor ad visible between filters and grid. Cards with correct paper card design.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/blog-archive-client.tsx apps/web/src/app/\(public\)/blog/writing-card.tsx
git commit -m "feat(blog): add anchor ad slot and reduced motion support"
```

---

### Task 8: Run Tests + Final Verification

**Files:** None new

- [ ] **Step 1: Run full web test suite**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web 2>&1 | tail -20`
Expected: All tests pass. If any fail due to the blog page changes, fix them.

- [ ] **Step 2: Type check**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: 0 errors

- [ ] **Step 3: Visual verification on localhost**

Open `http://localhost:3000/blog` and verify:
1. ✅ 3-column grid with paper cards (tape, rotation, cover gradient)
2. ✅ Filter bar with search, sort, category chips
3. ✅ "Load more" shows 6 at a time with count
4. ✅ Bookmark ad appears at correct position in grid
5. ✅ Anchor ad between filters and grid
6. ✅ Empty state when no results
7. ✅ Read indicators (may need to visit a post first to see progress)
8. ✅ URL updates with filter state
9. ✅ Responsive: 3→2→1 columns at breakpoints
10. ✅ "Isso é tudo!" message when all loaded

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(blog): complete archive redesign matching design/blog.html"
```

---

## Summary

8 tasks total. Tasks 1–4 are independent and can be parallelized. Tasks 5–6 depend on 1–4. Tasks 7–8 are sequential polish + verification.

Estimated time: ~45 minutes for a focused implementation session.
