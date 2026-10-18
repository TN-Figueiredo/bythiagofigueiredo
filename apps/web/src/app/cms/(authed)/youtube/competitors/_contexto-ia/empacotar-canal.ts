/**
 * A5 · E17 degrau 1, Tarefa 6c: o empacotador do canal do concorrente. Puro: nada de banco, de relógio nem de conta; cada número é copiado do campo
 * do modelo, com o texto que o modelo já formatou, e cada célula leva a `origem` (o caminho do campo no modelo) para a prova de paridade.
 *
 * O MODELO daqui (`ModeloCanal`) é o `CanalView` da tela, com `videos.videos` reduzido aos vídeos que a lista mostra, na ordem da tela, para o estado da URL
 * (formato, ordenação, busca e lotes de antigos já carregados), MAIS o objeto `derivado`, que só junta o que a tela decide no navegador:
 *  - `lista`: as contagens, a linha de resultado, o vazio e o "Carregar mais" dessa mesma lista;
 *  - `videos[i].formato`: Short, Longo ou "formato não confirmado", como o selo da tela;
 *  - `cardsDeTrocas`: os cartões da aba Trocas que a tela mostra (o filtro `video` da URL);
 *  - `leitura`: a forja e o cartão da forja do nicho do canal (a aba Leitura), ou nulo.
 * O pacote leva SÓ a aba ativa (as outras abas são outra pergunta); o cabeçalho vai em todas, porque a tela o mostra em todas.
 */
