/**
 * A5 · E17 degrau 1, Tarefa 6g: o empacotador de Mudanças. Puro: nada de banco, de relógio nem de conta; cada número é copiado do campo do
 * modelo, com o texto que o modelo já formatou, e cada célula leva a `origem` (o caminho do campo no modelo) para a prova de paridade.
 *
 * O MODELO daqui (`ModeloMudancas`) é o `MudancasView` da tela MAIS um objeto `derivado`, que só junta ou reescreve como a tela escreve:
 *  - texto rico (`Rich`: número em negrito, rótulo em negrito) vira a cadeia que a tela pinta, que é a concatenação das partes;
 *  - `effect.noBase` e `effect.fallback` ganham a primeira letra maiúscula, como o painel de efeito os escreve;
 *  - a mediana ausente do quadro de efeito leva a frase do próprio quadro (`text`) como motivo.
 * A tela pagina no navegador ("Carregar mais"): o pacote leva a LISTA INTEIRA de `view.heroes` e `listasCompletas` é verdadeiro. O texto da
 * descrição (antes e depois) é bloco citado ligado à linha da troca na tabela de trocas: sai com a linha no corte.
 * Nenhum texto daqui afirma causa: o painel já escreve "Não prova causa" e o pacote repete isso nos avisos.
 */
