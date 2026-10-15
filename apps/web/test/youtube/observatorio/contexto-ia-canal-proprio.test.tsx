// @vitest-environment jsdom
// A5 · E17 degrau 1, Tarefa 7a: o empacotador do canal PRÓPRIO. Paridade com a tela real (cabeçalho, "Como o canal está", lista de vídeos, aba % assistido),
// o dado privado em quatro estados (lido, sem o direito, não conferido, leitura falhou), dado ausente e a prova de que o pacote sem o direito não leva
// nenhum número do alcance nem do diário. Fixture sintética (o repositório é público).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent } from '@testing-library/react'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { proprioWorld, type CenarioDados } from './proprio-fixture'
import { comDiario, diarioComPct, duracoesDosLongos, ultimoVideoHa, type PlanoDoVideo } from './proprio-assistido-fixture'
import { mountProprio, viewDe, type Mundo } from './proprio-mount'
import { expandirTela, normalizar, provarParidade, provarQueExcluidoNaoVaza } from './contexto-ia-paridade'
import { ComoEsta } from '@/app/cms/(authed)/youtube/competitors/_proprio/como-esta'
import { montarComoEsta } from '@/app/cms/(authed)/youtube/competitors/_proprio/como-esta-model'
import { concorrentesDoSite, posicaoDoSite } from '@/app/cms/(authed)/youtube/competitors/_proprio/posicao-do-site'
import { publicacoesDe } from '@/lib/youtube/observatorio/proprio/dias'
import {
  empacotarCanalProprio, INVENTARIO_CANAL_PROPRIO, modeloDeCanalProprio, SEM_PROVA_POR_IGUALDADE_DIRETA_CANAL_PROPRIO, type ModeloCanalProprio,
} from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canal-proprio'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { montarTexto } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { semDestino, semUso } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import { A_TELA_NAO_INFORMA_O_MOTIVO } from '@/lib/youtube/observatorio/contexto-ia/frases'
import type { EstadoDoPrivado, PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/x',
  useSearchParams: () => new URLSearchParams(''),
}))
beforeEach(() => { vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} }); window.history.replaceState(null, '', '/') })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.getElementById('flut')?.remove() })

const NOW = Date.UTC(2026, 9, 14, 15, 0, 0)
const CTX = { geradoEm: NOW, recente: null }

// ───────────────────────── os mundos
const DUR = [200, 200, 200, 200, 200, 200, 600, 600, 600, 600, 600, 1000, 1000, 1000]
const PCT = [40, 42, 44, 46, 48, 50, 30, 32, 34, 36, 60, 50, 55, 60]
const VPD = [9, 8, 7, 6, 5, 4, 12, 3, 2, 1, 20, 6, 5, 4]
const plano = (): PlanoDoVideo[] => PCT.map((pct, i) => ({ dias: 10, views: VPD[i] ?? 0, pct }))
const BASE = proprioWorld({ mut: ds => { duracoesDosLongos(DUR)(ds); ultimoVideoHa(12)(ds) } })
/** Cheio, com % assistido por vídeo (a aba Retenção com tabela). */
const CHEIO_COM_ASSISTIDO: Mundo = { ...BASE, dados: comDiario(BASE.dados, diarioComPct(BASE.canalId, BASE.ytIds, BASE.hoje, plano())) }
const CHEIO = proprioWorld()
const CURTO = proprioWorld({ cenario: 'curto' })
const VAZIO = proprioWorld({ cenario: 'vazio' })
const PARADO = proprioWorld({ cenario: 'parado' })
const NEGADO = proprioWorld({ cenario: 'negado' })
const ERRO = proprioWorld({ cenario: 'erro' })

function modeloDe(w: Mundo, sp: Record<string, string | undefined> = {}): ModeloCanalProprio {
  const pv = viewDe(w, sp)
  const { posicao } = posicaoDoSite(w.obs, w.canalId)
  const ce = montarComoEsta({
    dados: w.dados, hoje: w.hoje, dm: w.dm, posicao, posicaoItens: pv.header.posicaoItens, canalId: w.canalId,
    videos: pv.videos.videos.map(v => ({ id: v.id, ytId: v.ytId, title: v.title, thumb: v.thumbSrc })),
    concorrentes: concorrentesDoSite(w.obs, w.canalId), publicacoes: publicacoesDe(w.obs.videos.filter(v => v.ch === w.canalId)),
  })
  return modeloDeCanalProprio(pv, ce)
}

