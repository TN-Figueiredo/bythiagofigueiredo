// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { inferirDesfecho } from '@/lib/youtube/teste-youtube/desfecho'
import { detectarTesteYoutube } from '@/lib/youtube/teste-youtube/detectar'
import { REGRA_TESTE_YOUTUBE_VERSAO, type LeituraWatch, type OpcoesDesfecho } from '@/lib/youtube/teste-youtube/tipos'
import { carregarQIg9, TITULO_A, TITULO_B } from '../../fixtures/teste-youtube/qIg9a7vqcNo/carregar'
import { leitura, rodadas } from './sintetico'

const H = 3_600_000
const antes = detectarTesteYoutube(carregarQIg9().leituras)
if (antes.estado !== 'provavel_teste') throw new Error('premissa: C1 é provável teste')
const ULTIMA = Date.parse(antes.ultimaVista)
const INICIO = new Date(ULTIMA + H).toISOString()
const TEXTOS = { A: TITULO_A, B: TITULO_B, C: 'Um terceiro título' }
const INTERVALO_LONGO = 3 * H + 45 * 60_000

function gerar(padroes: string[], intervaloMs = INTERVALO_LONGO, inicio = INICIO): LeituraWatch[] {
  return rodadas({ inicio, intervaloMs, padroes, textos: TEXTOS })
}
/** Põe o título oficial em todas as leituras. */
function comOficial(ls: LeituraWatch[], oficial: string | null): LeituraWatch[] {
  return ls.map(l => ({ ...l, tituloOficial: oficial, titulo_oficial_fonte: oficial === null ? null : 'videoDetails' }))
}
const ultimoMs = (ls: LeituraWatch[]) => Math.max(...ls.map(l => Date.parse(l.lidaEm)))
const opts = (ls: LeituraWatch[], extra: Partial<OpcoesDesfecho> = {}): OpcoesDesfecho => ({ agora: new Date(ultimoMs(ls) + H).toISOString(), ...extra })
const desfecho = (ls: LeituraWatch[], extra: Partial<OpcoesDesfecho> = {}) => inferirDesfecho(antes, ls, opts(ls, extra))
const v = REGRA_TESTE_YOUTUBE_VERSAO

const bLongo = () => comOficial(gerar(Array(8).fill('BBB')), TITULO_B)

describe('premissa do gerador', () => {
  it('o sufixo longo passa de 24 h', () => {
    const ls = bLongo()
    const ms = ls.map(l => Date.parse(l.lidaEm))
    expect(Math.max(...ms) - Math.min(...ms)).toBeGreaterThanOrEqual(24 * H)
    expect(ls).toHaveLength(24)
  })
})