import type { Hero, MudancasView, Rich } from '../_mudancas/view-model'
import type { ForjaView } from '../_chrome/forja-view-model'
import { A_TELA_NAO_INFORMA_O_MOTIVO } from '@/lib/youtube/observatorio/contexto-ia/frases'
import type { Inventario } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { BlocoCitado, Celula, PacoteModelo, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'

// ───────────────────────── o modelo
export interface DerivadoMudancas {
  nichoRotulo: string
  rico: { digest: string; weekLead: string; out: string; totalLine: string }
  heroes: Array<{ effect: { noBase: string | null; fallback: string | null }; thumbMissing: Array<string | null> }>
  ledger: { medians: Array<{ semMediana: string | null }> }
}
export type ModeloMudancas = MudancasView & { derivado: DerivadoMudancas }

/** O que a tela pinta de um texto rico: as partes, coladas. */
export const textoDoRico = (r: Rich): string => r.map((p) => (typeof p === 'string' ? p : 'num' in p ? p.num : p.b)).join('')
const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/** Tudo o que o modelo da tela tem, mais o derivado. `nichoRotulo` é o nome do nicho como a tela o escreve ("Viagem"; "Todos" sem nicho). */
export function modeloDeMudancas(view: MudancasView, nichoRotulo: string): ModeloMudancas {
  return {
    ...view,
    derivado: {
      nichoRotulo,
      rico: { digest: textoDoRico(view.summary.digest), weekLead: textoDoRico(view.summary.weekLead), out: textoDoRico(view.ledger.out), totalLine: textoDoRico(view.ledger.totalLine) },
      heroes: view.heroes.map((h) => ({ effect: { noBase: h.effect.noBase ? cap(h.effect.noBase) : null, fallback: h.effect.fallback ? cap(h.effect.fallback) : null }, thumbMissing: (h.thumbs ?? []).map((t) => (t.src === null ? cap(t.missing ?? '') : null)) })),
      ledger: { medians: view.ledger.medians.map((m) => ({ semMediana: m.median === null ? m.text : null })) },
    },
  }
}

// ───────────────────────── o inventário de folhas (item 160)
const CTRL = { descartado: 'controle de tela' } as const
const ID = { descartado: 'identificador' } as const
const END = { descartado: 'endereço' } as const
const APAR = { descartado: 'aparência' } as const
const REP = { descartado: 'repetido' } as const
const IMG = { descartado: 'imagem' } as const

const LEITURA = (raiz: string): Inventario => ({
  [`${raiz}.id`]: ID, [`${raiz}.niche`]: ID, [`${raiz}.nicheLabel`]: REP, [`${raiz}.seal`]: 'rotulo',
  [`${raiz}.title`]: REP, [`${raiz}.lead`]: 'terceiros', [`${raiz}.items[]`]: 'terceiros', [`${raiz}.theme`]: REP,
  [`${raiz}.keyItems[]`]: REP, [`${raiz}.moreItems[]`]: REP, [`${raiz}.inlineEvidence`]: CTRL, [`${raiz}.countText`]: 'base', [`${raiz}.sinceLabel`]: REP,
  [`${raiz}.sentText`]: 'base', [`${raiz}.since.shortText`]: REP, [`${raiz}.since.text`]: 'base',
  [`${raiz}.evidenceLinks[].label`]: 'rotulo', [`${raiz}.evidenceLinks[].href`]: END, [`${raiz}.evidenceLinks[].n`]: REP, [`${raiz}.evidenceLinks[].text`]: 'base',
  [`${raiz}.when`]: 'base', [`${raiz}.isNew`]: CTRL, [`${raiz}.whenAgo`]: REP, [`${raiz}.siteNotes[]`]: 'base',
})

export const INVENTARIO_MUDANCAS: Inventario = {
  // o que a pessoa escolheu (o pacote o escreve na janela e nos avisos)
  'filters.win': REP, 'filters.type': REP, 'filters.fmt': REP, 'filters.q': REP, 'filters.channel': ID, 'filters.changes[]': ID, 'filters.changes': CTRL,
  'filters.reading': CTRL, 'filters.video': CTRL, 'filters.niche': REP, 'filters.sort': REP, 'filters.measured': CTRL, 'filters.saved': CTRL,
  'derivado.nichoRotulo': 'rotulo',
  groupByVideo: CTRL,

  // cada troca
  'heroes[].id': ID, 'heroes[].type': ID, 'heroes[].typeLabel': 'rotulo',
  'heroes[].video.id': ID, 'heroes[].video.title': 'terceiros', 'heroes[].video.channel': 'terceiros', 'heroes[].video.ago': REP,
  'heroes[].video.historyHref': END, 'heroes[].video.url': END, 'heroes[].video.channelHref': END,
  'heroes[].video.color': APAR, 'heroes[].video.ini': APAR, 'heroes[].video.avatar': IMG, 'heroes[].video.ink': APAR,
  'heroes[].video.niche': ID, 'heroes[].video.nicheLabel': 'rotulo', 'heroes[].video.meta[]': 'base', 'heroes[].video.syncNote': 'base',
  'heroes[].video.own': CTRL, 'heroes[].video.pin*': CTRL, 'heroes[].video.observed': CTRL, 'heroes[].video.outNote': 'base',
  'heroes[].when.text': 'base', 'heroes[].when.prec': REP, 'heroes[].when.rel': 'base', 'heroes[].when.seq': 'base', 'heroes[].when.run': 'base',
  'heroes[].runNote': 'base', 'heroes[].revTag': CTRL, 'heroes[].badges[].kind': CTRL, 'heroes[].badges[].text': 'base',

  // o título, palavra por palavra (o pacote leva o de antes e o de depois inteiros)
  'heroes[].title.before[]*': REP, 'heroes[].title.after[]*': REP, 'heroes[].title.full': CTRL, 'heroes[].title.keptWords': REP, 'heroes[].title.caseChanges[]': REP,
  'heroes[].title.hasCaseChange': CTRL, 'heroes[].title.labels*': REP, 'heroes[].title.removed[]': REP, 'heroes[].title.added[]': REP,
  'heroes[].title.beforeText': 'terceiros', 'heroes[].title.afterText': 'terceiros',
  'heroes[].title.legend[].cls': APAR, 'heroes[].title.legend[].mark': REP, 'heroes[].title.legend[].label': REP, 'heroes[].title.stats[]': 'base',
  'heroes[].title.rewrite': CTRL, 'heroes[].title.rewrite.text': 'base', 'heroes[].title.rewrite.title': REP,

  // a thumbnail
  'heroes[].thumbs[].key': ID, 'heroes[].thumbs[].label': 'rotulo', 'heroes[].thumbs[].role': REP, 'heroes[].thumbs[].src': IMG, 'heroes[].thumbs[].period': 'base',
  'heroes[].thumbs[].archived': CTRL, 'heroes[].thumbs[].preSeries': CTRL, 'heroes[].thumbs[].missing': REP, 'derivado.heroes[].thumbMissing[]': 'base', 'heroes[].thumbs[].back': CTRL,

  // a descrição
  'heroes[].desc.label': REP, 'heroes[].desc.add': 'numero', 'heroes[].desc.rem': 'numero', 'heroes[].desc.lines[].op': CTRL, 'heroes[].desc.lines[].text': 'terceiros',
  'heroes[].desc.noiseHidden': 'numero', 'heroes[].desc.noText': 'base', 'heroes[].desc.peek[].op': CTRL, 'heroes[].desc.peek[].text': REP, 'heroes[].desc.peekMore': REP,
  'heroes[].desc.open': CTRL,

  // o efeito medido
  'heroes[].effect.status': CTRL, 'heroes[].effect.demoted': CTRL, 'heroes[].effect.noBase': REP, 'heroes[].effect.method': REP, 'heroes[].effect.fallback': REP,
  'heroes[].effect.notCause': 'base', 'heroes[].effect.collected': CTRL, 'heroes[].effect.afterNeeded': CTRL, 'heroes[].effect.icon': APAR,
  'heroes[].effect.label': 'base', 'heroes[].effect.numbers': REP, 'heroes[].effect.pp': 'numero', 'heroes[].effect.detail': 'base', 'heroes[].effect.wait': 'base',
  'heroes[].effect.caveats[]': 'base', 'heroes[].effect.footTitle': REP,
  'heroes[].effect.spark': CTRL, 'heroes[].effect.spark.before[]': REP, 'heroes[].effect.spark.after[]': REP, 'heroes[].effect.spark.expected*': REP,
  'heroes[].effect.spark.min': REP, 'heroes[].effect.spark.max': REP, 'heroes[].effect.spark.maxLabel': REP, 'heroes[].effect.spark.minLabel': REP,
  'heroes[].effect.spark.aria': REP, 'heroes[].effect.spark.head': 'base',
  'heroes[].effect.rows': CTRL, 'heroes[].effect.rows.observed': 'numero', 'heroes[].effect.rows.observedFrom': 'numero', 'heroes[].effect.rows.observedTo': 'numero',
  'heroes[].effect.rows.expected': 'numero', 'heroes[].effect.rows.iqr': CTRL, 'heroes[].effect.rows.iqr[]': 'numero', 'heroes[].effect.rows.n': 'numero',
  'heroes[].effect.rows.band': 'base', 'heroes[].effect.rows.methodShort': 'base',
  'heroes[].swipe.saved': CTRL, 'heroes[].swipe.label': CTRL, 'heroes[].swipe.key': ID,
  'derivado.heroes[].effect.noBase': 'base', 'derivado.heroes[].effect.fallback': 'base',

  // o quadro de efeito ajustado e o resumo
  'ledger.medians[].type': ID, 'ledger.medians[].typeLabel': 'rotulo', 'ledger.medians[].median': 'numero', 'ledger.medians[].n': 'numero', 'ledger.medians[].range': REP,
  'ledger.medians[].few': CTRL, 'ledger.medians[].text': 'base', 'derivado.ledger.medians[].semMediana': 'motivo',
  'ledger.groups*': REP, 'ledger.total': REP, 'ledger.totalCheck': CTRL, 'ledger.minN': REP, 'ledger.winLabel': 'rotulo', 'ledger.out[]*': REP, 'ledger.totalLine[]*': REP,
  'ledger.note': 'base', 'ledger.emptyText': 'base',
  'derivado.rico.digest': 'base', 'derivado.rico.weekLead': 'base', 'derivado.rico.out': 'base', 'derivado.rico.totalLine': 'base',
  'summary.weekWin': 'base', 'summary.weekLead[]*': REP, 'summary.digest[]*': REP, 'summary.method': 'base',
  'controls.typeCounts.all': 'numero', 'controls.typeCounts.title': 'numero', 'controls.typeCounts.thumb': 'numero', 'controls.typeCounts.desc': 'numero',
  'controls.channels[].label': REP, 'controls.channels[].options[].id': ID, 'controls.channels[].options[].name': REP, 'controls.channels[].options[].count': REP,
  'controls.moreCount': CTRL, 'controls.windowLocked': CTRL,
  'controls.chips[].key': ID, 'controls.chips[].text': 'base', 'controls.chips[].patch*': CTRL, 'controls.chips[].label': REP,
  'paging.cuts[]': CTRL, 'paging.countLines[][]*': REP, 'paging.restTexts[]': REP,
  empty: CTRL, 'empty.title': 'base', 'empty.text': 'base', 'empty.hiddenBy': REP, 'empty.actions[].label': 'rotulo', 'empty.actions[].patch*': CTRL,
  nicheNote: 'base',

  // a forja: o botão e o estado do cabeçalho são chrome; o cartão do resumo é desta tela
  'forja.*': CTRL,
  'forja.typeLabel': 'rotulo',
  'forja.status': CTRL,
  'forja.card.stateLabel': 'base', 'forja.card.stateKind': APAR, 'forja.card.statusText': 'base', 'forja.card.lines[]': 'base', 'forja.card.sentNow': 'base',
  'forja.card.askNote': 'base', 'forja.card.previewText': REP,
  'forja.niches[].niche': ID, 'forja.niches[].label': 'rotulo', 'forja.niches[].active': CTRL, 'forja.niches[].statusLine': 'base', 'forja.niches[].requestState': CTRL,
  'forja.niches[].emptyText': 'base', 'forja.niches[].out[]': REP,
  ...LEITURA('forja.niches[].reading'),
  'forja.reading': CTRL, 'forja.reading.*': REP,
  'forjaCard.openNiche': CTRL, 'forjaCard.outSummary': 'base', 'forjaCard.outText': 'base', 'forjaCard.shorts': CTRL, 'forjaCard.shorts.text': 'base', 'forjaCard.shorts.href': END,
  'forjaCard.confirm': CTRL, 'forjaCard.confirm.*': CTRL,
}

/** As entradas do inventário que descrevem a forja, para outro modelo que a leve sob `prefixo` (a tela do canal). */
export const inventarioDaForja = (prefixo: string): Inventario =>
  Object.fromEntries(Object.entries(INVENTARIO_MUDANCAS).filter(([k]) => k.startsWith('forja')).map(([k, v]) => [prefixo + k, v]))

/** Chaves do inventário cuja folha não aparece em nenhum estado da matriz do teste (cada uma tem teste sintético próprio quando importa). */
export const SEM_FOLHA_NA_MATRIZ_MUDANCAS: readonly string[] = ['forja.card.lines[]', 'forja.niches[].reading.moreItems[]', 'forja.niches[].reading.siteNotes[]', 'forjaCard.confirm']

/** Folhas de número cru: nenhuma. Todo número desta tela já vem formatado pelo modelo (`obs.fmt`). */
export const SEM_PROVA_POR_IGUALDADE_DIRETA_MUDANCAS = [] as const

// ───────────────────────── textos do pacote que esta tela escreve
// Revisto pelo Logan (17/10): as frases de "o que esta tela não mede" e os títulos das tabelas abaixo.
const NAO_MEDE_CAUSA = 'se a troca explica a mudança nas views: o efeito compara o vídeo com os outros do canal sem troca, e mostra o que veio junto, não a origem'
const NAO_MEDE_NAO_ACOMPANHADOS = 'o efeito dos vídeos que o site não acompanha: sem a série diária do vídeo, a tela mostra a troca e diz por que não mede'
const NAO_MEDE_RETENCAO = 'retenção, taxa de clique e recomendação por vídeo dos concorrentes: o YouTube só entrega esses dados ao dono do canal'
const SEM_CAUSA = 'Não prova causa.'

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

const tabelaFixa = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][]): Tabela => ({ id, titulo, tipo: 'fixa', nomeNoCorte, privada: false, colunas, linhas })
const tabelaLista = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][]): Tabela => ({ id, titulo, tipo: 'lista', nomeNoCorte, privada: false, colunas, linhas })

