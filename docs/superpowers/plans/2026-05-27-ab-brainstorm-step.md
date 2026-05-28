# A/B Brainstorm Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Brainstorm com IA" step (step 2 "Ideias") to the A/B test creation wizard that generates a contextual AI prompt, lets the user copy it to Claude, and captures per-slot notes (B/C/D) that carry through as hints to the Variantes step.

**Architecture:** New prompt builder (`buildAbBriefingPrompt`) reuses `buildSharedBase()` from existing prompt system. New server action (`fetchAbBriefingData`) fetches minimal video + channel data. New `StepIdeias` component renders as an inline wizard step. Wizard grows from 4 to 5 steps: Tipo → Ideias → Variantes → Config → Revisar.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind 4, Vitest

**Spec:** `docs/superpowers/specs/2026-05-27-ab-brainstorm-step-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/web/src/lib/youtube/prompt-builders-ab.ts` | `buildAbBriefingPrompt()` — pure function, no DB |
| Create | `apps/web/test/youtube/prompt-builders-ab.test.ts` | Unit tests for the prompt builder |
| Create | `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-ideias.tsx` | StepIdeias component |
| Modify | `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard.tsx` | 4→5 step wizard, new state, StepIdeias integration, brainstorm hints in Variantes |
| Modify | `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts` | New `fetchAbBriefingData()` server action |
| Modify | `apps/web/src/lib/youtube/prompt-types.ts` | Add `AbBriefingData` type and `ab-briefing` preset |

---

### Task 1: AbBriefingData type + prompt version constant

**Files:**
- Modify: `apps/web/src/lib/youtube/prompt-types.ts`

- [ ] **Step 1: Add AbBriefingData type and ab-briefing prompt version**

In `apps/web/src/lib/youtube/prompt-types.ts`, add the `AbBriefingData` interface and the prompt version constant.

After the existing `PROMPT_VERSIONS` object (around line 6), add `'ab-briefing'` to it:

```typescript
const PROMPT_VERSIONS = {
  'content-calendar': 'yt-cc-v9',
  'channel-health': 'yt-ch-v9',
  'video-optimizer': 'yt-vo-v9',
  'ab-briefing': 'yt-ab-v1',
} as const
```

After the existing `ContextPreset` type, widen it to include `'ab-briefing'`:

```typescript
type ContextPreset = 'content-calendar' | 'channel-health' | 'video-optimizer' | 'ab-briefing'
```

At the end of the file, add the new interface:

```typescript
export interface AbBriefingData {
  channel: Pick<PromptChannelInfo, 'name' | 'subscribers' | 'tier'>
  video: {
    title: string
    thumbnailUrl: string | null
    ctr: number | null
    avgViewPercentage: number | null
    score: number | null
    grade: string | null
  }
  testHistory: Array<{
    test_type: string
    winner_label: string | null
    ctr_lift_percent: number | null
  }>
  snapshotAgeHours: number
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/youtube/prompt-types.ts
git commit -m "feat(ab-lab): add AbBriefingData type and ab-briefing prompt version"
```

---

### Task 2: buildAbBriefingPrompt — tests first

**Files:**
- Create: `apps/web/test/youtube/prompt-builders-ab.test.ts`
- Create: `apps/web/src/lib/youtube/prompt-builders-ab.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/test/youtube/prompt-builders-ab.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildAbBriefingPrompt } from '@/lib/youtube/prompt-builders-ab'
import type { AbBriefingData } from '@/lib/youtube/prompt-types'

function makeAbBriefingData(overrides?: Partial<AbBriefingData>): AbBriefingData {
  return {
    channel: { name: 'Test Channel', subscribers: 5000, tier: 'micro' },
    video: {
      title: 'O Que Esperar Do MBK Center em Bangkok',
      thumbnailUrl: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
      ctr: 4.2,
      avgViewPercentage: 38,
      score: 72,
      grade: 'B',
    },
    testHistory: [],
    snapshotAgeHours: 2,
    ...overrides,
  }
}

describe('buildAbBriefingPrompt', () => {
  it('includes buildSharedBase output (persona, guardrails)', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('# Persona')
    expect(prompt).toContain('Guardrails')
    expect(prompt).toContain('Guia de Confiança')
  })

  it('thumbnail template includes visual composition instructions', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('<instructions>')
    expect(prompt).toContain('composição visual')
    expect(prompt).toContain('3 variações')
  })

  it('title template includes hook and power word instructions', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'title',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('hook emocional')
    expect(prompt).toContain('power words')
  })

  it('description template includes fold and CTA instructions', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'description',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('CTA')
    expect(prompt).toContain('3 primeiras linhas')
  })

  it('combo template includes synergy instructions', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'combo',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('sinergia')
    expect(prompt).toContain('3 combos')
  })

  it('includes cross-test history when available', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData({
        testHistory: [
          { test_type: 'thumbnail', winner_label: 'B', ctr_lift_percent: 12.5 },
          { test_type: 'title', winner_label: 'C', ctr_lift_percent: 8.3 },
        ],
      }),
    })
    expect(prompt).toContain('historico_ab')
    expect(prompt).toContain('testes_anteriores')
  })

  it('handles channel-only fallback when video data is null', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData({
        video: {
          title: 'Video sem dados',
          thumbnailUrl: null,
          ctr: null,
          avgViewPercentage: null,
          score: null,
          grade: null,
        },
      }),
    })
    expect(prompt).toContain('sem dados de performance')
    expect(prompt).toContain('Test Channel')
  })

  it('appends custom focus text escaped', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
      focus: 'Focar em <cores quentes> e expressões faciais',
    })
    expect(prompt).toContain('Focar em &lt;cores quentes> e expressões faciais')
    expect(prompt).not.toContain('<cores quentes>')
  })

  it('omits historico_ab when test history is empty', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'title',
      data: makeAbBriefingData({ testHistory: [] }),
    })
    expect(prompt).not.toContain('historico_ab')
  })

  it('includes prompt version yt-ab-v1 in context', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('yt-ab-v1')
  })

  it('includes video metrics in context block', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('<context>')
    expect(prompt).toContain('"ctr": 4.2')
    expect(prompt).toContain('"grade": "B"')
  })

  it('includes channel info in context block', () => {
    const prompt = buildAbBriefingPrompt({
      testType: 'title',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('"name": "Test Channel"')
    expect(prompt).toContain('"subscribers": 5000')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run apps/web/test/youtube/prompt-builders-ab.test.ts 2>&1 | tail -20`
