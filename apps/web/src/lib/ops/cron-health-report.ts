import vercelConfig from '../../../vercel.json'

// Avaliação de saúde dos crons do `vercel.json`, extraída de
// `src/app/api/health/route.ts` (2026-09-18) sem mudança de comportamento.
//
// O motivo da extração: por 11 dias o ÚNICO consumidor desta lógica foi o
// workflow `health-watch.yml`, cujo agendador o GitHub estrangula — 40
// execuções medidas deram intervalo mediano de 204 min (mínimo 111, máximo
// 352), nunca perto dos 15 min pedidos no `cron:`. Ou seja, "um cron parou de
// rodar" só era percebido 2 a 6 h depois. Com a lógica aqui, um cron da própria
// Vercel (`/api/cron/cron-watchdog`, agendador que roda no horário) passa a
// avaliá-la a cada 15 min, e a perna do GitHub fica responsável apenas pela
// classe que ela de fato cobre e que a Vercel não pode cobrir sozinha: a
// Vercel inteira morta — onde 2 a 6 h é latência adequada.

interface VercelCronEntry {
  path: string
  schedule: string
}

const cronEntries: VercelCronEntry[] = vercelConfig.crons
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
export function resolveCronName(rawPath: string): string {
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

export function groupCronSchedules(entries: VercelCronEntry[]): Map<string, string[]> {
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
export function mergedOccurrences(schedules: string[], now: Date, count: number): Date[] {
  const candidates: number[] = []
  for (const expr of schedules) {
    for (const occ of mostRecentOccurrences(expr, now, count)) {
      candidates.push(occ.getTime())
    }
  }
  return Array.from(new Set(candidates))
    .sort((a, b) => b - a)
    .slice(0, count)
    .map((t) => new Date(t))
}

export function computeExpectedRuns(schedules: string[], now: Date): ExpectedRuns {
  const occ = mergedOccurrences(schedules, now, 2)
  return {
    lastRun: occ[0] ?? null,
    previousRun: occ[1] ?? null,
  }
}

// A execução esperada mais recente cujo PRAZO (execução + grace) já venceu.
//
// Por que não basta `now >= lastRun + grace` (a forma até 2026-09-18): como
// `lastRun` é a ocorrência mais recente *anterior a now*, a distância
// `now - lastRun` é sempre MENOR que o intervalo do cron. Com o piso de
// `MIN_GRACE_MINUTES = 15`, todo cron de intervalo <= 15 min tinha
// `grace >= intervalo`, e o prazo nunca vencia: `lastRun` avançava mais rápido
// que o relógio do prazo. Consequência medida: um `*/5` PARADO HÁ 30 DIAS era
// reportado `ok` — e isso valia justamente para os crons mais frequentes
// (publish-scheduled, notification-deliver, uptime-probe, social-publish,
// send-scheduled-newsletters e o próprio cron-watchdog).
//
// Olhando para trás até achar uma ocorrência cujo prazo já venceu, a
// semântica para crons lentos fica idêntica (a ocorrência vencida é a última
// mesmo) e a dos rápidos passa a existir.
function mostRecentDueRun(schedules: string[], now: Date, graceMinutes: number): Date | null {
  const { lastRun, previousRun } = computeExpectedRuns(schedules, now)
  if (!lastRun) return null
  const intervalMinutes = previousRun ? (lastRun.getTime() - previousRun.getTime()) / 60_000 : null
  // Quantas ocorrências preciso varrer até uma delas ter prazo vencido.
  const needed =
    intervalMinutes && intervalMinutes > 0 ? Math.ceil(graceMinutes / intervalMinutes) + 2 : 2
  const graceMs = graceMinutes * 60_000
  for (const occ of mergedOccurrences(schedules, now, needed)) {
    if (occ.getTime() + graceMs <= now.getTime()) return occ
  }
  return null
}

const MIN_GRACE_MINUTES = 15

// Grace de metade do intervalo entre as duas últimas execuções esperadas,
// com piso de 15 minutos (cobre crons de alta frequência como */5, */15).
export function computeGraceMinutes(lastRun: Date, previousRun: Date | null): number {
  if (!previousRun) return MIN_GRACE_MINUTES
  const intervalMinutes = (lastRun.getTime() - previousRun.getTime()) / 60_000
  return Math.max(intervalMinutes / 2, MIN_GRACE_MINUTES)
}

// -----------------------------------------------------------------------
// Avaliação por cron
// -----------------------------------------------------------------------
export type CronItemStatus = 'ok' | 'late' | 'unknown'

export interface ICronHealthRow {
  cron_name: string
  last_success_at: string | null
  last_failure_at: string | null
  last_error: string | null
  consecutive_failures: number
  severity: string
}

export interface ICronHealthItem {
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

export function evaluateCron(name: string, schedules: string[], row: ICronHealthRow | undefined, now: Date): ICronHealthItem {
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
  const lastSuccessAt = row.last_success_at ? new Date(row.last_success_at) : null

  // Referência é a execução esperada cujo prazo JÁ VENCEU — ver
  // `mostRecentDueRun`. Usar `lastRun` aqui tornava a janela inalcançável para
  // todo cron de intervalo <= grace.
  const dueRun = mostRecentDueRun(schedules, now, graceMinutes)
  const isStale = dueRun !== null && (!lastSuccessAt || lastSuccessAt.getTime() < dueRun.getTime())
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

// 'unknown' NUNCA entra no calculo do agregado (Critico 2b, docs/superpowers/
// plans/2026-09-02-falhas-silenciosas.md). Antes, 'unknown' contava como
// "nao-ok" e derrubava o agregado pra 'degraded' pra sempre — um cron
// semanal/mensal legitimamente sem execucao recente (ou um cron novo que
// ainda nao rodou uma vez desde a instrumentacao) mantinha o dead-man-switch
// em alarme permanente. Um alarme que berra desde o dia 1 e ignorado na
// semana 2 — alarme ignorado e silencio com passos extras, exatamente o que
// este pacote existe para evitar. 'unknown' e AUSENCIA de informacao, nao
// EVIDENCIA de falha: fica de fora do agregado e volta como contagem/lista
// propria no corpo da resposta (unknownCount/unknownNames) — visivel e
// honesto, mas nao aciona alarme. 'down' fica reservado pra quando SABEMOS
// que algo quebrou: uma linha com severity 'critical' que esta atrasada ou
// cuja ultima execucao falhou.
export function aggregateStatus(items: ICronHealthItem[]): 'ok' | 'degraded' | 'down' {
  const known = items.filter((i) => i.status !== 'unknown')
  const unhealthy = known.filter((i) => i.status !== 'ok')
  if (unhealthy.length === 0) return 'ok'
  const hasCriticalDown = unhealthy.some((i) => i.status === 'late' && i.severity === 'critical')
  return hasCriticalDown ? 'down' : 'degraded'
}

// -----------------------------------------------------------------------
// Relatório completo — o que os dois consumidores (`/api/health` e o cron
// `cron-watchdog`) precisam, para que nenhum dos dois reimplemente o
// agrupamento, a ordenação ou a regra de `unknown`.
// -----------------------------------------------------------------------
export interface ICronHealthReport {
  status: 'ok' | 'degraded' | 'down'
  checkedAt: string
  crons: ICronHealthItem[]
  /** Ausência de informação, reportada à parte — ver `aggregateStatus`. */
  unknownCount: number
  unknownNames: string[]
  /** Nomes com `status: 'late'`, que é o que um alerta precisa nomear. */
  lateNames: string[]
}

export function buildCronHealthReport(rows: ICronHealthRow[], now: Date): ICronHealthReport {
  const rowsByName = new Map<string, ICronHealthRow>(rows.map((r) => [r.cron_name, r]))
  const groups = groupCronSchedules(cronEntries)

  const crons = Array.from(groups.entries())
    .map(([name, schedules]) => evaluateCron(name, schedules, rowsByName.get(name), now))
    .sort((a, b) => a.name.localeCompare(b.name))

  const unknownCrons = crons.filter((c) => c.status === 'unknown')

  return {
    status: aggregateStatus(crons),
    checkedAt: now.toISOString(),
    crons,
    unknownCount: unknownCrons.length,
    unknownNames: unknownCrons.map((c) => c.name),
    lateNames: crons.filter((c) => c.status === 'late').map((c) => c.name),
  }
}

/** Colunas que `buildCronHealthReport` consome — uma só fonte para os dois selects. */
export const CRON_HEALTH_COLUMNS =
  'cron_name, last_success_at, last_failure_at, last_error, consecutive_failures, severity'
