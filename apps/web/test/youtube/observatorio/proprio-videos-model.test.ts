// @vitest-environment node
// A4 Tarefa 7: o modelo dos vídeos do canal próprio (três colunas: views, impressões, múltiplo; a terceira linha em contagem de
// cliques; ordenação por impressões). Este sistema falha em VERDE: cada caso afirma o valor nulo E a frase, nunca um padrão.
// O dado ausente tem teste próprio por estado (negado, erro, sem relatório, nada lido, vídeo sem linha, CTR nulo, sem diário).
import { afterEach, describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  proprioWorld, mundoSemProprio, DADOS, CHEIO, alcanceComLinhas, alcanceSoVazios, alcanceNadaLido, alcanceVazio, diarioCheio, type CenarioDados,
} from './proprio-fixture'
import {
  buildProprioVideos, SEM_VIEWS_DIARIAS, type ProprioVideoView, type ProprioVideosView,
} from '@/app/cms/(authed)/youtube/competitors/_proprio/videos-model'
import { buildProprioHeader, FRASE_ERRO, FRASE_NADA_LIDO, FRASE_NEGADO, FRASE_SEM_RELATORIO } from '@/app/cms/(authed)/youtube/competitors/_proprio/header-model'
import { VPD_SO_LONGOS, dmDia } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import { vpdText } from '@/app/cms/(authed)/youtube/competitors/_canal/numeros'
import { montarLista } from '@/app/cms/(authed)/youtube/competitors/_canal/lista'
import { CANAL_DEFAULT, parseCanalState, canalQuery } from '@/app/cms/(authed)/youtube/competitors/_canal/params'
import { link } from '@/lib/youtube/observatorio/links'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { DadosDoCanal } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import type { AlcanceLinha } from '@/lib/youtube/observatorio/proprio/tipos'

// Arquivo todo síncrono: uma macrotarefa por teste, para o executor do Vitest responder no CI (ver canais-a3-posicao.test.ts).
afterEach(() => new Promise<void>(r => setTimeout(r, 0)))

type World = ReturnType<typeof proprioWorld>
const BASE = proprioWorld() // a base do oráculo é lida uma vez por arquivo (a3-fixture guarda por preset)
const d = (n: number) => addDays(BASE.hoje, -n)

const build = (w: World = BASE, dados: DadosDoCanal = w.dados): ProprioVideosView => {
  const v = buildProprioVideos(w.obs, w.canalId, dados, { hoje: w.hoje, dm: w.dm })
  if (!v) throw new Error('o canal próprio devia ter modelo de vídeos')
  return v
}
const com = (alcance: ReturnType<typeof alcanceComLinhas>): DadosDoCanal => ({ alcance: { acesso: 'ok', dado: alcance }, diario: BASE.dados.diario })
const por = (v: ProprioVideosView, ytId: string): ProprioVideoView => {
  const x = v.videos.find(y => y.ytId === ytId)
  if (!x) throw new Error('vídeo inexistente: ' + ytId)
  return x
}
const SHORT = BASE.obs.videos.find(v => v.ch === BASE.canalId && v.fmt === 'short')!.ytId
const linha = (ytId: string, dia: number, imp: number | null, ctr: number | null): AlcanceLinha => ({ ytId, dia: d(dia), imp, ctr })
const [A, B, C] = BASE.ytIds as [string, string, string]

/** Todo texto que a tela pode mostrar para um vídeo, mais a nota do conjunto. */
function textos(v: ProprioVideosView): string[] {
  const out = [v.nota, v.semViewsDiarias, v.semVideos ?? '', v.motivoAlcance ?? '']
  // só o que a tela escreve (ids, urls e datas ISO não são texto de tela)
  const VISIVEIS = [
    'title', 'durText', 'ageText', 'pubTitle', 'viewsText', 'viewsMissing', 'multText', 'multWord', 'impText', 'impMissing', 'cliquesText', 'cliquesMissing',
    'terceira', 'vpdDiarioText', 'vpdDiarioMissing', 'semMedida', 'likesText', 'commentsText',
  ] as const
  for (const x of v.videos) {
    for (const k of VISIVEIS) { const val = x[k]; if (typeof val === 'string') out.push(val) }
    out.push(...x.notas, ...x.badges)
  }
  return out
}
const CENARIOS = Object.keys(DADOS) as CenarioDados[]

