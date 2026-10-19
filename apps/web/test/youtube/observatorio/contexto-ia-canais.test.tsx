// @vitest-environment jsdom
/**
 * E17 degrau 1, Tarefa 6b: o empacotador da lista de Canais. Paridade com o componente REAL da tela em cada estado da matriz (formato, ordenação,
 * filtros, escala, tabela e cartões, com e sem canal próprio, com e sem o diário privado), o que acontece quando o dado não existe e as provas por
 * mutação. O modelo é o MESMO que `montarCanais` entrega à página (`buildCanaisView` + `buildRiView`). Fixture sintética: o oráculo.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => true,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(''),
}))
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Observatory } from '@/lib/youtube/observatorio'
import { a3World } from './a3-fixture'
import { medidasDoOraculo } from './canais-e5a-fixture'
import { buildCanaisView, type CanaisParams } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { buildRiView } from '@/app/cms/(authed)/youtube/competitors/_canais/ri-model'
import { CanaisScreen } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import { dmDia, type ExtrasProprio } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import {
  empacotarCanais, INVENTARIO_CANAIS, modeloDeCanais, NAO_COBERTO, SEM_FOLHA_NA_MATRIZ_CANAIS, SEM_PROVA_POR_IGUALDADE_CANAIS_VAZIA, type ModeloCanais, VPD_POR_MIL, VPD_MEDIANA, RITMO_COM_UNIDADE,
} from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canais'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { montarTexto } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { ignorados, semDestino, semUso } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { EstadoDoPrivado, PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { CONTEXTO } from './contexto-ia-fixture'
import { expandirTela, provarParidade } from './contexto-ia-paridade'

type Params = Partial<CanaisParams>
interface Montado { modelo: ModeloCanais; pacote: PacoteModelo; textoDoPacote: string; textoDaTela: string }

const textoDoPacote = (p: PacoteModelo): string => montarTexto(segmentar(p, CONTEXTO), '', 1_000_000, 'todos').texto
const ok = async () => ({ ok: true })

const { obs: OBS, owns: OWNS } = a3World()
const vazio = a3World((ds) => { ds.channels = []; ds.videos = [] })
const semProprios = a3World((ds) => { ds.channels = ds.channels.filter((c) => !c.own); ds.videos = ds.videos.filter((v) => ds.channels.some((c) => c.id === v.ch)) })

/** O diário privado de cada canal próprio, como `carregarExtrasProprio` o entrega. */
const extrasDe = (obs: Observatory, motivo: 'ok' | 'sem-acesso' | 'leitura-falhou' = 'ok'): ExtrasProprio => ({
  dm: dmDia,
  vpd: new Map(obs.channels.filter((c) => c.own).map((c) => [c.id, motivo === 'ok'
    ? { valor: 4300, motivo: null, n: 20, janela: { de: '2026-10-01', ate: '2026-10-20' }, ultimoDia: '2026-10-20', foraDoTeto: 0 }
    : { valor: null, motivo, n: 0, janela: null, ultimoDia: null, foraDoTeto: 0 }] as never)),
})
const privadoDe = (obs: Observatory, diario: 'ok' | 'negado' | 'erro', negativa: EstadoDoPrivado['negativa'] = null): EstadoDoPrivado => ({
  acessoPorCanal: Object.fromEntries(obs.channels.filter((c) => c.own).map((c) => [c.id, { diario }])), negativa,
})

interface Caso { obs: Observatory; sp: Params; extras?: ExtrasProprio; privado: EstadoDoPrivado; ri?: { ordr?: string; ordi?: string; aba?: string } }

function mundo(c: Caso) {
  const view = buildCanaisView(c.obs, { niche: 'todos', limit: 75, fmt: 'longos', medidas: medidasDoOraculo(c.obs), ...c.sp }, c.extras)
  const ri = buildRiView(c.obs, { agoraMs: c.obs.NOW, niche: c.sp.niche ?? 'todos', fmt: view.fmt === 'shorts' ? 'short' : 'long', ...c.ri, meuCanalLembrado: null, retratosProprios: new Map() }).view
  return { view, ri }
}

