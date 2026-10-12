import { link, OBS_BASE } from '@/lib/youtube/observatorio/links'
import type { CanalTab, CanalFmt, CanalSort } from '@/lib/youtube/observatorio/links'

export interface CanalState {
  tab: CanalTab
  fmt: CanalFmt
  sort: CanalSort
  dir: 'asc' | 'desc'
  q: string
  ver: 'capas' | 'lista'
  n: number
  video: string | null
  nums: boolean
}

export const CANAL_DEFAULT: CanalState = {
  tab: 'videos', fmt: 'todos', sort: 'recentes', dir: 'desc', q: '', ver: 'capas', n: 0, video: null, nums: false,
}

/** Tamanho do lote de "Carregar mais". */
export const LOTE = 40

const TABS: readonly CanalTab[] = ['videos', 'trocas', 'leitura']
const FMTS: readonly CanalFmt[] = ['todos', 'longos', 'shorts', 'fixados']
const SORTS: readonly CanalSort[] = ['recentes', 'vistos', 'multiplo', 'vpd']
/* Canal próprio (spec 16.4): ganha a aba Retenção e a ordenação por impressões; não tem fixados nem views por dia por vídeo no motor. */
const TABS_PROPRIO: readonly CanalTab[] = ['videos', 'trocas', 'leitura', 'retencao']
const FMTS_PROPRIO: readonly CanalFmt[] = ['todos', 'longos', 'shorts']
const SORTS_PROPRIO: readonly CanalSort[] = ['recentes', 'vistos', 'multiplo', 'imp']
const DIRS = ['asc', 'desc'] as const
const VERS = ['capas', 'lista'] as const

function pick<T extends string>(list: readonly T[], v: string | undefined, fallback: T): T {
  return list.find(x => x === v) ?? fallback
}

/** `own`: a página do canal próprio. 'imp' e 'retencao' só valem com ele; 'fixados' e 'vpd' só sem ele; o que não vale cai no padrão. */
export function parseCanalState(sp: Record<string, string | undefined>, opts: { own?: boolean } = {}): CanalState {
  const own = opts.own === true
  const tab = pick(own ? TABS_PROPRIO : TABS, sp.tab, CANAL_DEFAULT.tab)
  const nRaw = Number(sp.n)
  const n = Number.isFinite(nRaw) ? Math.min(100000, Math.max(0, Math.floor(nRaw / LOTE) * LOTE)) : 0
  return {
    tab,
    fmt: pick(own ? FMTS_PROPRIO : FMTS, sp.fmt, CANAL_DEFAULT.fmt),
    sort: pick(own ? SORTS_PROPRIO : SORTS, sp.sort, CANAL_DEFAULT.sort),
    dir: pick(DIRS, sp.dir, CANAL_DEFAULT.dir),
    q: (sp.q ?? '').trim().slice(0, 100),
    ver: pick(VERS, sp.ver, CANAL_DEFAULT.ver),
    n,
    video: tab === 'trocas' && sp.video ? sp.video : null,
    nums: sp.nums === '1',
  }
}

/** '' ou '?…', só o que difere do padrão, na ordem tab, fmt, sort, dir, q, ver, n, video, nums. */
export function canalQuery(s: CanalState): string {
  const full = link.canal('x', { tab: s.tab, fmt: s.fmt, sort: s.sort, dir: s.dir, q: s.q, ver: s.ver, n: s.n, video: s.video ?? undefined, nums: s.nums ? 1 : undefined })
  return full.slice((OBS_BASE + '/canal/x').length)
}
