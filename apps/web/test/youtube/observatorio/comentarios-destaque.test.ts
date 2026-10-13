// @vitest-environment node
// A5 · E14, Tarefa 4: quem é consultado, quem é de destaque e as faixas.
import { describe, expect, it } from 'vitest'
import { quemConsultar, inscritosDe, destaqueDe, desconhecidos } from '@/lib/youtube/observatorio/comentarios/destaque'
import { COMMENT_RULES } from '@/lib/youtube/observatorio/comentarios/regras'
import type { Conversa } from '@/lib/youtube/observatorio/comentarios/tipos'
import {
  T0, H, iso, canal, CANAL_DO_VIDEO, CANAL_ACOMPANHADO, CANAL_DO_DONO,
  conversa, resposta, corpoDeConversas, canalComInscritos, corpoDeCanais,
} from './comentarios-fixtures'
import { loteDe } from '@/lib/youtube/observatorio/comentarios/normalizar'

const ROW_ACOMPANHADO = 'linha-acompanhado-01'
const acompanhados = new Map([[CANAL_ACOMPANHADO, ROW_ACOMPANHADO]])
const proprios = new Set([CANAL_DO_DONO])

const lote = (itens: unknown[]): Conversa[] => loteDe(corpoDeConversas(itens), CANAL_DO_VIDEO)!.conversas
const um = (o: Parameters<typeof conversa>[1] = {}, n = 1): Conversa => lote([conversa(n, o)])[0]!
const ctx = (inscritosDoCanalDoVideo: number | null, inscritos: Map<string, number | null> | null) =>
  ({ canalDoVideo: CANAL_DO_VIDEO, acompanhados, proprios, inscritosDoCanalDoVideo, inscritos })
const GRANDE = canal(500)
const doGrande = (inscritos: number | null, videoSubs: number | null = 10_000): ReturnType<typeof destaqueDe> =>
  destaqueDe(um({ canalId: GRANDE }), ctx(videoSubs, new Map([[GRANDE, inscritos]])))

describe('destaqueDe: faixas e bordas', () => {
  it('1. 99.999 inscritos: não é destaque', () => {
    expect(doGrande(99_999, 1)).toBeNull()
  })
  it('2. 100.000 e razão 9,9: não é', () => {
    expect(doGrande(100_000, 10_100)).toBeNull() // 100000/10100 = 9,9
  })
  it('3. 100.000 e razão 10: é, faixas 100k_1m e 10x_100x', () => {
    expect(doGrande(100_000, 10_000)).toEqual({ motivo: 'inscritos', canalRowId: null, faixaTamanho: '100k_1m', faixaRazao: '10x_100x' })
  })
  it('4. bordas das faixas', () => {
    expect(doGrande(999_999, 10_000)?.faixaTamanho).toBe('100k_1m')
    expect(doGrande(1_000_000, 10_000)?.faixaTamanho).toBe('1m_10m')
    expect(doGrande(10_000_000, 10_000)?.faixaTamanho).toBe('10m_mais')
    expect(doGrande(1_000_000, 10_000)?.faixaRazao).toBe('100x_1000x') // razão 100
    expect(doGrande(1_000_000, 1_000)?.faixaRazao).toBe('1000x_mais') // razão 1.000
    expect(doGrande(999_999, 10_000)?.faixaRazao).toBe('10x_100x') // 99,99
    expect(doGrande(1_000_000, 1_001)?.faixaRazao).toBe('100x_1000x') // 999
  })
  it('5. inscritos ocultos: não é destaque e conta em desconhecidos', () => {
    const mapa = new Map<string, number | null>([[GRANDE, null]])
    expect(destaqueDe(um({ canalId: GRANDE }), ctx(10_000, mapa))).toBeNull()
    expect(desconhecidos([GRANDE], mapa)).toBe(1)
  })
  it('7. canal do vídeo com inscritos nulos, e com 0: vale só o piso, faixa da razão nula', () => {
    for (const v of [null, 0]) {
      expect(doGrande(100_000, v)).toEqual({ motivo: 'inscritos', canalRowId: null, faixaTamanho: '100k_1m', faixaRazao: null })
      expect(doGrande(99_999, v)).toBeNull()
    }
  })
  it('autor sem canalId, ou que a consulta não devolveu, não é destaque', () => {
    expect(destaqueDe(um({ canalId: 'sem-chave' }), ctx(10_000, new Map()))).toBeNull()
    expect(destaqueDe(um({ canalId: GRANDE }), ctx(10_000, new Map()))).toBeNull()
  })
})

