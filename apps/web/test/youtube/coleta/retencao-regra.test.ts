// @vitest-environment node
// A regra pura da retenção: quem é lido hoje (A5 E6/E8, Tarefa 8). Sem banco, sem rede, sem relógio:
// `hojePt` e `hojeUtc` entram por parâmetro. O contrato de `FatoRetencao` com o jsonb real é provado
// na Tarefa 9b (precisa da migration MG5 aplicada).
import { describe, it, expect } from 'vitest'
import { addDays, dayPt, diffDias } from '@/lib/youtube/coleta/day-pt'
import {
  RETENCAO,
  RETENCAO_JANELAS_DESDE,
  decidirRetencao,
  diaDaLeva,
  lerFatos,
  type Decisao,
  type FatoRetencao,
  type Janela,
  type Leitura,
} from '@/lib/youtube/coleta/retencao-regra'

const HOJE = '2026-10-13'
const UTC = '2026-10-13'
const d = (n: number, base: string = HOJE) => addDays(base, n)

function fato(ytId: string, o: Partial<FatoRetencao> = {}): FatoRetencao {
  return {
    youtube_video_id: ytId,
    video_id: `uuid-${ytId}`,
    site_id: 'site-1',
    duration_seconds: 600,
    publicado_dia_pt: d(-60),
    fonte_ate: d(-1),
    views_total: 100,
    ultimo_dia_com_view: d(-3),
    views_7d: null,
    views_30d: null,
    vida_window_end: null,
    vida_collected_at: null,
    vida_views_at_read: null,
    tem_7d: false,
    tem_30d: false,
    primeira_tent_dia: null,
    leva_ancora_dia: null,
    diario_tent_dia: null,
    diario_tent_resultado: null,
    diario_falhas_4d: 0,
    vida_tent_dia: null,
    vida_tent_resultado: null,
    vida_resposta_dia: null,
    d7_tent_dia: null,
    d7_tent_resultado: null,
    d7_resposta_dia: null,
    d30_tent_dia: null,
    d30_tent_resultado: null,
    d30_resposta_dia: null,
    ...o,
  }
}

function rodar(fatos: FatoRetencao[], o: { hojePt?: string; hojeUtc?: string; janelasDesde?: string; vencimentoDias?: number; levaDias?: number } = {}): Decisao {
  return decidirRetencao(fatos, { hojePt: HOJE, hojeUtc: UTC, ...o })
}

const ids = (l: readonly Leitura[]) => l.map(x => `${x.ytId}:${x.janela}`)
const emEpoca = (dia: string) => diffDias('1970-01-01', dia)

/** Um id cujo dia da leva é (ou não é) o de hoje, para os testes que dependem da leva. */
function idDaLeva(hojeUtc: string, hoje: boolean, prefixo = 'v'): string {
  const alvo = ((emEpoca(hojeUtc) % 7) + 7) % 7
  for (let i = 0; i < 5000; i++) {
    const id = `${prefixo}${i}`
    if ((diaDaLeva(id) === alvo) === hoje) return id
  }
  throw new Error('sem id')
}

/** Estado "linha gravada há `dias` dias, lida em 100 views, com a última tentativa respondida". */
function comLinha(ytId: string, dias: number, o: Partial<FatoRetencao> = {}): FatoRetencao {
  const dia = d(-dias, UTC)
  return fato(ytId, {
    vida_window_end: d(-dias - 1),
    vida_collected_at: `${dia}T12:00:00.000Z`,
    vida_views_at_read: 100,
    vida_tent_dia: dia,
    vida_tent_resultado: 'ok',
    vida_resposta_dia: dia,
    primeira_tent_dia: dia,
    views_total: 150,
    ...o,
  })
}

describe('constantes', () => {
  it('os números do contrato', () => {
    expect(RETENCAO).toEqual({ vencimentoDias: 7, levaDias: 7, viewRecenteDias: 14, diarioAtrasadoDias: 7, videoNovoDias: 5, janelaDesisteDias: 45, margemDaFonteDias: 3 })
    expect(RETENCAO_JANELAS_DESDE).toBe('2026-10-13')
  })
})

describe('decidirRetencao: casos de borda', () => {
  it('lista vazia: decisão vazia', () => {
    expect(rodar([])).toEqual({ ler: [], semDiarioEmDia: [], semRespostaDoYoutube: [], pane: false, novos: [], adiadosPelaLeva: 0 })
  })

  it('vídeo publicado hoje, sem diário: novo, nada lido, não é falha', () => {
    const r = rodar([fato('hoje', { publicado_dia_pt: HOJE, fonte_ate: null, views_total: null, ultimo_dia_com_view: null })])
    expect(r.novos).toEqual(['hoje'])
    expect(r.ler).toEqual([])
    expect(r.semDiarioEmDia).toEqual([])
  })

  it('vídeo de 2 dias sem diário: novo; não é falha', () => {
    const r = rodar([fato('n2', { publicado_dia_pt: d(-2), fonte_ate: null, views_total: null })])
    expect(r.novos).toEqual(['n2'])
    expect(r.semDiarioEmDia).toEqual([])
  })

  it('vídeo de 5 dias sem diário já não é novo: está sem diário em dia', () => {
    const r = rodar([fato('n5', { publicado_dia_pt: d(-5), fonte_ate: null, views_total: null })])
    expect(r.novos).toEqual([])
    expect(r.semDiarioEmDia).toEqual(['n5'])
  })

  it('vídeo sem data de publicação: a forma é recusada, ele não é lido nem some em silêncio', () => {
    const item = { ...fato('sem-data'), publicado_dia_pt: null }
    expect(() => lerFatos([item])).toThrow()
  })

  it('lê a mesma coisa quando há ordem de entrada diferente', () => {
    const a = fato('a1'); const b = fato('b1')
    expect(ids(rodar([a, b]).ler)).toEqual(ids(rodar([b, a]).ler))
  })
})