// ───────────────────────── tabelas
const trocas = (m: ModeloMudancas): Array<{ i: number; h: Hero }> => m.heroes.map((h, i) => ({ i, h }))
const doEfeito = (h: Hero): boolean => h.video.observed

function tabelaDeTrocas(m: ModeloMudancas): Tabela[] {
  if (m.heroes.length === 0) return []
  return [tabelaLista('trocas', 'As trocas da tela, na ordem da tela', 'tabela de trocas', ['Vídeo', 'Canal', 'Nicho', 'Tipo', 'Quando', 'Visto'],
    trocas(m).map(({ i, h }) => {
      const p = `modelo.heroes[${i}]`
      return [
        terceiros(h.video.title, `${p}.video.title`), terceiros(h.video.channel, `${p}.video.channel`),
        h.video.nicheLabel === null ? celulaDoNumero(null, `${p}.video.nicheLabel`) : rotulo(h.video.nicheLabel, `${p}.video.nicheLabel`),
        rotulo(h.typeLabel, `${p}.typeLabel`), base(h.when.text, `${p}.when.text`), base(h.when.rel, `${p}.when.rel`),
      ]
    }))]
}

function tabelasDeEfeito(m: ModeloMudancas): Tabela[] {
  const saida: Tabela[] = []
  const real = (x: string | number | null): boolean => x !== null && x !== '—'
  const medidas = trocas(m).filter(({ h }) => doEfeito(h) && h.effect.rows !== null && [h.effect.rows.observed, h.effect.rows.observedFrom, h.effect.rows.observedTo].every(real))
  if (medidas.length) {
    saida.push(tabelaLista('trocas-efeito', 'O efeito medido de cada troca (views/dia antes e depois)', 'tabela de efeitos', ['Vídeo', 'Tipo', 'Veredito', 'Observado', 'Antes (views/dia)', 'Depois (views/dia)'],
      medidas.map(({ i, h }) => {
        const p = `modelo.heroes[${i}]`, r = h.effect.rows!
        return [
          terceiros(h.video.title, `${p}.video.title`), rotulo(h.typeLabel, `${p}.typeLabel`), base(h.effect.label, `${p}.effect.label`),
          celulaDoNumero(r.observed, `${p}.effect.rows.observed`), celulaDoNumero(r.observedFrom, `${p}.effect.rows.observedFrom`), celulaDoNumero(r.observedTo, `${p}.effect.rows.observedTo`),
        ]
      })))
    const comEsperado = medidas.filter(({ h }) => real(h.effect.rows!.expected) && real(h.effect.pp))
    if (comEsperado.length) {
      saida.push(tabelaLista('trocas-esperado', 'O esperado sem a troca e o efeito ajustado', 'tabela do esperado e do efeito', ['Vídeo', 'Esperado sem a troca', 'Efeito'],
        comEsperado.map(({ i, h }) => {
          const p = `modelo.heroes[${i}]`
          return [terceiros(h.video.title, `${p}.video.title`), celulaDoNumero(h.effect.rows!.expected, `${p}.effect.rows.expected`), celulaDoNumero(h.effect.pp, `${p}.effect.pp`)]
        })))
    }
    const comFaixa = medidas.filter(({ h }) => h.effect.rows!.iqr !== null)
    if (comFaixa.length) {
      saida.push(tabelaLista('trocas-faixa', 'A faixa esperada sem a troca (menor limite, depois o maior)', 'tabela de faixas esperadas', ['Vídeo', 'Limite da faixa'],
        comFaixa.flatMap(({ i, h }) => {
          const p = `modelo.heroes[${i}]`
          return [0, 1].map((k) => [terceiros(h.video.title, `${p}.video.title`), celulaDoNumero(h.effect.rows!.iqr![k]!, `${p}.effect.rows.iqr[${k}]`)])
        })))
    }
    const comBase = medidas.filter(({ i }) => m.derivado.heroes[i]?.effect.noBase == null)
    if (comBase.length) {
      saida.push(tabelaLista('trocas-base', 'A base do esperado de cada troca', 'tabela de bases do esperado', ['Vídeo', 'Vídeos na base (n)', 'Faixa de idade', 'Método'],
        comBase.map(({ i, h }) => {
          const p = `modelo.heroes[${i}]`, r = h.effect.rows!
          return [terceiros(h.video.title, `${p}.video.title`), celulaDoNumero(r.n, `${p}.effect.rows.n`), base(r.band, `${p}.effect.rows.band`), base(r.methodShort, `${p}.effect.rows.methodShort`)]
        })))
    }
  }
  return saida
}

