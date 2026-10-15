/**
 * A5 · E17 degrau 1, Tarefa 6e: o empacotador de Outliers. Puro: nada de banco, de relógio nem de conta; cada número é copiado do campo do
 * modelo, com o texto que o modelo já formatou, e cada célula leva a `origem` (o caminho do campo no modelo) para a prova de paridade.
 *
 * O MODELO daqui (`ModeloOutliers`) é o `OutliersView` da tela MAIS um objeto `derivado`, que só junta o que o modelo já traz, sem mudar valor:
 *  - texto rico (`Rich`: negrito, aviso, sigla com dica) vira a cadeia que a tela pinta, que é a concatenação das partes;
 *  - o nome do nicho (`nichoRotulo`) entra por parâmetro: quem monta o modelo tem o conjunto aberto (`obs.nicheLabel`).
 * A tela pagina no servidor (60 por grupo, "Mostrar mais" é um link com outra URL): o pacote leva a página que o modelo traz, e o aviso da
 * página ("Mostrando 60 de 896.") vai nos avisos; `listasCompletas` é falso.
 */
import type { OutlierCardView, OutlierGroupView, OutliersView, Rich } from '../_outliers/view-model'
import { A_TELA_NAO_INFORMA_O_MOTIVO } from '@/lib/youtube/observatorio/contexto-ia/frases'
import type { Inventario } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { BlocoCitado, Celula, PacoteModelo, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'

// ───────────────────────── o modelo
export interface DerivadoOutliers {
  nichoRotulo: string
  /** O texto de cada cartão que a tela pinta a partir de texto rico: a explicação do cartão principal. Mesma forma de `groups[].cards[]`. */
  groups: Array<{ cards: Array<{ why: string | null }> }>
}
export type ModeloOutliers = OutliersView & { derivado: DerivadoOutliers }

/** O que a tela pinta de um texto rico: as partes, coladas. */
export const textoDoRico = (r: Rich): string => r.map((p) => (typeof p === 'string' ? p : 'b' in p ? p.b : 'w' in p ? p.w : p.abbr)).join('')

/** Tudo o que o modelo da tela tem, mais o derivado. `nichoRotulo` é o nome do nicho como a tela o escreve ("Viagem"; "Todos" sem nicho). */
export function modeloDeOutliers(view: OutliersView, nichoRotulo: string): ModeloOutliers {
  return {
    ...view,
    derivado: {
      nichoRotulo,
      groups: view.groups.map((g) => ({ cards: g.cards.map((c) => ({ why: c.why ? textoDoRico(c.why) : null })) })),
    },
  }
}

// ───────────────────────── o inventário de folhas (item 160)
const CTRL = { descartado: 'controle de tela' } as const
const ID = { descartado: 'identificador' } as const
const END = { descartado: 'endereço' } as const
const APAR = { descartado: 'aparência' } as const
const REP = { descartado: 'repetido' } as const

const LEITURA = (raiz: string): Inventario => ({
  [`${raiz}.id`]: ID, [`${raiz}.niche`]: ID, [`${raiz}.nicheLabel`]: REP, [`${raiz}.seal`]: 'rotulo',
  [`${raiz}.title`]: 'terceiros', [`${raiz}.lead`]: 'terceiros', [`${raiz}.items[]`]: 'terceiros', [`${raiz}.theme`]: 'terceiros',
  [`${raiz}.keyItems[]`]: REP, [`${raiz}.moreItems[]`]: REP, [`${raiz}.inlineEvidence`]: CTRL, [`${raiz}.countText`]: CTRL, [`${raiz}.sinceLabel`]: CTRL,
  [`${raiz}.sentText`]: 'base', [`${raiz}.since.shortText`]: REP, [`${raiz}.since.text`]: 'base',
  [`${raiz}.evidenceLinks[].label`]: CTRL, [`${raiz}.evidenceLinks[].href`]: END, [`${raiz}.evidenceLinks[].n`]: CTRL, [`${raiz}.evidenceLinks[].text`]: CTRL,
  [`${raiz}.when`]: REP, [`${raiz}.isNew`]: CTRL, [`${raiz}.whenAgo`]: REP, [`${raiz}.siteNotes[]`]: 'base',
})

export const INVENTARIO_OUTLIERS: Inventario = {
  // o que a pessoa escolheu (o pacote o escreve na janela)
  'query.niche': 'rotulo', 'query.fmt': 'rotulo', 'query.ages[]': 'rotulo', 'query.ages': 'rotulo', 'query.min': 'rotulo',
  'query.topic': CTRL, 'query.formula': CTRL, 'query.channel': CTRL, 'query.asof': CTRL, 'query.reading': CTRL, 'query.sort': 'rotulo', 'query.view': CTRL,
  'derivado.nichoRotulo': 'rotulo',

  // as faixas de idade
  'shortcut.label': 'rotulo', 'shortcut.count': 'numero', 'shortcut.selected': CTRL, 'shortcut.disabled': CTRL, 'shortcut.href': END, 'shortcut.title': REP, 'shortcut.ariaLabel': REP,
  'timeline[].id': ID, 'timeline[].label': 'rotulo', 'timeline[].count': 'numero', 'timeline[].selected': CTRL, 'timeline[].href': END, 'timeline[].barPx': APAR,
  'timeline[].title': REP, 'timeline[].ariaLabel': REP,
  allCount: 'numero', allHref: END, allSelected: CTRL, allLabel: 'rotulo', allTitle: REP, allAriaLabel: REP,
  'fmtLinks[].value': ID, 'fmtLinks[].label': 'rotulo', 'fmtLinks[].href': END, 'fmtLinks[].pressed': CTRL,
  'viewLinks[].value': ID, 'viewLinks[].label': CTRL, 'viewLinks[].href': END, 'viewLinks[].pressed': CTRL,
  'sortOptions[].value': ID, 'sortOptions[].label': 'rotulo', 'sortOptions[].href': END,

  // os filtros que vieram com o link
  chipsLead: 'base', asofNote: 'base',
  'chips[].key': ID, 'chips[].kind': CTRL, 'chips[].label': 'base', 'chips[].invalid': CTRL, 'chips[].removeHref': END, 'chips[].removeLabel': REP,
  'chips[].link.label': CTRL, 'chips[].link.href': END, 'chips[].picks[].label': CTRL, 'chips[].picks[].href': END, 'chips[].title': REP, 'chips[].strong': 'base',

  // a frase do topo e "Como contamos"
  baseText: 'base', 'baseParts[]*': REP, 'baseParts[]': REP, 'basisMore[]': 'base',
  nicheNotice: CTRL, 'nicheNotice.niche': ID, 'nicheNotice.title': 'base', 'nicheNotice.body': 'base',
  'problems.shown[].name': 'terceiros', 'problems.shown[].phrase': 'base', 'problems.tail': 'base',
  'problems.rest[].name': 'terceiros', 'problems.rest[].phrase': 'base', 'problems.restLabel': CTRL, 'problems.hideLabel': CTRL,

  // os grupos e os cartões
  'groups[].id': ID, 'groups[].label': 'rotulo', 'groups[].tone': APAR, 'groups[].why': 'base', 'groups[].count': 'numero', 'groups[].weakCount': REP,
  'groups[].countText': 'base', 'groups[].onlyWeakText': 'base', 'groups[].pageNote': 'base',
  'groups[].cards[].id': ID, 'groups[].cards[].main': CTRL, 'groups[].cards[].title': 'terceiros', 'groups[].cards[].channel': 'terceiros', 'groups[].cards[].channelFull': REP,
  'groups[].cards[].channelHref': END, 'groups[].cards[].niche': ID, 'groups[].cards[].nicheLabel': 'rotulo',
  'groups[].cards[].age': 'base', 'groups[].cards[].ageTitle': REP, 'groups[].cards[].ageShort': REP,
  'groups[].cards[].mult': 'numero', 'groups[].cards[].multLabel': 'base', 'groups[].cards[].method': REP, 'groups[].cards[].tier': APAR,
  'groups[].cards[].weak': CTRL, 'groups[].cards[].stale': CTRL, 'groups[].cards[].neutral': CTRL,
  'groups[].cards[].views': 'numero', 'groups[].cards[].vpd7': REP, 'groups[].cards[].vpdText': REP, 'groups[].cards[].vpdTitle': REP,
  'groups[].cards[].vpdShort': 'numero', 'groups[].cards[].vpdShortNote': 'base',
  'groups[].cards[].historyHref': END, 'groups[].cards[].url': END, 'groups[].cards[].thumb': { descartado: 'imagem' }, 'groups[].cards[].art*': { descartado: 'imagem' },
  'groups[].cards[].dur': 'base',
  'groups[].cards[].tip[]*': REP, 'groups[].cards[].tip[]': REP, 'groups[].cards[].why[]*': REP, 'groups[].cards[].why[]': REP, // a explicação inteira vai em `derivado.groups[].cards[].why`
  'derivado.groups[].cards[].why': 'base',
  'groups[].cards[].flags[]': 'base', 'groups[].cards[].why': REP, 'groups[].cards[].reuse': CTRL,
  'groups[].cards[].phase.id': ID, 'groups[].cards[].phase.label': 'rotulo', 'groups[].cards[].phase.tone': APAR, 'groups[].cards[].showPhase': CTRL, 'groups[].cards[].phaseWhy': 'base',
  'groups[].cards[].reuse.month': 'base', 'groups[].cards[].reuse.vpd7': 'numero', 'groups[].cards[].reuse.median': 'numero',
  'groups[].cards[].ruler*': APAR,
  more: CTRL, 'more.href': END, 'more.label': CTRL, 'more.note': 'base',
  empty: CTRL, 'empty.title': 'base', 'empty.text': 'base', 'empty.actions[].label': 'rotulo', 'empty.actions[].href': END, 'empty.actions[].n': REP,
  'empty.actions[].primary': APAR, 'empty.actions[].dest': ID,
  count: REP, 'pageIds[]': ID,

  // a forja: o botão e o estado do cabeçalho são chrome; a barra de leituras é desta tela
  'forja.*': CTRL,
  'forjaBar.bad': CTRL,
  'forjaBar.summary.kind': CTRL, 'forjaBar.summary.when': 'base', 'forjaBar.summary.chip': 'base', 'forjaBar.summary.chipCls': APAR, 'forjaBar.summary.line': 'base',
  'forjaBar.summary.split': CTRL, 'forjaBar.summary.statusText': 'base',
  'forjaBar.since.multi': CTRL, 'forjaBar.since.items[].id': ID, 'forjaBar.since.items[].label': 'rotulo', 'forjaBar.since.items[].body': 'base',
  'forjaBar.req': CTRL, 'forjaBar.req.cls': APAR, 'forjaBar.req.text': 'base', 'forjaBar.req.trackHref': END, 'forjaBar.sideBad[]': 'base',
  'forjaBar.rows[].niche': 'rotulo', 'forjaBar.rows[].isNew': CTRL, 'forjaBar.rows[].first': REP, 'forjaBar.rows[].href': END,
  ...LEITURA('forjaBar.rows[].reading'),
  'forjaBar.scope.text': 'base', 'forjaBar.scope.outs[]': 'base',
}

/** Chaves do inventário cuja folha não aparece em nenhum estado da matriz do teste (cada uma tem teste sintético próprio quando importa). */
export const SEM_FOLHA_NA_MATRIZ_OUTLIERS: readonly string[] = [
  // o aviso do canal próprio e o pedido da forja em andamento: cada um tem teste sintético próprio, que monta a tela e o pacote
  'chips[].link.label', 'chips[].link.href',
  'forjaBar.summary.chip', 'forjaBar.summary.chipCls', 'forjaBar.summary.line', 'forjaBar.summary.split', 'forjaBar.summary.statusText',
  'forjaBar.req.cls', 'forjaBar.req.text', 'forjaBar.req.trackHref', 'forjaBar.sideBad[]',
]

/** Folhas de número cru: nenhuma. Todo número desta tela já vem formatado pelo modelo (`obs.fmt`). */
export const SEM_PROVA_POR_IGUALDADE_DIRETA_OUTLIERS = [] as const

// ───────────────────────── textos do pacote que esta tela escreve
// TEXTO-A-REVISAR (Logan/Naksu): as três frases de "o que esta tela não mede" e os títulos das tabelas abaixo.
const NAO_MEDE_CAUSA = 'a causa do sucesso de um vídeo: o múltiplo compara o vídeo com os outros do mesmo canal, não diz por que ele foi bem'
const NAO_MEDE_SO_ACOMPANHADOS = 'os vídeos que o canal tem fora da lista acompanhada: o múltiplo só conta os vídeos que o site já viu de cada canal'
const NAO_MEDE_RETENCAO = 'retenção, taxa de clique e recomendação por vídeo dos concorrentes: o YouTube só entrega esses dados ao dono do canal'

// ───────────────────────── células
const rotulo = (texto: string, origem: string): Celula => ({ papel: 'rotulo', texto, origem })
const base = (texto: string, origem: string): Celula => ({ papel: 'base', texto, origem })
const terceiros = (texto: string, origem: string): Celula => ({ papel: 'terceiros', texto, origem })

/** O texto que o modelo escreveu para um número. "—" e nulo são "não medido", sem motivo no modelo. */
function celulaDoNumero(texto: string | number | null, origem: string, motivo: string = A_TELA_NAO_INFORMA_O_MOTIVO): Celula {
  if (texto === null || texto === '—') return { papel: 'numero', estado: 'nao_medido', motivo, origem }
  const t = String(texto)
  if (t === '0') return { papel: 'numero', estado: 'zero_medido', texto: t, x: 0, origem }
  return { papel: 'numero', estado: 'medido', texto: t, x: null, origem }
}
const baseOuNaoMedido = (texto: string | null, origem: string): Celula => (texto === null ? celulaDoNumero(null, origem) : base(texto, origem))

const tabelaFixa = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][]): Tabela => ({ id, titulo, tipo: 'fixa', nomeNoCorte, privada: false, colunas, linhas })
const tabelaLista = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][]): Tabela => ({ id, titulo, tipo: 'lista', nomeNoCorte, privada: false, colunas, linhas })

