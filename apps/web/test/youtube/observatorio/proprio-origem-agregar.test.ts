// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { ConjuntoLido, VideoLido } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import type { DiaLido, EstadoConjunto, LinhaBasica } from '@/lib/youtube/observatorio/proprio/dimensoes-estado'
import { grupoDaOrigem, ORDEM_ORIGEM, type GrupoOrigem } from '@/lib/youtube/observatorio/proprio/origem-grupos'
import {
  agregarBloco, diasMedidosEmComum, maiorResto, MARCA_DE_CONTAGEM, pctTexto,
} from '@/lib/youtube/observatorio/proprio/origem-agregar'

const HOJE = '2026-10-12'
const ATE = '2026-10-11'
const d = (n: number) => addDays(ATE, -n)

type Linhas = Record<string, number | null>
const dia = (dd: string, base: number | null, linhas: Linhas = {}, over: Partial<DiaLido> = {}): DiaLido<LinhaBasica> => ({
  dia: dd, coberto: true, baseMedida: true, antesDoInicio: false, desde: '2026-10-10', base,
  linhas: Object.entries(linhas).map(([valor, views]) => ({ valor, views, minutos: null })), ...over,
})
const video = (ytId: string, dias: DiaLido<LinhaBasica>[]): VideoLido<LinhaBasica> => ({ ytId, dias })
const conj = (videos: VideoLido<LinhaBasica>[], estado: EstadoConjunto = { tipo: 'coletado' }, conjunto: ConjuntoLido<LinhaBasica>['conjunto'] = 'trafego'): ConjuntoLido<LinhaBasica> => ({ conjunto, estado, videos })
const pubs = (...ids: string[]) => new Map<string, string | null>(ids.map(i => [i, null]))
const chaveOrigem = (v: string) => { const g = grupoDaOrigem(v); return { chave: g.grupo, catalogado: g.catalogado } }
const base = (conjunto: ConjuntoLido<LinhaBasica>, de: string, ate: string, publicacoes = pubs(...conjunto.videos.map(v => v.ytId))) => ({
  conjunto, de, ate, hoje: HOJE, publicacoes, chaveDe: chaveOrigem, ordem: ORDEM_ORIGEM as readonly GrupoOrigem[],
})
const intervalo = (de: string, ate: string): string[] => { const o: string[] = []; for (let x = de; x <= ate; x = addDays(x, 1)) o.push(x); return o }

describe('o fecho: total = soma das linhas + omitido', () => {
  it('um vídeo, dois dias: linhas, omitido e porcentagens que somam 100', () => {
    const c = conj([video('a', [dia(d(1), 100, { YT_SEARCH: 40, RELATED_VIDEO: 20 }), dia(d(0), 100, { YT_SEARCH: 45, SHORTS: 5 })])])
    const b = agregarBloco(base(c, d(1), d(0)))
    expect(b.estado).toBe('medido')
    expect(b.total).toBe(200)
    expect(b.soma).toBe(110)
    expect(b.omitido).toBe(90)
    expect(b.linhas.map(l => [l.chave, l.valor])).toEqual([['pesquisa', 85], ['sugeridos', 20], ['navegacao', 0], ['shorts', 5], ['externa', 0], ['outras', 0]])
    expect(b.linhas.reduce((s, l) => s + l.pct, 0) + b.pctOmitido).toBe(100)
    expect(b.cobertura).toMatchObject({ dias: 2, medidos: 2, de: d(1), ate: d(0) })
  })
  it('em 200 casos gerados a soma mais o omitido é o total e as porcentagens somam 100', () => {
    let s = 12345
    const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
    const valores = ['YT_SEARCH', 'RELATED_VIDEO', 'SUBSCRIBER', 'SHORTS', 'EXT_URL', '14', '999']
    for (let k = 0; k < 200; k++) {
      const nv = 1 + Math.floor(rnd() * 3)
      const videos = Array.from({ length: nv }, (_, i) => video('v' + i, intervalo(d(5), d(0)).map(x => {
        const bs = Math.floor(rnd() * 500)
        let resta = bs
        const linhas: Linhas = {}
        for (const v of valores) { const x2 = Math.floor(rnd() * (resta + 1) * 0.5); if (rnd() < 0.6) { linhas[v] = x2; resta -= x2 } }
        return dia(x, bs, linhas)
      })))
      const b = agregarBloco(base(conj(videos), d(5), d(0)))
      if (b.estado === 'nao_medido') continue
      expect(b.soma + b.omitido, 'caso ' + k).toBe(b.total)
      if (b.total > 0) expect(b.linhas.reduce((x, l) => x + l.pct, 0) + b.pctOmitido, 'caso ' + k).toBe(100)
    }
  })
  it('valor 3 de 826 escreve "<1%", nunca "0%"', () => {
    const c = conj([video('a', [dia(d(0), 826, { SHORTS: 3, YT_SEARCH: 500, RELATED_VIDEO: 300 })])])
    const b = agregarBloco(base(c, d(0), d(0)))
    const shorts = b.linhas.find(l => l.chave === 'shorts')!
    expect(shorts.pct).toBe(0)
    expect(pctTexto(shorts.pct, shorts.valor)).toBe('<1%')
    expect(pctTexto(0, 0)).toBe('0%')
    expect(pctTexto(42, 100)).toBe('42%')
  })
})