describe('destaqueDe: canal acompanhado e do dono', () => {
  it('8. canal acompanhado ganha de canal grande', () => {
    const d = destaqueDe(um({ canalId: CANAL_ACOMPANHADO }), ctx(10_000, new Map([[CANAL_ACOMPANHADO, 5_000_000]])))
    expect(d).toEqual({ motivo: 'canal_acompanhado', canalRowId: ROW_ACOMPANHADO, faixaTamanho: null, faixaRazao: null })
  })
  it('9. canal acompanhado numa resposta vista marca o comentário de topo', () => {
    const pai = 'Ugx-sintetico-01'
    const c = um({ canalId: canal(600), totalReplyCount: 1, respostas: [resposta(pai, 1, { canalId: CANAL_ACOMPANHADO })] })
    expect(destaqueDe(c, ctx(10_000, null))).toEqual({ motivo: 'canal_acompanhado', canalRowId: ROW_ACOMPANHADO, faixaTamanho: null, faixaRazao: null })
  })
  it('se o autor e uma resposta são acompanhados, vale o do comentário', () => {
    const outro = canal(700)
    const pai = 'Ugx-sintetico-01'
    const ac = new Map([[CANAL_ACOMPANHADO, ROW_ACOMPANHADO], [outro, 'linha-outro']])
    const c = um({ canalId: outro, totalReplyCount: 1, respostas: [resposta(pai, 1, { canalId: CANAL_ACOMPANHADO })] })
    expect(destaqueDe(c, { ...ctx(10_000, null), acompanhados: ac })?.canalRowId).toBe('linha-outro')
  })
  it('10. autor é canal do dono: canal_proprio, sem canalRowId', () => {
    expect(destaqueDe(um({ canalId: CANAL_DO_DONO }), ctx(10_000, null))).toEqual({ motivo: 'canal_proprio', canalRowId: null, faixaTamanho: null, faixaRazao: null })
  })
  it('o criador nunca é destaque: nem o comentário dele, nem a resposta dele (o canal do vídeo é acompanhado)', () => {
    const ac = new Map([[CANAL_DO_VIDEO, 'linha-criador'], [CANAL_ACOMPANHADO, ROW_ACOMPANHADO]])
    const base = { ...ctx(10_000, new Map([[CANAL_DO_VIDEO, 9_000_000]])), acompanhados: ac }
    expect(destaqueDe(um({ canalId: CANAL_DO_VIDEO }), base)).toBeNull()
    const pai = 'Ugx-sintetico-01'
    const c = um({ canalId: canal(601), totalReplyCount: 1, respostas: [resposta(pai, 1, { canalId: CANAL_DO_VIDEO })] })
    expect(destaqueDe(c, base)).toBeNull()
  })
  it('11. consulta falhou (mapa nulo): ninguém por tamanho; os de (a) continuam', () => {
    expect(destaqueDe(um({ canalId: GRANDE }), ctx(10_000, null))).toBeNull()
    expect(destaqueDe(um({ canalId: CANAL_ACOMPANHADO }), ctx(10_000, null))?.motivo).toBe('canal_acompanhado')
    expect(destaqueDe(um({ canalId: CANAL_DO_DONO }), ctx(10_000, null))?.motivo).toBe('canal_proprio')
  })
})