import type { CanalView } from '../_canal/view-model'
import type { ChannelVideoView } from '../_canal/videos-model'
import type { NumCell } from '../_canal/header-model'
import { montarLista, type ListaView } from '../_canal/lista'
import type { MudancasView } from '../_mudancas/view-model'
import { A_TELA_NAO_INFORMA_O_MOTIVO } from '@/lib/youtube/observatorio/contexto-ia/frases'
import type { Inventario } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { BlocoCitado, Celula, PacoteModelo, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { citadosDaForjaDe, inventarioDaForja, tabelaDaForjaDe } from './empacotar-mudancas'
import { INVENTARIO_MEDIDAS_CANAL, tabelasDeMedidas, type MedidasIa } from './empacotar-canal-medidas'

// ───────────────────────── o modelo
export interface DerivadoCanal {
  videos: Array<{ formato: string }>
  lista: Pick<ListaView, 'counts' | 'resultado' | 'vazio' | 'mais'>
  cardsDeTrocas: number[]
  leitura: { forja: MudancasView['forja']; forjaCard: MudancasView['forjaCard'] } | null
  /** Os blocos de medida da tela (topo, células, blocos), já em texto; nulo = as medidas não foram pedidas a este empacotador. */
  medidas: MedidasIa | null
}
export type ModeloCanal = CanalView & { derivado: DerivadoCanal }

/** Tudo o que o modelo da tela tem, mais o derivado. `leituraMv` é o conjunto do site já montado para a aba Leitura (nulo nas outras abas e sem nicho). */
export function modeloDeCanal(view: CanalView, leituraMv: MudancasView | null, medidas: MedidasIa | null = null): ModeloCanal {
  const lista = montarLista(view.videos.videos, view.state)
  const porId = new Map(view.videos.videos.map((v) => [v.id, v]))
  const visiveis = lista.secoes.flatMap((s) => s.itens.map((v) => porId.get(v.id)!))
  const filtro = view.state.video
  const cards = view.trocas.cards.map((c, i) => ({ c, i }))
  const cardsDeTrocas = (filtro && view.trocas.total > 0 ? cards.filter(({ c }) => c.videoId === filtro) : cards).map(({ i }) => i)
  return {
    ...view,
    videos: { ...view.videos, videos: visiveis },
    derivado: {
      videos: visiveis.map((v) => ({ formato: v.isShort === true ? 'Short' : v.isShort === false ? 'Longo' : 'formato não confirmado' })),
      lista: { counts: lista.counts, resultado: lista.resultado, vazio: lista.vazio, mais: lista.mais },
      cardsDeTrocas,
      leitura: view.state.tab === 'leitura' && leituraMv ? { forja: leituraMv.forja, forjaCard: leituraMv.forjaCard } : null,
      medidas,
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

const CELULA = (raiz: string): Inventario => ({
  [`${raiz}[].key`]: ID, [`${raiz}[].value`]: 'numero', [`${raiz}[].missing`]: 'motivo', [`${raiz}[].label`]: 'rotulo', [`${raiz}[].n`]: 'base', [`${raiz}[].base`]: 'base',
})

export const INVENTARIO_CANAL: Inventario = {
  // o canal
  'header.id': ID, 'header.name': 'terceiros', 'header.fullName': REP, 'header.avatar': IMG, 'header.ini': APAR, 'header.color': APAR, 'header.lang': REP,
  'header.niche': ID, 'header.nicheLabel': 'rotulo', 'header.handle': REP, 'header.url': END,
  ...CELULA('header.faixa'), ...CELULA('header.todos'),
  'header.sync.tone': APAR, 'header.sync.text': 'base', 'header.sync.banner': 'base', 'header.sync.at': REP, 'header.sync.atText': REP,
  'header.counts.total': REP, 'header.counts.tracked': REP, 'header.counts.pinnedOld': REP, 'header.counts.older': REP, 'header.counts.undated': REP,
  'header.result': 'base', 'header.backfill': CTRL, 'header.backfill.done': REP, 'header.backfill.total': REP,

  // os vídeos
  'videos.nota': 'base', 'videos.semVideos': 'base',
  'videos.videos[].id': ID, 'videos.videos[].ytId': ID, 'videos.videos[].title': 'terceiros', 'videos.videos[].url': END, 'videos.videos[].grupo': CTRL,
  'videos.videos[].pub': REP, 'videos.videos[].views': REP, 'videos.videos[].vpd7': REP, 'videos.videos[].mult': REP,
  'videos.videos[].isShort': CTRL, 'videos.videos[].pinned': CTRL, 'videos.videos[].tracked': CTRL, 'videos.videos[].dur': REP,
  'videos.videos[].likes': REP, 'videos.videos[].comments': REP, 'videos.videos[].swaps': REP,
  'videos.videos[].thumbSrc': IMG, 'videos.videos[].viewer': IMG, 'videos.videos[].viewer.*': IMG,
  'videos.videos[].durText': 'numero', 'videos.videos[].ageText': 'numero', 'videos.videos[].pubISO': REP, 'videos.videos[].pubTitle': REP,
  'videos.videos[].viewsText': 'numero', 'videos.videos[].viewsMissing': 'motivo', 'videos.videos[].vpdText': 'numero',
  'videos.videos[].multText': 'numero', 'videos.videos[].multTier': APAR, 'videos.videos[].multWord': 'rotulo', 'videos.videos[].semMedida': 'base',
  'videos.videos[].aguardando': CTRL, 'videos.videos[].likesText': 'numero', 'videos.videos[].commentsText': 'numero',
  'videos.videos[].badges[]': 'base', 'videos.videos[].notas[]': 'base', 'videos.videos[].pin': CTRL, 'videos.videos[].pin.*': CTRL,

  // as trocas
  'trocas.tabCount': REP, 'trocas.titulo': REP, 'trocas.intro': REP, 'trocas.vazio': 'base', 'trocas.total': REP,
  'trocas.mudancasLink': CTRL, 'trocas.mudancasLink.href': END, 'trocas.mudancasLink.text': 'base',
  'trocas.cards[].videoId': ID, 'trocas.cards[].title': 'terceiros', 'trocas.cards[].thumbSrc': IMG, 'trocas.cards[].viewer.*': IMG,
  'trocas.cards[].contagem': 'base', 'trocas.cards[].href': END, 'trocas.cards[].hrefLabel': REP,
  'trocas.cards[].trocas[].id': ID, 'trocas.cards[].trocas[].campo': 'rotulo', 'trocas.cards[].trocas[].quando': 'base', 'trocas.cards[].trocas[].quandoTitle': REP,
  'trocas.cards[].trocas[].iso': REP, 'trocas.cards[].trocas[].antes.texto': 'terceiros', 'trocas.cards[].trocas[].antes.thumb': IMG,
  'trocas.cards[].trocas[].antes.semArquivo': CTRL, 'trocas.cards[].trocas[].desfaz': CTRL, 'trocas.cards[].trocas[].agora.texto': 'terceiros', 'trocas.cards[].trocas[].agora.thumb': IMG,
  'trocas.cards[].trocas[].efeito': 'base', 'trocas.cards[].trocas[].href': END, 'trocas.cards[].trocas[].hrefLabel': REP,

  // o estado da URL e a trilha
  'state.*': CTRL, own: CTRL, canaisHref: END, backfilling: CTRL, origemText: CTRL, 'origem.*': CTRL, origem: CTRL,

  // o que a tela decide no navegador
  'derivado.cardsDeTrocas[]': CTRL,
  'derivado.lista.counts.*': REP, 'derivado.lista.resultado': 'base', 'derivado.lista.vazio': CTRL, 'derivado.lista.vazio.text': 'base', 'derivado.lista.vazio.acao': CTRL,
  'derivado.lista.mais': CTRL, 'derivado.lista.mais.mostrando': REP, 'derivado.lista.mais.total': REP, 'derivado.lista.mais.proximo': REP, 'derivado.lista.mais.faltam': REP,
  'derivado.lista.mais.frase': 'base', 'derivado.lista.mais.botao': REP, 'derivado.lista.mais.soAntigos': 'base',
  'derivado.videos[].formato': 'rotulo',
  'derivado.leitura': CTRL,
  ...inventarioDaForja('derivado.leitura.'),
  'derivado.medidas': CTRL,
  ...INVENTARIO_MEDIDAS_CANAL,
}

/** Chaves do inventário cuja folha não aparece em nenhum estado da matriz do teste (cada uma tem teste sintético próprio quando importa). */
export const SEM_FOLHA_NA_MATRIZ_CANAL: readonly string[] = [
  'header.backfill.done', 'header.backfill.total', 'videos.videos[].pin', 'videos.videos[].viewer', 'origem', 'origem.*',
  'derivado.leitura.forja.card.lines[]', 'derivado.leitura.forja.niches[].reading.moreItems[]', 'derivado.leitura.forja.niches[].reading.siteNotes[]',
  'derivado.leitura.forja.reading', 'derivado.leitura.forjaCard.shorts.text', 'derivado.leitura.forjaCard.shorts.href', 'derivado.leitura.forjaCard.confirm',
  // as folhas dos blocos de medida têm matriz própria (`contexto-ia-canal-medidas.test.tsx`)
  ...Object.keys(INVENTARIO_MEDIDAS_CANAL),
]

/** Folhas de número cru: nenhuma. Todo número desta tela já vem formatado pelo modelo (`obs.fmt`). */
export const SEM_PROVA_POR_IGUALDADE_DIRETA_CANAL = [] as const

// ───────────────────────── textos do pacote que esta tela escreve
// Revisto pelo Logan (17/10): as frases de "o que esta tela não mede" e os títulos das tabelas abaixo.
const NAO_MEDE_PRIVADO = 'o que só o dono do canal vê: impressões, taxa de clique, retenção e origem do tráfego de um concorrente'
const NAO_MEDE_ANTIGOS = 'a contagem diária dos vídeos fora dos acompanhados: eles têm só as views da última leitura'
const NAO_MEDE_LEITURA = 'a leitura deste canal: a leitura que existe é a do nicho, que não é só deste canal'

// ───────────────────────── células
const rotulo = (texto: string, origem: string): Celula => ({ papel: 'rotulo', texto, origem })
const base = (texto: string, origem: string): Celula => ({ papel: 'base', texto, origem })
const terceiros = (texto: string, origem: string): Celula => ({ papel: 'terceiros', texto, origem })
const medido = (texto: string, origem: string): Celula => (texto === '0' ? { papel: 'numero', estado: 'zero_medido', texto, x: 0, origem } : { papel: 'numero', estado: 'medido', texto, x: null, origem })
const naoMedido = (motivo: string | null, origem: string): Celula => ({ papel: 'numero', estado: 'nao_medido', motivo: motivo ?? A_TELA_NAO_INFORMA_O_MOTIVO, origem })

const tabelaFixa = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][]): Tabela => ({ id, titulo, tipo: 'fixa', nomeNoCorte, privada: false, colunas, linhas })
const tabelaLista = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][]): Tabela => ({ id, titulo, tipo: 'lista', nomeNoCorte, privada: false, colunas, linhas })