async function textoDaTela(c: Caso): Promise<string> {
  const { view, ri } = mundo(c)
  const r = render(<ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs="">
    <CanaisScreen view={view} ri={ri} canUnlock onAdd={ok} onPedir={ok} onApagar={ok} onDesfazer={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} />
  </div></ChromeSyncContext.Provider></ToastProvider>)
  let t = await expandirTela(r.container as HTMLElement)
  // as dicas das células só existem no documento enquanto o mouse está em cima: passa por cada uma e junta o texto da caixa flutuante
  const dicas: string[] = []
  for (const el of [...r.container.querySelectorAll<HTMLElement>('[data-cdica]')]) {
    await act(async () => { fireEvent.mouseEnter(el) })
    const caixa = document.querySelector('#flut .cn-tt')
    if (caixa?.textContent) dicas.push(caixa.textContent.replace(/\s+/g, ' ').trim())
    await act(async () => { fireEvent.mouseLeave(el) })
  }
  t = `${t}\n${dicas.join('\n')}`
  r.unmount(); cleanup(); document.getElementById('flut')?.remove()
  return t
}

async function montar(c: Caso, desenhar = true): Promise<Montado> {
  const { view, ri } = mundo(c)
  const modelo = modeloDeCanais(view, ri)
  const pacote = empacotarCanais(modelo, c.privado)
  return { modelo, pacote, textoDoPacote: textoDoPacote(pacote), textoDaTela: desenhar ? await textoDaTela(c) : '' }
}

// ───────────────────────── o mapa de colunas da regra (d3), escrito aqui
const LINHA = (r: string) => r
void LINHA
const TAB = (pre: string): Record<string, Record<string, string | readonly string[]>> => ({
  [`${pre}canais`]: {
    Posição: ['.posicao', '.semPosicao'], Canal: '.name', Inscritos: ['.subs', '.subsOcultos'], Direção: ['.direcao.texto', '.direcaoNaoCarregou', '.direcao.longa'],
    [RITMO_COM_UNIDADE]: ['.cells.cadence.pw', '.cells.cadence.text'], [VPD_POR_MIL]: ['.cells.vpd.big', '.cells.vpd.text'], [VPD_MEDIANA]: ['.cells.vpd.big', '.cells.vpd.text'], Outliers: ['.cells.out.mult', '.cells.out.text'],
    Trocas: ['.cells.swap.n', '.cells.swap.text'], Crescimento: ['.cells.growth.big', '.cells.growth.text'], Sincronização: '.cells.sync.label',
  },
  [`${pre}canais-nicho`]: { Canal: '.name', Nicho: '.nicho' },
  [`${pre}canais-direcao-numeros`]: { Canal: '.name', 'Views nos últimos 28 dias': '.direcaoNumeros.recente', 'Views nos 28 dias anteriores': '.direcaoNumeros.anterior' },
  [`${pre}canais-views-por-dia`]: { Canal: '.name', 'Views por dia, valor absoluto': '.cells.vpd.abs', 'Vídeos na base': '.cells.vpd.n' },
  [`${pre}canais-maior-outlier`]: { Canal: '.name', Vídeo: '.cells.out.videoTitle', 'Vídeos comparados': '.cells.out.n', Publicado: '.cells.out.published', Contagem: '.cells.out.count' },
  [`${pre}canais-outliers-contagem`]: { Canal: '.name', Contagem: '.cells.out.count' },
  [`${pre}canais-shorts-views-por-dia`]: { Canal: '.name', 'Views por dia dos Shorts, valor absoluto': '.cells.vpd2.abs', 'Vídeos na base dos Shorts': '.cells.vpd2.n' },
  [`${pre}canais-shorts`]: { Canal: '.name', 'Ritmo dos Shorts': ['.cells.cadence2.pw', '.cells.cadence2.text'], 'Views por dia dos Shorts': ['.cells.vpd2.big', '.cells.vpd2.text'], 'Outliers dos Shorts': ['.cells.out2.mult', '.cells.out2.text'] },
  [`${pre}canais-estado`]: { Canal: '.name', Estado: ['.estado.linha', '.estado.apoio', '.estado.quedaLinha'] },
  [`${pre}canais-notas`]: { Canal: '.name', Nota: ['.semPagina', '.semMedidaTexto', '.cells.cadence.sub', '.cells.cadence.paused', '.cells.vpd.tail', '.cells.out.weak', '.cells.out.upnext', '.cells.out.vs', '.cells.swap.last', '.ressalva', '.ressalva2', '.cells.cadence2.sub', '.cells.cadence2.paused', '.cells.out2.weak', '.cells.out2.upnext', '.cells.growth.cap', '.cells.sync.cov', '.cells.sync.msg', '.semFormato.label', '.semFormato.tip'] },
  [`${pre}canais-dicas`]: { Canal: '.name', Dica: ['.dicas.subs', '.dicas.vpd', '.dicas.cadence', '.dicas.out', '.dicas.swap', '.dicas.growth', '.dicas.direcao', '.dicas.sync', '.dicas.vpd2', '.dicas.cadence2', '.dicas.out2'] },
})
const COLUNAS = {
  ...TAB(''), ...TAB('privado-'),
  'canais-resumo-direcao': { Direção: '.palavra', Canais: ['.n', '.naoCarregou'] },
  'canais-resumo-estado': { Estado: '.rotulo', Canais: ['.n', '.ainda', '.naoMedido', '.naoCarregou'] },
  'canais-resumo-base': { Estado: '.rotulo', Base: '.base' },
  'canais-referencias': { Canal: '.nome', 'Views do vídeo típico': ['.valor', '.motivo'] },
  'canais-referencias-notas': { Canal: '.nome', Nota: ['.sub', '.situacao'] },
  'canais-inscritos': { Canal: '.nome', 'Ganho em 28 dias': ['.pct', '.motivo'] },
  'canais-inscritos-notas': { Canal: '.nome', Nota: ['.sub', '.nota', '.situacao'] },
}
const paridade = (m: Montado) => provarParidade({
  modelo: m.modelo, inventario: INVENTARIO_CANAIS, pacote: m.pacote, textoDaTela: m.textoDaTela, textoDoPacote: m.textoDoPacote, colunas: COLUNAS, cruas: [],
})

