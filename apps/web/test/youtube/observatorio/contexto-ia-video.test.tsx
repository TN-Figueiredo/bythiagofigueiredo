// @vitest-environment jsdom
/**
 * E17 degrau 1, Tarefa 6d: o empacotador do Histórico do vídeo do concorrente. Paridade com o componente REAL da tela em cada estado da matriz (um
 * vídeo por estado do dado, com cada par de comparação aberto), o que acontece quando o dado não existe e as provas por mutação. Oráculo: o do Histórico.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { loadFase4, VID } from './fase4-world'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { HistoricoScreen } from '@/app/cms/(authed)/youtube/competitors/_historico/historico-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import {
  empacotarVideo, INVENTARIO_VIDEO, modeloDeVideo, SEM_FOLHA_NA_MATRIZ_VIDEO, SEM_PROVA_POR_IGUALDADE_DIRETA_VIDEO, type ModeloVideo,
} from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-video'
import { INVENTARIO_MEDIDAS_VIDEO } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-video-medidas'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { montarTexto } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { ignorados, semDestino, semUso } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { CONTEXTO } from './contexto-ia-fixture'
import { expandirTela, provarParidade } from './contexto-ia-paridade'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/video/x',
  useSearchParams: () => new URLSearchParams(''),
}))

const obs = createObservatory(datasetFromOracle(loadOracle()))
const obs4 = createObservatory(loadFase4().ds)
/** O mundo de cada id: os vídeos com muitas versões moram no mundo da fase 4. */
const mundoDe = (id: string) => ((Object.values(VID) as string[]).includes(id) ? obs4 : obs)
const PICK = {
  full: 'matt-opus55', pre: 'nate-ai-agent-business', few: 'matt-fast-cheap', none: 'matt-gpt6-astra', noreg: 'paddy-doyle-l0',
  untr: 'luke-damant-l71', old: 'preguica-hailuo', err: 'esq-lawsuit', bf: 'vou-sem-volta-s0',
} as const
type Params = Record<string, string | undefined>
interface Montado { modelo: ModeloVideo; pacote: PacoteModelo; textoDoPacote: string; textoDaTela: string }

const textoDoPacote = (p: PacoteModelo): string => montarTexto(segmentar(p, CONTEXTO), '', 1_000_000, 'todos').texto
const clicar = (el: Element) => act(async () => { fireEvent.click(el) })

/** A tela com cada par de comparação selecionado, um de cada vez, mais cada ⓘ aberto: junta o texto de tudo. */
async function textoDaTela(id: string, p: Params): Promise<string> {
  const view = buildHistoricoView(mundoDe(id), id, p)
  const r = render(<ToastProvider><HistoricoScreen view={view} /></ToastProvider>)
  const raiz = r.container as HTMLElement
  const partes: string[] = [await expandirTela(raiz)]
  // a expansão remonta a lista: os pares são buscados de novo pelo id a cada volta, e o texto é lido logo após o clique (antes da expansão)
  const ids = [...raiz.querySelectorAll<HTMLElement>('button.pair[data-k], li[data-k]')].map((e) => e.getAttribute('data-k')!)
  for (const k of ids) {
    const el = [...raiz.querySelectorAll<HTMLElement>('button.pair[data-k], li[data-k]')].find((e) => e.getAttribute('data-k') === k)
    if (!el) continue
    await clicar(el)
    partes.push(raiz.textContent ?? '')
    partes.push(await expandirTela(raiz))
  }
  for (const g of [...raiz.querySelectorAll<HTMLElement>('button[aria-expanded="false"][aria-controls]')].filter((b) => /\bibtn\b/.test(b.className))) {
    await clicar(g)
    partes.push(document.getElementById('flut')?.textContent ?? '')
    await clicar(g)
  }
  r.unmount(); cleanup(); document.getElementById('flut')?.remove()
  return partes.join('\n')
}

async function montar(id: string, p: Params = {}, desenhar = true): Promise<Montado> {
  const modelo = modeloDeVideo(buildHistoricoView(mundoDe(id), id, p))
  const pacote = empacotarVideo(modelo)
  return { modelo, pacote, textoDoPacote: textoDoPacote(pacote), textoDaTela: desenhar ? await textoDaTela(id, p) : '' }
}