// ───────────────────────── o cabeçalho (todas as abas)
function tabelasDoCabecalho(m: ModeloCanal): Tabela[] {
  const celulas: Array<{ c: NumCell; origem: string }> = [
    ...m.header.faixa.map((c, i) => ({ c, origem: `modelo.header.faixa[${i}]` })),
    ...m.header.todos.map((c, i) => ({ c, origem: `modelo.header.todos[${i}]` })),
  ]
  if (!celulas.length) return []
  const saida: Tabela[] = [tabelaFixa('cabecalho', 'Os números do canal', 'números do canal', ['Medida', 'Valor', 'Base'],
    celulas.map(({ c, origem }) => [
      rotulo(c.label, `${origem}.label`),
      c.value === null ? naoMedido(c.missing, `${origem}.missing`) : medido(c.value, `${origem}.value`),
      base(c.base, `${origem}.base`),
    ]))]
  const fracas = celulas.filter(({ c }) => c.n !== null)
  if (fracas.length) {
    saida.push(tabelaLista('cabecalho-base-fraca', 'Números com base pequena', 'números com base pequena', ['Medida', 'Base pequena'],
      fracas.map(({ c, origem }) => [rotulo(c.label, `${origem}.label`), base(c.n!, `${origem}.n`)])))
  }
  return saida
}

