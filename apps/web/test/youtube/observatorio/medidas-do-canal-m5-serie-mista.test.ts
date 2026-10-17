// @vitest-environment node
// Portão do L7a, diagnóstico do I3 do Phil: a leitura por hora das primeiras 72 horas (mesclada na série por `lerSeriesDoCanal`) nunca forma o
// "ponto do dia" da subida (M5): só a leitura diária das 12:00 forma.
import { describe, it, expect } from 'vitest'
import { medidasDoCanal } from '@/lib/youtube/observatorio/medidas/do-canal'
import { subidasDoVideo } from '@/lib/youtube/observatorio/medidas/subida'
import type { Leitura } from '@/lib/youtube/observatorio/medidas/m1'
import { spDateOf } from '@/lib/youtube/observatorio/time'
import { AGORA_CHEIA, insumosCheios } from './medidas-fixture'

const H = 36e5
const DAY = 864e5

describe('M5 com série mista (diária + por hora)', () => {
  it('série com leituras por hora nos 3 primeiros dias: o ponto do dia é o das 12:00, não a última leitura horária', () => {
    const base = insumosCheios()
    if (base.series === 'nao_pedida' || !base.series.lido) throw new Error('fixture sem série')
    const v = base.videos.lido ? base.videos.dados.find((x) => x.id === 'v11') : undefined
    expect(v).toBeDefined()
    // publicado às 15:00 de São Paulo (18:00Z) há 30 dias; 1.000 views por hora nas 72 primeiras, depois 125 por hora
    const pub = Date.UTC(2026, 8, 14, 18, 0, 0)
    const views = (h: number): number => (h <= 72 ? 1000 * h : 72000 + 125 * (h - 72))
    const horarias: Leitura[] = Array.from({ length: 72 }, (_, k) => ({ t: pub + (k + 1) * H, views: views(k + 1), likes: null, comments: null, porHora: true as const }))
    const diarias: Leitura[] = []
    for (let d = 1; pub + d * DAY - 6 * H <= AGORA_CHEIA; d++) {
      const t = Date.UTC(2026, 8, 14 + d, 15, 0, 0) // 12:00 em São Paulo
      diarias.push({ t, views: views((t - pub) / H), likes: null, comments: null })
    }
    const todas = [...horarias, ...diarias].sort((a, b) => a.t - b.t)
    const series = new Map(base.series.dados.series).set('v11', todas)
    const r = medidasDoCanal({ ...base, series: { lido: true, dados: { ...base.series.dados, series } } }, { agoraMs: AGORA_CHEIA })
    const esperado = subidasDoVideo(diarias.map((l) => ({ dia: spDateOf(l.t), t: l.t, views: l.views })), [])
    const ingenuo = subidasDoVideo(todas.map((l) => ({ dia: spDateOf(l.t), t: l.t, views: l.views })), [])
    // a conta: o ingênuo avalia o dia 0 (só tem leitura por hora) e por isso mede mais dias; o certo não
    expect(ingenuo.estado === 'medido' && esperado.estado === 'medido' && ingenuo.n !== esperado.n).toBe(true)
    const m5 = r.porVideo.get('v11')?.m5
    expect(m5?.estado).toBe(esperado.estado)
    if (m5?.estado === 'medido' && esperado.estado === 'medido') {
      expect(m5.n).toBe(esperado.n)
      expect(m5.valor).toEqual(esperado.valor)
    }
  })
})
