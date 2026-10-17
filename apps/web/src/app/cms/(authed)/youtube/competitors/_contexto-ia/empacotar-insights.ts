/**
 * A5 · E17 degrau 1, Tarefa 6f: o empacotador de Insights. Puro: nada de banco, de relógio nem de conta; cada número é copiado do campo do
 * modelo, com o texto que o modelo já formatou, e cada célula leva a `origem` (o caminho do campo no modelo) para a prova de paridade.
 *
 * O MODELO daqui (`ModeloInsights`) é o `InsightsView` da tela MAIS um objeto `derivado`, que só junta ou reordena o que o modelo já traz,
 * sem mudar valor (a mesma arrumação "só de chave" que a 6a fez):
 *  - texto rico (`Rich`: negrito e número em fonte monoespaçada) vira a cadeia que a tela pinta, que é a concatenação das partes;
 *  - o mapa de calor (`table[][]`, lista de listas) vira uma lista de objetos com uma chave por bloco (`b0` a `b11`), cada um com `valor`
 *    ou `motivo`: duas células da mesma linha apontam para o mesmo elemento (a regra (d2) compara os ÍNDICES da origem);
 *  - as células de "Você no nicho" (`cells[]`, uma por métrica) vão para um objeto por chave de métrica, pelo mesmo motivo.
 * O nome do nicho (`nichoRotulo`) entra por parâmetro: quem monta o modelo tem o conjunto aberto (`obs.nicheLabel`), o empacotador não.
 */