describe('inferirDesfecho', () => {
  it('C14: 24 votos em B, oficial B = vencedor provável', () => {
    expect(desfecho(bLongo())).toEqual({ estado: 'vencedor_provavel', vencedor: TITULO_B, leiturasDescartadas: 0, versaoRegra: v })
  })

  it('AAA e depois 24 B: descarta 3', () => {
    const ls = comOficial(gerar(['AAA', ...Array(8).fill('BBB')]), TITULO_B)
    expect(desfecho(ls)).toEqual({ estado: 'vencedor_provavel', vencedor: TITULO_B, leiturasDescartadas: 3, versaoRegra: v })
  })

  it('10 leituras em B: em andamento, estável curto', () => {
    const ls = comOficial(gerar(['BBB', 'BBB', 'BBB', 'B']), TITULO_B)
    expect(desfecho(ls)).toEqual({ estado: 'em_andamento', motivo: 'estavel_curto', versaoRegra: v })
  })

  it('oficial A ou oficial com " - YouTube": oficial_diverge', () => {
    expect(desfecho(comOficial(gerar(Array(8).fill('BBB')), TITULO_A))).toEqual({ estado: 'sem_dado', motivo: 'oficial_diverge', versaoRegra: v })
    expect(desfecho(comOficial(gerar(Array(8).fill('BBB')), TITULO_B + ' - YouTube'))).toEqual({ estado: 'sem_dado', motivo: 'oficial_diverge', versaoRegra: v })
  })

  it('oficial nulo em todo o sufixo: oficial_nao_lido', () => {
    expect(desfecho(comOficial(gerar(Array(8).fill('BBB')), null))).toEqual({ estado: 'sem_dado', motivo: 'oficial_nao_lido', versaoRegra: v })
  })

  it('valor C estável: valor_fora_do_teste', () => {
    expect(desfecho(comOficial(gerar(Array(8).fill('CCC')), TEXTOS.C))).toEqual({ estado: 'sem_dado', motivo: 'valor_fora_do_teste', versaoRegra: v })
  })

  it('mistura nativa em depois: teste_visivel', () => {
    const ls = comOficial(gerar(['ABB', 'BAB', 'ABB', 'BBA'], H), TITULO_A)
    expect(desfecho(ls)).toEqual({ estado: 'em_andamento', motivo: 'teste_visivel', versaoRegra: v })
  })

  it('troca sem mistura: depois_ambiguo', () => {
    const ls = comOficial(gerar(['AAA', 'AAA', 'BBB', 'BBB'], H), TITULO_B)
    expect(desfecho(ls)).toEqual({ estado: 'sem_dado', motivo: 'depois_ambiguo', versaoRegra: v })
  })

  it('depois vazio ou só com erro: depois_sem_leitura (nunca estavel_curto)', () => {
    expect(inferirDesfecho(antes, [], { agora: INICIO })).toEqual({ estado: 'sem_dado', motivo: 'depois_sem_leitura', versaoRegra: v })
    const soErro = gerar(['BBB', 'BBB', 'BBB']).map(l => ({ ...l, erro: 'http_429', titulosExibidos: l.titulosExibidos.map(t => ({ ...t, texto: null })) }))
    expect(desfecho(soErro)).toEqual({ estado: 'sem_dado', motivo: 'depois_sem_leitura', versaoRegra: v })
  })

  it('1ª leitura em ou antes de ultimaVista: janelas_sobrepostas', () => {
    const ls = comOficial(gerar(Array(8).fill('BBB'), INTERVALO_LONGO, antes.ultimaVista), TITULO_B)
    expect(desfecho(ls)).toEqual({ estado: 'sem_dado', motivo: 'janelas_sobrepostas', versaoRegra: v })
  })

  it('coleta parada há 72 h: coleta_encerrada', () => {
    const ls = comOficial(gerar(['BBB', 'BBB', 'BBB', 'B']), TITULO_B)
    expect(inferirDesfecho(antes, ls, { agora: new Date(ultimoMs(ls) + 72 * H).toISOString() })).toEqual({ estado: 'sem_dado', motivo: 'coleta_encerrada', versaoRegra: v })
  })

  it('2 leituras sem voto no meio não quebram o sufixo', () => {
    const ls = bLongo()
    for (const i of [10, 11]) {
      ls[i] = { ...ls[i]!, titulosExibidos: [{ renderer: 'videoPrimaryInfoRenderer', texto: TITULO_B }, { renderer: 'playerOverlayVideoDetailsRenderer', texto: TITULO_A }] }
    }
    expect(desfecho(ls)).toEqual({ estado: 'vencedor_provavel', vencedor: TITULO_B, leiturasDescartadas: 0, versaoRegra: v })
  })

  it('voto A isolado na 4ª leitura de 27: sufixo de 23 B, 4 descartadas', () => {
    const ls = comOficial(gerar(Array(9).fill('BBB')), TITULO_B)
    ls[3] = { ...ls[3]!, titulosExibidos: ls[3]!.titulosExibidos.map(t => ({ ...t, texto: TITULO_A })) }
    expect(desfecho(ls)).toEqual({ estado: 'vencedor_provavel', vencedor: TITULO_B, leiturasDescartadas: 4, versaoRegra: v })
  })

  it('voto A na 13ª leitura de 24: sufixo de 11 B, depois_ambiguo (mistura_isolada)', () => {
    const ls = bLongo()
    ls[12] = { ...ls[12]!, titulosExibidos: ls[12]!.titulosExibidos.map(t => ({ ...t, texto: TITULO_A })) }
    expect(desfecho(ls)).toEqual({ estado: 'sem_dado', motivo: 'depois_ambiguo', versaoRegra: v })
  })

  describe('quarentena de escrita nossa', () => {
    const escrita = new Date(ULTIMA + H - 10 * 60_000).toISOString()
    const curto = () => [...gerar(['ABB']), ...gerar(['BBB'], H, new Date(ULTIMA + 7 * H).toISOString())]

    it('ABB na quarentena + BBB 6 h depois: estavel_curto', () => {
      const ls = comOficial(curto(), TITULO_B)
      expect(desfecho(ls, { escritasConhecidas: [{ em: escrita, campo: 'titulo' }] })).toEqual({ estado: 'em_andamento', motivo: 'estavel_curto', versaoRegra: v })
    })

    it('sem a escrita o mesmo depois continua estavel_curto', () => {
      expect(desfecho(comOficial(curto(), TITULO_B))).toEqual({ estado: 'em_andamento', motivo: 'estavel_curto', versaoRegra: v })
    })

    it('mistura fora da quarentena (> 30 min, >= 2 rodadas) vira teste_visivel', () => {
      const ls = comOficial([...gerar(['ABB']), ...gerar(['ABB', 'BAB', 'ABB'], H, new Date(ULTIMA + 3 * H).toISOString())], TITULO_A)
      expect(desfecho(ls, { escritasConhecidas: [{ em: escrita, campo: 'titulo' }] })).toEqual({ estado: 'em_andamento', motivo: 'teste_visivel', versaoRegra: v })
    })
  })

  it('antes sem teste: antes_sem_teste', () => {
    const nada = detectarTesteYoutube([])
    expect(inferirDesfecho(nada, bLongo(), { agora: INICIO })).toEqual({ estado: 'sem_dado', motivo: 'antes_sem_teste', versaoRegra: v })
  })

  it('C31: agora é obrigatório, mesmo com depois vazio (M4)', () => {
    // @ts-expect-error opts.agora é obrigatório no tipo
    expect(() => inferirDesfecho(antes, bLongo(), {})).toThrow(Error)
    // @ts-expect-error opts.agora é obrigatório no tipo
    expect(() => inferirDesfecho(antes, [], {})).toThrow(Error)
    expect(() => inferirDesfecho(antes, [], { agora: 'ontem' })).toThrow(Error)
  })
})