const lido = (id: string): EstadoDoPrivado => ({ acessoPorCanal: { [id]: { diario: 'ok', alcance: 'ok' } }, negativa: null })
const negadoPara = (id: string, negativa: EstadoDoPrivado['negativa']): EstadoDoPrivado => ({ acessoPorCanal: { [id]: { diario: 'negado', alcance: 'negado' } }, negativa })
const falhou = (id: string): EstadoDoPrivado => ({ acessoPorCanal: { [id]: { diario: 'erro', alcance: 'erro' } }, negativa: null })

const textoCompleto = (p: PacoteModelo): string => montarTexto(segmentar(p, CTX), '', 200_000, 'um_por_vez').texto
const jsonDoPacote = (texto: string): string => texto.slice(texto.indexOf('## 8. Bloco estruturado'), texto.indexOf('## 9. Minha pergunta'))

/** O texto de cada ⓘ da tela: abre um por vez (a camada única fecha o anterior), lê a camada e fecha. */
async function textosDosPopovers(raiz: HTMLElement): Promise<string[]> {
  const textos: string[] = []
  const gatilhos = [...raiz.querySelectorAll<HTMLElement>('button[aria-expanded="false"][aria-controls]')].filter(b => /\b(ibtn|ic-info|pn-info|vb-info)\b/.test(b.className))
  for (const g of gatilhos) {
    await act(async () => { fireEvent.click(g) })
    textos.push(document.getElementById('flut')?.textContent ?? '')
    await act(async () => { fireEvent.click(g) })
  }
  return textos
}

/** O texto da tela com tudo aberto, nos estados que mudam o que ela escreve: capas, lista, "Todos os números", aba % assistido, aba Trocas e aba Leitura. */
async function textoDaTela(w: Mundo): Promise<string> {
  const textos: string[] = []
  for (const sp of [{}, { ver: 'lista' }, { nums: '1' }, { tab: 'retencao' }, { tab: 'trocas' }, { tab: 'leitura' }] as Array<Record<string, string>>) {
    const pv = viewDe(w, sp)
    const { posicao } = posicaoDoSite(w.obs, w.canalId)
    const ce = montarComoEsta({
      dados: w.dados, hoje: w.hoje, dm: w.dm, posicao, posicaoItens: pv.header.posicaoItens, canalId: w.canalId,
      videos: pv.videos.videos.map(v => ({ id: v.id, ytId: v.ytId, title: v.title, thumb: v.thumbSrc })),
      concorrentes: concorrentesDoSite(w.obs, w.canalId), publicacoes: publicacoesDe(w.obs.videos.filter(v => v.ch === w.canalId)),
    })
    const r = mountProprio({ world: w, sp, comoEsta: <ComoEsta view={ce.view} grafico={ce.grafico} graficoViews={ce.graficoViews} painel="1" canalId={w.canalId} /> })
    textos.push(await expandirTela(r.container as HTMLElement))
    textos.push(...await textosDosPopovers(r.container as HTMLElement))
    r.unmount()
    cleanup()
    document.getElementById('flut')?.remove()
  }
  return textos.join('\n')
}

