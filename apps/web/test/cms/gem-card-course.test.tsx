import { describe, it, expect, vi } from 'vitest'

// gem-card.tsx is inside (authed) — a parenthesized route group.
// The bracketDirAliasPlugin only handles [bracket] dirs, so @/ imports
// from within (authed) fail to resolve. Mock all transitive @/ deps here.
vi.mock('@/lib/pipeline/gem-design', () => ({
  getPriorityConfig: vi.fn(() => ({ accent: '#fff', accentDim: '#000', label: 'P3', bgClass: '' })),
  getStaleness: vi.fn(() => ({ tier: 'ok', label: 'fresh', className: '' })),
  getFormatIcon: vi.fn(() => ({ icon: '▶', label: 'Video', bgClass: '' })),
  getLangConfig: vi.fn(() => ({ label: 'PT', className: '' })),
  getCardState: vi.fn(() => 'draft'),
  isBlocked: vi.fn(() => ({ blocked: false, blockers: [] })),
  getChecklistProgress: vi.fn(() => ({ segments: [], done: 0, total: 0 })),
}))

vi.mock('@/lib/pipeline/course-schemas', async () => {
  const actual = await import('../../src/lib/pipeline/course-schemas')
  return actual
})

vi.mock('../../src/app/cms/(authed)/pipeline/_components/gem-vvs-ring', () => ({
  GemVvsRing: () => null,
}))

import { computeCourseCardInfo } from '../../src/app/cms/(authed)/pipeline/_components/gem-card'

describe('computeCourseCardInfo', () => {
  it('returns null for non-course format', () => {
    expect(computeCourseCardInfo('video', {}, {})).toBeNull()
  })

  it('extracts product info from metadata', () => {
    const info = computeCourseCardInfo('course', { tier: 'core', price_cents: 29700 }, {})
    expect(info).toBeTruthy()
    expect(info!.tier).toBe('core')
    expect(info!.priceLabel).toBe('R$297,00')
  })

  it('computes progress from curriculum section', () => {
    const sections = {
      curriculum_shared: {
        rev: 1, source: 'user', edited: true, updated_at: new Date().toISOString(),
        content: {
          modules: [{
            id: 'm1', title: 'M1', sort_order: 0,
            lessons: [
              { id: 'l1', title: 'L1', type: 'video', sort_order: 0, production_status: 'ready' },
              { id: 'l2', title: 'L2', type: 'video', sort_order: 1, production_status: 'scripted' },
            ],
          }],
        },
      },
    }
    const info = computeCourseCardInfo('course', {}, sections)
    expect(info!.progress.done).toBe(1)
    expect(info!.progress.total).toBe(2)
  })
})