describe('decidirRetencao: vida, nunca tentado', () => {
  it('com view há 3 dias: lê hoje, prioridade 0', () => {
    const r = rodar([fato('v1', { ultimo_dia_com_view: d(-3) })])
    expect(r.ler).toHaveLength(1)
    expect(r.ler[0]).toMatchObject({
      ytId: 'v1', videoId: 'uuid-v1', siteId: 'site-1', janela: 'vida', kind: 'retencao_vida',
      inicio: d(-60), fim: HOJE, windowEnd: d(-1), viewsAtRead: 100, prioridade: 0,
    })
  })

  it('fronteira da view recente: 14 dias lê (prioridade 0), 15 dias vai para a leva', () => {
    const fora = idDaLeva(UTC, false, 'f')
    expect(rodar([fato(fora, { ultimo_dia_com_view: d(-14) })]).ler[0]?.prioridade).toBe(0)
    const r = rodar([fato(fora, { ultimo_dia_com_view: d(-15) })])
    expect(r.ler).toEqual([])
    expect(r.adiadosPelaLeva).toBe(1)
  })

  it('sem view recente, no dia da sua leva: lê, prioridade 2', () => {
    const id = idDaLeva(UTC, true)
    const r = rodar([fato(id, { ultimo_dia_com_view: d(-40) })])
    expect(r.ler.map(x => x.prioridade)).toEqual([2])
    expect(r.adiadosPelaLeva).toBe(0)
  })

  it('sem view recente, fora do dia da leva: não lê; adiadosPelaLeva = 1', () => {
    const id = idDaLeva(UTC, false)
    const r = rodar([fato(id, { ultimo_dia_com_view: d(-40) })])
    expect(r.ler).toEqual([])
    expect(r.adiadosPelaLeva).toBe(1)
  })

  it('em 7 dias seguidos, todo vídeo nunca tentado é lido exatamente uma vez (35 ids, 7 chamadas)', () => {
    const fatos = Array.from({ length: 35 }, (_, i) => fato(`id${String(i).padStart(2, '0')}`, { ultimo_dia_com_view: d(-40) }))
    const lidos: string[] = []
    for (let i = 0; i < 7; i++) {
      const hojeUtc = d(i, UTC)
      lidos.push(...rodar(fatos, { hojeUtc }).ler.map(x => x.ytId))
    }
    expect(lidos).toHaveLength(35)
    expect(new Set(lidos).size).toBe(35)
  })

  it('zero views na vida (ultimo_dia_com_view nulo) entra na leva como os outros', () => {
    const certo = idDaLeva(UTC, true, 'z')
    const errado = idDaLeva(UTC, false, 'z')
    const r = rodar([fato(certo, { views_total: 0, ultimo_dia_com_view: null }), fato(errado, { views_total: 0, ultimo_dia_com_view: null })])
    expect(r.ler.map(x => x.ytId)).toEqual([certo])
    expect(r.ler[0]).toMatchObject({ prioridade: 2, viewsAtRead: 0 })
    expect(r.adiadosPelaLeva).toBe(1)
  })

  it('leva do canal acabada (âncora há 7 dias), fora do seu dia: lê hoje, prioridade 2', () => {
    const id = idDaLeva(UTC, false)
    const r = rodar([fato(id, { ultimo_dia_com_view: d(-40), leva_ancora_dia: d(-7, UTC) })])
    expect(r.ler.map(x => x.prioridade)).toEqual([2])
    expect(r.adiadosPelaLeva).toBe(0)
  })

  it('idem, âncora há 6 dias: não lê; adiadosPelaLeva = 1', () => {
    const id = idDaLeva(UTC, false)
    const r = rodar([fato(id, { ultimo_dia_com_view: d(-40), leva_ancora_dia: d(-6, UTC) })])
    expect(r.ler).toEqual([])
    expect(r.adiadosPelaLeva).toBe(1)
  })

  it('idem, âncora nula (primeira execução): segue o dia da leva', () => {
    const id = idDaLeva(UTC, false)
    const r = rodar([fato(id, { ultimo_dia_com_view: d(-40), leva_ancora_dia: null })])
    expect(r.ler).toEqual([])
    expect(r.adiadosPelaLeva).toBe(1)
  })

  it('levaDias: 1 lê todos os nunca tentados de uma vez; sem a opção o padrão é 7', () => {
    const fatos = Array.from({ length: 35 }, (_, i) => fato(`id${String(i).padStart(2, '0')}`, { ultimo_dia_com_view: d(-40) }))
    expect(rodar(fatos, { levaDias: 1 }).ler).toHaveLength(35)
    const padrao = rodar(fatos)
    expect(padrao).toEqual(rodar(fatos, { levaDias: undefined }))
    expect(padrao).toEqual(rodar(fatos, { levaDias: 7 }))
    expect(padrao.ler.length).toBeGreaterThan(0)
    expect(padrao.ler.length).toBeLessThan(15)
    expect(padrao.ler.length + padrao.adiadosPelaLeva).toBe(35)
  })

  it('a âncora usa o levaDias de quem chama (levaDias: 3, âncora há 3 dias)', () => {
    const id = idDaLeva(UTC, false)
    // Com 3 dias de leva, o dia do vídeo é hash%3 contra época%3: se não for hoje, a âncora de 3 dias o libera.
    const r = rodar([fato(id, { ultimo_dia_com_view: d(-40), leva_ancora_dia: d(-3, UTC) })], { levaDias: 3 })
    expect(r.ler.map(x => x.prioridade)).toEqual([2])
  })

  it('diaDaLeva é estável e fica entre 0 e 6', () => {
    for (const id of ['a', 'b', 'abcdefghijk', 'ZZZZZZZZZZZ']) {
      const n = diaDaLeva(id)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThanOrEqual(6)
      expect(diaDaLeva(id)).toBe(n)
    }
  })
})

