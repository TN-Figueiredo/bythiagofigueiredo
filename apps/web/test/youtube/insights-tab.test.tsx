import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { CompetitorInsights, CadenceChannel } from '@/lib/youtube/observatory-types'

/* ── Mocks (hoisted so vi.mock factories can reference them) ── */

const { mockPush, mockToast, mockCreatePipelineItem } = vi.hoisted(() => {
  const mockPush = vi.fn()
  const mockToast = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  })
  const mockCreatePipelineItem = vi.fn()
  return { mockPush, mockToast, mockCreatePipelineItem }
})

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
vi.mock('sonner', () => ({ toast: mockToast }))
vi.mock('@/app/cms/(authed)/pipeline/actions', () => ({
  createPipelineItem: (...args: unknown[]) => mockCreatePipelineItem(...args),
}))

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  )
  return {
    Zap: icon('Zap'),
    Activity: icon('Activity'),
    Calendar: icon('Calendar'),
    BarChart3: icon('BarChart3'),
    Target: icon('Target'),
    Sparkles: icon('Sparkles'),
    ArrowRight: icon('ArrowRight'),
    Plus: icon('Plus'),
    FlaskConical: icon('FlaskConical'),
    Check: icon('Check'),
  }
})

/* ── Import component under test ── */
import { InsightsTab } from '@/app/cms/(authed)/youtube/competitors/_components/insights-tab'

/* ── Source code for static analysis ── */
const src = readFileSync(
  resolve(__dirname, '../../src/app/cms/(authed)/youtube/competitors/_components/insights-tab.tsx'),
  'utf-8',
)

/* ── Helpers ── */

function makeMinimalInsights(overrides?: Partial<CompetitorInsights>): CompetitorInsights {
  return {
    heatmap: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
    hitsHeatmap: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
    tags: [{ tag: 'react', count: 10, avgViews: 5000 }],
    engagement: [{ channelName: 'Canal A', channelThumbnailUrl: null, engagementRate: 0.05, isUs: false }],
    gaps: [],
    cadence: [],
    formulas: [],
    play: null,
    ownTagsByChannel: [],
    competitorTagsByChannel: [],
    ...overrides,
  }
}

/** Build a CadenceChannel with N videos on specific day/hour combos. */
function makeCadenceVideos(
  entries: Array<{ day: number; hour: number; views: number }>,
): CadenceChannel {
  const videos = entries.map(({ day, hour, views }) => {
    // day: 0=Mon..6=Sun. JS Date getDay(): 0=Sun..6=Sat → reverse the (d.getDay()+6)%7 mapping
    // targetDayIdx = (jsDay + 6) % 7 → jsDay = (targetDayIdx + 1) % 7
    const jsDay = (day + 1) % 7
    // Pick a date that falls on that JS day. 2026-01-05 is a Monday (jsDay=1).
    const baseDate = new Date('2026-01-05T00:00:00')
    const baseDayOfWeek = baseDate.getDay() // 1 = Monday
    const daysToAdd = ((jsDay - baseDayOfWeek) % 7 + 7) % 7
    const d = new Date(baseDate)
    d.setDate(d.getDate() + daysToAdd)
    d.setHours(hour, 0, 0, 0)
    return { title: `Video ${day}-${hour}`, viewCount: views, publishedAt: d.toISOString() }
  })

  return {
    channelName: 'Test Channel',
    channelId: 'UC_test',
    color: '#E8823C',
    freq: 3.5,
    window: '90d',
    videos,
    lastUploadDays: 1,
  }
}

/* ── 1. computeCadenceInsight (pure function logic via source analysis + rendered output) ── */

