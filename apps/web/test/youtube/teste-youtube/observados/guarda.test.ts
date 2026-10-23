// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ehPlaceholder, inferirComGuarda, titulosSuspensos, type ConferirVersoes } from '@/lib/youtube/teste-youtube/observados/guarda'
import type { EntradaObs, LeituraObs, VersaoParaConferir } from '@/lib/youtube/teste-youtube/observados/inferir'
import { normalizarTitulo } from '@/lib/youtube/teste-youtube/normalizar-titulo'
import { agoraEm, leitura, PUB, rodadas } from './fabrica'

const ach = (...ids: string[]) => ids.map(ytId => ({ ytId }))
const semCanal = (): string | null => null

describe('ehPlaceholder', () => {
  const mesmo = { canalDoAlvo: 'c1', canalDe: () => 'c1', bateuTeto: false }
  it('Lolzin: 1 outro vídeo do mesmo canal não é placeholder', () => {
    expect(ehPlaceholder(ach('v2'), mesmo)).toBe(false)
  })
  it('2 outros vídeos do mesmo canal são', () => {
    expect(ehPlaceholder(ach('v2', 'v3'), mesmo)).toBe(true)
  })
  it('1 vídeo de outro canal é', () => {
    expect(ehPlaceholder(ach('v2'), { ...mesmo, canalDe: () => 'c2' })).toBe(true)
  })
  it('achados repetidos do mesmo vídeo contam uma vez; só o teto muda isso', () => {
    const muitos = ach(...Array.from({ length: 1500 }, () => 'v2'))
    expect(ehPlaceholder(muitos, mesmo)).toBe(false)
    expect(ehPlaceholder([...muitos, ...ach('v3')], { ...mesmo, bateuTeto: true })).toBe(true)
    expect(ehPlaceholder(muitos, { ...mesmo, bateuTeto: true })).toBe(true)
  })
  it('D-P8: canal nulo dos dois lados = desconhecido (1 achado não basta, 2 bastam)', () => {
    const o = { canalDoAlvo: null, canalDe: semCanal, bateuTeto: false }
    expect(ehPlaceholder(ach('v2'), o)).toBe(false)
    expect(ehPlaceholder(ach('v2', 'v3'), o)).toBe(true)
  })
  it('D-P8: canal nulo de um lado só = canal diferente (suspende)', () => {
    expect(ehPlaceholder(ach('v2'), { canalDoAlvo: 'c1', canalDe: semCanal, bateuTeto: false })).toBe(true)
    expect(ehPlaceholder(ach('v2'), { canalDoAlvo: null, canalDe: () => 'c1', bateuTeto: false })).toBe(true)
  })
  it('sem achado nenhum não é placeholder', () => {
    expect(ehPlaceholder([], mesmo)).toBe(false)
  })
})

const chave = (t: string): string => normalizarTitulo(t)
const P = 'Titulo P'
const R = 'Titulo R'
const porLetra = (m: Record<string, string>) => (l: string): Partial<LeituraObs> => ({ tituloExibido: m[l]! })

/** 8 rodadas só de R e 8 com P alternando com R em 5 delas (teste aparente). */
function placeholderAlternando(): LeituraObs[] {
  return [
    ...rodadas(30, Array(8).fill('RRR') as string[], porLetra({ R })),
    ...rodadas(78, ['PRR', 'RPR', 'PRR', 'RPR', 'PRR', 'RRR', 'RRR', 'RRR'], porLetra({ P, R })),
  ]
}
const entrada = (leituras: LeituraObs[], agoraH: number): EntradaObs =>
  ({ leituras, thumbsPorId: new Map(), publicadoEm: PUB, agoraMs: agoraEm(agoraH) })