describe('decidirRetencao: vida, com linha', () => {
  it('linha de 6 dias e views novas: não lê', () => {
    expect(rodar([comLinha('l6', 6)]).ler).toEqual([])
  })

  it('linha de 7 dias e views novas: lê (prioridade 1, windowEnd = fonte_ate)', () => {
    const r = rodar([comLinha('l7', 7)])
    expect(r.ler).toHaveLength(1)
    expect(r.ler[0]).toMatchObject({ janela: 'vida', prioridade: 1, windowEnd: d(-1), viewsAtRead: 150 })
  })

  it('linha de 7 dias e SEM views novas (item 60): não lê', () => {
    expect(rodar([comLinha('l7s', 7, { views_total: 100 })]).ler).toEqual([])
  })

  it('linha de 30 dias, sem views novas: não lê', () => {
    expect(rodar([comLinha('l30', 30, { views_total: 100 })]).ler).toEqual([])
  })

  it('linha com views_total desconhecido: não lê', () => {
    expect(rodar([comLinha('lnu', 10, { views_total: null })]).ler).toEqual([])
  })

  it('linha cujo views_at_read é nulo: lê aos 7 dias, não antes', () => {
    expect(rodar([comLinha('lna', 7, { vida_views_at_read: null, views_total: 100 })]).ler).toHaveLength(1)
    expect(rodar([comLinha('lna', 6, { vida_views_at_read: null, views_total: 100 })]).ler).toEqual([])
  })

  it('views novas, mas a fonte não andou desde a leitura (windowEnd igual): não lê', () => {
    expect(rodar([comLinha('lf', 7, { vida_window_end: d(-1) })]).ler).toEqual([])
  })

  it('a base dos 7 dias é a mais recente entre vida_collected_at e vida_resposta_dia', () => {
    // coletada há 10 dias, mas a última resposta foi há 3: ainda não venceu.
    const f = comLinha('lb', 10, { vida_resposta_dia: d(-3, UTC), vida_tent_dia: d(-3, UTC) })
    expect(rodar([f]).ler).toEqual([])
  })

  it('linha gravada sem nenhuma tentativa (m-1): não lê antes de 7 dias; lê aos 7 com views novas', () => {
    const sem = (dias: number) => comLinha('lm', dias, { vida_tent_dia: null, vida_tent_resultado: null, vida_resposta_dia: null })
    expect(rodar([sem(6)]).ler).toEqual([])
    const r = rodar([sem(7)])
    expect(r.ler).toHaveLength(1)
    expect(r.ler[0]?.prioridade).toBe(1)
  })
})

