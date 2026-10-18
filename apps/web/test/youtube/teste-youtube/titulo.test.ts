// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { prepararLeituras } from '@/lib/youtube/teste-youtube/preparar'
import { classificarTitulo, tituloOficialMaisFrequente } from '@/lib/youtube/teste-youtube/titulo'
import { resolverOpcoes, RENDERERS_TITULO, type LeituraWatch, type OpcoesDeteccao } from '@/lib/youtube/teste-youtube/tipos'
import { leitura, rodadas } from './sintetico'
import { carregarQIg9, TITULO_A, TITULO_B } from '../../fixtures/teste-youtube/qIg9a7vqcNo/carregar'

const H = 3_600_000
const INI = '2026-10-10T00:00:00Z'
const T = { A: 'Titulo A', B: 'Titulo B', C: 'Titulo C', D: 'Titulo D' }

const classificar = (ls: unknown[], opts?: OpcoesDeteccao) => classificarTitulo(prepararLeituras(ls).leituras, resolverOpcoes(opts))
const { leituras: fix } = carregarQIg9()

/** Rodadas a cada `intervalo` com padrão por letra; `passo` por rodada (ms) para rodadas longas. */
function serie(specs: Array<string | { p: string; passo: number }>, intervalo = 6 * H, inicio = INI, textos: Record<string, string> = T): LeituraWatch[] {
  const t0 = Date.parse(inicio)
  const out: LeituraWatch[] = []
  specs.forEach((s, i) => {
    const { p, passo } = typeof s === 'string' ? { p: s, passo: 2000 } : s
    ;[...p].forEach((letra, j) => {
      out.push(leitura({ em: new Date(t0 + i * intervalo + j * passo).toISOString(), rodada: `r${i}`, titulo: textos[letra]! }))
    })
  })
  return out
}
const L = (p: string) => ({ p, passo: 15 * 60_000 })

/** Leituras das rodadas da fixture até a que começa em `hhmmss` (inclusive). */
function fixAte(hhmmss: string): LeituraWatch[] {
  const limite = Date.parse(`2026-10-18T${hhmmss}Z`)
  const inicios = new Map<string, number>()
  for (const l of fix) inicios.set(l.rodadaId, Math.min(inicios.get(l.rodadaId) ?? Infinity, Date.parse(l.lidaEm)))
  return fix.filter(l => inicios.get(l.rodadaId)! <= limite)
}