// ───────────────────────── o mapa de colunas da regra (d3), escrito aqui
const VERSOES = { Versão: '.label', Período: '.span', 'No ar por': '.dur', 'Média de views/dia': '.rate' }
const COLUNAS: Record<string, Record<string, string | readonly string[]>> = {
  cabecalho: { Publicado: '.pub.age', 'Publicado em': '.pub.full', Formato: '.fmt' },
  'cabecalho-views': { Views: '.views.num' },
  'cabecalho-duracao': { Duração: '.dur' },
  'cabecalho-multiplo': { Múltiplo: '.mult.text' },
  'registros-diarios': { Registro: '.registro', 'Views acumuladas': '.acumuladas', 'Views por dia desde o anterior': '.porDia', 'Esperado (n)': '.esperado' },
  'versoes-titulos': VERSOES, 'versoes-thumbs': VERSOES, 'versoes-descricoes': { Versão: '.label', Período: '.span', 'No ar por': '.dur' },
  'versoes-titulos-texto': { Versão: '.label', Texto: '.clipText' },
  'versoes-titulos-marca': { Versão: '.label', Marca: '.tag.text' }, 'versoes-thumbs-marca': { Versão: '.label', Marca: '.tag.text' }, 'versoes-descricoes-marca': { Versão: '.label', Marca: '.tag.text' },
  trocas: { Troca: ['.label', '.chip'], Quando: '.when', Situação: '.statusLine' },
  'trocas-nome': { Troca: '.chip', 'Nome completo': '.label' },
  'trocas-medias': { Troca: ['.label', '.chip'], 'Antes (views/dia)': '.before', 'Depois (views/dia)': '.after' },
  'trocas-efeito': { Troca: ['.label', '.chip'], Veredito: '.effect.label' },
  'trocas-notas': { Troca: ['.label', '.chip'], Nota: ['.nobase.strong', '.nobase.text', '.full.what', '.full.whatWhen', '.full.days', '.full.verdictStrong', '.full.verdictText', '.full.src', '.full.second.strong', '.full.second.text', ...Array.from({ length: 32 }, (_, k) => k).map((k) => `.full.caveats[${k}]`), ...Array.from({ length: 32 }, (_, k) => k).map((k) => `.runLines[${k}]`)] },
  'descricoes-trocas': { 'Resumo da troca': '.sum' },
  'resumo-por-imagem': { Imagem: '.label', 'No ar': '.dur', Passagens: '.passes', 'Média de views/dia': '.rate', 'Quando esteve no ar': '.segsText' },
  'resumo-por-imagem-total': { Total: '.label', 'No ar': '.dur', Passagens: '.passes', 'Média de views/dia': '.rate' },
}
const paridade = (m: Montado) => provarParidade({
  modelo: m.modelo, inventario: INVENTARIO_VIDEO, pacote: m.pacote, textoDaTela: m.textoDaTela, textoDoPacote: m.textoDoPacote, colunas: COLUNAS, cruas: [],
})

// ───────────────────────── a matriz de estados
const MATRIZ: Array<[string, string, Params]> = [
  ...Object.entries(PICK).map(([k, id]): [string, string, Params] => [`vídeo ${k}`, id, { from: 'outliers' }]),
  ['vídeo com muitas versões, tudo', PICK.full, { range: 'tudo' }],
  ['vídeo antigo, tudo', PICK.pre, { range: 'tudo' }],
  ['muitas versões (fase 4), tudo', VID.many, { range: 'tudo' }],
  ['versões densas (fase 4), tudo', VID.dense, { range: 'tudo' }],
  ['faixa aberta (fase 4), 30 dias', VID.open, {}],
  ['faixa fechada (fase 4), tudo', VID.closed, { range: 'tudo' }],
  ['vídeo inexistente', 'nao-existe-zzz', {}],
]

afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.restoreAllMocks() })