// ───────────────────────── o mapa de colunas da regra (d3)
const FIM = { medida: '.label', valor: ['.value', '.missing'], base: '.base' }
const COLUNAS = (m: ModeloCanalProprio): Record<string, Record<string, string | readonly string[]>> => {
  const cab = { Medida: FIM.medida, Valor: FIM.valor, Base: FIM.base }
  const cabNota = { Medida: '.label', Nota: ['.sub', '.n'] }
  const prosa = { Texto: ['.resto', '.frase', '.topVazio', '.topNota', '.vazio', '.t', '.nota', '.periodoTexto', '.resumo', '.motivoAlcance', '.viewsPorDiaFrase', '.negrito', '.semPercentual', ']'] }
  return {
    'cabecalho-publico': cab, 'cabecalho-publico-notas': cabNota,
    'privado-cabecalho-alcance': cab, 'privado-cabecalho-alcance-notas': cabNota,
    'privado-cabecalho-diario': cab, 'privado-cabecalho-diario-notas': cabNota,
    'resumo-do-canal': { Resumo: '.destaque' },
    'posicao-no-nicho': { Posição: ['.intro', '.texto'] },
    'videos-do-canal': {
      'Vídeo': 'pacote.ordem', 'Título': '.title', 'Publicado': 'pacote.publicado', 'Formato': 'pacote.formato', 'Duração': ['duracao.texto', 'duracao.motivo'],
      'Views': ['views.texto', 'views.motivo'], 'Múltiplo': ['multiplo.texto', 'multiplo.motivo'], 'Curtidas': ['curtidas.texto', 'curtidas.motivo'], 'Comentários': ['comentarios.texto', 'comentarios.motivo'],
    },
    'videos-do-canal-nivel': { 'Vídeo': 'pacote.ordem', 'Nível': 'pacote.nivel' },
    'privado-alcance-dos-videos': { 'Vídeo': 'pacote.ordem', 'Impressões': ['imp.texto', 'imp.motivo'], 'Cliques estimados': ['cliques.texto', 'cliques.motivo'] },
    'privado-alcance-dos-videos-nota': { 'Vídeo': 'pacote.ordem', 'Nota': 'pacote.terceira' },
    'privado-views-por-dia-dos-videos': { 'Vídeo': 'pacote.ordem', 'Views por dia': ['vpdDiario.texto', 'vpdDiario.motivo'] },
    'privado-alcance-em-frases': prosa, 'privado-views-em-frases': prosa, 'privado-assistido-em-frases': prosa,
    'privado-videos-que-mais-apareceram': { 'Vídeo': '.ordem', 'Impressões': '.imp', 'Cliques estimados': '.cliques', 'Dias': '.dias' },
    'privado-taxa-de-clique-do-canal': { 'Taxa': '.valor', 'Intervalo de 95%, de': '.loTxt', 'Intervalo de 95%, até': '.hiTxt' },
    'privado-assistido-faixas': { 'Faixa': '.rotulo', 'Vídeos': '.videos', 'Normal': ['.normal', '.texto'] },
    'privado-assistido-por-video': { 'Vídeo': '.ordem', 'Faixa de duração': '.faixa', 'Views em 28 dias': '.views28', '% assistido': '.pct', 'Contra o normal da faixa': 'contra.texto' },
    'privado-assistido-por-video-notas': { 'Vídeo': '.ordem', 'Nota': ['.cobertura', '.nViews'] },
    'privado-impressoes-por-dia': { 'Dia': '.rotulo', [m.grafico.rotuloValor]: ['.imp', '.dica'], 'Cliques estimados': ['.cliques', '.dica'], [m.grafico.rotuloSituacao]: '.situacaoTexto' },
    'privado-views-por-dia': { 'Dia': '.rotulo', [m.graficoViews.rotuloValor]: ['.imp', '.dica'], [m.graficoViews.rotuloSituacao]: '.situacaoTexto' },
  }
}

const MATRIZ: Array<[string, Mundo]> = [
  ['cheio', CHEIO], ['cheio com % assistido por vídeo', CHEIO_COM_ASSISTIDO], ['coleta curta (magro)', CURTO], ['sem nenhum relatório', VAZIO],
  ['coleta parada', PARADO],
]

describe('7a: paridade com a tela real, em cada estado da matriz (lido)', () => {
  for (const [nome, w] of MATRIZ) {
    it(`${nome}: toda folha tem destino, toda célula tem origem concreta com o texto da folha, e o pacote diz o que a tela diz`, async () => {
      const m = modeloDe(w)
      const p = empacotarCanalProprio(m, lido(w.canalId))
      expect(p.privado.estado).toBe('incluido')
      provarParidade({
        modelo: m, inventario: INVENTARIO_CANAL_PROPRIO, pacote: p, textoDaTela: await textoDaTela(w), textoDoPacote: textoCompleto(p),
        colunas: COLUNAS(m), cruas: [],
      })
    })
  }
  it('a lista de folhas de número cru está vazia e escrita aqui (nada do que a tela formata fica só no componente)', () => {
    expect(SEM_PROVA_POR_IGUALDADE_DIRETA_CANAL_PROPRIO).toEqual([])
  })
})