// ───────────────────────── a aba Vídeos
function tabelasDeVideos(m: ModeloCanal): Tabela[] {
  const itens = m.videos.videos.map((v, i) => ({ i, v }))
  if (!itens.length) return []
  const de = (i: number, campo: string): string => `modelo.videos.videos[${i}].${campo}`
  const por = (id: string, titulo: string, nome: string, coluna: string, quais: (v: ChannelVideoView) => boolean, celula: (i: number, v: ChannelVideoView) => Celula): Tabela[] => {
    const linhas = itens.filter(({ v }) => quais(v)).map(({ i, v }) => [terceiros(v.title, de(i, 'title')), celula(i, v)])
    return linhas.length ? [tabelaLista(id, titulo, nome, ['Vídeo', coluna], linhas)] : []
  }
  return [
    tabelaLista('videos', 'Os vídeos do canal, na ordem da tela', 'tabela de vídeos', ['Vídeo', 'Formato', 'Views'],
      itens.map(({ i, v }) => [terceiros(v.title, de(i, 'title')), rotulo(m.derivado.videos[i]!.formato, `modelo.derivado.videos[${i}].formato`), v.viewsText !== null ? medido(v.viewsText, de(i, 'viewsText')) : naoMedido(v.viewsMissing, de(i, 'viewsMissing'))])),
    ...por('videos-publicado', 'Quando cada vídeo foi publicado', 'tabela de publicações', 'Publicado', (v) => v.ageText !== null, (i, v) => medido(v.ageText!, de(i, 'ageText'))),
    ...por('videos-duracao', 'A duração de cada vídeo', 'tabela de durações', 'Duração', (v) => v.isShort === false && v.durText !== null, (i, v) => medido(v.durText!, de(i, 'durText'))),
    ...por('videos-vpd', 'Views por dia (média dos últimos 7 dias)', 'tabela de views por dia', 'Views/dia', (v) => v.vpdText !== null, (i, v) => medido(v.vpdText!, de(i, 'vpdText'))),
    ...por('videos-mult', 'O múltiplo de cada vídeo', 'tabela de múltiplos', 'Múltiplo', (v) => v.multText !== null, (i, v) => medido(v.multText!, de(i, 'multText'))),
    ...por('videos-mult-nivel', 'O nível do múltiplo (alto, muito alto ou topo)', 'tabela de níveis de múltiplo', 'Nível', (v) => v.multWord !== null, (i, v) => rotulo(v.multWord!, de(i, 'multWord'))),
    ...por('videos-curtidas', 'Curtidas de cada vídeo', 'tabela de curtidas', 'Curtidas', (v) => v.likesText !== null, (i, v) => medido(v.likesText!, de(i, 'likesText'))),
    ...por('videos-comentarios', 'Comentários de cada vídeo', 'tabela de comentários', 'Comentários', (v) => v.commentsText !== null, (i, v) => medido(v.commentsText!, de(i, 'commentsText'))),
    ...(() => {
      const linhas: Celula[][] = []
      for (const { i, v } of itens) {
        const nota = (t: string | null, campo: string): void => { if (t) linhas.push([terceiros(v.title, de(i, 'title')), base(t, de(i, campo))]) }
        v.badges.forEach((b, k) => nota(b, `badges[${k}]`))
        nota(v.semMedida, 'semMedida')
        v.notas.forEach((n, k) => nota(n, `notas[${k}]`))
      }
      return linhas.length ? [tabelaLista('videos-notas', 'Notas de cada vídeo', 'tabela de notas dos vídeos', ['Vídeo', 'Nota'], linhas)] : []
    })(),
  ]
}