function tabelaDeTitulos(m: ModeloMudancas): Tabela[] {
  const linhas = trocas(m).flatMap(({ i, h }) => (h.title ? [[terceiros(h.video.title, `modelo.heroes[${i}].video.title`), terceiros(h.title.beforeText, `modelo.heroes[${i}].title.beforeText`), terceiros(h.title.afterText, `modelo.heroes[${i}].title.afterText`)]] : []))
  return linhas.length ? [tabelaLista('trocas-titulos', 'Os títulos de antes e de depois', 'tabela de títulos trocados', ['Vídeo', 'Título de antes', 'Título de depois'], linhas)] : []
}

function tabelaDeThumbs(m: ModeloMudancas): Tabela[] {
  const linhas = trocas(m).flatMap(({ i, h }): Celula[][] => {
    const p = `modelo.heroes[${i}]`
    return (h.thumbs ?? []).map((t, k) => [terceiros(h.video.title, `${p}.video.title`), rotulo(t.label, `${p}.thumbs[${k}].label`), base(t.period, `${p}.thumbs[${k}].period`)])
  })
  return linhas.length ? [tabelaLista('trocas-thumbs', 'As imagens de cada troca (a de antes primeiro)', 'tabela de thumbnails trocadas', ['Vídeo', 'Imagem', 'Período'], linhas)] : []
}