Expected: FAIL — module `@/lib/youtube/prompt-builders-ab` not found.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/youtube/prompt-builders-ab.ts`:

```typescript
import { PROMPT_VERSIONS } from './prompt-types'
import type { AbBriefingData } from './prompt-types'
import type { TestType } from './ab-types'
import { buildSharedBase, escapeXmlTags } from './prompt-builders'
import { sanitizeForMarkdown } from './prompt-sanitize'

const TEST_TYPE_INSTRUCTIONS: Record<TestType, string> = {
  thumbnail: `Analise a thumbnail atual e sugira 3 variações para teste A/B.
Para cada variação (B, C, D), descreva:
- Composição visual e enquadramento
- Paleta de cores e contraste
- Texto overlay (se aplicável)
- Expressão facial / elemento humano
Foco: composição visual, paleta de cores, texto overlay, expressão facial. 3 variações.`,

  title: `Analise o título atual e sugira 3 variações para teste A/B.
Para cada variação (B, C, D), descreva:
- Hook emocional ou curiosidade
- Power words e senso de urgência
- Uso de números, brackets, ou padrões comprovados
- Comprimento ideal: 50-60 caracteres
Foco: hook emocional, power words, números/brackets, comprimento 50-60 chars. 3 variações.`,

  description: `Analise a descrição atual e sugira 3 variações para teste A/B.
Para cada variação (B, C, D), descreva:
- Posição e texto do CTA principal
- Conteúdo acima do fold (3 primeiras linhas visíveis)
- Uso de links rastreados com sintaxe {{link:nome}}
- Hashtags estratégicas
Foco: CTA posição, fold (3 primeiras linhas), links {{link:nome}}, hashtags. 3 variações.`,

  combo: `Analise o combo atual (thumbnail + título) e sugira 3 combos coerentes para teste A/B.
Para cada combo (B, C, D), descreva:

**Thumbnail:**
- Composição e enquadramento
- Paleta de cores e contraste
- Texto overlay (se aplicável)

**Título:**
- Hook emocional ou curiosidade
- Power words e urgência
- Por que esse combo funciona junto

Foco: sinergia thumb+título, complementaridade visual/textual. 3 combos coerentes.`,
}

function buildHistorySection(testHistory: AbBriefingData['testHistory']): string {
  if (testHistory.length === 0) return ''

  const completedTests = testHistory.filter(t => t.winner_label !== null)
  const avgLift = completedTests.length > 0
    ? completedTests.reduce((sum, t) => sum + (t.ctr_lift_percent ?? 0), 0) / completedTests.length
    : 0

  const winnerPatterns = completedTests
    .map(t => t.winner_label)
    .filter((v): v is string => v !== null)

  return JSON.stringify({
    historico_ab: {
      testes_anteriores: testHistory.length,
      lift_medio: avgLift > 0 ? `+${avgLift.toFixed(1)}%` : 'N/A',
      padroes_vencedores: winnerPatterns,
    },
  }, null, 2)
}

