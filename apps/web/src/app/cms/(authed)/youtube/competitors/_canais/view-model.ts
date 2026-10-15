/**
 * View model of the Canais screen (port of canais.html cells/syncCell/growthCell/openDrawer/swapCard/effHTML).
 * Pure: every number, date and sentence comes from the engine (Observatory). The component only lays it out.
 */
import { pinViewOf, type PinView } from '../_chrome/pin-view'
import { viewsMissingText } from '../_chrome/views-text'
import type { Observatory } from '@/lib/youtube/observatorio'
import { semNovidadeText } from '@/lib/youtube/observatorio/forja/novidade'
import { joinLabels, type NicheScope } from '@/lib/youtube/observatorio/niche'
import type { Fmt, Niche, ObsChannel, ObsVideo, SyncState } from '@/lib/youtube/observatorio/types'
import type { OutlierItem } from '@/lib/youtube/observatorio/outliers'
import type { ObsChange } from '@/lib/youtube/observatorio/changes'
import type { MultiplierResult } from '@/lib/youtube/observatorio/multiplier'
import { crescimento30, humanizeSyncError, type ChannelStats, type Crescimento30 } from '@/lib/youtube/observatorio/channels'
import { retratoVelho } from '@/lib/youtube/observatorio/inscritos-28d'
import type { RetratosProprios } from '@/lib/youtube/observatorio/retratos-proprios'
import { buildForjaView, type ForjaView } from '../_chrome/forja-view-model'
import { canalTemVideos, langChip, ownChannelHref, ownTexts, SEM_PAGINA_LINHA, type LangChip } from '../_chrome/own-channels'
import { escolherPrincipal, linhasDoMotor, principalDoMotor } from '../_chrome/own-menu'
import { posicoes, type Conjunto, type Posicao } from '@/lib/youtube/observatorio/posicao'
import {
  BUSCA_NOTA, CONJUNTO_AVISO, FAIXA_SEM_POSICAO, PROBLEMAS_NOTA, divisorDe, semValorDoProprio, sentidoDaOrdem, emTexto, fraseDePosicao, fraseVizinhos, motivoSemValor, motivoTexto, temPosicao,
  type MotivoSemMedida,
} from './posicao-model'
import { effView } from '../_chrome/effect-view'
import { contaComoTroca, trocas30, trocasDe30, vpdText } from '../_canal/numeros'
import { NB, nbMilMi, numNb } from '../_canal/formato'
import { FMT_PADRAO, fmtDaOrdem, parseCanaisFmt, type CanaisFmt } from './formato'
import { SEM_LEITURA, SEM_VPD_PROPRIO_DICA, VPD_SO_LONGOS, type ExtrasProprio } from '../_proprio/extras'
import { baseVpdTexto, motivoVpdTexto, type VpdCanal } from '@/lib/youtube/observatorio/proprio/vpd'
import { spDateOf } from '@/lib/youtube/observatorio/time'
import type { MedidasDoCanal } from '@/lib/youtube/observatorio/medidas/do-canal'
import type { Parte } from '@/lib/youtube/observatorio/medidas/ler'
import type { ExtrasDoCanal } from '@/lib/youtube/observatorio/medidas-telas/ler-extras-dos-canais'
import { FRASES } from '@/lib/youtube/observatorio/medidas-telas/frases'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { celulaDeDirecao, resumoDeDirecao, type CelulaDeDirecao, type ResumoDeDirecao } from './direcao-model'
import { contagemDosFiltros, estadoDaLinha, linhaNoFiltro, type ContagemDosFiltros, type EstadoDaLinha, type FiltroDeEstado } from './estado-model'
import { fraseDoResumo } from './resumo-model'
import { dicaCrescimento, dicaDirecao, dicaInscritos, dicaOutliers, dicaRitmo, dicaSync, dicaTrocas, dicaViewsDia, type Escrita } from './dicas-model'
import { passoDoYouTube } from '@/lib/youtube/observatorio/inscritos-28d'

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s)
const nb = (s: string) => s.replace(/(\d) (h|d|dias?|min)\b/g, '$1' + NB + '$2').replace(/há /g, 'há' + NB)
const NEQ = (n: number) => `n${NB}=${NB}${n}`

type CStats = ChannelStats
type Growth = Crescimento30

export type CanaisSort = 'active' | 'vpd' | 'outliers' | 'swaps' | 'growth' | 'subs' | 'direcao'
/** The order the screen opens in: views/dia in the chosen scale (per thousand subscribers unless ?scale=abs). */
export const DEFAULT_SORT: CanaisSort = 'vpd'
export type DrawerTab = 'trocas' | 'videos' | 'outliers'
export type Tier = 'mid' | 'high' | 'top' | ''
export interface Thumb { src: string | null; text: string | null }

export type CadenceCell =
  | { kind: 'na'; text: string; title: string }
  | { kind: 'ok'; weeks: Array<{ long: number; short: number }>; label: string; pw: string; unit: string; sub: string | null; paused: string | null }
export type VpdCell =
  /** `falta`: a frase é a da ausência do formato ("sem Shorts", "sem vídeos"); em "Todos" ela vem sem rótulo na frente. */
  | { kind: 'na'; text: string; title: string; falta?: true }
  /** `title`: a base escrita do número do canal próprio (a janela do diário); ausente nos concorrentes. */
  | { kind: 'ok'; big: string; abs: string | null; n: number; weak: boolean; tail: string | null; title?: string }
export type OutCell =
  | { kind: 'na'; text: string; weak: string | null; upnext: string | null; falta?: true }
  | { kind: 'ok'; title: string; videoTitle: string; thumb: Thumb; mult: string; tier: Tier; vs: string; n: number; published: string; publishedTitle: string; count: string }
export type SwapCell = { kind: 'na'; text: string } | { kind: 'ok'; n: number; last: string; lastTitle: string | null }
export type GrowthCell =
  | { kind: 'na'; text: string; title: string; motivo: 'novo' | 'sem-registro' | 'oculto' | 'nao-carregou' | 'sem-percentual' | 'buraco'; fechaEm: number | null; dias: number | null }
  | { kind: 'flat'; big: 'sem variação'; cap: string; limite: number; antes: number | null; depois: number | null; de: number | null; ate: number | null; atrasadoAte: number | null; abs: number; passo: number }
  | { kind: 'ok'; big: string; cap: string; antes: number | null; depois: number | null; de: number | null; ate: number | null; atrasadoAte: number | null; abs: number; pct: number }
export interface SyncCell {
  state: SyncState; label: string; labelTitle: string | null; cov: string | null; covTitle: string | null
  msg: string | null; progress: { done: number; total: number } | null; canRetry: boolean; canRemove: boolean
  /** While the chrome's round runs, a channel that enters it shows "Na fila desta rodada" (canais.html syncCell 'queued'). */
  queued: null | { label: string; cov: string | null; covTitle: string | null }
}

export interface CanaisRow {
  id: string; name: string; niche: Niche | null; pw: string; vpd: string
  outliers: { n: number; href: string }; changes: { n: number; href: string }
  growth: string; growthTitle: string
  sync: { label: string; phrase: string | null; state: SyncState }
  own: boolean
  /** A página do canal: do concorrente e do canal próprio COM vídeos (`canalTemVideos`). null = canal próprio sem vídeos (sem página, 16.8; `semPagina` diz por quê). */
  href: string | null
  /** Só canal próprio SEM vídeos (sem página, 16.8): o motivo de a linha não abrir nada. O nome vira texto (não botão) e a linha diz isto. */
  semPagina: string | null
  /** "Comparar" com o canal próprio principal (`escolherPrincipal`); null em canal próprio e quando o site não tem canal próprio com vídeos. `label` é o nome acessível. */
  comparar: { href: string; label: string } | null
  /** Language mark of an own channel; null for competitors and when the site has a single own channel. */
  lang: LangChip | null
  color: string; ini: string; avatar: string | null; subs: string; subsTip: string; url: string; handle: string; backfill: boolean
  /** M8: `sim`, `nao` ou `nao_carregou` (a medida não veio: nunca vira "não está parado"). */
  paused: 'sim' | 'nao' | 'nao_carregou'
  /** A5 E5a T5: a direção das views (M3a) e o estado do canal (M8), uma regra só para a tabela, o cartão e o painel. */
  direcao: CelulaDeDirecao; estado: EstadoDaLinha
  /** Os dois números da direção, escritos como o resto da lista ("2.171 mil"); nulo fora do caso medido. */
  direcaoNumeros: { recente: string; anterior: string } | null
  /** O canal esconde os inscritos (o campo do canal, ou a contagem ausente): a tela escreve a pastilha, nunca 0. */
  subsOculto: boolean
  /** O valor de cada coluna para ordenar neste formato. null = sem medida: a linha vai para o fim, em qualquer direção; nunca um número de mentira. */
  valor: Record<CanaisSort, number | null>
  /** A posição canônica na ordenação atual (toda ordenação), no conjunto da lista; null sem valor ou fora do conjunto (canal próprio sem nicho num nicho). */
  numero: Posicao | null
  /** O mesmo que `numero`, só nas ordenações de POSICIONADAS (Inscritos e Views/dia), onde as frases do dono falam da posição do canal. */
  pos: Posicao | null
  /** Por que não tem posição: sem valor na coluna ordenada, ou (só canal próprio) sem nicho num nicho escolhido, ou ordenação sem posição. */
  semMedida: MotivoSemMedida | null
  /** A frase do motivo de 'sem-views-dia-proprio' (de `motivoVpdTexto`), para `motivoTexto`; null nos outros motivos e quando o dado não foi lido. */
  semMedidaTexto: string | null
  /** A5 2ª leva T8: o texto da dica de cada coluna (modelo puro em `dicas-model.ts`). null = a célula não tem dica (o estado já diz tudo). */
  dicas: {
    subs: string; vpd: string | null; cadence: string | null; out: string | null; swap: string | null; growth: string; direcao: string | null; sync: string | null
    vpd2?: string | null; cadence2?: string | null; out2?: string | null
  }
  cells: {
    cadence: CadenceCell; vpd: VpdCell; out: OutCell; swap: SwapCell; growth: GrowthCell; sync: SyncCell
    /** Só em "Todos": a medida dos Shorts, com o mesmo tipo da primeira (a primeira é a dos longos). */
    cadence2?: CadenceCell; vpd2?: VpdCell; out2?: OutCell
  }
  /** Vídeos acompanhados sem a marca de Short (is_short nulo): entram nos longos até a confirmação (D7). */
  semFormato: { n: number; label: string; tip: string } | null
  cowork: string
  /** Toast texts of "Sincronizar só este canal" (the screen builds no text). */
  syncOneText: { start: string; ok: string; okBody: string; fail: string; failBody: string; backfill: string }
}
/** One piece of the "Seus canais" line (canais.html ownParts): a mono number, a sentence, or a warning. */
export interface OwnGroupPart { num: string | null; text: string; warn: boolean }

/** O bloco "Seus canais" do topo (spec 15.2): uma linha por canal próprio, na ordem do motor (inscritos, maior primeiro). */
export type OwnBlockLinha =
  | { tipo: 'cheia'; id: string; name: string; avatar: string | null; ini: string; color: string; pos: Posicao | null; frase: string; vizinhos: string | null; abrirHref: string }
  | { tipo: 'fina'; id: string; texto: string }
export interface OwnBlock {
  titulo: 'Seus canais' | 'Seu canal'
  linhas: OwnBlockLinha[]
  /** As partes da linha de grupo de hoje ("1 em outro nicho (aparece em Todos)", "fora do limite de concorrentes"). */
  partes: OwnGroupPart[]
}
/** A lista única: quem tem valor na coluna ordenada, na ordem da direção; depois, sob o divisor, quem não tem. */
export interface CanaisLista { ranked: CanaisRow[]; unranked: CanaisRow[]; divisor: { titulo: string; nota: string } | null }

export interface EffectView { vd: 'won' | 'lost' | 'neu' | 'inc' | 'wait'; icon: 'up' | 'down' | 'eq' | 'q' | 'wait' | 'nodata'; label: string | null; main: Array<{ t: string; mono?: boolean }>; sub: string | null; subWeak: string | null }
export interface ViewsText { num: string | null; text: string }
export interface SwapCard {
  id: string; heads: Array<{ strong: string; when: string; whenTitle: string }>; multi: boolean; whenTail: string; views: ViewsText; title: string
  desc: null | { hasText: true; chip: string; href: string } | { hasText: false; text: string }
  ba: null | { before: { thumb: Thumb | null; title: string | null }; after: { thumb: Thumb | null; title: string | null } }
  thumbNote: string | null; precNote: string | null; effect: EffectView | null; sameNote: string | null; histHref: string; ytUrl: string
}
export interface OutRow { id: string; thumb: Thumb; title: string; mult: string; tier: Tier; meta: string; phaseTitle: string; published: string; publishedTitle: string; views: ViewsText }
export interface VidRow { id: string; thumb: Thumb; title: string; published: string; publishedTitle: string; views: ViewsText; rel: null | { text: string; tier: Tier; outlier: boolean }; vp: { num: string | null; text: string }; histHref: string; ytUrl: string }
/** One pinned video in the drawer's Vídeos tab: where it stands and its "Desafixar". */
export interface PinnedRow { id: string; thumb: Thumb; title: string; histHref: string; published: string; where: string; pin: PinView }
export interface LinkN { n: number; key: string; href: string; text: string }
export interface DrawerView {
  id: string; tab: DrawerTab; own: boolean; backfill: boolean; name: string; color: string; ini: string; avatar: string | null; niche: Niche | null
  lang: LangChip | null
  handle: string; url: string; subsText: string; cov: string
  stats: Array<{ label: string; labelTitle: string | null; value: string; sub: string; subTitle: string | null; subWeak: boolean; /** A sub-linha é a forma de erro da seção 4.2 ("não carregou"), nunca texto fraco. */ subErro?: boolean }>
  swaps: { count: number; intro: string; note: string | null; cards: SwapCard[]; link: LinkN | null }
  outliers: { tabN: string; tabTitle: string; intro: string; note: string | null; sections: Array<{ fmt: Fmt; title: string; rows: OutRow[]; link: LinkN | null; note: string | null }> }
  videos: {
    title: string; intro: string; preNote: string | null; upnext: string | null; rows: VidRow[]; note: string | null
    /** "Vídeos fixados" (R118): first section of the tab. null = own channel, or a channel still fetching its videos. */
    pinned: null | { title: 'Vídeos fixados'; count: string; intro: string; empty: string | null; rows: PinnedRow[] }
  }
}