// ───────────────────────── a matriz de estados
const lido = (sp: Params = {}, o: Partial<Caso> = {}): Caso => ({ obs: OBS, sp, extras: extrasDe(OBS), privado: privadoDe(OBS, 'ok'), ...o })
const MATRIZ: Array<[string, Caso]> = [
  ['longos, diário lido', lido()],
  ['Shorts', lido({ fmt: 'shorts' })],
  ['Todos (longos e Shorts)', lido({ fmt: 'todos' })],
  ['cartões', lido({ layout: 'cards' })],
  ['por inscritos, crescente', lido({ sort: 'subs', dir: 'asc' })],
  ['por direção', lido({ sort: 'direcao' })],
  ['por crescimento', lido({ sort: 'growth' })],
  ['escala absoluta', lido({ scale: 'abs' })],
  ['filtro de estado: parados', lido({ filter: 'parados' })],
  ['filtro de direção: subindo', lido({ direcao: 'sobe' })],
  ['nicho viagem', lido({ niche: 'viagem' })],
  ['sem as medidas do site (não carregou)', lido({ medidas: null })],
  ['diário negado', { obs: OBS, sp: {}, extras: extrasDe(OBS, 'sem-acesso'), privado: privadoDe(OBS, 'negado', 'sem_direito') }],
  ['diário com falha', { obs: OBS, sp: {}, extras: extrasDe(OBS, 'leitura-falhou'), privado: privadoDe(OBS, 'erro') }],
  ['sem o diário nesta tela', { obs: OBS, sp: {}, privado: privadoDe(OBS, 'negado', 'nao_foi_possivel_conferir') }],
  ['sem canal próprio', { obs: semProprios.obs, sp: {}, privado: { acessoPorCanal: {}, negativa: null } }],
  ['filtro de estado: em queda (vazio explicado)', lido({ filter: 'em-queda' })],
  ['filtro de estado: problemas', lido({ filter: 'problemas' })],
  ['filtro de direção: descendo (vazio explicado)', lido({ direcao: 'desce' })],
  ['nenhum canal acompanhado', { obs: vazio.obs, sp: {}, privado: { acessoPorCanal: {}, negativa: null } }],
  ['referências por faixa e inscritos em absoluto', lido({}, { ri: { ordr: 'faixa', ordi: 'abs', aba: 'ins' } })],
]

afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.restoreAllMocks() })

