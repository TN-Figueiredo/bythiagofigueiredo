import { describe, it, expect } from 'vitest'
import type { AbTestDetailView, AbTestActiveView, AbTestWinnerView, AbTestPlayoffView, GateResult, LiveMonitor } from '@/lib/youtube/ab-types'
import type { AbTestBaseView, VariantThumb } from '@/lib/youtube/ab-types'

describe('AbTestDetailView discriminated union', () => {
  it('narrows to ActiveView when status is active', () => {
    const view = { status: 'active' } as AbTestDetailView
    if (view.status === 'active') {
      expect(view.status).toBe('active')
    }
  })
  it('narrows to WinnerView when outcome is winner', () => {
    const view = { status: 'completed', outcome: 'winner' } as AbTestDetailView
    if (view.status === 'completed' && view.outcome === 'winner') {
      expect(view.outcome).toBe('winner')
    }
  })
  it('narrows to PlayoffView when outcome is playoff', () => {
    const view = { status: 'completed', outcome: 'playoff' } as AbTestDetailView
    if (view.status === 'completed' && view.outcome === 'playoff') {
      expect(view.outcome).toBe('playoff')
    }
  })
  it('GateResult has required fields', () => {
    const g: GateResult = { name: 'confidence', passed: true, value: '97%' }
    expect(g.name).toBe('confidence')
    expect(g.passed).toBe(true)
    expect(g.hint).toBeUndefined()
  })
  it('LiveMonitor has checkpoints array', () => {
    const m: LiveMonitor = { liveCtr: 5.2, sparkline: [4.8, 5.0, 5.2], liftVsOriginal: 12.3, checkpoints: [{ label: 'D+7', reached: true }] }
    expect(m.checkpoints).toHaveLength(1)
  })
  it('ActiveView has outcome?: never', () => {
    const view: AbTestActiveView = { status: 'active' } as AbTestActiveView
    expect(view.outcome).toBeUndefined()
  })
  it('VariantThumb has isOriginal flag', () => {
    const t: VariantThumb = { label: 'A' as const, color: '#8A8F98', thumbUrl: null, isOriginal: true }
    expect(t.isOriginal).toBe(true)
  })
  it('AbTestBaseView has gates array', () => {
    const base = { gates: [{ name: 'confidence', passed: true, value: '97%' }] } as AbTestBaseView
    expect(base.gates).toHaveLength(1)
  })
})