function tabelaDeDescricoes(m: ModeloMudancas): Tabela[] {
  const linhas = trocas(m).flatMap(({ i, h }): Celula[][] => {
    if (!h.desc || h.desc.noText !== null) return []
    const p = `modelo.heroes[${i}]`
    return [[terceiros(h.video.title, `${p}.video.title`), celulaDoNumero(h.desc.add, `${p}.desc.add`), celulaDoNumero(h.desc.rem, `${p}.desc.rem`), celulaDoNumero(h.desc.noiseHidden, `${p}.desc.noiseHidden`)]]
  })
  return linhas.length ? [tabelaLista('trocas-descricoes', 'As descrições trocadas: linhas novas e removidas', 'tabela de descrições trocadas', ['Vídeo', 'Linhas novas', 'Linhas removidas', 'Trocas de UTM ocultas'], linhas)] : []
}

function tabelaDeNotas(m: ModeloMudancas): Tabela[] {
  const linhas: Celula[][] = []
  for (const { i, h } of trocas(m)) {
    const p = `modelo.heroes[${i}]`
    const nome = (): Celula => terceiros(h.video.title, `${p}.video.title`)
    const nota = (texto: string | null | undefined, origem: string): void => { if (texto) linhas.push([nome(), base(texto, origem)]) }
    h.video.meta.forEach((x, k) => nota(x, `${p}.video.meta[${k}]`))
    nota(h.video.syncNote, `${p}.video.syncNote`)
    nota(h.video.outNote, `${p}.video.outNote`)
    nota(h.when.seq, `${p}.when.seq`)
    nota(h.when.run, `${p}.when.run`)
    nota(h.runNote, `${p}.runNote`)
    h.badges.filter((b) => doEfeito(h) || b.kind !== 'note').forEach((b, k) => nota(b.text, `${p}.badges[${k}].text`))
    h.title?.stats.forEach((x, k) => nota(x, `${p}.title.stats[${k}]`))
    nota(h.title?.rewrite?.text, `${p}.title.rewrite.text`)
    h.thumbs?.forEach((t, k) => nota(m.derivado.heroes[i]?.thumbMissing[k], `modelo.derivado.heroes[${i}].thumbMissing[${k}]`))
    nota(h.desc?.noText, `${p}.desc.noText`)
    if (doEfeito(h)) {
      const e = h.effect
      nota(e.spark?.head, `${p}.effect.spark.head`)
      nota(m.derivado.heroes[i]?.effect.fallback, `modelo.derivado.heroes[${i}].effect.fallback`)
      nota(m.derivado.heroes[i]?.effect.noBase, `modelo.derivado.heroes[${i}].effect.noBase`)
      if (e.status === 'aguardando') nota(e.wait, `${p}.effect.wait`)
      else if (e.rows !== null || e.status === 'sem-antes' || e.status === 'sem-serie') nota(e.detail, `${p}.effect.detail`)
      e.caveats.forEach((c, k) => nota(c, `${p}.effect.caveats[${k}]`))
    }
  }
  return linhas.length ? [tabelaLista('trocas-notas', 'Notas de cada troca', 'tabela de notas das trocas', ['Vídeo', 'Nota'], linhas)] : []
}