describe('terceira linha: a contagem do que as impressões permitem afirmar', () => {
  it('terceira linha: contagem de cliques e de dias, sem percentual e sem corte', () => {
    // A: 18 impressões em 6 dias e 2,4 cliques; B: 8 impressões em 4 dias e 0,2 clique
    const linhasA = [[5, 12, 0.2], [6, 1, 0], [7, 1, 0], [8, 1, 0], [9, 1, 0], [10, 2, 0]] as const
    const linhasB = [[5, 2, 0.025], [6, 2, 0.025], [7, 2, 0.025], [8, 2, 0.025]] as const
    const v = build(BASE, com(alcanceComLinhas(BASE.canalId, BASE.hoje, [
      ...linhasA.map(([n, i, c]) => linha(A, n, i, c)), ...linhasB.map(([n, i, c]) => linha(B, n, i, c)),
    ])))
    expect(por(v, A).imp).toBe(18)
    expect(por(v, A).terceira).toBe('2 cliques em 6 dias')
    expect(por(v, B).imp).toBe(8)
    expect(por(v, B).terceira).toBe('nenhum clique em 4 dias')
    // sem corte: 8 impressões (abaixo de 10) ainda dizem a contagem
    expect(por(v, B).terceira).not.toMatch(/poucas impressões/)
  })

  it('um clique, um dia: singular ("1 clique em 1 dia")', () => {
    const v = build(BASE, com(alcanceComLinhas(BASE.canalId, BASE.hoje, [linha(A, 5, 5, 0.2)])))
    expect(por(v, A).terceira).toBe('1 clique em 1 dia')
    expect(por(v, A).cliquesText).toBe('1')
    expect(por(v, A).impText).toBe('5')
  })

  it('CTR zero medido: "nenhum clique" e o número é "0"; clique positivo que arredonda a zero é "menos de 1" (como o cabeçalho)', () => {
    const v = build(BASE, com(alcanceComLinhas(BASE.canalId, BASE.hoje, [
      linha(A, 5, 20, 0), linha(A, 6, 10, 0), linha(B, 5, 8, 0.025),
    ])))
    expect(por(v, A).cliques).toBe(0)
    expect(por(v, A).cliquesText).toBe('0')
    expect(por(v, A).terceira).toBe('nenhum clique em 2 dias')
    expect(por(v, B).cliques).toBeCloseTo(0.2, 10)
    expect(por(v, B).cliquesText).toBe('menos de 1')
    expect(por(v, B).terceira).toBe('nenhum clique em 1 dia')
  })

  it('vídeo com impressões e CTR nulo: cliques null, "cliques: não medido", e as impressões continuam contadas', () => {
    const v = build(BASE, com(alcanceComLinhas(BASE.canalId, BASE.hoje, [linha(A, 5, 12, 0.2), linha(A, 6, 7, null), linha(B, 5, 5, 0.2)])))
    const a = por(v, A)
    expect(a.imp).toBe(19)
    expect(a.impText).toBe('19')
    expect(a.cliques).toBeNull()
    expect(a.cliquesText).toBeNull()
    expect(a.cliquesMissing).toBe('não medido')
    expect(a.terceira).toBe('cliques: não medido')
    // o outro vídeo não é contaminado
    expect(por(v, B).terceira).toBe('1 clique em 1 dia')
  })

  it('vídeo sem linha de alcance: imp null e "sem impressão no período"; nunca 0 impressões', () => {
    const w = BASE
    const v = build(w) // cheio: só os dois primeiros longos têm linha
    for (const id of w.ytIds.slice(2)) {
      const x = por(v, id)
      expect(x.imp).toBeNull()
      expect(x.impText).toBeNull()
      expect(x.impMissing).toBe('sem impressão')
      expect(x.cliques).toBeNull()
      expect(x.cliquesText).toBeNull()
      expect(x.cliquesMissing).toBe('sem impressão')
      expect(x.terceira).toBe('sem impressão no período')
    }
    // o Short também: o relatório é do canal inteiro, e ele não apareceu
    expect(por(v, SHORT).imp).toBeNull()
    expect(por(v, SHORT).terceira).toBe('sem impressão no período')
    expect(v.videos.some(x => x.impText === '0')).toBe(false)
  })

  it('linha de alcance com impressão nula ou zero não vira "0 impressões": é vídeo sem impressão', () => {
    const v = build(BASE, com(alcanceComLinhas(BASE.canalId, BASE.hoje, [linha(A, 5, 0, 0.1), linha(B, 5, null, null), linha(C, 5, 4, 0.5)])))
    expect(por(v, A).imp).toBeNull()
    expect(por(v, A).terceira).toBe('sem impressão no período')
    expect(por(v, B).imp).toBeNull()
    expect(por(v, B).impText).toBeNull()
    expect(por(v, C).imp).toBe(4)
    expect(por(v, C).terceira).toBe('2 cliques em 1 dia')
  })

  it('linha fora do período dos relatórios não conta', () => {
    const v = build(BASE, com(alcanceComLinhas(BASE.canalId, BASE.hoje, [linha(A, 40, 99, 0.5), linha(A, 5, 3, 0.1)])))
    expect(por(v, A).imp).toBe(3)
    expect(por(v, A).terceira).toBe('nenhum clique em 1 dia')
  })

  it('nenhuma terceira linha, em nenhum vídeo do fixture, contém "%"', () => {
    for (const c of CENARIOS) {
      const view = build(BASE, DADOS[c](BASE.canalId, BASE.ytIds, BASE.hoje))
      for (const x of view.videos) expect(x.terceira).not.toMatch(/%/)
    }
    const view = build(BASE)
    for (const x of view.videos) expect(x.terceira).not.toMatch(/%/)
    // a série cheia tem vídeos com cada uma das formas (contagem e ausência)
    expect(view.videos.filter(x => x.imp != null)).toHaveLength(CHEIO.videosCom)
    expect(view.videos.some(x => x.terceira === 'sem impressão no período')).toBe(true)
  })

  it('série cheia: impressões e cliques por vídeo somam ao cabeçalho, com o mesmo texto', () => {
    const view = build(BASE)
    const cab = buildProprioHeader(BASE.obs, BASE.canalId, BASE.dados, { hoje: BASE.hoje, dm: dmDia, posicao: null })!
    const imps = view.videos.map(x => x.imp).filter((x): x is number => x != null)
    const F = BASE.obs.fmt
    const soma = imps.reduce((s, x) => s + x, 0)
    expect(soma).toBe(CHEIO.imp)
    // o mesmo número, o mesmo texto: cabeçalho e linha do vídeo usam o mesmo formatador
    expect(cab.faixa.find(c => c.key === 'impressoes')!.value).toBe(F.num(soma))
    for (const x of view.videos) if (x.imp != null) expect(x.impText).toBe(F.num(x.imp))
    const cliquesSoma = view.videos.reduce((s, x) => s + (x.cliques ?? 0), 0)
    expect(cliquesSoma).toBeCloseTo(CHEIO.cliques, 8)
    expect(cab.todos.find(c => c.key === 'cliques')!.value).toBe(F.int(Math.round(cliquesSoma)))
    // 12 × 0,1 × 11 dias = 13,2 → "13"; 5 × 0,2 × 11 dias = 11 → "11"
    expect(por(view, A).cliquesText).toBe('13')
    expect(por(view, A).terceira).toBe('13 cliques em 11 dias')
    expect(por(view, B).cliquesText).toBe('11')
    expect(por(view, B).terceira).toBe('11 cliques em 11 dias')
  })
})

