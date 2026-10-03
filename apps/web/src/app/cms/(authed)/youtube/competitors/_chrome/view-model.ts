/**
 * View model of the Observatório chrome (port of chrome.js headHtml/navHtml/freshPopHtml/coworkText/defaultSync).
 * Pure: every number, date and sentence comes from the engine (Observatory); nothing here reads the clock.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import type { NicheScope } from '@/lib/youtube/observatorio/niche'
import type { ObsChannel } from '@/lib/youtube/observatorio/types'

export type ChromeTab = 'canais' | 'mudancas' | 'outliers' | 'insights'
const TABS: readonly ChromeTab[] = ['canais', 'mudancas', 'outliers', 'insights']
const TAB_NAME: Record<ChromeTab, string> = { canais: 'Canais', mudancas: 'Mudanças', outliers: 'Outliers', insights: 'Insights' }
const NICHE_KEYS: readonly NicheScope[] = ['todos', 'viagem', 'ia']

export const CHROME_TITLE = 'Observatório de Competidores' as const
export const CHROME_SUBTITLE = 'O que os canais que você acompanha mudaram, o que está estourando agora e o que a forja leu disso, para decidir o próximo vídeo, título e thumbnail.'

export interface ChromeFreshRow { id: string; name: string; niche: 'viagem' | 'ia' | null; nicheLabel: string | null; situation: string; last: string | null; bad: boolean }
export interface ChromeView {
  title: 'Observatório de Competidores'; subtitle: string; tzLabel: 'Horários em São Paulo'
  niche: NicheScope; nicheLabel: string; nicheColor: { dark: string; light: string } | null
  tabs: Array<{ key: ChromeTab; label: string; href: string; count: number | null; title: string; current: boolean }>
  niches: Array<{ key: NicheScope; label: string; count: number; pressed: boolean; color: { dark: string; light: string } | null }>
  fresh: {
    channelsInNiche: number; channelsTotal: number; syncText: string; syncTitle: string
    /** "14 canais" or "8 canais em Viagem"; totalText = " · 14 no total" with a niche. */
    channelsText: string; totalText: string | null
    /** Competitors queued by a manual round: only the ones whose state is ok (the others are not touched). */
    inRound: number
    problems: Array<{ id: string; name: string; phrase: string }>; problemsText: string | null
    /** Compact form ("3" or "2/3") and the per-label breakdown for title=. */
    problemsShort: string | null; problemsTitle: string | null
    rows: ChromeFreshRow[]; popoverSub: string; problemsHref: string
  }
  addHref: string; nicheEditorHref: string; cowork: string
  forja: null // P3: no forja segment; Task 35 fills it
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s)
export const nicheLabelOf = (obs: Observatory, n: NicheScope): string => (n === 'todos' ? 'Todos' : obs.NICHES[n].label)
const colorOf = (obs: Observatory, n: NicheScope) => (n === 'todos' ? null : { dark: obs.NICHES[n].color.dark, light: obs.NICHES[n].color.light })

