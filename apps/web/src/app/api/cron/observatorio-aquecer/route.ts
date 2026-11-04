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
import { aquecerSite } from '@/lib/youtube/observatorio/aquecer-site'

export const runtime = 'nodejs'
export const maxDuration = 120

const JOB = 'observatorio-aquecer'
const Corpo = z.object({
  siteId: z.string().min(1).max(100),
  // ausente = o site inteiro (o fallback "sem lista" da invalidação)
  ids: z.array(z.string().min(1).max(100)).max(500).optional(),
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
  const { siteId, ids, invalidadoEm } = corpo.data

  // a fidelidade e2e (OBS_E2E=1 fora de produção) desliga o cache: não há o que aquecer
  if (!observatoryCacheEnabled()) return Response.json({ aceito: true, aquecendo: false }, { status: 202 })

  const runId = newRunId()
  after(async () => {
    try {
      const r = await aquecerSite(getSupabaseServiceClient(), { siteId, ids: ids ?? null, invalidadoEm })
      const { motivo, nao_aquecidos, ...numeros } = r
      logCron({ job: JOB, run_id: runId, site_id: siteId, ...numeros, nao_aquecidos, ...(motivo ? { motivo } : {}), status: r.status === 'ok' ? 'ok' : 'error' })
      if (r.status === 'ok') await recordCronSuccess(JOB, 'info')
      else await recordCronFailure(JOB, motivo ?? 'aquecimento incompleto', 'info')
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'observatorio-aquecer' } })
      try { logCron({ job: JOB, run_id: runId, site_id: siteId, status: 'error', err_code: 'unhandled' }) } catch { /* segue */ }
      try { await recordCronFailure(JOB, 'o aquecimento falhou com erro inesperado (ver Sentry)', 'info') } catch { /* segue */ }
    }
  })
  return Response.json({ aceito: true }, { status: 202 })
}