describe('dado ausente: a cobertura e o estado', () => {
  it('nenhum vídeo e conjunto coletado: ainda_nao_existe, nunca coleta_nao_comecou (Phil m-3, Yannis m-4)', () => {
    const b = agregarBloco(base(conj([], { tipo: 'coletado' }), d(6), d(0), new Map()))
    expect(b).toMatchObject({ estado: 'nao_medido', motivo: 'ainda_nao_existe' })
  })
  it('período de 401 dias lança; 400 não (Yannis m-3)', () => {
    const c = conj([video('a', [dia(d(0), 1)])])
    expect(() => agregarBloco(base(c, addDays(d(0), -400), d(0)))).toThrow(RangeError)
    expect(agregarBloco(base(c, addDays(d(0), -399), d(0))).cobertura.dias).toBe(400)
  })
  it('nenhum vídeo: nao_medido', () => {
    const b = agregarBloco(base(conj([], { tipo: 'nao_coletado' }), d(6), d(0), new Map()))
    expect(b.estado).toBe('nao_medido')
    expect(b.cobertura.medidos).toBe(0)
    expect(b.motivo).not.toBeNull()
  })
  it('nenhum dia coberto e data de partida futura: coleta_comeca_em; passada: coleta_nao_comecou', () => {
    const futuro = dia(d(0), null, {}, { coberto: false, desde: addDays(HOJE, 5) })
    const b = agregarBloco(base(conj([video('a', [futuro])], { tipo: 'nao_coletado' }), d(0), d(0)))
    expect(b).toMatchObject({ estado: 'nao_medido', motivo: 'coleta_comeca_em' })
    expect(b.cobertura.desde).toBe(addDays(HOJE, 5))
    const passado = dia(d(0), null, {}, { coberto: false, desde: addDays(HOJE, -3) })
    expect(agregarBloco(base(conj([video('a', [passado])], { tipo: 'nao_coletado' }), d(0), d(0))).motivo).toBe('coleta_nao_comecou')
  })
  it('conjunto de lote sem cobertura: relatorio_nao_chegou', () => {
    const sem = dia(d(0), null, {}, { coberto: false, desde: addDays(HOJE, -3) })
    const b = agregarBloco(base(conj([video('a', [sem])], { tipo: 'nao_coletado' }, 'detalhe'), d(0), d(0)))
    expect(b.motivo).toBe('relatorio_nao_chegou')
  })
  it('schema_ausente: nao_medido; passo desligado e coleta em erro têm motivo próprio', () => {
    const sem = dia(d(0), null, {}, { coberto: false, desde: addDays(HOJE, 4) })
    const v = [video('a', [sem])]
    expect(agregarBloco(base(conj(v, { tipo: 'schema_ausente' }), d(0), d(0))).estado).toBe('nao_medido')
    expect(agregarBloco(base(conj(v, { tipo: 'passo_desligado', comDados: false }), d(0), d(0))).motivo).toBe('coleta_desligada')
    expect(agregarBloco(base(conj(v, { tipo: 'coleta_em_erro', outcome: 'erro_http', comDados: false }), d(0), d(0))).motivo).toBe('busca_falhou')
  })
  it('dia coberto com total 0: zero', () => {
    const b = agregarBloco(base(conj([video('a', [dia(d(0), 0)])]), d(0), d(0)))
    expect(b.estado).toBe('zero')
    expect(b.total).toBe(0)
    expect(b.linhas.every(l => l.valor === 0 && l.pct === 0)).toBe(true)
  })
  it('dia com a referência não medida sai dos medidos e não vira zero', () => {
    const c = conj([video('a', [dia(d(1), 10, { YT_SEARCH: 10 }), dia(d(0), null, {}, { baseMedida: false })])])
    const b = agregarBloco(base(c, d(1), d(0)))
    expect(b.cobertura).toMatchObject({ dias: 2, medidos: 1, primeiroMedido: d(1), ultimoMedido: d(1) })
    expect(b.total).toBe(10)
  })
  it('linha com contagem nula: o dia sai dos medidos', () => {
    const c = conj([video('a', [dia(d(1), 10, { YT_SEARCH: null }), dia(d(0), 10, { YT_SEARCH: 10 })])])
    const b = agregarBloco(base(c, d(1), d(0)))
    expect(b.cobertura.medidos).toBe(1)
    expect(b.cobertura.primeiroMedido).toBe(d(0))
  })
  it('apagar a cobertura de um dia que tinha linhas: o dia sai dos medidos e as linhas dele não entram na soma', () => {
    const com = conj([video('a', [dia(d(1), 100, { YT_SEARCH: 90 }), dia(d(0), 100, { YT_SEARCH: 80 })])])
    expect(agregarBloco(base(com, d(1), d(0))).soma).toBe(170)
    const sem = conj([video('a', [dia(d(1), 100, { YT_SEARCH: 90 }), dia(d(0), 100, { YT_SEARCH: 80 }, { coberto: false })])])
    const b = agregarBloco(base(sem, d(1), d(0)))
    expect(b.cobertura.medidos).toBe(1)
    expect(b.soma).toBe(90)
    expect(b.total).toBe(100)
  })
})