describe('o dado privado ausente: cada estado, cada coluna', () => {
  const NAO_OK = [
    ['negado', 'negado', FRASE_NEGADO, 'só quem edita vê'],
    ['erro', 'erro', FRASE_ERRO, 'leitura falhou'],
    ['vazio', 'vazio', FRASE_SEM_RELATORIO, 'sem relatório'],
  ] as const

  for (const [nome, cenario, frase, curta] of NAO_OK) {
    it(`alcance ${nome}: imp null em todos e o motivo UMA vez na nota, não em cada cartão`, () => {
      const v = build(BASE, DADOS[cenario](BASE.canalId, BASE.ytIds, BASE.hoje))
      expect(v.videos.length).toBeGreaterThan(0)
      expect(v.motivoAlcance).toBe(frase)
      // uma vez na nota
      expect(v.nota.split(frase)).toHaveLength(2)
      for (const x of v.videos) {
        expect(x.imp).toBeNull()
        expect(x.impText).toBeNull()
        expect(x.cliques).toBeNull()
        expect(x.cliquesText).toBeNull()
        expect(x.impMissing).toBe(curta)
        expect(x.cliquesMissing).toBe(curta)
        expect(x.terceira).toBe('')
        // nenhum cartão repete a frase do motivo
        for (const t of [x.impMissing, x.cliquesMissing, x.terceira, ...x.notas]) expect(t ?? '').not.toContain(frase)
      }
    })
  }

  it('alcance com relatórios, mas nenhum lido: o motivo é "nenhum dia do período foi lido ainda", imp null em todos', () => {
    const dados: DadosDoCanal = { alcance: { acesso: 'ok', dado: alcanceNadaLido(BASE.canalId, BASE.hoje) }, diario: BASE.dados.diario }
    const v = build(BASE, dados)
    expect(v.motivoAlcance).toBe(FRASE_NADA_LIDO)
    expect(v.nota.split(FRASE_NADA_LIDO)).toHaveLength(2)
    for (const x of v.videos) {
      expect(x.imp).toBeNull()
      expect(x.impMissing).toBe('ainda não lido')
      expect(x.cliquesMissing).toBe('ainda não lido')
      expect(x.terceira).toBe('')
    }
  })

  it('dias lidos e todos vazios (zero medido): não há motivo de leitura; cada vídeo diz "sem impressão no período"', () => {
    const dados: DadosDoCanal = { alcance: { acesso: 'ok', dado: alcanceSoVazios(BASE.canalId, BASE.hoje) }, diario: BASE.dados.diario }
    const v = build(BASE, dados)
    expect(v.motivoAlcance).toBeNull()
    for (const x of v.videos) {
      expect(x.imp).toBeNull()
      expect(x.impMissing).toBe('sem impressão')
      expect(x.terceira).toBe('sem impressão no período')
    }
  })

  it('série cheia lida: nenhum motivo de leitura', () => {
    expect(build(BASE).motivoAlcance).toBeNull()
  })

  it('tabela vazia no diário e no alcance ao mesmo tempo (canal novo): o modelo monta, sem número e com frases', () => {
    const v = build(BASE, { alcance: { acesso: 'ok', dado: alcanceVazio(BASE.canalId) }, diario: DADOS.vazio(BASE.canalId, BASE.ytIds, BASE.hoje).diario })
    for (const x of v.videos) {
      expect(x.imp).toBeNull()
      expect(x.vpdDiario).toBeNull()
      expect(x.vpdDiarioMissing).not.toBeNull()
    }
  })

  it('canal sem vídeos: semVideos diz a frase e a lista é vazia', () => {
    const w = proprioWorld({ mut: ds => { ds.videos = ds.videos.filter(x => x.ch !== ds.channels.find(c => c.own)!.id) } })
    const v = buildProprioVideos(w.obs, w.canalId, w.dados, { hoje: w.hoje, dm: w.dm })!
    expect(v.videos).toEqual([])
    expect(v.semVideos).toBe('Este canal ainda não tem vídeos sincronizados.')
  })

  it('canal que não é próprio (ou não existe): sem modelo', () => {
    const w = BASE
    const outro = w.obs.channels.find(c => !c.own)!
    expect(buildProprioVideos(w.obs, outro.id, w.dados, { hoje: w.hoje, dm: w.dm })).toBeNull()
    expect(buildProprioVideos(w.obs, 'nao-existe', w.dados, { hoje: w.hoje, dm: w.dm })).toBeNull()
    expect(buildProprioVideos(mundoSemProprio(), w.canalId, w.dados, { hoje: w.hoje, dm: w.dm })).toBeNull()
  })
})

