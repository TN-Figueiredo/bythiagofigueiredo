/**
 * Regra única de "é Short" (R109). Desde out/2024 um Short pode ter até 3 min, então a duração sozinha não decide
 * entre 61 e 180 s: o YouTube serve o vídeo em /shorts/<id> (200) quando é Short e redireciona para /watch quando não.
 * Tudo que decide ou lê "é Short" por duração passa por aqui — nenhum `<= 60` solto.
 */

/** Até aqui é Short sem consulta. */
export const SHORT_CERTAIN_MAX_SECONDS = 60
/** Acima disso nunca é Short. */
export const SHORT_MAX_SECONDS = 180

export type ShortProbeResult = 'short' | 'normal' | 'inconclusive'

/** 61–180 s: só a sonda decide. */
export function needsShortProbe(durationSeconds: number | null | undefined): boolean {
  return durationSeconds != null && durationSeconds > SHORT_CERTAIN_MAX_SECONDS && durationSeconds <= SHORT_MAX_SECONDS
}

/** Short garantido só pela duração (≤ 60 s). Duração desconhecida (null) não é "certa". */
export function isCertainShort(durationSeconds: number | null | undefined): boolean {
  return durationSeconds != null && durationSeconds <= SHORT_CERTAIN_MAX_SECONDS
}

export interface ShortVerdict {
  isShort: boolean
  /** false = sem confirmação (sonda inconclusiva ou ausente): R114 grava como NÃO Short, para ser sondado de novo. */
  confirmed: boolean
}

/**
 * - duração desconhecida: comportamento antigo (título com #Shorts);
 * - ≤ 60 s: Short; > 180 s: nunca;
 * - 61–180 s: #Shorts no título ou sonda 'short' = Short; sonda 'normal' = não; inconclusiva/ausente = NÃO Short, não confirmado (R114).
 */
export function classifyShort(input: {
  durationSeconds: number | null | undefined
  title?: string | null
  probe?: ShortProbeResult | null
}): ShortVerdict {
  const { durationSeconds: d, title, probe } = input
  const tagged = title?.includes('#Shorts') ?? false
  if (d == null) return { isShort: tagged, confirmed: true }
  if (d <= SHORT_CERTAIN_MAX_SECONDS) return { isShort: true, confirmed: true }
  if (d > SHORT_MAX_SECONDS) return { isShort: false, confirmed: true }
  if (tagged || probe === 'short') return { isShort: true, confirmed: true }
  if (probe === 'normal') return { isShort: false, confirmed: true }
  return { isShort: false, confirmed: false }
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/
export const isYoutubeVideoId = (id: string): boolean => YT_ID.test(id)

const PROBE_TIMEOUT_MS = 3_000
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/** Uma requisição a /shorts/<id> sem seguir redirecionamento. Nunca lança. */
export async function probeShort(videoId: string, fetchImpl: typeof fetch = fetch): Promise<ShortProbeResult> {
  if (!isYoutubeVideoId(videoId)) return 'inconclusive'
  try {
    const res = await fetchImpl(`https://www.youtube.com/shorts/${videoId}`, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      credentials: 'omit',
      headers: { 'user-agent': BROWSER_UA, 'accept-language': 'en-US,en;q=0.9' },
    })
    void res.body?.cancel().catch(() => undefined)
    if (res.status === 200) return 'short'
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location') ?? ''
      let path = ''
      try { const u = new URL(loc, 'https://www.youtube.com'); path = u.hostname.endsWith('youtube.com') && !u.hostname.startsWith('consent.') ? u.pathname : '' } catch { path = '' }
      return path === '/watch' ? 'normal' : 'inconclusive'
    }
    return 'inconclusive'
  } catch {
    return 'inconclusive'
  }
}

/** Teto de sondas por execução do cron, compartilhado entre os canais do lote. */
export const MAX_SHORT_PROBES_PER_RUN = 60 // 120 não cabe com margem ≥ 60 s no maxDuration (ver relatório)
export const SHORT_PROBE_CONCURRENCY = 4

export interface ShortProbeStats { attempted: number; shorts: number; regular: number; inconclusive: number; backfilled: number; pending: number }
export const emptyProbeStats = (): ShortProbeStats => ({ attempted: 0, shorts: 0, regular: 0, inconclusive: 0, backfilled: 0, pending: 0 })
export interface ProbeBudget { remaining: number; stats?: ShortProbeStats }
export const newProbeBudget = (n: number = MAX_SHORT_PROBES_PER_RUN): ProbeBudget => ({ remaining: n, stats: emptyProbeStats() })

/**
 * Sonda até `budget.remaining` ids (consome o orçamento), no máximo 4 por vez. Ids além do teto ficam fora do mapa
 * ("não sondado", diferente de 'inconclusive').
 */
export async function probeShortsBatch(
  videoIds: string[],
  budget: ProbeBudget,
  fetchImpl: typeof fetch = fetch,
): Promise<Map<string, ShortProbeResult>> {
  const out = new Map<string, ShortProbeResult>()
  const ids = [...new Set(videoIds)].filter(isYoutubeVideoId).slice(0, Math.max(0, budget.remaining))
  budget.remaining -= ids.length
  let next = 0
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++]!
      out.set(id, await probeShort(id, fetchImpl))
    }
  }
  await Promise.all(Array.from({ length: Math.min(SHORT_PROBE_CONCURRENCY, ids.length) }, worker))
  const st = budget.stats
  if (st) {
    st.attempted += out.size
    for (const r of out.values()) { if (r === 'short') st.shorts++; else if (r === 'normal') st.regular++; else st.inconclusive++ }
  }
  return out
}