// ───────────────────────── a aba Trocas
function tabelasDeTrocas(m: ModeloCanal): Tabela[] {
  const pares = m.derivado.cardsDeTrocas.flatMap((ci) => m.trocas.cards[ci]!.trocas.map((t, ti) => ({ ci, ti, c: m.trocas.cards[ci]!, t })))
  if (!pares.length) return []
  const p = (ci: number, ti: number): string => `modelo.trocas.cards[${ci}].trocas[${ti}]`
  const titulos = pares.filter(({ t }) => t.antes.texto !== null && t.agora.texto !== null)
  return [
    tabelaLista('trocas', 'As trocas dos últimos 30 dias', 'tabela de trocas', ['Vídeo', 'Troca', 'Quando', 'Efeito em 7 dias'],
      pares.map(({ ci, ti, c, t }) => [terceiros(c.title, `modelo.trocas.cards[${ci}].title`), rotulo(t.campo, `${p(ci, ti)}.campo`), base(t.quando, `${p(ci, ti)}.quando`), base(t.efeito, `${p(ci, ti)}.efeito`)])),
    ...(titulos.length ? [tabelaLista('trocas-titulos', 'Os títulos de antes e de agora', 'tabela de títulos trocados', ['Vídeo', 'Título de antes', 'Título de agora'],
      titulos.map(({ ci, ti, c, t }) => [terceiros(c.title, `modelo.trocas.cards[${ci}].title`),
        terceiros(t.antes.texto!, `${p(ci, ti)}.antes.texto`), terceiros(t.agora.texto!, `${p(ci, ti)}.agora.texto`)]))] : []),
  ]
}

// ───────────────────────── avisos e definições (frases do próprio modelo)
const presentes = (xs: ReadonlyArray<string | null | undefined>): string[] => xs.filter((x): x is string => typeof x === 'string' && x !== '')

function avisosDe(m: ModeloCanal, daMedida: string[]): string[] {
  const out = presentes([m.header.sync.text, m.header.sync.banner, ...daMedida])
  const t = m.state
  if (t.tab === 'videos') {
    out.push(...presentes([m.videos.nota, m.videos.semVideos, m.derivado.lista.vazio?.text, m.derivado.lista.mais?.frase]))
    if (m.header.counts.total > 0) out.push(...presentes([t.q.trim() ? (m.derivado.lista.vazio ? null : m.derivado.lista.resultado) : m.header.result]))
  } else if (t.tab === 'trocas') {
    out.push(...presentes([m.trocas.vazio, m.trocas.mudancasLink?.text]))
    out.push(...m.derivado.cardsDeTrocas.flatMap((ci) => presentes([m.trocas.cards[ci]!.trocas.length > 1 ? m.trocas.cards[ci]!.contagem : null])))
  } else if (m.derivado.leitura) {
    const { forja: f, forjaCard: fc } = m.derivado.leitura
    out.push(...presentes([f.card.stateLabel, f.card.statusText, f.card.sentNow, f.card.askNote, ...f.card.lines, fc.outSummary, fc.outText]))
    for (const b of f.niches) out.push(...presentes([b.statusLine, b.reading === null ? b.emptyText : null]))
  }
  return out
}

// ───────────────────────── o empacotador
export function empacotarCanal(modelo: ModeloCanal): PacoteModelo {
  const aba = modelo.state.tab
  const leitura = modelo.derivado.leitura
  const medidas = tabelasDeMedidas(modelo.derivado.medidas)
  const tabelas: Tabela[] = [
    ...tabelasDoCabecalho(modelo),
    ...medidas.tabelas,
    ...(aba === 'videos' ? tabelasDeVideos(modelo) : aba === 'trocas' ? tabelasDeTrocas(modelo) : leitura ? tabelaDaForjaDe(leitura.forja, 'modelo.derivado.leitura.forja') : []),
  ]
  const citados: BlocoCitado[] = aba === 'leitura' && leitura ? citadosDaForjaDe(leitura.forja, 'modelo.derivado.leitura.forja') : []
  const vazioDaLista = aba === 'videos' && modelo.videos.videos.length === 0 ? modelo.videos.semVideos : null
  return {
    tela: 'canal',
    janela: `${modelo.header.name}, aba ${aba === 'videos' ? 'Vídeos' : aba === 'trocas' ? 'Trocas (30 dias)' : 'Leitura'}`,
    foco: [{ nome: modelo.header.name, oQueE: 'concorrente', detalhe: modelo.header.nicheLabel ?? 'sem nicho' }],
    tabelas,
    citados,
    definicoes: [],
    avisos: avisosDe(modelo, medidas.avisos),
    naoMede: [NAO_MEDE_PRIVADO, NAO_MEDE_ANTIGOS, ...(aba === 'leitura' ? [NAO_MEDE_LEITURA] : [])],
    privado: { estado: 'na' },
    comentarios: { estado: 'na' },
    vazio: vazioDaLista,
    motivoDoMagro: null,
    listasCompletas: aba !== 'videos' || modelo.derivado.lista.mais === null,
  }
}