function tabelaDoQuadro(m: ModeloMudancas): Tabela[] {
  const L = m.ledger
  if (L.medians.length === 0) return []
  return [tabelaFixa('quadro-de-efeito', `Efeito ajustado ${L.winLabel}`, 'quadro de efeito ajustado', ['Tipo', 'Trocas na janela', 'Com veredito (n)', 'Mediana do efeito', 'Resultado'],
    L.medians.map((x, i) => {
      const p = `modelo.ledger.medians[${i}]`
      return [
        rotulo(x.typeLabel, `${p}.typeLabel`), celulaDoNumero(m.controls.typeCounts[x.type], `modelo.controls.typeCounts.${x.type}`), celulaDoNumero(x.n, `${p}.n`),
        x.median === null ? { papel: 'numero', estado: 'nao_medido', motivo: m.derivado.ledger.medians[i]?.semMediana ?? A_TELA_NAO_INFORMA_O_MOTIVO, origem: `modelo.derivado.ledger.medians[${i}].semMediana` } : celulaDoNumero(x.median, `${p}.median`),
        base(x.text, `${p}.text`),
      ]
    }))]
}

/** O que o site escreve sobre cada leitura da forja. `raiz` é o caminho da forja no modelo (a tela do canal a usa com outro modelo). */
export function tabelaDaForjaDe(forja: ForjaView, raiz: string): Tabela[] {
  const linhas: Celula[][] = []
  forja.niches.forEach((b, i) => {
    const r = b.reading
    if (!r) return
    const p = `${raiz}.niches[${i}]`
    const nome = (): Celula => rotulo(b.label, `${p}.label`)
    linhas.push([nome(), base(r.when, `${p}.reading.when`)])
    if (r.countText) linhas.push([nome(), base(r.countText, `${p}.reading.countText`)])
    if (!r.inlineEvidence) r.evidenceLinks.forEach((ev, k) => linhas.push([nome(), base(ev.text, `${p}.reading.evidenceLinks[${k}].text`)]))
    linhas.push([nome(), base(r.sentText, `${p}.reading.sentText`)])
    if (r.since) linhas.push([nome(), base(r.since.text, `${p}.reading.since.text`)])
    r.siteNotes.forEach((n, k) => linhas.push([nome(), base(n, `${p}.reading.siteNotes[${k}]`)]))
  })
  return linhas.length ? [tabelaLista('forja-do-site', 'O que o site escreve sobre cada leitura da forja', 'tabela do que o site diz da leitura', ['Nicho', 'Do site'], linhas)] : []
}

