// @vitest-environment jsdom
// A5 · E17 degrau 1, Tarefa 7b: o empacotador do VÍDEO próprio. Paridade com a tela real (cabeçalho, views por dia, impressões e cliques, taxa, % assistido,
// retenção, "Este vídeo no canal"), o dado privado em quatro estados (lido, sem o direito, não conferido, leitura falhou), dado ausente e a prova de que o pacote
// sem o direito não leva nenhum número do alcance nem do diário. Fixture sintética (o repositório é público).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactNode } from 'react'
import { expandirTela, normalizar, provarParidade, provarQueExcluidoNaoVaza } from './contexto-ia-paridade'
import { mundoVideo, temSentinela, SENTINELAS, type MundoVideo } from './proprio-video-fixture'
import { ProprioVideoScreen } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-screen'
import { VideoBlocos } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-blocos'
import { buildProprioVideoBase } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-model'
import { buildVideoBlocos } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-blocos-model'
import { dmDia } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import type { DadosDoVideo, RetencaoDoVideo } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import {
  empacotarVideoProprio, INVENTARIO_VIDEO_PROPRIO, modeloDeVideoProprio, SEM_PROVA_POR_IGUALDADE_DIRETA_VIDEO_PROPRIO, type ModeloVideoProprio,
} from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-video-proprio'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { montarTexto } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { semDestino, semUso } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import { A_TELA_NAO_INFORMA_O_MOTIVO } from '@/lib/youtube/observatorio/contexto-ia/frases'
import type { EstadoDoPrivado, PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import type { Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import type { Dataset } from '@/lib/youtube/observatorio/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/video/x',
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children?: ReactNode }) => <a href={href}>{children}</a> }))
beforeEach(() => { vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} }); window.history.replaceState(null, '', '/') })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.getElementById('flut')?.remove() })

const NOW = Date.UTC(2026, 9, 14, 15, 0, 0)
const CTX = { geradoEm: NOW, recente: null }

// ───────────────────────── os mundos
const umaFaixa = (ds: Dataset) => { for (const v of ds.videos) if (v.fmt === 'long') v.dur = 600 }
const COM = mundoVideo({ mut: umaFaixa })
const D = (n: number): string => new Date(NOW - n * 86_400_000).toISOString().slice(0, 10)
interface Ponto { t: number; ratio: number; relative: number | null }
const cruzaEm35 = (t: number): number => (t < 0.345 ? 1 - t : 0.4 - (t - 0.35) * 0.4)
const curva = (): Ponto[] => Array.from({ length: 100 }, (_, k) => ({ t: (k + 1) / 100, ratio: cruzaEm35((k + 1) / 100), relative: 0.5 }))
const retencaoColetada = (): Privado<RetencaoDoVideo> => ({
  acesso: 'ok',
  dado: {
    ytId: COM.foco.ytId, leituras: [], leiturasCortadas: false, ultimaTentativa: null, ultimaResposta: null, descartados: 0, tabelaAusente: false, janelasIlegiveis: [],
    curvas: { vida: { janela: 'vida', windowStart: D(60), windowEnd: D(2), coletadaEm: `${D(1)}T15:00:00.000Z`, pontos: curva(), metricas: ['audienceWatchRatio', 'relativeRetentionPerformance'], viewsAtRead: 1234 } },
  },
})

interface Caso { w: MundoVideo; id: string; dados: Privado<DadosDoVideo> }
function dadoLido(w: MundoVideo, ret?: Privado<RetencaoDoVideo>): Privado<DadosDoVideo> {
  const { alcance, diario } = w.dados
  if (alcance.acesso !== 'ok' || diario.acesso !== 'ok') throw new Error('a fixture esperava dado lido')
  return { acesso: 'ok', dado: { alcance: alcance.dado, diario: diario.dado, ...(ret ? { retencao: ret } : {}) } }
}
const novoId = COM.obs.videos.filter(v => v.ch === COM.canalId).sort((a, b) => b.pub - a.pub)[0]!.id
const CASOS: Array<[string, Caso]> = [
  ['com o direito, retenção não coletada', { w: COM, id: COM.foco.id, dados: dadoLido(COM) }],
  ['com o direito, retenção coletada', { w: COM, id: COM.foco.id, dados: dadoLido(COM, retencaoColetada()) }],
  ['vídeo publicado há 2 dias (novo)', { w: COM, id: novoId, dados: dadoLido(COM) }],
  ['sem o direito (negado)', { w: COM, id: COM.foco.id, dados: { acesso: 'negado' } }],
  ['leitura falhou (erro)', { w: COM, id: COM.foco.id, dados: { acesso: 'erro' } }],
]

