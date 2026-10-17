// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  blocoDeHoras, nivelDosRotulos, primeiraHoraCheia, type BlocoDeHorasOk, type EntradaDeHoras,
} from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/horas-model'
import type { LeituraPorHora } from '@/lib/youtube/observatorio/medidas-telas/ler-horas'

const H = 3_600_000
// publicado qui 08/10 20:40 em São Paulo (23:40 UTC); a primeira hora cheia é 21:00 (00:00 UTC)
const PUB = Date.UTC(2026, 9, 8, 23, 40)
const E1 = primeiraHoraCheia(PUB)
const leitura = (lidaEmMs: number, views: number): LeituraPorHora => ({ horaMs: Math.floor(lidaEmMs / H) * H, lidaEmMs, views, likes: null, comments: null })
/** Uma leitura por hora cheia, de `de` a `ate` (índices de hora desde E1), com 100 views por hora. */
const seguidas = (de: number, ate: number, ganho = 100): LeituraPorHora[] =>
  Array.from({ length: ate - de + 1 }, (_, i) => leitura(E1 + (de + i) * H, 1000 + (de + i) * ganho))
const ent = (o: Partial<EntradaDeHoras>): EntradaDeHoras => ({
  agoraMs: PUB + 80 * H, publicadoEmMs: PUB, descobertoEmMs: PUB + 20 * 60_000, aoVivo: false, viewsAgora: 8000,
  horas: { primeiraHoraDoSiteMs: PUB - 24 * H, ultimoOkDaTarefaMs: PUB + 79 * H, primeiraExecucaoDaTarefaMs: PUB - 24 * H },
  leituras: seguidas(0, 72), toleranciaH: 3, normal: null, contagemPorDiaDesde: '2026-10-03', ...o,
})
const ok = (o: Partial<EntradaDeHoras>): BlocoDeHorasOk => {
  const b = blocoDeHoras(ent(o))
  if (b.tipo !== 'ok') throw new Error(`esperava ok, veio ${b.tipo}`)
  return b
}

