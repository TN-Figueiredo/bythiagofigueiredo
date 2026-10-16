// @vitest-environment jsdom
/**
 * E17 degrau 1, Tarefa 6c: o empacotador do canal do concorrente. Paridade com o componente REAL da tela em cada estado da matriz (abas, formato,
 * ordenação, busca, lotes de antigos, sincronização), o que acontece quando o dado não existe e as provas por mutação. Fixture sintética: o oráculo.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { act, cleanup, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ReactNode } from 'react'
import { canalWorld } from './canal-fixture'
import { comAntigos, mountCanal } from './canal-mount'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { buildCanalView } from '@/app/cms/(authed)/youtube/competitors/_canal/view-model'
import { LeituraDoNicho } from '@/app/cms/(authed)/youtube/competitors/_canal/leitura'
import { buildMudancasView } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'
import { ReadingCard } from '@/app/cms/(authed)/youtube/competitors/_mudancas/reading-card'
import {
  empacotarCanal, INVENTARIO_CANAL, modeloDeCanal, SEM_FOLHA_NA_MATRIZ_CANAL, SEM_PROVA_POR_IGUALDADE_DIRETA_CANAL, type ModeloCanal,
} from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canal'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { montarTexto } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { ignorados, semDestino, semUso } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { CONTEXTO } from './contexto-ia-fixture'
import { expandirTela, provarParidade } from './contexto-ia-paridade'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/matt-wolfe',
  useSearchParams: () => new URLSearchParams(''),
}))

type Params = Record<string, string>
type Mut = (ds: Dataset, id: string) => void
interface Montado { modelo: ModeloCanal; pacote: PacoteModelo; textoDoPacote: string; textoDaTela: string }

const textoDoPacote = (p: PacoteModelo): string => montarTexto(segmentar(p, CONTEXTO), '', 1_000_000, 'todos').texto

function mundo(sp: Params, mut?: Mut) {
  const { obs, chId } = canalWorld(mut)
  const view = buildCanalView(obs, chId, sp)!
  const mv = view.state.tab === 'leitura' && view.header.niche && view.header.nicheLabel ? buildMudancasView(obs, { niche: view.header.niche }, new Set()) : null
  const leitura: ReactNode = view.state.tab === 'leitura'
    ? (mv && view.header.nicheLabel
      ? <LeituraDoNicho key="l" nicheLabel={view.header.nicheLabel}><div data-obs-screen="mudancas"><section className="forja"><ReadingCard view={mv} /></section></div></LeituraDoNicho>
      : <LeituraDoNicho key="l" nicheLabel={null}>{null}</LeituraDoNicho>)
    : null
  return { view, mv, leitura }
}

const abrir = (el: Element) => act(async () => { fireEvent.click(el) })
/** Os balões da tela (base dos números do canal, notas do menu de cada vídeo) moram num portal fora da raiz: abre cada um e junta o texto. */
async function textoDosBalões(): Promise<string[]> {
  const partes: string[] = []
  const ibtn = document.querySelector<HTMLElement>('button[aria-label="De onde vêm os números do canal"]')
  if (ibtn) {
    if (ibtn.getAttribute('aria-expanded') !== 'true') await abrir(ibtn)
    partes.push(document.body.querySelector('#canal-tip')?.textContent ?? '')
  }
  for (const b of [...document.querySelectorAll<HTMLElement>('button[aria-haspopup="menu"][aria-label^="Ações do vídeo"]')]) {
    await abrir(b)
    partes.push([...document.querySelectorAll('[role="menu"]')].map((e) => e.textContent ?? '').join(' '))
    await abrir(b)
  }
  return partes
}

async function montar(sp: Params, mut?: Mut, desenhar = true): Promise<Montado> {
  const { view, mv, leitura } = mundo(sp, mut)
  const modelo = modeloDeCanal(view, mv)
  const pacote = empacotarCanal(modelo)
  let textoDaTela = ''
  if (desenhar) {
    const vers = view.state.tab === 'videos' ? ['capas', 'lista'] : [view.state.ver]
    const partes: string[] = []
    for (const ver of vers) {
      const r = mountCanal({ mut, sp: { ...sp, ver }, leitura })
      partes.push(await expandirTela(r.container))
      partes.push(...(await textoDosBalões()))
      cleanup()
    }
    textoDaTela = partes.join('\n')
  }
  return { modelo, pacote, textoDoPacote: textoDoPacote(pacote), textoDaTela }
}

