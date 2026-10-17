import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EstourouEParou } from '@/app/cms/(authed)/youtube/competitors/_historico/estourou-e-parou'
import { describe, expect, it } from 'vitest'
import { geomOf } from '@/app/cms/(authed)/youtube/competitors/_historico/views-chart'
import type { ChartView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { quandoMs } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/formatos'
import { createClock } from '@/lib/youtube/observatorio/time'

const chart = (o: Partial<ChartView>): ChartView => ({ H: 100, fromH: 0, B0: null, ...o } as ChartView)

describe('trem 5.1, nunca valor não finito no SVG do gráfico', () => {
  it('troca antes da coleta diária (B0 = 0 ou igual a H) fica presa na borda, finita', () => {
    for (const c of [chart({ B0: 0 }), chart({ B0: 100 }), chart({ B0: 40 }), chart({ H: 0, fromH: 0 })]) {
      const g = geomOf(1100, c)
      for (const h of [-50, 0, 10, 40, 100, 500]) expect(Number.isFinite(g.x(h))).toBe(true)
    }
  })
})

describe('trem 5.1, "há N dias" é dias completos em todo lugar', () => {
  const agora = Date.parse('2026-10-17T15:00:00-03:00')
  const pub = agora - (14 * 24 + 20) * 3_600_000 // 14 d 20 h
  it('quandoMs dá 14, não 15', () => { expect(quandoMs(pub, agora)).toBe('há 14 dias') })
  it('daysAgo do relógio dá o mesmo N', () => {
    const clock = createClock(agora, agora, agora)
    expect(clock.daysAgo(pub)).toBe(14)
  })
})

describe('trem 5.1, Estourou sem leitura com data passada', () => {
  const render = (esteVideoEm: string) => renderToStaticMarkup(createElement(EstourouEParou, { leitura: { tipo: 'ainda_nao_existe', existeEm: '2026-10-20', esteVideoEm, hojeSP: '2026-10-17', casas: 'ppp' } as never }))
  it('data futura: "faz 90 dias em ...; a leitura sai nesse dia"', () => {
    const h = render('2026-10-20')
    expect(h).toContain('faz')
    expect(h).toContain('a leitura sai nesse dia')
  })
  it('data passada: "já fez", sem prometer a leitura nesse dia', () => {
    const h = render('2026-10-08')
    expect(h).toContain('já fez')
    expect(h).toContain('ainda não saiu')
    expect(h).not.toContain('a leitura sai nesse dia')
  })
})