describe('E5a T20, horas', () => {
  it('nivelDosRotulos: rótulos que se tocam descem para a segunda linha', () => {
    expect(nivelDosRotulos([0, 10, 200], 40)).toEqual([0, 1, 0])
    expect(nivelDosRotulos([0], 40)).toEqual([0])
  })

  it('72 leituras seguidas, cada uma uma hora depois da anterior: 72 barras, sem salto na meia-noite e sem hora sem barra', () => {
    const b = ok({})
    expect(b.barras).toHaveLength(72)
    expect(b.barras.map((x) => x.j)).toEqual(Array.from({ length: 72 }, (_, i) => i + 1))
    for (let i = 1; i < 72; i++) expect(b.barras[i]!.deMs).toBe(b.barras[i - 1]!.ateMs)
    expect(b.horasSemBarra).toBe(0)
    expect(b.horasFinaisSemContagem).toBe(0)
    // a barra das 23:00 às 00:00 leva a data do dia que termina; a seguinte, a do novo dia
    const meiaNoite = b.barras.find((x) => x.intervalo === '23:00 a 00:00')!
    expect(meiaNoite.data).toBe('qui 08/10'.replace('08', '08'))
    expect(b.barras[b.barras.indexOf(meiaNoite) + 1]!.data).toBe('sex 09/10')
    // medida só de intervalo limpo
    expect(b.barras.slice(1).every((x) => x.tipo === 'medido' && x.ganho === 100)).toBe(true)
  })

  it('a primeira barra vai da publicação à hora cheia', () => {
    const b = ok({})
    expect(b.barras[0]!.deMs).toBe(PUB)
    expect(b.barras[0]!.ateMs).toBe(E1)
    expect(b.barras[0]!.intervalo).toBe('20:40 a 21:00')
    expect(b.barras[0]!.xDe).toBe(0)
    expect(b.barras[1]!.xAte - b.barras[1]!.xDe).toBe(1)
  })

  it('47 das 68 horas medidas: as horas não medidas saem do denominador da frase e a soma fecha', () => {
    // 21 horas sem leitura no meio; nas 47 horas medidas depois da primeira contagem, 30 sem nenhuma view (zero medido)
    const base = [...seguidas(0, 10), ...seguidas(32, 72)]
    const leituras = base.map((l, i) => (i > 11 ? { ...l, views: base[11]!.views } : l))
    const b = ok({ leituras })
    expect(b.zeros).toBeGreaterThan(0)
    expect(b.medidas).toBe(b.barras.filter((x) => x.tipo === 'medido' || x.tipo === 'zero').length)
    // 72 barras = 1 antes da primeira contagem + medidas + diminuiu + não medidas com leitura depois
    const antes = b.barras.filter((x) => x.motivo === 'antes_da_primeira_contagem').length
    expect(antes).toBe(1)
    expect(b.medidas + b.horasQueDiminuiram + b.horasSemBarra + b.horasFinaisSemContagem + antes).toBeGreaterThanOrEqual(72)
    // o denominador da frase é só o das horas medidas, nunca as 72 nem as que ficaram sem barra
    expect(b.frase).toContain(`das ${b.medidas} horas medidas`)
    expect(b.frasesDasHoras.join(' ')).toContain('sem barra')
  })

  it('a linha de 1/2 fica no fim da barra em que a contagem chegou à metade, e a régua arredonda para a hora', () => {
    const b = ok({})
    const total = b.total.tipo === 'medido' ? b.total.views : 0
    const barra = b.barras.find((x) => (x.acumulado ?? 0) >= total / 2)!
    expect(b.linhaDaMetade).not.toBeNull()
    expect(b.linhaDaMetade!.x).toBe(barra.xAte)
    expect(b.linhaDaMetade!.horas).toBe(Math.round(barra.xAte))
  })

  it('ponta vazia: total em hachura, nenhuma linha de 1/2 e nenhuma frase "o ganho delas está no total"', () => {
    const b = ok({ leituras: seguidas(0, 50), agoraMs: PUB + 80 * H })
    expect(b.total.tipo).toBe('nao_medido')
    expect(b.linhaDaMetade).toBeNull()
    expect(b.frasesDasHoras.join(' ')).not.toContain('o ganho delas está no total')
  })

  it('vídeo com menos de 72 horas e horas passadas sem contagem no fim: o total é "ainda não existe"', () => {
    const b = ok({ leituras: seguidas(0, 20), agoraMs: PUB + 30 * H })
    expect(b.total.tipo).toBe('ainda_nao_existe')
    expect(b.barras.filter((x) => x.tipo === 'ainda_nao_existe').length).toBeGreaterThan(0)
  })

  it('coerência: na vista limpa o total é a soma das barras mais a primeira contagem; views por idade nunca decrescem; 1/4 antes de 1/2 antes de 3/4', () => {
    const b = ok({})
    const soma = b.barras.reduce((a, x) => a + (x.ganho ?? 0), 0)
    expect(b.total.tipo).toBe('medido')
    if (b.total.tipo === 'medido') expect(b.total.views).toBe(soma + b.primeiraContagem!.views)
    const acum = b.barras.map((x) => x.acumulado).filter((x): x is number => x !== null)
    expect(acum).toEqual([...acum].sort((x, y) => x - y))
    const hs = b.regua.video.map((m) => m.horas)
    expect(hs.every((h) => h !== null)).toBe(true)
    expect(hs[0]!).toBeLessThanOrEqual(hs[1]!)
    expect(hs[1]!).toBeLessThanOrEqual(hs[2]!)
  })

  it('dado ausente: leitura por hora não lida é "não carregou", nunca zero', () => {
    const b = blocoDeHoras(ent({ horas: null }))
    expect(b.tipo).toBe('nao_carregou')
  })
})