import type {
  CadenceSection, FormulasSection, GapsSection, HeatmapSection, HeroBlock, HeroPara, InsightsView, Rich, ThemesSection, YouCell, YouColKey, YouSection,
} from '../_insights/view-model'
import { A_TELA_NAO_INFORMA_O_MOTIVO, AVISO_HORARIOS } from '@/lib/youtube/observatorio/contexto-ia/frases'
import type { Inventario } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { BlocoCitado, Celula, PacoteModelo, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'

// ───────────────────────── o modelo
/** Uma célula do mapa: o número que a tela escreve, ou o motivo de não haver número ("sem uploads", "pouco dado"). Exatamente um dos dois é nulo. */
export interface CelulaDoMapa { valor: string | null; motivo: string | null }
export type LinhaDoMapa = { dia: string } & { [bloco: `b${number}`]: CelulaDoMapa }

export interface DerivadoInsights {
  nichoRotulo: string
  formulas: { rows: Array<{ sentenca: string; ligacao: string; medCom: string | null; medSem: string | null }>; foot: string | null } | null
  heatmap: { uploads: LinhaDoMapa[]; mult: LinhaDoMapa[]; uploadsNota: string; multNota: string } | null
  themes: { rows: Array<{ mediana: string | null; tendencia: string | null }> } | null
  youInNiche: {
    rows: Array<{ c: Partial<Record<YouColKey, YouCell>> }>
    ref: { sub: string; c: Partial<Record<YouColKey, { value: string; range: string }>> } | null
  } | null
  gaps: { rows: Array<{ subTexto: string }> } | null
  hero: { box: string[] | null }
}
export type ModeloInsights = InsightsView & { derivado: DerivadoInsights }

/** O que a tela pinta de um texto rico: as partes, coladas. */
export const textoDoRico = (r: Rich): string => r.map((p) => (typeof p === 'string' ? p : 'b' in p ? p.b : 'mono' in p ? p.mono : p.bmono)).join('')

const textoDaPara = (p: HeroPara): string => (typeof p === 'string' ? p : `${p.before}runbook da forja${p.after}`)

function mapaDe(dias: string[], tabela: string[][], comoCelula: (texto: string) => CelulaDoMapa): LinhaDoMapa[] {
  return tabela.map((linha, d) => {
    const saida: LinhaDoMapa = { dia: dias[d] ?? '' }
    linha.forEach((texto, b) => { saida[`b${b}`] = comoCelula(texto) })
    return saida
  })
}

/** Tudo o que o modelo da tela tem, mais o derivado. `nichoRotulo` é o nome do nicho como a tela o escreve ("Viagem"; "Todos" sem nicho). */
export function modeloDeInsights(view: InsightsView, nichoRotulo: string): ModeloInsights {
  const f = view.formulas, h = view.heatmap, t = view.themes, y = view.youInNiche, g = view.gaps
  const colunasDe = (s: YouSection): YouColKey[] => s.cols.map((c) => c.key)
  const derivado: DerivadoInsights = {
    nichoRotulo,
    formulas: f && {
      rows: f.rows.map((r) => ({ medCom: r.bars[0]?.value ?? null, medSem: r.bars[1]?.value ?? null, sentenca: textoDoRico(r.sentence), ligacao: r.link.href && r.link.after ? `${r.link.text} ${r.link.after}` : r.link.text })),
      foot: f.foot ? textoDoRico(f.foot) : null,
    },
    heatmap: h && {
      uploads: mapaDe(h.days, h.uploads.table, (valor) => ({ valor, motivo: null })),
      mult: mapaDe(h.days, h.mult.table, (texto) => (/^\d/.test(texto) ? { valor: texto, motivo: null } : { valor: null, motivo: texto })),
      uploadsNota: textoDoRico(h.uploads.note),
      multNota: textoDoRico(h.mult.note),
    },
    themes: t && { rows: t.rows.map((r) => ({ mediana: r.median ? textoDoRico(r.median) : null, tendencia: r.trendText ? textoDoRico(r.trendText) : null })) },
    youInNiche: y && {
      rows: y.rows.map((r) => ({ c: Object.fromEntries((r.cells ?? []).map((c, i) => [colunasDe(y)[i], c])) })),
      ref: y.ref && { sub: y.ref.sub, c: Object.fromEntries(y.ref.cells.map((c, i) => [colunasDe(y)[i], c])) },
    },
    gaps: g && { rows: g.rows.map((r) => ({ subTexto: textoDoRico(r.sub) })) },
    hero: {
      box: view.hero?.box
        ? [view.hero.box.title, ...view.hero.box.paras.map(textoDaPara), ...(view.hero.box.stillNone ? [view.hero.box.stillNone] : []), ...(view.hero.box.link ? [view.hero.box.link.text] : [])]
        : null,
    },
  }
  return { ...view, derivado }
}

// ───────────────────────── o inventário de folhas (item 160)
/** Todo caminho do modelo, com o destino. Chave com `[]` = qualquer posição de lista; `*` no fim casa o resto. */
const BLOCOS_DO_MAPA = 12 // 7 dias × 12 blocos de 2 h; um teste confere
const doMapa = (raiz: string): Inventario => {
  const inv: Inventario = { [`${raiz}[].dia`]: 'rotulo' }
  for (let b = 0; b < BLOCOS_DO_MAPA; b += 1) { inv[`${raiz}[].b${b}.valor`] = 'numero'; inv[`${raiz}[].b${b}.motivo`] = 'motivo' }
  return inv
}
const cadaMetrica = (raiz: string, dest: Inventario[string], campos: readonly string[]): Inventario =>
  Object.fromEntries((['pw', 'perMilSubs', 'pctOutliers', 'engagement'] as const).flatMap((k) => campos.map((c) => [`${raiz}.c.${k}.${c}`, dest] as const)))

export const INVENTARIO_INSIGHTS: Inventario = {
  // o que a tela repete ou guarda para o menu do navegador (o chrome): nada disto é número da tela
  'reading*': { descartado: 'repetido' }, // a leitura da forja do nicho; o texto vem de `hero.view`
  'forja*': { descartado: 'controle de tela' }, // botão, estado da máquina e do pedido: chrome
  'direcaoNicho*': { descartado: 'controle de tela' }, // PENDENTE-E17-PACOTE(direcaoNicho*): E5a T9, a direção do nicho ainda não vai no pacote; o portão de ligar a IA (G-5) exige esta lista vazia
  niche: { descartado: 'identificador' }, fmt: 'rotulo',
  'window.label': 'rotulo', 'window.dates': 'rotulo', 'window.title': { descartado: 'controle de tela' },
  'fmtOptions[].key': { descartado: 'identificador' }, 'fmtOptions[].label': 'rotulo', 'fmtOptions[].pressed': { descartado: 'controle de tela' },
  'derivado.nichoRotulo': 'rotulo',

  // Todos: a tela pede um nicho
  all: { descartado: 'controle de tela' }, // nulo fora de Todos
  'all.title': 'base', 'all.text': 'base',
  'all.go[].niche': { descartado: 'identificador' }, 'all.go[].label': { descartado: 'controle de tela' }, 'all.go[].href': { descartado: 'endereço' },
  'all.forja.title': 'base', 'all.forja.lines[]': 'base', 'all.forja.text': 'base', 'all.forja.note': 'base',

  // a leitura da forja (texto de terceiros: gerado por modelo de linguagem)
  hero: { descartado: 'controle de tela' }, // nulo em Todos
  'hero.view': { descartado: 'controle de tela' }, // nulo sem leitura
  'hero.view.id': { descartado: 'identificador' },
  'hero.view.shown[].src': { descartado: 'identificador' }, 'hero.view.shown[].seal': 'rotulo',
  'hero.view.shown[].parts[].kind': { descartado: 'aparência' }, 'hero.view.shown[].parts[].text': 'terceiros', 'hero.view.shown[].parts[].ev': { descartado: 'repetido' },
  'hero.view.shown[].parts[].items[].text': 'terceiros', 'hero.view.shown[].parts[].items[].ev': { descartado: 'repetido' },
  'hero.view.more[].src': { descartado: 'identificador' }, 'hero.view.more[].seal': 'rotulo',
  'hero.view.more[].parts[].kind': { descartado: 'aparência' }, 'hero.view.more[].parts[].text': 'terceiros', 'hero.view.more[].parts[].ev': { descartado: 'repetido' },
  'hero.view.more[].parts[].items[].text': 'terceiros', 'hero.view.more[].parts[].items[].ev': { descartado: 'repetido' },
  'hero.view.nMore': { descartado: 'controle de tela' },
  'hero.view.ev[].n': 'rotulo', 'hero.view.ev[].src': { descartado: 'identificador' }, 'hero.view.ev[].text': 'base', 'hero.view.ev[].href': { descartado: 'endereço' },
  'hero.view.ev[].count': { descartado: 'repetido' }, 'hero.view.ev[].label': 'base',
  'hero.view.notes[]': 'base',
  'hero.view.since[].label': 'rotulo', 'hero.view.since[].shortText': 'base', 'hero.view.since[].text': 'base',
  'hero.statusChip': { descartado: 'controle de tela' }, 'hero.statusChip.text': 'base', 'hero.statusChip.dot': { descartado: 'aparência' }, 'hero.statusChip.pulse': { descartado: 'aparência' },
  'hero.askLine': 'base', 'hero.scopeNote': 'base', 'hero.publishedNote': 'base', 'hero.prevLabel': 'base',
  'hero.box': { descartado: 'repetido' }, 'hero.box.*': { descartado: 'repetido' }, // vai em `derivado.hero.box`
  'hero.reading*': { descartado: 'repetido' }, 'hero.themes*': { descartado: 'repetido' }, // o que `hero.view` já traz
  'hero.noteLabel': { descartado: 'controle de tela' }, 'hero.moreLabel': { descartado: 'controle de tela' }, 'hero.caveat': 'base',
  'derivado.hero.box': { descartado: 'controle de tela' }, 'derivado.hero.box[]': 'base',

  // fórmulas de título
  formulas: { descartado: 'controle de tela' },
  'formulas.meta': 'rotulo', 'formulas.metaRight': 'base',
  'formulas.rows[].id': { descartado: 'identificador' }, 'formulas.rows[].label': 'rotulo',
  'formulas.rows[].verdict': { descartado: 'aparência' }, 'formulas.rows[].verdictText': { descartado: 'repetido' }, // a sentença do motor; a tela escreve `sentence`
  'formulas.rows[].chip.kind': { descartado: 'aparência' }, 'formulas.rows[].chip.text': 'base', 'formulas.rows[].chip.title': 'base',
  'formulas.rows[]sentence*': { descartado: 'repetido' },
  'formulas.rows[].sentence[]*': { descartado: 'repetido' }, // as partes do texto rico; o texto inteiro está em `derivado.formulas.rows[].sentenca`
  'formulas.rows[].example': 'terceiros',
  'formulas.rows[].link.href': { descartado: 'endereço' }, 'formulas.rows[].link.text': { descartado: 'repetido' }, 'formulas.rows[].link.n': { descartado: 'repetido' }, 'formulas.rows[].link.after': { descartado: 'repetido' },
  'formulas.rows[].bars[].kind': { descartado: 'aparência' }, 'formulas.rows[].bars[].label': 'rotulo', 'formulas.rows[].bars[].width': { descartado: 'aparência' }, 'formulas.rows[].bars[].value': { descartado: 'repetido' }, // as duas medianas vão em `derivado.formulas.rows[].medCom` e `.medSem`
  'formulas.empty': { descartado: 'repetido' }, 'formulas.empty.title': 'base', 'formulas.empty.text': 'base',
  'formulas.zero': { descartado: 'controle de tela' }, 'formulas.zero.ids[]': { descartado: 'identificador' }, 'formulas.zero.text': 'base',
  'formulas.foot': { descartado: 'repetido' }, 'formulas.foot[]*': { descartado: 'repetido' },
  'derivado.formulas': { descartado: 'controle de tela' }, 'derivado.formulas.rows[].medCom': 'numero', 'derivado.formulas.rows[].medSem': 'numero', 'derivado.formulas.rows[].sentenca': 'base', 'derivado.formulas.rows[].ligacao': 'base', 'derivado.formulas.foot': 'base',

  // cadência por canal
  cadence: { descartado: 'controle de tela' },
  'cadence.meta': 'rotulo', 'cadence.legend[].color': { descartado: 'aparência' }, 'cadence.legend[].text': { descartado: 'aparência' },
  'cadence.axis[].left': { descartado: 'aparência' }, 'cadence.axis[].text': { descartado: 'aparência' },
  'cadence.rows[].id': { descartado: 'identificador' }, 'cadence.rows[].name': 'terceiros', 'cadence.rows[].fullName': { descartado: 'repetido' }, // o nome completo só aparece como dica do nome
  'cadence.rows[].ini': { descartado: 'aparência' }, 'cadence.rows[].avatar': { descartado: 'imagem' }, 'cadence.rows[].color': { descartado: 'aparência' },
  'cadence.rows[].aria': { descartado: 'repetido' }, 'cadence.rows[].syncOff': { descartado: 'controle de tela' },
  'cadence.rows[].warn': 'base', 'cadence.rows[].none': { descartado: 'repetido' }, 'cadence.rows[].noneSub': 'base',
  'cadence.rows[].pace': 'numero', 'cadence.rows[].partial': { descartado: 'controle de tela' }, 'cadence.rows[].habit': 'base', 'cadence.rows[].costuma': { descartado: 'controle de tela' },
  'cadence.rows[].outLink': { descartado: 'controle de tela' }, 'cadence.rows[].outLink.href': { descartado: 'endereço' }, 'cadence.rows[].outLink.text': 'base', 'cadence.rows[].outLink.n': { descartado: 'repetido' },
  'cadence.rows[].ticks[].left': { descartado: 'aparência' }, 'cadence.rows[].ticks[].height': { descartado: 'aparência' }, 'cadence.rows[].ticks[].tier': { descartado: 'aparência' },
  'cadence.rows[].ticks[].title': { descartado: 'aparência' }, // cada risco do gráfico (a dica diz o dia e a hora); o pacote leva o ritmo e o hábito
  'cadence.rows[].hatches[].kind': { descartado: 'aparência' }, 'cadence.rows[].hatches[].left': { descartado: 'aparência' }, 'cadence.rows[].hatches[].width': { descartado: 'aparência' },
  'cadence.rows[].hatches[].title': 'rotulo', 'cadence.rows[].hatches[].text': { descartado: 'repetido' }, 'cadence.rows[].hatches[].short': { descartado: 'aparência' },
  'cadence.rows[].last.kind': { descartado: 'controle de tela' }, 'cadence.rows[].last.text': 'base', 'cadence.rows[].last.title': { descartado: 'aparência' },
  'cadence.rows[].last.warn': { descartado: 'controle de tela' }, 'cadence.rows[].last.srNote': { descartado: 'repetido' },
  'cadence.noComp': { descartado: 'controle de tela' }, 'cadence.empty': 'base', 'cadence.foot': 'base',

  // mapa de calor
  heatmap: { descartado: 'controle de tela' },
  'heatmap.meta': 'rotulo', 'heatmap.days[]': 'rotulo', 'heatmap.blocks[]': 'rotulo', 'heatmap.hourLabels[]': { descartado: 'repetido' },
  'heatmap.uploads.intro': 'base', 'heatmap.uploads.aria': { descartado: 'repetido' }, 'heatmap.uploads.note[]*': { descartado: 'repetido' },
  'heatmap.uploads.cells[][]*': { descartado: 'repetido' }, 'heatmap.uploads.table[][]': { descartado: 'repetido' }, 'heatmap.uploads.caption': 'rotulo', 'heatmap.uploads.scale[]*': { descartado: 'aparência' },
  'heatmap.mult.intro': 'base', 'heatmap.mult.aria': { descartado: 'repetido' }, 'heatmap.mult.note[]*': { descartado: 'repetido' },
  'heatmap.mult.cells[][]*': { descartado: 'repetido' }, 'heatmap.mult.table[][]': { descartado: 'repetido' }, 'heatmap.mult.caption': 'rotulo', 'heatmap.mult.scale[]*': { descartado: 'aparência' },
  'heatmap.excluded': 'base', 'heatmap.empty': 'base',
  'derivado.heatmap': { descartado: 'controle de tela' },
  ...doMapa('derivado.heatmap.uploads'), ...doMapa('derivado.heatmap.mult'),
  'derivado.heatmap.uploadsNota': 'base', 'derivado.heatmap.multNota': 'base',

  // temas em alta
  themes: { descartado: 'controle de tela' },
  'themes.meta': 'rotulo', 'themes.seal': 'rotulo', 'themes.coverageNote': 'base', 'themes.noThemes': 'base', 'themes.foot': 'base',
  'themes.empty': { descartado: 'repetido' }, 'themes.empty.title': 'base', 'themes.empty.text': 'base', 'themes.empty.link*': { descartado: 'endereço' },
  'themes.rows[].theme': { descartado: 'identificador' }, 'themes.rows[].label': 'terceiros',
  'themes.rows[].trend': { descartado: 'aparência' }, 'themes.rows[].trendText[]*': { descartado: 'repetido' }, 'themes.rows[].trendCls': { descartado: 'aparência' },
  'themes.rows[].channels.text': 'base', 'themes.rows[].channels.weak': { descartado: 'aparência' },
  'themes.rows[].median[]*': { descartado: 'repetido' },
  'themes.rows[].outLink.href': { descartado: 'endereço' }, 'themes.rows[].outLink.text': 'base', 'themes.rows[].outLink.n': { descartado: 'repetido' },
  'themes.rows[].spark.prev': { descartado: 'aparência' }, 'themes.rows[].spark.now': { descartado: 'aparência' },
  'themes.rows[].spark.aria': { descartado: 'repetido' }, 'themes.rows[].spark.text': 'base',
  'derivado.themes': { descartado: 'controle de tela' }, 'derivado.themes.rows[].mediana': 'base', 'derivado.themes.rows[].tendencia': 'base',

  // você no nicho
  youInNiche: { descartado: 'controle de tela' },
  'youInNiche.meta': 'rotulo', 'youInNiche.foot': 'base',
  'youInNiche.empty': { descartado: 'repetido' }, 'youInNiche.empty.title': 'base', 'youInNiche.empty.text': 'base',
  'youInNiche.empty.links[].href': { descartado: 'endereço' }, 'youInNiche.empty.links[].text': { descartado: 'controle de tela' },
  'youInNiche.cols[].key': { descartado: 'identificador' }, 'youInNiche.cols[].label': 'rotulo', 'youInNiche.cols[].unit': 'base',
  'youInNiche.ref': { descartado: 'repetido' }, 'youInNiche.ref.*': { descartado: 'repetido' }, // vai em `derivado.youInNiche.ref`
  'youInNiche.rows[].id': { descartado: 'identificador' }, 'youInNiche.rows[].name': 'terceiros', 'youInNiche.rows[].href': { descartado: 'endereço' },
  'youInNiche.rows[].lang': { descartado: 'aparência' }, 'youInNiche.rows[].lang.*': { descartado: 'aparência' },
  'youInNiche.rows[].sub': 'base', 'youInNiche.rows[].cells[].*': { descartado: 'repetido' }, // vão em `derivado.youInNiche.rows[].c`
  'youInNiche.rows[].emptyText': 'base',
  'youInNiche.noRef': { descartado: 'repetido' }, 'youInNiche.noRef.text': 'base', 'youInNiche.noRef.link.href': { descartado: 'endereço' }, 'youInNiche.noRef.link.text': { descartado: 'controle de tela' },
  'youInNiche.noneNote': { descartado: 'repetido' }, 'youInNiche.noneNote.text': 'base', 'youInNiche.noneNote.links[].href': { descartado: 'endereço' }, 'youInNiche.noneNote.links[].text': { descartado: 'controle de tela' },
  'derivado.youInNiche': { descartado: 'controle de tela' }, 'derivado.youInNiche.ref': { descartado: 'controle de tela' }, 'derivado.youInNiche.ref.sub': 'rotulo',
    ...cadaMetrica('derivado.youInNiche.rows[]', 'base', ['text', 'verdict', 'few']),
  ...cadaMetrica('derivado.youInNiche.rows[]', 'motivo', ['base']),
  ...cadaMetrica('derivado.youInNiche.rows[]', 'numero', ['value']),
  ...cadaMetrica('derivado.youInNiche.rows[]', { descartado: 'aparência' }, ['kind', 'cls', 'baseTitle']),
  ...cadaMetrica('derivado.youInNiche.ref', 'numero', ['value']),
  ...cadaMetrica('derivado.youInNiche.ref', 'base', ['range']),

  // lacunas
  gaps: { descartado: 'controle de tela' },
  'gaps.meta': 'rotulo', 'gaps.foot': 'base', 'gaps.none': 'base', 'gaps.noThemes': 'base',
  'gaps.empty': { descartado: 'repetido' }, 'gaps.empty.title': 'base', 'gaps.empty.text': 'base', 'gaps.empty.links[].href': { descartado: 'endereço' }, 'gaps.empty.links[].text': { descartado: 'controle de tela' },
  'gaps.noRef': { descartado: 'repetido' }, 'gaps.noRef.text': 'base', 'gaps.noRef.link.href': { descartado: 'endereço' }, 'gaps.noRef.link.text': { descartado: 'controle de tela' },
  'gaps.rows[].theme': { descartado: 'identificador' }, 'gaps.rows[].label': 'terceiros', 'gaps.rows[].sub[]*': { descartado: 'repetido' },
  'gaps.rows[].lack': 'base', 'gaps.rows[].have': 'base', 'gaps.rows[].lacks[].id': { descartado: 'identificador' }, 'gaps.rows[].lacks[].name': { descartado: 'repetido' },
  'gaps.notes[].text': 'base', 'gaps.notes[].links[].href': { descartado: 'endereço' }, 'gaps.notes[].links[].text': { descartado: 'controle de tela' },
  'derivado.gaps': { descartado: 'controle de tela' }, 'derivado.gaps.rows[].subTexto': 'base',
}

/**
 * Chaves do inventário cuja folha não aparece em nenhum estado da matriz do teste: o pedido da forja em andamento (caixa de estado, selo de
 * andamento, "Ver a última leitura publicada") e os cinco ramos de vazio de "Você no nicho" e "Lacunas" que pedem um conjunto sem canal seu ou
 * sem temas. Cada um tem teste sintético próprio, que monta o modelo à mão.
 */
export const SEM_FOLHA_NA_MATRIZ_INSIGHTS: readonly string[] = [
  'direcaoNicho*', // E5a T9: a matriz do teste monta o modelo sem as medidas do site; o cartão nasce em `montarInsights`
  'hero.statusChip', 'hero.statusChip.text', 'hero.statusChip.dot', 'hero.statusChip.pulse', 'hero.askLine', 'hero.publishedNote', 'hero.prevLabel',
  'hero.box', 'hero.box.*', 'derivado.hero.box[]', 'hero.view.notes[]',
  'formulas.empty.title', 'formulas.empty.text', 'formulas.rows[]sentence*',
  'themes.empty.title', 'themes.empty.text', 'themes.empty.link*', 'themes.noThemes', 'themes.coverageNote',
  'youInNiche.noRef', 'youInNiche.noRef.text', 'youInNiche.noRef.link.href', 'youInNiche.noRef.link.text',
  'youInNiche.noneNote', 'youInNiche.noneNote.text', 'youInNiche.noneNote.links[].href', 'youInNiche.noneNote.links[].text',
  'gaps.noThemes', 'gaps.none', 'gaps.noRef', 'gaps.noRef.text', 'gaps.noRef.link.href', 'gaps.noRef.link.text',
  'heatmap.empty', 'cadence.empty', 'all.forja.lines[]', 'gaps.notes[].text', 'gaps.notes[].links[].href', 'gaps.notes[].links[].text',
  // métricas de "Você no nicho" que só mostram "sem dado" quando a base é pequena demais
  ...(['pw', 'perMilSubs', 'engagement'] as const).flatMap((k) => [`derivado.youInNiche.rows[].c.${k}.text`, `derivado.youInNiche.rows[].c.${k}.base`, `derivado.youInNiche.rows[].c.${k}.baseTitle`]),
]

/** Folhas de número cru: nenhuma. Todo número desta tela já vem formatado pelo modelo (`obs.fmt`). */
export const SEM_PROVA_POR_IGUALDADE_DIRETA_INSIGHTS = [] as const

// ───────────────────────── textos do pacote que esta tela escreve
// TEXTO-A-REVISAR (Logan/Naksu): as três frases de "o que esta tela não mede" e as medidas dos títulos de tabela abaixo.
const NAO_MEDE_CAUSA = 'a causa de um padrão: fórmula de título, tema ou horário que aparece junto de vídeo forte não prova que o causou'
const NAO_MEDE_HORA = 'o resultado de publicar numa hora: o mapa conta quando os concorrentes publicam e o múltiplo dos vídeos, não as views por hora de cada vídeo'
const NAO_MEDE_RETENCAO = 'retenção, taxa de clique e recomendação por vídeo dos concorrentes: o YouTube só entrega esses dados ao dono do canal'

// ───────────────────────── células
const rotulo = (texto: string, origem: string): Celula => ({ papel: 'rotulo', texto, origem })
const base = (texto: string, origem: string): Celula => ({ papel: 'base', texto, origem })
const terceiros = (texto: string, origem: string): Celula => ({ papel: 'terceiros', texto, origem })

/** O texto que o modelo escreveu para um número. "—" (o motor escreve assim o que não mediu) e nulo são "não medido", sem motivo no modelo. */
function celulaDoNumero(texto: string | null, origem: string): Celula {
  if (texto === null || texto === '—') return { papel: 'numero', estado: 'nao_medido', motivo: A_TELA_NAO_INFORMA_O_MOTIVO, origem }
  if (texto === '0') return { papel: 'numero', estado: 'zero_medido', texto, x: 0, origem }
  return { papel: 'numero', estado: 'medido', texto, x: null, origem }
}

function celulaDoMapa(c: CelulaDoMapa, origem: string): Celula {
  if (c.valor !== null) return celulaDoNumero(c.valor, `${origem}.valor`)
  return { papel: 'numero', estado: 'nao_medido', motivo: c.motivo ?? A_TELA_NAO_INFORMA_O_MOTIVO, origem: `${origem}.motivo` }
}

const tabelaFixa = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][]): Tabela => ({ id, titulo, tipo: 'fixa', nomeNoCorte, privada: false, colunas, linhas })
const tabelaLista = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][]): Tabela => ({ id, titulo, tipo: 'lista', nomeNoCorte, privada: false, colunas, linhas })

