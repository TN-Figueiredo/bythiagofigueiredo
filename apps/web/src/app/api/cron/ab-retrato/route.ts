import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { rodarRetrato } from '@/lib/youtube/ab-gravacao/retrato-step'
import { rodarDecisaoV2 } from '@/lib/youtube/ab-gravacao/decisao-v2-step'

export const runtime = 'nodejs'
export const maxDuration = 120

const JOB = 'ab-retrato'

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const inicio = Date.now()
  const sb = getSupabaseServiceClient()
  return withCronLock(sb, JOB, newRunId(), JOB, async () => {
    const agora = new Date()
    const r = await rodarRetrato(sb, agora)
    if (r.status !== 'ok') return r // sem retrato novo não há decisão (a falha já foi registrada)
    const { entradas, ...retrato } = r // Maps/Sets não vão ao wrapper nem ao log
    const decisao = await rodarDecisaoV2(sb, agora, entradas, inicio)
    console.log(JSON.stringify({ job: JOB, retrato_ms: retrato.duracao_ms, decisao_ms: decisao.status === 'ok' ? decisao.duracao_ms : null }))
    const falhou = decisao.status === 'error'
    // health_written: o recordCronFailure da decisão não pode ser apagado pelo recordCronSuccess do wrapper
    return { status: falhou ? 'error' : retrato.status, retrato, decisao, ...(falhou ? { health_written: true } : {}) }
  })
}