describe('a regra do dia inteiro', () => {
  it('canal com dois vídeos, um coberto e outro não no dia D: o dia D não é medido', () => {
    const a = video('a', [dia(d(1), 10, { YT_SEARCH: 10 }), dia(d(0), 10, { YT_SEARCH: 10 })])
    const b2 = video('b', [dia(d(1), 10, { YT_SEARCH: 10 }), dia(d(0), 10, { YT_SEARCH: 10 }, { baseMedida: false })])
    const r = agregarBloco(base(conj([a, b2]), d(1), d(0)))
    expect(r.cobertura.medidos).toBe(1)
    expect(r.total).toBe(20)
  })
  it('vídeo ainda não publicado no dia D não conta para a regra', () => {
    const a = video('a', [dia(d(1), 10, { YT_SEARCH: 10 }), dia(d(0), 10, { YT_SEARCH: 10 })])
    const novo = video('b', [dia(d(1), null, {}, { coberto: false, baseMedida: false }), dia(d(0), 5, { YT_SEARCH: 5 })])
    const r = agregarBloco(base(conj([a, novo]), d(1), d(0), new Map([['a', null], ['b', d(0)]])))
    expect(r.cobertura.medidos).toBe(2)
    expect(r.total).toBe(25)
  })
  it('vídeo com publicação nula e coberto conta em todos os dias; e sem cobertura num dia D, o dia D não é medido', () => {
    const a = video('a', [dia(d(1), 10), dia(d(0), 10)])
    const b2 = video('b', [dia(d(1), 5), dia(d(0), 5, {}, { coberto: false })])
    const r = agregarBloco(base(conj([a, b2]), d(1), d(0), new Map([['a', null], ['b', null]])))
    expect(r.cobertura.medidos).toBe(1)
  })
  it('34 vídeos cobertos e 1 sem nenhum dia medido: medido, videosFora 1, videosNaConta 34, total dos 34', () => {
    const cobertos = Array.from({ length: 34 }, (_, i) => video('v' + i, [dia(d(0), 10, { YT_SEARCH: 10 })]))
    const fora = video('fora', [dia(d(0), null, {}, { coberto: false, baseMedida: false })])
    const r = agregarBloco(base(conj([...cobertos, fora]), d(0), d(0)))
    expect(r).toMatchObject({ estado: 'medido', videosFora: 1, videosNaConta: 34, total: 340 })
  })
  it('35 vídeos, cada um medido em dia diferente, nenhum em comum, conjunto coletado: nao_medido com cobertura_parcial', () => {
    const dias7 = intervalo(d(6), d(0))
    const vs = dias7.map((alvo, i) => video('v' + i, dias7.map(x => (x === alvo ? dia(x, 10, { YT_SEARCH: 10 }) : dia(x, null, {}, { baseMedida: false })))))
    const r = agregarBloco(base(conj(vs), d(6), d(0)))
    expect(r.estado).toBe('nao_medido')
    expect(r.motivo).toBe('cobertura_parcial')
    expect(r.motivo).not.toBe('coleta_nao_comecou')
    expect(r.faltamNoPiorDia).toBeGreaterThan(0)
  })
  it('todos fora e conjunto coletado: cobertura_parcial com faltamNoPiorDia igual a videosFora; com nao_coletado o motivo do conjunto', () => {
    const fora = [video('a', [dia(d(0), null, {}, { baseMedida: false })]), video('b', [dia(d(0), null, {}, { coberto: false, baseMedida: false })])]
    const r = agregarBloco(base(conj(fora), d(0), d(0)))
    expect(r).toMatchObject({ estado: 'nao_medido', motivo: 'cobertura_parcial', videosFora: 2, faltamNoPiorDia: 2 })
    const r2 = agregarBloco(base(conj(fora, { tipo: 'nao_coletado' }), d(0), d(0)))
    expect(r2.motivo).not.toBe('cobertura_parcial')
  })
  it('conjunto coletado com zero dias medidos nunca lê coleta_nao_comecou', () => {
    for (let n = 1; n <= 4; n++) {
      const vs = Array.from({ length: n }, (_, i) => video('v' + i, [dia(d(0), null, {}, { baseMedida: i % 2 === 0 })]))
      const r = agregarBloco(base(conj(vs.map(v => ({ ...v, dias: [{ ...v.dias[0]!, base: null, baseMedida: false }] }))), d(0), d(0)))
      expect(r.estado).toBe('nao_medido')
      expect(r.motivo).not.toBe('coleta_nao_comecou')
    }
  })
})