describe('decidirRetencao: vida, resposta vazia e tentativa sem resposta', () => {
  const vazia = (dias: number, o: Partial<FatoRetencao> = {}) => {
    const dia = d(-dias, UTC)
    return fato('rv', { vida_tent_dia: dia, vida_tent_resultado: 'sem_dado_na_janela', vida_resposta_dia: dia, primeira_tent_dia: dia, ...o })
  }

  it('resposta vazia há 7 dias, view depois dela: lê (prioridade 1)', () => {
    const r = rodar([vazia(7, { ultimo_dia_com_view: d(-2) })])
    expect(r.ler.map(x => x.prioridade)).toEqual([1])
  })

  it('resposta vazia há 6 dias: ainda não lê', () => {
    expect(rodar([vazia(6, { ultimo_dia_com_view: d(-2) })]).ler).toEqual([])
  })

  it('resposta vazia há 7 dias, nenhuma view depois: não lê', () => {
    expect(rodar([vazia(7, { ultimo_dia_com_view: d(-40) })]).ler).toEqual([])
    expect(rodar([vazia(7, { ultimo_dia_com_view: null })]).ler).toEqual([])
  })

  it('fronteira da margem: view 3 dias antes da resposta conta, 4 dias antes não', () => {
    const resposta = d(-7, UTC)
    expect(rodar([vazia(7, { ultimo_dia_com_view: d(-3, resposta) })]).ler).toHaveLength(1)
    expect(rodar([vazia(7, { ultimo_dia_com_view: d(-4, resposta) })]).ler).toEqual([])
  })

  it('última tentativa sem resposta (ontem, erro_http): lê hoje, prioridade 0', () => {
    const r = rodar([fato('sr', { vida_tent_dia: d(-1, UTC), vida_tent_resultado: 'erro_http', vida_resposta_dia: null, ultimo_dia_com_view: d(-40) })])
    expect(r.ler.map(x => [x.ytId, x.prioridade])).toEqual([['sr', 0]])
  })

  it('tentativa de ontem que falhou, depois de uma resposta antiga: lê (prioridade 0)', () => {
    const r = rodar([fato('sr2', { vida_tent_dia: d(-1, UTC), vida_tent_resultado: 'erro_http', vida_resposta_dia: d(-3, UTC), ultimo_dia_com_view: d(-40) })])
    expect(r.ler.map(x => x.prioridade)).toEqual([0])
  })

  it('a tentativa de ontem que falhou NÃO conta como leitura: a linha de 3 dias segue valendo só pela regra dos 7 dias', () => {
    // tem linha de 3 dias; ontem falhou. Fonte andou: lê (a). Fonte parada: não lê.
    const base = { vida_window_end: d(-5), vida_collected_at: `${d(-3, UTC)}T12:00:00.000Z`, vida_views_at_read: 100, vida_tent_dia: d(-1, UTC), vida_tent_resultado: 'erro_http', vida_resposta_dia: d(-3, UTC) }
    expect(rodar([fato('x', { ...base, fonte_ate: d(-1) })]).ler.map(x => x.prioridade)).toEqual([0])
    expect(rodar([fato('x', { ...base, fonte_ate: d(-5) })]).ler).toEqual([])
  })

  it('última tentativa sem resposta, com linha, e a fonte não andou (m3): não lê', () => {
    const r = rodar([comLinha('m3', 10, { vida_window_end: d(-1), vida_tent_dia: d(-1, UTC), vida_tent_resultado: 'erro_http' })])
    expect(r.ler).toEqual([])
  })

  it('idem, a fonte andou um dia: lê, prioridade 0', () => {
    const r = rodar([comLinha('m3', 10, { vida_window_end: d(-2), vida_tent_dia: d(-1, UTC), vida_tent_resultado: 'erro_http' })])
    expect(r.ler.map(x => x.prioridade)).toEqual([0])
  })

  it('fonte menos recente que hoje: windowEnd é o menor entre hojePt e fonte_ate', () => {
    const r = rodar([fato('w', { fonte_ate: d(-3) })])
    expect(r.ler[0]?.windowEnd).toBe(d(-3))
    const r2 = rodar([fato('w', { fonte_ate: HOJE })])
    expect(r2.ler[0]?.windowEnd).toBe(HOJE)
  })
})