// ───────────────────────── o mapa de colunas da regra (d3), escrito aqui
const COLUNAS: Record<string, Record<string, string | readonly string[]>> = {
  cabecalho: { Medida: '.label', Valor: ['.value', '.missing'], Base: '.base' },
  'cabecalho-base-fraca': { Medida: '.label', 'Base pequena': '.n' },
  videos: { Vídeo: '.title', Formato: '.formato', Views: ['.viewsText', '.viewsMissing'] },
  'videos-publicado': { Vídeo: '.title', Publicado: '.ageText' },
  'videos-duracao': { Vídeo: '.title', Duração: '.durText' },
  'videos-vpd': { Vídeo: '.title', 'Views/dia': '.vpdText' },
  'videos-mult': { Vídeo: '.title', Múltiplo: '.multText' },
  'videos-mult-nivel': { Vídeo: '.title', Nível: '.multWord' },
  'videos-curtidas': { Vídeo: '.title', Curtidas: '.likesText' },
  'videos-comentarios': { Vídeo: '.title', Comentários: '.commentsText' },
  'videos-notas': { Vídeo: '.title', Nota: ['.semMedida', ...[0, 1, 2, 3, 4, 5].map((k) => `.badges[${k}]`), ...[0, 1, 2, 3, 4, 5].map((k) => `.notas[${k}]`)] },
  trocas: { Vídeo: '.title', Troca: '.campo', Quando: '.quando', 'Efeito em 7 dias': '.efeito' },
  'trocas-titulos': { Vídeo: '.title', 'Título de antes': '.antes.texto', 'Título de agora': '.agora.texto' },
  'forja-do-site': { Nicho: '.label', 'Do site': ['.reading.when', '.reading.countText', '.reading.sentText', '.reading.since.text', '.reading.siteNotes[0]', '.reading.siteNotes[1]', '.reading.siteNotes[2]', '.reading.evidenceLinks[0].text', '.reading.evidenceLinks[1].text', '.reading.evidenceLinks[2].text', '.reading.evidenceLinks[3].text'] },
}
const paridade = (m: Montado) => provarParidade({
  modelo: m.modelo, inventario: INVENTARIO_CANAL, pacote: m.pacote, textoDaTela: m.textoDaTela, textoDoPacote: m.textoDoPacote, colunas: COLUNAS, cruas: [],
})

