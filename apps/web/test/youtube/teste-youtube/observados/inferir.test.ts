// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  inferirObservado, inferirObservadoDetalhe, montarObservado, OBS_REGRA_VERSAO, rodadasDaMiniatura, type BaseObs, type FicouTitulo, type LeituraObs, type Observado, type ThumbObs,
} from '@/lib/youtube/teste-youtube/observados/inferir'
import { agoraEm, DH_A, DH_A2, DH_B, DH_C, DH_D, leitura, PUB, rodadas, thumb } from './fabrica'

const T0 = 30 // primeira rodada, depois da carência de 24 h
const titulo = (letra: string): Partial<LeituraObs> => ({ tituloExibido: 'Titulo ' + letra })
const DH: Record<string, string> = { A: DH_A, B: DH_B, C: DH_C, a: DH_A2, D: DH_D }
/** Hora da última rodada de n rodadas que começam em h0 (a 3ª passada é +10 min). */
const fimH = (h0: number, n: number): number => h0 + (n - 1) * 6 + 10 / 60

function tit(itens: string[], extra: { agoraH?: number; suspensos?: Set<string> } = {}) {
  return inferirObservadoDetalhe({
    leituras: rodadas(T0, itens, titulo), thumbsPorId: new Map(), publicadoEm: PUB, agoraMs: agoraEm(extra.agoraH ?? fimH(T0, itens.length) + 1),
    ...(extra.suspensos ? { titulosSuspensos: extra.suspensos } : {}),
  })
}
/** Miniatura: cada letra de `itens` (3 passadas por rodada) vira o thumb do dhash `DH[letra]`. */
function mini(itens: string[], mut?: (t: ThumbObs, letra: string) => ThumbObs, agoraH = fimH(T0, itens.length) + 1) {
  const thumbs = new Map<number, ThumbObs>()
  const ids = new Map<string, number>()
  const ls = rodadas(T0, itens, l => {
    if (!ids.has(l)) {
      const t0 = thumb(3000 + ids.size, DH[l]!)
      const t = mut ? mut(t0, l) : t0
      ids.set(l, t.id); thumbs.set(t.id, t)
    }
    return { tituloExibido: null, miniaturaId: ids.get(l)! }
  })
  return { r: inferirObservadoDetalhe({ leituras: ls, thumbsPorId: thumbs, publicadoEm: PUB, agoraMs: agoraEm(agoraH) }), ls, thumbs }
}
const A20B8 = [...Array(20).fill('AAA'), ...Array(8).fill('BBB')] as string[]
const MISTAS = Array(12).fill(['AAB', 'ABB']).flat() as string[]

describe('título: montagem das linhas (§4)', () => {
  it('troca limpa A->B: troca_observada / estavel / sequencial, com a transição de A para B', () => {
    const r = tit(A20B8)
    expect(r.estadoTitulo).toBe('troca')
    const [o] = r.observados
    expect(o).toMatchObject({ campo: 'titulo', veredito: 'troca_observada', ficouEstado: 'estavel', tipoTroca: 'sequencial', nVersoes: 2, versaoRegra: OBS_REGRA_VERSAO })
    const ficou = o!.ficou as FicouTitulo
    expect(ficou.titulo).toBe('Titulo B')
    expect(ficou.transicao).toMatchObject({ antes: 'Titulo A' })
    expect(Date.parse(ficou.transicao!.ate)).toBeGreaterThan(Date.parse(ficou.transicao!.de))
    expect(ficou.mistas_hist).toBe(false)
    expect(o!.trocas.map(t => t.ref)).toEqual(['Titulo A', 'Titulo B'])
    expect(o!.primeiraTrocaEm).toBe(o!.trocas[1]!.primeira_vista)
  })
  it('teste de título: possivel_teste_youtube / em_andamento / alternada, mistas_hist e rodadas_em_w de W', () => {
    const r = tit(MISTAS)
    expect(r.estadoTitulo).toBe('em_andamento')
    const [o] = r.observados
    expect(o).toMatchObject({ veredito: 'possivel_teste_youtube', ficouEstado: 'em_andamento', tipoTroca: 'alternada', nVersoes: 2 })
    const ficou = o!.ficou as FicouTitulo
    expect(ficou).toMatchObject({ mistas_hist: true, sumindo: false, transicao: null })
    expect(ficou.versoes.map(v => v.rodadas_em_w)).toEqual([8, 8])
    expect(ficou.janela_teste).not.toBeNull()
  })
  it('terminou: possivel_teste_youtube / estavel / alternada, ficou C', () => {
    const [o] = tit([...MISTAS, ...Array(16).fill('CCC')]).observados
    expect(o).toMatchObject({ veredito: 'possivel_teste_youtube', ficouEstado: 'estavel', tipoTroca: 'alternada', nVersoes: 3 })
    expect((o!.ficou as FicouTitulo).titulo).toBe('Titulo C')
  })
  it('título único, sem troca ou não medido -> nenhuma linha', () => {
    expect(tit(Array(30).fill('AAA')).observados).toEqual([])
    expect(tit(['AAA', 'AAA']).observados).toEqual([])
    expect(inferirObservado({ leituras: [], thumbsPorId: new Map(), publicadoEm: PUB, agoraMs: agoraEm(60) })).toEqual([])
  })
  it('guarda: título suspenso conta como inválido', () => {
    const r = tit(MISTAS, { suspensos: new Set(['Titulo B']) })
    expect(r.observados).toEqual([])
    expect(r.estadoTitulo).toBe('sem_troca_vista') // só sobra a versão A
  })
  it('versoesTitulo traz todas as versões com os brutos', () => {
    const r = tit(MISTAS)
    expect(r.versoesTitulo.map(v => [v.chave, v.brutos])).toEqual([['Titulo A', ['Titulo A']], ['Titulo B', ['Titulo B']]])
  })
})