export interface CanaisView {
  slots: { used: number; limit: number; free: number; text: string; fullText: string | null; tip: string; nearFull: boolean; unlockText: string; unlockDone: string }
  scale: 'per-mil' | 'abs'; layout: 'table' | 'cards'
  /** O filtro de formato. A URL o traz sempre (`fmtNaUrl`); sem ele o servidor desenha Longos e o navegador grava o lembrado. */
  fmt: CanaisFmt; fmtNaUrl: boolean
  /** O aviso sob o controle (spec 15.3); null em Longos. */
  fmtNota: string | null
  /** Só em "Todos": o rótulo que sobe para o cabeçalho das colunas que dependem de formato. */
  fmtCab: { dois: string; ordenado: string } | null
  sort: CanaisSort; dir: 'asc' | 'desc'; sortNote: string; vpdUnit: string
  /** A linha "Ordenado por …" (mockup 17): a coluna, o sentido e se há empate na lista. */
  ordem: { coluna: string; sentido: string | null; empate: boolean }
  /** O que a faixa "Seus canais" diz nas ordenações sem posição (fora de Inscritos e Views/dia); null com posição ou sem canal próprio. */
  faixaSemPosicao: { linha1: string | null; linha2: string } | null
  /** A lista única (A3): os canais próprios na posição deles entre os concorrentes, em qualquer filtro de nicho. */
  list: CanaisLista
  /** A coluna "Com o meu canal" (e o link dos cartões) existe só quando há um canal próprio com vídeos para comparar. */
  compararColuna: boolean
  /** O conjunto em que a posição é contada: o nicho escolhido, ou todos os canais do site (emenda 45). */
  conjunto: Conjunto
  /** O aviso da posição geral (emenda 45); null dentro de um nicho. */
  conjuntoAviso: string | null
  /** A frase sob a busca: a posição é a da lista inteira. */
  buscaNota: string
  /** O que o "de N" conta quando a lista mostra outra coisa (canal próprio sem nicho num nicho; filtro "só com problema"); null quando nada a explicar. */
  posicaoNota: string | null
  /** A linha presa no pé: fala do mesmo canal que o "Comparar" (`escolherPrincipal`). null sem canal próprio. */
  pe: { canalId: string; texto: string } | null
  /** O bloco "Seus canais" do topo; os canais próprios estão também na lista, na posição deles. */
  own: { many: boolean; block: OwnBlock | null }
  drawer: DrawerView | null
  /** The URL asked for the drawer of a channel that is in another niche than the explicit filter: the screen drops ?channel=. */
  drawerDropped: boolean
  filter: FiltroDeEstado; addOpen: boolean; nicheEditorOpen: boolean
  /** A5 E5a T5: o bloco de resumo (frase, quatro casas da direção, filtros de estado) e o vazio explicado. */
  resumo: ResumoView
  niche: NicheScope; nicheLabel: string
  problems: { n: number; filterHref: string; clearHref: string }
  emptyText: string
  /** F4: the link inside emptyText that opens the niche editor (null: the sentence has none). */
  emptyLink: { text: string; href: string } | null
  legend: { mid: string; high: string; top: string }
  add: { cap: string; when: string; defaultNiche: Niche; limitMax: number; defaultLimit: number; niches: Array<{ id: Niche; label: string }> }
  /** The site's niches in the tab order: the options of every niche select. `color` only on the ones the owner created. */
  niches: NicheOption[]
  /** Tooltip of the Sincronização column header. */
  syncTip: string
  /** canais.html .syncbar, shown while the chrome's round runs (R42). */
  syncbar: { text: string; meta: string }
  /** Every competitor, whatever the niche scope or ?filter: the "Definir nicho dos canais" editor. */
  nicheRows: Array<{ id: string; name: string; niche: Niche | null }>
  /** The forja ("Resumo das trocas", Task 35): header button/status, the Todos bar and the drawer's forja box. */
  forja: ForjaView
  /** Todos with a split request: the engine's lines and sentence outside the drawer (canais.html #forjaBar). */
  forjaBar: { lines: string; text: string } | null
  drawerForja: CanaisDrawerForja | null
}
/** canais.html forjaState(c): the forja box of the channel drawer (the niche's request, not only this channel). */
export interface CanaisDrawerForja {
  niche: Niche; head: string
  lines: Array<{ text: string; me: boolean }>; chip: string | null; stateText: string | null
  readingHref: string | null
  why: string
  button: { label: string; disabled: boolean; title: string }
  free: { label: string; niches: Niche[] } | null
}

/** As medidas do site que a lista lê (M3a e M8 de cada canal e os campos do canal). `MedidasDoSite` serve; ausente ou nulo = não carregaram. */
export interface MedidasParaLista {
  porCanal: ReadonlyMap<string, Pick<MedidasDoCanal, 'm3a' | 'm8'> | { naoCarregou: string }>
  extras: Parte<ReadonlyMap<string, ExtrasDoCanal>> | { lido: false; causa: 'tempo_esgotado' }
}
const MEASURE_QUEDA_JANELAS = MEASURE_RULES.decline.windows, MEASURE_JANELA_DIAS = MEASURE_RULES.direction.windowDays
export type DirecaoFiltro = 'sobe' | 'estavel' | 'desce' | 'nao-medido'
export interface CasaDoResumo { chave: DirecaoFiltro; n: number | null; palavra: string; leitor: string; pressed: boolean; data: string | null }
export interface FiltroDoResumo { chave: FiltroDeEstado; rotulo: string; n: number | null; ainda: string | null; naoMedido: string | null; pressed: boolean; leitor: string
  /** Só nos filtros de estado, quando parte das linhas não teve o estado lido: o número vale para `medidos` de `de` canais. */
  base: { medidos: number; de: number } | null }
export interface ResumoView {
  frase: string; carregou: boolean
  casas: CasaDoResumo[]
  filtros: FiltroDoResumo[]
  /** Até quando os 56 dias cruzam a mudança de contagem de 24/08; nulo depois. */
  avisoDeContagem: { ate: string } | null
  contagem: ContagemDosFiltros
  direcao: ResumoDeDirecao
  /** Todos os canais do recorte sem registro recente: a coleta de retratos parou. `desde` é o dia da última leitura boa mais recente (nulo se nenhuma foi lida). A página manda o evento ao Sentry. */
  semRetrato: { desde: string | null } | null
  /** O filtro de estado ou de direção esvaziou a lista: a explicação (zero medido, não medido ou ainda não existe) e o botão de limpar. */
  vazio: { titulo: string; apoio: string; acaoDescendo?: boolean; forma: 'zero' | 'nao_medido' | 'nao_carregou' | 'ainda_nao_existe'; limpar: { texto: string } } | null
  /** O dono pode agir (sincronizar, adicionar, remover): a tela repete a frase de só leitura quando não. Preenchido pela tela. */
}

export interface CanaisParams {
  niche: NicheScope; limit: number; channel?: string; tab?: string; add?: string; filter?: string; direcao?: string;
  /** As medidas do site inteiro (`carregarMedidasDoSite`). Ausente/nulo = não carregaram: nenhuma célula afirma nada. */
  medidas?: MedidasParaLista | null; scale?: string; fmt?: string; layout?: string
  sort?: string; dir?: string; nicheEditor?: string; unlockStep?: number
  /** ?niche= is in the URL (a click on the niche bar), not only the persisted preference. */
  nicheExplicit?: boolean
  /** A escolha do dono para "o meu canal" (cookie `obs-meu-canal`, lido no servidor); `escolherPrincipal` decide com ela. Ausente = sem escolha. */
  lembrado?: string | null
  /** Os retratos públicos diários do canal próprio (MG20), já lidos pela página: medem o Crescimento dele. 'erro' = a leitura falhou; ausente = sem registro. */
  retratosProprios?: ReadonlyMap<string, RetratosProprios> | 'erro'
}

const pick = <T extends string>(v: string | undefined, ok: readonly T[], d: T): T => (v && (ok as readonly string[]).includes(v) ? (v as T) : d)
const SORTNAME: Record<CanaisSort, string> = { active: 'Ritmo', vpd: 'Views/dia', outliers: 'Outliers', swaps: 'Trocas', growth: 'Crescimento', subs: 'Inscritos', direcao: 'Direção' }
/** The colour of a niche the owner created, as the CSS variables the chrome's niche bar already uses (plus the subtle fills). */
export interface NicheVars { dark: string; light: string; darkSubtle: string; lightSubtle: string }
export interface NicheOption { id: Niche; label: string; color: NicheVars | null }
/** rgba() literal (never color-mix: it renders transparent in some browsers). */
const rgba = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return Number.isFinite(n) ? `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})` : 'transparent' }
export const nicheVars = (c: { dark: string; light: string }): NicheVars => ({ dark: c.dark, light: c.light, darkSubtle: rgba(c.dark, 0.13), lightSubtle: rgba(c.light, 0.08) })
export function nicheOptions(obs: Observatory): NicheOption[] {
  return obs.niches.map(n => ({ id: n.id, label: n.label, color: n.builtin ? null : nicheVars(n.color) }))
}

/**
 * `extras`: o dado privado do canal próprio (views por dia do diário), lido no servidor só para quem edita o site. Ausente = o dado não foi
 * lido: o canal próprio fica sem número e a frase é a de "sem-diario" (nunca um número, nunca zero).
 */