// ───────────────────────── a matriz de estados
const VIDEO_COM_TROCA = buildCanalView(canalWorld().obs, 'matt-wolfe', { tab: 'trocas' })!.trocas.cards[0]!.videoId
const semNicho: Mut = (ds, id) => { ds.channels.find((c) => c.id === id)!.niche = null }
const MATRIZ: Array<[string, Params, Mut?]> = [
  ['Vídeos, padrão', {}],
  ['só longos', { fmt: 'longos' }],
  ['só Shorts', { fmt: 'shorts' }],
  ['só fixados', { fmt: 'fixados' }],
  ['por views', { sort: 'vistos' }],
  ['por múltiplo', { sort: 'multiplo' }],
  ['por views/dia, crescente', { sort: 'vpd', dir: 'asc' }],
  ['busca sem resultado', { q: 'zzzz' }],
  ['busca com resultado', { q: 'a' }],
  ['Trocas', { tab: 'trocas' }],
  ['Trocas de um vídeo', { tab: 'trocas', video: VIDEO_COM_TROCA }],
  ['Leitura do nicho', { tab: 'leitura' }],
  ['Leitura sem nicho', { tab: 'leitura' }, semNicho],
  ['primeira sincronização', {}, (ds, id) => { ds.channels.find((c) => c.id === id)!.sync.state = 'backfill' }],
  ['sincronização atrasada', {}, (ds, id) => { ds.channels.find((c) => c.id === id)!.sync.state = 'atrasado' }],
  ['sincronização com erro', { tab: 'trocas' }, (ds, id) => { const s = ds.channels.find((c) => c.id === id)!.sync; s.state = 'erro'; s.msg = 'quota'; s.errorSince = ds.now - 36e5 }],
]

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Canal: paridade em cada estado da matriz', () => {
  for (const [nome, sp, mut] of MATRIZ) {
    it(`${nome}: a tela e o pacote dizem o mesmo`, async () => {
      const m = await montar(sp, mut)
      expect(m.textoDaTela.length).toBeGreaterThan(100)
      expect(() => paridade(m)).not.toThrow()
    }, 60_000) // as fichas levam alguns segundos local e passaram de 20 s no runner da CI (mesmo caso do teste do vídeo, 10f6b90e8)
  }

  it('toda folha do modelo tem destino em todos os estados, e o inventário não guarda declaração velha (união da matriz)', async () => {
    const usos = new Set<string>()
    for (const [, sp, mut] of MATRIZ) {
      const m = await montar(sp, mut, false)
      expect(semDestino(m.modelo, INVENTARIO_CANAL)).toEqual([])
      expect(ignorados(m.modelo)).toEqual([])
      const sobra = new Set(semUso(m.modelo, INVENTARIO_CANAL))
      for (const k of Object.keys(INVENTARIO_CANAL)) if (!sobra.has(k)) usos.add(k)
    }
    const naoUsadas = Object.keys(INVENTARIO_CANAL).filter((k) => !usos.has(k))
    expect(naoUsadas.filter((k) => !SEM_FOLHA_NA_MATRIZ_CANAL.includes(k))).toEqual([])
  })

  it('o pacote leva só a aba ativa: Vídeos tem a lista, Trocas tem as trocas, Leitura tem a forja; o cabeçalho vai em todas', async () => {
    const v = await montar({}, undefined, false), t = await montar({ tab: 'trocas' }, undefined, false), l = await montar({ tab: 'leitura' }, undefined, false)
    for (const m of [v, t, l]) expect(m.pacote.tabelas.some((x) => x.id === 'cabecalho')).toBe(true)
    expect(v.pacote.tabelas.some((x) => x.id === 'videos')).toBe(true)
    expect(v.pacote.tabelas.some((x) => x.id === 'trocas')).toBe(false)
    expect(t.pacote.tabelas.some((x) => x.id === 'trocas')).toBe(true)
    expect(t.pacote.tabelas.some((x) => x.id === 'videos')).toBe(false)
    expect(l.pacote.tabelas.some((x) => x.id === 'videos' || x.id === 'trocas')).toBe(false)
    expect(l.pacote.citados.length).toBeGreaterThan(0)
    expect(v.pacote.tela).toBe('canal')
    expect(v.pacote.foco[0]).toMatchObject({ nome: v.modelo.header.name, oQueE: 'concorrente' })
    expect(v.pacote.privado).toEqual({ estado: 'na' })
  })

  it('a tabela de vídeos leva os vídeos da lista, na ordem da tela', async () => {
    const m = await montar({ sort: 'vistos' }, undefined, false)
    const t = m.pacote.tabelas.find((x) => x.id === 'videos')!
    expect(t.linhas.map((l) => (l[0] as { texto: string }).texto)).toEqual(m.modelo.videos.videos.map((v) => v.title))
    expect(t.linhas.length).toBeGreaterThan(0)
  })
})