// ───────────────────────── tabelas
function tabelasDeFormulas(m: ModeloInsights): Tabela[] {
  const f: FormulasSection | null = m.formulas
  const d = m.derivado.formulas
  if (!f || !d) return []
  const o = 'modelo.formulas'
  const saida: Tabela[] = []
  if (f.rows.length) {
    saida.push(tabelaFixa('formulas', `Fórmulas de título · ${f.meta}`, 'tabela de fórmulas de título',
      ['Fórmula', 'Situação', 'Mediana com a fórmula', 'Mediana sem a fórmula', 'Leitura da tela', 'Vídeos hoje'],
      f.rows.map((r, i) => [
        rotulo(r.label, `${o}.rows[${i}].label`), base(r.chip.text, `${o}.rows[${i}].chip.text`),
        celulaDoNumero(d.rows[i]?.medCom ?? null, `modelo.derivado.formulas.rows[${i}].medCom`), celulaDoNumero(d.rows[i]?.medSem ?? null, `modelo.derivado.formulas.rows[${i}].medSem`),
        base(d.rows[i]?.sentenca ?? '', `modelo.derivado.formulas.rows[${i}].sentenca`), base(d.rows[i]?.ligacao ?? '', `modelo.derivado.formulas.rows[${i}].ligacao`),
      ])))
    const comExemplo = f.rows.flatMap((r, i) => (r.example === null ? [] : [[rotulo(r.label, `${o}.rows[${i}].label`), terceiros(r.example, `${o}.rows[${i}].example`)]]))
    if (comExemplo.length) saida.push(tabelaLista('formulas-exemplos', 'Um vídeo de exemplo de cada fórmula', 'tabela de exemplos de fórmula', ['Fórmula', 'Exemplo'], comExemplo))
  }
  return saida
}

