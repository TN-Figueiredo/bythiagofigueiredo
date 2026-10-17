// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { barrasPorDia, agruparMarcas, faixasDaSubida, modoDasLinhas, posicaoDaMudanca, raiaDoCampo } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/dias-model'

describe('E5a T20, dias', () => {
  it('faixa de 7 barras a partir da borda direita do dia da subida; 14 dias antes', () => {
    const f = faixasDaSubida('2026-10-10')
    expect(f.subida.dias).toHaveLength(7)
    expect(f.subida.dias[0]).toBe('2026-10-11')
    expect(f.antes.dias).toHaveLength(14)
    expect(f.antes.dias[13]).toBe('2026-10-09')
  })
  it('mais de 6 mudanças vira traço curto; marcas a menos de 26 px viram ×N', () => {
    expect(modoDasLinhas(6)).toBe('atravessa')
    expect(modoDasLinhas(14)).toBe('traco_curto')
    const g = agruparMarcas([{ x: 10, raia: 'title' as const }, { x: 20, raia: 'title' as const }, { x: 90, raia: 'title' as const }])
    expect(g).toHaveLength(2)
    expect(g[0]!.n).toBe(2)
    expect(g[0]!.rotulo).toBe('×2')
  })
  it('contagem parada vira divisa entre os dois dias; campos viram raias', () => {
    expect(posicaoDaMudanca({ dia: '2026-10-12', diaDe: '2026-10-10', precisao: 'parada', tardia: false })).toEqual({ tipo: 'divisa', depoisDe: '2026-10-10', antesDe: '2026-10-12' })
    expect(raiaDoCampo('titulo')).toBe('title')
    expect(raiaDoCampo('tags')).toBe('outras')
  })
})

describe('E5a T20, dias: a leitura por hora não é dia de contagem (portão Phil I3)', () => {
  const H = 3_600_000
  const PUB = Date.UTC(2026, 9, 20, 18, 0, 0) // 20/10 15:00 de São Paulo
  const horarias = Array.from({ length: 72 }, (_, i) => ({ t: PUB + (i + 1) * H, views: (i + 1) * 1000, likes: null, comments: null, porHora: true as const }))
  const diarias = [21, 22, 23, 24].map((d) => ({ t: Date.UTC(2026, 9, d, 15, 0, 0), views: (d - 20) * 24_000 - 3000, likes: null, comments: null }))
  const agora = Date.UTC(2026, 9, 25, 16, 0, 0)

  it('publicado às 15:00 com leituras por hora: o dia da publicação diz "sem contagem das 12:00", e 23/10 e 24/10 têm 24.000', () => {
    const b = barrasPorDia({ leituras: [...horarias, ...diarias], publicadoEmMs: PUB, agoraMs: agora, saiuEm: null })
    const pub = b.find((x) => x.tipo === 'pub')!
    expect(pub.ganho).toBeNull()
    expect(pub.fala).toContain('sem leitura das 12:00')
    expect(b.find((x) => x.dia === '2026-10-23')).toMatchObject({ tipo: 'com', ganho: 24_000 })
    expect(b.find((x) => x.dia === '2026-10-24')).toMatchObject({ tipo: 'com', ganho: 24_000 })
  })
})