describe('decidirRetencao: diário parado (separarPermanentes)', () => {
  const parado = (ytId: string, dias: number, falhas = 0, o: Partial<FatoRetencao> = {}) =>
    fato(ytId, { fonte_ate: d(-dias), diario_falhas_4d: falhas, ...o })
  const saudaveis = (n: number) => Array.from({ length: n }, (_, i) => fato(`ok${String(i).padStart(2, '0')}`))

  it('diário parado há 8 dias: semDiarioEmDia; não lê', () => {
    const r = rodar([parado('p8', 8)])
    expect(r.semDiarioEmDia).toEqual(['p8'])
    expect(r.ler).toEqual([])
  })

  it('diário parado há 7 dias ainda está em dia', () => {
    const r = rodar([parado('p7', 7)])
    expect(r.semDiarioEmDia).toEqual([])
    expect(r.ler.map(x => x.ytId)).toEqual(['p7'])
  })

  it('sem diário há 8, 9 e 10 dias, com 4 falhas do diário: vermelho nos três', () => {
    const r = rodar([parado('p8', 8, 4), parado('p9', 9, 4), parado('p10', 10, 4), ...saudaveis(32)])
    expect(r.semDiarioEmDia).toEqual(['p10', 'p8', 'p9'])
    expect(r.semRespostaDoYoutube).toEqual([])
  })

  it('sem diário há 11 dias, 4 falhas, 1 de 35: semRespostaDoYoutube; não está em semDiarioEmDia', () => {
    const r = rodar([parado('p11', 11, 4), ...saudaveis(34)])
    expect(r.semRespostaDoYoutube).toEqual(['p11'])
    expect(r.semDiarioEmDia).toEqual([])
    expect(r.pane).toBe(false)
  })

  it('sem diário há 30 dias, só 3 falhas: semDiarioEmDia', () => {
    const r = rodar([parado('p30', 30, 3), ...saudaveis(34)])
    expect(r.semDiarioEmDia).toEqual(['p30'])
    expect(r.semRespostaDoYoutube).toEqual([])
  })

  it('18 de 35 sem diário há 30 dias, 4 falhas: todos em semDiarioEmDia; pane', () => {
    const quebrados = Array.from({ length: 18 }, (_, i) => parado(`q${String(i).padStart(2, '0')}`, 30, 4))
    const r = rodar([...quebrados, ...saudaveis(17)])
    expect(r.semDiarioEmDia).toHaveLength(18)
    expect(r.semRespostaDoYoutube).toEqual([])
    expect(r.pane).toBe(true)
  })

  it('17 de 35 (menos da metade): não é pane', () => {
    const quebrados = Array.from({ length: 17 }, (_, i) => parado(`q${String(i).padStart(2, '0')}`, 30, 4))
    const r = rodar([...quebrados, ...saudaveis(18)])
    expect(r.pane).toBe(false)
    expect(r.semRespostaDoYoutube).toHaveLength(17)
  })

  it('N1: sem diário há 11 dias; o diário falhou 4 dias por erro nosso, e por isso o fato traz diario_falhas_4d 0; 1 de 35: vermelho', () => {
    const r = rodar([parado('n1', 11, 0, { diario_tent_dia: d(-1, UTC), diario_tent_resultado: 'erro_de_banco' }), ...saudaveis(34)])
    expect(r.semDiarioEmDia).toEqual(['n1'])
    expect(r.semRespostaDoYoutube).toEqual([])
  })

  it('diasAtrasado: o primeiro dia de atraso é 0 (fonte há 8 dias), o terceiro é 2 e o quarto é 3', () => {
    // 4 falhas: só vira "sem resposta" a partir de diasAtrasado 3 (fonte há 11 dias).
    expect(rodar([parado('a', 10, 4), ...saudaveis(34)]).semRespostaDoYoutube).toEqual([])
    expect(rodar([parado('a', 11, 4), ...saudaveis(34)]).semRespostaDoYoutube).toEqual(['a'])
  })

  it('fonte_ate nulo, vídeo de 8 dias: diasAtrasado = 3 (idade - 5): com 4 falhas vira semRespostaDoYoutube', () => {
    const f = fato('nul', { publicado_dia_pt: d(-8), fonte_ate: null, views_total: null, diario_falhas_4d: 4 })
    expect(rodar([f, ...saudaveis(34)]).semRespostaDoYoutube).toEqual(['nul'])
    const g = fato('nul', { publicado_dia_pt: d(-7), fonte_ate: null, views_total: null, diario_falhas_4d: 4 })
    expect(rodar([g, ...saudaveis(34)]).semDiarioEmDia).toEqual(['nul'])
  })

  it('os vídeos novos (menos de 5 dias) não entram nos elegíveis do pane', () => {
    // 1 candidato; 1 elegível + 1 novo: o candidato é metade dos elegíveis (1 de 1): pane.
    const novo = fato('nv', { publicado_dia_pt: d(-2), fonte_ate: null, views_total: null })
    const r = rodar([parado('p', 30, 4), novo])
    expect(r.pane).toBe(true)
    expect(r.novos).toEqual(['nv'])
  })
})

