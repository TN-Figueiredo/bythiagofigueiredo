// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { toHistoryEntry, seriesTimelines, FORJA_SERIES_SINCE, type HistoryRow } from '@/lib/youtube/analysis-history'

// The three channel-level rows of the PT channel in production on 23/09/2026, trimmed
// (episode ids shortened to what the parser needs: none).
const FORJA_0730: HistoryRow = {
  id: 'f2', source: 'forja', generated_at: '2026-09-23T10:30:16.067Z',
  coaching: { summary: 'Sem CTR/retenção nesta fase; base: views e séries. Canal com 31 vídeos públicos…', priorities: [] },
  patterns_detected: [
    {
      tipo: 'padrao', pattern_id: 'serie:zero-dez', category: 'series', confidence: 0.6, sample_size: 10,
      finding: 'Série "0–10": 11 vídeos, mediana de 91 views na vida (0,63× da coorte de 2019)',
      serie: 'zero-dez', nome: '0–10', n: 11, ano: 2019, anos: { de: 2019, ate: 2019 },
      mediana: 91, mediana_coorte: 143.5, n_coorte: 10, razao: 0.6341463414634146, leitura: 'abaixo',
    },
    {
      tipo: 'examinada', serie: 'canada', nome: 'Canadá', n: 9, ano: 2017, anos: { de: 2017, ate: 2019 },
      mediana: 209, n_coorte: 0, leitura: 'sem_coorte', motivo: 'coorte_fina',
    },
    {
      tipo: 'examinada', serie: 'vlogzeira', nome: 'Vlogzeira', n: 3, ano: 2019, anos: { de: 2019, ate: 2019 },
      mediana: 156, mediana_coorte: 109.5, n_coorte: 18, razao: 1.4246575342465753, leitura: 'neutra', motivo: 'padrao_neutro',
    },
  ],
}
const FORJA_2209: HistoryRow = {
  id: 'f1', source: 'forja', generated_at: '2026-09-22T20:10:42.398Z',
  coaching: { summary: 'Sem CTR/retenção nesta fase; base: views e séries. Canal com 35 vídeos no banco…', priorities: [] },
  patterns_detected: [],
}
const COWORK_1805: HistoryRow = {
  id: 'c1', source: 'cowork', generated_at: '2026-05-18T13:34:10.407Z',
  coaching: {
    summary: 'Canal micro (1.160 subs) em transição geográfica…',
    priorities: [
      { axis: 'reach', score: 3, diagnosis: 'd', action: 'Produzir 2-3 vídeos/mês sobre Tailândia' },
      { axis: 'growth', score: 2, diagnosis: 'd', action: 'Estabelecer cadência mínima' },
      { axis: 'nope', score: 2, diagnosis: 'd', action: 'eixo que não existe' },
    ],
  },
  patterns_detected: [
    { category: 'content', confidence: 0.78, finding: 'Vídeos Tailândia performam 3.5x', pattern_id: 'thailand', sample_size: 2 },
    { finding: 'forma antiga, sem os campos que o schema exige hoje' },
    { garbage: true },
  ],
}

describe('toHistoryEntry', () => {
  it('the forja row of 07:30: one series with a verdict, two examined, numbers intact', () => {
    const e = toHistoryEntry(FORJA_0730)!
    expect(e.source).toBe('forja')
    expect(e.legacyForja).toBe(false)
    expect(e.summarySource).toBeNull() // written before summary_source existed
    expect(e.series.map(s => [s.serie, s.comVeredito, s.leitura])).toEqual([
      ['zero-dez', true, 'abaixo'],
      ['canada', false, 'sem_coorte'],
      ['vlogzeira', false, 'neutra'],
    ])
    const zd = e.series[0]!
    expect(zd).toMatchObject({ nome: '0–10', n: 11, ano: 2019, mediana: 91, medianaCoorte: 143.5, nCoorte: 10 })
    expect(zd.razao).toBeCloseTo(0.634, 3)
    // Canadá: the year of the cohort is the MEDIAN episode's (2017) while the span is 2017–2019.
    expect(e.series[1]).toMatchObject({ ano: 2017, anos: { de: 2017, ate: 2019 }, razao: null, medianaCoorte: null, nCoorte: 0, motivo: 'coorte_fina' })
  })

  it('the forja row of 22/09 is legacy: it ran before the series map', () => {
    const e = toHistoryEntry(FORJA_2209)!
    expect(e.legacyForja).toBe(true)
    expect(Date.parse(FORJA_2209.generated_at as string)).toBeLessThan(Date.parse(FORJA_SERIES_SINCE))
    expect(Date.parse(FORJA_0730.generated_at as string)).toBeGreaterThan(Date.parse(FORJA_SERIES_SINCE))
  })

  it('the Cowork row: known axes only; old-shape findings counted, garbage not', () => {
    const e = toHistoryEntry(COWORK_1805)!
    expect(e.priorities.map(p => p.axis)).toEqual(['reach', 'growth'])
    expect(e.findingCount).toBe(2)
    expect(e.series).toEqual([])
    expect(e.legacyForja).toBe(false) // only the forja's rows can be legacy
  })

  it('summary_source is read when the forja sends it', () => {
    const e = toHistoryEntry({ ...FORJA_0730, coaching: { summary: 's', priorities: [], summary_source: 'template' } })!
    expect(e.summarySource).toBe('template')
    const bad = toHistoryEntry({ ...FORJA_0730, coaching: { summary: 's', summary_source: 'gemma' } })!
    expect(bad.summarySource).toBeNull()
  })

  it('rejects rows it cannot place: unknown source, bad date, no id', () => {
    expect(toHistoryEntry({ ...FORJA_0730, source: 'forja_retirada_1' })).toBeNull()
    expect(toHistoryEntry({ ...FORJA_0730, generated_at: 'ontem' })).toBeNull()
    expect(toHistoryEntry({ ...FORJA_0730, id: 7 })).toBeNull()
  })

  it('coaching that is not an object reads as an empty summary, not a crash', () => {
    const e = toHistoryEntry({ ...FORJA_2209, coaching: null, patterns_detected: 'x' })!
    expect(e.summary).toBe('')
    expect(e.series).toEqual([])
  })
})

describe('seriesTimelines', () => {
  const entries = [FORJA_0730, FORJA_2209, COWORK_1805].map(r => toHistoryEntry(r)!)

  it('today (one measured point per series) there is no timeline to draw', () => {
    expect(seriesTimelines(entries)).toEqual([])
  })

  it('with a second analysis, each measured series gets its points oldest first; no-ratio series stay out', () => {
    const next = toHistoryEntry({
      ...FORJA_0730, id: 'f3', generated_at: '2026-09-30T10:30:00Z',
      patterns_detected: [
        { ...(FORJA_0730.patterns_detected as object[])[0] as object, razao: 0.66 },
        (FORJA_0730.patterns_detected as object[])[1],
      ],
    })!
    const t = seriesTimelines([next, ...entries])
    expect(t.map(x => x.serie)).toEqual(['zero-dez'])
    expect(t[0]!.points.map(p => p.generatedAt)).toEqual(['2026-09-23T10:30:16.067Z', '2026-09-30T10:30:00Z'])
    expect(t[0]!.points[1]!.razao).toBe(0.66)
  })
})