// ───────────────────────── os blocos citados
const PREFIXO_DA_LINHA: Record<string, string> = { ctx: '  ', add: '+ ', rem: '- ', utm: '~ ' }

/** O texto da descrição, linha a linha, com o sinal da troca na frente (+ nova, - removida, ~ só UTM, dois espaços = sem mudança). */
function citadosDasDescricoes(m: ModeloMudancas): BlocoCitado[] {
  return trocas(m).flatMap(({ i, h }): BlocoCitado[] => {
    if (!h.desc || h.desc.noText !== null || h.desc.lines.length === 0) return []
    return [{
      rotulo: `descrição da troca ${i + 1}`,
      texto: h.desc.lines.map((l) => `${PREFIXO_DA_LINHA[l.op] ?? '  '}${l.text}`).join('\n'),
      origem: `modelo.heroes[${i}].desc.lines`,
      linha: { tabela: 'trocas', posicao: i + 1 },
    }]
  })
}

export function citadosDaForjaDe(forja: ForjaView, raiz: string): BlocoCitado[] {
  return forja.niches.flatMap((b, i): BlocoCitado[] => {
    const r = b.reading
    if (!r) return []
    return [{ rotulo: r.seal, texto: [...(r.lead ? [r.lead] : []), ...r.items.map((t) => `- ${t}`)].join('\n'), origem: `${raiz}.niches[${i}].reading` }]
  })
}