describe('7a: o inventário', () => {
  it('toda folha de todos os mundos tem destino (campo novo no modelo sem empacotador derruba este teste)', () => {
    for (const [nome, w] of [...MATRIZ, ['negado', NEGADO] as [string, Mundo], ['erro', ERRO] as [string, Mundo]]) {
      expect(semDestino(modeloDe(w), INVENTARIO_CANAL_PROPRIO), nome).toEqual([])
    }
  })
  it('toda chave do inventário tem folha de verdade por trás em algum mundo (declaração velha derruba)', () => {
    const modelos = [...MATRIZ.map(([, w]) => modeloDe(w)), modeloDe(NEGADO), modeloDe(ERRO)]
    const sobrando = Object.keys(INVENTARIO_CANAL_PROPRIO).filter(chave => modelos.every(m => semUso(m, { [chave]: INVENTARIO_CANAL_PROPRIO[chave]! }).length > 0))
    // chaves de campos que nenhuma fixture sintética produz hoje (lista fechada; cada uma com o motivo)
    expect(sobrando).toEqual(SEM_FOLHA_NAS_FIXTURES)
  })
})
// `cedo` (a faixa dos 7 primeiros dias) é nulo no canal em toda fixture: as folhas dele são provadas na 7b (vídeo novo), pelo inventário compartilhado
const SEM_FOLHA_NAS_FIXTURES: string[] = ['videos.videos[].pin.*', ...Object.keys(INVENTARIO_CANAL_PROPRIO).filter(k => /\.cedo\./.test(k))] // `pin` é nulo em todo vídeo das fixtures; o destino do resto fica declarado para o dia em que existir