describe('views por dia de cada vídeo (o número existe; a tela o explica em "Ações do vídeo", uma frase por vídeo)', () => {
  const vpdNota = (x: ProprioVideoView) => x.notas.filter(n => n.startsWith('Views por dia: '))

  it('diário cheio: o texto é o vpdText do resto do produto, e a nota diz a janela', () => {
    const v = build(BASE)
    const F = BASE.obs.fmt
    expect(por(v, A).vpdDiario).toBe(2)
    expect(por(v, A).vpdDiarioText).toBe(vpdText(2, F.num))
    expect(por(v, A).vpdDiarioText).toBe('2,0')
    expect(por(v, B).vpdDiarioText).toBe('4,0')
    const ultimo = d(2)
    expect(vpdNota(por(v, A))).toEqual([`Views por dia: 2,0, média de 28 dias com medida (de ${dmDia(addDays(ultimo, -27))} a ${dmDia(ultimo)}).`])
  })

  it('zero medido: 28 dias com linha e views 0 é "0", não "não medido"', () => {
    if (BASE.dados.diario.acesso !== 'ok') throw new Error('fixture')
    const dado = { ...BASE.dados.diario.dado, linhas: BASE.dados.diario.dado.linhas.map(l => ({ ...l, views: 0 })) }
    const v = build(BASE, { alcance: BASE.dados.alcance, diario: { acesso: 'ok', dado } })
    expect(por(v, A).vpdDiario).toBe(0)
    expect(por(v, A).vpdDiarioText).toBe('0')
    expect(por(v, A).vpdDiarioMissing).toBeNull()
  })

  it('vídeo que não é longo acompanhado (Short): sem número, com a frase dos longos', () => {
    const v = build(BASE)
    const s = por(v, SHORT)
    expect(s.vpdDiario).toBeNull()
    expect(s.vpdDiarioText).toBeNull()
    expect(s.vpdDiarioMissing).toBe(VPD_SO_LONGOS)
    expect(vpdNota(s)).toEqual([`Views por dia: ${VPD_SO_LONGOS}.`])
  })

  const MOTIVOS: Array<[string, CenarioDados, string]> = [
    ['negado', 'negado', 'só quem edita o site vê as views por dia do seu canal'],
    ['erro', 'erro', 'a leitura das views por dia falhou agora; recarregue a página'],
    ['sem diário', 'vazio', 'a coleta diária ainda não gravou este canal'],
    ['diário parado', 'parado', `a coleta diária deste canal parou em ${dmDia(d(20))}`],
    ['menos de 7 dias', 'curto', 'menos de 7 dias medidos nos últimos 28'],
  ]
  for (const [nome, cenario, frase] of MOTIVOS) {
    it(`vídeo sem diário (${nome}): vpd null e a frase do motivo, no longo e no Short`, () => {
      const v = build(BASE, { alcance: BASE.dados.alcance, diario: DADOS[cenario](BASE.canalId, BASE.ytIds, BASE.hoje).diario })
      for (const id of [A, SHORT]) {
        const x = por(v, id)
        expect(x.vpdDiario).toBeNull()
        expect(x.vpdDiarioText).toBeNull()
        // o Short herda o motivo de leitura (negado, erro, sem coleta, coleta parada); com a coleta em dia a frase é a dos longos
        const esperada = id === SHORT && cenario === 'curto' ? VPD_SO_LONGOS : frase
        expect(x.vpdDiarioMissing).toBe(esperada)
        expect(vpdNota(x)).toEqual([`Views por dia: ${esperada}.`])
      }
    })
  }

  it('o motor continua sem série do canal próprio: vpd7, vpdText e semMedida do vídeo não inventam número', () => {
    const v = build(BASE)
    for (const x of v.videos) {
      expect(x.vpd7).toBeNull()
      expect(x.vpdText).toBeNull()
      // o cartão do canal próprio tem as suas colunas: a frase de "views/dia e múltiplo: não medido" do concorrente não vale
      expect(x.semMedida).toBeNull()
    }
  })

  it('semViewsDiarias: a frase de D12 (c), uma só', () => {
    expect(SEM_VIEWS_DIARIAS).toBe('Views por dia de cada vídeo: já são coletadas; o desenho delas nesta tela ainda não existe.')
    for (const c of CENARIOS) {
      const v = build(BASE, DADOS[c](BASE.canalId, BASE.ytIds, BASE.hoje))
      expect(v.semViewsDiarias).toBe(SEM_VIEWS_DIARIAS)
      // uma só: nenhum cartão a repete
      expect(v.videos.filter(x => [...x.notas, x.terceira, x.impMissing ?? ''].some(t => t.includes('Views por dia de cada vídeo')))).toHaveLength(0)
    }
  })
})