describe('inferirComGuarda', () => {
  it('placeholder alternando com o título real: 1ª saída é teste com P; P suspenso; 2ª regra dá sem_troca_vista (iteracoes = conferências) sem observado de título', async () => {
    const e = entrada(placeholderAlternando(), 124)
    const chamadas: VersaoParaConferir[][] = []
    const conferir: ConferirVersoes = async vs => { chamadas.push([...vs]); return new Set(vs.filter(v => v.chave === chave(P)).map(v => v.chave)) }
    const g = await inferirComGuarda(e, conferir)
    expect(chamadas[0]!.map(v => v.chave).sort()).toEqual([chave(P), chave(R)].sort())
    expect(g.suspensos).toEqual(new Set([chave(P)]))
    expect(g.estourou).toBe(false)
    expect(g.r.estadoTitulo).toBe('sem_troca_vista')
    expect(g.r.observados.filter(o => o.campo === 'titulo')).toHaveLength(0)
    expect(g.iteracoes).toBe(1)
  })

  it('sem guarda o mesmo caso sai como teste (a guarda é que o impede)', async () => {
    const g = await inferirComGuarda(entrada(placeholderAlternando(), 124), async () => new Set())
    expect(g.r.estadoTitulo).toBe('em_andamento')
    expect(g.r.observados.some(o => o.campo === 'titulo')).toBe(true)
    expect(g.suspensos.size).toBe(0)
  })

  it('sem linha de título a emitir não confere nada', async () => {
    let n = 0
    const g = await inferirComGuarda(entrada(rodadas(30, Array(8).fill('RRR') as string[], porLetra({ R })), 80), async () => { n++; return new Set() })
    expect(n).toBe(0)
    expect(g.r.observados).toHaveLength(0)
  })

  it('cada versão é conferida uma vez; a re-execução com versão nova chama conferir só com a nova', async () => {
    // pt (4/rodada: P,P,R,R) vence en (3/rodada: E1,E2,E1) até P ser suspenso; sem P, pt cai a 2 e en vira a maioria.
    const itens = Array(8).fill('PPRR') as string[]
    const pt = rodadas(30, itens, porLetra({ P, R }))
    const en = rodadas(30, Array(8).fill('abc') as string[], l => ({ idioma: 'en', tituloExibido: ({ a: 'Title E1', b: 'Title E2', c: 'Title E1' } as Record<string, string>)[l]! }))
    const ls = [...pt, ...en]
    const chamadas: string[][] = []
    const conferir: ConferirVersoes = async vs => { chamadas.push(vs.map(v => v.chave).sort()); return new Set(vs.filter(v => v.chave === chave(P)).map(v => v.chave)) }
    const g = await inferirComGuarda(entrada(ls, 76), conferir)
    expect(chamadas).toEqual([[chave(P), chave(R)].sort(), [chave('Title E1'), chave('Title E2')].sort()])
    expect(g.suspensos).toEqual(new Set([chave(P)]))
    expect(g.estourou).toBe(false)
    expect(g.iteracoes).toBe(2)
  })

  it('estoura em 3 iterações: estourou, 0 observados de título, validasTitulo 0', async () => {
    // idiomas em cadência decrescente: cada suspensão devolve a maioria ao próximo idioma, com versões novas
    const lang = (nome: string, itens: string, h0 = 30) => rodadas(h0, Array(8).fill(itens) as string[], l => ({ idioma: nome, tituloExibido: `${nome} ${l}` }))
    const ls = [...lang('l1', 'aabab'), ...lang('l2', 'abab'), ...lang('l3', 'aba'), ...lang('l4', 'ab')]
    let n = 0
    const conferir: ConferirVersoes = async vs => { n++; return new Set(vs.map(v => v.chave)) }
    const g = await inferirComGuarda(entrada(ls, 76), conferir)
    expect(n).toBe(3)
    expect(g.estourou).toBe(true)
    expect(g.iteracoes).toBe(3)
    expect(g.r.observados.filter(o => o.campo === 'titulo')).toHaveLength(0)
    expect(g.r.validasTitulo).toBe(0)
  })

  it('foco 2: a versão chega a conferir com os dois textos brutos (NFC e NFD)', async () => {
    const nfc = 'Título'.normalize('NFC')
    const nfd = 'Título'.normalize('NFD')
    expect(nfc).not.toBe(nfd)
    const ls = rodadas(30, ['abc', 'bca', 'cab', 'abc', 'bca', 'cab', 'abc', 'bca'], l => ({ tituloExibido: ({ a: nfc, b: nfd, c: 'Outro' } as Record<string, string>)[l]! }))
    const chamadas: VersaoParaConferir[][] = []
    await inferirComGuarda(entrada(ls, 76), async vs => { chamadas.push([...vs]); return new Set() })
    const v = chamadas[0]!.find(x => x.chave === chave(nfc))!
    expect([...v.brutos].sort()).toEqual([nfc, nfd].sort())
  })

  it('erro do conferir propaga (nunca vira "sem achado")', async () => {
    await expect(inferirComGuarda(entrada(placeholderAlternando(), 124), async () => { throw new Error('guarda') })).rejects.toThrow('guarda')
  })
})

describe('titulosSuspensos', () => {
  const l = (t: string, o: Partial<LeituraObs> = {}) => leitura(1, { tituloExibido: t, ...o })
  it('o mesmo título em 3 vídeos de 1 canal: suspenso', () => {
    expect(titulosSuspensos(['v1', 'v2', 'v3'].map(ytId => ({ ytId, canal: 'c1', leitura: l('Repetido') })))).toEqual([chave('Repetido')])
  })
  it('em 2 vídeos de 2 canais: suspenso; em 2 vídeos de 1 canal: não', () => {
    expect(titulosSuspensos([{ ytId: 'v1', canal: 'c1', leitura: l('X') }, { ytId: 'v2', canal: 'c2', leitura: l('X') }])).toEqual([chave('X')])
    expect(titulosSuspensos([{ ytId: 'v1', canal: 'c1', leitura: l('X') }, { ytId: 'v2', canal: 'c1', leitura: l('X') }])).toEqual([])
  })
  it('canal nulo conta como canal distinto (de qualquer outro e de outro nulo)', () => {
    expect(titulosSuspensos([{ ytId: 'v1', canal: null, leitura: l('X') }, { ytId: 'v2', canal: null, leitura: l('X') }])).toEqual([chave('X')])
    expect(titulosSuspensos([{ ytId: 'v1', canal: null, leitura: l('X') }, { ytId: 'v2', canal: 'c1', leitura: l('X') }])).toEqual([chave('X')])
  })
  it('o mesmo vídeo muitas vezes conta uma vez', () => {
    expect(titulosSuspensos(Array.from({ length: 10 }, () => ({ ytId: 'v1', canal: 'c1', leitura: l('X') })))).toEqual([])
  })
  it('leitura inválida (erro, http, sem idioma) com título fixo em 3 vídeos não conta', () => {
    for (const o of [{ erro: 'redirecionado' }, { http: 429 }, { idioma: null }] as Partial<LeituraObs>[]) {
      expect(titulosSuspensos(['v1', 'v2', 'v3'].map(ytId => ({ ytId, canal: 'c1', leitura: l('Repetido', o) })))).toEqual([])
    }
  })
})