function modeloDe(c: Caso): ModeloVideoProprio {
  const base = buildProprioVideoBase(c.w.obs, c.id, {})
  if (!base) throw new Error('a fixture esperava a página do vídeo')
  return modeloDeVideoProprio(base.header, buildVideoBlocos({ obs: c.w.obs, videoId: c.id, dados: c.dados, hoje: c.w.hoje, dm: dmDia }))
}

const lido = (id: string): EstadoDoPrivado => ({ acessoPorCanal: { [id]: { diario: 'ok', alcance: 'ok' } }, negativa: null })
const negadoPara = (id: string, negativa: EstadoDoPrivado['negativa']): EstadoDoPrivado => ({ acessoPorCanal: { [id]: { diario: 'negado', alcance: 'negado' } }, negativa })
const falhou = (id: string): EstadoDoPrivado => ({ acessoPorCanal: { [id]: { diario: 'erro', alcance: 'erro' } }, negativa: null })

const textoCompleto = (p: PacoteModelo): string => montarTexto(segmentar(p, CTX), '', 200_000, 'um_por_vez').texto
const jsonDoPacote = (texto: string): string => texto.slice(texto.indexOf('## 8. Bloco estruturado'), texto.indexOf('## 9. Minha pergunta'))

/** O texto de cada ⓘ da tela: abre um por vez (a camada única fecha o anterior), lê a camada e fecha. */
async function textosDosPopovers(raiz: HTMLElement): Promise<string[]> {
  const textos: string[] = []
  const gatilhos = [...raiz.querySelectorAll<HTMLElement>('button[aria-expanded="false"][aria-controls]')].filter(b => /\bibtn\b/.test(b.className))
  for (const g of gatilhos) {
    await act(async () => { fireEvent.click(g) })
    textos.push(document.getElementById('flut')?.textContent ?? '')
    await act(async () => { fireEvent.click(g) })
  }
  return textos
}

async function textoDaTela(c: Caso): Promise<string> {
  const base = buildProprioVideoBase(c.w.obs, c.id, {})!
  const blocos = buildVideoBlocos({ obs: c.w.obs, videoId: c.id, dados: c.dados, hoje: c.w.hoje, dm: dmDia })
  const r = render(<ProprioVideoScreen header={base.header} pager={null} fromCanal={null}><VideoBlocos view={blocos} /></ProprioVideoScreen>)
  const textos = [await expandirTela(r.container as HTMLElement), ...await textosDosPopovers(r.container as HTMLElement)]
  r.unmount()
  cleanup()
  document.getElementById('flut')?.remove()
  return textos.join('\n')
}

