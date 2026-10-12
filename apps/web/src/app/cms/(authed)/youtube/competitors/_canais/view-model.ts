/**
 * View model of the Canais screen (port of canais.html cells/syncCell/growthCell/openDrawer/swapCard/effHTML).
 * Pure: every number, date and sentence comes from the engine (Observatory). The component only lays it out.
 */
import { pinViewOf, type PinView } from '../_chrome/pin-view'
import { viewsMissingText } from '../_chrome/views-text'
import type { Observatory } from '@/lib/youtube/observatorio'
import { joinLabels, type NicheScope } from '@/lib/youtube/observatorio/niche'
import type { Fmt, Niche, ObsChannel, ObsVideo, SyncState } from '@/lib/youtube/observatorio/types'
import type { OutlierItem } from '@/lib/youtube/observatorio/outliers'
import type { ObsChange } from '@/lib/youtube/observatorio/changes'
import type { MultiplierResult } from '@/lib/youtube/observatorio/multiplier'
import { humanizeSyncError, type ChannelStats } from '@/lib/youtube/observatorio/channels'
import { buildForjaView, type ForjaView } from '../_chrome/forja-view-model'
import { langChip, ownChannelHref, ownTexts, type LangChip } from '../_chrome/own-channels'
import { principalDoMotor } from '../_chrome/own-menu'
import { posicoes, type Conjunto, type Posicao } from '@/lib/youtube/observatorio/posicao'
import {
  BUSCA_NOTA, CONJUNTO_AVISO, PROBLEMAS_NOTA, divisorDe, emTexto, fraseDePosicao, fraseVizinhos, motivoSemValor, motivoTexto, temPosicao,
  type MotivoSemMedida,
} from './posicao-model'
import { effView } from '../_chrome/effect-view'
import { contaComoTroca, trocas30, trocasDe30, vpdText } from '../_canal/numeros'
import { FMT_PADRAO, fmtDaOrdem, parseCanaisFmt, type CanaisFmt } from './formato'

const NB = ' '
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s)
const nb = (s: string) => s.replace(/(\d) (h|d|dias?|min)\b/g, '$1' + NB + '$2').replace(/há /g, 'há' + NB)
const NEQ = (n: number) => `n${NB}=${NB}${n}`

type CStats = ChannelStats
interface Growth { abs: number | null; pct: number | null; from?: number; to?: number; pending?: string; roundingText: string; withinRounding: boolean | null; text: string | null }

export type CanaisSort = 'active' | 'vpd' | 'outliers' | 'swaps' | 'growth' | 'subs'
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
  | { kind: 'ok'; big: string; abs: string | null; n: number; weak: boolean; tail: string | null }
export type OutCell =
  | { kind: 'na'; text: string; weak: string | null; upnext: string | null; falta?: true }
  | { kind: 'ok'; title: string; videoTitle: string; thumb: Thumb; mult: string; tier: Tier; vs: string; n: number; published: string; publishedTitle: string; count: string }
export type SwapCell = { kind: 'na'; text: string } | { kind: 'ok'; n: number; last: string; lastTitle: string | null }
export type GrowthCell =
  | { kind: 'na'; text: string; title: string }
  | { kind: 'flat'; big: string; cap: string }
  | { kind: 'ok'; up: boolean; big: string; cap: string; title: string }
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
  /** A página do canal para um concorrente; null para canal próprio, que continua abrindo o painel lateral. */
  href: string | null
  /** "Comparar" com o canal próprio principal (`escolherPrincipal`); null em canal próprio e quando o site não tem canal próprio com vídeos. `label` é o nome acessível. */
  comparar: { href: string; label: string } | null
  /** Language mark of an own channel; null for competitors and when the site has a single own channel. */
  lang: LangChip | null
  color: string; ini: string; avatar: string | null; subs: string; subsTip: string; url: string; handle: string; backfill: boolean; paused: boolean
  /** O valor de cada coluna para ordenar neste formato. null = sem medida: a linha vai para o fim, em qualquer direção; nunca um número de mentira. */
  valor: Record<CanaisSort, number | null>
  /** A posição na ordenação atual, no conjunto da lista (`CanaisView.conjunto`); null fora de POSICIONADAS, sem valor ou sem conjunto. */
  pos: Posicao | null
  /** Por que não tem posição: sem valor na coluna ordenada, ou (só canal próprio) sem nicho num nicho escolhido, ou ordenação sem posição. */
  semMedida: MotivoSemMedida | null
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
  stats: Array<{ label: string; labelTitle: string | null; value: string; sub: string; subTitle: string | null; subWeak: boolean }>
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
  filter: 'todos' | 'problemas'; addOpen: boolean; nicheEditorOpen: boolean
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