describe('quemConsultar', () => {
  it('6. autor sem id: não consultado e conta em semId', () => {
    const cs = lote([conversa(1, { canalId: 'sem-chave', curtidas: 9 }), conversa(2, { canalId: canal(801), curtidas: 8 })])
    expect(quemConsultar(cs, { canalDoVideo: CANAL_DO_VIDEO, acompanhados, proprios })).toEqual({ ids: [canal(801)], semId: 1 })
  })
  it('12. no máximo 20 (os mais curtidos), sem o criador, sem acompanhados, sem os do dono, sem repetir', () => {
    const itens = [
      conversa(1, { curtidas: 1000, canalId: CANAL_DO_VIDEO }),
      conversa(2, { curtidas: 999, canalId: CANAL_ACOMPANHADO }),
      conversa(3, { curtidas: 998, canalId: CANAL_DO_DONO }),
      conversa(4, { curtidas: 997, canalId: canal(901) }),
      conversa(5, { curtidas: 996, canalId: canal(901) }),
      ...Array.from({ length: 30 }, (_, i) => conversa(10 + i, { curtidas: 500 - i, canalId: canal(1000 + i) })),
    ]
    const r = quemConsultar(lote(itens), { canalDoVideo: CANAL_DO_VIDEO, acompanhados, proprios })
    // dos 20 mais curtidos: 5 especiais + 15 comuns (do 1000 ao 1014); o 901 repetido conta uma vez
    expect(r.ids).toEqual([canal(901), ...Array.from({ length: 15 }, (_, i) => canal(1000 + i))])
    expect(r.ids).not.toContain(CANAL_DO_VIDEO)
    expect(r.ids).not.toContain(CANAL_ACOMPANHADO)
    expect(r.ids).not.toContain(CANAL_DO_DONO)
    expect(new Set(r.ids).size).toBe(r.ids.length)
    expect(r.semId).toBe(0)
  })
  it('semId só olha os 20 mais curtidos', () => {
    const itens = [
      ...Array.from({ length: COMMENT_RULES.featuredLookup }, (_, i) => conversa(i + 1, { curtidas: 100 - i, canalId: canal(1100 + i) })),
      conversa(50, { curtidas: 1, canalId: 'sem-chave' }),
    ]
    const r = quemConsultar(lote(itens), { canalDoVideo: CANAL_DO_VIDEO, acompanhados, proprios })
    expect(r.ids).toHaveLength(20)
    expect(r.semId).toBe(0)
  })
})

describe('inscritosDe', () => {
  it('lê inscritos como texto ou número; ocultos e sem contagem viram nulo', () => {
    const body = corpoDeCanais([
      canalComInscritos('a', { inscritos: 123_456 }),
      canalComInscritos('b', { ocultos: true }),
      canalComInscritos('c', { inscritos: 'sem-chave' }),
      { id: 'd', statistics: { subscriberCount: 7 } },
    ], 4)
    const m = inscritosDe(body, ['a', 'b', 'c', 'd'])!
    expect([...m.entries()]).toEqual([['a', 123_456], ['b', null], ['c', null], ['d', 7]])
  })
  it('sem items e totalResults 0: mapa vazio (o YouTube omite items quando nenhum id existe)', () => {
    expect(inscritosDe(corpoDeCanais(undefined, 0), ['a'])!.size).toBe(0)
  })
  it('sem items e totalResults diferente de 0 ou ausente, ou corpo que não é objeto: nulo', () => {
    expect(inscritosDe(corpoDeCanais(undefined, 3), ['a'])).toBeNull()
    expect(inscritosDe(corpoDeCanais(undefined), ['a'])).toBeNull()
    expect(inscritosDe({ items: 'x' }, ['a'])).toBeNull()
    expect(inscritosDe(null, ['a'])).toBeNull()
    expect(inscritosDe('x', ['a'])).toBeNull()
  })
  it('só devolve ids que foram pedidos', () => {
    const m = inscritosDe(corpoDeCanais([canalComInscritos('a', { inscritos: 1 }), canalComInscritos('z', { inscritos: 2 })], 2), ['a'])!
    expect([...m.keys()]).toEqual(['a'])
  })
})

describe('desconhecidos', () => {
  it('13. canal devolvido a menos conta em desconhecidos; oculto também; conhecido não', () => {
    const m = new Map<string, number | null>([['a', 5], ['b', null]])
    expect(desconhecidos(['a', 'b', 'c'], m)).toBe(2)
  })
  it('consulta que falhou (mapa nulo): todos os consultados são desconhecidos; ninguém consultado: 0', () => {
    expect(desconhecidos(['a', 'b'], null)).toBe(2)
    expect(desconhecidos([], null)).toBe(0)
  })
})

describe('saída', () => {
  it('14. nenhum número de inscritos nem razão exata na saída', () => {
    const d = doGrande(437_000_000, 12_345)
    expect(d).not.toBeNull()
    const json = JSON.stringify(d)
    expect(json).not.toContain('437000000')
    expect(json).not.toContain('12345')
    for (const v of Object.values(d!)) expect(typeof v === 'number').toBe(false)
    expect(Object.keys(d!).sort()).toEqual(['canalRowId', 'faixaRazao', 'faixaTamanho', 'motivo'])
  })
  it('fixture de tempo usa o T0 relativo (sanidade do próprio teste)', () => {
    expect(iso(T0 + H)).toBe(new Date(T0 + H).toISOString())
  })
})