describe('computeCadenceInsight', () => {
  it('returns null with fewer than 10 videos', () => {
    // With only 5 videos, the insight should fall back to the "insufficient data" text
    const fewVideos = makeCadenceVideos([
      { day: 0, hour: 10, views: 1000 },
      { day: 1, hour: 14, views: 2000 },
      { day: 2, hour: 16, views: 3000 },
      { day: 3, hour: 18, views: 4000 },
      { day: 4, hour: 20, views: 5000 },
    ])
    const insights = makeMinimalInsights({ cadence: [fewVideos] })
    const { container } = render(<InsightsTab insights={insights} />)

    // Should show the fallback message, not a "Pico" insight
    const noteText = container.querySelector('.insight-note')?.textContent ?? ''
    expect(noteText).toContain('Dados insuficientes')
    expect(noteText).not.toContain('Pico de volume')
  })

  it('returns dynamic peak volume and hits slots', () => {
    // 12 videos: cluster on Monday 10h (high volume, lower views)
    // and a hit cluster on Thursday 18h (high views, lower volume)
    const entries = [
      // Volume cluster: Monday 10h (6 videos, low views)
      ...Array.from({ length: 6 }, () => ({ day: 0, hour: 10, views: 100 })),
      // Hits cluster: Thursday 18h (4 videos, high views — top quartile)
      ...Array.from({ length: 4 }, () => ({ day: 3, hour: 18, views: 10000 })),
      // Filler to reach 12
      { day: 5, hour: 8, views: 50 },
      { day: 6, hour: 20, views: 50 },
    ]
    const cadence = makeCadenceVideos(entries)
    const insights = makeMinimalInsights({ cadence: [cadence] })
    const { container } = render(<InsightsTab insights={insights} />)

    const noteText = container.querySelector('.insight-note')?.textContent ?? ''
    // Should contain the volume peak info
    expect(noteText).toContain('Pico de volume')
    // Should reference a specific day/hour slot
    expect(noteText).toMatch(/\d+h–\d+h/)
  })

  it('volume peak and hits peak can differ', () => {
    // Construct data where volume peak differs from hits peak.
    // computeCadenceInsight uses top quartile (75th percentile) as hits threshold.
    // With 12 videos sorted by views, threshold = sortedViews[floor(12*0.75)] = sortedViews[9].
    // We need: volume peak on one day/hour, hits (top quartile) peak on a DIFFERENT day
    // with peakHitsDay !== peakVolDay so the divergence branch triggers.
    const entries = [
      // Volume cluster: Monday 8h — 7 videos with views=10 (low, below threshold)
      ...Array.from({ length: 7 }, () => ({ day: 0, hour: 8, views: 10 })),
      // Scattered low-view filler (views=10) to pad count
      { day: 1, hour: 12, views: 10 },
      { day: 2, hour: 6, views: 10 },
      // Hits cluster: Friday 20h — 3 videos with views=100000 (well above threshold)
      // These are indices 9,10,11 in sorted array → all >= threshold
      ...Array.from({ length: 3 }, () => ({ day: 4, hour: 20, views: 100000 })),
    ]
    // Total: 12 videos. Sorted views: [10,10,10,10,10,10,10,10,10,100000,100000,100000]
    // Threshold at index 9 = 100000. Only the 3 Friday videos qualify as hits.
    // Volume peak: Monday 8h (7 uploads). Hits peak: Friday 20h (3 hits).
    // Days differ (0 vs 4) → divergence message should appear.
    const cadence = makeCadenceVideos(entries)
    const insights = makeMinimalInsights({ cadence: [cadence] })
    const { container } = render(<InsightsTab insights={insights} />)

    const noteText = container.querySelector('.insight-note')?.textContent ?? ''
    expect(noteText).toContain('Pico de volume')
    expect(noteText).toContain('hits')
    expect(noteText).toContain('janela quase vazia')
  })
})

/* ── 2. GapsCard pipeline integration ── */

describe('GapsCard pipeline integration', () => {
  function makeGapInsights(): CompetitorInsights {
    return makeMinimalInsights({
      gaps: [
        { topic: 'nextjs', competitorCount: 3, avgViews: 8000, weCover: false, channelNames: ['A'] },
        { topic: 'typescript', competitorCount: 2, avgViews: 5000, weCover: true, channelNames: ['B'] },
        { topic: 'tailwind', competitorCount: 4, avgViews: 12000, weCover: false, channelNames: ['C'] },
      ],
      competitorTagsByChannel: [
        { channelName: 'Competitor Alpha', tags: ['nextjs', 'typescript', 'tailwind'] },
      ],
      ownTagsByChannel: [
        { channelName: 'Meu Canal', tags: ['typescript'] },
      ],
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls createPipelineItem on gap chip click', async () => {
    mockCreatePipelineItem.mockResolvedValue({ ok: true })
    render(<InsightsTab insights={makeGapInsights()} />)

    // Gap chips have the "gap" class and Plus icon — find button with topic text
    const gapButtons = screen.getAllByRole('button').filter(
      btn => btn.classList.contains('gap-chip') && btn.classList.contains('gap'),
    )
    expect(gapButtons.length).toBeGreaterThan(0)

    // Click the first gap chip (should be "nextjs")
    fireEvent.click(gapButtons[0]!)

    await waitFor(() => {
      expect(mockCreatePipelineItem).toHaveBeenCalledTimes(1)
      expect(mockCreatePipelineItem).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'video',
          title_pt: expect.any(String),
          tags: ['search-term'],
        }),
      )
    })
  })

  it('shows check icon for already-added topics', async () => {
    mockCreatePipelineItem.mockResolvedValue({ ok: true })
    render(<InsightsTab insights={makeGapInsights()} />)

    const gapButtons = screen.getAllByRole('button').filter(
      btn => btn.classList.contains('gap-chip') && btn.classList.contains('gap'),
    )

    // Click to add
    fireEvent.click(gapButtons[0]!)

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        expect.stringContaining('adicionada ao pipeline'),
        expect.any(Object),
      )
    })

    // After success, the Check icon should appear (replaces Plus)
    await waitFor(() => {
      const updatedBtn = screen.getAllByRole('button').filter(
        btn => btn.classList.contains('gap-chip') && btn.classList.contains('gap'),
      )[0]!
      expect(updatedBtn.querySelector('[data-testid="icon-Check"]')).toBeTruthy()
    })
  })

  it('shows error toast on pipeline failure', async () => {
    mockCreatePipelineItem.mockResolvedValue({ ok: false, error: 'DB connection failed' })
    render(<InsightsTab insights={makeGapInsights()} />)

    const gapButtons = screen.getAllByRole('button').filter(
      btn => btn.classList.contains('gap-chip') && btn.classList.contains('gap'),
    )

    fireEvent.click(gapButtons[0]!)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('DB connection failed')
    })
  })
})

