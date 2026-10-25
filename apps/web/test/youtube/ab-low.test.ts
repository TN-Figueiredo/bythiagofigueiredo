/**
 * AB Lab — low-priority + integration tests
 *
 * Covers visual token consistency, component accessibility,
 * mock data integrity, dashboard stats edge cases, and
 * type-safety regression checks.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

import {
  VARIANT_COLORS,
  TYPE_META,
  toDisplayLabel,
  variantColor,
} from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-constants'
import type { TestType, DisplayLabel } from '@/lib/youtube/ab-types'

import {
  VChip,
  Badge,
  InfoTip,
  type BadgeTone,
} from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-primitives'

import { MOCK_DASHBOARD } from '../helpers/mock-dashboard'
import {
  MOCK_WINNER,
  MOCK_PLAYOFF,
  MOCK_ACTIVE,
  MOCK_ACTIVE_MINIMAL,
} from '@/app/cms/(authed)/youtube/ab-lab/_components/mock-views'

import { computeDashboardStats } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { makeTestWithVariants, makeTestRow, makeVariant } from '../helpers/ab-fixtures'

import type {
  AbTestDetailView,
  AbTestActiveView,
  AbTestWinnerView,
  AbTestPlayoffView,
  AbTestDraft,
  DashboardStats,
  SuggestedVideo,
  AbTestWithVariants,
} from '@/lib/youtube/ab-types'

// Mock lucide-react icons used by primitives
vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) =>
    React.createElement('svg', { 'data-testid': `icon-${name}`, ...props })
  return {
    Image: icon('Image'),
    Type: icon('Type'),
    FileText: icon('FileText'),
    Layers: icon('Layers'),
  }
})

// ============================================================================
// 1. Visual token consistency
// ============================================================================

describe('Visual token consistency', () => {
  it('VARIANT_COLORS has entries for A, B, C, D', () => {
    const labels: DisplayLabel[] = ['A', 'B', 'C', 'D']
    for (const l of labels) {
      expect(VARIANT_COLORS[l]).toBeDefined()
      expect(typeof VARIANT_COLORS[l]).toBe('string')
      // Ensure it looks like a hex color
      expect(VARIANT_COLORS[l]).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('VARIANT_COLORS has exactly 4 entries', () => {
    expect(Object.keys(VARIANT_COLORS)).toHaveLength(4)
  })

  it('all VARIANT_COLORS are distinct', () => {
    const values = Object.values(VARIANT_COLORS)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })

  it('TYPE_META has entries for all TestType values', () => {
    const types: TestType[] = ['thumbnail', 'title', 'combo']
    for (const t of types) {
      expect(TYPE_META[t]).toBeDefined()
      expect(TYPE_META[t].icon).toBeTruthy()
      expect(TYPE_META[t].label).toBeTruthy()
      expect(TYPE_META[t].hint).toBeTruthy()
    }
  })

  it('TYPE_META labels are unique', () => {
    const labels = Object.values(TYPE_META).map(m => m.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('Badge tones cover all expected values', () => {
    const expectedTones: BadgeTone[] = ['neutral', 'accent', 'green', 'amber', 'cowork', 'live']
    for (const tone of expectedTones) {
      const { container } = render(React.createElement(Badge, { tone }, `badge-${tone}`))
      expect(container.textContent).toContain(`badge-${tone}`)
    }
  })

  it('variantColor returns valid hex for each DisplayLabel', () => {
    const labels: DisplayLabel[] = ['A', 'B', 'C', 'D']
    for (const l of labels) {
      expect(variantColor(l)).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('toDisplayLabel maps original to A consistently', () => {
    expect(toDisplayLabel('original')).toBe('A')
    expect(toDisplayLabel('original', false)).toBe('A')
    expect(toDisplayLabel('original', true)).toBe('A')
  })
})

// ============================================================================
// 2. InfoTip accessibility
// ============================================================================

describe('InfoTip accessibility', () => {
  it('renders tooltip on focus', () => {
    render(React.createElement(InfoTip, { text: 'Tooltip content' }))
    const btn = screen.getByText('?')
    fireEvent.focus(btn)
    expect(screen.getByRole('tooltip')).toBeDefined()
    expect(screen.getByText('Tooltip content')).toBeDefined()
  })

  it('has aria-label for screen readers', () => {
    render(React.createElement(InfoTip, { text: 'Help text' }))
    expect(screen.getByLabelText('More information')).toBeDefined()
  })

  it('has aria-expanded attribute toggling correctly', () => {
    render(React.createElement(InfoTip, { text: 'Some info' }))
    const btn = screen.getByText('?')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    fireEvent.focus(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })

  it('has aria-describedby linking to tooltip when open', () => {
    render(React.createElement(InfoTip, { text: 'Linked info' }))
    const btn = screen.getByText('?')
    expect(btn.getAttribute('aria-describedby')).toBeNull()
    fireEvent.focus(btn)
    const tooltipId = btn.getAttribute('aria-describedby')
    expect(tooltipId).toBeTruthy()
    const tooltip = document.getElementById(tooltipId!)
    expect(tooltip).not.toBeNull()
    expect(tooltip?.getAttribute('role')).toBe('tooltip')
  })

  it('tooltip uses fixed positioning', () => {
    render(React.createElement(InfoTip, { text: 'Fixed tooltip' }))
    fireEvent.focus(screen.getByText('?'))
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.className).toContain('fixed')
  })

  it('hides tooltip on Escape key', () => {
    render(React.createElement(InfoTip, { text: 'Escape test' }))
    fireEvent.focus(screen.getByText('?'))
    expect(screen.getByRole('tooltip')).toBeDefined()
    fireEvent.keyDown(screen.getByText('?').parentElement!, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('opens on mouseEnter', () => {
    render(React.createElement(InfoTip, { text: 'Hover help' }))
    fireEvent.mouseEnter(screen.getByText('?'))
    expect(screen.getByRole('tooltip')).toBeDefined()
  })

  it('closes on mouseLeave from button', () => {
    render(React.createElement(InfoTip, { text: 'Leave test' }))
    fireEvent.mouseEnter(screen.getByText('?'))
    expect(screen.getByRole('tooltip')).toBeDefined()
    fireEvent.mouseLeave(screen.getByText('?'))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})

// ============================================================================
// 3. VChip rendering
// ============================================================================

describe('VChip rendering', () => {
  it('renders correct label text', () => {
    render(React.createElement(VChip, { label: 'B' }))
    expect(screen.getByText('B')).toBeDefined()
  })

  it('applies variant color via inline style', () => {
    const { container } = render(React.createElement(VChip, { label: 'C' }))
    const el = container.firstElementChild as HTMLElement
    expect(el.style.backgroundColor).toBe(VARIANT_COLORS.C)
  })

  it('shows ring effect when ring=true', () => {
    const { container } = render(React.createElement(VChip, { label: 'A', ring: true }))
    const el = container.firstElementChild as HTMLElement
    expect(el.style.boxShadow).toContain(VARIANT_COLORS.A)
  })

  it('does not show ring effect when ring is absent', () => {
    const { container } = render(React.createElement(VChip, { label: 'A' }))
    const el = container.firstElementChild as HTMLElement
    // boxShadow should be empty or not contain the variant color ring
    expect(el.style.boxShadow).toBe('')
  })

  it('onClick handler fires when clicked', () => {
    const handler = vi.fn()
    render(React.createElement(VChip, { label: 'D', onClick: handler }))
    fireEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('renders as button element when onClick is provided', () => {
    render(React.createElement(VChip, { label: 'B', onClick: () => {} }))
    expect(screen.getByRole('button')).toBeDefined()
  })

  it('renders as span when no onClick', () => {
    const { container } = render(React.createElement(VChip, { label: 'B' }))
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('span')).not.toBeNull()
  })

  it('respects custom size prop', () => {
    const { container } = render(React.createElement(VChip, { label: 'A', size: 36 }))
    const el = container.firstElementChild as HTMLElement
    expect(el.style.width).toBe('36px')
    expect(el.style.height).toBe('36px')
  })

  it('has aria-label for each variant label', () => {
    const labels: DisplayLabel[] = ['A', 'B', 'C', 'D']
    for (const l of labels) {
      const { unmount } = render(React.createElement(VChip, { label: l }))
      expect(screen.getByLabelText(`Variante ${l}`)).toBeDefined()
      unmount()
    }
  })
})

// ============================================================================
// 4. Mock data integrity
// ============================================================================

describe('Mock data integrity', () => {
  describe('MOCK_WINNER', () => {
    it('has all required fields', () => {
      expect(MOCK_WINNER.id).toBeTruthy()
      expect(MOCK_WINNER.videoTitle).toBeTruthy()
      expect(MOCK_WINNER.flag).toBeDefined()
      expect(MOCK_WINNER.status).toBe('completed')
      expect(MOCK_WINNER.outcome).toBe('winner')
      expect(MOCK_WINNER.winnerLabel).toBeDefined()
      expect(MOCK_WINNER.winnerColor).toBeTruthy()
      expect(typeof MOCK_WINNER.lift).toBe('number')
      expect(typeof MOCK_WINNER.confidence).toBe('number')
    })

    it('has resultMeta with all required fields', () => {
      const rm = MOCK_WINNER.resultMeta
      expect(typeof rm.ctrBefore).toBe('number')
      expect(typeof rm.ctrAfter).toBe('number')
      expect(typeof rm.totalImpressions).toBe('number')
      expect(typeof rm.abbaCycles).toBe('number')
      expect(typeof rm.monthlyExtraClicks).toBe('number')
    })

    it('has variants array with valid entries', () => {
      expect(MOCK_WINNER.variants.length).toBeGreaterThanOrEqual(2)
      for (const v of MOCK_WINNER.variants) {
        expect(['A', 'B', 'C', 'D']).toContain(v.label)
        expect(v.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
        expect(typeof v.ctr).toBe('number')
        expect(typeof v.impressions).toBe('number')
      }
    })

    it('has variantThumbs matching variants', () => {
      const thumbLabels = MOCK_WINNER.variantThumbs.map(t => t.label)
      const variantLabels = MOCK_WINNER.variants.map(v => v.label)
      expect(thumbLabels).toEqual(variantLabels)
    })

    it('has monitor with sparkline', () => {
      expect(MOCK_WINNER.monitor).toBeDefined()
      expect(MOCK_WINNER.monitor!.sparkline.length).toBeGreaterThan(0)
      expect(typeof MOCK_WINNER.monitor!.liveCtr).toBe('number')
      expect(typeof MOCK_WINNER.monitor!.liftVsOriginal).toBe('number')
    })
  })

  describe('MOCK_PLAYOFF', () => {
    it('has finalists array', () => {
      expect(MOCK_PLAYOFF.finalists).toBeDefined()
      expect(Array.isArray(MOCK_PLAYOFF.finalists)).toBe(true)
      expect(MOCK_PLAYOFF.finalists.length).toBeGreaterThanOrEqual(2)
    })

    it('finalists have required fields', () => {
      for (const f of MOCK_PLAYOFF.finalists) {
        expect(['A', 'B', 'C', 'D']).toContain(f.label)
        expect(f.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
        expect(typeof f.ctr).toBe('number')
      }
    })

    it('has outcome=playoff and status=completed', () => {
      expect(MOCK_PLAYOFF.outcome).toBe('playoff')
      expect(MOCK_PLAYOFF.status).toBe('completed')
    })

    it('has playoffTestId', () => {
      expect(MOCK_PLAYOFF.playoffTestId).toBeTruthy()
    })

    it('has confidenceReached below threshold', () => {
      expect(MOCK_PLAYOFF.confidenceReached).toBeLessThan(95)
    })

    it('has reason text', () => {
      expect(typeof MOCK_PLAYOFF.reason).toBe('string')
      expect(MOCK_PLAYOFF.reason.length).toBeGreaterThan(0)
    })
  })

  describe('MOCK_ACTIVE', () => {
    it('has confirmedData', () => {
      expect(MOCK_ACTIVE.confirmedData).toBeDefined()
      expect(typeof MOCK_ACTIVE.confirmedData.confidence).toBe('number')
      expect(['A', 'B', 'C', 'D']).toContain(MOCK_ACTIVE.confirmedData.leader)
      expect(MOCK_ACTIVE.confirmedData.leaderColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(typeof MOCK_ACTIVE.confirmedData.lift).toBe('number')
    })

    it('has liveData', () => {
      expect(MOCK_ACTIVE.liveData).toBeDefined()
      expect(typeof MOCK_ACTIVE.liveData!.confidence).toBe('number')
      expect(['A', 'B', 'C', 'D']).toContain(MOCK_ACTIVE.liveData!.leader)
    })

    it('status is active', () => {
      expect(MOCK_ACTIVE.status).toBe('active')
    })

    it('has gates array', () => {
      expect(MOCK_ACTIVE.gates.length).toBeGreaterThan(0)
      for (const g of MOCK_ACTIVE.gates) {
        expect(g.name).toBeTruthy()
        expect(typeof g.passed).toBe('boolean')
        expect(typeof g.value).toBe('string')
      }
    })
  })

  describe('MOCK_ACTIVE_MINIMAL', () => {
    it('has no liveData', () => {
      expect(MOCK_ACTIVE_MINIMAL.liveData).toBeUndefined()
    })

    it('has confirmedData', () => {
      expect(MOCK_ACTIVE_MINIMAL.confirmedData).toBeDefined()
      expect(typeof MOCK_ACTIVE_MINIMAL.confirmedData.confidence).toBe('number')
    })

    it('has only 2 variants', () => {
      expect(MOCK_ACTIVE_MINIMAL.variants).toHaveLength(2)
    })

    it('status is active', () => {
      expect(MOCK_ACTIVE_MINIMAL.status).toBe('active')
    })
  })

  describe('All mock variants have valid DisplayLabel', () => {
    const validLabels: DisplayLabel[] = ['A', 'B', 'C', 'D']

    it('MOCK_WINNER variants', () => {
      for (const v of MOCK_WINNER.variants) {
        expect(validLabels).toContain(v.label)
      }
    })

    it('MOCK_PLAYOFF variants', () => {
      for (const v of MOCK_PLAYOFF.variants) {
        expect(validLabels).toContain(v.label)
      }
    })

    it('MOCK_ACTIVE variants', () => {
      for (const v of MOCK_ACTIVE.variants) {
        expect(validLabels).toContain(v.label)
      }
    })

    it('MOCK_ACTIVE_MINIMAL variants', () => {
      for (const v of MOCK_ACTIVE_MINIMAL.variants) {
        expect(validLabels).toContain(v.label)
      }
    })

    it('MOCK_DASHBOARD card variants', () => {
      for (const card of MOCK_DASHBOARD.cards) {
        for (const v of card.variants) {
          expect(validLabels).toContain(v.label)
        }
      }
    })
  })
})

// ============================================================================
// 5. Dashboard stats edge cases
// ============================================================================

describe('Dashboard stats edge cases', () => {
  function concluido(comVencedor: boolean, parent: string | null = null) {
    const t = makeTestWithVariants({ hasWinner: comVencedor })
    t.status = 'completed'
    t.completed_reason = comVencedor ? 'manual_apply' : 'max_duration'
    t.parent_test_id = parent
    return t
  }

  it('0 active + 0 completed: winRate null, contagens zeradas', () => {
    const stats = computeDashboardStats([], [])
    expect(stats.activeTests).toBe(0)
    expect(stats.winRate).toBeNull()
    expect(stats.completedTests).toBe(0)
    expect(stats.testsWon).toBe(0)
  })

  it('completedTests é o total de concluídos raiz; winRateBase só os que contam (auto_resolve e razão null ficam fora)', () => {
    const auto = concluido(true); auto.completed_reason = 'auto_resolve'
    const semRazao = concluido(false); semRazao.completed_reason = null
    const stats = computeDashboardStats([], [concluido(true), concluido(false), auto, semRazao, concluido(true, 'pai')])
    expect(stats.completedTests).toBe(4)
    expect(stats.winRateBase).toBe(2)
    expect(stats.testsWon).toBe(1)
    expect(stats.winRate).toBe(50)
  })

  it('playoff children excluded from root completed count', () => {
    const stats = computeDashboardStats([], [concluido(true), concluido(true, 'parent-id')])
    expect(stats.completedTests).toBe(1)
    expect(stats.testsWon).toBe(1)
  })

  it('playoff children excluded from winRate calculation', () => {
    const stats = computeDashboardStats([], [concluido(true), concluido(false), concluido(true, 'some-parent')])
    expect(stats.winRate).toBe(50)
    expect(stats.completedTests).toBe(2)
    expect(stats.testsWon).toBe(1)
  })

  it('win rate calculation correctness with all winners', () => {
    const stats = computeDashboardStats([], Array.from({ length: 4 }, () => concluido(true)))
    expect(stats.winRate).toBe(100)
    expect(stats.testsWon).toBe(4)
    expect(stats.completedTests).toBe(4)
  })

  it('win rate calculation correctness with no winners', () => {
    const stats = computeDashboardStats([], Array.from({ length: 3 }, () => concluido(false)))
    expect(stats.winRate).toBe(0)
    expect(stats.testsWon).toBe(0)
    expect(stats.completedTests).toBe(3)
  })

  it('active tests counted correctly with mixed statuses', () => {
    const active1 = makeTestWithVariants()
    active1.status = 'active'
    const active2 = makeTestWithVariants()
    active2.status = 'active'
    const active3 = makeTestWithVariants()
    active3.status = 'active'

    const stats = computeDashboardStats([active1, active2, active3], [])
    expect(stats.activeTests).toBe(3)
  })

})

// ============================================================================
// 6. Type safety regression tests
// ============================================================================

describe('Type safety regression tests', () => {
  it('AbTestDetailView discriminated union narrows to ActiveView', () => {
    const view: AbTestDetailView = MOCK_ACTIVE
    if (view.status === 'active') {
      // TypeScript narrows to AbTestActiveView
      expect(view.confirmedData).toBeDefined()
      expect(view.outcome).toBeUndefined()
    }
  })

  it('AbTestDetailView discriminated union narrows to WinnerView', () => {
    const view: AbTestDetailView = MOCK_WINNER
    if (view.status === 'completed' && view.outcome === 'winner') {
      // TypeScript narrows to AbTestWinnerView
      expect(view.winnerLabel).toBeDefined()
      expect(view.lift).toBeDefined()
      expect(view.confidence).toBeDefined()
      expect(view.resultMeta).toBeDefined()
    }
  })

  it('AbTestDetailView discriminated union narrows to PlayoffView', () => {
    const view: AbTestDetailView = MOCK_PLAYOFF
    if (view.status === 'completed' && view.outcome === 'playoff') {
      // TypeScript narrows to AbTestPlayoffView
      expect(view.finalists).toBeDefined()
      expect(view.playoffTestId).toBeDefined()
      expect(view.confidenceReached).toBeDefined()
      expect(view.reason).toBeDefined()
    }
  })

  it('AbTestDraft has videoId field', () => {
    const draft: AbTestDraft = {
      id: 'test-id',
      name: 'Draft',
      type: 'thumbnail',
      step: 1,
      thumbUrl: null,
      createdAt: new Date().toISOString(),
      createdAgo: '1h ago',
      videoId: 'yt-video-123',
      sourcePipelineId: null,
    }
    expect(draft.videoId).toBe('yt-video-123')
    expect(typeof draft.videoId).toBe('string')
  })

  it('DashboardStats has completedTests and testsWon', () => {
    const stats: DashboardStats = {
      activeTests: 2,
      avgConfidence: 87,
      winRate: 60,
      avgLift: 12.3,
      completedTests: 10,
      winRateBase: 10,
      testsWon: 6,
    }
    expect(stats.completedTests).toBe(10)
    expect(stats.testsWon).toBe(6)
  })

  it('SuggestedVideo impressions and confidence are optional', () => {
    const suggested: SuggestedVideo = {
      id: 'sug-1',
      title: 'Test Video',
      thumbnailUrl: null,
      ctr: 3.2,
      channelMedianCtr: 5.1,
      grade: 'D',
      reason: 'Below median',
      suggest: 'thumbnail',
      // impressions and confidence intentionally omitted
    }
    expect(suggested.impressions).toBeUndefined()
    expect(suggested.confidence).toBeUndefined()

    const withOptionals: SuggestedVideo = {
      ...suggested,
      impressions: 26000,
      confidence: 0.82,
    }
    expect(withOptionals.impressions).toBe(26000)
    expect(withOptionals.confidence).toBe(0.82)
  })

  it('AbTestActiveView has outcome?: never (compile-time check)', () => {
    const active: AbTestActiveView = MOCK_ACTIVE
    // At runtime outcome should be undefined since it's `never`
    expect(active.outcome).toBeUndefined()
  })

  it('AbTestWinnerView requires resultMeta with all subfields', () => {
    const winner: AbTestWinnerView = MOCK_WINNER
    expect(winner.resultMeta).toHaveProperty('ctrBefore')
    expect(winner.resultMeta).toHaveProperty('ctrAfter')
    expect(winner.resultMeta).toHaveProperty('totalImpressions')
    expect(winner.resultMeta).toHaveProperty('abbaCycles')
    expect(winner.resultMeta).toHaveProperty('monthlyExtraClicks')
  })

  it('AbTestPlayoffView requires finalists with label, color, ctr, thumbnailUrl', () => {
    const playoff: AbTestPlayoffView = MOCK_PLAYOFF
    for (const f of playoff.finalists) {
      expect(f).toHaveProperty('label')
      expect(f).toHaveProperty('color')
      expect(f).toHaveProperty('ctr')
      expect(f).toHaveProperty('thumbnailUrl')
    }
  })

  it('MOCK_DASHBOARD stats matches DashboardStats interface', () => {
    const stats: DashboardStats = MOCK_DASHBOARD.stats
    expect(typeof stats.activeTests).toBe('number')
    expect(typeof stats.avgConfidence).toBe('number')
    expect(typeof stats.winRate).toBe('number')
    expect(typeof stats.avgLift).toBe('number')
    expect(typeof stats.completedTests).toBe('number')
    expect(typeof stats.testsWon).toBe('number')
  })

  it('MOCK_DASHBOARD drafts have videoId', () => {
    for (const draft of MOCK_DASHBOARD.drafts) {
      expect(typeof draft.videoId).toBe('string')
      expect(draft.videoId.length).toBeGreaterThan(0)
    }
  })
})