// ───────────────────────── o mapa de colunas da regra (d3)
const GRAFICO = (rotuloValor: string, rotuloSituacao: string, comCliques: boolean) => ({
  'Dia': '.rotulo', [rotuloValor]: ['.imp', '.dica', '.texto', '.aria'], ...(comCliques ? { 'Cliques estimados': ['.cliques', '.dica'] } : {}), [rotuloSituacao]: '.situacaoTexto',
})
const COLUNAS = (m: ModeloVideoProprio): Record<string, Record<string, string | readonly string[]>> => {
  const reguas = { 'Medida': '.nome', 'Valor': ['.valor', '.semRegua'], 'Posição': ['.posTexto', '.semRegua'] }
  const leitura = { 'Medida': '.nome', 'Leitura': '.sr' }
  const faixa = { 'Medida': '.nome', 'Menor': '.min', 'Maior': '.max' }
  const notas = { 'Medida': '.nome', 'Nota': ['.sub', '.semMedida'] }
  const g = m.blocos.views?.grafico, i = m.blocos.impressoes?.grafico
  return {
    'cabecalho-do-video': { 'Medida': '.label', 'Valor': ['.value', '.missing'], 'Base': '.conta' },
    'cabecalho-do-video-notas': { 'Medida': '.label', 'Nota': '.sub' },
    'reguas-do-video': reguas, 'reguas-do-video-faixa': faixa, 'reguas-do-video-notas': notas, 'reguas-do-video-leitura': leitura,
    'privado-reguas-do-video': reguas, 'privado-reguas-do-video-faixa': faixa, 'privado-reguas-do-video-notas': notas, 'privado-reguas-do-video-leitura': leitura,
    'retencao-em-frases': { 'Texto': '.frase' },
    'privado-frases-do-video': { 'Texto': ['.frase', '.t', '.semTaxa', '.contra', '.semNormal', '.saidas', '.revistos', '.aviso', '.base', '.pouco', '.notaDiario', '.nota', '.vazio', '.periodoTexto', '.resumo', ']'] },
    'privado-taxa-de-clique-do-video': { 'Faixa': '.rotulo', 'Taxa': '.valor', 'Intervalo de 95%, de': '.loTxt', 'Intervalo de 95%, até': '.hiTxt' },
    'privado-views-por-dia-do-video': GRAFICO(g?.rotuloValor ?? '', g?.rotuloSituacao ?? '', false),
    'privado-impressoes-por-dia-do-video': GRAFICO(i?.rotuloValor ?? '', i?.rotuloSituacao ?? '', true),
    'privado-impressoes-por-dia-do-video-frase': { 'Texto': '.frase' }, 'privado-views-por-dia-do-video-frase': { 'Texto': '.frase' }, // a frase da faixa dos 7 dias
  }
}

describe('7b: paridade com a tela real, em cada estado da matriz', () => {
  for (const [nome, c] of CASOS) {
    it(`${nome}: toda folha tem destino, toda célula tem origem concreta com o texto da folha, e o pacote diz o que a tela diz`, async () => {
      const m = modeloDe(c)
      const ok = c.dados.acesso === 'ok'
      const p = empacotarVideoProprio(m, ok ? lido(c.w.canalId) : c.dados.acesso === 'negado' ? negadoPara(c.w.canalId, 'sem_direito') : falhou(c.w.canalId))
      expect(p.privado.estado).toBe(ok ? 'incluido' : 'excluido')
      provarParidade({
        modelo: m, inventario: INVENTARIO_VIDEO_PROPRIO, pacote: p, textoDaTela: await textoDaTela(c), textoDoPacote: textoCompleto(p), colunas: COLUNAS(m), cruas: [],
      })
    })
  }
  it('a lista de folhas de número cru está vazia e escrita aqui (nada do que a tela formata fica só no componente)', () => {
    expect(SEM_PROVA_POR_IGUALDADE_DIRETA_VIDEO_PROPRIO).toEqual([])
  })
})

