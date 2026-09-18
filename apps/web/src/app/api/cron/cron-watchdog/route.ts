import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { sendNtfyAlert, isTerminalRefusal } from '@/lib/ops/ntfy'
import { claimAlert } from '@/lib/ops/alert-state'
import { buildCronHealthReport, CRON_HEALTH_COLUMNS } from '@/lib/ops/cron-health-report'

// Vercel Cron: { "path": "/api/cron/cron-watchdog", "schedule": "*/15 * * * *" }
//
// Terceira classe de falha do projeto: "um cron parou de rodar". Até
// 2026-09-18 ela era detectada SÓ pelo workflow `health-watch.yml`, e o
// agendador do GitHub não cumpre o horário pedido: 40 execuções agendadas
// medidas deram intervalo mediano de 204 min (mínimo 111, máximo 352) contra
// os 15 min do `cron:`. Mexer na expressão não adianta — `uptime.yml` pede
// `*/5` e recebe a mesma janela, porque o GitHub agrupa os agendamentos
// vencidos do repositório. Resultado: um cron morto ficava invisível por 2 a
// 6 h, numa base onde cron morrendo em silêncio já aconteceu mais de uma vez
// (rotas POST-only do split-brain, crons de newsletter órfãos).
//
// Aqui a mesma avaliação roda num agendador que cumpre horário. Com grace
// mínimo de 15 min (MIN_GRACE_MINUTES) e este cron a cada 15 min, a detecção
// cai para ~15-30 min depois da execução esperada.
//
// LIMITE, declarado de propósito: um cron da Vercel não detecta o dia em que
// TODOS os crons da Vercel param — ele para junto. Essa classe continua sendo
// do `health-watch.yml`, e é para ela que 2 a 6 h é latência adequada.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const JOB = 'cron-watchdog'
const LOCK_KEY = 'cron:cron-watchdog'

// Dedupe POR STATUS, como no uptime-probe: com chave única, um `degraded` em
// t=0 carimbaria e calaria um `down` genuíno em t=15. Intervalos abaixo da
// grade de 15 min porque a comparação do claim é estrita.
// down => ≤ 24 pushes/dia; degraded => ≤ 4/dia.
const DEDUPE_WINDOW = { down: '59 minutes', degraded: '5 hours 59 minutes' } as const

// Um push não é lugar para despejar 45 nomes; o triagem é sempre o CMS/Sentry.
const MAX_NAMES_IN_PUSH = 6

export async function POST(req: Request): Promise<Response> {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const { data: rows, error } = await supabase.from('cron_health').select(CRON_HEALTH_COLUMNS)
    // Sem a consulta não há avaliação nenhuma: isto é falha DESTE cron, e
    // lançar é o que faz `withCronLock` registrá-la. Devolver um corpo com
    // `status: 'ok'` aqui seria declarar saúde sem ter olhado.
    if (error) throw new Error(`cron_health query failed: ${error.message}`)

    const report = buildCronHealthReport(rows ?? [], new Date())

    if (report.status === 'ok') {
      return {
        status: report.status,
        late: 0,
        unknown: report.unknownCount,
        alerted: false,
      }
    }

    const shown = report.lateNames.slice(0, MAX_NAMES_IN_PUSH)
    const overflow = report.lateNames.length - shown.length
    const names = shown.join(', ') + (overflow > 0 ? ` (+${overflow})` : '')

    let shouldSend = true
    try {
      shouldSend = await claimAlert(supabase, `cron-watchdog:${report.status}`, DEDUPE_WINDOW[report.status])
    } catch {
      // FAIL-OPEN: o dedupe existe para reduzir ruído, nunca para calar o sinal.
      Sentry.captureMessage('cron-watchdog dedupe claim failed — alerting anyway', 'warning')
      shouldSend = true
    }

    if (!shouldSend) {
      return {
        status: report.status,
        late: report.lateNames.length,
        unknown: report.unknownCount,
        alerted: false,
        reason: 'deduped',
      }
    }

    const result = await sendNtfyAlert({
      title: `crons ${report.status}`,
      body: `${report.lateNames.length} atrasado(s): ${names}`,
      priority: report.status === 'down' ? 'urgent' : 'high',
      tags: [report.status === 'down' ? 'rotating_light' : 'warning'],
    })

    // Um cron atrasado DETECTADO cujo aviso não saiu é o modo de falha que
    // este projeto existe para eliminar — e ele é pior que não ter detectado,
    // porque o registro ficaria verde. Sentry nomeia a causa e o `throw`
    // rebaixa a saúde deste cron, que o `/api/health` (e portanto a perna do
    // GitHub) enxerga no ciclo seguinte. Barulhento é estritamente melhor que
    // silencioso aqui: é a mesma escolha registrada em C2.
    if (result.reason === 'NTFY_URL unset') {
      Sentry.captureException(new Error('cron-watchdog alert channel unavailable: NTFY_URL unset'), {
        tags: { component: 'cron', job: JOB },
      })
      throw new Error('crons late but alert channel unavailable: NTFY_URL unset')
    }
    if (isTerminalRefusal(result)) {
      const detail = `ntfyStatus=${result.ntfyStatus ?? 'unknown'}`
      Sentry.captureException(new Error(`cron-watchdog alert channel refused the push (${detail})`), {
        tags: { component: 'cron', job: JOB },
      })
      throw new Error(`crons late but alert channel refused the push (${detail})`)
    }

    return {
      status: report.status,
      late: report.lateNames.length,
      lateNames: report.lateNames,
      unknown: report.unknownCount,
      ...result,
    }
  })
}

// Cron da Vercel dispara GET; auth le o header Authorization independente do verbo, entao o alias e seguro.
export const GET = POST