describe('classificarTitulo, fixture', () => {
  it('C1: provável teste com A e B', () => {
    const r = classificar(fix)
    if (r.estado !== 'provavel_teste') throw new Error(`estado ${r.estado}`)
    expect(r.variantes).toEqual([TITULO_A, TITULO_B])
    expect(r.votos).toEqual({ [TITULO_A]: 29, [TITULO_B]: 31 })
    expect(r.proporcao[TITULO_B]).toBeCloseTo(31 / 60, 3)
    expect(r.primeiraVista).toBe('2026-10-18T16:42:56.000Z')
    expect(r.ultimaVista).toBe('2026-10-18T17:22:26.000Z')
    expect(r.contagem.rodadasMistasTitulo).toBe(13)
    expect(r.contagem.rodadasLongas).toBe(0)
  })

  it('C2: 1ª rodada é insuficiente', () => {
    const r = classificar(fix.filter(l => l.rodadaId === 'r0'))
    expect(r).toMatchObject({ estado: 'insuficiente', detalhe: { motivo: 'poucas_leituras', minimo: 9, atual: 3 } })
  })

  it('C3: janela curta até a rodada das 17:07:52', () => {
    const r = classificar(fixAte('17:07:52'))
    expect(r).toMatchObject({ estado: 'insuficiente', detalhe: { motivo: 'janela_curta', janelaMs: 1_499_000, minimoMs: 1_800_000 } })
    if (r.estado !== 'insuficiente' || r.detalhe.motivo !== 'janela_curta') throw new Error('x')
    expect(r.detalhe.variantes.sort()).toEqual([TITULO_A, TITULO_B].sort())
  })

  it('C4: provável até a rodada das 17:16:10', () => {
    expect(classificar(fixAte('17:16:10')).estado).toBe('provavel_teste')
  })

  it('C5: minLeituras 61 é insuficiente', () => {
    expect(classificar(fix, { minLeituras: 61 })).toMatchObject({ estado: 'insuficiente', detalhe: { motivo: 'poucas_leituras' } })
  })

  it('C15: NFD e NBSP dão o mesmo veredito; variantes[1] é o cru da 1ª B; PART 4 cria 3º texto', () => {
    const base = classificar(fix)
    let k = 0
    const mex = fix.map(l => {
      if (l.titulosExibidos[0]!.texto !== TITULO_B) return l
      const novo = k++ % 2 === 0 ? TITULO_B.normalize('NFD') : TITULO_B.replace(/ /g, ' ')
      return { ...l, titulosExibidos: l.titulosExibidos.map(t => ({ ...t, texto: novo })) }
    })
    const r = classificar(mex)
    if (r.estado !== 'provavel_teste' || base.estado !== 'provavel_teste') throw new Error('estado')
    expect(r.votos[r.variantes[1]!]).toBe(31)
    expect(r.variantes[1]).toBe(mex.find(l => l.titulosExibidos[0]!.texto !== TITULO_A)!.titulosExibidos[0]!.texto)
    expect({ ...r, variantes: [], votos: {}, proporcao: {} }).toEqual({ ...base, variantes: [], votos: {}, proporcao: {} })
    let j = 0
    const tres = fix.map(l => {
      if (l.titulosExibidos[0]!.texto !== TITULO_B || j++ % 2 === 0) return l
      return { ...l, titulosExibidos: l.titulosExibidos.map(t => ({ ...t, texto: TITULO_B.replace('Part', 'PART') })) }
    })
    expect(classificar(tres).contagem.textosDistintosTitulo).toBe(3)
  })

  it('Review Focus 1: rodadas trocadas na entrada dão o mesmo veredito', () => {
    const trocado = [...fix].reverse()
    expect(classificar(trocado)).toEqual(classificar(fix))
  })

  it('C21: fixture embaralhada (LCG) dá igualdade profunda', () => {
    const a = [...fix]
    let s = 12345
    for (let i = a.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) % 4294967296
      const j = s % (i + 1)
      ;[a[i], a[j]] = [a[j]!, a[i]!]
    }
    expect(classificar(a)).toEqual(classificar(fix))
  })

  it('Review Focus 4: oficial B coloca B primeiro', () => {
    const r = classificar(fix.map(l => ({ ...l, tituloOficial: TITULO_B })))
    if (r.estado !== 'provavel_teste') throw new Error('estado')
    expect(r.variantes[0]).toBe(TITULO_B)
  })

  it('tituloOficialMaisFrequente: empate fica com o primeiro', () => {
    const ls = prepararLeituras([
      leitura({ em: '2026-10-18T10:00:00Z', rodada: 'a', titulo: 'X', oficial: 'um' }),
      leitura({ em: '2026-10-18T10:00:01Z', rodada: 'a', titulo: 'X', oficial: 'dois' }),
    ]).leituras
    expect(tituloOficialMaisFrequente(ls)).toBe('um')
    expect(tituloOficialMaisFrequente([])).toBeNull()
  })
})