describe('Canal: o que acontece quando o dado não existe', () => {
  it('busca sem resultado: nenhuma tabela de vídeos, a frase do vazio nos avisos', async () => {
    const m = await montar({ q: 'zzzz' }, undefined, false)
    expect(m.pacote.tabelas.some((t) => t.id === 'videos')).toBe(false)
    expect(m.modelo.derivado.lista.vazio).not.toBeNull()
    expect(m.pacote.avisos).toContain(m.modelo.derivado.lista.vazio!.text)
  })

  it('canal em primeira sincronização: os números dizem a frase de espera como "não medido", nunca zero', async () => {
    const m = await montar({}, (ds, id) => { ds.channels.find((c) => c.id === id)!.sync.state = 'backfill' }, false)
    const t = m.pacote.tabelas.find((x) => x.id === 'cabecalho')!
    const esperando = t.linhas.filter((l) => l[1]!.papel === 'numero' && l[1]!.estado === 'nao_medido')
    expect(esperando.length).toBeGreaterThan(5)
    expect(m.pacote.avisos).toContain(m.modelo.header.sync.text)
  })

  it('leitura sem nicho: sem citados e sem tabela da forja', async () => {
    const m = await montar({ tab: 'leitura' }, semNicho, false)
    expect(m.pacote.citados).toEqual([])
    expect(m.pacote.tabelas.some((t) => t.id === 'forja-do-site')).toBe(false)
  })

  it('vídeo sem views: a célula diz o motivo da tela, não o texto padrão', async () => {
    const m = await montar({}, undefined, false)
    const alterado: ModeloCanal = structuredClone(m.modelo)
    const v = alterado.videos.videos[0]!
    v.viewsText = null
    v.viewsMissing = 'sem contagem: o canal não deixa ver'
    const c = empacotarCanal(alterado).tabelas.find((t) => t.id === 'videos')!.linhas[0]![2]!
    expect(c).toMatchObject({ papel: 'numero', estado: 'nao_medido', motivo: 'sem contagem: o canal não deixa ver' })
  })
})

describe('Canal: lista parcial e endereços', () => {
  it('com antigos por carregar, a lista não é completa e o aviso do "Carregar mais" está nos avisos', async () => {
    const m = await montar({}, comAntigos(60), false)
    expect(m.modelo.derivado.lista.mais).not.toBeNull()
    expect(m.pacote.listasCompletas).toBe(false)
    expect(m.pacote.avisos).toContain(m.modelo.derivado.lista.mais!.frase)
  })

  it('nenhum texto do pacote leva "/cms/" nem "http"', async () => {
    for (const [, sp, mut] of MATRIZ) {
      const m = await montar(sp, mut, false)
      expect(m.textoDoPacote).not.toMatch(/\/cms\/|https?:|i\.ytimg|blob\.vercel|\?niche=/i)
    }
  })
})

describe('Canal: nenhuma frase longa com acento digitada fora das constantes de "não mede"', () => {
  it('o empacotador só tem frases longas nas constantes permitidas', () => {
    const fonte = readFileSync(resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canal.ts'), 'utf8')
    const permitidas = ['o que só o dono', 'a contagem diária dos vídeos', 'a leitura deste canal']
    const codigo = fonte.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/\b(titulo|nomeNoCorte):/.test(l)).map((l) => l.replace(/\s\/\/.*$/, ''))
    const literais = [...codigo.join('\n').matchAll(/(['`])((?:\\.|(?!\1).)*)\1/g)].map((x) => x[2]!).filter((s) => s.replace(/\$\{[^}]*\}/g, '').trim().split(/\s+/).length >= 10 && /[áàâãéêíóôõúç]/i.test(s))
    expect(literais.filter((s) => !permitidas.some((p) => s.startsWith(p)))).toEqual([])
  })
})

describe('Canal: provas por mutação (a paridade cai)', () => {
  it('trocar o vídeo de uma linha por outro derruba a regra (d2)', async () => {
    const m = await montar({})
    const t = m.pacote.tabelas.find((x) => x.id === 'videos')!
    const c = t.linhas[0]![0]!
    t.linhas[0]![0] = { ...c, origem: c.origem.replace(/videos\[(\d+)\]\.title/, 'videos[1].title') }
    expect(() => paridade(m)).toThrow(/\(d2\)/)
  }, 60_000) // mesmo caso das fichas acima: passou de 20 s no runner da CI (16/10)

  it('apagar uma entrada do inventário derruba a regra (a)', async () => {
    const m = await montar({})
    const { ['videos.videos[].viewsText']: _fora, ...sem } = INVENTARIO_CANAL
    void _fora
    expect(() => provarParidade({ modelo: m.modelo, inventario: sem, pacote: m.pacote, textoDaTela: m.textoDaTela, textoDoPacote: m.textoDoPacote, colunas: COLUNAS, cruas: [] }))
      .toThrow(/\(a\).*viewsText/)
  })
})

describe('Canal: lista de números sem prova por igualdade direta', () => {
  it('é vazia', () => { expect([...SEM_PROVA_POR_IGUALDADE_DIRETA_CANAL]).toEqual([]) })
})