function tabelasDeCadencia(m: ModeloInsights): Tabela[] {
  const c: CadenceSection | null = m.cadence
  if (!c || c.noComp) return []
  const o = 'modelo.cadence'
  const saida: Tabela[] = []
  const comRitmo = c.rows.flatMap((r, i) => (r.pace === null ? [] : [i]))
  if (comRitmo.length) {
    saida.push(tabelaLista('cadencia', `Cadência por canal · ${c.meta}`, 'tabela de cadência', ['Canal', 'Uploads por semana', 'Hábito', 'Último upload', 'Outliers do canal'],
      comRitmo.map((i) => {
        const r = c.rows[i]!
        return [
          terceiros(r.name, `${o}.rows[${i}].name`), celulaDoNumero(r.pace, `${o}.rows[${i}].pace`),
          r.habit === null ? { papel: 'numero', estado: 'nao_medido', motivo: A_TELA_NAO_INFORMA_O_MOTIVO, origem: `${o}.rows[${i}].habit` } : base(r.habit, `${o}.rows[${i}].habit`),
          base(r.last.text, `${o}.rows[${i}].last.text`),
          r.outLink === null ? { papel: 'numero', estado: 'nao_medido', motivo: A_TELA_NAO_INFORMA_O_MOTIVO, origem: `${o}.rows[${i}].outLink.text` } : base(r.outLink.text, `${o}.rows[${i}].outLink.text`),
        ]
      })))
  }
  const semVideo = c.rows.flatMap((r, i) => (r.noneSub === null ? [] : [[terceiros(r.name, `${o}.rows[${i}].name`), base(r.noneSub, `${o}.rows[${i}].noneSub`)]]))
  if (semVideo.length) saida.push(tabelaFixa('cadencia-sem-video', 'Canais sem vídeo acompanhado neste formato', 'tabela de canais sem vídeo', ['Canal', 'Motivo'], semVideo))
  const avisos: Celula[][] = []
  c.rows.forEach((r, i) => {
    if (r.warn !== null) avisos.push([terceiros(r.name, `${o}.rows[${i}].name`), base(r.warn, `${o}.rows[${i}].warn`)])
    r.hatches.forEach((h, k) => { if (h.kind === 'part') avisos.push([terceiros(r.name, `${o}.rows[${i}].name`), rotulo(h.title, `${o}.rows[${i}].hatches[${k}].title`)]) })
  })
  if (avisos.length) saida.push(tabelaFixa('cadencia-avisos', 'Canais com sincronização atrasada ou vídeos ainda sendo buscados', 'tabela de avisos da cadência', ['Canal', 'Aviso'], avisos))
  return saida
}