describe('conserto r1: desfecho', () => {
  const mk = (isoMs: number, i: number, titulo: string, extra: { idioma?: string } = {}) =>
    leitura({ em: new Date(isoMs).toISOString(), rodada: `z${i}`, titulo, oficial: TITULO_B, ...extra })
  const T0 = ULTIMA + H
  const nB = (n: number, spanMs: number, passo?: number): LeituraWatch[] =>
    Array.from({ length: n }, (_, i) => mk(T0 + (i === n - 1 ? spanMs : i * (passo ?? 1000)), i, TITULO_B))
  const em = (extra: Partial<OpcoesDesfecho>, ls: LeituraWatch[]) => inferirDesfecho(antes, ls, opts(ls, extra))

  it('F3: 24 votos B em 12 min (sonda de 30 s) não fecham vencedor: a guarda de 24 h vale', () => {
    const ls = comOficial(rodadas({ inicio: INICIO, intervaloMs: 90_000, padroes: Array(8).fill('BBB'), textos: TEXTOS, passoLeituraMs: 30_000 }), TITULO_B)
    expect(desfecho(ls)).toEqual({ estado: 'em_andamento', motivo: 'estavel_curto', versaoRegra: v })
  })

  it('fronteiras: 18 votos e 24 h exatas fecham; 17 votos ou 24 h menos 1 ms não', () => {
    expect(em({}, nB(18, 24 * H)).estado).toBe('vencedor_provavel')
    expect(em({}, nB(18, 24 * H - 1))).toEqual({ estado: 'em_andamento', motivo: 'estavel_curto', versaoRegra: v })
    expect(em({}, nB(17, 30 * H))).toEqual({ estado: 'em_andamento', motivo: 'estavel_curto', versaoRegra: v })
  })

  it('fronteira de 48 h: exatas ainda é em andamento; 1 ms a mais é coleta_encerrada', () => {
    const ls = nB(6, 1000)
    const ult = ultimoMs(ls)
    expect(inferirDesfecho(antes, ls, { agora: new Date(ult + 48 * H).toISOString() })).toEqual({ estado: 'em_andamento', motivo: 'estavel_curto', versaoRegra: v })
    expect(inferirDesfecho(antes, ls, { agora: new Date(ult + 48 * H + 1).toISOString() })).toEqual({ estado: 'sem_dado', motivo: 'coleta_encerrada', versaoRegra: v })
  })

  it('F15: 1ª leitura há 73 h e a última há 1 h (poucos votos): em andamento, a idade é da ÚLTIMA leitura', () => {
    const ls = [...nB(3, 1000), ...nB(3, 1000).map((l, i) => ({ ...l, rodadaId: `y${i}`, lidaEm: new Date(T0 + 72 * H + i * 1000).toISOString() }))]
    expect(desfecho(ls)).toEqual({ estado: 'em_andamento', motivo: 'estavel_curto', versaoRegra: v })
  })

  it('F12 (C14 mista na quarentena): com 12 votos, as escritas nossas chegam ao ramo 7; sem elas é teste_visivel, com elas depois_ambiguo', () => {
    const ls = comOficial(gerar(['ABB', 'ABB', 'BBB', 'BBB'], 40 * 60_000, INICIO), TITULO_B)
    const escritas = [{ em: INICIO, campo: 'titulo' as const }]
    expect(desfecho(ls)).toEqual({ estado: 'em_andamento', motivo: 'teste_visivel', versaoRegra: v })
    expect(desfecho(ls, { escritasConhecidas: escritas })).toEqual({ estado: 'sem_dado', motivo: 'depois_ambiguo', versaoRegra: v })
  })

  it('D-3: leitura de outro idioma não vota: 24 B + 1 leitura en no fim ainda é vencedor, sem descartar', () => {
    const ls = [...bLongo(), mk(ultimoMs(bLongo()) + H, 99, 'B in English', { idioma: 'en' })]
    expect(desfecho(ls)).toEqual({ estado: 'vencedor_provavel', vencedor: TITULO_B, leiturasDescartadas: 0, versaoRegra: v })
  })

  it('D-3: o idioma de referência é o mais frequente entre os votantes', () => {
    const ls = [mk(T0 - 1000, 98, 'A in English', { idioma: 'en' }), ...bLongo()]
    expect(desfecho(ls)).toEqual({ estado: 'vencedor_provavel', vencedor: TITULO_B, leiturasDescartadas: 0, versaoRegra: v })
  })
})