describe('o vídeo parado (emenda 2: D-N1)', () => {
  const PER = intervalo(d(89), d(0))
  const dias90 = (ate: string) => PER.map(x => (x <= ate ? dia(x, 10, { YT_SEARCH: 10 }) : dia(x, null, {}, { coberto: false, baseMedida: false })))
  it('35 vídeos, um com leitura só até o dia 10 de 90: os dias 11 a 90 seguem medidos, videosParados 1, paradosDesde o dia 10', () => {
    const parado = video('parado', dias90(PER[9]!))
    const outros = Array.from({ length: 34 }, (_, i) => video('v' + i, dias90(d(0))))
    const r = agregarBloco(base(conj([parado, ...outros]), d(89), d(0)))
    expect(r.cobertura.medidos).toBe(90)
    expect(r.videosParados).toBe(1)
    expect(r.paradosDesde).toBe(PER[9])
    // 10 dias de 35 vídeos + 80 dias de 34 vídeos, 10 views por vídeo e dia
    expect(r.total).toBe(10 * 35 * 10 + 80 * 34 * 10)
    expect(r.videosNaConta).toBe(35)
  })
  it('o mesmo vídeo com a última leitura há 5 dias: os dias depois dela não são medidos e videosParados é 0', () => {
    const atrasado = video('atrasado', dias90(d(5)))
    const outros = Array.from({ length: 34 }, (_, i) => video('v' + i, dias90(d(0))))
    const r = agregarBloco(base(conj([atrasado, ...outros]), d(89), d(0)))
    expect(r.videosParados).toBe(0)
    expect(r.cobertura.medidos).toBe(85)
  })
  it('página do vídeo, um vídeo parado: medido até o último dia dele, e nenhum dia depois é medido', () => {
    const r = agregarBloco(base(conj([video('p', dias90(PER[9]!))]), d(89), d(0)))
    expect(r.cobertura.medidos).toBe(10)
    expect(r.cobertura.ultimoMedido).toBe(PER[9])
    expect(r.videosParados).toBe(1)
  })
})