describe('decidirRetencao: janelas dos primeiros 7 e 30 dias', () => {
  // publicado em 2026-10-07: fim7 = 2026-10-13, fim30 = 2026-11-05.
  const PUB = '2026-10-07'
  const FIM7 = d(6, PUB)
  const FIM30 = d(29, PUB)
  const so = (r: Decisao, j: Janela) => r.ler.filter(x => x.janela === j)
  // `vida_tent_dia` de hoje cobre a vida: o foco aqui é a janela.
  const janela = (hoje: string, o: Partial<FatoRetencao> = {}) =>
    fato('j', {
      publicado_dia_pt: PUB, fonte_ate: d(-1, hoje), views_total: 500, views_7d: 70, views_30d: 300,
      ultimo_dia_com_view: d(-1, hoje), ...o,
    })

  it('7 dias: fechou e a fonte já passou do fim: lê retencao_7d com inicio e fim certos', () => {
    const hoje = d(1, FIM7)
    const r = rodar([janela(hoje, { fonte_ate: FIM7 })], { hojePt: hoje, hojeUtc: hoje })
    expect(so(r, 'primeiros_7_dias')).toEqual([{
      ytId: 'j', videoId: 'uuid-j', siteId: 'site-1', janela: 'primeiros_7_dias', kind: 'retencao_7d',
      inicio: PUB, fim: FIM7, windowEnd: FIM7, viewsAtRead: 70, prioridade: 1,
    }])
  })

  it('7 dias: a fonte ainda não chegou ao fim: não lê; chegando ao fim, lê (os dois lados)', () => {
    const hoje = d(8, FIM7)
    expect(so(rodar([janela(hoje, { fonte_ate: d(-1, FIM7) })], { hojePt: d(2, FIM7), hojeUtc: d(2, FIM7) }), 'primeiros_7_dias')).toEqual([])
    expect(so(rodar([janela(hoje, { fonte_ate: FIM7 })], { hojePt: d(2, FIM7), hojeUtc: d(2, FIM7) }), 'primeiros_7_dias')).toHaveLength(1)
  })

  it('7 dias: fechada antes de janelasDesde (decisão 32): nunca lê; no dia exato, lê', () => {
    const hoje = d(1, FIM7)
    const f = janela(hoje, { fonte_ate: FIM7 })
    expect(so(rodar([f], { hojePt: hoje, hojeUtc: hoje, janelasDesde: d(1, FIM7) }), 'primeiros_7_dias')).toEqual([])
    expect(so(rodar([f], { hojePt: hoje, hojeUtc: hoje, janelasDesde: FIM7 }), 'primeiros_7_dias')).toHaveLength(1)
  })

  it('janelasDesde tem o padrão RETENCAO_JANELAS_DESDE quando a opção não vem', () => {
    // fim 2026-10-12 é um dia antes do padrão (2026-10-13): nunca lê. Fim 2026-10-13: lê.
    const hoje = '2026-10-20'
    const antes = fato('j', { publicado_dia_pt: '2026-10-06', fonte_ate: '2026-10-12', views_7d: 1, ultimo_dia_com_view: '2026-10-12' })
    const no = fato('j', { publicado_dia_pt: '2026-10-07', fonte_ate: '2026-10-13', views_7d: 1, ultimo_dia_com_view: '2026-10-13' })
    expect(so(rodar([antes], { hojePt: hoje, hojeUtc: hoje }), 'primeiros_7_dias')).toEqual([])
    expect(so(rodar([no], { hojePt: hoje, hojeUtc: hoje }), 'primeiros_7_dias')).toHaveLength(1)
  })

  it('7 dias: já há linha: não lê', () => {
    const hoje = d(1, FIM7)
    expect(so(rodar([janela(hoje, { fonte_ate: FIM7, tem_7d: true })], { hojePt: hoje, hojeUtc: hoje }), 'primeiros_7_dias')).toEqual([])
  })

  it('7 dias: resposta vazia há 3 dias não lê; há 6 não lê; há 7 lê', () => {
    const hoje = d(10, FIM7)
    const com = (dias: number) =>
      janela(hoje, { d7_tent_dia: d(-dias, hoje), d7_tent_resultado: 'sem_dado_na_janela', d7_resposta_dia: d(-dias, hoje) })
    const lido = (dias: number) => so(rodar([com(dias)], { hojePt: hoje, hojeUtc: hoje }), 'primeiros_7_dias').length
    expect([lido(3), lido(6), lido(7)]).toEqual([0, 0, 1])
  })

  it('7 dias: última tentativa sem resposta lê já no dia seguinte', () => {
    const hoje = d(10, FIM7)
    const f = janela(hoje, { d7_tent_dia: d(-1, hoje), d7_tent_resultado: 'erro_http', d7_resposta_dia: null })
    expect(so(rodar([f], { hojePt: hoje, hojeUtc: hoje }), 'primeiros_7_dias')).toHaveLength(1)
  })

  it('7 dias: até 45 dias depois do fim lê; 46 dias depois, não lê mais', () => {
    const f = (hoje: string) => janela(hoje, { fonte_ate: d(-1, hoje) })
    const lido = (hoje: string) => so(rodar([f(hoje)], { hojePt: hoje, hojeUtc: hoje }), 'primeiros_7_dias').length
    expect([lido(d(45, FIM7)), lido(d(46, FIM7))]).toEqual([1, 0])
  })

  it('30 dias: independe da de 7 (a de 7 já gravada não segura a de 30)', () => {
    const hoje = d(1, FIM30)
    const f = janela(hoje, { fonte_ate: FIM30, tem_7d: true })
    const r = rodar([f], { hojePt: hoje, hojeUtc: hoje })
    expect(so(r, 'primeiros_7_dias')).toEqual([])
    expect(so(r, 'primeiros_30_dias')).toEqual([{
      ytId: 'j', videoId: 'uuid-j', siteId: 'site-1', janela: 'primeiros_30_dias', kind: 'retencao_30d',
      inicio: PUB, fim: FIM30, windowEnd: FIM30, viewsAtRead: 300, prioridade: 1,
    }])
  })

  it('30 dias: a fonte antes do fim (29 dias) não lê; no fim, lê', () => {
    const hoje = d(2, FIM30)
    const lido = (fonte: string) => so(rodar([janela(hoje, { fonte_ate: fonte, tem_7d: true })], { hojePt: hoje, hojeUtc: hoje }), 'primeiros_30_dias').length
    expect([lido(d(-1, FIM30)), lido(FIM30)]).toEqual([0, 1])
  })

  it('30 dias: 45 dias depois do fim lê, 46 não', () => {
    const lido = (hoje: string) => so(rodar([janela(hoje, { tem_7d: true })], { hojePt: hoje, hojeUtc: hoje }), 'primeiros_30_dias').length
    expect([lido(d(45, FIM30)), lido(d(46, FIM30))]).toEqual([1, 0])
  })

  it('30 dias: já há linha de 30 dias, não lê; a de 7 sem linha lê', () => {
    const hoje = d(1, FIM30)
    const r = rodar([janela(hoje, { fonte_ate: FIM30, tem_30d: true })], { hojePt: hoje, hojeUtc: hoje })
    expect(so(r, 'primeiros_30_dias')).toEqual([])
    expect(so(r, 'primeiros_7_dias')).toHaveLength(1)
  })

  it('janela de um vídeo sem diário em dia não é lida', () => {
    const hoje = d(1, FIM7)
    const f = janela(hoje, { fonte_ate: d(-8, hoje) })
    const r = rodar([f], { hojePt: hoje, hojeUtc: hoje })
    expect(r.ler).toEqual([])
    expect(r.semDiarioEmDia).toEqual(['j'])
  })

  it('7 dias com views_7d nulo: lê com viewsAtRead nulo (nunca 0 por ausência)', () => {
    const hoje = d(1, FIM7)
    const r = rodar([janela(hoje, { fonte_ate: FIM7, views_7d: null })], { hojePt: hoje, hojeUtc: hoje })
    expect(so(r, 'primeiros_7_dias')[0]?.viewsAtRead).toBeNull()
  })
})