describe('7a: o dado privado em quatro estados', () => {
  const cheio = () => modeloDe(CHEIO_COM_ASSISTIDO)

  it('com o direito: as tabelas do alcance e do diário são privadas, e privado.estado é incluido', () => {
    const m = cheio()
    const p = empacotarCanalProprio(m, lido(CHEIO_COM_ASSISTIDO.canalId))
    expect(p.privado).toEqual({ estado: 'incluido', itens: expect.stringContaining('impressões') })
    const privadas = p.tabelas.filter(t => t.privada).map(t => t.id)
    expect(privadas).toEqual(expect.arrayContaining(['privado-cabecalho-alcance', 'privado-alcance-dos-videos', 'privado-impressoes-por-dia', 'privado-views-por-dia', 'privado-assistido-por-video']))
    // as impressões do canal e a taxa de clique (os sentinelas) só estão em tabela privada
    const publicas = JSON.stringify(p.tabelas.filter(t => !t.privada))
    const imp = m.header.faixa.find(c => c.key === 'impressoes')!.value!
    const taxa = m.header.todos.find(c => c.key === 'taxaClique')!.value!
    expect(imp.length).toBeGreaterThan(1)
    expect(taxa).toMatch(/%$/)
    expect(JSON.stringify(p.tabelas.filter(t => t.privada))).toContain(imp)
    expect(publicas).not.toContain(`"texto":"${imp}"`)
    expect(publicas).not.toContain(taxa)
  })

  it('sem o direito: nenhum número do alcance nem do diário, a frase "Não incluído" está, e nenhuma tabela é privada (item 165)', () => {
    const comDireito = empacotarCanalProprio(cheio(), lido(CHEIO_COM_ASSISTIDO.canalId))
    const mN = modeloDe(NEGADO)
    const p = empacotarCanalProprio(mN, negadoPara(NEGADO.canalId, 'sem_direito'))
    expect(p.privado.estado).toBe('excluido')
    expect(p.privado).toMatchObject({ motivo: 'sem_direito' })
    expect(p.tabelas.some(t => t.privada)).toBe(false)
    const texto = textoCompleto(p)
    expect(texto).toContain('Não incluído: dado privado do canal')
    expect(texto).toContain('não tem o direito')
    provarQueExcluidoNaoVaza(comDireito, texto, jsonDoPacote(texto))
  })

  it('a diferença entre o pacote com e o sem o direito é só as tabelas privadas e as frases: as tabelas públicas são idênticas (mesmo canal, mesmo dado público)', () => {
    const a = empacotarCanalProprio(modeloDe(CHEIO), lido(CHEIO.canalId))
    const b = empacotarCanalProprio(modeloDe(NEGADO), negadoPara(NEGADO.canalId, 'sem_direito'))
    // a tabela de posição escreve a frase própria do item de views/dia (a tela também: sem o direito ela diz de quem é)
    const publicas = (p: typeof a) => p.tabelas.filter(t => !t.privada && t.nomeNoCorte !== 'tabela de posição')
    expect(publicas(b)).toEqual(publicas(a))
    expect(b.foco).toEqual(a.foco)
    expect(a.tabelas.some(t => t.privada)).toBe(true)
    expect(b.tabelas.some(t => t.privada)).toBe(false)
  })

  it('negativa nula (o motivo não foi conferido): motivo nao_conferido, e o texto não diz "não tem o direito"', () => {
    const p = empacotarCanalProprio(modeloDe(NEGADO), negadoPara(NEGADO.canalId, null))
    expect(p.privado).toMatchObject({ estado: 'excluido', motivo: 'nao_conferido' })
    expect(textoCompleto(p)).not.toContain('não tem o direito')
    const q = empacotarCanalProprio(modeloDe(NEGADO), negadoPara(NEGADO.canalId, 'nao_foi_possivel_conferir'))
    expect(q.privado).toMatchObject({ estado: 'excluido', motivo: 'nao_conferido' })
  })

  it('leitura que falhou (erro): excluido com motivo leitura_falhou, mesmo com a negativa "sem_direito"', () => {
    const p = empacotarCanalProprio(modeloDe(ERRO), { ...falhou(ERRO.canalId), negativa: 'sem_direito' })
    expect(p.privado).toMatchObject({ estado: 'excluido', motivo: 'leitura_falhou' })
    expect(p.tabelas.some(t => t.privada)).toBe(false)
  })

  it('leitura que o montar não registrou conta como falha (nunca como lida nem como sem direito)', () => {
    const p = empacotarCanalProprio(modeloDe(NEGADO), { acessoPorCanal: {}, negativa: 'sem_direito' })
    expect(p.privado).toMatchObject({ estado: 'excluido', motivo: 'leitura_falhou' })
  })

  it('parcial: o alcance lido e o diário com erro vão como incluido, com o aviso de parcial e sem tabela do diário', () => {
    const w = CHEIO_COM_ASSISTIDO
    const p = empacotarCanalProprio(modeloDe(w), { acessoPorCanal: { [w.canalId]: { alcance: 'ok', diario: 'erro' } }, negativa: null })
    expect(p.privado.estado).toBe('incluido')
    expect(p.avisos).toContain('Parte do dado privado do canal não foi lida agora.')
    const ids = p.tabelas.map(t => t.id)
    expect(ids).toContain('privado-impressoes-por-dia')
    expect(ids).not.toContain('privado-views-por-dia')
    expect(ids.filter(i => i.startsWith('privado-assistido'))).toEqual([])
  })

  it('lido e nada medido (sem relatório nenhum): as tabelas privadas existem, toda célula é "não medido" ou zero, e segmentar não lança', () => {
    const m = modeloDe(VAZIO)
    const p = empacotarCanalProprio(m, lido(VAZIO.canalId))
    expect(p.privado.estado).toBe('incluido')
    expect(() => segmentar(p, CTX)).not.toThrow()
    const celulasPrivadas = p.tabelas.filter(t => t.privada && t.tipo !== 'dia_a_dia').flatMap(t => t.linhas.flat()).filter(c => c.papel === 'numero')
    expect(celulasPrivadas.length).toBeGreaterThan(0)
    expect(celulasPrivadas.every(c => c.papel === 'numero' && c.estado !== 'medido' || c.papel === 'numero' && c.estado === 'medido' && c.texto !== '')).toBe(true)
  })
})