describe('ordenar por impressões', () => {
  const st = (dir: 'asc' | 'desc') => ({ fmt: 'todos' as const, sort: 'imp' as const, dir, q: '', n: 0 })
  // A: 30, B: 80, C: 80 (empate com B), D: 10 impressões; o resto do canal não tem impressão
  const D = BASE.ytIds[3]!
  const view = build(BASE, com(alcanceComLinhas(BASE.canalId, BASE.hoje, [
    linha(A, 5, 30, 0.1), linha(B, 5, 80, 0.1), linha(C, 5, 80, 0.1), linha(D, 5, 10, 0.1),
  ])))

  it('ordenar por impressões: maior primeiro; quem não tem impressão vai para o fim NAS DUAS direções', () => {
    const impDe = (id: string) => view.videos.find(x => x.id === id)!.imp
    for (const dir of ['desc', 'asc'] as const) {
      const lista = montarLista(view.videos, st(dir))
      const ids = lista.secoes.flatMap(s => s.itens.map(x => x.id))
      expect(ids).toHaveLength(view.videos.length)
      const medidos = ids.filter(id => impDe(id) != null)
      expect(medidos).toHaveLength(4)
      // os quatro com impressão vêm primeiro, os 54 sem impressão depois: nenhum nulo entre dois medidos nem antes deles
      expect(ids.slice(0, 4)).toEqual(medidos)
      for (const id of ids.slice(4)) expect(impDe(id)).toBeNull()
    }
  })

  it('ordenar por impressões: a ordem dos medidos é a da direção, e o empate cai no mais novo primeiro (estável) nas duas', () => {
    const bc = [por(view, B), por(view, C)].sort((a, b) => (b.pub ?? 0) - (a.pub ?? 0)).map(x => x.id)
    expect(por(view, B).pub).not.toBe(por(view, C).pub)
    const desc = montarLista(view.videos, st('desc')).visiveis.slice(0, 4)
    const asc = montarLista(view.videos, st('asc')).visiveis.slice(0, 4)
    expect(desc).toEqual([...bc, por(view, A).id, por(view, D).id])
    expect(asc).toEqual([por(view, D).id, por(view, A).id, ...bc])
  })

  it('ordenar por impressões: o resultado não depende da ordem de entrada', () => {
    const invertida = [...view.videos].reverse()
    for (const dir of ['desc', 'asc'] as const) {
      expect(montarLista(invertida, st(dir)).visiveis).toEqual(montarLista(view.videos, st(dir)).visiveis)
    }
  })

  it('quem não tem impressão fica sob um divisor próprio, com a contagem, nas duas direções', () => {
    for (const dir of ['desc', 'asc'] as const) {
      const lista = montarLista(view.videos, st(dir))
      const ultimo = lista.secoes[lista.secoes.length - 1]!
      expect(ultimo.divisor).toEqual({ key: 'sem-valor', label: 'Sem impressão medida no período', count: view.videos.length - 4 })
      expect(lista.secoes[0]!.divisor).toBeNull()
      expect(lista.secoes[0]!.itens).toHaveLength(4)
    }
  })

  it('canal sem nenhuma impressão (dado negado): todos caem no divisor, nenhum é ordenado como zero', () => {
    const negado = build(BASE, DADOS.negado(BASE.canalId, BASE.ytIds, BASE.hoje))
    const lista = montarLista(negado.videos, st('desc'))
    expect(lista.secoes).toHaveLength(1)
    expect(lista.secoes[0]!.divisor?.key).toBe('sem-valor')
    expect(lista.secoes[0]!.itens).toHaveLength(negado.videos.length)
  })

  it('a ordenação de concorrente não mudou: Mais vistos ainda ordena por views e ignora impressões', () => {
    const lista = montarLista(view.videos, { ...st('desc'), sort: 'vistos' })
    const vs = lista.secoes[0]!.itens.map(x => x.views)
    expect(vs).toEqual([...vs].sort((a, b) => (b ?? 0) - (a ?? 0)))
  })
})