describe('decidirRetencao: virada do dia do Pacífico', () => {
  it('um minuto antes e na meia-noite do Pacífico: a janela de 14 dias da view recente anda um dia', () => {
    const antes = dayPt(new Date('2026-10-14T06:59:00Z'))
    const depois = dayPt(new Date('2026-10-14T07:00:00Z'))
    expect([antes, depois]).toEqual(['2026-10-13', '2026-10-14'])
    const fora = idDaLeva('2026-10-14', false, 'p')
    const f = fato(fora, { ultimo_dia_com_view: '2026-09-29', fonte_ate: '2026-10-12', publicado_dia_pt: '2026-06-01' })
    expect(rodar([f], { hojePt: antes, hojeUtc: '2026-10-14' }).ler.map(x => x.prioridade)).toEqual([0])
    const r = rodar([f], { hojePt: depois, hojeUtc: '2026-10-14' })
    expect(r.ler).toEqual([])
    expect(r.adiadosPelaLeva).toBe(1)
  })

  it('o fim da vida é o dia do Pacífico, e o vencimento conta em dias UTC', () => {
    const hojePt = dayPt(new Date('2026-10-14T06:59:00Z'))
    const r = rodar([fato('t')], { hojePt, hojeUtc: '2026-10-14' })
    expect(r.ler[0]).toMatchObject({ fim: '2026-10-13' })
  })
})

describe('decidirRetencao: vencimentoDias', () => {
  it('padrão 7 quando a opção não vem; vencimentoDias: 3 antecipa', () => {
    const f = comLinha('vd', 3)
    expect(rodar([f]).ler).toEqual([])
    expect(rodar([f], { vencimentoDias: 3 }).ler).toHaveLength(1)
    expect(rodar([f], { vencimentoDias: undefined }).ler).toEqual([])
  })
})

