// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { VideoGradeRow } from '@/app/cms/(authed)/youtube/analytics/_components/types'
import type { Axis } from '@/lib/youtube/scoring-types'
import intelFixture from '../fixtures/intel-cowork-2026-05-18.json'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// The Busca tab imports createPipelineItem from a 'use server' module that pulls in
// getSupabaseServiceClient/getSiteContext/requireSiteScope/next/cache — same reason as
// test/youtube/yt-search-terms.test.tsx:17.
vi.mock('@/app/cms/(authed)/pipeline/actions', () => ({ createPipelineItem: vi.fn() }))

import { YtAnalyticsTabs, computeCoachingCards } from '@/app/cms/(authed)/youtube/analytics/_components/yt-analytics-tabs'

const AXES: Axis[] = ['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']

/** One video whose six axes are all 0 — every axis is below COACHING_BENCHMARK (6.5),
 *  so the heuristic fallback yields exactly 3 cards when there is no coaching row. */
function videoWithAllAxesAt(normalized: number): VideoGradeRow {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    videoId: 'yt1',
    title: 'Video',
    thumbnailUrl: null,
    publishedAt: '2024-12-10T15:57:00Z',
    views: 0,
    grade: 'D',
    score: 0,
    avgViewPercentage: 0,
    trafficSources: null,
    axes: AXES.map(axis => ({ axis, normalized, raw: 0 })),
  } as unknown as VideoGradeRow
}

const BASE = {
  metrics: { views: 0, subscribers: 0, watchTimeMinutes: 0, videos: 1 },
  dailyMetrics: [],
  grades: [],
  searchTerms: [],
  demographics: { ageGender: [], countries: [], devices: [] },
  intelligenceVideos: [videoWithAllAxesAt(0)],
  healthScore: 40,
  channelInternalId: 'ch-1',
} as never

/** The real 500-character May summary, read from the Task 5 fixture rather than retyped. */
const MAY_SUMMARY: string = intelFixture.coaching.summary
const MAY_COACHING = {
  summary: MAY_SUMMARY,
  priorities: AXES.slice(0, 6).map((axis, i) => ({ axis, score: i, diagnosis: `d${i}`, action: `a${i}` })),
}

async function openCoach() {
  await userEvent.click(screen.getByRole('tab', { name: /Health Coach/ }))
}