export interface CanaisParams {
  niche: NicheScope; limit: number; channel?: string; tab?: string; add?: string; filter?: string; scale?: string; fmt?: string; layout?: string
  sort?: string; dir?: string; nicheEditor?: string; unlockStep?: number
  /** ?niche= is in the URL (a click on the niche bar), not only the persisted preference. */
  nicheExplicit?: boolean
  /** A escolha do dono para "o meu canal" (cookie `obs-meu-canal`, lido no servidor); `escolherPrincipal` decide com ela. Ausente = sem escolha. */
  lembrado?: string | null
}

const pick = <T extends string>(v: string | undefined, ok: readonly T[], d: T): T => (v && (ok as readonly string[]).includes(v) ? (v as T) : d)
const SORTNAME: Record<CanaisSort, string> = { active: 'Ritmo', vpd: 'Views/dia', outliers: 'Outliers', swaps: 'Trocas', growth: 'Crescimento', subs: 'Inscritos' }
/** The colour of a niche the owner created, as the CSS variables the chrome's niche bar already uses (plus the subtle fills). */
export interface NicheVars { dark: string; light: string; darkSubtle: string; lightSubtle: string }
export interface NicheOption { id: Niche; label: string; color: NicheVars | null }
/** rgba() literal (never color-mix: it renders transparent in some browsers). */
const rgba = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return Number.isFinite(n) ? `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})` : 'transparent' }
export const nicheVars = (c: { dark: string; light: string }): NicheVars => ({ dark: c.dark, light: c.light, darkSubtle: rgba(c.dark, 0.13), lightSubtle: rgba(c.light, 0.08) })
export function nicheOptions(obs: Observatory): NicheOption[] {
  return obs.niches.map(n => ({ id: n.id, label: n.label, color: n.builtin ? null : nicheVars(n.color) }))
}