/* ── 3. Honest UI — disabled buttons and no fake toasts ── */

describe('InsightsTab honest UI', () => {
  function makeInsightsWithPlay(): CompetitorInsights {
    return makeMinimalInsights({
      play: {
        topicBold: 'React Server Components',
        formulaBold: 'Como X em Y',
        formulaMult: 2.3,
        windowBold: 'Terça 18h',
        windowReason: 'janela vazia entre concorrentes',
      },
      gaps: [
        { topic: 'remix', competitorCount: 2, avgViews: 6000, weCover: false, channelNames: ['X'] },
      ],
      competitorTagsByChannel: [
        { channelName: 'Rival', tags: ['remix'] },
      ],
    })
  }

  it('PlayCard "Montar roteiro" button is disabled', () => {
    render(<InsightsTab insights={makeInsightsWithPlay()} />)

    const montarBtn = screen.getByRole('button', { name: /montar roteiro/i })
    expect(montarBtn).toBeTruthy()
    expect(montarBtn.hasAttribute('disabled')).toBe(true)
    expect(montarBtn.style.opacity).toBe('0.5')
    expect(montarBtn.style.cursor).toBe('not-allowed')
  })

  it('"Roteirizar lacunas no Cowork" button is disabled', () => {
    render(<InsightsTab insights={makeInsightsWithPlay()} />)

    const roteirizarBtn = screen.getByRole('button', { name: /roteirizar/i })
    expect(roteirizarBtn).toBeTruthy()
    expect(roteirizarBtn.hasAttribute('disabled')).toBe(true)
    expect(roteirizarBtn.style.opacity).toBe('0.5')
    expect(roteirizarBtn.style.cursor).toBe('not-allowed')
  })

  it('no toast containing "em breve" exists in the component', () => {
    // Static analysis: ensure no fake "coming soon" toasts leaked into source
    expect(src).not.toContain("toast('Roteiro em breve")
    expect(src).not.toContain("toast('Cowork integration em breve")
    expect(src).not.toContain("toast('Em breve")
    expect(src).not.toContain('toast("Roteiro em breve')
    expect(src).not.toContain('toast("Em breve')
  })
})

/* ── 4. Static analysis — source code correctness ── */

describe('insights-tab source honesty', () => {
  it('no fake "em breve" toasts remain', () => {
    expect(src).not.toContain("toast('Roteiro em breve")
    expect(src).not.toContain("toast('Cowork integration em breve")
    expect(src).not.toContain("toast('Em breve")
  })

  it('handleGapClick uses createPipelineItem not fake toast', () => {
    expect(src).toContain('createPipelineItem')
    // Ensure the old pattern of fake success toast without real action is gone
    // The real code calls createPipelineItem THEN shows toast on result
    expect(src).not.toMatch(/toast\.success\([^)]*adicionada[^)]*\)\s*\n\s*}\s*\n\s*}/)
  })

  it('disabled buttons use disabled attribute not onClick toast', () => {
    // "Montar roteiro" CTA: `disabled` appears before the text in JSX
    expect(src).toMatch(/disabled[\s\S]*?Montar roteiro/)
    // "Roteirizar" CTA: `disabled` also appears before the text
    expect(src).toMatch(/disabled[\s\S]*?Roteirizar/)
  })

  it('imports createPipelineItem from pipeline actions', () => {
    expect(src).toContain("from '@/app/cms/(authed)/pipeline/actions'")
  })
})
