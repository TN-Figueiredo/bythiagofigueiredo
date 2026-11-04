// F3-cache T3: aquece o cache do Observatório depois da coleta, em OUTRO request (no request que invalidou a etiqueta o Next não guarda).
// Quem chama é o `after()` do cron `sync-youtube` (sem grade no vercel.json). Responde 202 sem tocar o banco e aquece no próprio `after()`.
import { timingSafeEqual } from 'node:crypto'
import { NextRequest, after } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { logCron, newRunId } from '../../../../../lib/logger'
import { recordCronFailure, recordCronSuccess } from '@/lib/cron-health'
import { observatoryCacheEnabled } from '@/lib/youtube/observatorio/load-page'
import { AQUECER_CANAL_PIOR_MS, PRAZO_INTERNO_MS } from '@/lib/youtube/observatorio/aquecer'
import { aquecerSite } from '@/lib/youtube/observatorio/aquecer-site'

export const runtime = 'nodejs'
export const maxDuration = 120

const JOB = 'observatorio-aquecer'
const MAX_ALVOS = 50
const Corpo = z.object({
  alvos: z.array(z.object({
    siteId: z.string().min(1).max(100),
    // ausente = o site inteiro (o fallback "sem lista" da invalidação); lista vazia é recusada
    ids: z.array(z.string().uuid()).min(1).max(500).optional(),
  })).min(1).max(MAX_ALVOS),
  invalidadoEm: z.number().finite().optional(),
})

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (!expected || !authHeader) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const expectedBuf = Buffer.from(`Bearer ${expected}`)
  const actualBuf = Buffer.from(authHeader)
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) return Response.json({ error: 'unauthorized' }, { status: 401 })

  let bruto: unknown
  try { bruto = await req.json() } catch { return Response.json({ error: 'invalid body' }, { status: 400 }) }
  const corpo = Corpo.safeParse(bruto)
  if (!corpo.success) return Response.json({ error: 'invalid body' }, { status: 400 })
  const { alvos, invalidadoEm } = corpo.data

  // a fidelidade e2e (OBS_E2E=1 fora de produção) desliga o cache: não há o que aquecer
  if (!observatoryCacheEnabled()) return Response.json({ aceito: true, aquecendo: false }, { status: 202 })

  const runId = newRunId()
  after(async () => {
    const porSite: Array<{ siteId: string; status: 'ok' | 'falha'; resumo: string }> = []
    try {
      const sb = getSupabaseServiceClient()
      const inicio = Date.now()
      // os sites em série, dentro de UM prazo
      for (const alvo of alvos) {
        const restante = PRAZO_INTERNO_MS - (Date.now() - inicio)
        if (restante < AQUECER_CANAL_PIOR_MS) { porSite.push({ siteId: alvo.siteId, status: 'falha', resumo: 'sem tempo' }); continue }
        try {
          const r = await aquecerSite(sb, { siteId: alvo.siteId, ids: alvo.ids ?? null, invalidadoEm }, { prazoMs: restante })
          const { motivo, nao_aquecidos, ...numeros } = r
          logCron({ job: JOB, run_id: runId, site_id: alvo.siteId, ...numeros, nao_aquecidos, ...(motivo ? { motivo } : {}), status: r.status === 'ok' ? 'ok' : 'error' })
          porSite.push({ siteId: alvo.siteId, status: r.status, resumo: r.status === 'ok' ? 'ok' : (motivo ?? 'aquecimento incompleto') })
        } catch (err) {
          Sentry.captureException(err, { tags: { component: 'observatorio-aquecer' } })
          try { logCron({ job: JOB, run_id: runId, site_id: alvo.siteId, status: 'error', err_code: 'unhandled' }) } catch { /* segue */ }
          porSite.push({ siteId: alvo.siteId, status: 'falha', resumo: 'erro inesperado (ver Sentry)' })
        }
      }
      const falhas = porSite.filter(p => p.status !== 'ok')
      try { logCron({ job: JOB, run_id: runId, status: falhas.length === 0 ? 'ok' : 'error', sites: porSite.length, sites_com_falha: falhas.length, por_site: porSite.map(p => p.siteId + ': ' + p.resumo).join('; ') }) } catch { /* segue */ }
      // UMA linha no fim: falha se qualquer site falhou
      if (falhas.length === 0) await recordCronSuccess(JOB, 'info')
      else await recordCronFailure(JOB, falhas.map(p => p.siteId + ': ' + p.resumo).join('; ').slice(0, 500), 'info')
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'observatorio-aquecer' } })
      try { await recordCronFailure(JOB, 'o aquecimento falhou com erro inesperado (ver Sentry)', 'info') } catch { /* segue */ }
    }
  })
  return Response.json({ aceito: true }, { status: 202 })
}