describe('revisão, zero sem número e linhas', () => {
  it('uma célula em revisão: em_revisao, linhas vazias, diasEmRevisao 1', () => {
    const c = conj([video('a', [dia(d(1), 10, { YT_SEARCH: 10 }), dia(d(0), 10, { YT_SEARCH: 50 })])])
    const b = agregarBloco(base(c, d(1), d(0)))
    expect(b).toMatchObject({ estado: 'em_revisao', diasEmRevisao: 1 })
    expect(b.linhas).toEqual([])
    expect(b.omitido).toBeGreaterThanOrEqual(0) // sem o piso de 0 o omitido de uma célula em revisão sairia negativo (Yannis m-6)
    expect(b.omitido).toBe(0)
  })
  it('valor 0 com omitido maior que 0: semNumero; valor 0 com omitido 0: não', () => {
    const c = conj([video('a', [dia(d(0), 100, { YT_SEARCH: 60 })])])
    const b = agregarBloco(base(c, d(0), d(0)))
    expect(b.linhas.find(l => l.chave === 'shorts')).toMatchObject({ valor: 0, semNumero: true })
    const c2 = conj([video('a', [dia(d(0), 60, { YT_SEARCH: 60 })])])
    expect(agregarBloco(base(c2, d(0), d(0))).linhas.find(l => l.chave === 'shorts')).toMatchObject({ valor: 0, semNumero: false })
  })
  it('código desconhecido de origem entra em outras e conta em naoCatalogados; a soma fecha', () => {
    const c = conj([video('a', [dia(d(0), 100, { YT_SEARCH: 50, '999': 20, '14': 10 })])])
    const b = agregarBloco(base(c, d(0), d(0)))
    expect(b.linhas.find(l => l.chave === 'outras')!.valor).toBe(30)
    expect(b.naoCatalogados).toBe(1)
    expect(b.soma + b.omitido).toBe(b.total)
  })
  it('valor que chaveDe devolve null é ignorado e contado', () => {
    const c = conj([video('a', [dia(d(0), 100, { SUBSCRIBED: 40, UNSUBSCRIBED: 50, TALVEZ: 10 })])])
    const chaveDe = (v: string) => (v === 'SUBSCRIBED' ? { chave: 'inscritos', catalogado: true } : v === 'UNSUBSCRIBED' ? { chave: 'nao_inscritos', catalogado: true } : null)
    const b = agregarBloco({ ...base(c, d(0), d(0)), chaveDe, ordem: ['inscritos', 'nao_inscritos'] as const })
    expect(b.naoCatalogados).toBe(1)
    expect(b.linhas.map(l => [l.chave, l.valor])).toEqual([['inscritos', 40], ['nao_inscritos', 50]])
    expect(b.omitido).toBe(0)
    expect(b.valorNaoCatalogado).toBe(10)
    expect(b.soma + b.omitido + b.valorNaoCatalogado).toBe(b.total)
  })
  it('UNKNOWN em inscritos: omitido não inclui as views dele; o fecho tem três partes e as porcentagens somam 100 (m-4 do portão)', () => {
    // total 100: 40 + 50 conhecidos, 10 de um valor que o catálogo não conhece; o YouTube omitiu 0
    const c = conj([video('a', [dia(d(0), 100, { SUBSCRIBED: 40, UNSUBSCRIBED: 40, UNKNOWN: 10 })])])
    const chaveDe = (v: string) => (v === 'SUBSCRIBED' ? { chave: 'inscritos', catalogado: true } : v === 'UNSUBSCRIBED' ? { chave: 'nao_inscritos', catalogado: true } : null)
    const b = agregarBloco({ ...base(c, d(0), d(0)), chaveDe, ordem: ['inscritos', 'nao_inscritos'] as const })
    expect(b.valorNaoCatalogado).toBe(10)
    expect(b.omitido).toBe(10)
    expect(b.soma + b.omitido + b.valorNaoCatalogado).toBe(b.total)
    expect(b.linhas.reduce((s, l) => s + l.pct, 0) + b.pctOmitido + b.pctNaoCatalogado).toBe(100)
  })
  it('maxLinhas sem resto não compila (Yannis m-2): o valor das linhas cortadas não some', () => {
    const c = conj([video('a', [dia(d(0), 10, { BR: 6, PT: 4 })])], { tipo: 'coletado' }, 'pais')
    // só a compilação importa: a função nunca roda (o tsc do app é quem prova o ts-expect-error)
    const naoChamada = () =>
      // @ts-expect-error maxLinhas exige resto
      agregarBloco({ ...base(c, d(0), d(0)), chaveDe: (v: string) => ({ chave: v, catalogado: true }), ordem: 'por-valor' as const, maxLinhas: 1 })
    expect(typeof naoChamada).toBe('function')
  })
  it('país: 9 países, maxLinhas 6: seis linhas e "outros" com a soma dos três', () => {
    const paises: Linhas = { BR: 500, PT: 100, US: 80, AO: 60, MZ: 40, NL: 30, AR: 20, CL: 10, UY: 5 }
    const c = conj([video('a', [dia(d(0), 845, paises)])], { tipo: 'coletado' }, 'pais')
    const b = agregarBloco({ ...base(c, d(0), d(0)), chaveDe: (v: string) => ({ chave: v, catalogado: true }), ordem: 'por-valor' as const, maxLinhas: 6, resto: 'outros' })
    expect(b.linhas).toHaveLength(7)
    expect(b.linhas.slice(0, 6).map(l => l.chave)).toEqual(['BR', 'PT', 'US', 'AO', 'MZ', 'NL'])
    expect(b.linhas[6]).toMatchObject({ chave: 'outros', valor: 35 })
    expect(b.soma).toBe(845)
  })
})

