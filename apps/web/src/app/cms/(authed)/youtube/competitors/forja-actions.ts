'use server'
/**
 * "Pedir leitura à forja" / "Cancelar pedido" (Task 35). Both run the site-scope EDIT guard before any service client,
 * and take the user from the session — never from the caller. The engine plans (forja-queue → planAsk); a refusal comes
 * back with the engine's own sentence. Client components receive these as props (never import them).
 */
import * as Sentry from '@sentry/nextjs'
import { revalidatePath } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { askReading, cancelReading, isObsType, type AskOutcome, type ObsType } from '@/lib/pipeline/services/forja-queue'
import { PipelineServiceError, type ServiceContext } from '@/lib/pipeline/services/types'
import { loadDataset } from '@/lib/youtube/observatorio/load'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { createObservatory } from '@/lib/youtube/observatorio'
import { isNicheSlug, parseNiche, type NicheScope } from '@/lib/youtube/observatorio/niche'
import type { Fmt, Niche } from '@/lib/youtube/observatorio/types'

const FORBIDDEN = 'Sem permissão para pedir leituras à forja neste site.'
const QUEUE_DOWN = 'A fila da forja não respondeu. Tente de novo em alguns minutos.'
// Only the FORM here (before the guard, no read). Whether the niche exists in the site is checked against the engine:
// askReading loads it and refuses an unknown niche ("Nada enviado: o nicho … não existe neste site."); a cancel of an unknown niche matches no row.
const isNiche = (n: unknown): n is Niche => isNicheSlug(n)
const isScope = (n: unknown): n is NicheScope => typeof n === 'string' && parseNiche(n) != null

/** The edit guard FIRST; only then the service client (it bypasses RLS). */
async function sessionContext(): Promise<{ ctx: ServiceContext; userId: string } | null> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) return null
  return { ctx: { siteId, permissions: ['write'], supabase: getSupabaseServiceClient(), source: 'session' }, userId: res.user.id }
}

/** Unexpected failures keep the honest sentence for the user AND reach ops (no PII: type, niche, site). */
const report = (e: unknown, extra: { action: string; taskType: string; niche: string; siteId: string }) =>
  Sentry.captureException(e, { extra })

/** A queue answer that names the caller's input (400): said to the user, not an outage. */
const isBadInput = (e: unknown): e is PipelineServiceError => (e instanceof PipelineServiceError || (e instanceof Error && e.name === 'PipelineServiceError')) && (e as PipelineServiceError).status === 400

const revalidate = () => revalidatePath('/cms/youtube/competitors', 'layout')

export async function askForjaReading(type: ObsType, scope: NicheScope, videoId?: string, fmt?: Fmt): Promise<AskOutcome> {
  if (!isObsType(type) || !isScope(scope)) return { ok: false, reason: 'Pedido inválido.', results: [] }
  const s = await sessionContext()
  if (!s) return { ok: false, reason: FORBIDDEN, results: [] }
  try {
    const r = await askReading(s.ctx, { type, scope, ...(videoId ? { videoId } : {}), ...(fmt ? { fmt } : {}), userId: s.userId }, observatoryNow())
    if (r.data.ok) revalidate()
    return r.data
  } catch (e) {
    if (isBadInput(e)) return { ok: false, reason: 'Pedido inválido: ' + e.message, results: [] }
    report(e, { action: 'askForjaReading', taskType: type, niche: scope, siteId: s.ctx.siteId })
    return { ok: false, reason: QUEUE_DOWN, results: [] }
  }
}

/**
 * Cancels a request that is still waiting. A running one belongs to the machine: nothing is cancelled and the reason
 * uses the engine's own status label ("trabalhando desde 14:45").
 */
export async function cancelForjaReading(type: ObsType, niche: Niche, videoId?: string): Promise<{ ok: boolean; reason?: string }> {
  if (!isObsType(type) || !isNiche(niche)) return { ok: false, reason: 'Pedido inválido.' }
  const s = await sessionContext()
  if (!s) return { ok: false, reason: FORBIDDEN }
  try {
    const r = await cancelReading(s.ctx, { type, niche, ...(videoId ? { videoId } : {}) })
    if (r.data.cancelled) { revalidate(); return { ok: true } }
  } catch (e) {
    if (isBadInput(e)) return { ok: false, reason: 'Pedido inválido: ' + e.message }
    report(e, { action: 'cancelForjaReading', taskType: type, niche, siteId: s.ctx.siteId })
    return { ok: false, reason: QUEUE_DOWN }
  }
  // nothing was waiting: say what the engine sees now
  const obs = createObservatory(await loadDataset({ siteId: s.ctx.siteId, now: observatoryNow(), supabase: s.ctx.supabase }))
  const sc = type === 'leitura-video' ? obs.forja.session.current(null, { type, video: videoId ?? null }) : obs.forja.session.current(niche, { type })
  const q = sc.empty ? null : sc.requests.find(x => x.niche === niche) ?? null
  const NLn = obs.nicheLabel(niche)
  const who = type === 'leitura-video' ? 'o pedido de leitura deste vídeo' : 'o pedido de ' + NLn
  if (q && q.state === 'trabalhando') return { ok: false, reason: 'Nada cancelado: ' + who + ' está ' + (q.statusLabel ?? q.state) + ' e termina na máquina.' }
  return { ok: false, reason: 'Nada cancelado: não há ' + (type === 'leitura-video' ? 'pedido de leitura deste vídeo' : 'pedido de ' + NLn) + ' esperando na fila.' }
}