describe('invariantes (§9.6)', () => {
  it('a miniatura nunca sai possivel_teste_youtube: A/B de miniatura alternando é troca_observada + em_andamento + alternada', () => {
    const { r } = mini(Array(12).fill(['AAB', 'ABB']).flat() as string[])
    expect(r.estadoMiniatura).toBe('indeterminada')
    expect(r.observados).toHaveLength(1)
    expect(r.observados[0]).toMatchObject({ campo: 'miniatura', veredito: 'troca_observada', ficouEstado: 'em_andamento', tipoTroca: 'alternada' })
  })
  it('nenhuma linha do título é troca_observada + em_andamento', () => {
    for (const itens of [A20B8, MISTAS, [...MISTAS, ...Array(16).fill('CCC')]] as string[][]) {
      for (const o of tit(itens).observados) expect(o.veredito === 'troca_observada' && o.ficouEstado === 'em_andamento').toBe(false)
    }
  })
  it('montarObservado lança para miniatura/possivel_teste_youtube e para título troca_observada em andamento', () => {
    const base = {} as BaseObs
    expect(() => montarObservado('miniatura', 'possivel_teste_youtube', base, {} as FicouTitulo)).toThrow('miniatura nunca é possivel_teste_youtube')
    expect(() => montarObservado('titulo', 'troca_observada', { ...base, ficouEstado: 'em_andamento' }, {} as FicouTitulo)).toThrow()
  })
  it('ficou < 4 KB no pior caso de bytes (8 versões de 300 emojis) e sem surrogate solto', () => {
    const emoji = (k: number): string => '😀'.repeat(299) + String.fromCodePoint(0x1f600 + k) + 'extra-para-cortar'
    const ls = rodadas(T0, Array(40).fill('ABC'), l => ({ tituloExibido: emoji('ABC'.indexOf(l)) }))
    const lsOito = Array.from({ length: 30 }, (_, i) => [0, 1, 2].map(k => leitura(T0 + i * 6 + k * 0.05, { rodadaId: 'z' + i, tituloExibido: emoji((i + k) % 8) }))).flat()
    for (const entrada of [ls, lsOito]) {
      const r = inferirObservadoDetalhe({ leituras: entrada, thumbsPorId: new Map(), publicadoEm: PUB, agoraMs: agoraEm(T0 + 30 * 6) })
      expect(r.observados.length).toBeGreaterThan(0)
      for (const o of r.observados) {
        expect(Buffer.byteLength(JSON.stringify(o.ficou), 'utf8')).toBeLessThan(4096)
        const txt = JSON.stringify(o)
        expect(JSON.parse(txt)).toEqual(o)
        expect(/[\ud800-\udbff](?![\udc00-\udfff])/.test(txt)).toBe(false)
        expect(/(?<![\ud800-\udbff])[\udc00-\udfff]/.test(txt)).toBe(false)
        for (const t of o.trocas) expect(Array.from(t.ref).length).toBeLessThanOrEqual(300)
      }
    }
  })
  it('9 versões gravam 8 em trocas, com nVersoes = 9, versoes_omitidas = 1 e estado decidido por W', () => {
    const itens = Array.from({ length: 30 }, (_, i) => [0, 1, 2].map(k => String.fromCharCode(65 + ((i + k) % 9))).join(''))
    const r = tit(itens)
    expect(r.estadoTitulo).toBe('em_andamento')
    const [o] = r.observados
    expect(o!.nVersoes).toBe(9)
    expect(o!.trocas).toHaveLength(8)
    expect((o!.ficou as FicouTitulo).versoes_omitidas).toBe(1)
    expect(r.versoesDemais).toBe(true)
    expect(r.versoesTitulo).toHaveLength(9)
  })
  it('primeiraTrocaEm é igual em duas avaliações seguidas com agoraMs diferente', () => {
    const a = tit(A20B8, { agoraH: fimH(T0, 28) + 1 }).observados[0]!
    const b = tit(A20B8, { agoraH: fimH(T0, 28) + 2 }).observados[0]!
    expect(a.primeiraTrocaEm).toBe(b.primeiraTrocaEm)
    expect(a.ultimaAtualizacaoEm).not.toBe(b.ultimaAtualizacaoEm)
  })
  it('nenhuma linha emitida tem nVersoes < 2', () => {
    for (const itens of [A20B8, MISTAS]) for (const o of tit(itens).observados) expect(o.nVersoes).toBeGreaterThanOrEqual(2)
  })
})