describe('classificarTitulo, sintético', () => {
  it('nao_lido: nenhum título lido', () => {
    const ls = [leitura({ em: '2026-10-18T10:00:00Z', rodada: 'a', renderers: [] })]
    expect(classificar(ls)).toMatchObject({ estado: 'nao_lido', contagem: { validasTitulo: 0 } })
  })

  it('um_valor_so', () => {
    const r = classificar(serie(['AAA', 'AAA', 'AAA', 'AAA']))
    expect(r).toMatchObject({ estado: 'nada_visivel', motivo: 'um_valor_so', valorUnico: { titulo: T.A } })
  })

  it('C10: troca sem mistura', () => {
    const r = classificar(serie([...Array(4).fill('AAA'), ...Array(4).fill('BBB'), ...Array(4).fill('AAA')]))
    expect(r).toMatchObject({ estado: 'nada_visivel', motivo: 'troca_sem_mistura' })
  })

  it('C11: mistura isolada', () => {
    const r = classificar(serie([...Array(6).fill('AAA'), 'ABB', ...Array(6).fill('BBB')]))
    expect(r).toMatchObject({ estado: 'nada_visivel', motivo: 'mistura_isolada' })
  })

  it('C10b: 120 rodadas, mistura esparsa', () => {
    const specs = Array.from({ length: 120 }, (_, i) => (i % 25 === 0 ? 'AAB' : i % 2 === 0 ? 'AAA' : 'BBB'))
    expect(classificar(serie(specs))).toMatchObject({ estado: 'nada_visivel', motivo: 'mistura_esparsa' })
  })

  it('C16: idiomas diferentes na rodada não viram mistura', () => {
    const ls: LeituraWatch[] = []
    for (let i = 0; i < 6; i++) {
      const t0 = Date.parse(INI) + i * 6 * H
      for (const [j, [t, id]] of (
        [['Titulo A', 'pt-BR'], ['Titulo A', 'pt-BR'], ['Titulo X', 'en']] as const
      ).entries()) {
        ls.push(leitura({ em: new Date(t0 + j * 2000).toISOString(), rodada: `r${i}`, titulo: t, idioma: id }))
      }
    }
    const r = classificar(ls)
    expect(r.contagem.rodadasMistasTitulo).toBe(0)
    expect(r).toMatchObject({ estado: 'nada_visivel', motivo: 'troca_sem_mistura' })
  })

  it('C17: 4 títulos misturados é atípico', () => {
    const ls = rodadas({ inicio: INI, intervaloMs: 15 * 60_000, padroes: ['ABCD', 'ABCD', 'ABCD', 'ABCD'], textos: T })
    expect(classificar(ls)).toMatchObject({ estado: 'nada_visivel', motivo: 'mistura_atipica' })
  })

  it('C24: escritas nossas põem a mistura em quarentena', () => {
    const t = (iso: string) => iso
    const specs: Array<[string, string]> = [
      [t('2026-10-10T00:10:00Z'), 'ABB'],
      [t('2026-10-10T12:10:00Z'), 'BBB'],
      [t('2026-10-11T00:10:00Z'), 'AAB'],
      [t('2026-10-11T12:10:00Z'), 'AAA'],
      [t('2026-10-12T00:10:00Z'), 'ABB'],
    ]
    const ls: LeituraWatch[] = []
    specs.forEach(([ini, p], i) => [...p].forEach((letra, j) => ls.push(leitura({ em: new Date(Date.parse(ini) + j * 2000).toISOString(), rodada: `r${i}`, titulo: T[letra as 'A' | 'B'] }))))
    const escritasConhecidas = ['2026-10-10T00:00:00Z', '2026-10-11T00:00:00Z', '2026-10-12T00:00:00Z'].map(em => ({ em, campo: 'titulo' as const }))
    expect(classificar(ls, { escritasConhecidas })).toMatchObject({ estado: 'nada_visivel', motivo: 'troca_sem_mistura' })
    expect(classificar(ls).estado).toBe('provavel_teste')
  })

  it('C25: A→B e depois B→C, uma mista cada, é isolada', () => {
    const r = classificar(serie(['AAA', 'AAA', 'ABB', 'BBB', 'BBB', 'BBC', 'CCC', 'CCC']))
    expect(r).toMatchObject({ estado: 'nada_visivel', motivo: 'mistura_isolada' })
  })

  it('C26: rodadas longas não misturam', () => {
    const mk = (rodada: string, dia: string, tempos: Array<[string, string]>) =>
      tempos.map(([hm, letra]) => leitura({ em: `2026-10-${dia}T${hm}:00Z`, rodada, titulo: T[letra as 'A' | 'B'] }))
    const ls = [
      ...mk('n1', '11', [['08:00', 'A'], ['08:01', 'A'], ['08:02', 'A']]),
      ...mk('x', '11', [['10:00', 'A'], ['10:01', 'A'], ['16:00', 'B']]),
      ...mk('y', '12', [['10:00', 'A'], ['10:01', 'A'], ['16:00', 'B']]),
      ...mk('n2', '12', [['20:00', 'B'], ['20:01', 'B'], ['20:02', 'B']]),
    ]
    const r = classificar(ls)
    expect(r.contagem).toMatchObject({ rodadasLongas: 2, rodadasMistasTitulo: 0 })
    expect(r).toMatchObject({ estado: 'nada_visivel', motivo: 'troca_sem_mistura' })
  })

  it('C29.1: numerador sem filtro de 3 votos dá esparsa', () => {
    const r = classificar(serie(['AAB', 'AAA', 'AAA', 'AB', 'AB', 'AAA', 'AAA', 'ABB']))
    expect(r).toMatchObject({ estado: 'nada_visivel', motivo: 'mistura_esparsa' })
  })

  it('C29.2: denominador com filtro de 3 votos dá provável', () => {
    expect(classificar(serie(['AAB', 'AA', 'AA', 'AA', 'AA', 'ABB'])).estado).toBe('provavel_teste')
  })

  it('C29.3: rodada longa fora do denominador dá provável', () => {
    expect(classificar(serie(['AAB', 'AAA', L('AAA'), L('AAA'), L('AAA'), 'ABB'])).estado).toBe('provavel_teste')
  })

  it('D4: par que só mistura em < 30 min fica fora de variantes e do span', () => {
    const ab = serie(['AAB', 'ABB', 'AAB', 'ABB', 'AAB', 'ABB', 'AAB', 'ABB'])
    const t0 = Date.parse(INI) + 3 * 24 * H
    const ac = ['AAC', 'ACC'].flatMap((p, i) =>
      [...p].map((letra, j) => leitura({ em: new Date(t0 + i * 5 * 60_000 + j * 2000).toISOString(), rodada: `c${i}`, titulo: T[letra as 'A' | 'C'] })),
    )
    const r = classificar([...ab, ...ac])
    if (r.estado !== 'provavel_teste') throw new Error(`estado ${r.estado}`)
    expect(r.variantes).toEqual([T.A, T.B])
    const ultimaAB = Date.parse(INI) + 7 * 6 * H + 4000
    expect(r.primeiraVista).toBe(INI.replace('Z', '.000Z'))
    expect(r.ultimaVista).toBe(new Date(ultimaAB).toISOString())
  })

  it('C30: 3 variantes a 1/3 passam em 2/5; com mais uma homogênea, esparsa', () => {
    const r = classificar(serie(['ABC', 'AAA', 'BBB', 'CCC', 'ABC']))
    if (r.estado !== 'provavel_teste') throw new Error(`estado ${r.estado}`)
    expect(r.variantes.length).toBe(3)
    expect(classificar(serie(['ABC', 'AAA', 'BBB', 'CCC', 'AAA', 'ABC']))).toMatchObject({ estado: 'nada_visivel', motivo: 'mistura_esparsa' })
  })

  it('C32a: span ilegível', () => {
    const specs = [
      'AAB', L('AA'), L('AA'), L('AA'), L('AA'), 'ABB',
    ]
    // mistas às 00:00 e 12:00; longas às 02, 04, 06, 08 (passos de 2h): intervalo de 2h
    const r = classificar(serie(specs, 2 * H))
    expect(r).toMatchObject({ estado: 'insuficiente', detalhe: { motivo: 'span_ilegivel' }, contagem: { rodadasLongas: 4 } })
  })

  it('Review Focus 2: renderers discordantes contam em validasTitulo mas não votam', () => {
    const disc = leitura({
      em: '2026-10-10T00:00:00Z',
      rodada: 'd',
      renderers: [
        { renderer: RENDERERS_TITULO[0], texto: 'A' },
        { renderer: RENDERERS_TITULO[1], texto: 'B' },
        { renderer: RENDERERS_TITULO[2], texto: 'A' },
      ],
    })
    const r = classificar([disc])
    expect(r).toMatchObject({ estado: 'insuficiente', detalhe: { motivo: 'poucas_leituras', atual: 0 }, contagem: { validasTitulo: 1 } })
  })

  it('Review Focus 3: escrita de miniatura não tira a mistura', () => {
    const ls = serie(['ABB', 'AAB', 'ABB'])
    const escritasConhecidas = [{ em: INI, campo: 'miniatura' as const }]
    expect(classificar(ls, { escritasConhecidas }).contagem.rodadasMistasTitulo).toBe(3)
    expect(classificar(ls, { escritasConhecidas: [{ em: INI, campo: 'titulo' }] }).contagem.rodadasEmQuarentena).toBeGreaterThan(0)
  })
})