// ───────────────────────── tabelas
const cartoes = (m: ModeloOutliers): Array<{ g: number; i: number; c: OutlierCardView; grupo: OutlierGroupView }> =>
  m.groups.flatMap((grupo, g) => grupo.cards.map((c, i) => ({ g, i, c, grupo })))

function tabelaDeIdades(m: ModeloOutliers): Tabela[] {
  const linhas: Celula[][] = [
    [rotulo(m.shortcut.label, 'modelo.shortcut.label'), celulaDoNumero(m.shortcut.count, 'modelo.shortcut.count')],
    ...m.timeline.map((w, i): Celula[] => [rotulo(w.label, `modelo.timeline[${i}].label`), celulaDoNumero(w.count, `modelo.timeline[${i}].count`)]),
    [rotulo(m.allLabel, 'modelo.allLabel'), celulaDoNumero(m.allCount, 'modelo.allCount')],
  ]
  return [tabelaFixa('idades', 'Outliers por faixa de idade do vídeo', 'tabela de faixas de idade', ['Faixa de idade', 'Outliers'], linhas)]
}

function tabelaDeGrupos(m: ModeloOutliers): Tabela[] {
  if (m.groups.length === 0) return []
  const saida: Tabela[] = []
  const contagens = m.groups.flatMap((g, i): Celula[][] => {
    if (g.count !== null) return [[rotulo(g.label, `modelo.groups[${i}].label`), celulaDoNumero(g.count, `modelo.groups[${i}].count`)]]
    if (g.onlyWeakText !== null) return [[rotulo(g.label, `modelo.groups[${i}].label`), base(g.onlyWeakText, `modelo.groups[${i}].onlyWeakText`)]]
    return []
  })
  if (contagens.length) saida.push(tabelaFixa('grupos', 'Os grupos da tela: quantos outliers cada um tem', 'tabela de grupos', ['Grupo', 'Outliers'], contagens))
  const notas = m.groups.flatMap((g, i): Celula[][] => [
    ...(g.why === '' ? [] : [[rotulo(g.label, `modelo.groups[${i}].label`), base(g.why, `modelo.groups[${i}].why`)]]),
    ...(g.countText === null ? [] : [[rotulo(g.label, `modelo.groups[${i}].label`), base(g.countText, `modelo.groups[${i}].countText`)]]),
    ...(g.pageNote === null ? [] : [[rotulo(g.label, `modelo.groups[${i}].label`), base(g.pageNote, `modelo.groups[${i}].pageNote`)]]),
  ])
  if (notas.length) saida.push(tabelaFixa('grupos-notas', 'Notas dos grupos: regra, base fraca e página', 'tabela de notas dos grupos', ['Grupo', 'Nota'], notas))
  return saida
}

