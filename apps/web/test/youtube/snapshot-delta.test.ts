import { describe, it, expect } from 'vitest'
import { computeSnapshotDelta, type ChannelSnapshot } from '@/lib/youtube/snapshot-delta'

const NOW = new Date('2026-09-02T00:00:00Z').getTime()

function daily(startISO: string, n: number, valueAt: (i: number) => number): ChannelSnapshot[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(startISO)
    d.setUTCDate(d.getUTCDate() + i)
    return {
      snapshot_date: d.toISOString().slice(0, 10),
      subscriber_count: valueAt(i),
      view_count: valueAt(i) * 100,
    }
  })
}

describe('computeSnapshotDelta', () => {
  it('devolve null com menos de dois snapshots', () => {
    const one = [{ snapshot_date: '2026-09-01', subscriber_count: 10, view_count: 10 }]
    expect(computeSnapshotDelta(one, 'subscriber_count', NOW)).toBeNull()
  })

  it('com 90 dias de historico, calcula a delta de sete dias', () => {
    const snaps = daily('2026-06-04', 90, i => 1000 + i * 5)
    expect(computeSnapshotDelta(snaps, 'subscriber_count', NOW)).toBe(35)
  })

  it('usa o campo pedido', () => {
    const snaps = daily('2026-06-04', 90, i => 1000 + i * 5)
    expect(computeSnapshotDelta(snaps, 'view_count', NOW)).toBe(3500)
  })

  it('sintoma do bug: todo snapshot com mais de sete dias devolve null', () => {
    const snaps = daily('2026-06-01', 38, i => 100 + i)
    expect(computeSnapshotDelta(snaps, 'subscriber_count', NOW)).toBeNull()
  })

  it('Menor 8: sem nenhum snapshot com 7+ dias de idade, devolve null (nao finge janela semanal com o que tiver)', () => {
    // Apenas 3 dias de historico coletado, terminando em NOW — nenhum
    // snapshot tem 7 dias de idade. Antes da correcao, o fallback
    // `?? snapshots[0]!` pegava o snapshot mais antigo (so 2 dias atras) e
    // apresentava esse delta de 2 dias como se fosse semanal.
    const snaps = daily('2026-08-31', 3, i => 100 + i)
    expect(computeSnapshotDelta(snaps, 'subscriber_count', NOW)).toBeNull()
    expect(computeSnapshotDelta(snaps, 'view_count', NOW)).toBeNull()
  })
})