describe('7b: o inventário', () => {
  it('toda folha de todos os casos tem destino (campo novo no modelo sem empacotador derruba este teste)', () => {
    for (const [nome, c] of CASOS) expect(semDestino(modeloDe(c), INVENTARIO_VIDEO_PROPRIO), nome).toEqual([])
  })
  it('toda chave do inventário tem folha de verdade por trás em algum caso (declaração velha derruba)', () => {
    const modelos = CASOS.map(([, c]) => modeloDe(c))
    const sobrando = Object.keys(INVENTARIO_VIDEO_PROPRIO).filter(chave => modelos.every(m => semUso(m, { [chave]: INVENTARIO_VIDEO_PROPRIO[chave]! }).length > 0))
    expect(sobrando).toEqual(SEM_FOLHA_NAS_FIXTURES)
  })
})
// chaves de campos que nenhuma fixture sintética produz hoje (lista fechada; cada uma com o motivo)
const SEM_FOLHA_NAS_FIXTURES: string[] = [
  'blocos.impressoes.grafico', // E5b: o gráfico de impressões nunca é nulo nas fixtures (o vídeo novo traz `cedo`, não nulo)
  'blocos.views.grafico.cedo.tipo', 'blocos.views.grafico.cedo.frase', // a faixa dos 7 dias só existe no gráfico de impressões; as folhas dela estão provadas em blocos.impressoes
  'blocos.views.grafico.cedo.casas[].dia', 'blocos.views.grafico.cedo.casas[].rotulo', 'blocos.views.grafico.cedo.casas[].numero', 'blocos.views.grafico.cedo.casas[].estado',
  'blocos.views.grafico.cedo.casas[].texto', 'blocos.views.grafico.cedo.casas[].aria', 'blocos.views.grafico.cedo.legenda[].tipo', 'blocos.views.grafico.cedo.legenda[].texto',
  'blocos.impressoes.grafico.avisos[]', // o gráfico de impressões do vídeo não tem aviso em nenhuma fixture (o de views tem)
  'blocos.retencao.curva.revistos[].de', 'blocos.retencao.curva.revistos[].ate', // a curva sintética não tem trecho revisto
]