function tabelaDeOutliers(m: ModeloOutliers): Tabela[] {
  const todos = cartoes(m)
  if (todos.length === 0) return []
  const o = 'modelo.groups'
  const saida: Tabela[] = [tabelaLista('outliers', 'Os outliers da tela, na ordem da tela', 'tabela de outliers',
    ['Grupo', 'Vídeo', 'Canal', 'Nicho', 'Múltiplo', 'Base do múltiplo', 'Views', 'Views/dia (7 dias)', 'Publicado', 'Duração'],
    todos.map(({ g, i, c, grupo }) => {
      const p = `${o}[${g}].cards[${i}]`
      return [
        rotulo(grupo.label, `${o}[${g}].label`), terceiros(c.title, `${p}.title`), terceiros(c.channel, `${p}.channel`),
        c.nicheLabel === null ? celulaDoNumero(null, `${p}.nicheLabel`) : rotulo(c.nicheLabel, `${p}.nicheLabel`),
        celulaDoNumero(c.mult, `${p}.mult`), base(c.multLabel, `${p}.multLabel`), celulaDoNumero(c.views, `${p}.views`), celulaDoNumero(c.vpdShort, `${p}.vpdShort`),
        base(c.age, `${p}.age`), baseOuNaoMedido(c.dur, `${p}.dur`),
      ]
    }))]
  const avisos: Celula[][] = []
  for (const { g, i, c } of todos) {
    const p = `${o}[${g}].cards[${i}]`
    const nome = (): Celula => terceiros(c.title, `${p}.title`)
    if (c.vpdShortNote !== null) avisos.push([nome(), base(c.vpdShortNote, `${p}.vpdShortNote`)])
    c.flags.forEach((f, k) => avisos.push([nome(), base(f, `${p}.flags[${k}]`)]))
    if (c.phaseWhy !== null) avisos.push([nome(), base(c.phaseWhy, `${p}.phaseWhy`)])
    const why = m.derivado.groups[g]?.cards[i]?.why ?? null
    if (why !== null) avisos.push([nome(), base(why, `modelo.derivado.groups[${g}].cards[${i}].why`)])
  }
  if (avisos.length) saida.push(tabelaLista('outliers-avisos', 'Avisos de cada outlier: base, sincronização e explicação', 'tabela de avisos dos outliers', ['Vídeo', 'Aviso'], avisos))
  const reuso = todos.flatMap(({ g, i, c }) => {
    if (c.reuse === null) return []
    const p = `${o}[${g}].cards[${i}]`
    return [[terceiros(c.title, `${p}.title`), base(c.reuse.month, `${p}.reuse.month`), celulaDoNumero(c.reuse.vpd7, `${p}.reuse.vpd7`), celulaDoNumero(c.reuse.median, `${p}.reuse.median`)]]
  })
  if (reuso.length) saida.push(tabelaLista('outliers-reuso', 'Assuntos antigos que ainda rendem, contra a mediana do canal', 'tabela de assuntos antigos', ['Vídeo', 'Mês do assunto', 'Views/dia (7 dias)', 'Mediana do canal (views/dia)'], reuso))
  return saida
}