// ───────────────────────── avisos e definições (frases do próprio modelo)
const presentes = (xs: ReadonlyArray<string | null | undefined>): string[] => xs.filter((x): x is string => typeof x === 'string' && x !== '')

function avisosDe(m: ModeloMudancas): string[] {
  const out: string[] = [m.summary.weekWin, m.derivado.rico.digest, m.derivado.rico.weekLead, SEM_CAUSA]
  out.push(...presentes([m.nicheNote, m.ledger.note, m.ledger.emptyText]))
  if (m.ledger.total) out.push(m.derivado.rico.out, m.derivado.rico.totalLine)
  for (const c of m.controls.chips) out.push(c.text)
  const f = m.forja
  out.push(...presentes([f.card.stateLabel, f.card.statusText, f.card.sentNow, f.card.askNote, ...f.card.lines, m.forjaCard.outSummary, m.forjaCard.outText, m.forjaCard.shorts?.text]))
  for (const b of f.niches) out.push(...presentes([b.statusLine, b.reading === null ? b.emptyText : null]))
  return out
}

function definicoesDe(m: ModeloMudancas): PacoteModelo['definicoes'] {
  return m.summary.method ? [{ medida: 'Efeito ajustado', frase: m.summary.method, limiares: [] }] : []
}

// ───────────────────────── o empacotador
export function empacotarMudancas(modelo: ModeloMudancas): PacoteModelo {
  const tabelas: Tabela[] = [
    ...tabelaDoQuadro(modelo), ...tabelaDeTrocas(modelo), ...tabelasDeEfeito(modelo), ...tabelaDeTitulos(modelo), ...tabelaDeThumbs(modelo),
    ...tabelaDeDescricoes(modelo), ...tabelaDeNotas(modelo), ...tabelaDaForjaDe(modelo.forja, 'modelo.forja'),
  ]
  return {
    tela: 'mudancas',
    janela: `${modelo.derivado.nichoRotulo} ${modelo.ledger.winLabel}`,
    foco: [],
    tabelas,
    citados: [...citadosDasDescricoes(modelo), ...citadosDaForjaDe(modelo.forja, 'modelo.forja')],
    definicoes: definicoesDe(modelo),
    avisos: avisosDe(modelo),
    naoMede: [NAO_MEDE_CAUSA, NAO_MEDE_NAO_ACOMPANHADOS, NAO_MEDE_RETENCAO],
    privado: { estado: 'na' },
    comentarios: { estado: 'na' },
    vazio: modelo.empty ? `${modelo.empty.title}. ${modelo.empty.text}` : null,
    motivoDoMagro: null,
    listasCompletas: true,
  }
}
