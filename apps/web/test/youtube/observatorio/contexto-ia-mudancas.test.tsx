// @vitest-environment jsdom
/**
 * E17 degrau 1, Tarefa 6g: o empacotador de Mudanças. Paridade com o componente REAL da tela em cada estado da matriz, o que acontece quando
 * o dado não existe, o texto da descrição como bloco citado ligado à linha da troca, a ausência de linguagem de causa e provas por mutação.
 * Fixture sintética: o oráculo do repositório.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildMudancasView, type MudancasView } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'
import { MudancasScreen } from '@/app/cms/(authed)/youtube/competitors/_mudancas/mudancas-screen'
import {
  empacotarMudancas, INVENTARIO_MUDANCAS, modeloDeMudancas, SEM_FOLHA_NA_MATRIZ_MUDANCAS, SEM_PROVA_POR_IGUALDADE_DIRETA_MUDANCAS, type ModeloMudancas,
} from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-mudancas'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { montarTexto } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { ignorados, semDestino, semUso } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { CONTEXTO } from './contexto-ia-fixture'
import { expandirTela, provarParidade } from './contexto-ia-paridade'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/mudancas',
  useSearchParams: () => new URLSearchParams(''),
}))

const OBS = createObservatory(datasetFromOracle(loadOracle()))

type Params = Record<string, string>
interface Montado { view: MudancasView; modelo: ModeloMudancas; pacote: PacoteModelo; textoDoPacote: string; textoDaTela: string }

const textoDoPacote = (p: PacoteModelo, limite = 1_000_000): string => montarTexto(segmentar(p, CONTEXTO), '', limite, 'todos').texto

async function textoDaTelaDe(view: MudancasView): Promise<string> {
  const { container } = render(<MudancasScreen view={view} />)
  const t = await expandirTela(container)
  cleanup()
  return t
}

async function montar(params: Params, desenhar = true): Promise<Montado> {
  const view = buildMudancasView(OBS, params, new Set())
  const modelo = modeloDeMudancas(view, OBS.nicheLabel(view.filters.niche))
  const pacote = empacotarMudancas(modelo)
  return { view, modelo, pacote, textoDoPacote: textoDoPacote(pacote), textoDaTela: desenhar ? await textoDaTelaDe(view) : '' }
}

// ───────────────────────── o mapa de colunas da regra (d3), escrito aqui
const COLUNAS: Record<string, Record<string, string | readonly string[]>> = {
  'quadro-de-efeito': { Tipo: '.typeLabel', 'Trocas na janela': ['.all', '.title', '.thumb', '.desc'], 'Com veredito (n)': '.n', 'Mediana do efeito': ['.median', '.semMediana'], Resultado: '.text' },
  trocas: { Vídeo: '.video.title', Canal: '.video.channel', Nicho: '.video.nicheLabel', Tipo: '.typeLabel', Quando: '.when.text', Visto: '.when.rel' },
  'trocas-efeito': { Vídeo: '.video.title', Tipo: '.typeLabel', Veredito: '.effect.label', Observado: '.rows.observed', 'Antes (views/dia)': '.rows.observedFrom', 'Depois (views/dia)': '.rows.observedTo' },
  'trocas-esperado': { Vídeo: '.video.title', 'Esperado sem a troca': '.rows.expected', Efeito: '.effect.pp' },
  'trocas-faixa': { Vídeo: '.video.title', 'Limite da faixa': ['.iqr[0]', '.iqr[1]'] },
  'trocas-base': { Vídeo: '.video.title', 'Vídeos na base (n)': '.rows.n', 'Faixa de idade': '.rows.band', Método: '.rows.methodShort' },
  'trocas-titulos': { Vídeo: '.video.title', 'Título de antes': '.title.beforeText', 'Título de depois': '.title.afterText' },
  'trocas-thumbs': { Vídeo: '.video.title', Imagem: ['.thumbs[0].label', '.thumbs[1].label'], Período: ['.thumbs[0].period', '.thumbs[1].period'] },
  'trocas-descricoes': { Vídeo: '.video.title', 'Linhas novas': '.desc.add', 'Linhas removidas': '.desc.rem', 'Trocas de UTM ocultas': '.desc.noiseHidden' },
  'trocas-notas': { Vídeo: '.video.title', Nota: ['.video.meta[0]', '.video.meta[1]', '.video.meta[2]', '.video.meta[3]', '.video.meta[4]', '.video.meta[5]', '.video.syncNote', '.video.outNote', '.when.seq', '.when.run', '.runNote', '.badges[0].text', '.badges[1].text', '.badges[2].text', '.title.stats[0]', '.title.stats[1]', '.title.stats[2]', '.title.rewrite.text', '.thumbMissing[0]', '.thumbMissing[1]', '.desc.noText', '.effect.spark.head', '.effect.fallback', '.effect.noBase', '.effect.wait', '.effect.detail', '.effect.label', '.effect.caveats[0]', '.effect.caveats[1]', '.effect.caveats[2]', '.effect.caveats[3]'] },
  'forja-do-site': { Nicho: '.label', 'Do site': ['.reading.when', '.reading.countText', '.reading.sentText', '.reading.since.text', '.reading.siteNotes[0]', '.reading.siteNotes[1]', '.reading.siteNotes[2]', '.reading.evidenceLinks[0].text', '.reading.evidenceLinks[1].text', '.reading.evidenceLinks[2].text', '.reading.evidenceLinks[3].text'] },
}
const paridade = (m: Montado) => provarParidade({
  modelo: m.modelo, inventario: INVENTARIO_MUDANCAS, pacote: m.pacote, textoDaTela: m.textoDaTela, textoDoPacote: m.textoDoPacote, colunas: COLUNAS, cruas: [],
})

// ───────────────────────── a matriz de estados
const BASE = buildMudancasView(OBS, { win: '90' }, new Set())
const CANAL = BASE.controls.channels[0]!.options[0]!.id
const TROCAS = BASE.heroes.slice(0, 2).map((h) => h.id).join(',')
const MATRIZ: Array<[string, Params]> = [
  ['um canal', { channel: CANAL, win: '90' }],
  ['trocas citadas pela forja', { changes: TROCAS }],
  ['Shorts, 90 dias', { fmt: 'short', win: '90' }],
  ['um vídeo', { video: BASE.heroes[0]!.video.id }],
  ['padrão', {}],
  ['90 dias', { win: '90' }],
  ['7 dias', { win: '7' }],
  ['30 dias, só títulos', { win: '30', type: 'title' }],
  ['90 dias, só thumbnails', { win: '90', type: 'thumb' }],
  ['90 dias, só descrições', { win: '90', type: 'desc' }],
  ['IA, 90 dias', { niche: 'ia', win: '90' }],
  ['salvas (vazio com filtro escondendo)', { saved: '1' }],
  ['busca sem resultado', { q: 'zzzz' }],
  ['só medidas, 90 dias', { measured: '1', win: '90' }],
  ['ordenado por ganho, 90 dias', { sort: 'gain', win: '90' }],
  ['leitura da forja', { reading: 'resumo-trocas-ia-20-10' }],
]

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Mudanças: paridade em cada estado da matriz', () => {
  for (const [nome, params] of MATRIZ) {
    it(`${nome}: a tela e o pacote dizem o mesmo`, async () => {
      const m = await montar(params)
      expect(m.textoDaTela.length).toBeGreaterThan(100)
      expect(() => paridade(m)).not.toThrow()
    })
  }

  it('toda folha do modelo tem destino em todos os estados, e o inventário não guarda declaração velha (união da matriz)', async () => {
    const usos = new Set<string>()
    for (const [, params] of MATRIZ) {
      const m = await montar(params, false)
      expect(semDestino(m.modelo, INVENTARIO_MUDANCAS)).toEqual([])
      expect(ignorados(m.modelo)).toEqual([])
      const sobra = new Set(semUso(m.modelo, INVENTARIO_MUDANCAS))
      for (const k of Object.keys(INVENTARIO_MUDANCAS)) if (!sobra.has(k)) usos.add(k)
    }
    const naoUsadas = Object.keys(INVENTARIO_MUDANCAS).filter((k) => !usos.has(k))
    expect(naoUsadas.filter((k) => !SEM_FOLHA_NA_MATRIZ_MUDANCAS.includes(k))).toEqual([])
  })

  it('o pacote tem as dimensões de quem pede e leva todas as trocas do modelo, na ordem da tela', async () => {
    const m = await montar({ win: '90' }, false)
    expect(m.pacote.tela).toBe('mudancas')
    expect(m.pacote.janela).toContain(m.view.ledger.winLabel)
    expect(m.pacote.listasCompletas).toBe(true)
    expect(m.pacote.privado).toEqual({ estado: 'na' })
    const t = m.pacote.tabelas.find((x) => x.id === 'trocas')!
    expect(t.linhas).toHaveLength(m.view.heroes.length)
    expect(t.linhas.map((l) => (l[0] as { texto: string }).texto)).toEqual(m.view.heroes.map((h) => h.video.title))
  })
})

describe('Mudanças: o que acontece quando o dado não existe', () => {
  it('lista vazia: nenhuma tabela de trocas, `vazio` com a frase da tela', async () => {
    const m = await montar({ q: 'zzzz' }, false)
    expect(m.view.empty).not.toBeNull()
    expect(m.pacote.tabelas.some((t) => t.id === 'trocas')).toBe(false)
    expect(m.pacote.vazio).toBe(`${m.view.empty!.title}. ${m.view.empty!.text}`)
    expect(segmentar(m.pacote, CONTEXTO).vazio).toBe(true)
  })

  it('mediana ausente leva o motivo do quadro, não o texto padrão', async () => {
    const m = await montar({ win: '90' }, false)
    const sem = m.view.ledger.medians.findIndex((x) => x.median === null)
    if (sem < 0) return
    const c = m.pacote.tabelas.find((t) => t.id === 'quadro-de-efeito')!.linhas[sem]![3]!
    expect(c).toMatchObject({ papel: 'numero', estado: 'nao_medido', motivo: m.view.ledger.medians[sem]!.text })
  })
})

describe('Mudanças: folhas que o oráculo não preenche (teste sintético)', () => {
  it('linhas do cartão da forja e notas do site sobre a leitura chegam ao pacote', async () => {
    const m = await montar({ win: '90' }, false)
    const alterado: ModeloMudancas = structuredClone(m.modelo)
    alterado.forja.card.lines = ['Linha sintética do cartão']
    const b = alterado.forja.niches.find((n) => n.reading)
    if (b) b.reading!.siteNotes = ['Nota sintética do site']
    const texto = textoDoPacote(empacotarMudancas(alterado))
    expect(texto).toContain('Linha sintética do cartão')
    if (b) expect(texto).toContain('Nota sintética do site')
  })
})

describe('Mudanças: descrição como bloco citado ligado à linha da troca', () => {
  it('cada descrição com texto vira um citado preso à linha da sua troca', async () => {
    const m = await montar({ win: '90', type: 'desc' }, false)
    const idx = m.view.heroes.map((h, i) => (h.desc && h.desc.noText === null && h.desc.lines.length ? i : -1)).filter((i) => i >= 0)
    expect(idx.length).toBeGreaterThan(0)
    const cit = m.pacote.citados.filter((c) => c.linha?.tabela === 'trocas')
    expect(cit.map((c) => c.linha!.posicao)).toEqual(idx.map((i) => i + 1))
    expect(cit.every((c) => c.linha!.posicao >= 1 && c.linha!.posicao <= m.view.heroes.length)).toBe(true)
  })

  it('90 dias com 40 trocas de descrição: cortar a linha 26 tira o bloco dela, sem bloco órfão', async () => {
    const m = await montar({ win: '90', type: 'desc' }, false)
    const modelo: ModeloMudancas = structuredClone(m.modelo)
    const molde = modelo.heroes.find((h) => h.desc && h.desc.noText === null && h.desc.lines.length)!
    const dMolde = modelo.derivado.heroes[modelo.heroes.indexOf(molde)]!
    modelo.heroes = Array.from({ length: 40 }, (_, k) => { const h = structuredClone(molde); h.video.title = `Troca sintética ${k + 1}`; h.desc!.lines = h.desc!.lines.map((l) => ({ ...l, text: `${l.text} #${k + 1}` })); return h })
    modelo.derivado.heroes = modelo.heroes.map(() => structuredClone(dMolde))
    const pacote = empacotarMudancas(modelo)
    expect(pacote.citados.filter((c) => c.linha?.tabela === 'trocas')).toHaveLength(40)
    const cheio = textoDoPacote(pacote)
    const limite = Math.floor(cheio.length * 0.6)
    const cortado = montarTexto(segmentar(pacote, CONTEXTO), '', limite, 'todos').texto
    expect(cortado.length).toBeLessThan(cheio.length)
    const linhasVivas = new Set([...cortado.matchAll(/Troca sintética (\d+)/g)].map((x) => Number(x[1])))
    const blocos = [...cortado.matchAll(/descrição da troca (\d+)/g)].map((x) => Number(x[1]))
    expect(blocos.every((n) => linhasVivas.has(n))).toBe(true)
    if (!linhasVivas.has(26)) expect(blocos).not.toContain(26)
  })
})

describe('Mudanças: o pacote não afirma causa', () => {
  it('nenhuma frase de causa em nenhum estado, e o aviso "Não prova causa." está lá', async () => {
    for (const [, params] of MATRIZ) {
      const m = await montar(params, false)
      expect(m.textoDoPacote).not.toMatch(/causou|por causa|graças a|fez subir/i)
      expect(m.pacote.avisos).toContain('Não prova causa.')
    }
  })
})

describe('Mudanças: o que o site escreve não leva endereço', () => {
  it('nenhum texto do pacote leva "/cms/" nem "http"', async () => {
    for (const [, params] of MATRIZ) {
      const m = await montar(params, false)
      const semCitados = textoDoPacote({ ...m.pacote, citados: [] })
      expect(semCitados).not.toMatch(/\/cms\/|https?:|i\.ytimg|blob\.vercel|\?niche=/i)
    }
  })
})

describe('Mudanças: nenhuma frase longa com acento digitada fora das constantes de "não mede"', () => {
  it('o empacotador só tem frases longas nas constantes permitidas', () => {
    const fonte = readFileSync(resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-mudancas.ts'), 'utf8')
    const permitidas = ['se a troca explica', 'o efeito dos vídeos que o site não acompanha', 'retenção, taxa de clique']
    const codigo = fonte.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/\b(titulo|nomeNoCorte):/.test(l)).map((l) => l.replace(/\s\/\/.*$/, ''))
    const literais = [...codigo.join('\n').matchAll(/(['`])((?:\\.|(?!\1).)*)\1/g)].map((x) => x[2]!).filter((s) => s.replace(/\$\{[^}]*\}/g, '').trim().split(/\s+/).length >= 10 && /[áàâãéêíóôõúç]/i.test(s))
    expect(literais.filter((s) => !permitidas.some((p) => s.startsWith(p)))).toEqual([])
  })
})

describe('Mudanças: provas por mutação (a paridade cai)', () => {
  it('trocar o vídeo de uma linha por outro derruba a regra (d2)', async () => {
    const m = await montar({ win: '90' })
    const t = m.pacote.tabelas.find((x) => x.id === 'trocas')!
    const c = t.linhas[0]![0]!
    t.linhas[0]![0] = { ...c, origem: c.origem.replace(/heroes\[(\d+)\]/, 'heroes[1]') }
    expect(() => paridade(m)).toThrow(/\(d2\)/)
  })

  it('apagar uma entrada do inventário derruba a regra (a)', async () => {
    const m = await montar({ win: '90' })
    const { ['heroes[].typeLabel']: _fora, ...sem } = INVENTARIO_MUDANCAS
    void _fora
    expect(() => provarParidade({ modelo: m.modelo, inventario: sem, pacote: m.pacote, textoDaTela: m.textoDaTela, textoDoPacote: m.textoDoPacote, colunas: COLUNAS, cruas: [] }))
      .toThrow(/\(a\).*typeLabel/)
  })
})

describe('Mudanças: lista de números sem prova por igualdade direta', () => {
  it('é vazia', () => { expect([...SEM_PROVA_POR_IGUALDADE_DIRETA_MUDANCAS]).toEqual([]) })
})