function tabelasDoMapa(m: ModeloInsights): Tabela[] {
  const h: HeatmapSection | null = m.heatmap
  const d = m.derivado.heatmap
  if (!h || !d || h.empty !== null) return []
  const colunas = ['Dia', ...h.blocks]
  const corpo = (linhas: LinhaDoMapa[], raiz: string): Celula[][] => linhas.map((linha, i) => [
    rotulo(linha.dia, `${raiz}[${i}].dia`),
    ...h.blocks.map((_, b) => celulaDoMapa(linha[`b${b}`] ?? { valor: null, motivo: null }, `${raiz}[${i}].b${b}`)),
  ])
  return [
    { id: 'mapa-uploads', titulo: `Quando publicam: uploads por dia e bloco de 2 horas · ${h.meta}`, tipo: 'dia_a_dia', nomeNoCorte: 'mapa de uploads', privada: false, colunas, linhas: corpo(d.uploads, 'modelo.derivado.heatmap.uploads') },
    { id: 'mapa-multiplicador', titulo: `Quando publicam: multiplicador mediano por dia e bloco de 2 horas · ${h.meta}`, tipo: 'dia_a_dia', nomeNoCorte: 'mapa do multiplicador', privada: false, colunas, linhas: corpo(d.mult, 'modelo.derivado.heatmap.mult') },
  ]
}