export function buildChromeView(obs: Observatory, o: { tab: ChromeTab; niche: NicheScope }): ChromeView {
  const { niche } = o, F = obs.fmt, D = obs.date
  const counts = obs.tabCounts(niche)
  const countOf: Record<ChromeTab, number | null> = { canais: counts.canais, mudancas: counts.mud, outliers: counts.out, insights: null }
  const titleOf: Record<ChromeTab, string> = {
    canais: obs.TAB_TITLES.canais(counts.canais), mudancas: obs.TAB_TITLES.mud(counts.mud), outliers: obs.TAB_TITLES.out(counts.out),
    insights: 'Leituras publicadas pela forja',
  }
  // Object links (CONVENCOES F4): the niche is persisted server-side, so the tab hrefs never carry it.
  const hrefOf: Record<ChromeTab, string> = { canais: obs.link.canais(), mudancas: obs.link.mudancas(), outliers: obs.link.outliers(), insights: obs.link.insights() }
  const tabs = TABS.map(k => ({ key: k, label: TAB_NAME[k], href: hrefOf[k], count: countOf[k], title: cap(titleOf[k]), current: k === o.tab }))

  const competitors = obs.channels.filter(c => !c.own)
  const bad = competitors.filter(c => c.sync.state !== 'ok'), good = competitors.filter(c => c.sync.state === 'ok')
  const inNiche = (c: ObsChannel) => niche === 'todos' || c.niche === niche
  const phrase = (c: ObsChannel) => c.sync.problemPhrase ?? c.sync.label ?? ''
  const nl = nicheLabelOf(obs, niche)
  const kIn = bad.filter(inNiche).length
  const problemsText = !bad.length ? null
    : niche === 'todos' ? F.plural(bad.length, 'canal com problema', 'canais com problema')
      : `${kIn} com problema em ${nl} · ${bad.length} no total`
  const byLabel = [...new Set(bad.map(c => c.sync.label ?? ''))].map(l => `${bad.filter(c => (c.sync.label ?? '') === l).length} ${l}`).join(', ')
  // The engine's dates (clock of the dataset): "hoje HH:MM" for today, "DD/MM HH:MM" otherwise; null = never synced.
  const lastText = (ts: number | null) => (ts == null ? null : D.dm(ts) === D.dm(obs.NOW) ? 'hoje ' + D.hm(ts) : D.dmhm(ts))
  const row = (c: ObsChannel, isBad: boolean): ChromeFreshRow => { const last: number | null = c.sync.last; return {
    id: c.id, name: c.name, niche: c.niche, nicheLabel: c.niche ? obs.NICHES[c.niche].label : null,
    situation: isBad ? phrase(c) : (c.sync.label ?? ''),
    // M5: on a problem row the engine phrase already carries the date (except while fetching videos)
    last: isBad && c.sync.state !== 'backfill' ? null : lastText(last),
    bad: isBad,
  } }
  const next = obs.SYNC.nextText
  return {
    title: CHROME_TITLE, subtitle: CHROME_SUBTITLE, tzLabel: 'Horários em São Paulo',
    niche, nicheLabel: nl, nicheColor: colorOf(obs, niche),
    tabs,
    niches: NICHE_KEYS.map(n => ({ key: n, label: nicheLabelOf(obs, n), count: obs.tabCounts(n).canais, pressed: n === niche, color: colorOf(obs, n) })),
    fresh: {
      channelsInNiche: competitors.filter(inNiche).length, channelsTotal: competitors.length,
      channelsText: niche === 'todos' ? F.plural(competitors.length, 'canal', 'canais') : `${F.plural(competitors.filter(inNiche).length, 'canal', 'canais')} em ${nl}`,
      totalText: niche === 'todos' ? null : ` · ${competitors.length} no total`,
      inRound: good.length,
      syncText: obs.SYNC.text, syncTitle: obs.SYNC.title,
      problems: bad.map(c => ({ id: c.id, name: c.name, phrase: phrase(c) })), problemsText,
      problemsShort: bad.length ? (niche === 'todos' ? String(bad.length) : `${kIn}/${bad.length}`) : null,
      problemsTitle: bad.length ? byLabel : null,
      rows: [...bad.map(c => row(c, true)), ...good.map(c => row(c, false))],
      popoverSub: `Sincronização ${obs.SYNC.cadence}.${next ? ' ' + cap(next) + '.' : ''} ${obs.TZ_LABEL}.`,
      problemsHref: obs.link.canais({ filter: 'problemas' }),
    },
    addHref: obs.link.canais({ add: 1 }), nicheEditorHref: obs.link.canais(),
    cowork: coworkText(o.tab, niche),
    forja: null,
  }
}

/** "Copiar pedido para o Cowork": the mockup's default text per tab (chrome.js coworkText). */
export function coworkText(tab: ChromeTab | 'historico', niche: NicheScope): string {
  const n = niche === 'todos' ? 'todos os nichos' : `nicho ${niche === 'ia' ? 'IA' : 'Viagem'}`
  const base: Record<ChromeTab | 'historico', string> = {
    canais: `Compare os canais monitorados no Observatório (${n}) via youtube_observatory: crescimento de views, frequência de publicação e frescor da sincronização. Aponte quem acelerou.`,
    mudancas: `Liste as trocas de título, thumbnail e descrição dos concorrentes (${n}, últimos 30 dias) via youtube_observatory. Para as que já têm 7 dias depois da troca, compare a média de views/dia observada com a esperada pela idade. Não afirme causa.`,
    outliers: `Liste os outliers dos concorrentes (${n}, longos, até 90 dias, 2× ou mais ajustado pela idade) via youtube_observatory e sugira 3 ângulos de vídeo para o meu canal.`,
    insights: `Leia as leituras da forja (${n}) via youtube_observatory e proponha 3 títulos para o meu próximo vídeo que sigam só as fórmulas que passam a regra.`,
    historico: 'Leia o histórico deste vídeo (títulos, thumbnails, descrições e a curva de views) via youtube_observatory e diga o que mudou e quando. Não afirme causa.',
  }
  return base[tab] + ' Use o MCP bythiagofigueiredo.'
}

// Single source (R40): the engine. Re-exported so the chrome API stays where screens import it.
export { syncResultToast, type SyncRun, type SyncToast, type SyncLookup } from '@/lib/youtube/observatorio/channels'
import type { SyncToast } from '@/lib/youtube/observatorio/channels'
/** What the "Sincronizar concorrentes" server action returns. */
export interface SyncNowResult { ok: boolean; text: string; problems: Array<{ id: string; label: string }>; outOfRound: Array<{ id: string; label: string }>; toast?: SyncToast }
