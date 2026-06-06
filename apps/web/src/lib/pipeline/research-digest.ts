// ---------------------------------------------------------------------------
// Research Strategist — digest signals + owner recommendation.
//
// Single source of truth for the strategy signals consumed by:
//   - the MCP resource  pipeline://research/digest  (read-only, on demand)
//   - the weekly cron    /api/cron/research-digest   (proactive push)
//
// Signal computation mirrors the rules in
// docs/cowork-research-strategist-skill.md (Preflight) and
// docs/cowork-research-rules.md (thresholds: fresca>14d, analise>30d,
// tema maduro >= 3). Keep the two in sync.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'

// --- Thresholds (RS rules) -------------------------------------------------

export const FRESCA_STALE_DAYS = 14
export const ANALISE_STALE_DAYS = 30
export const MATURING_MIN_ITEMS = 3

const FRESCA_STALE_MS = FRESCA_STALE_DAYS * 86_400_000
const ANALISE_STALE_MS = ANALISE_STALE_DAYS * 86_400_000

// --- Shapes ----------------------------------------------------------------

interface ResearchItemRow {
  id: string
  title: string
  status: string
  theme_id: string | null
  pinned: boolean
  created_at: string
  updated_at: string
}

interface FocoRow {
  id: string
  title: string
  window_label: string | null
  horizon: string
}

interface DecisionRow {
  id: string
  title: string
  horizon: string
  status: string
  revisit: string | null
}

export interface StaleItem {
  id: string
  title: string
  ageDays: number
}

export interface MaturingTheme {
  theme: string
  count: number
}

export interface ResearchDigestSignals {
  countsByStatus: Record<string, number>
  themeCounts: Record<string, number>
  activeFoco: FocoRow | null
  revisitDue: DecisionRow[]
  staleFresca: StaleItem[]
  staleAnalise: StaleItem[]
  maturingThemes: MaturingTheme[]
  pinnedCount: number
  totalItems: number
  thresholds: {
    frescaStaleDays: number
    analiseStaleDays: number
    maturingMinItems: number
  }
  generatedAt: string
}

// --- Recommendation contract ----------------------------------------------

/** Preflight alert kinds, in descending priority (RS4/RS5). */
export type RecommendationKind =
  | 'revisit_due'
  | 'foco_orfao'
  | 'tema_maduro'
  | 'research_stale'

export interface ResearchRecommendation {
  kind: RecommendationKind
  /** PT-BR, plain language, single action — feeds notification message. */
  recomendo_agora: string
  /** Deep-link target inside the CMS. */
  action_href: string
  /** Stable per-week-ish key segment so the cron can dedup notifications. */
  dedupSegment: string
}

/**
 * `summary_for_owner` — the plain-PT-BR contract from
 * docs/cowork-research-strategist-skill.md (Output Pattern). Glossário
 * humanizado, no jargão, no UUIDs, no máximo 1 recomendação principal.
 */
export interface SummaryForOwner {
  estado: string
  o_que_esta_quente: string
  recomendo_agora: string
  precisa_da_sua_atencao: string
}

// --- Glossário humanizado --------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  fresca: 'novas',
  analise: 'em análise',
  aplicada: 'já aplicadas',
  arquivada: 'arquivadas',
}

function humanizeStatus(status: string): string {
  return STATUS_LABELS[status] ?? status
}

function pluralize(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural
}

// ---------------------------------------------------------------------------
// computeResearchDigest — runs the queries + derives every signal.
// ---------------------------------------------------------------------------

/**
 * Compute the strategy signals for a single site. Reuses the exact query
 * logic the `pipeline://research/digest` resource used to inline.
 *
 * `supabase` must be a service-role client (cron / resource context) so the
 * read crosses RLS scoped only by the explicit `site_id` filter.
 */