function tabelasDeTemas(m: ModeloInsights): Tabela[] {
  const t: ThemesSection | null = m.themes
  const d = m.derivado.themes
  if (!t || !d || t.rows.length === 0) return []
  const o = 'modelo.themes'
  const nome = (r: ThemesSection['rows'][number], i: number): Celula => terceiros(r.label, `${o}.rows[${i}].label`)
  const saida: Tabela[] = [tabelaLista('temas', `Temas em alta · ${t.meta}${t.seal ? ` · ${t.seal}` : ''}`, 'tabela de temas',
    ['Tema', 'Canais', 'Outliers hoje'], t.rows.map((r, i) => [nome(r, i), base(r.channels.text, `${o}.rows[${i}].channels.text`), base(r.outLink.text, `${o}.rows[${i}].outLink.text`)]))]
  const medianas = t.rows.flatMap((r, i) => { const x = d.rows[i]?.mediana ?? null; return x === null ? [] : [[nome(r, i), base(x, `modelo.derivado.themes.rows[${i}].mediana`)]] })
  if (medianas.length) saida.push(tabelaLista('temas-mediana', 'Mediana do multiplicador de cada tema', 'tabela de medianas dos temas', ['Tema', 'Mediana'], medianas))
  const tendencias = t.rows.flatMap((r, i) => {
    const x = d.rows[i]?.tendencia ?? null
    return x === null || r.spark === null ? [] : [[nome(r, i), base(x, `modelo.derivado.themes.rows[${i}].tendencia`), base(r.spark.text, `${o}.rows[${i}].spark.text`)]]
  })
  if (tendencias.length) saida.push(tabelaLista('temas-tendencia', 'Tendência de cada tema contra os 90 dias anteriores', 'tabela de tendência dos temas', ['Tema', 'Tendência', 'Vídeos nos 90 anteriores → agora'], tendencias))
  return saida
}

const METRICAS = ['pw', 'perMilSubs', 'pctOutliers', 'engagement'] as const