export function buildCanaisView(obs: Observatory, p: CanaisParams, extras?: ExtrasProprio): CanaisView {
  const D = obs.date, F = obs.fmt, R = obs.RULES
  const escrita: Escrita = { num: v => F.int(v), dec1: v => F.dec1(v), dm: t => D.dm(t), agora: obs.NOW }
  // `filtro` é o que a pessoa escolheu (Todos, Longos, Shorts); `fmt` é o formato que ordena e posiciona (Todos ordena pelos longos)
  const fmtLido = parseCanaisFmt(p.fmt)
  const filtro: CanaisFmt = fmtLido ?? FMT_PADRAO
  const todos = filtro === 'todos'
  const fmt: Fmt = fmtDaOrdem(filtro)
  const scale = p.scale === 'abs' ? 'abs' : 'per-mil'
  const rel = scale === 'per-mil'
  const layout = pick(p.layout, ['table', 'cards'] as const, 'table')
  const sort = pick(p.sort, ['active', 'vpd', 'outliers', 'swaps', 'growth', 'subs', 'direcao'] as const, DEFAULT_SORT)
  const dir = pick(p.dir, ['asc', 'desc'] as const, 'desc')
  const filter = pick(p.filter, ['todos', 'problemas', 'parados', 'em-queda', 'sairam', 'sem-videos'] as const, 'todos')
  const direcaoFiltro = pick(p.direcao, ['sobe', 'estavel', 'desce', 'nao-medido'] as const, 'todos' as 'todos' | DirecaoFiltro)
  const hojeSP = spDateOf(obs.NOW)
  const niche = p.niche
  const NL = (n: Niche) => obs.nicheLabel(n)
  const nicheLabel = niche === 'todos' ? 'Todos' : NL(niche)
  const nicheOpts = nicheOptions(obs), tabIdx = (n: Niche | null) => { const i = n == null ? -1 : nicheOpts.findIndex(o => o.id === n); return i < 0 ? nicheOpts.length : i }
  const stats = (id: string, f: Fmt = fmt) => obs.channelStats(id, f)
  const num = (n: number | null) => numNb(F, n)
  /** Views por dia (absoluto OU por mil inscritos), no formato de todas as telas (spec 19.3, emenda 37; `vpdText`): abaixo de 10 uma casa, "menos de 0,1", "0" exato. */
  const vpdAbs = (v: number) => nbMilMi(vpdText(v, F.num) ?? F.num(v))
  const subsTxt = (n: number) => nbMilMi(F.subs(n))
  const HIDDEN_ROW = 'Inscritos ocultos'
  const abs = (t: number) => `${D.dmhm(t)} (São Paulo)`
  /** sync instants may be null (a channel that never synced OK): no date is invented */
  const absN = (t: number | null) => (t == null ? null : abs(t))
  const sinceN = (t: number | null) => (t == null ? '' : ' desde ' + D.dmhm(t))
  const agoN = (t: number | null) => (t == null ? '' : nb(D.ago(t)))
  const tier = (x: number | null): Tier => obs.tierOf(x) ?? ''
  const thumbOf = (v: ObsVideo): Thumb => ({ src: v.ytId ? `https://i.ytimg.com/vi/${encodeURIComponent(v.ytId)}/mqdefault.jpg` : null, text: null })
  const ageOf = (v: ObsVideo) => ({ text: nb(F.age(v)), title: abs(v.pub) })
  /* ---- A5 E5a T5: M3a e M8 de cada canal. Medida que não veio é "não carregou": nunca vira "ativo" nem "não está parado". ---- */
  const videosN = new Map<string, number>()
  for (const v of obs.videos) videosN.set(v.ch, (videosN.get(v.ch) ?? 0) + 1)
  const medidaDe = (id: string): Pick<MedidasDoCanal, 'm3a' | 'm8'> | null => {
    const m = p.medidas?.porCanal.get(id)
    return m && 'm3a' in m ? m : null
  }
  const extrasDoCanal = (id: string): ExtrasDoCanal | null => (p.medidas?.extras.lido ? p.medidas.extras.dados.get(id) ?? null : null)
  /** Zero vídeos datados não quer dizer que o canal não publicou: na 1ª busca, ou com vídeos sem `published_at`, ele ainda está sendo lido. */
  const buscando = (c: ObsChannel): boolean => c.sync.state === 'backfill' || c.undated.length > 0
  const direcaoDe = (c: ObsChannel): CelulaDeDirecao => celulaDeDirecao(medidaDe(c.id)?.m3a ?? null, extrasDoCanal(c.id), { proprio: c.own, semVideos: (videosN.get(c.id) ?? 0) === 0 && !buscando(c) })
  const estadoDe = (c: ObsChannel): EstadoDaLinha => estadoDaLinha(medidaDe(c.id)?.m8 ?? null, extrasDoCanal(c.id), videosN.get(c.id) ?? 0, { proprio: c.own, hojeSP, buscando: buscando(c) })
  /** M8 diz "parado"? `nao_carregou` quando a medida não veio (a pastilha do estado carrega o motivo); coleta pausada e canal próprio são `nao`. */
  const paradoDe = (c: ObsChannel): 'sim' | 'nao' | 'nao_carregou' => {
    if (c.own) return 'nao'
    const e = estadoDe(c).pastilha
    return e === 'parado' ? 'sim' : e === 'nao_carregou' ? 'nao_carregou' : 'nao'
  }
  const diasParado = (c: ObsChannel): number | null => { const e = estadoDe(c); return e.pastilha === 'parado' && typeof e.dataOuDias === 'number' ? e.dataOuDias : null }
  /** A data do último vídeo é a que M8 leu, não "agora menos os dias" (que adianta o dia quando a hora atual é anterior à da publicação). */
  const ultimaDoParado = (c: ObsChannel): number | null => { const e = estadoDe(c); return e.pastilha === 'parado' ? e.ultimaEm : null }
  const stale = (c: ObsChannel, S: CStats) =>
    // Task 23 ruling (brief test + CONVENCOES:267, confirmed in 35b fix round 1): a "parado" channel's views also say
    // "até o registro diário"; canais.html shows it only for atrasado/erro — allow-listed in canais.spec
    // (E5a T5: o "parado" é o de M8, não o do motor)
    (c.sync.state === 'atrasado' || c.sync.state === 'erro' || (paradoDe(c) === 'sim' && c.sync.state !== 'backfill')) && S.growth30.to != null
      ? ` até o registro diário de ${D.dmhm(S.growth30.to)}` : ''
  const isBf = (c: ObsChannel) => c.sync.state === 'backfill'
  const videosOf = (id: string) => obs.videos.filter(v => v.ch === id).sort((a, b) => b.pub - a.pub)
  const ownLongEmpty = (c: ObsChannel) => c.own && !videosOf(c.id).some(v => v.fmt === 'long' && v.ageDays <= 90)
  const ownEmptyText = (c: ObsChannel) => {
    const k = obs.cadence(c.id, 'long')
    return k.lastUpload != null ? `Nenhum vídeo longo nos últimos 90 dias (último em ${D.dm(k.lastUpload)}, ${k.lastUploadAgo}).` : 'Nenhum vídeo longo nos últimos 90 dias.'
  }
  const outs = (c: ObsChannel, f: Fmt) => obs.outliers({ channel: c.id, fmt: f, niche: 'todos', includeOwn: c.own })
  const ch30 = (c: ObsChannel) => (c.own ? [] : obs.changesIn({ days: 30, channel: c.id }))
  /** `soTituloEThumb`: o resumo da coluna Trocas da lista não nomeia descrição (nem como par da mesma janela); o painel lateral, que lista cada evento, nomeia. */
  const groupsOf = (list: ObsChange[], soTituloEThumb = false) => {
    const seen = new Set<string>(), gs: ObsChange[][] = []
    for (const x of list) {
      if (seen.has(x.id)) continue
      const items = [x, ...x.sameWindow.map(id => obs.change(id)).filter((y): y is ObsChange => !!y)].filter(i => !soTituloEThumb || contaComoTroca(i))
      items.forEach(i => seen.add(i.id)); gs.push(items)
    }
    return gs
  }
  const whenPh = (items: ObsChange[]) => {
    const i = items[0]!, win = i.prec && i.prec !== 'min', ago = nb(i.agoShort)
    if (!win) return ago
    const g = items.length > 1 ? 'vistos' : i.type === 'title' ? 'visto' : 'vista'
    return `${g} pela 1ª vez ${ago}`
  }
  const verb = (i: ObsChange) => ({ label: i.typeLabel, verb: i.type === 'desc' && !i.hasText ? 'mudou' : i.type === 'title' ? 'trocado' : 'trocada' })
  const groupText = (g: ObsChange[]) => {
    if (g.length > 1) return `${verb(g[0]!).label} e ${verb(g[1]!).label.toLowerCase()} trocados na mesma janela, ${whenPh(g)}`
    const t = verb(g[0]!); return `${t.label} ${t.verb}, ${whenPh(g)}`
  }
  /** Views por dia do canal próprio, dos longos (D3): só com `extras`, só no formato longo e só para canal com vídeos. Concorrente: null. */
  const vpdProprio = (c: ObsChannel, f: Fmt): VpdCanal | null => (extras && c.own && f === 'long' && obs.videos.some(x => x.ch === c.id) ? extras.vpd.get(c.id) ?? SEM_LEITURA : null)
  /**
   * O número da coluna Views/dia de um canal: `abs` (absoluto) e `val` (na escala escolhida). O canal próprio com `extras` vem do diário, e o
   * por mil é valor ÷ (inscritos ÷ 1000), sem inscritos = null; o concorrente, e o canal próprio sem `extras`, vêm do motor como sempre.
   */
  const vpdOf = (c: ObsChannel, f: Fmt, S: CStats): { ev: VpdCanal | null; abs: number | null; val: number | null } => {
    const ev = vpdProprio(c, f)
    if (ev) return { ev, abs: ev.valor, val: ev.valor == null ? null : rel ? (c.subs != null && c.subs > 0 ? ev.valor / (c.subs / 1000) : null) : ev.valor }
    return { ev: null, abs: S.vpdMedian, val: S.vpdMedian == null ? null : rel ? S.perMilSubs : S.vpdMedian }
  }
  const syncPhrase = (c: ObsChannel) => c.sync.problemPhrase ?? null
  const viewsTxt = (c: ObsChannel, v: ObsVideo): ViewsText => {
    const S = stats(c.id, 'long')
    if (v.views != null) return { num: num(v.views), text: ` views${stale(c, S) ? ',' + stale(c, S) : ''}` }
    return { num: null, text: viewsMissingText(c, D.dmhm) }
  }
  const multVs = (m: MultiplierResult) => (m.method === 'mesmo dia de vida' ? 'mesmo dia de vida' : (m.band ?? '').replace(' dias', NB + 'd'))
  const methodText = (m: MultiplierResult) => (m.fallbackText ? cap(m.fallbackText) : 'Método: ' + m.method)
  const coworkOf = (c: ObsChannel) => `Leia o canal ${c.name}${c.handle ? ` (${c.handle})` : ''} via youtube_observatory: ${obs.link.canais({ channel: c.id })}. Compare ritmo, views/dia e trocas dos últimos 30 dias com os outros canais de ${c.niche ? NL(c.niche) : 'todos os nichos'}. Não afirme causa.`

  /* ---------------------------------------------------------------- own channels (canais.html:620-627) */
  const allOwns = obs.ownChannels() // R73: subscribers, largest first
  const many = allOwns.length > 1, T = ownTexts(many)
  // "o meu canal" de "Comparar" e da linha presa no pé: a regra única `escolherPrincipal` (a escolha do dono, ou o canal de publicação mais
  // recente; design D-C da 11c, no lugar da D16); sem ele não há com quem comparar
  const principalId = principalDoMotor(obs, p.lembrado)
  const principal = allOwns.find(o => o.id === principalId) ?? null
  const candidatosN = allOwns.filter(o => canalTemVideos(obs, o.id)).length

  /* ---------------------------------------------------------------- slots */
  const { used, limit, free } = obs.channelSlots(p.limit)
  const slots = {
    used, limit, free, text: `${used} de ${limit} canais`,
    fullText: free === 0 ? `Sem vagas: ${used} de ${limit} concorrentes. Remova um canal para adicionar outro.` : null,
    tip: `Até ${limit} concorrentes acompanhados; ${T.slot}. ${free ? (free === 1 ? 'Sobra 1 vaga.' : `Sobram ${free} vagas.`) : 'Sem vagas: para acompanhar outro, remova um.'}`,
    nearFull: free <= 5, unlockText: `Destravar mais ${p.unlockStep ?? 25} vagas`, unlockDone: `Mais ${p.unlockStep ?? 25} vagas disponíveis.`,
  }

  /* ---------------------------------------------------------------- rows */
  function syncCell(c: ObsChannel, S: CStats): SyncCell {
    const s = c.sync, covTitle = `Limite deste canal: ${c.video_limit} vídeos (máximo ${R.videoLimitMax})`
    // the manual round (syncCompetitorsNow) only takes channels whose state is ok
    const queued = !c.own && s.state === 'ok' ? { label: 'Na fila desta rodada', cov: s.last != null ? `última: ${agoN(s.last)}` : null, covTitle: absN(s.last) } : null
    const base = { state: s.state, labelTitle: null, cov: null, covTitle: null, msg: null, progress: null, canRetry: false, canRemove: false, queued }
    if (s.state === 'backfill' && s.backfill) return { ...base, label: 'Buscando vídeos', progress: { ...s.backfill }, cov: `${s.backfill.done} de ${s.backfill.total} vídeos buscados${s.added != null ? `, adicionado ${agoN(s.added)}` : ''}`, covTitle: absN(s.added) }
    if (s.state === 'backfill') return { ...base, label: 'Buscando vídeos', cov: s.added != null ? `adicionado ${agoN(s.added)}` : null, covTitle: absN(s.added) }
    if (s.state === 'atrasado') return { ...base, label: cap(s.problemPhrase ?? s.label ?? ''), labelTitle: s.last != null ? `Última sincronização: ${abs(s.last)}` : null, msg: s.msg, canRetry: true }
    if (s.state === 'erro') {
      // the engine phrase already says what a known error means; an unknown error text is shown as is
      const msg = s.msg && humanizeSyncError(s.msg) === s.msg ? s.msg : null
      return { ...base, label: cap(s.problemPhrase ?? s.label ?? ''), msg, canRemove: true }
    }
    return { ...base, label: s.last != null ? `Sincronizado ${agoN(s.last)}` : cap(s.label ?? ''), labelTitle: absN(s.last), cov: `${S.tracked} vídeos acompanhados`, covTitle }
  }
  function growthCell(c: ObsChannel, g: Growth | 'nao-carregou', oculto: boolean): GrowthCell {
    const na = (text: string, title: string, motivo: Extract<GrowthCell, { kind: 'na' }>['motivo'], extra: { fechaEm?: number | null; dias?: number | null } = {}): GrowthCell =>
      ({ kind: 'na', text, title, motivo, fechaEm: extra.fechaEm ?? null, dias: extra.dias ?? null })
    const sinal = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') // três vias: zero não ganha sinal
    if (g === 'nao-carregou') return na('não carregou', 'Não deu para carregar os registros de inscritos do seu canal. Recarregue a página.', 'nao-carregou')
    if (oculto) return na('não medido: oculto', 'O canal esconde a contagem de inscritos no YouTube.', 'oculto')
    if (g.pending) {
      if (g.diasDeRegistro == null) return na('sem registro', 'Sem registro de inscritos ainda.', 'sem-registro')
      if (g.fechaEm == null) return na('buraco na contagem', 'Faltam registros: não há duas contagens de inscritos com cerca de 30 dias de distância. A medida volta quando houver.', 'buraco')
      return na(g.pending.replace(/ \(.*\)/, ''), `Canal novo no observatório: precisa de 30 d de contagem de inscritos, ${g.pending}`, 'novo', { fechaEm: g.fechaEm, dias: g.diasDeRegistro })
    }
    // Retrato velho: concorrente parado pela `c.sync.state`; canal próprio pelo MESMO limite da seção Inscritos.
    const velhoProprio = c.own && g.to != null && retratoVelho(obs.NOW, g.to)
    const velhoConc = !c.own && c.sync.state !== 'ok' && !isBf(c)
    const atrasadoAte = (velhoProprio || velhoConc) && g.to != null ? g.to : null
    // Phil M-2: o retrato do próprio é diário (meio-dia fixo): só o dia, sem uma hora que ninguém mediu
    const until = atrasadoAte != null ? `, até ${c.own ? D.dm(atrasadoAte) : D.dmhm(atrasadoAte)}` : ''
    const base = { antes: g.fromSubs ?? null, depois: g.toSubs ?? null, de: g.from ?? null, ate: g.to ?? null, atrasadoAte }
    if (g.withinRounding) return { kind: 'flat', big: 'sem variação', cap: g.limiteArred > 0 ? `dentro do arredondamento (±${F.num(g.limiteArred).replace(/ (mil|mi)/g, NB + '$1')})` : 'mesmo número nas duas contagens', limite: g.limiteArred, ...base, abs: g.abs!, passo: g.roundingUnit }
    const absTxt = `${sinal(g.abs!)}${F.num(Math.abs(g.abs!))}`.replace(/ (mil|mi)/g, NB + '$1')
    // no computable percentage (previous snapshot with 0 subscribers, legacy rows): no percent, only the absolute
    if (g.pct == null) return na(`${absTxt} em 30${NB}d${until}`, 'Sem percentual: o canal não tinha inscritos na contagem anterior.', 'sem-percentual')
    return { kind: 'ok', big: `${sinal(g.pct)}${F.dec1(Math.abs(g.pct * 100))}%`, cap: `${absTxt} em 30${NB}d${until}`, ...base, abs: g.abs!, pct: g.pct }
  }
  /** Nome do formato nas frases e a unidade do ritmo. */
  const wordOf = (f: Fmt) => (f === 'long' ? 'longos' : 'Shorts')
  const oneOf = (f: Fmt) => (f === 'long' ? 'vídeo longo' : 'Short')
  /** O que falta ao canal neste formato, para a segunda medida de "Todos": sem vídeo algum, ou sem Shorts. Nunca zero. */
  const faltaShorts = (c: ObsChannel): { text: string; title: string } | null => {
    if (!canalTemVideos(obs, c.id)) return { text: 'sem vídeos', title: 'O canal não tem vídeos guardados.' }
    if (!obs.videos.some(v => v.ch === c.id && v.fmt === 'short')) return { text: 'sem Shorts', title: 'O canal não tem Shorts guardados.' }
    return null
  }
  const SEM_FORMATO_TIP = 'Estes vídeos ainda não têm a marca de Short confirmada pelo YouTube. Até a confirmação, entram nos números dos longos.'

  function cadenceCell(c: ObsChannel, f: Fmt, bf: boolean, empty: boolean, second: boolean): CadenceCell {
    const kl = obs.cadence(c.id, 'long'), ks = obs.cadence(c.id, 'short')
    if (bf) return { kind: 'na', text: 'Ritmo após a busca', title: kl.partialText ?? '' }
    if (second) {
      const falta = faltaShorts(c)
      if (falta) return { kind: 'na', text: falta.text, title: falta.title }
    }
    const k = f === 'long' ? kl : ks, other = f === 'long' ? ks : kl
    return {
      kind: 'ok', weeks: kl.weeks.map((w, i) => ({ long: w.n, short: ks.weeks[i]?.n ?? 0 })),
      label: `${kl.n} vídeos longos e ${ks.n} Shorts nas últimas 13 semanas`, pw: F.dec1(k.pw), unit: `${wordOf(f)}/sem`,
      // em "Todos" a outra medida mora na segunda linha da célula: a frase "e N Shorts/sem" seria a mesma coisa duas vezes
      sub: empty ? 'nenhum em 13 semanas' : !second && paradoDe(c) === 'nao_carregou' ? 'não carregou' : todos || paradoDe(c) === 'sim' || second ? null : other.pw ? `e ${F.dec1(other.pw)} ${wordOf(f === 'long' ? 'short' : 'long')}/sem` : `sem ${wordOf(f === 'long' ? 'short' : 'long')}`,
      paused: !second && !empty && paradoDe(c) === 'sim' && diasParado(c) != null ? `Parado: ${ultimaDoParado(c) != null ? `último vídeo em ${D.dm(ultimaDoParado(c)!)}, ` : ''}${nb(`há ${diasParado(c)} ${diasParado(c) === 1 ? 'dia' : 'dias'}`)}` : null,
    }
  }
  function vpdCell(c: ObsChannel, f: Fmt, S: CStats, bf: boolean, empty: boolean, second: boolean): VpdCell {
    const one = oneOf(f), o = vpdOf(c, f, S), v = o.val
    if (bf) return { kind: 'na', text: `1ª contagem ${D.dm(obs.NOW + obs.DAY)}`, title: `Primeira contagem diária de views amanhã, ${D.dm(obs.NOW + obs.DAY)}` }
    if (second) {
      const falta = faltaShorts(c)
      if (falta) return { kind: 'na', text: falta.text, title: falta.title, falta: true }
    }
    // the channel hides its subscriber count: per-thousand is undefined, point to the absolute scale instead of "nenhum acompanhado"
    if (rel && o.abs != null && v == null && c.subs == null) return { kind: 'na', text: 'Inscritos ocultos: veja em Absoluto.', title: 'O canal não informa os inscritos; veja a escala Absoluto.' }
    // o canal próprio mede 0 inscritos: o por mil não existe (o absoluto está na outra escala)
    if (o.ev && o.abs != null && v == null) return { kind: 'na', text: 'O canal ainda não tem inscritos.', title: 'Sem inscritos não há views por dia por mil inscritos; veja a escala Absoluto.' }
    // the own channel's videos are tracked but the observatory keeps no daily views for them: never "nenhum acompanhado"
    if (v == null && c.own && S.tracked > 0) {
      // com o dado lido, a célula diz o motivo da ausência (a mesma frase da posição); sem ele, a de sempre
      if (o.ev && extras) { const t = cap(motivoVpdTexto(o.ev.motivo ?? 'sem-diario', o.ev, extras.dm)) + '.'; return { kind: 'na', text: t, title: t } }
      // Shorts e a segunda linha de "Todos": com o dado lido, a medida do canal próprio é só dos longos, e a célula diz o mesmo que o bloco
      if (extras && f !== 'long') { const t = cap(VPD_SO_LONGOS) + '.'; return { kind: 'na', text: t, title: t } }
      return { kind: 'na', text: 'Sem views diárias do seu canal.', title: SEM_VPD_PROPRIO_DICA }
    }
    // tracked videos of this format but no per-day median yet: say what is really missing (the engine's own wording,
    // series.ts periodRate), never "nenhum acompanhado" with a title that contradicts it
    if (v == null && o.abs == null && videosOf(c.id).some(x => x.fmt === f && x.tracked)) return { kind: 'na', text: 'Aguardando o 2º registro diário.', title: `${S.tracked} vídeos acompanhados; a média por dia precisa de dois registros diários` }
    if (v == null) return { kind: 'na', text: `Nenhum ${one} acompanhado.`, title: `${S.tracked} vídeos acompanhados` }
    if (o.ev && extras) {
      // canal próprio: a base escrita é a janela do diário (D3), à vista na ressalva e inteira na dica
      const dias = o.ev.janela ? `, de ${extras.dm(o.ev.janela.de)} a ${extras.dm(o.ev.janela.ate)}` : ''
      const base = baseVpdTexto(o.ev, extras.dm)
      return { kind: 'ok', big: vpdAbs(v), abs: rel && o.abs != null ? vpdAbs(o.abs) : null, n: o.ev.n, weak: o.ev.n < R.weakBase, tail: dias + (empty ? `, nenhum longo novo em 90${NB}d` : stale(c, S) ? ',' + stale(c, S) : ''), ...(base ? { title: base } : {}) }
    }
    return { kind: 'ok', big: vpdAbs(v), abs: rel && S.vpdMedian != null ? vpdAbs(S.vpdMedian) : null, n: S.vpdN, weak: S.vpdN < R.weakBase, tail: empty ? `, nenhum longo novo em 90${NB}d` : stale(c, S) ? ',' + stale(c, S) : null }
  }
  function outCell(c: ObsChannel, f: Fmt, S: CStats, bf: boolean, empty: boolean, second: boolean): OutCell {
    const fmtName = wordOf(f), one = oneOf(f), o = S.bestOutlier
    if (bf) return { kind: 'na', text: 'Após a busca', weak: null, upnext: null }
    if (second) {
      const falta = faltaShorts(c)
      if (falta) return { kind: 'na', text: falta.text, weak: null, upnext: null, falta: true }
    }
    if (empty) return { kind: 'na', text: 'Nada para comparar sem vídeo longo recente.', weak: null, upnext: 'Planejar em Próximos' }
    if (!o) {
      const top = S.maxMultBelowMin
      return !top ? { kind: 'na', text: `Sem ${fmtName} em 90${NB}d.`, weak: null, upnext: null }
        : top.weak ? { kind: 'na', text: `Nenhum ${one} com ${R.outlierMin}× ou mais.`, weak: `Base fraca (${NEQ(top.n)}).`, upnext: null }
          : { kind: 'na', text: `Nenhum com ${R.outlierMin}×. Maior: ${top.label}.`, weak: null, upnext: null }
    }
    const m = o.mult, a = ageOf(o.video)
    return {
      kind: 'ok', title: `${m.label ?? ''}. ${methodText(m)}; sem contar este vídeo.`, videoTitle: o.video.title, thumb: thumbOf(o.video),
      mult: F.mult(m.value), tier: tier(m.value), vs: multVs(m), n: m.n, published: a.text, publishedTitle: a.title,
      count: `${S.outliers90} ${S.outliers90 === 1 ? 'outlier' : 'outliers'} no canal`,
    }
  }
  /**
   * O valor de cada coluna para ordenar. null = sem medida (nunca -1 nem -99): a linha vai para o fim em qualquer direção
   * e não recebe posição. O canal próprio não tem trocas aqui (ficam no A/B Lab): null, não 0.
   */
  const rp = p.retratosProprios ?? new Map<string, RetratosProprios>()
  // UM predicado de "oculto" para a célula, o `rowOf` e o `valoresOf`: próprio pelo que a seção Inscritos lê (MG20); concorrente pelo motor e pelos extras
  const ocultoDe = (c: ObsChannel): boolean => c.own
    ? (rp !== 'erro' && rp.get(c.id)?.oculto === true)
    : (c.subs == null || extrasDoCanal(c.id)?.subscribersHidden === true)
  const growthDe = (c: ObsChannel, S: CStats): Growth | 'nao-carregou' => {
    if (!c.own) return S.growth30
    if (rp === 'erro') return 'nao-carregou'
    const meu = rp.get(c.id)
    return crescimento30({ clock: D, fmt: F }, meu?.retratos ?? [], ocultoDe(c) ? null : (meu?.retratos.at(-1)?.subs ?? c.subs))
  }
  const valCache = new Map<string, Record<CanaisSort, number | null>>()
  const semShortsDe = (c: ObsChannel) => fmt === 'short' && faltaShorts(c) != null
  function valoresOf(c: ObsChannel): Record<CanaisSort, number | null> {
    const hit = valCache.get(c.id)
    if (hit) return hit
    const S = stats(c.id), bf = isBf(c), semShorts = semShortsDe(c)
    const v: Record<CanaisSort, number | null> = {
      active: semShorts || bf ? null : obs.cadence(c.id, fmt).pw,
      outliers: semShorts || bf ? null : S.outliers90,
      growth: (() => { const g = growthDe(c, S); return ocultoDe(c) || g === 'nao-carregou' || g.pending || g.abs == null ? null : g.withinRounding ? 0 : g.pct })(),
      direcao: (() => { const d = direcaoDe(c); return d.tipo === 'medido' ? d.pct : null })(),
      vpd: semShorts || bf ? null : vpdOf(c, fmt, S).val,
      swaps: bf || c.own ? null : trocas30(obs, c.id), // a mesma conta do cabeçalho do canal e da comparação: título e thumbnail
      subs: c.subs,
    }
    valCache.set(c.id, v)
    return v
  }
  /** Por que o canal não tem posição na ordenação atual; null quando tem posição (ou, num concorrente, quando só falta a ordenação ter posição). */
  function semMedidaOf(c: ObsChannel, S: CStats, valor: Record<CanaisSort, number | null>, pos: Posicao | null): MotivoSemMedida | null {
    if (valor[sort] == null) {
      return motivoSemValor({
        sort, porMil: rel, bf: isBf(c), own: c.own, semVideos: !canalTemVideos(obs, c.id), semShorts: semShortsDe(c),
        subsOcultos: c.subs == null, temMedianaAbsoluta: vpdOf(c, fmt, S).abs != null,
        aguarda2o: obs.videos.some(x => x.ch === c.id && x.fmt === fmt && x.tracked),
      })
    }
    if (pos || !c.own) return null
    return temPosicao(sort) ? 'sem-nicho' : 'ordenacao-sem-posicao'
  }

  /** A frase do motivo quando o canal próprio fica sem views por dia (só com `extras`; sem eles vale a de "sem-diario" em `motivoTexto`). */
  function semMedidaTextoOf(c: ObsChannel, S: CStats, m: MotivoSemMedida | null): string | null {
    if (m !== 'sem-views-dia-proprio' || !c.own || !extras) return null
    if (fmt !== 'long') return VPD_SO_LONGOS
    const o = vpdOf(c, fmt, S)
    if (o.ev == null) return null
    if (o.ev.valor != null) return 'o canal ainda não tem inscritos' // há valor e não há posição: só o por mil sem inscritos
    return motivoVpdTexto(o.ev.motivo ?? 'sem-diario', o.ev, extras.dm)
  }

  const semMedidaDe = (c: ObsChannel, S: CStats, valor: Record<CanaisSort, number | null>, pos: Posicao | null) => {
    const semMedida = semMedidaOf(c, S, valor, pos)
    return { semMedida, semMedidaTexto: semMedidaTextoOf(c, S, semMedida) }
  }

  /** A5 2ª leva T8: o texto da dica de cada coluna, montado dos números que a linha já tem (nenhuma leitura nova). */
  function dicasDe(a: {
    c: ObsChannel; S: CStats; S2: CStats | null; bf: boolean; empty: boolean; trocasG: ObsChange[] | undefined
    cells: CanaisRow['cells']; direcao: CelulaDeDirecao; direcaoNumeros: CanaisRow['direcaoNumeros']
  }): CanaisRow['dicas'] {
    const { c, S, S2, bf, empty, cells } = a
    const oculto = ocultoDe(c) || c.subs == null
    const kl = obs.cadence(c.id, 'long'), ks = obs.cadence(c.id, 'short')
    const ultimo = Math.max(kl.lastUpload ?? -Infinity, ks.lastUpload ?? -Infinity)
    const dicaCad = (cell: CadenceCell): string | null => cell.kind === 'na' ? cell.title : dicaRitmo({
      longos: kl.n, shorts: ks.n, ultimoHaDias: Number.isFinite(ultimo) ? Math.max(0, Math.floor((obs.NOW - ultimo) / obs.DAY)) : null, partialText: kl.partial ? kl.partialText : null,
    })
    const dicaVpd = (cell: VpdCell, SS: CStats, f: Fmt): string | null => {
      if (cell.kind === 'na') return cell.title
      if (c.own && cell.title) return cell.title // canal próprio com o diário: a base escrita da janela
      return dicaViewsDia({ mediana: SS.vpdMedian, n: SS.vpdN, desde: SS.vpdWindow, porMil: SS.perMilSubs, oculto: c.subs == null, fraco: cell.weak, formato: f === 'short' ? 'short' : 'long' }, escrita)
    }
    const dicaOut = (cell: OutCell, SS: CStats, f: Fmt, vazio: boolean): string | null => {
      if (cell.kind === 'ok') {
        const o = SS.bestOutlier
        if (!o || o.mult.base == null || o.mult.value == null) return cell.title
        return dicaOutliers({ melhor: { titulo: o.video.title, mult: o.mult.value, views: Math.round(o.mult.value * o.mult.base), esperado: o.mult.base }, nVideos: SS.vpdN, fraco: false, formato: f === 'short' ? 'short' : 'long' }, escrita)
      }
      if (bf || vazio || cell.falta) return null
      return dicaOutliers({ melhor: null, nVideos: SS.vpdN, fraco: cell.weak != null || SS.vpdN < R.weakBase, formato: f === 'short' ? 'short' : 'long' }, escrita)
    }
    const i0 = a.trocasG?.[0]
    const swap = c.own || bf ? null : dicaTrocas({
      ultima: i0 ? { tipo: (a.trocasG?.length ?? 0) > 1 ? 'ambos' : i0.type === 'title' ? 'title' : 'thumb', titulo: obs.video(i0.video)?.title ?? '', haDias: Math.max(0, Math.floor((obs.NOW - i0.at) / obs.DAY)), em: i0.at } : null,
    }, escrita)
    const s = c.sync
    const sync = s.state === 'ok'
      ? (s.last == null ? null : dicaSync({ estado: 'ok', ha: D.ago(s.last), nVideos: S.tracked, horarios: obs.SYNC.slots.map(h => String(h).padStart(2, '0') + 'h'), proprio: c.own ? T.sync : null }))
      : s.state === 'erro' ? dicaSync({ estado: 'erro', ha: s.errorSince != null ? D.ago(s.errorSince) : '', nVideos: S.tracked, horarios: [], proprio: null })
        : cells.sync.labelTitle
    return {
      subs: dicaInscritos({ subs: oculto ? null : c.subs, passo: passoDoYouTube(c.subs ?? 0) }, escrita),
      vpd: dicaVpd(cells.vpd, S, fmt),
      cadence: dicaCad(cells.cadence),
      out: dicaOut(cells.out, S, fmt, empty),
      swap, sync,
      growth: dicaCrescimento(cells.growth, escrita, c.own),
      direcao: dicaDirecao(a.direcao, a.direcaoNumeros, escrita),
      ...(S2 && cells.vpd2 ? { vpd2: dicaVpd(cells.vpd2, S2, 'short') } : {}),
      ...(S2 && cells.cadence2 ? { cadence2: dicaCad(cells.cadence2) } : {}),
      ...(S2 && cells.out2 ? { out2: dicaOut(cells.out2, S2, 'short', false) } : {}),
    }
  }

  function rowOf(c: ObsChannel): CanaisRow {
    const S = stats(c.id), bf = isBf(c), empty = ownLongEmpty(c) && fmt === 'long'
    const k = obs.cadence(c.id, fmt)
    const cadence = cadenceCell(c, fmt, bf, empty, false)
    const vpd = vpdCell(c, fmt, S, bf, empty, false)
    const out = outCell(c, fmt, S, bf, empty, false)
    // "Todos": a segunda medida é a dos Shorts, calculada como em Shorts; nada é somado nem misturado
    const S2 = todos ? stats(c.id, 'short') : null
    const cells2 = S2 ? { cadence2: cadenceCell(c, 'short', bf, false, true), vpd2: vpdCell(c, 'short', S2, bf, false, true), out2: outCell(c, 'short', S2, bf, false, true) } : {}
    const nulos = obs.videos.filter(x => x.ch === c.id && x.tracked && x.isShort == null).length
    const trocas = c.own ? [] : trocasDe30(obs, c.id), g = groupsOf(trocas, true)[0]
    const swap: SwapCell = c.own ? { kind: 'na', text: 'Suas trocas ficam no A/B Lab.' }
      : bf ? { kind: 'na', text: 'Trocas são detectadas a partir de agora.' }
        : { kind: 'ok', n: trocas.length, last: g ? groupText(g) : `nenhuma de título ou thumbnail em 30${NB}d`, lastTitle: g ? `${g.map(i => i.whenText).join('; ')} (São Paulo)` : null }
    // inscritos ocultos: o crescimento não é zero, é "não medido: oculto" (nunca um 0)
    const growth: GrowthCell = growthCell(c, growthDe(c, S), ocultoDe(c))
    const sync = syncCell(c, S)
    const direcao = direcaoDe(c)
    const direcaoNumeros = direcao.tipo === 'medido' ? { recente: num(direcao.ganhoRecente), anterior: num(direcao.ganhoAnterior) } : null
    const dicas = dicasDe({ c, S, S2, bf, empty, trocasG: g, cells: { cadence, vpd, out, swap, growth, sync, ...cells2 }, direcao, direcaoNumeros })
    const outN = obs.outliers({ channel: c.id, fmt, includeOwn: c.own }).count
    const valor = valoresOf(c), numero = numMap.get(c.id) ?? null, pos = temPosicao(sort) ? numero : null
    return {
      id: c.id, name: c.name, niche: c.niche, own: c.own, href: c.own ? (canalTemVideos(obs, c.id) ? ownChannelHref(c.id) : null) : obs.link.canal(c.id),
      semPagina: c.own && !canalTemVideos(obs, c.id) ? SEM_PAGINA_LINHA : null,
      comparar: !c.own && principal ? { href: obs.link.comparar(principal.id, c.id), label: candidatosN > 1 ? `Comparar ${c.name} com o meu canal (${principal.name})` : `Comparar ${c.name} com o meu canal` } : null,
      lang: c.own ? langChip(c.lang, many) : null, pw: F.dec1(k.pw), vpd: vpd.kind === 'ok' ? vpd.big : vpd.text,
      outliers: { n: outN, href: obs.link.outliers({ channel: c.id, fmt }) },
      changes: { n: c.own ? 0 : obs.changesIn({ channel: c.id }).length, href: obs.link.mudancas({ channel: c.id }) },
      growth: growth.kind === 'na' ? growth.text : growth.big, growthTitle: growth.kind === 'na' ? growth.title : growth.cap,
      sync: { label: sync.label, phrase: syncPhrase(c), state: c.sync.state },
      color: c.color, ini: c.ini, avatar: c.avatar ?? null, subs: c.subs == null || extrasDoCanal(c.id)?.subscribersHidden === true ? HIDDEN_ROW : subsTxt(c.subs), url: c.url, handle: c.handle, backfill: bf, paused: paradoDe(c), direcao, estado: estadoDe(c), direcaoNumeros, subsOculto: c.subs == null || extrasDoCanal(c.id)?.subscribersHidden === true,
      subsTip: c.subs == null ? 'Este canal esconde a contagem de inscritos no YouTube.'
        : c.subs < 1000 ? 'Abaixo de mil, o YouTube mostra o número exato.'
        : `O YouTube corta a contagem para 3 algarismos: ${stats(c.id, 'long').growth30.roundingText}.`,
      valor, numero, pos, ...semMedidaDe(c, S, valor, pos),
      dicas,
      cells: { cadence, vpd, out, swap, growth, sync, ...cells2 },
      semFormato: nulos ? { n: nulos, label: `formato não confirmado (${nulos})`, tip: SEM_FORMATO_TIP } : null,
      cowork: coworkOf(c),
      syncOneText: {
        start: `Sincronizando ${c.name}…`, ok: `${c.name} sincronizado`, okBody: 'Dados atualizados agora.', fail: `${c.name} não sincronizou`,
        failBody: c.sync.problemPhrase ? cap(c.sync.problemPhrase) + '.' : 'A sincronização não respondeu. Tente de novo em alguns minutos.',
        backfill: `${c.name} ainda está buscando vídeos; sincronize depois que a busca terminar.`,
      },
    }
  }

  const all = obs.channels
  const inNiche = (c: ObsChannel) => niche === 'todos' || c.niche === niche
  const comps = all.filter(c => !c.own && inNiche(c))
  // A5 E5a T5: o filtro de estado e o de direção SOMAM (E); "problemas" (em erro) continua valendo o mesmo de antes (retrato)
  const linhasDoNicho = all.filter(c => !c.own && inNiche(c)).map(c => ({ c, l: { proprio: false, estado: estadoDe(c), emErro: c.sync.state !== 'ok' } }))
  const direcaoPassa = (c: ObsChannel): boolean => {
    if (direcaoFiltro === 'todos') return true
    const d = direcaoDe(c)
    return direcaoFiltro === 'nao-medido' ? d.tipo === 'nao_medido' : d.tipo === 'medido' && d.simbolo === ({ sobe: 'sobe', estavel: 'estavel', desce: 'desce' } as const)[direcaoFiltro]
  }
  const visible = linhasDoNicho.filter(({ c, l }) => linhaNoFiltro(l, filter) && direcaoPassa(c)).map(x => x.c)
  // O conjunto da posição (D11, emenda 45): o nicho escolhido, próprios incluídos, ou todos os canais do site. Vem ANTES do
  // filtro "só com problema" e da busca: eles escondem linhas, nunca renumeram ninguém.
  const conjunto: Conjunto = niche === 'todos' ? { tipo: 'geral' } : { tipo: 'nicho', niche, label: nicheLabel }
  /**
   * O valor de um canal como a célula o mostra (só as ordenações com posição). Sai do valor, não da linha: os vizinhos são
   * os do conjunto inteiro, também os que o filtro "só com problema" esconde (a posição é a da lista inteira). É também a
   * chave do empate: quem se escreve igual divide a posição.
   */
  const valorTxt = (c: ObsChannel) => {
    const x = valoresOf(c)[sort]!
    return sort === 'subs' ? subsTxt(x) : vpdAbs(x)
  }
  /** A chave do empate: o valor como a tela o escreve. Quem se escreve igual divide a posição e fica em ordem alfabética. */
  const chaveDe = (c: ObsChannel, s: CanaisSort): string | undefined => {
    const x = valoresOf(c)[s]
    if (x == null) return undefined
    switch (s) {
      case 'subs': return subsTxt(x)
      case 'vpd': return vpdAbs(x)
      case 'growth': return x === 0 ? '0' : `${x > 0 ? '+' : '−'}${F.dec1(Math.abs(x * 100))}`
      case 'direcao': return String(x)
      case 'active': return F.dec1(x)
      case 'outliers': case 'swaps': return String(x)
      default: { const nunca: never = s; return nunca }
    }
  }
  // A5 2ª leva D3: uma posição canônica por ordenação, sobre o conjunto da lista (filtro e busca não renumeram)
  const numMap: Map<string, Posicao | null> = posicoes(all.filter(inNiche).map(c => ({ id: c.id, x: valoresOf(c)[sort], chave: chaveDe(c, sort) })))
  const sgn = dir === 'desc' ? 1 : -1
  const colador = new Intl.Collator('pt-BR')
  const aZ = (a: { name: string }, b: { name: string }) => colador.compare(a.name, b.name)
  // sem valor (null) vai para o fim em qualquer direção; mesma chave (empate) fica A–Z nos dois sentidos
  const byKey = (a: CanaisRow, b: CanaisRow) => {
    const x = a.valor[sort], y = b.valor[sort]
    if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1
    if (chaveDe(obs.channel(a.id)!, sort) === chaveDe(obs.channel(b.id)!, sort)) return aZ(a, b)
    return (y - x) * sgn
  }
  const compRows = visible.map(rowOf).sort(byKey)
  // own channels: in Todos, all of them; in a niche, the ones of that niche and the ones still without a niche
  const ownShown = allOwns.filter(c => niche === 'todos' || c.niche == null || c.niche === niche)
  const ownNone = ownShown.filter(c => c.niche == null).length, ownIn = ownShown.length - ownNone, ownHidden = allOwns.length - ownShown.length
  const ownParts: OwnGroupPart[] = [niche === 'todos'
    ? { num: String(allOwns.length), text: allOwns.length === 1 ? 'canal' : 'canais', warn: false }
    : ownIn ? { num: String(ownIn), text: `de ${nicheLabel}`, warn: false } : { num: null, text: `nenhum de ${nicheLabel}`, warn: false }]
  if (ownNone) ownParts.push({ num: null, text: `${ownNone} sem nicho: escolha o nicho na linha do canal`, warn: true })
  if (ownHidden) ownParts.push({ num: null, text: `${ownHidden} em outro nicho (${ownHidden === 1 ? 'aparece' : 'aparecem'} em Todos)`, warn: false })
  ownParts.push({ num: null, text: 'fora do limite de concorrentes', warn: false })
  const ownRows = ownShown.map(rowOf)

  /* ---------------------------------------------------------------- lista única (A3): os canais próprios na posição deles */
  const ordemDoMotor = new Map(all.map((c, i) => [c.id, i]))
  const baseLista = [...ownRows, ...compRows].sort((a, b) => ordemDoMotor.get(a.id)! - ordemDoMotor.get(b.id)!) // estável nos empates
  const ranked = baseLista.filter(r => r.valor[sort] != null).sort(byKey)
  // o fim da lista, sempre: concorrentes antes dos próprios, e dentro de cada grupo A–Z (A5 2ª leva D3)
  const unranked = baseLista.filter(r => r.valor[sort] == null).sort((a, b) => (a.own ? 1 : 0) - (b.own ? 1 : 0) || aZ(a, b))
  const emDaOrdem = emTexto(sort, fmt, rel)
  const ordem: CanaisView['ordem'] = {
    coluna: SORTNAME[sort] + (sort === 'vpd' ? (rel ? ' por mil inscritos' : ' em número absoluto') : ''),
    sentido: sentidoDaOrdem(sort, dir) ?? (dir === 'desc' ? 'maior primeiro' : 'menor primeiro'),
    empate: ranked.some(r => r.numero?.empate === true),
  }
  const faixaSemPosicao: CanaisView['faixaSemPosicao'] = temPosicao(sort) || !allOwns.length ? null
    : { linha1: ownRows.some(r => r.valor[sort] == null) ? semValorDoProprio(sort) : null, linha2: FAIXA_SEM_POSICAO }
  const list: CanaisLista = { ranked, unranked, divisor: unranked.length ? divisorDe(unranked.length, emDaOrdem, sort) : null }
  const fila = temPosicao(sort) ? all.filter(c => inNiche(c) && valoresOf(c)[sort] != null).sort((a, b) => (chaveDe(a, sort) === chaveDe(b, sort) ? aZ(a, b) : (valoresOf(b)[sort]! - valoresOf(a)[sort]!) * sgn)) : []
  const fraseDe = (r: CanaisRow): { frase: string; vizinhos: string | null } => {
    const c = obs.channel(r.id)!
    if (!r.pos) return { frase: r.semMedida ? motivoTexto(r.semMedida, r.semMedidaTexto ?? undefined) : '', vizinhos: null } // sem motivo seria erro do modelo (testado): nunca inventa um
    const i = fila.findIndex(x => x.id === r.id), ac = fila[i - 1], ab = fila[i + 1]
    return {
      frase: fraseDePosicao(r.pos, conjunto, emDaOrdem, valorTxt(c)),
      vizinhos: fraseVizinhos(ac ? { nome: ac.name, valor: valorTxt(ac) } : null, ab ? { nome: ab.name, valor: valorTxt(ab) } : null),
    }
  }
  const temVideos = (id: string) => canalTemVideos(obs, id)
  const ownBlock: OwnBlock | null = allOwns.length ? {
    titulo: many ? 'Seus canais' : 'Seu canal',
    linhas: ownRows.map((r): OwnBlockLinha => {
      if (!temVideos(r.id)) return { tipo: 'fina', id: r.id, texto: `${r.name}: sem vídeos, fora das posições por vídeo.` }
      const { frase, vizinhos } = fraseDe(r)
      return { tipo: 'cheia', id: r.id, name: r.name, avatar: r.avatar, ini: r.ini, color: r.color, pos: r.pos, frase, vizinhos, abrirHref: ownChannelHref(r.id) }
    }),
    partes: ownParts,
  } : null
  // a linha presa no pé fala do mesmo canal que o "Comparar" (a regra única), com a frase curta (sem os vizinhos)
  // o que o "de N" conta quando a lista mostra outra coisa: o canal próprio sem nicho (fora do conjunto de um nicho) e o filtro "só com problema"
  const semNichoNaLista = niche !== 'todos' ? ownRows.filter(r => r.niche == null) : []
  const posicaoNotas: string[] = []
  {
    if (semNichoNaLista.length) posicaoNotas.push(`A posição conta só os canais de ${nicheLabel}; ${semNichoNaLista.length === 1 ? 'o seu canal sem nicho aparece' : `os seus ${semNichoNaLista.length} canais sem nicho aparecem`} na lista, sem posição.`)
    if (filter === 'problemas') posicaoNotas.push(PROBLEMAS_NOTA)
    else if (filter !== 'todos' || direcaoFiltro !== 'todos') posicaoNotas.push('A posição é na lista inteira, não só entre os canais do filtro.')
  }
  // o principal pode estar fora da lista (filtro de nicho de outro canal): a linha presa então fala do canal próprio que a lista mostra, pela mesma regra
  // (I-11c-1); sem isso ela some, e "Ir até a linha" só pode apontar para uma linha que existe
  const peRow = principal
    ? ownRows.find(r => r.id === principal.id) ?? ownRows.find(r => r.id === escolherPrincipal(linhasDoMotor(obs).filter(l => ownRows.some(o => o.id === l.id)), p.lembrado, obs.NOW))
    : undefined
  const pe = peRow ? { canalId: peRow.id, texto: `seu canal · ${fraseDe(peRow).frase}` } : null
  const np = comps.filter(c => c.sync.state !== 'ok').length
  const resumo = (() => {
    const celulas = linhasDoNicho.map(({ c }) => direcaoDe(c))
    const dirRes = resumoDeDirecao(celulas)
    const contagem = contagemDosFiltros([...linhasDoNicho.map(x => x.l), ...ownRows.map(r => ({ proprio: true, estado: r.estado, emErro: false }))], hojeSP)
    const limpar = { texto: 'Ver todos os canais' }
    const carregou = dirRes.sobe !== null
    const casa = (chave: DirecaoFiltro, n: number | null, palavra: string): CasaDoResumo => {
      const pressed = direcaoFiltro === chave
      const datas = chave === 'nao-medido' ? celulas.flatMap(c => (c.tipo === 'nao_medido' && c.fechaEm ? [c.fechaEm] : [])).sort() : []
      const data = datas.length ? (datas.length === 1 || datas[0] === datas[datas.length - 1] ? `fecha em ${datas[0]!.slice(8, 10)}/${datas[0]!.slice(5, 7)}` : `fecham de ${datas[0]!.slice(8, 10)}/${datas[0]!.slice(5, 7)} a ${datas[datas.length - 1]!.slice(8, 10)}/${datas[datas.length - 1]!.slice(5, 7)}`) : null
      return { chave, n, palavra, pressed, data,
        leitor: n === null ? `${palavra}: não carregou` : `${n} ${palavra}${pressed ? ', filtro ligado' : ''}` }
    }
    const casas = [casa('sobe', dirRes.sobe, 'subindo'), casa('estavel', dirRes.estavel, 'sem mudança'), casa('desce', dirRes.desce, 'descendo'), casa('nao-medido', dirRes.naoMedido, 'não medido')]
    const q = contagem.queda
    const filtroDe = (chave: FiltroDeEstado, rotulo: string, n: number | null, porEstado = false): FiltroDoResumo => {
      const pressed = filter === chave
      const ainda = chave === 'em-queda' && q.tipo === 'ainda_nao_existe' ? q.existeEm : null
      const naoMedido = chave === 'em-queda' && q.tipo === 'nao_medido' ? FRASES[q.motivo]({}, 'canais').curta : null
      // falha parcial: o estado foi lido em `estadoMedidoEm` de `todos` canais, e o número vale só para eles ("0 de 9", nunca "0 medido")
      const base = porEstado && n !== null && contagem.estadoMedidoEm < contagem.todos ? { medidos: contagem.estadoMedidoEm, de: contagem.todos } : null
      return { chave, rotulo, n: ainda || naoMedido ? null : n, ainda, naoMedido, pressed, base,
        leitor: ainda ? `${rotulo}: não medido até ${ainda.slice(8, 10)}/${ainda.slice(5, 7)}` : naoMedido ? `${rotulo}: não medido` : n === null ? `${rotulo}: não carregou`
          : base ? `${rotulo}: ${n} de ${base.medidos} medidos (estado medido em ${base.medidos} de ${base.de} canais)` : `${rotulo}: ${n}` }
    }
    const filtros = [
      filtroDe('todos', 'Todos', contagem.todos), filtroDe('parados', 'Parados', contagem.parados, true),
      filtroDe('em-queda', 'Em queda', q.tipo === 'numero' ? q.emQueda : null),
      filtroDe('sairam', 'Saíram do YouTube', contagem.saiu, true), filtroDe('problemas', 'Com problema', contagem.emErro),
    ]
    const nomeFiltro: Partial<Record<FiltroDeEstado, string>> = { parados: 'parado', 'em-queda': 'em queda', sairam: 'saiu do YouTube', problemas: 'com problema na coleta', 'sem-videos': 'sem vídeos' }
    const nomeDirecao: Record<DirecaoFiltro, string> = { sobe: 'subindo', estavel: 'sem mudança', desce: 'descendo', 'nao-medido': 'com direção não medida' }
    const apoioZero: Partial<Record<FiltroDeEstado, string>> = {
      parados: `Todos os ${linhasDoNicho.length} canais publicaram dentro do prazo habitual de cada um.`,
      'em-queda': `Nenhum canal ficou com ▼ por ${MEASURE_QUEDA_JANELAS} períodos de ${MEASURE_JANELA_DIAS} dias seguidos.`,
      sairam: 'O YouTube respondeu por todos os canais nas duas últimas leituras.',
      problemas: 'Todos os canais sincronizaram na última rodada.',
    }
    let vazio: ResumoView['vazio'] = null
    if (visible.length === 0 && (filter !== 'todos' || direcaoFiltro !== 'todos')) {
      const tudoNaoCarregou = linhasDoNicho.length > 0 && linhasDoNicho.every(x => x.l.estado.pastilha === 'nao_carregou')
      const dirNome = direcaoFiltro === 'todos' ? null : nomeDirecao[direcaoFiltro]
      if (filter === 'em-queda' && q.tipo === 'ainda_nao_existe') {
        const dias = Math.round((Date.parse(q.existeEm + 'T00:00:00Z') - Date.parse(hojeSP + 'T00:00:00Z')) / 86_400_000)
        const dataBR = `${q.existeEm.slice(8, 10)}/${q.existeEm.slice(5, 7)}/${q.existeEm.slice(0, 4)}`
        vazio = {
          forma: 'ainda_nao_existe', titulo: 'Em queda ainda não pode ser medido.', limpar,
          acaoDescendo: dirRes.desce !== null,
          apoio: `Em queda pede ${MEASURE_QUEDA_JANELAS} períodos de ${MEASURE_JANELA_DIAS} dias seguidos, e a contagem de views mudou em 24/08/2026. Só a partir de ${dataBR} (daqui a ${dias} ${dias === 1 ? 'dia' : 'dias'}) dá para medir. ${dirRes.desce === null ? 'A direção dos canais não carregou agora.' : `Enquanto isso, ${dirRes.desce} ${dirRes.desce === 1 ? 'canal está descendo' : 'canais estão descendo'} neste período.`}`,
        }
      } else if (filter === 'em-queda' && q.tipo === 'nao_carregou') {
        vazio = { forma: 'nao_carregou', titulo: 'Em queda não carregou.', apoio: 'O estado dos canais não carregou agora. Recarregue a página em alguns minutos.', limpar }
      } else if (filter === 'em-queda' && q.tipo === 'nao_medido') {
        vazio = { forma: 'nao_medido', titulo: 'Em queda ainda não foi medido.', apoio: `${FRASES[q.motivo]({}, 'canais').longa}.`, limpar }
      } else if (tudoNaoCarregou) {
        vazio = { forma: 'nao_carregou', titulo: 'Não deu para contar: as medidas não carregaram.', apoio: 'Recarregue a página em alguns minutos.', limpar }
      } else if (filter !== 'todos' && dirNome === null) {
        vazio = { forma: 'zero', titulo: `Nenhum canal ${nomeFiltro[filter] ?? 'neste filtro'}`, apoio: apoioZero[filter] ?? '', limpar }
      } else if (filter === 'todos' && dirNome !== null) {
        vazio = { forma: 'zero', titulo: `Nenhum canal ${dirNome}`, apoio: direcaoFiltro === 'desce' ? `Nenhum dos ${linhasDoNicho.length} canais perdeu 10% ou mais de views neste período.` : '', limpar }
      } else {
        vazio = { forma: 'zero', titulo: `Nenhum canal ${nomeFiltro[filter] ?? ''} e ${dirNome ?? ''}.`.replace(/\s+/g, ' ').trim(), apoio: 'Nenhum canal tem as duas condições. Tire um dos filtros.', limpar }
      }
    }
    const semRetrato = linhasDoNicho.length > 0 && celulas.every(c => c.tipo === 'nao_medido' && c.motivo === 'sem_registro_recente')
      ? { desde: linhasDoNicho.map(({ c }) => extrasDoCanal(c.id)?.lastOkSyncedAt).filter((x): x is string => typeof x === 'string').map(x => spDateOf(Date.parse(x))).sort().pop() ?? null }
      : null
    const aviso = celulas.flatMap(c => (c.tipo === 'medido' && c.avisoDeContagem ? [c.avisoDeContagem.ate] : [])).sort().pop()
    return {
      // "sem retrato desde dd/mm" é a forma do plano (d:m7)
      frase: fraseDoResumo(dirRes, contagem) + (semRetrato ? (semRetrato.desde ? ` Sem dados novos desde ${semRetrato.desde.slice(8, 10)}/${semRetrato.desde.slice(5, 7)}.` : ' Sem dados recentes.') : ''),
      carregou, casas, filtros, avisoDeContagem: aviso ? { ate: aviso } : null, contagem, direcao: dirRes, semRetrato, vazio,
    } satisfies ResumoView
  })()
  // F4: competitors with no niche are invisible in a niche tab; say how many and point at the niche editor (same exit as Insights R78)
  const unniched = niche !== 'todos' ? all.filter(c => !c.own && c.niche == null).length : 0
  const nicheLink = unniched ? { text: unniched === 1 ? 'defina o nicho dele' : 'defina o nicho deles', href: obs.link.canais({ nicheEditor: 1, fmt: filtro }) } : null
  const emptyFirst = `Nenhum ${ownRows.length ? 'concorrente' : 'canal'}${niche !== 'todos' ? ` em ${nicheLabel}` : ''}.`
  const emptyText = filter === 'problemas'
    ? `Nenhum canal com problema de sincronização${niche !== 'todos' ? ` em ${nicheLabel}` : ''}.`
    : nicheLink ? `${emptyFirst} Há ${F.plural(unniched, 'concorrente', 'concorrentes')} sem nicho: ${nicheLink.text}.`
      : `${emptyFirst} Para acompanhar um canal novo, use Adicionar canal.`
  const emptyLink = filter === 'problemas' ? null : nicheLink
  const firstOwn = allOwns[0]
  const window = (firstOwn ? stats(firstOwn.id).vpdWindow : null) ?? `desde ${obs.SERIES_START_LABEL}`
  const nextSync = obs.SYNC.next

  /* ---------------------------------------------------------------- drawer */
  const dc = p.channel ? obs.channel(p.channel) ?? null : null
  // requisito 9: an explicit ?niche= of another niche closes the drawer; a link from another tab (niche only persisted)
  // opens it as before, and a channel without a niche opens under any filter
  const drawerDropped = !!dc && p.nicheExplicit === true && niche !== 'todos' && dc.niche != null && dc.niche !== niche
  const drawer = dc && !drawerDropped ? drawerOf(dc) : null

  function drawerOf(c: ObsChannel): DrawerView {
    const bf = isBf(c), empty = ownLongEmpty(c)
    const S = stats(c.id), SL = stats(c.id, 'long'), st = stale(c, SL)
    const back = `?channel=${encodeURIComponent(c.id)}`
    const hist = (id: string) => obs.link.historico(id, { from: 'canais', back })
    const cov = bf && c.sync.backfill ? `Buscando: ${c.sync.backfill.done} de ${c.sync.backfill.total} vídeos`
      : `Acompanhando ${S.tracked} vídeos (limite deste canal: ${c.video_limit}; máximo ${R.videoLimitMax})${c.own ? '' : `, com views diárias desde ${obs.SERIES_START_LABEL}`}${st}`
    const phrase = c.sync.problemPhrase
    const syncLbl = phrase && !bf ? cap(phrase) : cap(c.sync.label ?? c.sync.state)
    const syncSub = phrase && !bf ? '' : phrase ? cap(phrase) : bf ? (c.sync.added != null ? `adicionado ${D.ago(c.sync.added)}` : '') : c.sync.last != null ? D.ago(c.sync.last) : ''
    const syncStat = { label: 'Sincronização', labelTitle: null, value: syncLbl, sub: nb(syncSub), subTitle: absN(bf ? c.sync.added : c.sync.last), subWeak: false }
    const kl = obs.cadence(c.id, 'long'), ks = obs.cadence(c.id, 'short')
    let statsV: DrawerView['stats']
    if (bf) {
      statsV = [
        { label: `Ritmo, 13${NB}sem`, labelTitle: null, value: '—', sub: 'quando a busca terminar', subTitle: null, subWeak: false },
        { label: 'Views/dia', labelTitle: null, value: '—', sub: `primeira contagem diária amanhã, ${D.dm(obs.NOW + obs.DAY)}`, subTitle: null, subWeak: false },
        { label: `Crescimento, 30${NB}d`, labelTitle: null, value: '—', sub: S.growth30.pending ?? '', subTitle: null, subWeak: false },
        syncStat,
      ]
    } else {
      const vAbs = S.vpdMedian != null ? vpdAbs(S.vpdMedian) : '—', vRel = S.perMilSubs != null ? vpdAbs(S.perMilSubs) : '—', g = S.growth30
      const until = c.sync.state !== 'ok' && g.to != null ? ', até ' + D.dmhm(g.to) : ''
      statsV = [
        { label: `Ritmo, 13${NB}sem`, labelTitle: null, value: `${F.dec1(kl.pw)} + ${F.dec1(ks.pw)}`,
          sub: paradoDe(c) === 'sim' ? `Parado: último vídeo ${diasParado(c) == null ? 'há muito tempo' : nb(`há ${diasParado(c)} ${diasParado(c) === 1 ? 'dia' : 'dias'}`)}` : paradoDe(c) === 'nao_carregou' ? 'não carregou' : 'longos + Shorts por semana', subTitle: null, subWeak: paradoDe(c) === 'sim', ...(paradoDe(c) === 'nao_carregou' ? { subErro: true } : {}) },
        { label: `Views/dia, ${fmt === 'long' ? 'longos' : 'Shorts'}`, labelTitle: null, value: rel ? vRel : vAbs,
          sub: S.vpdMedian == null ? (c.own ? 'sem views diárias do seu canal' : videosOf(c.id).some(x => x.fmt === fmt && x.tracked) ? 'Aguardando o 2º registro diário.' : `sem vídeos desde ${obs.SERIES_START_LABEL}`) : `${rel ? `por mil inscritos (${vAbs}/dia)` : `mediana (${vRel} por mil insc.)`}, ${NEQ(S.vpdN)}, ${S.vpdWindow}${st}`, subTitle: null, subWeak: false },
        g.pending
          ? { label: `Crescimento, 30${NB}d`, labelTitle: null, value: '—', sub: g.pending, subTitle: null, subWeak: false }
          : { label: `Crescimento, 30${NB}d`, labelTitle: null, value: g.withinRounding ? `≈${NB}0` : g.pct == null ? '—' : `${g.pct > 0 ? '+' : '−'}${F.dec1(Math.abs(g.pct * 100))}%`,
            sub: `${g.withinRounding ? (g.text ?? '').replace(/^≈ 0 /, '') : g.text ?? ''}${until}`, subTitle: g.text, subWeak: false },
        { label: `Engajamento, ${fmt === 'long' ? 'longos' : 'Shorts'}`, labelTitle: '(curtidas + comentários) ÷ views, por vídeo de até 90 dias',
          value: S.engagement.median != null ? F.dec1(S.engagement.median * 100) + '%' : '—',
          sub: S.engagement.median != null ? `mediana, ${NEQ(S.engagement.n)}, ${S.engagement.window}` : empty && fmt === 'long' ? 'nenhum vídeo longo nos últimos 90 dias' : S.engagement.label, subTitle: null, subWeak: false },
        syncStat,
      ]
    }

    /* trocas */
    const list = bf || c.own ? [] : ch30(c), gs = groupsOf(list)
    const seen = new Map<string, string>()
    const cards: SwapCard[] = gs.map(items => {
      const v = obs.video(items[0]!.video)!, vc = obs.channel(v.ch)!
      const tS = items.find(s => s.type === 'title'), thS = items.find(s => s.type === 'thumb'), dS = items.find(s => s.type === 'desc')
      const multi = items.length > 1
      const heads = multi
        ? items.map(i => { const t = verb(i); return { strong: `${t.label} ${t.verb}`, when: whenPh([i]), whenTitle: `${D.dmhm(i.at)} (São Paulo)` } })
        : [{ strong: `${verb(items[0]!).label} ${verb(items[0]!).verb}`, when: whenPh(items), whenTitle: `${D.dmhm(items[0]!.at)} (São Paulo)` }]
      const art = (x: unknown): Thumb | null => {
        const o = x as { key?: string } | null
        const ver = o?.key ? v.thumbs.find(t => t.key === o.key) : undefined
        return ver?.blobUrl ? { src: ver.blobUrl, text: null } : { src: null, text: 'imagem não arquivada' }
      }
      const eff = obs.effect(items[0]!.id)
      let sameNote: string | null = null
      if (eff?.numbersFlat) { const prev = seen.get(eff.numbersFlat); if (prev) sameNote = `Mesmos números da troca de ${prev}: as duas usam os mesmos dias de registro.`; else seen.set(eff.numbersFlat, D.dm(items[0]!.at)) }
      return {
        id: items[0]!.id, heads, multi, whenTail: items.map(x => x.whenText).join('; '), views: viewsTxt(vc, v), title: v.title,
        desc: dS ? (dS.hasText ? { hasText: true as const, chip: dS.diff?.label ?? '', href: obs.link.mudancas({ video: v.id, type: 'desc' }) }
          : { hasText: false as const, text: `A descrição mudou. Antes de ${obs.SERIES_START_LABEL} só registramos que mudou, sem o texto.` }) : null,
        ba: tS || thS ? {
          before: { thumb: thS ? art(thS.before) : null, title: tS ? String(tS.before) : null },
          after: { thumb: thS ? art(thS.after) : null, title: tS ? String(tS.after) : null },
        } : null,
        thumbNote: thS ? `Horário da thumbnail detectado pela mudança do arquivo da imagem.${thS.revertTo ? ' Voltou a uma versão anterior: sinal de Testar e comparar (teste A/B do YouTube).' : ''}` : null,
        precNote: tS && tS.prec === '1d' ? `Antes de ${obs.SERIES_START_LABEL} a sincronização era diária às ${obs.SYNC.dailyBefore.replace(':00', 'h')}: a troca de título tem janela de 1 dia.` : null,
        effect: effView(obs, eff), sameNote, histHref: hist(v.id), ytUrl: v.url,
      }
    })
    const swapNote = bf ? `${c.sync.added != null ? `Canal adicionado ${D.ago(c.sync.added)}. ` : ''}Trocas são detectadas comparando versões entre sincronizações, então ainda não há o que comparar.${nextSync != null ? ` A primeira detecção possível é na sincronização das ${D.hm(nextSync)}.` : ''}`
      : c.own ? 'Suas trocas de título e thumbnail ficam no A/B Lab.'
        : !gs.length ? `Nenhuma troca de título, thumbnail ou descrição nos últimos 30 dias.${c.sync.state === 'erro' ? (c.sync.errorSince ?? c.sync.last) != null ? ` Desde ${D.dmhm((c.sync.errorSince ?? c.sync.last)!)} a sincronização falha, então trocas posteriores a ${c.sync.last != null ? D.dmhm(c.sync.last) : 'essa data'} não seriam vistas.` : ' A sincronização deste canal nunca deu certo, então trocas não seriam vistas.' : ''}` : null
    const swapsLink: LinkN | null = list.length ? { n: list.length, key: `changes:${c.id}`, href: obs.link.mudancas({ channel: c.id }), text: list.length === 1 ? 'Ver a troca em Mudanças' : `Ver as ${list.length} trocas em Mudanças` } : null

    /* outliers */
    const oL = bf || (c.own && empty) ? null : outs(c, 'long'), oS = bf ? null : outs(c, 'short')
    const cL = oL?.count ?? 0, cS = oS?.count ?? 0
    const sections: DrawerView['outliers']['sections'] = bf || (c.own && empty) ? [] : (['long', 'short'] as const).map(f => {
      const r = f === 'long' ? oL! : oS!
      const rows: OutRow[] = r.items.map(x => {
        const m = x.mult, vv = x.video, a = ageOf(vv)
        return { id: vv.id, thumb: thumbOf(vv), title: vv.title, mult: m.label ?? F.mult(m.value), tier: tier(m.value), meta: `${x.phase.label}. ${methodText(m)}; sem contar este vídeo.`, phaseTitle: x.phase.why, published: a.text, publishedTitle: a.title, views: viewsTxt(c, vv) }
      })
      const top = (obs.channelStats(c.id, f)).maxMultBelowMin
      return {
        fmt: f, title: f === 'long' ? 'Vídeos longos' : 'Shorts', rows,
        link: r.count ? { n: r.count, key: `outliers:${c.id}:${f}`, href: obs.link.outliers({ channel: c.id, fmt: f }), text: r.count === 1 ? (f === 'long' ? 'Ver o vídeo longo em Outliers' : 'Ver o Short em Outliers') : (f === 'long' ? `Ver os ${r.count} vídeos longos em Outliers` : `Ver os ${r.count} Shorts em Outliers`) } : null,
        note: r.count ? null : !top ? `O canal não publicou ${f === 'long' ? 'vídeos longos' : 'Shorts'} em 90${NB}d.` : top.weak ? `Nenhum com ${R.outlierMin}× ou mais. Base fraca (${NEQ(top.n)}).` : `Nenhum com ${R.outlierMin}× ou mais em 90${NB}d. Maior: ${top.label}.`,
      }
    })
    const outNote = bf && c.sync.backfill ? `Sem base de comparação ainda: a busca tem ${c.sync.backfill.done} de ${c.sync.backfill.total} vídeos e nenhuma contagem diária de views.`
      : c.own && empty ? `${ownEmptyText(c)} Sem vídeo longo recente, não há o que comparar.` : null

    /* vídeos */
    const rec = bf ? [] : videosOf(c.id).filter(x => x.fmt === fmt && x.tracked && !(c.own && empty && fmt === 'long' && x.ageDays <= 90)).slice(0, 5)
    const vids: VidRow[] = rec.map(x => {
      const m = x.mult, a = ageOf(x)
      const isOut = !!m && m.value != null && m.value >= R.outlierMin && !m.weak
      const relV = m && m.value != null && x.ageDays <= 90 ? { text: isOut ? `${F.mult(m.value)} (outlier)` : `${F.mult(m.value)} a mediana`, tier: isOut ? tier(m.value) : '' as Tier, outlier: isOut } : null
      const vp = x.vpd7 != null ? { num: num(x.vpd7), text: `views/dia, 7${NB}d` }
        : { num: null, text: x.ageDays < 1 ? 'menos de 1 dia no ar, sem média' : c.sync.state === 'erro' ? `sem média: sincronização com erro${sinceN(c.sync.errorSince ?? c.sync.last)}` : c.sync.state === 'atrasado' ? `sem média: sincronização atrasada${sinceN(c.sync.last)}` : c.own ? 'sem views diárias do seu canal' : `${x.ageDays}${NB}d no ar, média sai com 7${NB}d` }
      return { id: x.id, thumb: thumbOf(x), title: x.title, published: a.text, publishedTitle: a.title, views: viewsTxt(c, x), rel: relV, vp, histHref: hist(x.id), ytUrl: x.url }
    })
    const fNameV = fmt === 'long' ? 'vídeos longos' : 'Shorts'
    const covTxt = bf && c.sync.backfill ? `${c.sync.backfill.done} de ${c.sync.backfill.total} vídeos buscados` : `${S.tracked} vídeos acompanhados`

    /* vídeos fixados: every format, newest first (the pin is per video, not per format) */
    const pins = c.own || bf ? null : videosOf(c.id).filter(x => x.pinned === true).sort((a, b) => b.pub - a.pub)
    const pinnedV: DrawerView['videos']['pinned'] = pins == null ? null : {
      title: 'Vídeos fixados', count: `${c.pinnedCount ?? pins.length} de ${R.pinLimit}`,
      intro: `Um vídeo fixado continua com gráfico de views e conferência a cada ${obs.SYNC.cadenceHours}${NB}h, mesmo fora dos ${c.video_limit} mais recentes. O limite é de ${R.pinLimit} por canal.`,
      empty: pins.length ? null : `Nenhum vídeo fixado em ${c.name}. Para fixar, use “Fixar vídeo” no histórico do vídeo ou no cartão dele em Mudanças.`,
      rows: pins.flatMap(x => { const pin = pinViewOf(obs, x); return pin ? [{ id: x.id, thumb: thumbOf(x), title: x.title, histHref: hist(x.id), published: ageOf(x).text, where: `${x.tracked ? 'entre os' : 'fora dos'} ${c.video_limit} mais recentes`, pin }] : [] }),
    }
    const tab: DrawerTab = p.tab === 'videos' || p.tab === 'outliers' ? p.tab : 'trocas'
    return {
      id: c.id, tab, own: c.own, backfill: bf, name: c.name, color: c.color, ini: c.ini, avatar: c.avatar ?? null, niche: c.niche, lang: c.own ? langChip(c.lang, many) : null, handle: c.handle, url: c.url,
      subsText: c.subs == null ? 'inscritos ocultos pelo canal' : `${subsTxt(c.subs)} inscritos, arredondado pelo YouTube a 3 algarismos`, cov, stats: statsV,
      swaps: {
        count: list.length,
        intro: `Contadas por evento. Desde ${obs.SERIES_START_LABEL} a sincronização roda a cada ${obs.SYNC.cadenceHours}${NB}h (antes, diária às ${obs.SYNC.dailyBefore}): título e descrição têm a janela entre duas sincronizações; thumbnail tem o minuto.`,
        note: swapNote, cards, link: swapsLink,
      },
      outliers: {
        tabN: cL && cS ? `${F.plural(cL, 'longo', 'longos')} · ${F.plural(cS, 'Short', 'Shorts')}` : String(cL || cS),
        tabTitle: `${F.plural(cL, 'longo', 'longos')} e ${F.plural(cS, 'Short', 'Shorts')}`,
        intro: 'Views do vídeo contra a mediana dos outros vídeos do canal na mesma idade, sem contar o próprio vídeo. Longos e Shorts separados.',
        note: outNote, sections,
      },
      videos: {
        title: `${fmt === 'long' ? 'Vídeos longos' : 'Shorts'} mais recentes`, intro: `${c.own ? '' : 'Média de views/dia nos últimos 7 dias. '}Lista completa: ${covTxt}.`,
        preNote: c.own && empty && fmt === 'long' ? ownEmptyText(c) : null, upnext: c.own && empty && fmt === 'long' ? 'Planejar o próximo vídeo longo em Próximos' : null,
        pinned: pinnedV,
        rows: vids, note: rec.length ? null : bf && c.sync.backfill ? `Buscando: ${c.sync.backfill.done} de ${c.sync.backfill.total} vídeos. A lista aparece quando a busca terminar.` : `Nenhum ${fNameV} acompanhado.`,
      },
    }
  }

  const t = R.tiers
  return {
    ...forjaOf(obs, niche, drawer),
    list, conjunto, conjuntoAviso: conjunto.tipo === 'geral' ? CONJUNTO_AVISO : null, buscaNota: BUSCA_NOTA, posicaoNota: posicaoNotas.length ? posicaoNotas.join(' ') : null, pe,
    slots, scale, fmt: filtro, fmtNaUrl: fmtLido != null, layout, sort, dir,
    fmtNota: filtro === 'todos' ? 'Longos e Shorts lado a lado, sem mediana única (views de Short e de longo não se comparam); ordem pelos longos.'
      : filtro === 'shorts' ? 'Só Shorts; quem não publica Shorts fica no fim da lista.' : null,
    fmtCab: todos ? { dois: 'longos em cima, Shorts embaixo', ordenado: 'ordenado pelos longos' } : null,
    ordem, faixaSemPosicao,
    sortNote: `Ordenado por ${ordem.coluna}, ${ordem.sentido}${todos && (sort === 'vpd' || sort === 'active' || sort === 'outliers') ? '; ordenado pelos longos' : ''}`,
    vpdUnit: rel ? `por mil inscritos, mediana ${window}` : `mediana dos vídeos, ${window}`,
    own: { many, block: ownBlock },
    compararColuna: principal != null,
    drawer, drawerDropped, filter, resumo, addOpen: p.add === '1', nicheEditorOpen: p.nicheEditor === '1',
    niche, nicheLabel,
    problems: { n: np, filterHref: obs.link.canais({ filter: 'problemas', fmt: filtro }), clearHref: obs.link.canais({ fmt: filtro }) },
    emptyText, emptyLink,
    legend: { mid: `${t.mid}–${t.high}×`, high: `${t.high}–${t.top}×`, top: `${t.top}×+` },
    add: {
      cap: `${used} de ${limit} concorrentes acompanhados (${T.count}): ${free === 0 ? 'nenhuma vaga. Remova um canal para adicionar outro' : free === 1 ? 'sobra 1 vaga' : `sobram ${free} vagas`}.`,
      when: `A busca dos vídeos começa ao adicionar, até o limite escolhido${nextSync != null ? `; o que faltar continua na sincronização das ${D.hm(nextSync)}` : ''}. A contagem diária de views começa no dia seguinte; inscritos precisam de 30 dias para o crescimento.`,
      // the tab's niche, else the first of the site's list
      defaultNiche: niche === 'todos' ? nicheOpts[0]?.id ?? '' : niche, limitMax: R.videoLimitMax, defaultLimit: 50,
      niches: nicheOpts.map(o => ({ id: o.id, label: o.label })),
    },
    niches: nicheOpts,
    syncbar: (() => {
      const comp = all.filter(c => !c.own), inRound = comp.filter(c => c.sync.state === 'ok').length, out = comp.filter(isBf).map(c => c.name)
      return {
        text: `Sincronização em andamento: ${F.plural(inRound, 'concorrente', 'concorrentes')} na rodada${out.length ? `; fora da rodada: ${out.join(', ')} (ainda buscando vídeos)` : ''}. O resultado de cada canal aparece quando a rodada termina.`,
        meta: `${T.sync} O canal em coleta continua a própria coleta.`,
      }
    })(),
    nicheRows: all.filter(c => !c.own).map(c => ({ id: c.id, name: c.name, niche: c.niche }))
      .sort((a, b) => tabIdx(a.niche) - tabIdx(b.niche) || a.name.localeCompare(b.name, 'pt-BR')),
    syncTip: `Cada canal acompanha os vídeos mais recentes até o limite definido para ele (até ${R.videoLimitMax}). Todos os vídeos acompanhados têm views diárias desde ${obs.SERIES_START_LABEL}. Sincronização automática às ${obs.SYNC.slots.map(h => String(h).padStart(2, '0') + 'h').join(', ').replace(/, (\d\dh)$/, ' e $1')}.`,
  }
}