describe('decidirRetencao: ordem', () => {
  it('prioridade primeiro, depois id', () => {
    const p2 = idDaLeva(UTC, true, 'a')
    const r = rodar([
      fato('zz', { ultimo_dia_com_view: d(-2) }),                    // prioridade 0
      fato(p2, { ultimo_dia_com_view: d(-40) }),                     // prioridade 2
      comLinha('mm', 7),                                              // prioridade 1
      fato('aa0', { ultimo_dia_com_view: d(-2) }),                   // prioridade 0
      comLinha('bb', 7),                                              // prioridade 1
    ])
    expect(r.ler.map(x => [x.ytId, x.prioridade])).toEqual([['aa0', 0], ['zz', 0], ['bb', 1], ['mm', 1], [p2, 2]])
  })

  it('na mesma prioridade: nunca tentado primeiro, depois tentativa mais antiga, depois id (8-3)', () => {
    const sem = (id: string, tent: string | null) => fato(id, {
      ultimo_dia_com_view: d(-2),
      vida_tent_dia: tent,
      vida_tent_resultado: tent === null ? null : 'erro_http',
    })
    const r = rodar([sem('aa', d(-1, UTC)), sem('bb', d(-3, UTC)), sem('cc', null), sem('dd', d(-3, UTC)), sem('00', d(-1, UTC)), sem('zz', null)])
    expect(r.ler.map(x => x.ytId)).toEqual(['cc', 'zz', 'bb', 'dd', '00', 'aa'])
  })

  it('sem fome: com K leituras por dia e os K primeiros ids sempre falhando, todo vídeo é tentado em ceil(N/K) dias (8-3)', () => {
    const N = 10
    const K = 3
    const todos = Array.from({ length: N }, (_, i) => `v${String(i).padStart(2, '0')}`)
    const falham = new Set(todos.slice(0, K))
    const estado = new Map<string, FatoRetencao>(todos.map(id => [id, fato(id, { ultimo_dia_com_view: d(-2) })]))
    const tentados = new Set<string>()
    const dias = Math.ceil(N / K)
    for (let i = 0; i < dias; i++) {
      const hoje = d(i)
      const fatos = [...estado.values()].map(f => ({ ...f, fonte_ate: d(-1, hoje), ultimo_dia_com_view: d(-2, hoje) }))
      const r = decidirRetencao(fatos, { hojePt: hoje, hojeUtc: hoje })
      for (const l of r.ler.slice(0, K)) {
        tentados.add(l.ytId)
        const f = estado.get(l.ytId) as FatoRetencao
        estado.set(l.ytId, falham.has(l.ytId)
          ? { ...f, vida_tent_dia: hoje, vida_tent_resultado: 'erro_http' }
          : { ...f, vida_tent_dia: hoje, vida_tent_resultado: 'ok', vida_resposta_dia: hoje, vida_window_end: d(-1, hoje), vida_collected_at: `${hoje}T12:00:00.000Z`, vida_views_at_read: 100 })
      }
    }
    expect([...tentados].sort()).toEqual(todos)
  })

  it('um vídeo pode render a vida e as duas janelas; a ordem é prioridade, id e janela estável', () => {
    const hoje = d(1, d(29, '2026-10-07'))
    const f = fato('tri', { publicado_dia_pt: '2026-10-07', fonte_ate: d(29, '2026-10-07'), views_7d: 70, views_30d: 300, ultimo_dia_com_view: d(29, '2026-10-07') })
    const r = rodar([f], { hojePt: hoje, hojeUtc: hoje })
    expect(r.ler.map(x => x.janela)).toEqual(['vida', 'primeiros_7_dias', 'primeiros_30_dias'])
  })
})

describe('lerFatos', () => {
  const bom = () => ({ ...fato('ok1') })

  it('aceita a forma completa, inclusive todos os nulos permitidos', () => {
    expect(lerFatos([bom()])).toEqual([bom()])
    expect(lerFatos([])).toEqual([])
  })

  it('aceita números e datas como o banco os devolve', () => {
    const r = lerFatos([{ ...bom(), vida_collected_at: '2026-10-06T12:34:56.789+00:00', views_total: 1234567890123, vida_window_end: '2026-10-06', vida_views_at_read: 10 }])
    expect(r[0]?.views_total).toBe(1234567890123)
  })

  it.each([
    ['não é lista', { a: 1 }],
    ['é null', null],
    ['item não é objeto', [1]],
    ['campo faltando (site_id)', [(() => { const { site_id: _s, ...resto } = bom(); return resto })()]],
    ['campo faltando (diario_falhas_4d)', [(() => { const { diario_falhas_4d: _s, ...resto } = bom(); return resto })()]],
    ['campo faltando (leva_ancora_dia)', [(() => { const { leva_ancora_dia: _s, ...resto } = bom(); return resto })()]],
    ['views_total como texto', [{ ...bom(), views_total: '100' }]],
    ['diario_falhas_4d como texto', [{ ...bom(), diario_falhas_4d: '4' }]],
    ['diario_falhas_4d nulo', [{ ...bom(), diario_falhas_4d: null }]],
    ['views negativas', [{ ...bom(), views_total: -1 }]],
    ['tem_7d como texto', [{ ...bom(), tem_7d: 'false' }]],
    ['data em formato errado', [{ ...bom(), fonte_ate: '13/10/2026' }]],
    ['data inexistente (mês 13)', [{ ...bom(), fonte_ate: '2026-13-45' }]],
    ['data inexistente (30 de fevereiro)', [{ ...bom(), publicado_dia_pt: '2026-02-30' }]],
    ['publicado_dia_pt nulo', [{ ...bom(), publicado_dia_pt: null }]],
    ['youtube_video_id vazio', [{ ...bom(), youtube_video_id: '' }]],
    ['vida_collected_at ilegível', [{ ...bom(), vida_collected_at: 'ontem' }]],
    ['um item bom e um ruim', [bom(), { ...bom(), site_id: 5 }]],
  ])('lança: %s', (_nome, entrada) => {
    expect(() => lerFatos(entrada)).toThrow()
  })

  it('a mensagem do erro não carrega o conteúdo do item', () => {
    try {
      lerFatos([{ ...bom(), views_total: 'SEGREDO-123' }])
      throw new Error('devia lançar')
    } catch (e) {
      expect((e as Error).message).not.toContain('SEGREDO-123')
    }
  })
})