describe('fechamento do lote: desfecho', () => {
  const T0 = ULTIMA + H
  const um = (i: number, ms: number, texto: string, extra: { idioma?: string; oficial?: string | null } = {}) =>
    leitura({ em: new Date(ms).toISOString(), rodada: `w${i}`, titulo: texto, oficial: extra.oficial === undefined ? TITULO_B : extra.oficial, ...(extra.idioma ? { idioma: extra.idioma } : {}) })
  const seq = (n: number, texto: string, inicio: number, passo: number, extra: { idioma?: string; oficial?: string | null } = {}, base = 0) =>
    Array.from({ length: n }, (_, i) => um(base + i, inicio + i * passo, texto, extra))
  const venc = (vencedor: string, leiturasDescartadas = 0) => ({ estado: 'vencedor_provavel', vencedor, leiturasDescartadas, versaoRegra: v })

  it('F17: o oficial vem do sufixo: 30 A (oficial A) e depois 24 B (oficial B) = vencedor B, não oficial_diverge', () => {
    const ls = [...seq(30, TITULO_A, T0, 10 * 60_000, { oficial: TITULO_A }), ...seq(24, TITULO_B, T0 + 6 * H, 70 * 60_000, { oficial: TITULO_B }, 100)]
    expect(desfecho(ls)).toEqual(venc(TITULO_B, 30))
  })

  it('F17b: oficial só fora do sufixo (A antes, nulo no sufixo B): oficial_nao_lido, não oficial_diverge', () => {
    const ls = [...seq(30, TITULO_A, T0, 10 * 60_000, { oficial: TITULO_A }), ...seq(24, TITULO_B, T0 + 6 * H, 70 * 60_000, { oficial: null }, 100)]
    expect(desfecho(ls)).toEqual({ estado: 'sem_dado', motivo: 'oficial_nao_lido', versaoRegra: v })
  })

  it('F6: oficial decomposto (NFD) e com espaço no fim vale como o voto normalizado', () => {
    expect(desfecho(comOficial(bLongo(), TITULO_B.normalize('NFD') + '  '))).toEqual(venc(TITULO_B))
  })

  it('F10: vencedor é a variante canônica do antes, não o texto cru da 1ª leitura (espaço no fim)', () => {
    const ls = bLongo()
    ls[0] = { ...ls[0]!, titulosExibidos: ls[0]!.titulosExibidos.map(t => ({ ...t, texto: TITULO_B + ' ' })) }
    expect(desfecho(ls)).toEqual(venc(TITULO_B))
  })

  it('F7b: leitura sem voto antes de ultimaVista já é janelas_sobrepostas (a janela olha todas as leituras)', () => {
    const ls = [...bLongo(), leitura({ em: new Date(ULTIMA - 1000).toISOString(), rodada: 'nv', renderers: [{ renderer: 'videoPrimaryInfoRenderer', texto: 'X' }, { renderer: 'playerOverlayVideoDetailsRenderer', texto: 'Y' }] })]
    expect(desfecho(ls)).toEqual({ estado: 'sem_dado', motivo: 'janelas_sobrepostas', versaoRegra: v })
  })

  it('empate de idioma: vale o da 1ª leitura votante pelo desempate; embaralhar a entrada não muda', () => {
    const en = seq(18, TITULO_B, T0, (24 * H) / 17, { idioma: 'en', oficial: TITULO_B })
    const pt = seq(18, TITULO_A, T0 + 1000, (24 * H) / 17, { idioma: 'pt-BR', oficial: TITULO_A }, 100)
    const todas = [...en, ...pt]
    const esperado = desfecho(todas)
    expect(esperado).toEqual(venc(TITULO_B))
    expect(desfecho([...todas].reverse())).toEqual(esperado)
    const pares = todas.map((l, i) => [(i * 7919) % 36, l] as const).sort((a, b) => a[0] - b[0]).map(x => x[1])
    expect(desfecho(pares)).toEqual(esperado)
    // se o outro idioma abrir a série, ele passa a ser a referência
    const ptPrimeiro = [...seq(18, TITULO_A, T0 - 1000, (24 * H) / 17, { idioma: 'pt-BR', oficial: TITULO_A }, 100), ...en]
    expect(desfecho(ptPrimeiro)).toEqual(venc(TITULO_A))
  })
})