describe('7b: o dado privado em quatro estados', () => {
  const comDireito = () => modeloDe(CASOS[1]![1])

  it('com o direito: views por dia, impressões, taxa, % assistido e as linhas privadas das réguas são tabelas privadas, e privado.estado é incluido', () => {
    const m = comDireito()
    const p = empacotarVideoProprio(m, lido(COM.canalId))
    expect(p.privado).toEqual({ estado: 'incluido', itens: expect.stringContaining('impressões') })
    const privadas = p.tabelas.filter(t => t.privada).map(t => t.id)
    expect(privadas).toEqual(expect.arrayContaining(['privado-views-por-dia-do-video', 'privado-impressoes-por-dia-do-video', 'privado-taxa-de-clique-do-video', 'privado-reguas-do-video', 'privado-frases-do-video']))
    // os sentinelas de impressões, de taxa e de views por dia só estão em tabela privada
    const publicas = JSON.stringify(p.tabelas.filter(t => !t.privada))
    for (const s of [SENTINELAS.imp, SENTINELAS.cliques, SENTINELAS.taxa, SENTINELAS.viewsDia, SENTINELAS.views28]) {
      expect(temSentinela(publicas, s), s).toBe(false)
      expect(temSentinela(JSON.stringify(p.tabelas.filter(t => t.privada)), s), s).toBe(true)
    }
    // as linhas públicas das réguas (views, curtidas…) continuam públicas
    const linhasPublicas = p.tabelas.find(t => t.id === 'reguas-do-video')!.linhas.map(l => l[0]!.texto)
    expect(linhasPublicas).toEqual(expect.arrayContaining(['Views', 'Curtidas', 'Duração']))
    expect(linhasPublicas).not.toEqual(expect.arrayContaining(['Impressões']))
  })

  it('sem o direito: nenhum número do alcance nem do diário, a frase "Não incluído" está, e nenhuma tabela é privada (item 165)', () => {
    const com = empacotarVideoProprio(comDireito(), lido(COM.canalId))
    const mN = modeloDe(CASOS[3]![1])
    const p = empacotarVideoProprio(mN, negadoPara(COM.canalId, 'sem_direito'))
    expect(p.privado).toMatchObject({ estado: 'excluido', motivo: 'sem_direito' })
    expect(p.tabelas.some(t => t.privada)).toBe(false)
    const texto = textoCompleto(p)
    expect(texto).toContain('Não incluído: dado privado do canal')
    expect(texto).toContain('não tem o direito')
    for (const s of [SENTINELAS.imp, SENTINELAS.cliques, SENTINELAS.taxa, SENTINELAS.viewsDia, SENTINELAS.views28, SENTINELAS.pct]) expect(temSentinela(texto, s), s).toBe(false)
    provarQueExcluidoNaoVaza(com, texto, jsonDoPacote(texto))
  })

  it('a diferença entre o pacote com e o sem o direito é só as tabelas privadas e as frases: as tabelas públicas dos números do vídeo são idênticas', () => {
    const a = empacotarVideoProprio(comDireito(), lido(COM.canalId))
    const b = empacotarVideoProprio(modeloDe(CASOS[3]![1]), negadoPara(COM.canalId, 'sem_direito'))
    const publicas = (p: PacoteModelo, ids: string[]) => p.tabelas.filter(t => ids.includes(t.id))
    const ids = ['cabecalho-do-video', 'cabecalho-do-video-notas']
    expect(publicas(b, ids)).toEqual(publicas(a, ids))
    expect(b.foco).toEqual(a.foco)
    expect(a.tabelas.some(t => t.privada)).toBe(true)
    expect(b.tabelas.some(t => t.privada)).toBe(false)
  })

  it('negativa nula (o motivo não foi conferido): motivo nao_conferido, e o texto não diz "não tem o direito"', () => {
    const mN = modeloDe(CASOS[3]![1])
    const p = empacotarVideoProprio(mN, negadoPara(COM.canalId, null))
    expect(p.privado).toMatchObject({ estado: 'excluido', motivo: 'nao_conferido' })
    expect(textoCompleto(p)).not.toContain('não tem o direito')
    const q = empacotarVideoProprio(mN, negadoPara(COM.canalId, 'nao_foi_possivel_conferir'))
    expect(q.privado).toMatchObject({ estado: 'excluido', motivo: 'nao_conferido' })
  })

  it('leitura que falhou (erro): excluido com motivo leitura_falhou, mesmo com a negativa "sem_direito"', () => {
    const p = empacotarVideoProprio(modeloDe(CASOS[4]![1]), { ...falhou(COM.canalId), negativa: 'sem_direito' })
    expect(p.privado).toMatchObject({ estado: 'excluido', motivo: 'leitura_falhou' })
    expect(p.tabelas.some(t => t.privada)).toBe(false)
  })

  it('leitura que o montar não registrou conta como falha (nunca como lida nem como sem direito)', () => {
    const p = empacotarVideoProprio(modeloDe(CASOS[3]![1]), { acessoPorCanal: {}, negativa: 'sem_direito' })
    expect(p.privado).toMatchObject({ estado: 'excluido', motivo: 'leitura_falhou' })
  })

  it('o estado diz lido mas os blocos vieram negados: nada privado vai (o modelo manda, não o estado)', () => {
    const p = empacotarVideoProprio(modeloDe(CASOS[3]![1]), lido(COM.canalId))
    expect(p.tabelas.some(t => t.privada)).toBe(false)
    expect(p.privado.estado).toBe('excluido')
  })

  it('o alcance lido e o diário com erro: não é incluído (a página lê tudo ou nada)', () => {
    const p = empacotarVideoProprio(comDireito(), { acessoPorCanal: { [COM.canalId]: { alcance: 'ok', diario: 'erro' } }, negativa: null })
    expect(p.privado).toMatchObject({ estado: 'excluido', motivo: 'leitura_falhou' })
    expect(p.tabelas.some(t => t.privada)).toBe(false)
  })
})