describe('Canais: paridade em cada estado da matriz', () => {
  for (const [nome, caso] of MATRIZ) {
    it(`${nome}: a tela e o pacote dizem o mesmo`, async () => {
      const m = await montar(caso)
      expect(m.textoDaTela.length).toBeGreaterThan(100)
      expect(() => paridade(m)).not.toThrow()
    })
  }

  it('toda folha do modelo tem destino em todos os estados, e o inventário não guarda declaração velha (união da matriz)', async () => {
    const usos = new Set<string>()
    for (const [, caso] of MATRIZ) {
      const m = await montar(caso, false)
      expect(semDestino(m.modelo, INVENTARIO_CANAIS)).toEqual([])
      expect(ignorados(m.modelo)).toEqual([])
      const sobra = new Set(semUso(m.modelo, INVENTARIO_CANAIS))
      for (const k of Object.keys(INVENTARIO_CANAIS)) if (!sobra.has(k)) usos.add(k)
    }
    expect(SEM_FOLHA_NA_MATRIZ_CANAIS.length).toBeLessThanOrEqual(90)
    expect(Object.keys(INVENTARIO_CANAIS).filter((k) => !usos.has(k) && !SEM_FOLHA_NA_MATRIZ_CANAIS.includes(k))).toEqual([])
  })

  it('a matriz não abre o painel do canal (ainda não coberto): ?channel= fica de fora', () => {
    expect(NAO_COBERTO).toEqual(['drawer'])
    expect(MATRIZ.every(([, c]) => c.sp.channel === undefined)).toBe(true)
  })

  it('a tabela de canais leva as linhas da lista, na ordem da tela', async () => {
    const m = await montar(lido({ sort: 'subs' }), false)
    const ids = [...m.modelo.list.ranked, ...m.modelo.list.unranked].map((r) => r.name)
    const nomes = (id: string) => (m.pacote.tabelas.find((t) => t.id === id)?.linhas ?? []).map((l) => (l[1] as { texto: string }).texto)
    expect([...nomes('canais'), ...nomes('privado-canais')].sort()).toEqual([...ids].sort())
    expect(OWNS.length).toBeGreaterThan(0)
  })
})

describe('Canais: o dado privado do canal próprio', () => {
  it('diário lido: a linha de cada canal seu vai para a tabela privada, o estado é "incluído" e o pacote público não leva o canal', async () => {
    const m = await montar(lido(), false)
    expect(m.pacote.privado).toMatchObject({ estado: 'incluido' })
    const priv = m.pacote.tabelas.filter((t) => t.privada)
    expect(priv.length).toBeGreaterThan(0)
    const nomesDosProprios = [...m.modelo.list.ranked, ...m.modelo.list.unranked].filter((r) => r.own).map((r) => r.name)
    for (const t of m.pacote.tabelas.filter((x) => !x.privada && /^canais(-nicho|-direcao|-views|-maior|-shorts|-estado|-notas|-dicas)?$/.test(x.id))) for (const l of t.linhas) for (const c of l) for (const n of nomesDosProprios) expect(c.papel === 'numero' && c.estado === 'nao_medido' ? '' : (c as { texto: string }).texto).not.toBe(n)
  })

  it('diário negado com a negativa "sem direito": excluído, sem tabela privada', async () => {
    const m = await montar({ obs: OBS, sp: {}, extras: extrasDe(OBS, 'sem-acesso'), privado: privadoDe(OBS, 'negado', 'sem_direito') }, false)
    expect(m.pacote.privado).toMatchObject({ estado: 'excluido', motivo: 'sem_direito' })
    expect(m.pacote.tabelas.some((t) => t.privada)).toBe(false)
  })

  it('negativa nula: "não conferido", nunca "sem direito"', async () => {
    const m = await montar({ obs: OBS, sp: {}, privado: privadoDe(OBS, 'negado', null) }, false)
    expect(m.pacote.privado).toMatchObject({ estado: 'excluido', motivo: 'nao_conferido' })
  })

  it('leitura que falhou: excluído com "leitura falhou"', async () => {
    const m = await montar({ obs: OBS, sp: {}, extras: extrasDe(OBS, 'leitura-falhou'), privado: privadoDe(OBS, 'erro') }, false)
    expect(m.pacote.privado).toMatchObject({ estado: 'excluido', motivo: 'leitura_falhou' })
  })

  it('um canal lido e outro com falha: incluído e o aviso de parcial', async () => {
    const [a, b] = OWNS as [string, string]
    const priv: EstadoDoPrivado = { acessoPorCanal: { [a]: { diario: 'ok' }, [b]: { diario: 'erro' } }, negativa: null }
    const m = await montar({ obs: OBS, sp: {}, extras: extrasDe(OBS), privado: priv }, false)
    expect(m.pacote.privado).toMatchObject({ estado: 'incluido' })
    expect(m.pacote.avisos.some((x) => /não foi lida/.test(x))).toBe(true)
  })

  it('sem canal próprio: o dado privado não se aplica', async () => {
    const m = await montar({ obs: semProprios.obs, sp: {}, privado: { acessoPorCanal: {}, negativa: null } }, false)
    expect(m.pacote.privado).toEqual({ estado: 'na' })
  })
})