describe('a URL: sort=imp e tab=retencao', () => {
  it('sort=imp e tab=retencao são aceitos na URL; em canal de concorrente caem no padrão', () => {
    const own = parseCanalState({ sort: 'imp', tab: 'retencao', dir: 'asc' }, { own: true })
    expect(own.sort).toBe('imp')
    expect(own.tab).toBe('retencao')
    expect(own.dir).toBe('asc')
    const conc = parseCanalState({ sort: 'imp', tab: 'retencao', dir: 'asc' })
    expect(conc.sort).toBe(CANAL_DEFAULT.sort)
    expect(conc.tab).toBe(CANAL_DEFAULT.tab)
    expect(parseCanalState({ sort: 'imp', tab: 'retencao' }, { own: false })).toEqual(CANAL_DEFAULT)
  })

  it('canal próprio não tem fixados nem views por dia por vídeo na motor: "fixados" e "vpd" caem no padrão', () => {
    expect(parseCanalState({ fmt: 'fixados' }, { own: true }).fmt).toBe('todos')
    expect(parseCanalState({ sort: 'vpd' }, { own: true }).sort).toBe('recentes')
    // e continuam valendo no concorrente
    expect(parseCanalState({ fmt: 'fixados' }).fmt).toBe('fixados')
    expect(parseCanalState({ sort: 'vpd' }).sort).toBe('vpd')
    expect(parseCanalState({ fmt: 'fixados', sort: 'vpd' }, { own: false }).fmt).toBe('fixados')
  })

  it('o canal próprio aceita o resto do que o concorrente aceita (vistos, múltiplo, longos, shorts, trocas, leitura)', () => {
    const s = parseCanalState({ sort: 'multiplo', fmt: 'shorts', tab: 'leitura', ver: 'lista', q: ' x ' }, { own: true })
    expect(s).toMatchObject({ sort: 'multiplo', fmt: 'shorts', tab: 'leitura', ver: 'lista', q: 'x' })
    expect(parseCanalState({ sort: 'vistos' }, { own: true }).sort).toBe('vistos')
    expect(parseCanalState({ tab: 'trocas', video: 'v1' }, { own: true }).video).toBe('v1')
  })

  it('ida e volta com a ordenação por impressões e a aba Retenção', () => {
    const s = { ...CANAL_DEFAULT, sort: 'imp' as const, dir: 'asc' as const, tab: 'retencao' as const }
    expect(canalQuery(s)).toBe('?tab=retencao&sort=imp&dir=asc')
    expect(parseCanalState(Object.fromEntries(new URLSearchParams(canalQuery(s))), { own: true })).toEqual(s)
    // sort=imp é o único que muda o padrão para o canal próprio: o padrão continua "recentes" e fora da URL
    expect(canalQuery({ ...CANAL_DEFAULT })).toBe('')
  })

  it('o link do canal escreve sort=imp e tab=retencao', () => {
    expect(link.canal('abc', { sort: 'imp' })).toBe('/cms/youtube/competitors/canal/abc?sort=imp')
    expect(link.canal('abc', { tab: 'retencao' })).toBe('/cms/youtube/competitors/canal/abc?tab=retencao')
  })
})