describe('7b: dado ausente e zero medido', () => {
  it('retenção não coletada: a frase do estado vai em tabela pública e não há tabela de curva; coletada: a frase e as saídas vão em tabela privada', () => {
    const sem = empacotarVideoProprio(modeloDe(CASOS[0]![1]), lido(COM.canalId))
    expect(sem.tabelas.find(t => t.id === 'retencao-em-frases')).toMatchObject({ privada: false })
    const com = empacotarVideoProprio(modeloDe(CASOS[1]![1]), lido(COM.canalId))
    expect(com.tabelas.find(t => t.id === 'retencao-em-frases')).toBeUndefined()
    const m = modeloDe(CASOS[1]![1])
    expect(m.blocos.retencao.estado).toBe('coletada')
    const frases = com.tabelas.find(t => t.id === 'privado-frases-do-video')!.linhas.map(l => l[0]!.texto).join(' ')
    expect(frases).toContain(m.blocos.retencao.frase)
  })

  it('vídeo novo (2 dias): o pacote diz "vídeo novo" onde a tela diz e nenhum número vira zero', () => {
    const m = modeloDe(CASOS[2]![1])
    const p = empacotarVideoProprio(m, lido(COM.canalId))
    expect(textoCompleto(p)).toContain('Vídeo novo')
    const celulasPrivadas = p.tabelas.filter(t => t.privada && t.tipo !== 'dia_a_dia').flatMap(t => t.linhas.flat()).filter(c => c.papel === 'numero')
    expect(celulasPrivadas.some(c => c.papel === 'numero' && c.estado === 'zero_medido' && c.texto === '0' && /impress/i.test(c.origem))).toBe(false)
    expect(() => segmentar(p, CTX)).not.toThrow()
  })

  it('valor ausente sem motivo no modelo: "a tela não informa o motivo"', () => {
    const m = modeloDe(CASOS[0]![1])
    const sem = { ...m, header: { ...m.header, faixa: m.header.faixa.map((c, i) => (i === 0 ? { ...c, value: null, missing: null } : c)) } }
    const p = empacotarVideoProprio(sem, lido(COM.canalId))
    const cel = p.tabelas.find(x => x.id === 'cabecalho-do-video')!.linhas[0]![1]!
    expect(cel).toMatchObject({ papel: 'numero', estado: 'nao_medido', motivo: A_TELA_NAO_INFORMA_O_MOTIVO })
  })
})