function tabelasDeVoceNoNicho(m: ModeloInsights): Tabela[] {
  const y: YouSection | null = m.youInNiche
  const d = m.derivado.youInNiche
  if (!y || !d) return []
  const o = 'modelo.youInNiche', od = 'modelo.derivado.youInNiche'
  const saida: Tabela[] = []
  const chaves = y.cols.map((c) => c.key)
  const rotuloDe = (k: YouColKey): string => y.cols.find((c) => c.key === k)?.label ?? k
  const comCelulas = y.rows.flatMap((r, i) => (r.cells === null ? [] : [i]))
  if (comCelulas.length) {
    saida.push(tabelaFixa('voce-no-nicho', `Você no nicho · ${y.meta}`, 'tabela de você no nicho',
      ['Canal', 'Base', ...chaves.flatMap((k) => [rotuloDe(k), `${rotuloDe(k)}: leitura`])],
      comCelulas.map((i) => {
        const r = y.rows[i]!
        return [
          terceiros(r.name, `${o}.rows[${i}].name`), base(r.sub, `${o}.rows[${i}].sub`),
          ...chaves.flatMap((k): Celula[] => {
            const c = d.rows[i]?.c[k]
            const p = `${od}.rows[${i}].c.${k}`
            if (!c) return [celulaDoNumero(null, `${p}.value`), base(A_TELA_NAO_INFORMA_O_MOTIVO, `${p}.text`)]
            return c.kind === 'value'
              ? [celulaDoNumero(c.value, `${p}.value`), base(c.verdict, `${p}.verdict`)]
              : [{ papel: 'numero', estado: 'nao_medido', motivo: c.base, origem: `${p}.base` }, base(c.text, `${p}.text`)]
          }),
        ]
      })))
    for (const k of chaves) {
      const notas = comCelulas.flatMap((i) => {
        const c = d.rows[i]?.c[k]
        return c && c.kind === 'value' && c.few !== null ? [[terceiros(y.rows[i]!.name, `${o}.rows[${i}].name`), base(c.few, `${od}.rows[${i}].c.${k}.few`)]] : []
      })
      if (notas.length) saida.push(tabelaFixa(`voce-no-nicho-nota-${k}`, `Nota de ${rotuloDe(k)}`, `tabela de notas de ${rotuloDe(k)}`, ['Canal', `Nota de ${rotuloDe(k)}`], notas))
    }
  }
  const semVideo = y.rows.flatMap((r, i) => (r.emptyText === null ? [] : [[terceiros(r.name, `${o}.rows[${i}].name`), base(r.emptyText, `${o}.rows[${i}].emptyText`)]]))
  if (semVideo.length) saida.push(tabelaFixa('voce-no-nicho-sem-video', 'Canais seus sem vídeo neste formato', 'tabela de canais seus sem vídeo', ['Canal', 'Motivo'], semVideo))
  if (d.ref) {
    const ref = d.ref
    saida.push(tabelaFixa('voce-no-nicho-referencia', 'Você no nicho: a referência dos concorrentes', 'tabela da referência do nicho',
      ['Referência', ...chaves.flatMap((k) => [rotuloDe(k), `${rotuloDe(k)}: faixa`])],
      [[rotulo(ref.sub, `${od}.ref.sub`), ...chaves.flatMap((k): Celula[] => {
        const c = ref.c[k]
        const p = `${od}.ref.c.${k}`
        return c ? [celulaDoNumero(c.value, `${p}.value`), base(c.range, `${p}.range`)] : [celulaDoNumero(null, `${p}.value`), base(A_TELA_NAO_INFORMA_O_MOTIVO, `${p}.range`)]
      })]]))
  }
  return saida
}

function tabelasDeLacunas(m: ModeloInsights): Tabela[] {
  const g: GapsSection | null = m.gaps
  const d = m.derivado.gaps
  if (!g || !d || g.rows.length === 0) return []
  const o = 'modelo.gaps'
  const nome = (r: GapsSection['rows'][number], i: number): Celula => terceiros(r.label, `${o}.rows[${i}].label`)
  const saida: Tabela[] = [tabelaLista('lacunas', `Lacunas · ${g.meta}`, 'tabela de lacunas', ['Tema', 'Canais e vídeos', 'Falta'],
    g.rows.map((r, i) => [nome(r, i), base(d.rows[i]?.subTexto ?? '', `modelo.derivado.gaps.rows[${i}].subTexto`), base(r.lack, `${o}.rows[${i}].lack`)]))]
  const quemTem = g.rows.flatMap((r, i) => (r.have === null ? [] : [[nome(r, i), base(r.have, `${o}.rows[${i}].have`)]]))
  if (quemTem.length) saida.push(tabelaLista('lacunas-quem-tem', 'Lacunas: quem já tem vídeo do tema', 'tabela de quem já tem o tema', ['Tema', 'Já tem'], quemTem))
  return saida
}

function tabelasDaLeitura(m: ModeloInsights): Tabela[] {
  const v = m.hero?.view
  if (!v) return []
  const o = 'modelo.hero.view'
  const saida: Tabela[] = []
  if (v.ev.length) {
    saida.push(tabelaLista('evidencias', 'Evidências da leitura da forja', 'tabela de evidências', ['Nº', 'Evidência', 'Ver hoje'],
      v.ev.map((e, i) => [rotulo(String(e.n), `${o}.ev[${i}].n`), base(e.text, `${o}.ev[${i}].text`), base(e.label, `${o}.ev[${i}].label`)])))
  }
  if (v.since.length) {
    saida.push(tabelaFixa('desde-entao', 'O que mudou desde a leitura da forja', 'tabela do que mudou desde a leitura', ['Leitura', 'Desde então', 'Detalhe'],
      v.since.map((s, i) => [
        rotulo(s.label, `${o}.since[${i}].label`),
        s.shortText === null ? { papel: 'numero', estado: 'nao_medido', motivo: A_TELA_NAO_INFORMA_O_MOTIVO, origem: `${o}.since[${i}].shortText` } : base(s.shortText, `${o}.since[${i}].shortText`),
        s.text === null ? { papel: 'numero', estado: 'nao_medido', motivo: A_TELA_NAO_INFORMA_O_MOTIVO, origem: `${o}.since[${i}].text` } : base(s.text, `${o}.since[${i}].text`),
      ])))
  }
  return saida
}

/** As frases de leitura que o site escreve sobre uma tabela, ligadas ao cartão por um rótulo que é folha do modelo. */
function tabelaDeLeituras(m: ModeloInsights): Tabela[] {
  const linhas: Celula[][] = []
  const h = m.heatmap, d = m.derivado.heatmap
  if (h && d && h.empty === null) {
    linhas.push([rotulo(h.uploads.caption, 'modelo.heatmap.uploads.caption'), base(d.uploadsNota, 'modelo.derivado.heatmap.uploadsNota')])
    linhas.push([rotulo(h.mult.caption, 'modelo.heatmap.mult.caption'), base(d.multNota, 'modelo.derivado.heatmap.multNota')])
  }
  if (m.formulas?.zero) linhas.push([rotulo(m.formulas.meta, 'modelo.formulas.meta'), base(m.formulas.zero.text, 'modelo.formulas.zero.text')])
  return linhas.length ? [tabelaFixa('leituras-do-site', 'Frases de leitura que o site escreve', 'frases de leitura do site', ['Onde', 'Leitura'], linhas)] : []
}