export async function computeResearchDigest(
  supabase: SupabaseClient,
  siteId: string,
  now: number = Date.now(),
): Promise<ResearchDigestSignals> {
  const [itemsRes, focoRes, decisionsRes] = await Promise.all([
    supabase
      .from('research_items')
      .select('id, title, status, theme_id, pinned, created_at, updated_at')
      .eq('site_id', siteId),
    supabase
      .from('research_focos')
      .select('id, title, window_label, horizon')
      .eq('site_id', siteId)
      .eq('active', true)
      .eq('state', 'ativo')
      .maybeSingle(),
    supabase
      .from('research_decisions')
      .select('id, title, horizon, status, revisit')
      .eq('site_id', siteId)
      .neq('status', 'arquivado'),
  ])

  const items = (itemsRes.data ?? []) as ResearchItemRow[]

  const countsByStatus: Record<string, number> = {}
  const themeCounts: Record<string, number> = {}
  const staleFresca: StaleItem[] = []
  const staleAnalise: StaleItem[] = []

  for (const it of items) {
    countsByStatus[it.status] = (countsByStatus[it.status] ?? 0) + 1
    const theme = it.theme_id ?? '(sem tema)'
    themeCounts[theme] = (themeCounts[theme] ?? 0) + 1

    const ageMs = now - Date.parse(it.updated_at)
    const ageDays = Math.floor(ageMs / 86_400_000)
    if (it.status === 'fresca' && now - Date.parse(it.created_at) > FRESCA_STALE_MS) {
      staleFresca.push({
        id: it.id,
        title: it.title,
        ageDays: Math.floor((now - Date.parse(it.created_at)) / 86_400_000),
      })
    }
    if (it.status === 'analise' && ageMs > ANALISE_STALE_MS) {
      staleAnalise.push({ id: it.id, title: it.title, ageDays })
    }
  }

  // Maturing themes (RS): >= MATURING_MIN_ITEMS active (não-arquivada) items.
  const activeByTheme: Record<string, number> = {}
  for (const it of items) {
    if (it.status === 'arquivada') continue
    const theme = it.theme_id ?? '(sem tema)'
    activeByTheme[theme] = (activeByTheme[theme] ?? 0) + 1
  }
  const maturingThemes = Object.entries(activeByTheme)
    .filter(([theme, n]) => theme !== '(sem tema)' && n >= MATURING_MIN_ITEMS)
    .map(([theme, count]) => ({ theme, count }))

  const decisions = (decisionsRes.data ?? []) as DecisionRow[]
  const revisitDue = decisions.filter((d) => {
    if (!d.revisit) return false
    const ts = Date.parse(d.revisit)
    return Number.isFinite(ts) && ts < now
  })

  return {
    countsByStatus,
    themeCounts,
    activeFoco: (focoRes.data ?? null) as FocoRow | null,
    revisitDue,
    staleFresca,
    staleAnalise,
    maturingThemes,
    pinnedCount: items.filter((i) => i.pinned).length,
    totalItems: items.length,
    thresholds: {
      frescaStaleDays: FRESCA_STALE_DAYS,
      analiseStaleDays: ANALISE_STALE_DAYS,
      maturingMinItems: MATURING_MIN_ITEMS,
    },
    generatedAt: new Date(now).toISOString(),
  }
}

// ---------------------------------------------------------------------------
// pickRecommendation — the SINGLE highest-priority action (Preflight order).
// ---------------------------------------------------------------------------

/**
 * Preflight priority (RS4/RS5):
 *   revisit vencido > foco órfão > tema maduro > research stale.
 *
 * A "foco órfão" here is an active foco whose `window_label` looks expired
 * AND there is no open decision linked to its horizon — we approximate
 * orphanhood with "active foco but zero open decisions on the agora horizon",
 * since the cron has no cheap decision↔foco link. Conservative: only fires
 * when the active foco exists and there are literally no `agora` decisions.
 *
 * Returns null when nothing is worth surfacing (suggest-don't-nag).
 */
export function pickRecommendation(
  signals: ResearchDigestSignals,
): ResearchRecommendation | null {
  const base = '/cms/pipeline/research'

  // 1. revisit vencido (RS5) — highest priority debt.
  if (signals.revisitDue.length > 0) {
    const n = signals.revisitDue.length
    return {
      kind: 'revisit_due',
      recomendo_agora:
        n === 1
          ? `Tem 1 decisão com revisão vencida — vale fechar ou renovar. Quer revisar agora?`
          : `Tem ${n} decisões com revisão vencida — valem fechar ou renovar. Quer revisar agora?`,
      action_href: `${base}/decisoes`,
      dedupSegment: 'revisit',
    }
  }

  // 2. foco órfão — foco ativo com a janela do trimestre expirada.
  // (Reached only when there are zero overdue revisits, per the early return
  //  above.) The cron has no cheap decision↔foco link, so we approximate
  //  orphanhood with an expired window on the active foco.
  const foco = signals.activeFoco
  if (foco && isWindowExpired(foco.window_label)) {
    return {
      kind: 'foco_orfao',
      recomendo_agora:
        `Seu foco "${foco.title}" cumpriu a janela do trimestre e está sem decisão recente. ` +
        `Quer reabrir o ciclo e propor o próximo foco?`,
      action_href: `${base}/focos`,
      dedupSegment: 'foco-orfao',
    }
  }

  // 3. tema maduro (RS2/RS4) — >=3 pesquisas num tema sem foco cobrindo.
  if (signals.maturingThemes.length > 0) {
    const top = [...signals.maturingThemes].sort((a, b) => b.count - a.count)[0]!
    return {
      kind: 'tema_maduro',
      recomendo_agora:
        `O tema "${top.theme}" tem ${top.count} pesquisas maduras e nenhum foco cobrindo. ` +
        `Deixa eu propor um foco desse tema pro trimestre?`,
      action_href: `${base}/focos`,
      dedupSegment: `tema-${top.theme}`,
    }
  }

  // 4. research stale (RS1) — fresca>14d ou analise>30d paradas.
  const staleTotal = signals.staleFresca.length + signals.staleAnalise.length
  if (staleTotal > 0) {
    return {
      kind: 'research_stale',
      recomendo_agora:
        `${staleTotal} ${pluralize(staleTotal, 'pesquisa parada', 'pesquisas paradas')} ` +
        `esperando triagem (nova há +${FRESCA_STALE_DAYS}d ou em análise há +${ANALISE_STALE_DAYS}d). ` +
        `Faço uma triagem rápida?`,
      action_href: `${base}`,
      dedupSegment: 'stale',
    }
  }

  // Nada que valha interromper — suggest-don't-nag.
  return null
}