/* ------------------------------------------------------------------ forja (canais.html headerForja / forjaBar / forjaState) */
const RUNNING = ['na fila', 'trabalhando', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia']
function forjaOf(obs: Observatory, niche: NicheScope, drawer: DrawerView | null): Pick<CanaisView, 'forja' | 'forjaBar' | 'drawerForja'> {
  const D = obs.date, type = 'resumo-trocas' as const
  const forja = buildForjaView(obs, { screen: 'canais', niche })
  const lines = forja.status?.lines ?? []
  const forjaBar = niche === 'todos' && lines.length > 1 ? { lines: lines.join(' · '), text: forja.card.statusText ?? '' } : null
  if (!drawer || drawer.own || !drawer.niche) return { forja, forjaBar, drawerForja: null }
  const NL = (x: Niche) => obs.nicheLabel(x)
  const n = drawer.niche, NLn = NL(n)
  const fv = niche === 'todos' ? forja : buildForjaView(obs, { screen: 'canais', niche: n })
  const sc = obs.forja.session.current(niche === 'todos' ? 'todos' : n, { type })
  const q = sc.empty ? null : sc.requests.find(x => x.niche === n) ?? null
  const pv = obs.forja.preview(type, n), prev = obs.forja.latest(type, n)
  const outs = pv.channelsOut, out = outs.find(x => x.id === drawer.id)
  const label = prev ? 'Pedir nova leitura à forja' : 'Pedir leitura à forja'
  const head = 'Resumo das trocas de ' + NLn + ', o nicho inteiro, não só deste canal'
  let chip: string | null = null, stateText: string | null = null, readingHref: string | null = null
  const split: Array<{ text: string; me: boolean }> = []
  if (q) {
    const pre = q.createdAt >= obs.NOW - 6e4 && q.createdAt <= obs.NOW ? 'Seu pedido foi enviado agora. ' : ''
    stateText = pre + sc.statusText
    if (q.state === 'publicado') { const rid = q.readingId ?? obs.forja.latest(type, n)?.id ?? null; readingHref = rid ? obs.link.mudancas({ reading: rid }) : null }
    if (sc.requests.length > 1 && sc.statusLines) for (const l of sc.statusLines) split.push({ text: l, me: l.startsWith(NLn + ':') })
    else chip = (sc.statusLines?.find(l => l.startsWith(NLn + ':')) ?? (q.statusLabel ?? sc.statusLabel ?? q.state)).replace(/^[^:]+:\s*/, '')
  }
  const outTxt = outs.length ? ' Ficam de fora: ' + outs.map(x => (obs.channel(x.id)?.name ?? x.id) + ': ' + x.reason.replace(/^.*fica fora: /, '')).join('; ') + '.' : ''
  let why = pv.text + '; este canal entra.' + outTxt + (prev ? ' Última leitura: ' + D.dmhm(prev.generatedAt) + '.' : '')
  let button = { label, disabled: false, title: 'Resumo das trocas de ' + NLn + ', o nicho inteiro' }
  let free: CanaisDrawerForja['free'] = null
  if (!fv.capable) { button = { ...button, disabled: true }; why = fv.incapableText! }
  else if (out) { button = { label, disabled: true, title: 'Resumo das trocas de ' + NLn + ': ' + out.reason + '. O pedido do nicho continua valendo para os outros canais.' }; why = out.reason + '.' }
  else if (q && RUNNING.includes(q.state)) {
    button = { ...button, label: 'Pedido em andamento', disabled: true }
    const fr = niche === 'todos' ? (forja.ask?.niches ?? []).filter(x => x !== n) : []
    if (fr.length) { const L = joinLabels(fr.map(NL)); why += ' O pedido de ' + NLn + ' está em andamento; ' + L + (fr.length > 1 ? ' estão livres.' : ' está livre.'); free = { label: 'Pedir leitura de ' + L, niches: fr } }
  } else if (!obs.forja.novidade(type, n).pode) {
    // a leitura já usa o dado mais recente: só se pede de novo quando houver dado novo (forja/novidade.ts), a mesma função do servidor e das abas,
    // com ou sem pedido na janela do dia (o pedido ativo já saiu antes pelo ramo RUNNING)
    button = { ...button, disabled: true }
    why += ' ' + semNovidadeText('de ' + NLn)
  }
  return { forja, forjaBar, drawerForja: { niche: n, head, lines: split, chip, stateText, readingHref, why, button, free } }
}