describe('o que não pode vazar para a tela', () => {
  it('nenhum texto de nenhum cenário usa palavra interna', () => {
    const proibidas = /\b(L2|L3|lote|pack|pacote|dataset|motor|day_pt|Reporting|Analytics API)\b|diário|escala √/i
    for (const c of CENARIOS) {
      const v = build(BASE, DADOS[c](BASE.canalId, BASE.ytIds, BASE.hoje))
      for (const t of textos(v)) expect(t).not.toMatch(proibidas)
    }
  })

  it('a nota do conjunto diz o período, o dia do YouTube e que cliques são contagem; sem percentual por vídeo', () => {
    const v = build(BASE)
    const de = dmDia(d(21)), ate = dmDia(d(1))
    expect(v.nota).toContain(`de ${de} a ${ate}`)
    expect(v.nota).toContain('horário do Pacífico')
    expect(v.nota).toContain('contagem, nunca percentual')
    expect(v.nota).toContain('Múltiplo = views do vídeo')
  })

  it('o modelo não lê banco: não importa os leitores, a prova de edição nem o módulo de servidor (só o tipo)', () => {
    const src = readFileSync(join(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_proprio/videos-model.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
    expect(violacoesDeImport(src)).toEqual([])
    // controles: o detector pega cada uma das violações
    expect(violacoesDeImport(`import { lerAlcance } from '@/lib/youtube/observatorio/proprio/ler'`)).toHaveLength(1)
    expect(violacoesDeImport(`import { provarEdicao } from '@/lib/youtube/observatorio/proprio/edicao'`)).toHaveLength(1)
    expect(violacoesDeImport(`import { podeVerPrivado } from './dados'`)).toHaveLength(1)
    expect(violacoesDeImport(`import 'server-only'`)).toHaveLength(1)
    expect(violacoesDeImport(`import type { DadosDoCanal } from './dados'`)).toEqual([])
  })

  it('o dado de entrada não é alterado e a montagem é determinística; nada de `any` nem de cast duplo no modelo', () => {
    const antes = JSON.stringify(BASE.dados)
    const a = build(BASE), b = build(BASE)
    expect(b).toEqual(a)
    expect(JSON.stringify(BASE.dados)).toBe(antes)
    const src = readFileSync(join(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_proprio/videos-model.ts'), 'utf8')
    expect(src).not.toMatch(/:\s*any\b|<any>|as any|as unknown as/)
    expect(diarioCheio(BASE.canalId, BASE.ytIds, BASE.hoje).linhas.length).toBe(BASE.ytIds.length * 30)
  })
})

function violacoesDeImport(src: string): string[] {
  const v: string[] = []
  if (/from\s+['"][^'"]*proprio\/ler['"]/.test(src)) v.push('importa os leitores')
  if (/from\s+['"][^'"]*proprio\/edicao['"]/.test(src)) v.push('importa a prova de edição')
  if (/import\s+(?!type\b)[^'"]*from\s+['"]\.\/dados['"]/.test(src)) v.push('importa valor do módulo de servidor')
  if (/import\s+['"]server-only['"]/.test(src)) v.push('marca o modelo como módulo de servidor')
  return v
}