describe('7b: terceiros, endereços, versões da capa e causa', () => {
  it('o título do vídeo é o foco (nome); nenhuma célula nem o texto leva endereço interno nem de imagem', () => {
    const m = modeloDe(CASOS[0]![1])
    const p = empacotarVideoProprio(m, lido(COM.canalId))
    expect(p.foco).toEqual([{ nome: m.header.titulo, oQueE: 'vídeo', detalhe: m.header.meta }])
    const tudo = JSON.stringify(p)
    for (const proibido of ['/cms/', 'http', 'i.ytimg.com', m.header.ytId]) expect(tudo, proibido).not.toContain(proibido)
  })

  it('as tabelas privadas não repetem nenhum título de vídeo', () => {
    const m = modeloDe(CASOS[1]![1])
    const p = empacotarVideoProprio(m, lido(COM.canalId))
    const titulos = [m.header.titulo, ...COM.obs.videos.filter(v => v.ch === COM.canalId).map(v => v.title)].filter(t => t.length >= 4)
    for (const t of p.tabelas.filter(x => x.privada)) {
      const tudo = JSON.stringify(t.linhas)
      for (const titulo of titulos) expect(tudo, `${t.id}: ${titulo}`).not.toContain(titulo)
    }
  })

  it('as versões da capa (legendas do visualizador) não entram no pacote, com o direito ou sem ele (item 198)', () => {
    const m = modeloDe(CASOS[1]![1])
    const legendas = (m.header.viewer?.versions ?? []).flatMap(v => [v.label, v.caption, v.span ?? ''])
    const comLegenda = { ...m, header: { ...m.header, viewer: { title: 'x', start: 0, versions: [{ label: 'Capa SENTINELA-198', current: true, archived: null, youtubeId: null, caption: 'Capa SENTINELA-198 (no ar): 05/10 14:22', from: 'a', to: 'b' }] } } }
    for (const modelo of [m, comLegenda]) for (const privado of [lido(COM.canalId), negadoPara(COM.canalId, 'sem_direito')]) {
      const texto = textoCompleto(empacotarVideoProprio(modelo, privado))
      expect(texto).not.toContain('SENTINELA-198')
      for (const l of legendas.filter(x => x.length >= 6)) expect(texto).not.toContain(l)
    }
  })

  it('as definições vêm das constantes do modelo (a taxa, o % assistido, o método da retenção), e as privadas só com o dado lido', () => {
    const m = modeloDe(CASOS[1]![1])
    const p = empacotarVideoProprio(m, lido(COM.canalId))
    const privadas = p.definicoes.filter(d => d.privado).map(d => d.frase)
    // a frase que a retenção já escreve (pública) não se repete como privada
    for (const frase of [...(m.blocos.assistido?.metodo ?? []), ...(m.blocos.impressoes?.taxa?.metodo ?? [])].filter(f => !m.blocos.retencao.metodo.includes(f))) expect(privadas).toContain(frase)
    expect(p.definicoes.filter(d => !d.privado).map(d => d.frase)).toEqual(expect.arrayContaining(m.blocos.retencao.metodo))
    const q = empacotarVideoProprio(modeloDe(CASOS[3]![1]), negadoPara(COM.canalId, 'sem_direito'))
    expect(q.definicoes.filter(d => d.privado)).toEqual([])
  })

  it('"o que esta tela não mede" não está vazio e leva a forja e o que ainda não há', () => {
    const m = modeloDe(CASOS[0]![1])
    const p = empacotarVideoProprio(m, lido(COM.canalId))
    expect(p.naoMede.join(' ')).toContain(m.blocos.forja.porque)
    expect(p.naoMede).toContain(m.blocos.ainda)
  })

  it('nenhuma frase do pacote diz que uma troca ou uma capa "causou" a mudança (risco 34)', () => {
    for (const [, c] of CASOS) {
      const privado = c.dados.acesso === 'ok' ? lido(c.w.canalId) : negadoPara(c.w.canalId, 'sem_direito')
      const t = normalizar(textoCompleto(empacotarVideoProprio(modeloDe(c), privado)))
      for (const palavra of ['causou', 'por causa', 'graças a', 'fez subir']) expect(t, palavra).not.toContain(palavra)
    }
  })

  it('de site externo sai só o domínio: o modelo do vídeo não carrega URL de fora, e o pacote não tem caminho nem parâmetro de URL', () => {
    const m = modeloDe(CASOS[1]![1])
    const comUrl = { ...m, blocos: { ...m.blocos, ainda: `${m.blocos.ainda}` } }
    const tudo = JSON.stringify(empacotarVideoProprio(comUrl, lido(COM.canalId)))
    expect(tudo).not.toMatch(/https?:\/\//)
    expect(tudo).not.toMatch(/[?&][a-z_]+=/)
  })
})

describe('7b: o empacotador é puro', () => {
  const fonte = readFileSync(join(process.cwd(), 'src/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-video-proprio.ts'), 'utf8')
  it('nenhum import de banco, de relógio, de next nem de react', () => {
    expect(fonte).not.toMatch(/from '(next|react|server-only)|supabase|fetch\(|Date\.now|new Date\(/)
  })
})

describe('7b: provas por mutação da paridade', () => {
  it('trocar duas linhas de lugar nos índices da origem derruba a regra (d2)', () => {
    const m = modeloDe(CASOS[0]![1])
    const p = empacotarVideoProprio(m, lido(COM.canalId))
    const t = p.tabelas.find(x => x.id === 'cabecalho-do-video')!
    const [a, b] = [t.linhas[0]!, t.linhas[1]!]
    const mutado: PacoteModelo = { ...p, tabelas: p.tabelas.map(x => (x.id === 'cabecalho-do-video' ? { ...x, linhas: [[a[0]!, b[1]!, a[2]!], ...x.linhas.slice(1)] } : x)) }
    expect(() => provarParidade({
      modelo: m, inventario: INVENTARIO_VIDEO_PROPRIO, pacote: mutado, textoDaTela: 'x', textoDoPacote: textoCompleto(mutado), colunas: COLUNAS(m),
    })).toThrow(/\(d2\)/)
  })
  it('apagar uma entrada do inventário derruba a regra (a)', () => {
    const m = modeloDe(CASOS[0]![1])
    const p = empacotarVideoProprio(m, lido(COM.canalId))
    const { 'header.faixa[].conta': _, ...menos } = INVENTARIO_VIDEO_PROPRIO
    expect(() => provarParidade({ modelo: m, inventario: menos, pacote: p, textoDaTela: 'x', textoDoPacote: textoCompleto(p), colunas: COLUNAS(m) })).toThrow(/\(a\)/)
  })
})
