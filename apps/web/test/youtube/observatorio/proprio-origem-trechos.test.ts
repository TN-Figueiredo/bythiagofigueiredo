// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { chamadasDe, juntarConjunto, lotesDe, trechosDe, MAX_CHAMADAS } from '@/app/cms/(authed)/youtube/competitors/_proprio/origem-trechos'
import { addDays, diffDias } from '@/lib/youtube/coleta/day-pt'
import type { ConjuntoLido, VideoLido } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import type { LinhaBasica } from '@/lib/youtube/observatorio/proprio/dimensoes-estado'

const DE = '2026-01-01'
describe('trechosDe', () => {
  it('7 dias: um trecho; 120: um trecho; 121: dois; 300: três consecutivos sem dia repetido nem faltando', () => {
    expect(trechosDe(DE, addDays(DE, 6))).toHaveLength(1)
    expect(trechosDe(DE, addDays(DE, 119))).toHaveLength(1)
    expect(trechosDe(DE, addDays(DE, 120))).toHaveLength(2)
    const t = trechosDe(DE, addDays(DE, 299))
    expect(t).toHaveLength(3)
    expect(t.reduce((s, x) => s + diffDias(x.de, x.ate) + 1, 0)).toBe(300)
    expect(t[1]!.de).toBe(addDays(t[0]!.ate, 1))
    expect(t[2]!.de).toBe(addDays(t[1]!.ate, 1))
    expect(t[2]!.ate).toBe(addDays(DE, 299))
  })
  it('início depois do fim: RangeError', () => { expect(() => trechosDe('2026-02-01', DE)).toThrow(RangeError) })
})
describe('lotesDe e chamadasDe', () => {
  it('60 vídeos: dois lotes; repetido conta uma vez; lista vazia: um lote vazio', () => {
    const ids = Array.from({ length: 60 }, (_, i) => 'v' + i)
    expect(lotesDe(ids).map(l => l.length)).toEqual([50, 10])
    expect(lotesDe(['a', 'a', 'b'])).toEqual([['a', 'b']])
    expect(lotesDe([])).toEqual([[]])
  })
  it(`60 vídeos em 300 dias: 6 chamadas; 13 chamadas lançam (o máximo é ${MAX_CHAMADAS})`, () => {
    const ids = Array.from({ length: 60 }, (_, i) => 'v' + i)
    expect(chamadasDe(ids, DE, addDays(DE, 299))).toHaveLength(6)
    expect(() => chamadasDe(ids, DE, addDays(DE, 120 * 7 - 1))).toThrow(RangeError)
    expect(chamadasDe(ids, DE, addDays(DE, 120 * 6 - 1))).toHaveLength(12)
  })
})
describe('juntarConjunto', () => {
  const dia = (d: string): VideoLido<LinhaBasica>['dias'][number] => ({ dia: d, coberto: true, baseMedida: true, base: 1, antesDoInicio: false, desde: DE, linhas: [] })
  const conj = (estado: ConjuntoLido<LinhaBasica>['estado'], videos: Array<[string, string[]]>): ConjuntoLido<LinhaBasica> =>
    ({ conjunto: 'trafego', estado, videos: videos.map(([ytId, ds]) => ({ ytId, dias: ds.map(dia) })) })
  it('os dias de cada vídeo vêm dos trechos em ordem, e o estado é o do trecho mais recente', () => {
    const r = juntarConjunto([
      { trecho: 1, lote: 0, conjunto: conj({ tipo: 'coletado' }, [['a', ['2026-01-04']]]) },
      { trecho: 0, lote: 0, conjunto: conj({ tipo: 'nao_coletado' }, [['a', ['2026-01-01', '2026-01-02']]]) },
      { trecho: 0, lote: 1, conjunto: conj({ tipo: 'nao_coletado' }, [['b', ['2026-01-01']]]) },
    ])
    expect(r.estado).toEqual({ tipo: 'coletado' })
    expect(r.videos.map(v => v.ytId)).toEqual(['a', 'b'])
    expect(r.videos[0]!.dias.map(d => d.dia)).toEqual(['2026-01-01', '2026-01-02', '2026-01-04'])
  })
})
