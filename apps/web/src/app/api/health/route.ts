import { timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildCronHealthReport, CRON_HEALTH_COLUMNS } from '@/lib/ops/cron-health-report'

// Dead-man-switch endpoint. The dono do repo mora fora do país por mais de um
// ano e não vai ler logs — este endpoint é o que um watchdog externo (ver
// docs/ops/cron-watchdog/) pode chamar a cada N minutos para saber se os
// crons agendados ainda estão vivos, sem depender de olhar Sentry/Vercel.
//
// A avaliação em si mora em `src/lib/ops/cron-health-report.ts` desde
// 2026-09-18, porque o cron `/api/cron/cron-watchdog` precisa exatamente dela:
// o agendador do GitHub, único consumidor deste endpoint até então, entrega
// intervalo mediano de 204 min em vez dos 15 min pedidos, o que deixava "um
// cron parou de rodar" invisível por 2 a 6 h.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// -----------------------------------------------------------------------
// Auth — mesmo padrão timingSafeEqual usado em src/app/api/cron/sync-youtube.
// -----------------------------------------------------------------------
function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (!expected || !authHeader) return false
  const expectedBuf = Buffer.from(`Bearer ${expected}`)
  const actualBuf = Buffer.from(authHeader)
  if (expectedBuf.length !== actualBuf.length) return false
  return timingSafeEqual(expectedBuf, actualBuf)
}

export async function GET(req: NextRequest): Promise<Response> {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const { data: rows, error } = await supabase.from('cron_health').select(CRON_HEALTH_COLUMNS)

  if (error) {
    return Response.json({ error: 'cron_health query failed', detail: error.message }, { status: 500 })
  }

  const report = buildCronHealthReport(rows ?? [], new Date())

  return Response.json(
    {
      status: report.status,
      checkedAt: report.checkedAt,
      crons: report.crons,
      // Ausencia de informacao, reportada a parte — ver aggregateStatus na lib.
      unknownCount: report.unknownCount,
      unknownNames: report.unknownNames,
    },
    { status: report.status === 'down' ? 503 : 200 },
  )
}
