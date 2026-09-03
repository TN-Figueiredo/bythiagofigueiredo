import { timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import vercelConfig from '../../../../vercel.json'

// Dead-man-switch endpoint. The dono do repo mora fora do país por mais de um
// ano e não vai ler logs — este endpoint é o que um watchdog externo (ver
// docs/ops/cron-watchdog/) pode chamar a cada N minutos para saber se os
// crons agendados ainda estão vivos, sem depender de olhar Sentry/Vercel.
//
// vercel.json é importado ESTATICAMENTE (não `fs.readFileSync`): o
// file-tracing da Vercel pode não empacotar um arquivo lido dinamicamente em
// runtime, e `resolveJsonModule` já está ligado (precedente:
// src/locales/dictionary.ts).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface VercelCronEntry {
  path: string
  schedule: string
}

const cronEntries: VercelCronEntry[] = vercelConfig.crons

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

// -----------------------------------------------------------------------
// Agrupamento das entradas do vercel.json em "cron_name" — a chave gravada
// em cron_health por recordCronSuccess/recordCronFailure.
//
// Regra geral: cron_name = último segmento do path (ignorando querystring).
// Isso é verdade para as 48 rotas de /api/cron/* que gravam saúde (checado
// em src/lib/cron-health.ts e em cada `const JOB = '<pasta>'`).
//
// CAVEAT CONHECIDO — sync-youtube: tem 5 entradas no vercel.json
// (?mode=schedule|catchall|metrics|ab-poll|competitors) mas o handler
// (src/app/api/cron/sync-youtube/route.ts) grava só 3 chaves distintas em
// cron_health, verificado na fonte (não 2 como uma leitura apressada do
// código sugere): 'sync-youtube' (modos schedule/catchall/metrics somam
// nesta chave), 'sync-youtube-ab-poll' e 'sync-youtube-competitors'.
// Agrupar cegamente por "último segmento do path" colapsaria as 5 entradas
// em UMA chave 'sync-youtube' e pararia de monitorar ab-poll/competitors
// como dead-man-switches próprios. Em vez disso, mapeamos explicitamente
// cada `?mode=` para a chave real que o handler grava. Corrigir o handler
// para gravar `sync-youtube-${mode}` por modo fica fora deste pacote (ver
// "Fora deste plano" no plano).
function resolveCronName(rawPath: string): string {
  const [pathname, query] = rawPath.split('?')
  const base = (pathname ?? rawPath).replace(/^\/api\/cron\//, '')
  if (base === 'sync-youtube') {
    const mode = new URLSearchParams(query ?? '').get('mode')
    if (mode === 'ab-poll') return 'sync-youtube-ab-poll'
    if (mode === 'competitors') return 'sync-youtube-competitors'
    return 'sync-youtube' // schedule | catchall | metrics | sem mode
  }
  return base
}

function groupCronSchedules(entries: VercelCronEntry[]): Map<string, string[]> {
  const groups = new Map<string, string[]>()
  for (const entry of entries) {
    const name = resolveCronName(entry.path)
    const schedules = groups.get(name) ?? []
    schedules.push(entry.schedule)
    groups.set(name, schedules)
  }
  return groups
}

// -----------------------------------------------------------------------
// Parser de expressão cron (5 campos, padrão Vercel — avaliado em UTC).
// Cobre '*', listas ('a,b'), ranges ('a-b') e steps ('*/n', 'a-b/n'), que é
// tudo que aparece no vercel.json atual.
// -----------------------------------------------------------------------
function parseCronField(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>()
  for (const part of field.split(',')) {
    const [rangePart, stepPart] = part.split('/')
    const step = stepPart ? Number(stepPart) : 1
    let start = min
    let end = max
    if (rangePart !== '*' && rangePart !== undefined && rangePart !== '') {
      if (rangePart.includes('-')) {
        const [a, b] = rangePart.split('-').map(Number)
        start = a ?? min
        end = b ?? max
      } else {
        start = end = Number(rangePart)
      }
    }
    for (let v = start; v <= end; v += step) {
      values.add(v)
    }
  }
  return values
}

interface ParsedCron {
  minute: Set<number>
  hour: Set<number>
  dayOfMonth: Set<number>
  month: Set<number>
  dayOfWeek: Set<number>
  domRestricted: boolean
  dowRestricted: boolean
}

function parseCronExpression(expr: string): ParsedCron | null {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [minute, hour, dom, month, dow] = parts as [string, string, string, string, string]
  return {
    minute: parseCronField(minute, 0, 59),
    hour: parseCronField(hour, 0, 23),
    dayOfMonth: parseCronField(dom, 1, 31),
    month: parseCronField(month, 1, 12),
    dayOfWeek: parseCronField(dow, 0, 6),
    domRestricted: dom !== '*',
    dowRestricted: dow !== '*',
  }
}

function matchesCron(parsed: ParsedCron, date: Date): boolean {
  if (!parsed.minute.has(date.getUTCMinutes())) return false
  if (!parsed.hour.has(date.getUTCHours())) return false
  if (!parsed.month.has(date.getUTCMonth() + 1)) return false

  const domMatch = parsed.dayOfMonth.has(date.getUTCDate())
  const dowMatch = parsed.dayOfWeek.has(date.getUTCDay())

  // Semântica POSIX: se dom E dow forem restritos (!= '*'), o match é OR, não AND.
  if (parsed.domRestricted && parsed.dowRestricted) return domMatch || dowMatch
  if (parsed.domRestricted) return domMatch
  if (parsed.dowRestricted) return dowMatch
  return true
}

// Teto de busca: 60 dias cobre com folga o pior caso do vercel.json atual
// (cron mensal "0 2 1 * *" — no máximo ~31 dias entre execuções).
const MAX_LOOKBACK_MINUTES = 60 * 24 * 60

function mostRecentOccurrences(expr: string, now: Date, count: number): Date[] {
  const parsed = parseCronExpression(expr)
  if (!parsed) return []
  const results: Date[] = []
  const cursor = new Date(now)
  cursor.setUTCSeconds(0, 0)
  for (let i = 0; i <= MAX_LOOKBACK_MINUTES && results.length < count; i++) {
    if (matchesCron(parsed, cursor)) {
      results.push(new Date(cursor))
    }
    cursor.setUTCMinutes(cursor.getUTCMinutes() - 1)
  }
  return results
}

interface ExpectedRuns {
  lastRun: Date | null
  previousRun: Date | null
}

// Um cron_name pode ter mais de um schedule (ex.: ab-watchdog roda 10h e
// 20h; sync-youtube agrupado roda a cada 30min + diário + 2x/dia). A última
// execução esperada é o MAIS RECENTE entre todos os schedules do grupo, não
// apenas o de maior frequência — isso resolve corretamente a data
// esperada mesmo quando os schedules do grupo têm cadências diferentes.
function computeExpectedRuns(schedules: string[], now: Date): ExpectedRuns {
  const candidates: number[] = []
  for (const expr of schedules) {
    for (const occ of mostRecentOccurrences(expr, now, 2)) {
      candidates.push(occ.getTime())
    }
  }
  const uniqueSorted = Array.from(new Set(candidates)).sort((a, b) => b - a)
  return {
    lastRun: uniqueSorted[0] !== undefined ? new Date(uniqueSorted[0]) : null,
    previousRun: uniqueSorted[1] !== undefined ? new Date(uniqueSorted[1]) : null,
  }
}

const MIN_GRACE_MINUTES = 15

// Grace de metade do intervalo entre as duas últimas execuções esperadas,
// com piso de 15 minutos (cobre crons de alta frequência como */5, */15).
function computeGraceMinutes(lastRun: Date, previousRun: Date | null): number {
  if (!previousRun) return MIN_GRACE_MINUTES
  const intervalMinutes = (lastRun.getTime() - previousRun.getTime()) / 60_000
  return Math.max(intervalMinutes / 2, MIN_GRACE_MINUTES)
}

// -----------------------------------------------------------------------
// Avaliação por cron
// -----------------------------------------------------------------------
type CronItemStatus = 'ok' | 'late' | 'unknown'

interface CronHealthRow {
  cron_name: string
  last_success_at: string | null
  last_failure_at: string | null
  last_error: string | null
  consecutive_failures: number
  severity: string
}

interface CronHealthItem {
  name: string
  status: CronItemStatus
  schedules: string[]
  severity: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastError: string | null
  consecutiveFailures: number | null
  expectedLastRun: string | null
  graceMinutes: number | null
}

function evaluateCron(name: string, schedules: string[], row: CronHealthRow | undefined, now: Date): CronHealthItem {
  const { lastRun, previousRun } = computeExpectedRuns(schedules, now)

  // Decisão de produto: um cron agendado sem NENHUMA linha em cron_health
  // reporta 'unknown', nunca 'ok' — 'ok' mascararia um cron que nunca
  // rodou, que é metade do problema que este pacote existe para pegar
  // (ex.: ab-backfill ficou 81 dias parado sem nenhum sinal).
  if (!row) {
    return {
      name,
      status: 'unknown',
      schedules,
      severity: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastError: null,
      consecutiveFailures: null,
      expectedLastRun: lastRun ? lastRun.toISOString() : null,
      graceMinutes: null,
    }
  }

  // Schedule não parseável (não deveria acontecer com o vercel.json atual,
  // mas não deixa o endpoint quebrar): reporta unknown em vez de assumir ok.
  if (!lastRun) {
    return {
      name,
      status: 'unknown',
      schedules,
      severity: row.severity,
      lastSuccessAt: row.last_success_at,
      lastFailureAt: row.last_failure_at,
      lastError: row.last_error,
      consecutiveFailures: row.consecutive_failures,
      expectedLastRun: null,
      graceMinutes: null,
    }
  }

  const graceMinutes = computeGraceMinutes(lastRun, previousRun)
  const cutoff = new Date(lastRun.getTime() + graceMinutes * 60_000)
  const lastSuccessAt = row.last_success_at ? new Date(row.last_success_at) : null

  const isStale = now.getTime() >= cutoff.getTime() && (!lastSuccessAt || lastSuccessAt.getTime() < lastRun.getTime())
  // consecutive_failures só é > 0 quando o evento mais recente gravado foi
  // uma falha (todo sucesso zera o contador) — sinaliza problema mesmo
  // dentro da janela de grace.
  const mostRecentRunFailed = row.consecutive_failures > 0

  const status: CronItemStatus = isStale || mostRecentRunFailed ? 'late' : 'ok'

  return {
    name,
    status,
    schedules,
    severity: row.severity,
    lastSuccessAt: row.last_success_at,
    lastFailureAt: row.last_failure_at,
    lastError: row.last_error,
    consecutiveFailures: row.consecutive_failures,
    expectedLastRun: lastRun.toISOString(),
    graceMinutes,
  }
}

// unknown nunca escala pra 'down' sozinho — nas primeiras semanas após este
// deploy, dezenas de crons agendados semanal/mensalmente ainda vão estar
// 'unknown' legitimamente (nunca rodaram desde a instrumentação), e um
// alarme crítico disparando pra cada um seria ruído, não sinal. 'down' fica
// reservado pra quando SABEMOS que algo quebrou: uma linha com severity
// 'critical' que está atrasada ou cuja última execução falhou.
function aggregateStatus(items: CronHealthItem[]): 'ok' | 'degraded' | 'down' {
  const unhealthy = items.filter((i) => i.status !== 'ok')
  if (unhealthy.length === 0) return 'ok'
  const hasCriticalDown = unhealthy.some((i) => i.status === 'late' && i.severity === 'critical')
  return hasCriticalDown ? 'down' : 'degraded'
}

export async function GET(req: NextRequest): Promise<Response> {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const { data: rows, error } = await supabase
    .from('cron_health')
    .select('cron_name, last_success_at, last_failure_at, last_error, consecutive_failures, severity')

  if (error) {
    return Response.json({ error: 'cron_health query failed', detail: error.message }, { status: 500 })
  }

  const rowsByName = new Map<string, CronHealthRow>((rows ?? []).map((r) => [r.cron_name, r]))
  const groups = groupCronSchedules(cronEntries)
  const now = new Date()

  const crons = Array.from(groups.entries())
    .map(([name, schedules]) => evaluateCron(name, schedules, rowsByName.get(name), now))
    .sort((a, b) => a.name.localeCompare(b.name))

  const status = aggregateStatus(crons)

  return Response.json(
    { status, checkedAt: now.toISOString(), crons },
    { status: status === 'down' ? 503 : 200 },
  )
}