/**
 * Heuristic: a `window_label` is "expired" when it names a quarter/period
 * that is strictly before the current one. We can't reliably parse every free
 * label, so we treat an UNPARSEABLE label as NOT expired (conservative — never
 * nag on a label we don't understand). Recognised forms: "Q<n> <year>",
 * "<mês>/<yy>" ranges are out of scope.
 */
export function isWindowExpired(
  windowLabel: string | null,
  now: number = Date.now(),
): boolean {
  if (!windowLabel) return false
  const m = windowLabel.match(/Q\s*([1-4])\s*[\/\-\s]?\s*(\d{4})/i)
  if (!m) return false
  const q = Number(m[1])
  const year = Number(m[2])
  const nowDate = new Date(now)
  const nowYear = nowDate.getUTCFullYear()
  const nowQ = Math.floor(nowDate.getUTCMonth() / 3) + 1
  if (year < nowYear) return true
  if (year === nowYear && q < nowQ) return true
  return false
}

// ---------------------------------------------------------------------------
// buildSummaryForOwner — plain PT-BR contract for the notification body.
// ---------------------------------------------------------------------------

export function buildSummaryForOwner(
  signals: ResearchDigestSignals,
  recommendation: ResearchRecommendation | null,
): SummaryForOwner {
  // estado — 1-2 frases sobre o foco e o volume.
  const foco = signals.activeFoco
  const estado = foco
    ? `Foco ativo: "${foco.title}"${foco.window_label ? ` (${foco.window_label})` : ''}. ` +
      `${signals.totalItems} ${pluralize(signals.totalItems, 'pesquisa no radar', 'pesquisas no radar')}.`
    : `Sem foco ativo no momento. ` +
      `${signals.totalItems} ${pluralize(signals.totalItems, 'pesquisa no radar', 'pesquisas no radar')}.`

  // o_que_esta_quente — o tema/status mais maduro.
  let oQueEstaQuente: string
  if (signals.maturingThemes.length > 0) {
    const top = [...signals.maturingThemes].sort((a, b) => b.count - a.count)[0]!
    oQueEstaQuente = `Tema "${top.theme}" está o mais quente: ${top.count} pesquisas maduras.`
  } else {
    const analise = signals.countsByStatus['analise'] ?? 0
    if (analise > 0) {
      oQueEstaQuente = `${analise} ${pluralize(analise, 'pesquisa', 'pesquisas')} ${humanizeStatus('analise')}, ainda sem tema dominante.`
    } else {
      oQueEstaQuente = 'Nada fervendo agora — backlog tranquilo.'
    }
  }

  // recomendo_agora — UMA ação (ou nada).
  const recomendoAgora = recommendation
    ? recommendation.recomendo_agora
    : 'Nada urgente. Mantém o ritmo.'

  // precisa_da_sua_atencao — revisit vencido / foco sem decisão / nada.
  let precisaDaSuaAtencao: string
  if (signals.revisitDue.length > 0) {
    const n = signals.revisitDue.length
    precisaDaSuaAtencao = `${n} ${pluralize(n, 'decisão com revisão vencida', 'decisões com revisão vencida')}.`
  } else if (foco && isWindowExpired(foco.window_label)) {
    precisaDaSuaAtencao = `Foco "${foco.title}" com a janela do trimestre expirada.`
  } else {
    precisaDaSuaAtencao = 'Nada vencido.'
  }

  return {
    estado,
    o_que_esta_quente: oQueEstaQuente,
    recomendo_agora: recomendoAgora,
    precisa_da_sua_atencao: precisaDaSuaAtencao,
  }
}