describe('conserto r1: fração e span', () => {
  it('C29.4 (D1): rodadas de 2 votos não têm base para a fração: insuficiente/span_ilegivel, não mistura_esparsa', () => {
    const r = classificar(serie(['AB', 'AB', 'BA', 'AB', 'AB', 'BA']))
    expect(r).toMatchObject({ estado: 'insuficiente', detalhe: { motivo: 'span_ilegivel', ilegiveis: 6, rodadasSpan: 6 } })
    expect(r.contagem.rodadasMistasTitulo).toBe(6)
  })

  it('T13: a fração é medida no span das mistas, não no histórico inteiro (120 rodadas homogêneas antes)', () => {
    const homogeneas = serie(Array(120).fill('AAA'))
    const t0 = new Date(Date.parse(INI) + 120 * 6 * H).toISOString()
    const nativas = serie(['ABB', 'BAB', 'ABB', 'BAB', 'ABB', 'BAB', 'ABB', 'BAB'], 6 * H, t0).map(l => ({ ...l, rodadaId: `m${l.rodadaId}` }))
    expect(classificar([...homogeneas, ...nativas]).estado).toBe('provavel_teste')
  })

  it('fronteira de 30 min: janela exatamente igual a minJanelaMistaMs passa; 1 ms a mais não', () => {
    const ls = serie(['ABB', 'BAB', 'ABB'])
    const janela = 2 * 6 * H + 4000
    expect(classificar(ls, { minJanelaMistaMs: janela }).estado).toBe('provavel_teste')
    expect(classificar(ls, { minJanelaMistaMs: janela + 1 })).toMatchObject({ estado: 'insuficiente', detalhe: { motivo: 'janela_curta' } })
  })
})