describe('Canais: o que acontece quando o dado não existe', () => {
  it('medidas não carregaram: toda direção diz "falhou" como não medido, nunca zero', async () => {
    const m = await montar(lido({ medidas: null }), false)
    const t = m.pacote.tabelas.find((x) => x.id === 'canais')!
    const col = t.colunas.indexOf('Direção')
    expect(t.linhas.some((l) => l[col]!.papel === 'numero' && l[col]!.estado === 'falhou' && (l[col] as { motivo: string }).motivo === 'falhou')).toBe(true)
    expect(t.linhas.every((l) => !(l[col]!.papel === 'numero' && l[col]!.estado === 'zero_medido'))).toBe(true)
  })

  it('nenhum texto do pacote leva "/cms/" nem "http"', async () => {
    for (const [, caso] of MATRIZ) {
      const m = await montar(caso, false)
      expect(m.textoDoPacote).not.toMatch(/\/cms\/|https?:|i\.ytimg|blob\.vercel|\?niche=/i)
    }
  })

  it('o nome de cada canal entra como terceiros', async () => {
    const m = await montar(lido(), false)
    const t = m.pacote.tabelas.find((x) => x.id === 'canais')!
    expect(t.linhas.every((l) => l[t.colunas.indexOf('Canal')]!.papel === 'terceiros')).toBe(true)
  })
})

describe('Canais: vazio, zero e definições', () => {
  it('nenhum canal acompanhado: o pacote diz o vazio com a frase da tela e não inventa linhas', async () => {
    const m = await montar({ obs: vazio.obs, sp: {}, privado: { acessoPorCanal: {}, negativa: null } }, false)
    expect(m.pacote.vazio).toBe(m.modelo.emptyText)
    expect(m.pacote.tabelas.some((t) => t.id === 'canais')).toBe(false)
  })

  it('filtro que esvazia a lista: o vazio explicado entra no pacote com o título e o apoio da tela', async () => {
    const m = await montar(lido({ filter: 'parados' }), false)
    expect(m.modelo.resumo.vazio).not.toBeNull()
    expect(m.pacote.vazio).toBe(`${m.modelo.resumo.vazio!.titulo}. ${m.modelo.resumo.vazio!.apoio}`)
  })

  it('contagem zero é zero medido, nunca não medido', async () => {
    const m = await montar(lido(), false)
    const t = m.pacote.tabelas.find((x) => x.id === 'canais-resumo-direcao')!
    const zeros = t.linhas.filter((l) => l[1]!.papel === 'numero' && l[1]!.texto === '0')
    expect(zeros.length).toBeGreaterThan(0)
    expect(zeros.every((l) => l[1]!.papel === 'numero' && l[1]!.estado === 'zero_medido')).toBe(true)
  })

  it('as definições vêm das seções de Referências e Inscritos, pelo título e pelos itens da tela', async () => {
    const m = await montar(lido(), false)
    const ri = m.modelo.ri!
    expect(ri.referencias.estado === 'ok' && ri.inscritos.estado === 'ok').toBe(true)
    if (ri.referencias.estado === 'ok' && ri.inscritos.estado === 'ok') {
      expect(m.pacote.definicoes.map((d) => d.medida)).toEqual([ri.referencias.info.titulo, ri.inscritos.info.titulo])
      expect(m.pacote.definicoes[0]!.frase).toBe(ri.referencias.info.itens.join(' '))
    }
  })

  it('"o que a tela não mede" nunca fica vazio', async () => {
    for (const [, caso] of MATRIZ) expect((await montar(caso, false)).pacote.naoMede.length).toBeGreaterThan(0)
  })
})