export function buildCanaisView(obs: Observatory, p: CanaisParams): CanaisView {
  const D = obs.date, F = obs.fmt, R = obs.RULES
  // `filtro` é o que a pessoa escolheu (Todos, Longos, Shorts); `fmt` é o formato que ordena e posiciona (Todos ordena pelos longos)
  const fmtLido = parseCanaisFmt(p.fmt)
  const filtro: CanaisFmt = fmtLido ?? FMT_PADRAO
  const todos = filtro === 'todos'
  const fmt: Fmt = fmtDaOrdem(filtro)
  const scale = p.scale === 'abs' ? 'abs' : 'per-mil'
  const rel = scale === 'per-mil'
  const layout = pick(p.layout, ['table', 'cards'] as const, 'table')
  const sort = pick(p.sort, ['active', 'vpd', 'outliers', 'swaps', 'growth', 'subs'] as const, DEFAULT_SORT)
  const dir = pick(p.dir, ['asc', 'desc'] as const, 'desc')
  const filter = p.filter === 'problemas' ? 'problemas' : 'todos'
  const niche = p.niche
  const NL = (n: Niche) => obs.nicheLabel(n)
  const nicheLabel = niche === 'todos' ? 'Todos' : NL(niche)
  const nicheOpts = nicheOptions(obs), tabIdx = (n: Niche | null) => { const i = n == null ? -1 : nicheOpts.findIndex(o => o.id === n); return i < 0 ? nicheOpts.length : i }
  const stats = (id: string, f: Fmt = fmt) => obs.channelStats(id, f)
  const num = (n: number | null) => F.num(n).replace(/ (mil|mi)$/, NB + '$1')
  /** Views por dia em número absoluto, no formato de todas as telas (spec 19.3, emenda 37): abaixo de 10 uma casa, "menos de 0,1", "0" exato. */
  const vpdAbs = (v: number) => (vpdText(v, F.num) ?? F.num(v)).replace(/ (mil|mi)$/, NB + '$1')
  const subsTxt = (n: number) => F.subs(n).replace(/ (mil|mi)$/, NB + '$1')
  const HIDDEN_ROW = 'Inscritos ocultos'
  const abs = (t: number) => `${D.dmhm(t)} (São Paulo)`
  /** sync instants may be null (a channel that never synced OK): no date is invented */
  const absN = (t: number | null) => (t == null ? null : abs(t))
  const sinceN = (t: number | null) => (t == null ? '' : ' desde ' + D.dmhm(t))
  const agoN = (t: number | null) => (t == null ? '' : nb(D.ago(t)))
  const tier = (x: number | null): Tier => obs.tierOf(x) ?? ''
  const thumbOf = (v: ObsVideo): Thumb => ({ src: v.ytId ? `https://i.ytimg.com/vi/${encodeURIComponent(v.ytId)}/mqdefault.jpg` : null, text: null })
  const ageOf = (v: ObsVideo) => ({ text: nb(F.age(v)), title: abs(v.pub) })
  const stale = (c: ObsChannel, S: CStats) =>
    // Task 23 ruling (brief test + CONVENCOES:267, confirmed in 35b fix round 1): a "parado" channel's views also say
    // "até o registro diário"; canais.html shows it only for atrasado/erro — allow-listed in canais.spec
    (c.sync.state === 'atrasado' || c.sync.state === 'erro' || (c.activity.state === 'parado' && c.sync.state !== 'backfill')) && S.growth30.to != null
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
  const vpdVal = (S: CStats) => (S.vpdMedian == null ? null : rel ? S.perMilSubs : S.vpdMedian)
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
  const candidatosN = allOwns.filter(o => obs.videos.some(v => v.ch === o.id)).length

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
  function growthCell(c: ObsChannel, g: Growth): GrowthCell {
    if (g.pending) return { kind: 'na', text: g.pending.replace(/ \(.*\)/, ''), title: `Canal novo no observatório: precisa de 30 d de contagem de inscritos, ${g.pending}` }
    const until = c.sync.state !== 'ok' && !isBf(c) && g.to != null ? `, até ${D.dmhm(g.to)}` : ''
    if (g.withinRounding) return { kind: 'flat', big: `≈${NB}0`, cap: `${(g.text ?? '').replace(/^≈ 0 /, '')}, 30${NB}d` }
    const capText = `${(g.text ?? '').replace(/ (mil|mi)/g, NB + '$1')} em 30${NB}d${until}`
    // no computable percentage (previous snapshot with 0 subscribers, legacy rows): no percent and no arrow, only the absolute
    if (g.pct == null) return { kind: 'na', text: capText, title: 'Sem percentual: o canal não tinha inscritos na contagem anterior.' }
    const up = g.pct > 0
    return { kind: 'ok', up, big: `${up ? '+' : '−'}${F.dec1(Math.abs(g.pct * 100))}%`, cap: capText, title: 'Calculado sobre inscritos arredondados a 3 algarismos' }
  }
  /** Nome do formato nas frases e a unidade do ritmo. */
  const wordOf = (f: Fmt) => (f === 'long' ? 'longos' : 'Shorts')
  const oneOf = (f: Fmt) => (f === 'long' ? 'vídeo longo' : 'Short')
  /** O que falta ao canal neste formato, para a segunda medida de "Todos": sem vídeo algum, ou sem Shorts. Nunca zero. */
  const faltaShorts = (c: ObsChannel): { text: string; title: string } | null => {
    if (!obs.videos.some(v => v.ch === c.id)) return { text: 'sem vídeos', title: 'O canal não tem vídeos guardados.' }
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
      sub: empty ? 'nenhum em 13 semanas' : todos || c.activity.state === 'parado' || second ? null : other.pw ? `e ${F.dec1(other.pw)} ${wordOf(f === 'long' ? 'short' : 'long')}/sem` : `sem ${wordOf(f === 'long' ? 'short' : 'long')}`,
      paused: !second && !empty && c.activity.state === 'parado' && kl.lastUpload != null ? `Parado: último vídeo em ${D.dm(kl.lastUpload)}, ${nb(kl.lastUploadAgo ?? '')}` : null,
    }
  }
  function vpdCell(c: ObsChannel, f: Fmt, S: CStats, bf: boolean, empty: boolean, second: boolean): VpdCell {
    const one = oneOf(f), v = vpdVal(S)
    if (bf) return { kind: 'na', text: `1ª contagem ${D.dm(obs.NOW + obs.DAY)}`, title: `Primeira contagem diária de views amanhã, ${D.dm(obs.NOW + obs.DAY)}` }
    if (second) {
      const falta = faltaShorts(c)
      if (falta) return { kind: 'na', text: falta.text, title: falta.title, falta: true }
    }
    // the channel hides its subscriber count: per-thousand is undefined, point to the absolute scale instead of "nenhum acompanhado"
    if (rel && S.vpdMedian != null && S.perMilSubs == null && c.subs == null) return { kind: 'na', text: 'Inscritos ocultos: veja em Absoluto.', title: 'O canal não informa os inscritos; veja a escala Absoluto.' }
    // the own channel's videos are tracked but the observatory keeps no daily views for them: never "nenhum acompanhado"
    if (v == null && c.own && S.tracked > 0) return { kind: 'na', text: 'Sem views diárias do seu canal.', title: 'O observatório guarda a contagem diária de views só dos concorrentes.' }
    // tracked videos of this format but no per-day median yet: say what is really missing (the engine's own wording,
    // series.ts periodRate), never "nenhum acompanhado" with a title that contradicts it
    if (v == null && S.vpdMedian == null && videosOf(c.id).some(x => x.fmt === f && x.tracked)) return { kind: 'na', text: 'Aguardando o 2º registro diário.', title: `${S.tracked} vídeos acompanhados; a média por dia precisa de dois registros diários` }
    if (v == null) return { kind: 'na', text: `Nenhum ${one} acompanhado.`, title: `${S.tracked} vídeos acompanhados` }
    return { kind: 'ok', big: rel ? F.dec1(v) : vpdAbs(v), abs: rel && S.vpdMedian != null ? vpdAbs(S.vpdMedian) : null, n: S.vpdN, weak: S.vpdN < R.weakBase, tail: empty ? `, nenhum longo novo em 90${NB}d` : stale(c, S) ? ',' + stale(c, S) : null }
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
      return !top ? { kind: 'na', text: `Não publicou ${fmtName} em 90${NB}d.`, weak: null, upnext: null }
        : top.weak ? { kind: 'na', text: `Nenhum ${one} com ${R.outlierMin}× ou mais.`, weak: `Base fraca (${NEQ(top.n)}).`, upnext: null }
          : { kind: 'na', text: `Nenhum ${one} com ${R.outlierMin}× ou mais em 90${NB}d. Maior: ${top.label}.`, weak: null, upnext: null }
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
  const valCache = new Map<string, Record<CanaisSort, number | null>>()
  const semShortsDe = (c: ObsChannel) => fmt === 'short' && faltaShorts(c) != null
  function valoresOf(c: ObsChannel): Record<CanaisSort, number | null> {
    const hit = valCache.get(c.id)
    if (hit) return hit
    const S = stats(c.id), bf = isBf(c), semShorts = semShortsDe(c)
    const v: Record<CanaisSort, number | null> = {
      active: semShorts || bf ? null : obs.cadence(c.id, fmt).pw,
      outliers: semShorts || bf ? null : S.outliers90,
      growth: S.growth30.pending ? null : S.growth30.pct,
      vpd: semShorts || bf ? null : vpdVal(S),
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
        sort, porMil: rel, bf: isBf(c), own: c.own, semVideos: !obs.videos.some(x => x.ch === c.id), semShorts: semShortsDe(c),
        subsOcultos: c.subs == null, temMedianaAbsoluta: S.vpdMedian != null,
        aguarda2o: obs.videos.some(x => x.ch === c.id && x.fmt === fmt && x.tracked),
      })
    }
    if (pos || !c.own) return null
    return temPosicao(sort) ? 'sem-nicho' : 'ordenacao-sem-posicao'
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
        : { kind: 'ok', n: trocas.length, last: g ? groupText(g) : `nenhuma em 30${NB}d`, lastTitle: g ? `${g.map(i => i.whenText).join('; ')} (São Paulo)` : null }
    const growth = growthCell(c, S.growth30)
    const sync = syncCell(c, S)
    const outN = obs.outliers({ channel: c.id, fmt, includeOwn: c.own }).count
    const valor = valoresOf(c), pos = posMap.get(c.id) ?? null
    return {
      id: c.id, name: c.name, niche: c.niche, own: c.own, href: c.own ? null : obs.link.canal(c.id),
      comparar: !c.own && principal ? { href: obs.link.comparar(principal.id, c.id), label: candidatosN > 1 ? `Comparar ${c.name} com o meu canal (${principal.name})` : `Comparar ${c.name} com o meu canal` } : null,
      lang: c.own ? langChip(c.lang, many) : null, pw: F.dec1(k.pw), vpd: vpd.kind === 'ok' ? vpd.big : vpd.text,
      outliers: { n: outN, href: obs.link.outliers({ channel: c.id, fmt }) },
      changes: { n: c.own ? 0 : obs.changesIn({ channel: c.id }).length, href: obs.link.mudancas({ channel: c.id }) },
      growth: growth.kind === 'na' ? growth.text : growth.big, growthTitle: growth.kind === 'ok' ? growth.title : growth.kind === 'na' ? growth.title : growth.cap,
      sync: { label: sync.label, phrase: syncPhrase(c), state: c.sync.state },
      color: c.color, ini: c.ini, avatar: c.avatar ?? null, subs: c.subs == null ? HIDDEN_ROW : subsTxt(c.subs), url: c.url, handle: c.handle, backfill: bf, paused: c.activity.state === 'parado',
      subsTip: c.subs == null ? 'Este canal esconde a contagem de inscritos no YouTube.'
        : `O YouTube informa inscritos arredondados a 3 algarismos. ${subsTxt(c.subs)} pode estar ${stats(c.id, 'long').growth30.roundingText} do número real.`,
      valor, pos, semMedida: semMedidaOf(c, S, valor, pos),
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
  const visible = comps.filter(c => filter !== 'problemas' || c.sync.state !== 'ok')
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
    return sort === 'subs' ? subsTxt(x) : rel ? F.dec1(x) : vpdAbs(x)
  }
  const posMap: Map<string, Posicao | null> = temPosicao(sort)
    ? posicoes(all.filter(inNiche).map(c => { const x = valoresOf(c)[sort]; return { id: c.id, x, chave: x == null ? undefined : valorTxt(c) } }))
    : new Map()
  const sgn = dir === 'desc' ? 1 : -1
  // sem valor (null) vai para o fim em qualquer direção; a ordem entre os que têm valor é a de sempre
  const byKey = (a: CanaisRow, b: CanaisRow) => {
    const x = a.valor[sort], y = b.valor[sort]
    if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1
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
  // o fim da lista, sempre: concorrentes antes dos próprios, e dentro de cada grupo os maiores inscritos primeiro
  const subsDesc = (a: CanaisRow, b: CanaisRow) => (a.valor.subs == null || b.valor.subs == null ? (a.valor.subs == null ? 1 : 0) - (b.valor.subs == null ? 1 : 0) : b.valor.subs - a.valor.subs)
  const unranked = baseLista.filter(r => r.valor[sort] == null).sort((a, b) => (a.own ? 1 : 0) - (b.own ? 1 : 0) || subsDesc(a, b))
  const emDaOrdem = emTexto(sort, fmt, rel)
  const list: CanaisLista = { ranked, unranked, divisor: unranked.length ? divisorDe(unranked.length, emDaOrdem) : null }
  const fila = temPosicao(sort) ? all.filter(c => inNiche(c) && valoresOf(c)[sort] != null).sort((a, b) => (valoresOf(b)[sort]! - valoresOf(a)[sort]!) * sgn) : []
  const fraseDe = (r: CanaisRow): { frase: string; vizinhos: string | null } => {
    const c = obs.channel(r.id)!
    if (!r.pos) return { frase: r.semMedida ? motivoTexto(r.semMedida) : '', vizinhos: null } // sem motivo seria erro do modelo (testado): nunca inventa um
    const i = fila.findIndex(x => x.id === r.id), ac = fila[i - 1], ab = fila[i + 1]
    return {
      frase: fraseDePosicao(r.pos, conjunto, emDaOrdem, valorTxt(c)),
      vizinhos: fraseVizinhos(ac ? { nome: ac.name, valor: valorTxt(ac) } : null, ab ? { nome: ab.name, valor: valorTxt(ab) } : null),
    }
  }
  const temVideos = (id: string) => obs.videos.some(x => x.ch === id)
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
  if (temPosicao(sort)) {
    if (semNichoNaLista.length) posicaoNotas.push(`A posição conta só os canais de ${nicheLabel}; ${semNichoNaLista.length === 1 ? 'o seu canal sem nicho aparece' : `os seus ${semNichoNaLista.length} canais sem nicho aparecem`} na lista, sem posição.`)
    if (filter === 'problemas') posicaoNotas.push(PROBLEMAS_NOTA)
  }
  const peRow = principal ? ownRows.find(r => r.id === principal.id) : undefined
  const pe = peRow ? { canalId: peRow.id, texto: `seu canal · ${fraseDe(peRow).frase}` } : null
  const np = comps.filter(c => c.sync.state !== 'ok').length
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
      const vAbs = S.vpdMedian != null ? vpdAbs(S.vpdMedian) : '—', vRel = S.perMilSubs != null ? F.dec1(S.perMilSubs) : '—', g = S.growth30
      const until = c.sync.state !== 'ok' && g.to != null ? ', até ' + D.dmhm(g.to) : ''
      statsV = [
        { label: `Ritmo, 13${NB}sem`, labelTitle: null, value: `${F.dec1(kl.pw)} + ${F.dec1(ks.pw)}`,
          sub: c.activity.state === 'parado' ? `Parado: último vídeo ${nb(kl.lastUploadAgo ?? '')}` : 'longos + Shorts por semana', subTitle: null, subWeak: c.activity.state === 'parado' },
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
    sortNote: `Ordenado por ${SORTNAME[sort]}${sort === 'vpd' ? (rel ? ' por mil inscritos' : ' em número absoluto') : ''}, ${dir === 'desc' ? 'maior' : 'menor'} primeiro${todos && (sort === 'vpd' || sort === 'active' || sort === 'outliers') ? '; ordenado pelos longos' : ''}`,
    vpdUnit: rel ? `por mil inscritos, mediana ${window}` : `mediana dos vídeos, ${window}`,
    own: { many, block: ownBlock },
    compararColuna: principal != null,
    drawer, drawerDropped, filter, addOpen: p.add === '1', nicheEditorOpen: p.nicheEditor === '1',
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
  } else if (q && q.state === 'publicado') {
    button = { ...button, disabled: true }
    const qn = sc.quota.byNiche?.[n]
    why += ' ' + NLn + ': ' + (qn ? qn.text : sc.quota.text) + '.'
  }
  return { forja, forjaBar, drawerForja: { niche: n, head, lines: split, chip, stateText, readingHref, why, button, free } }
}