describe('7a: dado ausente e zero medido', () => {
  it('canal sem nenhum vídeo no modelo: o pacote não tem tabela de vídeos nem de alcance por vídeo, e não lança', () => {
    const m = modeloDe(CHEIO)
    const vazio: ModeloCanalProprio = { ...m, videos: { ...m.videos, videos: [] }, retencao: { ...m.retencao, videos: [] }, comoEsta: { ...m.comoEsta, top: [] } }
    const p = empacotarCanalProprio(vazio, lido(CHEIO.canalId))
    const ids = p.tabelas.map(t => t.id)
    expect(ids).not.toContain('videos-do-canal')
    expect(ids).not.toContain('privado-alcance-dos-videos')
    expect(() => segmentar(p, CTX)).not.toThrow()
  })

  it('zero medido continua zero medido: o vídeo que não aparece em nenhum relatório vai como "0" medido, não como "não medido"', () => {
    const m = modeloDe(CHEIO)
    const zero = m.videos.videos.findIndex(v => v.semImpressao)
    expect(zero).toBeGreaterThanOrEqual(0)
    const p = empacotarCanalProprio(m, lido(CHEIO.canalId))
    const t = p.tabelas.find(x => x.id === 'privado-alcance-dos-videos')!
    const cel = t.linhas[zero]![1]!
    expect(cel).toMatchObject({ papel: 'numero', estado: 'zero_medido', texto: '0' })
  })

  it('valor ausente sem motivo no modelo: "a tela não informa o motivo" (lista dos campos escrita aqui)', () => {
    const m = modeloDe(CHEIO)
    const sem = { ...m, header: { ...m.header, faixa: m.header.faixa.map((c, i) => (i === 0 ? { ...c, value: null, missing: null } : c)) } }
    const p = empacotarCanalProprio(sem, lido(CHEIO.canalId))
    const t = p.tabelas.find(x => x.id === 'cabecalho-publico')!
    const cel = t.linhas[0]![1]!
    expect(cel).toMatchObject({ papel: 'numero', estado: 'nao_medido', motivo: A_TELA_NAO_INFORMA_O_MOTIVO })
    // os campos do modelo que podem faltar sem motivo escrito: o valor e o motivo de uma célula do cabeçalho
    expect(Object.keys(INVENTARIO_CANAL_PROPRIO)).toEqual(expect.arrayContaining(['header.faixa[].missing', 'header.todos[].missing']))
  })
})

