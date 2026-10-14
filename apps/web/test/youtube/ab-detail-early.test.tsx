import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { EarlyDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/early-detail'
import type { AbTestActiveView, DisplayLabel } from '@/lib/youtube/ab-types'

function makeEarlyView(): AbTestActiveView {
  return {
    id: 'test-1', videoTitle: 'My YouTube Video', flag: 'thumbnail', status: 'active',
    variants: [
      { label: 'A', color: '#8A8F98', ctr: null, impressions: 0, clicks: 0, pBest: 0 },
      { label: 'B', color: '#E8823C', ctr: null, impressions: 0, clicks: 0, pBest: 0 },
    ],
    variantThumbs: [
      { label: 'A', color: '#8A8F98', thumbUrl: null, isOriginal: true },
      { label: 'B', color: '#E8823C', thumbUrl: null, isOriginal: false },
    ],
    confTrend: [],
    daily: { A: [], B: [] } as unknown as Record<DisplayLabel, number[]>,
    abbaSeq: ['A', 'B', 'B', 'A'] as DisplayLabel[],
    cycles: { total: 6, done: 0 },
    durationDays: 14,
    confidenceTarget: 0.95,
    totalRounds: 1,
    hasPlayoff: false,
    gates: [],
    confirmedData: { confidence: 0, leader: 'A' as DisplayLabel, leaderColor: '#8A8F98', lift: 0 },
  } as unknown as AbTestActiveView
}

describe('EarlyDetail (primeiro estado de todo teste novo)', () => {
  it('não promete confiança, chance de vencer, Bayes nem motor; mostra a frase fixa', () => {
    const { container } = render(<EarlyDetail view={makeEarlyView()} />)
    const texto = container.textContent ?? ''
    expect(texto).not.toMatch(/confian|chance de vencer|bayes|motor|credível|credivel/i)
    expect(texto).toContain('Sem medição de entrega por enquanto')
  })
})