describe('Canais: nenhuma frase longa com acento digitada fora das constantes de "não mede"', () => {
  it('o empacotador só tem frases longas nas constantes permitidas', () => {
    const fonte = readFileSync(resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canais.ts'), 'utf8')
    const permitidas = ['o que só o dono', 'por que um canal sobe']
    const codigo = fonte.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/\b(titulo|nomeNoCorte):/.test(l)).map((l) => l.replace(/\s\/\/.*$/, ''))
    const literais = [...codigo.join('\n').matchAll(/(['`])((?:\\.|(?!\1).)*)\1/g)].map((x) => x[2]!).filter((s) => s.replace(/\$\{[^}]*\}/g, '').trim().split(/\s+/).length >= 10 && /[áàâãéêíóôõúç]/i.test(s))
    expect(literais.filter((s) => !permitidas.some((p) => s.startsWith(p)))).toEqual([])
  })
})

describe('Canais: provas por mutação (a paridade cai)', () => {
  it('trocar a linha de um canal por outra derruba a regra (d2)', async () => {
    const m = await montar(lido())
    const t = m.pacote.tabelas.find((x) => x.id === 'canais')!
    const c = t.linhas[0]![1]!
    t.linhas[0]![1] = { ...c, origem: c.origem.replace(/\[(\d+)\]\.name/, '[1].name') }
    expect(() => paridade(m)).toThrow(/\(d2\)/)
  })

  it('apagar uma entrada do inventário derruba a regra (a)', async () => {
    const m = await montar(lido())
    const { ['list.ranked[].subs']: _fora, ...sem } = INVENTARIO_CANAIS
    void _fora
    expect(() => provarParidade({ modelo: m.modelo, inventario: sem, pacote: m.pacote, textoDaTela: m.textoDaTela, textoDoPacote: m.textoDoPacote, colunas: COLUNAS, cruas: [] })).toThrow(/\(a\).*subs/)
  })

  it('trocar duas colunas da mesma linha derruba a regra (d3)', async () => {
    const m = await montar(lido())
    const l = m.pacote.tabelas.find((x) => x.id === 'canais')!.linhas[0]!
    ;[l[2], l[3]] = [l[3]!, l[2]!]
    expect(() => paridade(m)).toThrow(/\(d3\)/)
  })
})

describe('Canais: lista de números sem prova por igualdade direta', () => {
  it('é vazia', () => { expect([...SEM_PROVA_POR_IGUALDADE_CANAIS_VAZIA]).toEqual([]) })
})

describe('Canais: a negativa percorre a cadeia até a célula (decisão 75, I-2)', () => {
  const comNegativa = (negativa: 'sem_direito' | 'nao_foi_possivel_conferir'): Caso => ({
    obs: OBS, sp: {}, extras: { ...extrasDe(OBS, 'sem-acesso'), negativa }, privado: privadoDe(OBS, 'negado', negativa),
  })
  const ausentes = async (c: Caso): Promise<string[]> => {
    const m = await montar(c, false)
    return m.pacote.tabelas.flatMap((t) => t.linhas.flat()).flatMap((x) => (x.papel === 'numero' && (x.estado === 'falhou' || x.estado === 'restrito') ? [x.estado] : []))
  }
  it('guarda caída (nao_foi_possivel_conferir): a célula de views por dia da linha própria sai `falhou (`, nunca `restrito (`', async () => {
    const m = await montar(comNegativa('nao_foi_possivel_conferir'), false)
    expect(m.textoDoPacote).toMatch(/falhou \(/)
    expect(m.textoDoPacote).not.toMatch(/restrito \(/)
    expect(await ausentes(comNegativa('nao_foi_possivel_conferir'))).not.toContain('restrito')
  })
  it('sem direito provado (sem_direito): a célula sai `restrito (`, sem número e sem 0', async () => {
    const m = await montar(comNegativa('sem_direito'), false)
    expect(m.textoDoPacote).toMatch(/restrito \(/)
    expect(await ausentes(comNegativa('sem_direito'))).toContain('restrito')
  })
})