// ───────────────────────── os blocos citados (a leitura da forja)
const textoDoBloco = (b: HeroBlock): string => b.parts.map((p) => (p.kind === 'p'
  ? `${p.text}${p.ev === null ? '' : ` [evidência ${p.ev}]`}`
  : p.items.map((it) => `- ${it.text}${it.ev === null ? '' : ` [evidência ${it.ev}]`}`).join('\n'))).join('\n')

function citadosDaLeitura(m: ModeloInsights): BlocoCitado[] {
  const v = m.hero?.view
  if (!v) return []
  return [...v.shown.map((b, i) => ({ b, origem: `modelo.hero.view.shown[${i}]` })), ...v.more.map((b, i) => ({ b, origem: `modelo.hero.view.more[${i}]` }))]
    .map(({ b, origem }) => ({ rotulo: b.seal, texto: textoDoBloco(b), origem }))
}

// ───────────────────────── avisos e definições (frases do próprio modelo)
const presentes = (xs: ReadonlyArray<string | null | undefined>): string[] => xs.filter((x): x is string => typeof x === 'string' && x !== '')

function avisosDe(m: ModeloInsights): string[] {
  const out: string[] = []
  if (m.all) out.push(...presentes([m.all.forja.title, ...m.all.forja.lines, m.all.forja.text, m.all.forja.note]))
  const hero = m.hero
  if (hero) {
    out.push(...presentes([hero.statusChip?.text, hero.askLine, hero.scopeNote, hero.publishedNote, hero.prevLabel]), ...(m.derivado.hero.box ?? []), ...(hero.view?.notes ?? []), hero.caveat)
  }
  out.push(...presentes([m.formulas?.metaRight]))
  out.push(...presentes([m.formulas?.empty?.title, m.formulas?.empty?.text]))
  out.push(...presentes([m.cadence?.empty, m.heatmap?.empty, m.heatmap?.excluded]))
  if (m.themes) out.push(...presentes([m.themes.noThemes, m.themes.coverageNote, m.themes.empty?.title, m.themes.empty?.text]))
  if (m.youInNiche) {
    const y = m.youInNiche
    out.push(...presentes([y.empty?.title, y.empty?.text, y.noRef?.text, y.noneNote?.text]))
    const dicas = new Set<string>()
    m.derivado.youInNiche?.rows.forEach((r) => Object.values(r.c).forEach((c) => { if (c?.kind === 'nodata') dicas.add(c.baseTitle) }))
    out.push(...dicas)
  }
  if (m.gaps) out.push(...presentes([m.gaps.noThemes, m.gaps.noRef?.text, m.gaps.empty?.title, m.gaps.empty?.text, m.gaps.none, ...m.gaps.notes.map((n) => n.text)]))
  if (m.heatmap) out.push(AVISO_HORARIOS)
  return out
}

function definicoesDe(m: ModeloInsights): PacoteModelo['definicoes'] {
  const out: PacoteModelo['definicoes'] = []
  const limiares = [...new Set(presentes((m.formulas?.rows ?? []).map((r) => r.chip.title)))]
  if (m.derivado.formulas?.foot) out.push({ medida: 'Multiplicador e base', frase: m.derivado.formulas.foot, limiares })
  if (m.cadence && !m.cadence.noComp) out.push({ medida: 'Hábito (costuma publicar)', frase: m.cadence.foot, limiares: [] })
  if (m.heatmap && m.heatmap.empty === null) {
    out.push({ medida: 'Mapa de uploads', frase: m.heatmap.uploads.intro, limiares: [] })
    out.push({ medida: 'Mapa do multiplicador mediano', frase: m.heatmap.mult.intro, limiares: [] })
  }
  if (m.themes?.foot) out.push({ medida: 'Temas em alta', frase: m.themes.foot, limiares: [] })
  if (m.youInNiche) {
    const y = m.youInNiche
    for (const c of y.cols) out.push({ medida: c.label, frase: c.unit, limiares: [] })
    if (y.foot) out.push({ medida: 'Você no nicho', frase: y.foot, limiares: [] })
  }
  if (m.gaps?.foot) out.push({ medida: 'Lacunas', frase: m.gaps.foot, limiares: [] })
  return out
}

// ───────────────────────── o empacotador
export function empacotarInsights(modelo: ModeloInsights): PacoteModelo {
  const formato = modelo.fmtOptions.find((o) => o.pressed)?.label ?? modelo.fmt
  const todos = modelo.all !== null
  const janela = todos ? `${modelo.derivado.nichoRotulo} · ${formato}` : `${modelo.derivado.nichoRotulo} · ${formato} · ${modelo.window.label} (${modelo.window.dates})`
  const tabelas: Tabela[] = [
    ...tabelasDeFormulas(modelo), ...tabelaDeLeituras(modelo), ...tabelasDeCadencia(modelo), ...tabelasDoMapa(modelo), ...tabelasDeTemas(modelo),
    ...tabelasDeVoceNoNicho(modelo), ...tabelasDeLacunas(modelo), ...tabelasDaLeitura(modelo),
  ]
  return {
    tela: 'insights',
    janela,
    foco: (modelo.youInNiche?.rows ?? []).map((r) => ({ nome: r.name, oQueE: 'seu canal' as const, detalhe: r.sub })),
    tabelas,
    citados: citadosDaLeitura(modelo),
    definicoes: definicoesDe(modelo),
    avisos: avisosDe(modelo),
    naoMede: [NAO_MEDE_CAUSA, NAO_MEDE_HORA, NAO_MEDE_RETENCAO],
    privado: { estado: 'na' },
    comentarios: { estado: 'na' },
    vazio: modelo.all ? `${modelo.all.title}. ${modelo.all.text}` : null,
    motivoDoMagro: null,
    listasCompletas: false,
  }
}

export { METRICAS as METRICAS_DE_INSIGHTS }