describe('fechamento do lote: contagem por votantes e janelas (R2-3, R2-4, R2-5)', () => {
  const R = RENDERERS_TITULO
  const naoVota = (em: string, rodada: string) =>
    leitura({ em, rodada, renderers: [{ renderer: R[0], texto: 'Titulo X' }, { renderer: R[1], texto: 'Titulo Y' }] })
  const vota = (em: string, rodada: string, texto: string) => leitura({ em, rodada, titulo: texto })
  const min = (ms: number) => new Date(Date.parse(INI) + ms * 60_000).toISOString()

  it('T15: 12 leituras com título lido e só 6 votantes: poucas_leituras (atual 6), não um veredito', () => {
    const ls = Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? vota(min(i), `r${i}`, T.A) : naoVota(min(i), `r${i}`)))
    const r = classificar(ls)
    expect(r).toMatchObject({ estado: 'insuficiente', detalhe: { motivo: 'poucas_leituras', minimo: 9, atual: 6 } })
    expect(r.contagem.validasTitulo).toBe(12)
  })

  it('T15: 10 leituras com título lido e nenhuma votante: poucas_leituras (atual 0), sem exceção', () => {
    const ls = Array.from({ length: 10 }, (_, i) => naoVota(min(i), `r${i}`))
    expect(classificar(ls)).toMatchObject({ estado: 'insuficiente', detalhe: { motivo: 'poucas_leituras', atual: 0 } })
  })

  it('T19: primeiraVista é a 1ª rodada dos pares APROVADOS; um par curto (A/C, 5 min) 10 h antes não conta', () => {
    const curto = serie(['ACC', 'ACC'], 5 * 60_000, INI).map(l => ({ ...l, rodadaId: `c${l.rodadaId}` }))
    const t10 = new Date(Date.parse(INI) + 10 * H).toISOString()
    const longo = serie(['ABB', 'BAB', 'ABB', 'BAB'], 40 * 60_000, t10, T).map(l => ({ ...l, rodadaId: `l${l.rodadaId}` }))
    const r = classificar([...curto, ...longo])
    if (r.estado !== 'provavel_teste') throw new Error(`estado ${r.estado}`)
    expect(r.variantes).toEqual([T.A, T.B])
    expect(r.primeiraVista).toBe(t10)
  })

  it('T11: a janela do par conta só votantes: votos em 28 min com leitura sem voto em cada ponta (31 min no total) = janela_curta', () => {
    const r1 = [naoVota(min(0), 'a'), ...[1, 2, 3, 4, 5, 6].map((m, i) => vota(min(m), 'a', i % 2 === 0 ? T.A : T.B))]
    const r2 = [...[24, 25, 26, 27, 28, 29].map((m, i) => vota(min(m), 'b', i % 2 === 0 ? T.A : T.B)), naoVota(min(31), 'b')]
    expect(classificar([...r1, ...r2])).toMatchObject({ estado: 'insuficiente', detalhe: { motivo: 'janela_curta', janelaMs: 28 * 60_000 } })
  })
})