function tabelaDeProblemas(m: ModeloOutliers): Tabela[] {
  const p = m.problems
  if (!p) return []
  const linhas = [
    ...p.shown.map((x, i): Celula[] => [terceiros(x.name, `modelo.problems.shown[${i}].name`), base(x.phrase, `modelo.problems.shown[${i}].phrase`)]),
    ...p.rest.map((x, i): Celula[] => [terceiros(x.name, `modelo.problems.rest[${i}].name`), base(x.phrase, `modelo.problems.rest[${i}].phrase`)]),
  ]
  return linhas.length ? [tabelaLista('canais-com-problema', 'Canais com problema de sincronização no recorte', 'tabela de canais com problema', ['Canal', 'Situação'], linhas)] : []
}

function tabelasDaForja(m: ModeloOutliers): Tabela[] {
  const b = m.forjaBar
  if (!b) return []
  const saida: Tabela[] = []
  if (b.since.items.length) {
    saida.push(tabelaFixa('forja-desde-entao', 'O que mudou desde a leitura da forja', 'tabela do que mudou desde a leitura', ['Leitura', 'Desde então'],
      b.since.items.map((x, i) => [rotulo(x.label, `modelo.forjaBar.since.items[${i}].label`), base(x.body, `modelo.forjaBar.since.items[${i}].body`)])))
  }
  const doSite: Celula[][] = []
  b.rows.forEach((r, i) => {
    const p = `modelo.forjaBar.rows[${i}]`
    doSite.push([rotulo(r.niche, `${p}.niche`), base(r.reading.sentText, `${p}.reading.sentText`)])
    if (r.reading.since) doSite.push([rotulo(r.niche, `${p}.niche`), base(r.reading.since.text, `${p}.reading.since.text`)])
    r.reading.siteNotes.forEach((n, k) => doSite.push([rotulo(r.niche, `${p}.niche`), base(n, `${p}.reading.siteNotes[${k}]`)]))
  })
  if (doSite.length) saida.push(tabelaLista('forja-do-site', 'O que o site escreve sobre cada leitura da forja', 'tabela do que o site diz da leitura', ['Leitura', 'Do site'], doSite))
  return saida
}