describe('Vídeo: paridade em cada estado da matriz', () => {
  for (const [nome, id, sp] of MATRIZ) {
    it(`${nome}: a tela e o pacote dizem o mesmo`, async () => {
      const m = await montar(id, sp)
      expect(m.textoDaTela.length).toBeGreaterThan(50)
      expect(() => paridade(m)).not.toThrow()
    }, 60_000) // as fichas da fase 4 levam ~5 s local e passaram de 20 s no runner da CI
  }

  it('toda folha do modelo tem destino em todos os estados, e o inventário não guarda declaração velha (união da matriz)', async () => {
    const usos = new Set<string>()
    for (const [, id, sp] of MATRIZ) {
      const m = await montar(id, sp, false)
      expect(semDestino(m.modelo, INVENTARIO_VIDEO)).toEqual([])
      expect(ignorados(m.modelo)).toEqual([])
      const sobra = new Set(semUso(m.modelo, INVENTARIO_VIDEO))
      for (const k of Object.keys(INVENTARIO_VIDEO)) if (!sobra.has(k)) usos.add(k)
    }
    expect(Object.keys(INVENTARIO_VIDEO).filter((k) => !usos.has(k) && !SEM_FOLHA_NA_MATRIZ_VIDEO.includes(k) && !(k in INVENTARIO_MEDIDAS_VIDEO))).toEqual([])
  })

  it('o pacote da tela: nome do vídeo e do canal como terceiros, sem privado nem comentários', async () => {
    const m = await montar(PICK.full, {}, false)
    expect(m.pacote.tela).toBe('video')
    expect(m.pacote.foco[0]).toMatchObject({ nome: m.modelo.video!.title, oQueE: 'vídeo' })
    expect(m.pacote.privado).toEqual({ estado: 'na' })
    expect(m.pacote.comentarios).toEqual({ estado: 'na' })
    expect(m.pacote.tabelas.some((t) => t.id === 'registros-diarios')).toBe(true)
    expect(m.pacote.naoMede.length).toBeGreaterThan(0)
  })

  it('a tabela de registros diários leva todos os registros do modelo, na ordem', async () => {
    const m = await montar(PICK.full, {}, false)
    const t = m.pacote.tabelas.find((x) => x.id === 'registros-diarios')!
    expect(t.linhas.map((l) => (l[0] as { texto: string }).texto)).toEqual(m.modelo.derivado.registros.map((r) => r.registro))
    expect(t.linhas.length).toBeGreaterThan(0)
  })
})

describe('Vídeo: o que acontece quando o dado não existe', () => {
  it('vídeo não encontrado: sem tabelas, a frase do vazio e os avisos da tela', async () => {
    const m = await montar('nao-existe-zzz', {}, false)
    expect(m.pacote.tabelas).toEqual([])
    expect(m.pacote.citados).toEqual([])
    expect(m.pacote.vazio).toContain(m.modelo.notFound!.title)
    expect(m.pacote.avisos).toContain(m.modelo.notFound!.text)
  })

  it('vídeo sem série: nenhuma tabela de registros, a frase do vazio do gráfico nos avisos', async () => {
    const m = await montar(PICK.noreg, {}, false)
    expect(m.pacote.tabelas.some((t) => t.id === 'registros-diarios')).toBe(false)
    expect(m.modelo.chart!.empty!.title).toBeTruthy()
    expect(m.pacote.avisos).toContain(m.modelo.chart!.empty!.title)
  })

  it('toda a lista é entregue: listasCompletas é verdadeiro', async () => {
    expect((await montar(PICK.full, {}, false)).pacote.listasCompletas).toBe(true)
  })
})

describe('Vídeo: lista de trocas', () => {
  it('com muitas trocas a tela passa para a lista, e a tabela de trocas leva troca, quando e situação', async () => {
    const m = await montar(VID.many, { range: 'tudo' }, false)
    const t = m.pacote.tabelas.find((x) => x.id === 'trocas')
    if (m.modelo.compare.mode === 'list') expect(t?.colunas).toEqual(['Troca', 'Quando', 'Situação'])
    else expect(t?.colunas).toEqual(['Troca'])
  })
})

describe('Vídeo: descrição citada presa à linha da troca', () => {
  it('cada bloco citado de descrição leva a tabela e a posição da linha da troca', async () => {
    const m = await montar(PICK.full, { range: 'tudo' }, false)
    const t = m.pacote.tabelas.find((x) => x.id === 'descricoes-trocas')
    const blocos = m.pacote.citados.filter((c) => c.origem.includes('descs.diffs'))
    if (!t) { expect(blocos).toEqual([]); return }
    for (const b of blocos) {
      expect(b.linha?.tabela).toBe('descricoes-trocas')
      expect(b.linha!.posicao).toBeGreaterThanOrEqual(1)
      expect(b.linha!.posicao).toBeLessThanOrEqual(t.linhas.length)
    }
  })

  it('G-1: o Resumo por imagem da tela está no pacote, com a linha de cada imagem e o total', async () => {
    const m = await montar(PICK.full, { range: 'tudo' }, false)
    const r = m.modelo.imageSummary
    expect(r).not.toBeNull()
    const t = m.pacote.tabelas.find((x) => x.id === 'resumo-por-imagem')
    expect(t?.linhas.length).toBe(r!.rows.length)
    expect(m.pacote.tabelas.some((x) => x.id === 'resumo-por-imagem-total')).toBe(true)
    expect(m.textoDoPacote).toContain(r!.rows[0]!.dur)
  })

  it('o pacote não afirma causa: "Não prova causa." está nos avisos', async () => {
    expect((await montar(PICK.full, {}, false)).pacote.avisos).toContain('Não prova causa.')
  })
})