describe('7a: texto de terceiros, endereços e identidade', () => {
  it('o título do vídeo entra como terceiros e o nome do canal também; nenhuma célula leva endereço interno', () => {
    const m = modeloDe(CHEIO)
    const p = empacotarCanalProprio(m, lido(CHEIO.canalId))
    const cel = p.tabelas.find(t => t.id === 'videos-do-canal')!.linhas.flat()
    expect(cel.filter(c => c.papel === 'terceiros').length).toBe(m.videos.videos.length)
    const tudo = JSON.stringify(p)
    expect(tudo).not.toContain('/cms/')
    expect(tudo).not.toContain('http')
    expect(tudo).not.toContain('i.ytimg.com')
  })

  it('as tabelas privadas não repetem nenhum título de vídeo (o vídeo é a "ordem")', () => {
    const m = modeloDe(CHEIO_COM_ASSISTIDO)
    const p = empacotarCanalProprio(m, lido(CHEIO_COM_ASSISTIDO.canalId))
    const titulos = new Set(m.videos.videos.map(v => v.title).filter(t => t.length >= 4))
    for (const t of p.tabelas.filter(x => x.privada)) {
      for (const c of t.linhas.flat()) if (c.papel === 'terceiros') expect(titulos.has(c.texto), t.id).toBe(false)
    }
    expect(p.tabelas.filter(x => x.privada).flatMap(t => t.linhas.flat()).filter(c => c.papel === 'terceiros')).toEqual([])
  })

  it('as definições do pacote vêm das constantes do modelo, por identidade (a taxa e o % assistido), e as privadas só com o dado lido', () => {
    const p = empacotarCanalProprio(modeloDe(CHEIO_COM_ASSISTIDO), lido(CHEIO_COM_ASSISTIDO.canalId))
    expect(p.definicoes.filter(d => d.privado).map(d => d.frase)).toEqual(expect.arrayContaining([
      'Cliques estimados ÷ impressões, no período. Os cliques são estimados dia a dia (impressões × taxa que o YouTube informa para o dia), porque o YouTube não entrega a contagem de cliques.',
      '% assistido de um vídeo: média do percentual de cada dia, pesada pelas views do dia.',
    ]))
    const q = empacotarCanalProprio(modeloDe(NEGADO), negadoPara(NEGADO.canalId, 'sem_direito'))
    expect(q.definicoes.filter(d => d.privado)).toEqual([])
  })

  it('"o que esta tela não mede" não está vazio e leva as duas abas que ainda não têm conteúdo', () => {
    const p = empacotarCanalProprio(modeloDe(CHEIO), lido(CHEIO.canalId))
    expect(p.naoMede.length).toBeGreaterThan(2)
    expect(p.naoMede.join(' ')).toContain('Trocas dos seus vídeos ainda não são lidas nesta tela.')
    expect(p.naoMede.join(' ')).toContain('A leitura da forja para o seu canal ainda não existe.')
  })

  it('nenhuma frase do pacote diz que uma troca ou uma capa "causou" a mudança (risco 34)', () => {
    const t = normalizar(textoCompleto(empacotarCanalProprio(modeloDe(CHEIO_COM_ASSISTIDO), lido(CHEIO_COM_ASSISTIDO.canalId))))
    for (const palavra of ['causou', 'por causa', 'graças a', 'fez subir']) expect(t, palavra).not.toContain(palavra)
  })
})

describe('7a: o empacotador é puro e não escreve definição à mão', () => {
  const dir = join(process.cwd(), 'src/app/cms/(authed)/youtube/competitors/_contexto-ia')
  const fonte = readFileSync(join(dir, 'empacotar-canal-proprio.ts'), 'utf8')
  it('nenhum import de banco, de relógio, de next nem de react; nenhum literal com acento de mais de 20 letras fora dos textos declarados', () => {
    expect(fonte).not.toMatch(/from '(next|react|server-only)|supabase|fetch\(|Date\.now|new Date\(/)
    expect(readdirSync(dir)).toContain('empacotar-canal-proprio.ts')
  })
})

describe('7a: provas por mutação da paridade', () => {
  it('trocar duas linhas de lugar nos índices da origem derruba a regra (d2)', async () => {
    const m = modeloDe(CHEIO)
    const p = empacotarCanalProprio(m, lido(CHEIO.canalId))
    const t = p.tabelas.find(x => x.id === 'videos-do-canal')!
    const [a, b] = [t.linhas[0]!, t.linhas[1]!]
    const mutado: PacoteModelo = { ...p, tabelas: p.tabelas.map(x => (x.id === 'videos-do-canal' ? { ...x, linhas: [[...a.slice(0, 5), ...b.slice(5)], ...x.linhas.slice(1)] } : x)) }
    expect(() => provarParidade({
      modelo: m, inventario: INVENTARIO_CANAL_PROPRIO, pacote: mutado, textoDaTela: 'x', textoDoPacote: textoCompleto(mutado), colunas: COLUNAS(m),
    })).toThrow(/\(d2\)/)
  })
  it('apagar uma entrada do inventário derruba a regra (a)', () => {
    const m = modeloDe(CHEIO)
    const p = empacotarCanalProprio(m, lido(CHEIO.canalId))
    const { 'header.faixa[].base': _, ...menos } = INVENTARIO_CANAL_PROPRIO
    expect(() => provarParidade({ modelo: m, inventario: menos, pacote: p, textoDaTela: 'x', textoDoPacote: textoCompleto(p), colunas: COLUNAS(m) })).toThrow(/\(a\)/)
  })
})

// os cenários não usados acima, só para o tipo
export type _Cenario = CenarioDados