// ───────────────────────── os blocos citados (a leitura da forja)
function citadosDaForja(m: ModeloOutliers): BlocoCitado[] {
  return (m.forjaBar?.rows ?? []).map((r, i) => ({
    rotulo: r.reading.seal,
    texto: [r.reading.title, ...(r.reading.lead ? [r.reading.lead] : []), ...r.reading.items.map((t) => `- ${t}`), ...(r.reading.theme ? [r.reading.theme] : [])].join('\n'),
    origem: `modelo.forjaBar.rows[${i}].reading`,
  }))
}

// ───────────────────────── avisos e definições (frases do próprio modelo)
const presentes = (xs: ReadonlyArray<string | null | undefined>): string[] => xs.filter((x): x is string => typeof x === 'string' && x !== '')

function avisosDe(m: ModeloOutliers): string[] {
  const out: string[] = [m.baseText]
  out.push(...presentes([m.chipsLead, m.asofNote, m.nicheNotice?.title, m.nicheNotice?.body, m.problems?.tail, m.more?.note]))
  for (const c of m.chips) out.push(...presentes([[c.label, c.strong, c.link?.label].filter((x) => x).join(' ')]))
  const b = m.forjaBar
  if (b) {
    const s = b.summary
    out.push(...(s.kind === 'request' ? presentes([s.chip, s.line, s.split ? s.statusText : null]) : [`Leituras da forja: ${s.when}`]))
    out.push(...presentes([b.req?.text, ...b.sideBad, b.scope?.text]), ...(b.scope?.outs ?? []))
  }
  return out
}