describe('Vídeo: endereços e imagens', () => {
  it('nenhum texto do pacote leva "/cms/" nem "http" nem endereço de miniatura', async () => {
    for (const [, id, sp] of MATRIZ) {
      const m = await montar(id, sp, false)
      // a descrição do vídeo é texto de terceiros e pode trazer links dela; o resto do pacote não leva nenhum endereço
      expect(textoDoPacote({ ...m.pacote, citados: [] })).not.toMatch(/\/cms\/|https?:|i\.ytimg|blob\.vercel|\?niche=/i)
      expect(m.textoDoPacote).not.toMatch(/\/cms\/|i\.ytimg|blob\.vercel|\?niche=/i)
    }
  })
})

describe('Vídeo: nenhuma frase longa com acento digitada fora das constantes de "não mede"', () => {
  it('o empacotador só tem frases longas nas constantes permitidas', () => {
    const fonte = readFileSync(resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-video.ts'), 'utf8')
    const permitidas = ['se uma troca explica', 'o que só o dono']
    const codigo = fonte.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/\b(titulo|nomeNoCorte):/.test(l)).map((l) => l.replace(/\s\/\/.*$/, ''))
    const literais = [...codigo.join('\n').matchAll(/(['`])((?:\\.|(?!\1).)*)\1/g)].map((x) => x[2]!).filter((s) => s.replace(/\$\{[^}]*\}/g, '').trim().split(/\s+/).length >= 10 && /[áàâãéêíóôõúç]/i.test(s))
    expect(literais.filter((s) => !permitidas.some((p) => s.startsWith(p)))).toEqual([])
  })
})

describe('Vídeo: provas por mutação (a paridade cai)', () => {
  it('trocar a linha de um registro por outra derruba a regra (d2)', async () => {
    const m = await montar(PICK.full)
    const t = m.pacote.tabelas.find((x) => x.id === 'registros-diarios')!
    const c = t.linhas[0]![1]!
    t.linhas[0]![1] = { ...c, origem: c.origem.replace(/registros\[0\]/, 'registros[1]') }
    expect(() => paridade(m)).toThrow(/\(d2\)/)
  })

  it('apagar uma entrada do inventário derruba a regra (a)', async () => {
    const m = await montar(PICK.full)
    const { ['derivado.registros[].porDia']: _fora, ...sem } = INVENTARIO_VIDEO
    void _fora
    expect(() => provarParidade({ modelo: m.modelo, inventario: sem, pacote: m.pacote, textoDaTela: m.textoDaTela, textoDoPacote: m.textoDoPacote, colunas: COLUNAS, cruas: [] }))
      .toThrow(/\(a\).*porDia/)
  })

  it('trocar duas colunas da mesma linha derruba a regra (d3)', async () => {
    const m = await montar(PICK.full)
    const l = m.pacote.tabelas.find((x) => x.id === 'registros-diarios')!.linhas[0]!
    ;[l[1], l[2]] = [l[2]!, l[1]!]
    expect(() => paridade(m)).toThrow(/\(d3\)/)
  })
})

describe('Vídeo: a lista de chaves sem folha na matriz', () => {
  it('só tem chaves que existem no inventário e não passa de 60', () => {
    expect(SEM_FOLHA_NA_MATRIZ_VIDEO.filter((k) => !(k in INVENTARIO_VIDEO))).toEqual([])
    expect(SEM_FOLHA_NA_MATRIZ_VIDEO.length).toBeLessThanOrEqual(60)
  })
})

describe('Vídeo: lista de números sem prova por igualdade direta', () => {
  it('é vazia', () => { expect([...SEM_PROVA_POR_IGUALDADE_DIRETA_VIDEO]).toEqual([]) })
})