describe('Health Coach — source badge and summary line', () => {
  it('A: Cowork row renders the badge, the summary line, 3 cards and badge 3', async () => {
    render(<YtAnalyticsTabs {...BASE} channelCoaching={{ coaching: MAY_COACHING, source: 'cowork', generatedLabel: '18/05' }} />)
    const coachTab = screen.getByRole('tab', { name: /Health Coach/ })
    expect(within(coachTab).getByText('3')).toBeTruthy()

    await openCoach()
    expect(screen.getByText('Diagnostico · por Cowork · 18/05')).toBeTruthy()
    expect(screen.getByText(MAY_SUMMARY)).toBeTruthy()
    expect(screen.queryByText(/O canal esta em/)).toBeNull()
    expect(screen.queryByText(/Baseado em regras fixas/)).toBeNull()
  })

  it('B: forja row renders the badge and summary, and suppresses cards, Potencial and the healthy card', async () => {
    const summary = 'Sem CTR/retenção nesta fase; base: views e séries. O canal nao publica desde 10/12/2024.'
    render(<YtAnalyticsTabs {...BASE} channelCoaching={{ coaching: { summary, priorities: [] }, source: 'forja', generatedLabel: '19/09' }} />)
    const coachTab = screen.getByRole('tab', { name: /Health Coach/ })
    expect(within(coachTab).queryByText('3')).toBeNull()

    await openCoach()
    expect(screen.getByText('Diagnostico · por forja · 19/09')).toBeTruthy()
    expect(screen.getByText(summary)).toBeTruthy()
    expect(screen.queryByText('Canal saudavel em todos os eixos')).toBeNull()
    expect(screen.queryByText(/Baseado em regras fixas/)).toBeNull()
    expect(screen.queryByText('Potencial')).toBeNull()
    expect(screen.queryByText(/pts/)).toBeNull()
  })

  it('B with zero synced videos: still state B, never "Nenhuma analise de inteligencia disponivel ainda."', async () => {
    // videoCount is wired from intelligenceVideos.length (youtube_videos), while the analysis
    // comes from youtube_intelligence — the two are independent, so a real forja row can land
    // on a channel with no synced video. The empty state would then assert something false.
    const summary = 'Analise real da forja, sem video sincronizado.'
    render(
      <YtAnalyticsTabs
        {...BASE}
        intelligenceVideos={[] as never}
        channelCoaching={{ coaching: { summary, priorities: [] }, source: 'forja', generatedLabel: '19/09' }}
      />,
    )
    await openCoach()
    expect(screen.queryByText('Nenhuma analise de inteligencia disponivel ainda.')).toBeNull()
    expect(screen.getByText('Diagnostico · por forja · 19/09')).toBeTruthy()
    expect(screen.getByText(summary)).toBeTruthy()
  })

  it('C: no row falls back to the heuristic label, 3 cards and badge 3', async () => {
    render(<YtAnalyticsTabs {...BASE} channelCoaching={null} />)
    const coachTab = screen.getByRole('tab', { name: /Health Coach/ })
    expect(within(coachTab).getByText('3')).toBeTruthy()

    await openCoach()
    expect(screen.getByText('Diagnostico heuristico')).toBeTruthy()
    expect(screen.getByText(/Baseado em regras fixas/)).toBeTruthy()
  })

  it.each([
    ['an empty summary', { summary: '', priorities: MAY_COACHING.priorities }],
    ['no summary key at all', { priorities: MAY_COACHING.priorities }],
  ])('renders label and cards without an empty line and without throwing, for %s', async (_label, coaching) => {
    const { container } = render(
      <YtAnalyticsTabs {...BASE} channelCoaching={{ coaching: coaching as never, source: 'cowork', generatedLabel: '18/05' }} />,
    )
    await openCoach()
    expect(screen.getByText('Diagnostico · por Cowork · 18/05')).toBeTruthy()
    expect(screen.queryByText(/O canal esta em/)).toBeNull()

    // No blank <p> in the summary banner: an empty summary must render nothing at all,
    // not an empty paragraph that still takes vertical space under the label.
    const banner = container.querySelector('.coach-summary')
    expect(banner).not.toBeNull()
    const blankParagraphs = Array.from(banner!.querySelectorAll('p'))
      .filter(p => (p.textContent ?? '').trim() === '')
    expect(blankParagraphs).toHaveLength(0)
  })

  it.each([
    ['A', { coaching: MAY_COACHING, source: 'cowork' as const, generatedLabel: '18/05' }],
    ['B', { coaching: { summary: 's', priorities: [] }, source: 'forja' as const, generatedLabel: '19/09' }],
    ['C', null],
  ])('%s: the header button reads "Pedir diagnostico", never "ao Cowork"', (_label, channelCoaching) => {
    render(<YtAnalyticsTabs {...BASE} channelCoaching={channelCoaching as never} onRequestAnalysis={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Pedir diagnostico' })).toBeTruthy()
    expect(screen.queryByText(/ao Cowork/)).toBeNull()
  })
})

/** A video scored on exactly the axes given — an axis absent from `axes` is an axis with
 *  no sample, which `VideoGradeRow.axes` (Array<{axis, normalized: number}>) expresses by
 *  omission, since `normalized` itself is non-nullable. */
function videoWithAxes(entries: Array<{ axis: Axis; normalized: number }>): VideoGradeRow {
  return { ...videoWithAllAxesAt(0), axes: entries } as unknown as VideoGradeRow
}

describe('computeCoachingCards — heuristic branch never invents a card without a sample', () => {
  it('a genuine 0 on an axis still produces a card (the zero IS data)', () => {
    const cards = computeCoachingCards([videoWithAllAxesAt(0)], null)
    expect(cards).toHaveLength(3)
    expect(cards.every(c => c.score === 0)).toBe(true)
    expect(cards.every(c => c.source === 'fallback')).toBe(true)
  })

  it('a channel with zero videos produces no card at all', () => {
    // The live bug: [] scored 0 on all six axes, all six passed the < 6.5 filter, and the
    // tab badge said 3 while the panel below said "Nenhuma analise ... disponivel ainda".
    expect(computeCoachingCards([], null)).toEqual([])
  })

  it('an axis no video carries produces no card, even when other axes do', () => {
    const cards = computeCoachingCards([videoWithAxes([{ axis: 'ctr', normalized: 0 }])], null)
    expect(cards.map(c => c.axis)).toEqual(['ctr'])
  })

  it('an axis averages over the videos that carry it, not over the whole channel', () => {
    // ctr: one video at 90 (9.0 — healthy, no card). The second video has no ctr sample and
    // must not drag it to (90+0)/2 = 45 → 4.5, which would invent a "CTR abaixo" card.
    const cards = computeCoachingCards(
      [
        videoWithAxes([{ axis: 'ctr', normalized: 90 }]),
        videoWithAxes([{ axis: 'retention', normalized: 10 }]),
      ],
      null,
    )
    expect(cards.map(c => c.axis)).toEqual(['retention'])
    expect(cards[0].score).toBe(1)
  })
})

describe('Health Coach — badge agrees with the panel on an empty channel', () => {
  it('zero videos and no coaching row: no badge, and the panel states the emptiness', async () => {
    render(<YtAnalyticsTabs {...BASE} intelligenceVideos={[] as never} channelCoaching={null} />)
    const coachTab = screen.getByRole('tab', { name: /Health Coach/ })
    expect(within(coachTab).queryByText('3')).toBeNull()

    await openCoach()
    expect(screen.getByText('Nenhuma analise de inteligencia disponivel ainda.')).toBeTruthy()
  })
})