function definicoesDe(m: ModeloOutliers): PacoteModelo['definicoes'] {
  return m.basisMore.map((frase, i) => ({ medida: i === 0 ? 'Como contamos' : `Como contamos (${i + 1})`, frase, limiares: [] }))
}

const janelaDe = (m: ModeloOutliers): string => {
  const formato = m.fmtLinks.find((f) => f.pressed)?.label ?? m.query.fmt
  const faixas = m.timeline.filter((w) => w.selected).map((w) => w.label)
  const idade = m.allSelected ? m.allLabel : m.shortcut.selected ? m.shortcut.label : faixas.join(' + ')
  const ordem = m.sortOptions.find((o) => o.value === m.query.sort)?.label
  return [m.derivado.nichoRotulo, formato, idade, `múltiplo mínimo ${m.query.min}×`, ...(ordem ? [ordem] : [])].filter((x) => x !== '').join(' · ')
}

// ───────────────────────── o empacotador
export function empacotarOutliers(modelo: ModeloOutliers): PacoteModelo {
  const tabelas: Tabela[] = [
    ...tabelaDeIdades(modelo), ...tabelaDeGrupos(modelo), ...tabelaDeOutliers(modelo), ...tabelaDeProblemas(modelo), ...tabelasDaForja(modelo),
  ]
  return {
    tela: 'outliers',
    janela: janelaDe(modelo),
    foco: [],
    tabelas,
    citados: citadosDaForja(modelo),
    definicoes: definicoesDe(modelo),
    avisos: avisosDe(modelo),
    naoMede: [NAO_MEDE_CAUSA, NAO_MEDE_SO_ACOMPANHADOS, NAO_MEDE_RETENCAO],
    privado: { estado: 'na' },
    comentarios: { estado: 'na' },
    vazio: modelo.empty ? `${modelo.empty.title}. ${modelo.empty.text}` : null,
    motivoDoMagro: null,
    listasCompletas: false,
  }
}