describe('marca de contagem e dias em comum', () => {
  const periodoCom = (de: string, ate: string) => agregarBloco(base(conj([video('a', [dia(de, 1), dia(ate, 1)])]), de, ate)).cobertura.cruzaMarca
  it('começa em 23/08 e termina em 25/08: cruza', () => expect(periodoCom('2026-08-23', '2026-08-25')).toBe(true))
  it('começa na própria data da marca: não cruza', () => expect(periodoCom(MARCA_DE_CONTAGEM, '2026-08-26')).toBe(false))
  it('termina na véspera: não cruza', () => expect(periodoCom('2026-08-20', '2026-08-23')).toBe(false))
  it('termina na própria data: cruza', () => expect(periodoCom('2026-08-20', MARCA_DE_CONTAGEM)).toBe(true))
  it('diasMedidosEmComum: mesmas datas verdadeiro; um dia a mais falso', () => {
    const v = (...ds: string[]) => conj([video('a', ds.map(x => dia(x, 1)))])
    const a = agregarBloco(base(v(d(1), d(0)), d(1), d(0)))
    const b = agregarBloco(base(v(d(1), d(0)), d(1), d(0)))
    const c = agregarBloco(base(v(d(2), d(1), d(0)), d(2), d(0)))
    expect(diasMedidosEmComum(a.cobertura, b.cobertura)).toBe(true)
    expect(diasMedidosEmComum(a.cobertura, c.cobertura)).toBe(false)
  })
  it('a marca é 24/08/2026 (pergunta 10)', () => expect(MARCA_DE_CONTAGEM).toBe('2026-08-24'))
})

describe('maiorResto', () => {
  it('soma 100, preserva a ordem do maior resto', () => {
    expect(maiorResto([1, 1, 1])).toEqual([34, 33, 33])
    expect(maiorResto([50, 50])).toEqual([50, 50])
    expect(maiorResto([3, 0, 823]).reduce((a, b) => a + b, 0)).toBe(100)
  })
  it('lista vazia ou soma 0 devolve zeros', () => {
    expect(maiorResto([])).toEqual([])
    expect(maiorResto([0, 0, 0])).toEqual([0, 0, 0])
  })
})