export function buildAbBriefingPrompt(options: {
  testType: TestType
  data: AbBriefingData
  focus?: string
}): string {
  const { testType, data, focus } = options
  const sharedBase = buildSharedBase(data.channel)

  const videoHasData = data.video.ctr !== null || data.video.score !== null

  const contextPayload: Record<string, unknown> = {
    prompt_version: PROMPT_VERSIONS['ab-briefing'],
    current_time: new Date().toISOString(),
    channel: {
      name: data.channel.name,
      subscribers: data.channel.subscribers,
      tier: data.channel.tier,
    },
    video: {
      title: sanitizeForMarkdown(data.video.title, 200),
      thumbnailUrl: data.video.thumbnailUrl,
      ...(videoHasData
        ? {
            ctr: data.video.ctr,
            avgViewPercentage: data.video.avgViewPercentage,
            score: data.video.score,
            grade: data.video.grade,
          }
        : { nota: 'sem dados de performance disponíveis' }),
    },
  }

  const historySection = buildHistorySection(data.testHistory)
  if (historySection) {
    contextPayload.historico_ab = JSON.parse(historySection).historico_ab
  }

  const contextJson = JSON.stringify(contextPayload, null, 2)

  let instructions = TEST_TYPE_INSTRUCTIONS[testType]
  if (focus) {
    instructions += `\n\nInstruções adicionais do usuário:\n${escapeXmlTags(focus)}`
  }

  if (!videoHasData) {
    instructions += '\n\nNota: sem dados de performance disponíveis para este vídeo. Use contexto do canal.'
  }

  return `${sharedBase}

<context>
${contextJson}
</context>

<instructions>
${instructions}
</instructions>`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/web/test/youtube/prompt-builders-ab.test.ts 2>&1 | tail -20`
Expected: All 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/prompt-builders-ab.ts apps/web/test/youtube/prompt-builders-ab.test.ts
git commit -m "feat(ab-lab): add buildAbBriefingPrompt with TDD tests"
```

---

### Task 3: fetchAbBriefingData server action

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts`

This task adds a new server action that fetches minimal video + channel data for the prompt builder.

- [ ] **Step 1: Add the fetchAbBriefingData function**

At the end of `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts`, add:

```typescript
export async function fetchAbBriefingData(
  videoId: string,
): Promise<{ ok: true; data: AbBriefingData } | { ok: false; error: string }> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: video, error: videoError } = await supabase
    .from('youtube_videos')
    .select('id, youtube_video_id, title, thumbnail_url, ctr, avg_view_percentage, channel_id, last_synced_at')
    .eq('id', videoId)
    .eq('site_id', siteId)
    .single()

  if (videoError && videoError.code !== 'PGRST116') throw videoError
  if (!video) return { ok: false, error: 'Vídeo não encontrado' }

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('name, subscriber_count')
    .eq('id', video.channel_id as string)
    .single()

  const subscribers = (channel?.subscriber_count as number | null) ?? 0
  const tier = getChannelTier(subscribers)

  const ctr = (video.ctr as number | null)
  const avgViewPercentage = (video.avg_view_percentage as number | null)

  let score: number | null = null
  let grade: string | null = null
  if (ctr !== null && avgViewPercentage !== null) {
    const result = scoreForPrompt(ctr, avgViewPercentage)
    score = result.score
    grade = result.grade
  }

  const testHistory = await getVideoTestHistory(video.youtube_video_id as string)
  const historyForBriefing = testHistory
    .filter(t => t.status === 'completed')
    .map(t => ({
      test_type: t.test_type,
      winner_label: t.winner_label,
      ctr_lift_percent: t.ctr_lift_percent,
    }))

  const lastSyncedAt = (video.last_synced_at as string | null) ?? new Date().toISOString()
  const snapshotAgeHours = Math.round(((Date.now() - new Date(lastSyncedAt).getTime()) / 3_600_000) * 10) / 10

  return {
    ok: true,
    data: {
      channel: {
        name: (channel?.name as string | null) ?? 'Canal',
        subscribers,
        tier,
      },
      video: {
        title: video.title as string,
        thumbnailUrl: (video.thumbnail_url as string | null),
        ctr,
        avgViewPercentage,
        score,
        grade,
      },
      testHistory: historyForBriefing,
      snapshotAgeHours,
    },
  }
}
```

- [ ] **Step 2: Add required imports at the top of the file**

At the top of `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts`, add these imports. Check which ones are already imported and only add what's missing:

```typescript
import { getChannelTier } from '@/lib/youtube/scoring'
import { scoreForPrompt } from '@/lib/youtube/prompt-scoring'
import type { AbBriefingData } from '@/lib/youtube/prompt-types'
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts"
git commit -m "feat(ab-lab): add fetchAbBriefingData server action"
```

---

### Task 4: StepIdeias component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-ideias.tsx`

This is the main UI component for the Brainstorm step. It displays: icon + title, cross-test insights bar, asset preview with metrics, custom instructions textarea with example chips, prompt card with copy/open buttons, per-slot notes (B/C/D), and tips.

- [ ] **Step 1: Create the StepIdeias component**

Create `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-ideias.tsx`:

```typescript
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import NextImage from 'next/image'
import { Lightbulb, Copy, Check, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { fetchAbBriefingData } from '../actions'
import { buildAbBriefingPrompt } from '@/lib/youtube/prompt-builders-ab'
import { estimateChars } from '@/lib/youtube/prompt-sanitize'
import { DataFreshnessBadge } from '../../../videos/_components/data-freshness-badge'
import { PromptPreview } from '@/components/prompt-preview'
import type { AbBriefingData } from '@/lib/youtube/prompt-types'
import type { TestType } from '@/lib/youtube/ab-types'

interface WizardVideo {
  id: string
  title: string
  thumbnailUrl: string | null
}

interface StepIdeiasProps {
  testType: TestType
  video: WizardVideo
  siteId: string
  focus: string
  onFocusChange: (value: string) => void
  slotNotes: [string, string, string]
  onSlotNoteChange: (index: number, value: string) => void
  briefingCopied: boolean
  onBriefingCopied: () => void
}

const SLOT_LABELS = ['B', 'C', 'D'] as const

const EXAMPLE_CHIPS: Record<TestType, string[]> = {
  thumbnail: ['Testar close-up vs paisagem', 'Cores quentes vs frias', 'Com vs sem texto overlay'],
  title: ['Testar hook de curiosidade', 'Comparar comprimentos curto vs longo', 'Números no início'],
  description: ['CTA no topo vs no meio', 'Testar com hashtags', 'Links acima do fold'],
  combo: ['Thumb minimalista + título dramático', 'Thumb colorida + título curto', 'Sinergia visual-textual'],
}

const TIPS: Record<TestType, string[]> = {
  thumbnail: [
    'Cole a thumbnail atual no chat para análise visual',
    'Peça variações que mantêm a identidade do canal',
    'Considere como a thumbnail aparece em telas pequenas (mobile)',
  ],
  title: [
    'Títulos entre 50-60 caracteres tendem a performar melhor',
    'Teste hooks emocionais vs informativos',
    'Power words: "segredo", "erro", "verdade", "definitivo"',
  ],
  description: [
    'As 3 primeiras linhas são as únicas visíveis antes do "mostrar mais"',
    'Inclua o CTA principal acima do fold',
    'Use {{link:nome}} para links rastreados automaticamente',
  ],
  combo: [
    'Thumbnail e título devem se complementar, não repetir informação',
    'Teste sinergias: thumb curiosa + título explicativo',
    'Cole a thumbnail no chat para análise visual combinada',
  ],
}

const TYPE_GRADIENT: Record<TestType, string> = {
  thumbnail: 'from-indigo-500 to-purple-600',
  title: 'from-amber-500 to-orange-600',
  description: 'from-emerald-500 to-teal-600',
  combo: 'from-pink-500 to-purple-600',
}

export function StepIdeias({
  testType,
  video,
  siteId,
  focus,
  onFocusChange,
  slotNotes,
  onSlotNoteChange,
  briefingCopied,
  onBriefingCopied,
}: StepIdeiasProps) {
  const [briefingData, setBriefingData] = useState<AbBriefingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [promptExpanded, setPromptExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchAbBriefingData(video.id).then(result => {
      if (cancelled) return
      if (result.ok) {
        setBriefingData(result.data)
      } else {
        setError(result.error)
      }
      setLoading(false)
    }).catch(() => {
      if (cancelled) return
      setError('Falha ao carregar dados do vídeo')
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [video.id])

  useEffect(() => {
    if (!loading) textareaRef.current?.focus()
  }, [loading])

  const prompt = briefingData
    ? buildAbBriefingPrompt({ testType, data: briefingData, focus: focus || undefined })
    : ''

  const charCount = estimateChars(prompt)
  const encodedLength = prompt ? encodeURIComponent(prompt).length : 0

  const handleCopy = useCallback(async () => {
    if (!prompt) return
    if (/pk_[a-zA-Z0-9]{20,}/.test(prompt)) {
      toast.error('Pipeline key detectada no prompt — remova antes de copiar.')
      return
    }
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      onBriefingCopied()
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 2000)
      toast.success('Prompt copiado!')
    } catch {
      toast.error('Falha ao copiar')
    }
  }, [prompt, onBriefingCopied])

  const handleOpenClaude = useCallback(() => {
    if (!prompt || encodedLength > 8000) return
    const url = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`
    const win = window.open(url, '_blank', 'noreferrer')
    if (!win) {
      toast.warning('Popup bloqueado — copie e cole manualmente')
    }
  }, [prompt, encodedLength])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleCopy()
    }
  }, [handleCopy])

  const videoHasNoData = briefingData &&
    briefingData.video.ctr === null &&
    briefingData.video.score === null

  const completedTests = briefingData?.testHistory ?? []
  const avgLift = completedTests.length > 0
    ? completedTests.reduce((sum, t) => sum + (t.ctr_lift_percent ?? 0), 0) / completedTests.length
    : 0

  return (
    <div className="space-y-4">
      {/* Icon + title */}
      <div className="flex flex-col items-center gap-2 text-center">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${TYPE_GRADIENT[testType]} flex items-center justify-center`}>
          <Lightbulb className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-cms-text">Brainstorm com IA</h3>
          <p className="text-xs text-cms-text-dim mt-0.5" role="status" aria-live="polite">
            {briefingCopied
              ? 'Prompt copiado! Discuta com o Claude e anote por slot.'
              : 'Gere ideias com IA antes de criar as variantes'}
          </p>
        </div>
      </div>

      {/* Cross-test insights bar */}
      {completedTests.length > 0 && (
        <div className="rounded-[var(--cms-radius)] bg-indigo-500/10 border border-indigo-500/20 px-3 py-2">
          <p className="text-xs text-indigo-300">
            Em {completedTests.length} teste{completedTests.length > 1 ? 's' : ''} anterior{completedTests.length > 1 ? 'es' : ''},
            {avgLift > 0 ? ` lift médio de +${avgLift.toFixed(1)}% CTR` : ' dados de lift insuficientes'}
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4 animate-pulse">
            <div className="h-4 bg-cms-surface-hover rounded w-3/4 mb-2" />
            <div className="h-3 bg-cms-surface-hover rounded w-1/2" />
          </div>
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4 animate-pulse">
            <div className="h-20 bg-cms-surface-hover rounded" />
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-[var(--cms-radius)] border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-xs text-red-400">{error}</p>
          <button
            onClick={() => {
              setLoading(true)
              setError(null)
              fetchAbBriefingData(video.id).then(result => {
                if (result.ok) setBriefingData(result.data)
                else setError(result.error)
                setLoading(false)
              }).catch(() => {
                setError('Falha ao carregar dados do vídeo')
                setLoading(false)
              })
            }}
            className="text-xs text-red-300 underline mt-1"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Ready state — asset preview + prompt + notes */}
      {briefingData && !loading && (
        <>
          {/* No-data warning */}
          {videoHasNoData && (
            <div className="rounded-[var(--cms-radius)] bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <p className="text-xs text-amber-300">Sem dados de performance — prompt gerado com contexto do canal apenas.</p>
            </div>
          )}

          {/* Asset preview */}
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-cms-text-muted uppercase tracking-wider">Vídeo atual</span>
              <DataFreshnessBadge snapshotAgeHours={briefingData.snapshotAgeHours} />
            </div>
            <div className="flex gap-3 items-center">
              <div className="w-24 h-[54px] rounded overflow-hidden bg-cms-surface-hover shrink-0">
                {video.thumbnailUrl ? (
                  <NextImage
                    src={video.thumbnailUrl}
                    alt="Thumbnail atual"
                    width={96}
                    height={54}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-cms-text-dim text-[10px]">
                    Sem thumb
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-cms-text font-medium truncate">{video.title}</p>
                <div className="flex gap-3 mt-1">
                  {briefingData.video.ctr !== null && (
                    <span className="text-[10px] text-cms-text-dim">CTR: {briefingData.video.ctr.toFixed(1)}%</span>
                  )}
                  {briefingData.video.grade && (
                    <span className="text-[10px] text-cms-text-dim">Grade: {briefingData.video.grade}</span>
                  )}
                  <span className="text-[10px] text-cms-text-dim">{estimateChars(video.title)} chars</span>
                </div>
              </div>
            </div>
          </div>

          {/* Custom instructions textarea */}
          <div className="space-y-2">
            <label htmlFor="ab-focus" className="text-xs font-medium text-cms-text">
              Instruções adicionais <span className="text-cms-text-dim font-normal">(opcional)</span>
            </label>
            <textarea
              id="ab-focus"
              ref={textareaRef}
              value={focus}
              onChange={e => onFocusChange(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Ex: Focar em cores quentes e expressões faciais"
              className="w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent resize-none"
            />
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_CHIPS[testType].map(chip => (
                <button
                  key={chip}
                  onClick={() => onFocusChange(focus ? `${focus}. ${chip}` : chip)}
                  className="text-[10px] rounded-full border border-cms-border px-2 py-0.5 text-cms-text-muted hover:border-cms-accent hover:text-cms-accent transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt card */}
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold tracking-wide bg-gradient-to-r ${TYPE_GRADIENT[testType]} text-white px-1.5 py-0.5 rounded uppercase`}>
                Prompt pronto
              </span>
              <span className="text-[10px] text-cms-text-dim">
                {charCount.toLocaleString('pt-BR')} caracteres
              </span>
            </div>

            <PromptPreview maxHeight={promptExpanded ? '24rem' : '6rem'}>
              {prompt}
            </PromptPreview>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setPromptExpanded(!promptExpanded)}
                className="flex items-center gap-1 text-[10px] text-cms-text-muted hover:text-cms-text transition-colors"
              >
                {promptExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {promptExpanded ? 'Recolher' : 'Ver prompt completo'}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 rounded-[var(--cms-radius)] px-3 py-1.5 text-xs font-medium transition-all ${
                    copied
                      ? 'bg-green-600 text-white'
                      : `bg-gradient-to-r ${TYPE_GRADIENT[testType]} text-white hover:opacity-90`
                  }`}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied
                    ? 'Copiado!'
                    : briefingCopied
                      ? 'Copiar novamente'
                      : `Copiar Prompt (${navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Enter)`}
                </button>
                <button
                  onClick={handleOpenClaude}
                  disabled={!prompt || encodedLength > 8000}
                  className="flex items-center gap-1 rounded-[var(--cms-radius)] border border-cms-border px-3 py-1.5 text-xs text-cms-text hover:bg-cms-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed group relative"
                >
                  <ExternalLink className="w-3 h-3" />
                  Abrir no Claude
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded text-[10px] bg-cms-surface-hover text-cms-text-dim border border-cms-border opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Abre claude.ai com o prompt — nenhum dado é salvo aqui
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Per-slot notes */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-cms-text">Anote suas ideias por slot</h4>
            {SLOT_LABELS.map((label, i) => (
              <div key={label} className="flex items-start gap-2">
                <span className="text-xs font-semibold text-cms-accent mt-2 w-4 shrink-0">{label}</span>
                <input
                  type="text"
                  value={slotNotes[i]}
                  onChange={e => onSlotNoteChange(i, e.target.value)}
                  placeholder={`Ideia para variante ${label}...`}
                  className="flex-1 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent"
                />
              </div>
            ))}
          </div>

          {/* Tips */}
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-semibold text-cms-text-muted uppercase tracking-wider">Dicas</h4>
            {TIPS[testType].map(tip => (
              <div key={tip} className="flex items-start gap-2">
                <span className="text-cms-accent text-xs mt-0.5">•</span>
                <span className="text-[10px] text-cms-text-dim leading-relaxed">{tip}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -30`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-ideias.tsx"
git commit -m "feat(ab-lab): add StepIdeias component for brainstorm step"
```

---

### Task 5: Wizard integration — 4→5 steps + state + StepIdeias + brainstorm hints

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard.tsx`

This task modifies the existing wizard to: (1) change from 4 to 5 steps, (2) add Ideias state lifted to the parent, (3) render StepIdeias at step 2, (4) shift existing steps forward by 1, (5) add brainstorm reference panel + per-slot hints to the Variantes step, (6) add sessionStorage persistence for brainstorm notes.

- [ ] **Step 1: Update STEP_LABELS and imports**

In `ab-create-wizard.tsx`, update the STEP_LABELS constant on line 56:

```typescript
const STEP_LABELS = ['Tipo', 'Ideias', 'Variantes', 'Config', 'Revisar'] as const
```

Add the StepIdeias import at the top alongside other imports:

```typescript
import { StepIdeias } from './step-ideias'
```

- [ ] **Step 2: Add Ideias state to the wizard**

Inside the `AbCreateWizard` function, after the existing state declarations (after line 89), add the new state:

```typescript
const [ideiasFocus, setIdeiasFocus] = useState('')
const [slotNotes, setSlotNotes] = useState<[string, string, string]>(['', '', ''])
const [briefingCopied, setBriefingCopied] = useState(false)
```

- [ ] **Step 3: Add sessionStorage persistence**

After the new state declarations, add sessionStorage load/save:

```typescript
const storageKey = `ab-brainstorm-${video.id}`

useEffect(() => {
  try {
    const saved = sessionStorage.getItem(storageKey)
    if (saved) {
      const parsed = JSON.parse(saved) as { focus?: string; slotNotes?: [string, string, string] }
      if (parsed.focus) setIdeiasFocus(parsed.focus)
      if (parsed.slotNotes) setSlotNotes(parsed.slotNotes)
    }
  } catch { /* ignore corrupt data */ }
}, [storageKey])

const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

useEffect(() => {
  if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  saveTimerRef.current = setTimeout(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ focus: ideiasFocus, slotNotes }))
    } catch { /* storage full — ignore */ }
  }, 500)
  return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
}, [ideiasFocus, slotNotes, storageKey])
```

Add `useRef` to the React imports if not already present (it's not currently imported).

- [ ] **Step 4: Update step numbering**

Update the initial step state to account for prefill landing on step 2 (Ideias) instead of step 2 (Variantes):

```typescript
const [step, setStep] = useState(prefill?.testType ? 2 : 1)
```

This stays the same — prefill skips Tipo and lands on Ideias.

Update `handleTypeSelect` on line 234-237 to advance to step 2 (Ideias):

```typescript
function handleTypeSelect(type: TestType) {
  setTestType(type)
  setStep(2)
}
```

This also stays the same — step 2 is now Ideias.

- [ ] **Step 5: Update the body step rendering**

Replace the body section (lines 304-340) to add step 2 (Ideias) and shift other steps:

```typescript
{/* Body */}
<div className="flex-1 overflow-y-auto px-5 py-4">
  {step === 1 && (
    <Step0TypeSelect onSelect={handleTypeSelect} />
  )}
  {step === 2 && (
    <StepIdeias
      testType={testType}
      video={video}
      siteId={siteId}
      focus={ideiasFocus}
      onFocusChange={setIdeiasFocus}
      slotNotes={slotNotes}
      onSlotNoteChange={(index, value) => {
        setSlotNotes(prev => {
          const next = [...prev] as [string, string, string]
          next[index] = value
          return next
        })
      }}
      briefingCopied={briefingCopied}
      onBriefingCopied={() => setBriefingCopied(true)}
    />
  )}
  {step === 3 && (
    <Step1Variants
      testType={testType}
      video={video}
      slots={slots}
      slotError={slotError}
      textVariants={textVariants}
      onFileChange={handleFileChange}
      onTextChange={(i, field, value) => {
        setTextVariants(prev => {
          const next = [...prev]
          const current = next[i] ?? { title: '', description: '' }
          next[i] = { ...current, [field]: value }
          return next
        })
      }}
      onPipelinePull={handlePipelinePull}
      isPipelinePending={isPipelinePending}
      slotNotes={slotNotes}
    />
  )}
  {step === 4 && (
    <Step2Configure config={config} onChange={setConfig} />
  )}
  {step === 5 && (
    <Step3Review
      video={video}
      testType={testType}
      slots={slots}
      textVariants={textVariants}
      config={config}
    />
  )}
</div>
```

- [ ] **Step 6: Update footer navigation**

Replace the footer section (lines 343-387) to match the new 5-step numbering:

```typescript
{/* Footer */}
<div className="flex items-center justify-between px-5 py-4 border-t border-cms-border shrink-0">
  <div>
    {step === 2 && (
      <span className="text-[10px] text-cms-text-dim">Pode pular se já sabe o que testar</span>
    )}
    {submitError && (
      <p className="text-xs text-red-400">{submitError}</p>
    )}
  </div>
  <div className="flex items-center gap-2">
    {step > 1 && (
      <button
        onClick={() => setStep(s => s - 1)}
        disabled={isPending}
        className="border border-cms-border text-cms-text rounded-[var(--cms-radius)] px-4 py-2 text-sm hover:bg-cms-surface-hover transition-colors disabled:opacity-40"
      >
        Voltar
      </button>
    )}
    {step >= 2 && step < 5 && (
      <button
        onClick={() => setStep(s => s + 1)}
        disabled={step === 3 && !hasVariantForType}
        className="bg-cms-accent text-white rounded-[var(--cms-radius)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Próximo
      </button>
    )}
    {step === 5 && (
      <>
        <button
          onClick={() => handleSubmit(false)}
          disabled={isPending}
          className="border border-cms-border text-cms-text rounded-[var(--cms-radius)] px-4 py-2 text-sm hover:bg-cms-surface-hover transition-colors disabled:opacity-40"
        >
          {isPending ? 'Salvando…' : 'Salvar Rascunho'}
        </button>
        <button
          onClick={() => handleSubmit(true)}
          disabled={isPending}
          className="bg-cms-accent text-white rounded-[var(--cms-radius)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {isPending ? 'Lançando…' : 'Lançar Teste'}
        </button>
      </>
    )}
  </div>
</div>
```

Note: the "Próximo" button at step 2 (Ideias) is always enabled — the step is advisory, never blocking. At step 3 (Variantes) it remains gated by `hasVariantForType`.

- [ ] **Step 7: Add brainstorm hints to Step1Variants**

Update the `Step1Props` interface (around line 432) to accept `slotNotes`:

```typescript
interface Step1Props {
  testType: TestType
  video: WizardVideo
  slots: (SlotFile | null)[]
  slotError: string | null
  textVariants: TextVariant[]
  onFileChange: (index: number, file: File | null) => void
  onTextChange: (index: number, field: 'title' | 'description', value: string) => void
  onPipelinePull: () => void
  isPipelinePending: boolean
  slotNotes: [string, string, string]
}
```

Update the `Step1Variants` function signature to destructure `slotNotes`:

```typescript
function Step1Variants({ testType, video, slots, slotError, textVariants, onFileChange, onTextChange, onPipelinePull, isPipelinePending, slotNotes }: Step1Props) {
```

At the top of Step1Variants' return, before the existing content, add the brainstorm reference panel:

```typescript
return (
  <div className="space-y-4">
    {/* Brainstorm reference panel */}
    {slotNotes.some(n => n.trim()) && (
      <BrainstormReferencePanel slotNotes={slotNotes} />
    )}

    {/* Existing content... */}
```

- [ ] **Step 8: Add BrainstormReferencePanel component**

After the `Step1Variants` function, add:

```typescript
function BrainstormReferencePanel({ slotNotes }: { slotNotes: [string, string, string] }) {
  const [expanded, setExpanded] = useState(true)
  const LABELS = ['B', 'C', 'D'] as const

  return (
    <div className="rounded-[var(--cms-radius)] border border-indigo-500/20 bg-indigo-500/5 p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="text-xs font-medium text-indigo-300 flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5" />
          Suas ideias do brainstorm
        </span>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-indigo-400" />
          : <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1">
          {LABELS.map((label, i) => (
            <div key={label} className="flex items-start gap-2">
              <span className="text-[10px] font-semibold text-indigo-400 mt-0.5 w-3 shrink-0">{label}:</span>
              <span className="text-[10px] text-cms-text-dim leading-relaxed">
                {slotNotes[i].trim() || '(sem anotação)'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

Add the missing imports at the top of the file:

```typescript
import { Lightbulb, ChevronUp, ChevronDown } from 'lucide-react'
```

- [ ] **Step 9: Add per-slot hints to ThumbnailUploadSection, TitleEditorSection, DescriptionEditorSection**

Each of the 3 editor sections needs to accept `slotNotes` as a prop and show the corresponding brainstorm note above each slot's upload/input area.

**ThumbnailUploadSection** — update its props type (around line 482-491):

Add `slotNotes?: [string, string, string]` to the destructured props.

Inside the `[0, 1, 2].map(i => (...))` block (line 523), before the `<VariantSlot>` component, add:

```typescript
{slotNotes?.[i]?.trim() && (
  <div className="col-span-1">
    <p className="text-[10px] text-indigo-300 mb-1 flex items-start gap-1">
      <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" />
      {slotNotes[i]}
    </p>
  </div>
)}
```

Wait — the grid structure makes this complex. A simpler approach: wrap each VariantSlot in a div that includes the hint. Update the `[0, 1, 2].map()` block:

```typescript
{[0, 1, 2].map(i => (
  <div key={i} className="space-y-1">
    {slotNotes?.[i]?.trim() && (
      <p className="text-[10px] text-indigo-300 flex items-start gap-1">
        <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" />
        {slotNotes[i]}
      </p>
    )}
    <VariantSlot
      label={String.fromCharCode(66 + i)}
      slot={slots[i] ?? null}
      onChange={file => onFileChange(i, file)}
    />
  </div>
))}
```

**TitleEditorSection** — add `slotNotes?: [string, string, string]` to its props.

In the editable slots `[0, 1, 2].map()` section, add before the `<input>`:

```typescript
{slotNotes?.[i]?.trim() && (
  <p className="text-[10px] text-indigo-300 flex items-start gap-1">
    <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" />
    {slotNotes[i]}
  </p>
)}
```

**DescriptionEditorSection** — add `slotNotes?: [string, string, string]` to its props.

Same pattern — add the hint before the `<textarea>`.

Pass `slotNotes` from `Step1Variants` to all three sub-components:

```typescript
<ThumbnailUploadSection
  video={video}
  slots={slots}
  slotError={slotError}
  onFileChange={onFileChange}
  onPipelinePull={onPipelinePull}
  isPipelinePending={isPipelinePending}
  slotNotes={slotNotes}
/>
```

```typescript
<TitleEditorSection
  textVariants={textVariants}
  onTextChange={onTextChange}
  slotNotes={slotNotes}
/>
```

```typescript
<DescriptionEditorSection
  textVariants={textVariants}
  onTextChange={onTextChange}
  slotNotes={slotNotes}
/>
```

- [ ] **Step 10: Add the step dot green ring for briefingCopied**

In the step indicator section (around line 267-301), update the step dot styling to show a green ring when the Ideias step has been copied:

Update the step dot class logic for step 2 (index 1):

```typescript
<div
  className={[
    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
    isCompleted
      ? 'bg-green-600 text-white'
      : isActive
        ? 'bg-cms-accent text-white'
        : 'bg-cms-surface-hover text-cms-text-muted',
    stepNum === 2 && briefingCopied && !isCompleted && !isActive
      ? 'ring-2 ring-green-500/50'
      : '',
  ].join(' ')}
>
```

- [ ] **Step 11: Clear sessionStorage on wizard close / test creation**

In the `onCreated` callback path inside `handleSubmit` (line 230), add cleanup:

```typescript
try { sessionStorage.removeItem(storageKey) } catch { /* ignore */ }
onCreated(testId)
```

Also update the `onClose` handler — wrap the existing `onClose` prop call in the Escape handler, but actually this is already handled by the parent. Instead, in the backdrop click `onClick={onClose}` and in the close button, the parent handles cleanup. The sessionStorage only needs to be cleaned on successful test creation, not on close (so that re-opening preserves notes).

- [ ] **Step 12: Verify typecheck passes**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -30`
Expected: No new errors.

- [ ] **Step 13: Run existing tests**

Run: `npm run test:web 2>&1 | tail -20`
Expected: All tests pass. No regressions.

- [ ] **Step 14: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard.tsx"
git commit -m "feat(ab-lab): integrate StepIdeias into wizard (4→5 steps) with brainstorm hints"
```

---

### Task 6: Build verification + full test suite

**Files:**
- All modified/created files from Tasks 1-5

This task verifies everything compiles and all tests pass, including the new prompt builder tests and the existing test suite.

- [ ] **Step 1: Run full test suite**

Run: `npm run test:web 2>&1 | tail -30`
Expected: All tests pass, including the new `prompt-builders-ab.test.ts`.

- [ ] **Step 2: Run build to verify Next.js compilation**

Run: `npm run build:packages && npx next build --project apps/web 2>&1 | tail -30`
Expected: Build succeeds.

- [ ] **Step 3: Fix any issues found**

If any tests fail or build errors occur, fix them and commit the fixes.