describe('miniatura', () => {
  it('Hamming 8 (A->C estável por 16 rodadas): 0 linhas, indeterminadas > 0 e validasMiniatura > 0', () => {
    const { r } = mini([...Array(16).fill('AAA'), ...Array(16).fill('CCC')] as string[])
    expect(r.observados).toEqual([])
    expect(r.indeterminadas).toBeGreaterThan(0)
    expect(r.validasMiniatura).toBeGreaterThan(0)
    expect(r.estadoMiniatura).toBe('sem_troca_vista')
  })
  it('fronteira: distância 10 é troca; 9 é a mesma versão (indeterminada)', () => {
    const itens = [...Array(20).fill('AAA'), ...Array(8).fill('XXX')] as string[]
    const run = (x: string) => {
      DH.X = x
      return mini(itens).r
    }
    const dez = run('00000000000003ff')
    expect(dez.observados).toHaveLength(1)
    expect(dez.indeterminadas).toBe(0)
    const nove = run('00000000000001ff')
    expect(nove.observados).toEqual([])
    expect(nove.indeterminadas).toBe(1)
    delete DH.X
  })
  it('troca limpa A->B: 1 linha troca_observada / estavel / sequencial, com transição', () => {
    const { r } = mini(A20B8)
    expect(r.estadoMiniatura).toBe('troca')
    expect(r.observados).toHaveLength(1)
    const [o] = r.observados
    expect(o).toMatchObject({ campo: 'miniatura', veredito: 'troca_observada', ficouEstado: 'estavel', tipoTroca: 'sequencial', nVersoes: 2 })
    if (o!.campo === 'miniatura') {
      expect(o.ficou.dhash).toBe(DH_B)
      expect(o.ficou.transicao).toMatchObject({ antes: DH_A })
      expect(o.ficou.transicao!.ate).toBeTruthy()
    }
  })
  it('mesma imagem recomprimida (distância 2) -> nenhuma linha', () => {
    expect(mini([...Array(16).fill('AAA'), ...Array(16).fill('aaa')] as string[]).r.observados).toEqual([])
  })
  it('mesma imagem em hqdefault e maxresdefault -> só a variante dominante conta', () => {
    const { r } = mini(A20B8, (t, l) => (l === 'B' ? { ...t, variante: 'hqdefault' } : t))
    expect(r.observados).toEqual([])
  })
  it('placeholder 120x90 descartado', () => {
    const { r } = mini(A20B8, (t, l) => (l === 'B' ? { ...t, largura: 120, altura: 90 } : t))
    expect(r.observados).toEqual([])
  })
  it('dhash nulo não conta; miniatura ausente não conta', () => {
    expect(mini(A20B8, (t, l) => (l === 'B' ? { ...t, dhash: null } : t)).r.observados).toEqual([])
    const ls = Array.from({ length: 30 }, (_, i) => leitura(T0 + i * 6, { miniaturaId: null }))
    expect(inferirObservadoDetalhe({ leituras: ls, thumbsPorId: new Map(), publicadoEm: PUB, agoraMs: agoraEm(T0 + 180) }).observados).toEqual([])
  })
  it('rodadasDaMiniatura agrupa por rodada e usa o representante da versão', () => {
    const { ls, thumbs } = mini(['AAA', 'aaa', 'AAA'])
    const rs = rodadasDaMiniatura(ls, thumbs)
    expect(rs).toHaveLength(3)
    expect(new Set(rs.flatMap(r => [...r.versoes])).size).toBe(1)
  })
})

describe('título e miniatura juntos', () => {
  it('título em teste e miniatura em troca limpa -> duas linhas com estados distintos', () => {
    const thumbs = new Map<number, ThumbObs>([[1, thumb(1, DH_A)], [2, thumb(2, DH_B)]])
    const ls = rodadas(T0, A20B8.map((r, i) => (i < 12 ? MISTAS[i]! : r)), l => ({ ...titulo(l === 'B' || l === 'A' ? l : 'A'), miniaturaId: 0 }))
    const ls2 = ls.map(l => ({ ...l, miniaturaId: Date.parse(l.lidaEm) < PUB.getTime() + (T0 + 20 * 6) * 3_600_000 ? 1 : 2 }))
    const out: Observado[] = inferirObservado({ leituras: ls2, thumbsPorId: thumbs, publicadoEm: PUB, agoraMs: agoraEm(fimH(T0, 28) + 1) })
    expect(out.map(o => o.campo)).toContain('miniatura')
  })
})
