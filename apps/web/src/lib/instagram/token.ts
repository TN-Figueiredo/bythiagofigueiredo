// SERVER-ONLY. Importa @tn-figueiredo/social/vault (=> node:crypto).
// MUST NOT ser importado de nenhum arquivo 'use client' — as frases da UI
// vivem em ./status-text.ts, que é isomórfico de propósito.
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { decrypt, encrypt } from '@tn-figueiredo/social/vault'
import { redactSecrets } from '@/lib/redact-secrets'
import { isTerminalRefusal, sendNtfyAlert } from '@/lib/ops/ntfy'
import { fanOutToSiteAdminsDetailed } from '@/lib/notifications/fan-out-to-admins'
import { GRAPH_API_BASE, instagramErrorFromResponse } from './api-client'
import { RECONNECT_CTA, kindFrom, type TokenKind } from './status-text'

/** Re-export exigido por §3.2 — `p_reason` chega sempre redigido. */
export const redact = redactSecrets

export class VaultUnavailableError extends Error {
  constructor() {
    super('SOCIAL_MASTER_KEY missing or malformed')
    this.name = 'VaultUnavailableError'
  }
}

// O regex roda ANTES do Buffer.from: `Buffer.from('zz…','hex')` não lança, só
// devolve um buffer curto/vazio, e a checagem de comprimento depois fecha o
// caso residual.
const HEX_64 = /^[0-9a-fA-F]{64}$/

export function getVaultKeyOrNull(): Buffer | null {
  const hex = process.env.SOCIAL_MASTER_KEY
  if (!hex || !HEX_64.test(hex)) return null
  const buf = Buffer.from(hex, 'hex')
  return buf.length === 32 ? buf : null
}

/**
 * MUST NOT throw. A marcação da conta é do CHAMADOR:
 *  - vault caído (getVaultKeyOrNull() === null) => não toca a conta;
 *  - row.access_token != null e token === null => markTokenInvalid('decrypt_failed');
 *  - row.access_token == null => "not connected".
 */
export function readAccessToken(row: { access_token: string | null }): {
  token: string | null
  legacy: boolean
} {
  const raw = row.access_token
  if (raw == null) return { token: null, legacy: false }
  // `v1:` é marcador de FORMATO, não domínio criptográfico (§8).
  if (!raw.startsWith('v1:')) return { token: raw, legacy: true }
  const key = getVaultKeyOrNull()
  if (key === null) return { token: null, legacy: false }
  try {
    return { token: decrypt(raw.slice(3), key), legacy: false }
  } catch {
    return { token: null, legacy: false }
  }
}

export function writeAccessToken(plain: string): string {
  const key = getVaultKeyOrNull()
  if (key === null) throw new VaultUnavailableError()
  return `v1:${encrypt(plain, key)}`
}

// ── Classificação de erro ────────────────────────────────────────────────────

export type ErrorClass = 'infra' | 'transient' | 'permanent'

interface IErrorShape {
  code?: unknown
  error_subcode?: unknown
  type?: unknown
  httpStatus?: unknown
  is_transient?: unknown
  message?: unknown
  details?: unknown
  hint?: unknown
}

const TRANSIENT_CODES = new Set([1, 2, 4, 17, 32, 341, 613])
const PERMANENT_CODES = new Set([10, 102, 190])

function isPostgrestShape(err: unknown): boolean {
  if (!err || typeof err !== 'object' || err instanceof Error) return false
  const o = err as Record<string, unknown>
  return typeof o.code === 'string' && ('details' in o || 'hint' in o)
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof TypeError) return true
  const name = err instanceof Error ? err.name : ''
  if (name === 'AbortError' || name === 'TimeoutError') return true
  const msg = err instanceof Error ? err.message : ''
  return /fetch failed|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up/i.test(msg)
}

/**
 * Sequência ORDENADA (MUST): avaliada de cima para baixo, devolve no primeiro
 * casamento. Nenhuma cláusula vence por prosa.
 */
export function classifyInstagramError(err: unknown): ErrorClass {
  const e = (err && typeof err === 'object' ? err : {}) as IErrorShape
  const message = typeof e.message === 'string' ? e.message : String(err)
  const type = typeof e.type === 'string' ? e.type : ''
  const numericCode = typeof e.code === 'number' ? e.code : undefined
  const httpStatus = typeof e.httpStatus === 'number' ? e.httpStatus : undefined
  // Achado 1 (fix round C2): `numericCode`/`httpStatus`/`type` só existem,
  // NESTA base de código, em erros construídos por api-client.ts a partir de
  // uma resposta HTTP real da Meta (InstagramApiError) — Postgrest usa `code`
  // como STRING, e o client do Supabase (JWT/auth) usa `.status`, nunca
  // `.httpStatus`. Presença de qualquer um destes três é portanto evidência
  // de que o erro veio do VENDOR, e é a única coisa que autoriza o
  // casamento-por-texto genérico logo abaixo.
  const isVendorError = numericCode !== undefined || httpStatus !== undefined || type !== ''

  const result = ((): ErrorClass => {
    // (1) infra — bug nosso, nunca token do usuário. Vem ANTES do permanente
    // para tornar o modo de falha "nome de campo errado marca a frota inteira"
    // estruturalmente impossível.
    if (
      e.code === '23505' ||
      /duplicate key value/i.test(message) ||
      /PGRST/.test(String(e.code ?? '')) ||
      /PGRST/.test(message) ||
      isPostgrestShape(err) ||
      (numericCode === 100 && /nonexisting field|tried accessing nonexisting/i.test(message))
    ) return 'infra'

    // (2) transient — inclui 5xx/429 SOB OAuthException, por estar antes de (3).
    if (
      (numericCode !== undefined && TRANSIENT_CODES.has(numericCode)) ||
      e.is_transient === true ||
      /less than 24 hours|too soon|rate limit|too many calls/i.test(message) ||
      (httpStatus !== undefined && (httpStatus >= 500 || httpStatus === 429)) ||
      isNetworkFailure(err)
    ) return 'transient'

    // (3) permanent
    if (
      type === 'OAuthException' ||
      httpStatus === 401 ||
      httpStatus === 403 ||
      (numericCode !== undefined &&
        (PERMANENT_CODES.has(numericCode) || (numericCode >= 200 && numericCode <= 299))) ||
      (numericCode === 100 &&
        /access.?token|does not exist|unsupported get request/i.test(message) &&
        !/nonexisting field/i.test(message)) ||
      // Sentinelas INTERNAS e EXATAS — strings que só o NOSSO código emite
      // (decrypt_failed vem de readAccessToken; as duas frases de "conta
      // desconectada" vêm de sync.ts). Não são "palavra sugestiva" numa
      // mensagem alheia: são um valor de controle que definimos nós mesmos, e
      // nenhum erro de infra/JWT as reproduz por acidente — por isso não
      // exigem `isVendorError`.
      /decrypt_failed|No Instagram user ID|No access token/.test(message) ||
      // Achado 1 (fix round C2): as frases GENÉRICAS em inglês abaixo
      // (expired/invalidated/revoked/invalid…token) só valem como `permanent`
      // quando o erro já tem evidência de vir do VENDOR. Sem essa guarda, um
      // `Error('JWT expired')` levantado pelo client do banco (ex.: chave de
      // service-role rotacionada) atravessava as camadas infra/transient e
      // saía `permanent` — marcando a frota inteira como token inválido por
      // um problema que não é do usuário nem da Meta.
      (isVendorError && /invalidated|expired|revoked|invalid.*token/i.test(message))
    ) return 'permanent'

    // (4) default
    return 'transient'
  })()

  // Telemetria de calibração (MUST, §3.2): a tupla, redigida, sem token.
  try {
    Sentry.addBreadcrumb({
      category: 'instagram.classify',
      level: 'info',
      message: redact(message).slice(0, 200),
      data: {
        code: typeof e.code === 'string' || typeof e.code === 'number' ? e.code : null,
        error_subcode:
          typeof e.error_subcode === 'string' || typeof e.error_subcode === 'number'
            ? e.error_subcode
            : null,
        type: type || null,
        httpStatus: httpStatus ?? null,
        result,
      },
    })
  } catch {
    // telemetria nunca altera o desfecho da classificação
  }

  return result
}

// ── Episódio de token (C2) ───────────────────────────────────────────────────

export interface IMarkTokenInvalidOpts {
  /** false = abre episódio transitório (nunca grava token_error). */
  fatal: boolean
  /** true = sobrescreve o motivo e re-arma o alerta (só Meta: deauthorize / data-deletion). */
  forceReason?: boolean
  mode?: 'daily' | 'token_refresh'
}

export class MarkTokenInvalidError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MarkTokenInvalidError'
  }
}

export async function markTokenInvalid(
  supabase: SupabaseClient,
  account: { id: string; site_id: string },
  reason: string,
  opts: IMarkTokenInvalidOpts,
): Promise<void> {
  const pReason = redact(String(reason)).slice(0, 500)

  const { error } = await supabase.rpc('instagram_mark_token_invalid', {
    p_account: account.id,
    p_site: account.site_id,
    p_reason: pReason,
    p_fatal: opts.fatal,
    p_force_reason: opts.forceReason ?? false,
    p_mode: opts.mode ?? null,
  })

  if (!error) return

  // Achado 2 (fix round C2): o fallback de `update` direto que existia aqui
  // não reproduzia NENHUMA das guardas da função (branch fatal/transient,
  // force_reason, "só se token_error_at IS NULL") — uma chamada NÃO-FATAL
  // (ex.: token_refresh transitório) chegando durante um episódio FATAL já
  // aberto sobrescrevia silenciosamente `token_error` com `null` e
  // `token_error_at` com `now()`, apagando o motivo e o início registrados de
  // um token expirado/revogado e rebaixando-o a transitório. Sem reproduzir
  // fielmente as guardas da RPC, o fallback correto é NÃO ESCREVER NADA:
  // reportar a falha e deixar a linha intocada. Perder UMA marcação é
  // recuperável no próximo run (`evaluateTransientStreak`/o cron tentam de
  // novo); corromper o episódio registrado não é.
  Sentry.captureException(
    new Error(`instagram_mark_token_invalid failed: ${error.message}`),
    { tags: { component: 'instagram-token', account_id: account.id } },
  )

  throw new MarkTokenInvalidError(error.message)
}

const STREAK_WINDOW_MS = 4 * 24 * 60 * 60 * 1000
const STREAK_DAYS_REQUIRED = 3

function utcDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

/**
 * Avaliada POR MODO. Um `completed` de `daily` prova que a LEITURA funciona,
 * não que a RENOVAÇÃO funciona — deixá-lo zerar a sequência do `token_refresh`
 * reintroduz exatamente a morte silenciosa de §1.
 * Predicado semântico em TS (select largo + filtro), conforme a nota de execução.
 */
export async function evaluateTransientStreak(
  supabase: SupabaseClient,
  account: { id: string; site_id: string },
  mode: 'daily' | 'token_refresh',
): Promise<boolean> {
  const since = new Date(Date.now() - STREAK_WINDOW_MS).toISOString()

  const { data, error } = await supabase
    .from('instagram_sync_log')
    .select('started_at, mode, status, error_message')
    .eq('account_id', account.id)
    .in('mode', ['daily', 'token_refresh'])
    .in('status', ['completed', 'failed'])
    .gt('started_at', since)

  if (error) throw new Error(`transient streak query failed: ${error.message}`)

  const rows = (data ?? []) as Array<{
    started_at: string
    mode: string
    status: string
    error_message: string | null
  }>

  // Só linhas `failed` com prefixo `transient:` contam. As demais não contam
  // NEM zeram.
  const failures = rows.filter(
    (r) =>
      r.mode === mode &&
      r.status === 'failed' &&
      (r.error_message ?? '').startsWith('transient:'),
  )
  if (failures.length === 0) return false

  const days = new Set(failures.map((r) => utcDay(r.started_at)))
  if (days.size < STREAK_DAYS_REQUIRED) return false

  const oldestFailure = failures.reduce((a, b) => (a.started_at <= b.started_at ? a : b)).started_at
  const recovered = rows.some(
    (r) => r.mode === mode && r.status === 'completed' && r.started_at > oldestFailure,
  )
  if (recovered) return false

  await markTokenInvalid(supabase, account, 'transient', { fatal: false, mode })
  return true
}

/**
 * Sonda de VIDA do token — nenhum campo de perfil. É ela que dá a detecção em
 * ≤ 24 h (§3.4): roda para TODA conta com token, com timeout duro de 10 s, e
 * nunca lança (um throw aqui mataria o run e perderia os alertas do dia).
 */
export async function probeToken(
  token: string,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    const res = await fetch(`${GRAPH_API_BASE}/me?fields=id&access_token=${token}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return { ok: true }
    return { ok: false, error: await instagramErrorFromResponse(res) }
  } catch (err) {
    return { ok: false, error: err }
  }
}

// ── Varredura e entrega do alerta de token (C2) ─────────────────────────────
// ÚNICA porta de saída do alerta. §0: silêncio é o modo de falha que este
// projeto inteiro existe para eliminar — nenhum caminho abaixo pode gravar um
// carimbo de "entregue" sem confirmação de entrega.

export type TokenAlertKind = TokenKind

export interface ITokenAlertRow {
  id: string
  site_id: string
  handle: string
  ig_user_id: string | null
  ig_user_id_source: 'oauth' | 'legacy'
  token_error: string | null
  token_error_at: string | null
  token_error_mode: 'daily' | 'token_refresh' | null
  token_alert_sent_at: string | null
  token_alert_attempt_at: string | null
}

export interface ITokenAlertGroup {
  siteId: string
  identityKey: string
  handle: string
  slug: string | null
  subject: 'feed sync' | 'auto-renewal' | 'sync'
  rows: ITokenAlertRow[]
}

export type NtfyOutcome = 'sent' | 'skipped' | 'failed_transient' | 'failed_terminal'

export interface ITokenAlertResult {
  siteId: string
  identityKey: string
  notifications: number
  ntfy: NtfyOutcome
}

const HOUR_MS = 3_600_000
const SWEEP_BUDGET_MS = 25_000
/** Medido no gate pós-C2 (§7). Se o p99 real passar disto, sobe aqui. */
const WORST_GROUP_MS = 12_000
const SEVERITY: Record<TokenAlertKind, number> = { transient: 0, expired: 1, invalid: 2, revoked: 3 }
const LONG_OPEN_MS = 69 * HOUR_MS

const TOKEN_ALERT_COLUMNS =
  'id, site_id, handle, ig_user_id, ig_user_id_source, token_error, token_error_at, token_error_mode, token_alert_sent_at, token_alert_attempt_at'

export function identityKeyOf(
  row: Pick<ITokenAlertRow, 'ig_user_id_source' | 'ig_user_id' | 'handle'>,
): string {
  return row.ig_user_id_source === 'oauth' && row.ig_user_id
    ? `o:${row.ig_user_id}`
    : `h:${row.handle.toLowerCase()}`
}

/** Resolvido 1× por run e compartilhado com o `expiring_clean` do cron (§3.3). */
export async function loadSiteSlugs(
  supabase: SupabaseClient,
  siteIds: string[],
): Promise<Map<string, string>> {
  if (siteIds.length === 0) return new Map()
  const { data } = await supabase.from('sites').select('id, slug').in('id', siteIds)
  return new Map(
    ((data ?? []) as Array<{ id: string; slug: string }>).map((s) => [s.id, s.slug]),
  )
}

function cadenceMs(row: ITokenAlertRow, now: number): number {
  if (row.token_alert_attempt_at != null && row.token_alert_sent_at == null) return HOUR_MS
  if (
    row.token_alert_sent_at != null &&
    row.token_error_at != null &&
    Date.parse(row.token_error_at) > now - 14 * 24 * HOUR_MS
  ) {
    return 23 * HOUR_MS
  }
  return (6 * 24 + 23) * HOUR_MS
}

function subjectFor(rows: ITokenAlertRow[]): 'feed sync' | 'auto-renewal' | 'sync' {
  // token_error_mode nulo = episódio fatal, cujo sujeito natural é a renovação.
  const modes = new Set(rows.map((r) => r.token_error_mode ?? 'token_refresh'))
  if (modes.size > 1) return 'sync'
  return modes.has('daily') ? 'feed sync' : 'auto-renewal'
}

function titleBase(
  kind: TokenAlertKind,
  subject: string,
  opts: { reminder: boolean; longOpen: boolean },
): string {
  if (kind === 'transient') {
    if (opts.longOpen) return `Instagram ${subject} still failing`
    if (opts.reminder) return `Instagram ${subject} still retrying`
    return `Instagram ${subject} failing`
  }
  if (opts.reminder) return 'Instagram still disconnected'
  if (kind === 'expired') return 'Instagram token expired'
  if (kind === 'revoked') return 'Instagram access revoked'
  return 'Instagram token invalid'
}

function escapeForEmail(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
  const week =
    1 + Math.round(((t.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return `${t.getUTCFullYear()}-${String(week).padStart(2, '0')}`
}

export async function deliverTokenAlert(
  supabase: SupabaseClient,
  group: ITokenAlertGroup,
  kind: TokenAlertKind,
  errorDay: string,
  opts: { reminder: boolean; longOpen: boolean },
): Promise<ITokenAlertResult> {
  // Nunca lança: é a última perna antes do dono, e um throw aqui derrubaria a
  // varredura inteira do run.
  try {
    const now = new Date()
    const nowIso = now.toISOString()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'
    const settingsUrl = `${appUrl}/cms/settings/instagram`

    const base = titleBase(kind, group.subject, opts)
    // CMS + e-mail são superfícies AUTENTICADAS: o handle fica.
    const title = `${base} · @${group.handle.toLowerCase()}`
    // ntfy é tópico compartilhado e não autenticado: só o slug do site, nunca "@".
    const ntfyTitle = group.slug ? `${base} · ${group.slug}` : base
    // body FIXO — MUST NOT conter token_error, reason, tokens, ids.
    const body = `${group.rows.length} account(s) · open since ${errorDay}. Open the CMS for the reason.`

    const rawReason =
      group.rows.find((r) => r.token_error != null)?.token_error ??
      `${group.subject} keeps failing`
    const message = `${escapeForEmail(rawReason)} — ${RECONNECT_CTA} at ${settingsUrl}`

    // dedupKey: baseia na PRIMEIRA entrega do episódio; o sufixo muda pela
    // CADÊNCIA, nunca por sent_at — senão um ntfy nunca aceito congelaria a
    // chave e o índice UNIQUE parcial suprimiria CMS/e-mail a partir da 2ª.
    const nowMs = now.getTime()
    const groupCadence = Math.min(...group.rows.map((r) => cadenceMs(r, nowMs)))
    const firstOfEpisode = group.rows.every((r) => r.token_alert_attempt_at == null)
    const baseKey = `system.token_expired:instagram:${group.siteId}:${group.identityKey}:${errorDay}:${kind}`
    const dedupKey = firstOfEpisode
      ? baseKey
      : groupCadence <= 23 * HOUR_MS
        ? `${baseKey}:d${nowIso.slice(0, 10)}`
        : `${baseKey}:w${isoWeekKey(now)}`

    // (a) CMS + e-mail. O `title` EN explícito vence o title_template PT do registry.
    const fan = await fanOutToSiteAdminsDetailed({
      siteId: group.siteId,
      domain: 'system',
      type: 'system.token_expired',
      priority: 5,
      title,
      message,
      dedupKey,
      actionHref: '/cms/settings/instagram',
      defaultChannels: ['email'],
    })

    // (b) ntfy — `default`, nunca `high`: `high` fura o Não Perturbe e fica
    // reservado a canal caído / segundo cron.
    const ntfyRes = await sendNtfyAlert({
      title: ntfyTitle,
      body,
      priority: 'default',
      tags: ['rotating_light'],
      click: settingsUrl,
    })

    const ntfy: NtfyOutcome = ntfyRes.alerted
      ? 'sent'
      : ntfyRes.reason === 'NTFY_URL unset'
        ? 'skipped'
        : isTerminalRefusal(ntfyRes)
          ? 'failed_terminal'
          : 'failed_transient'

    if (ntfy === 'failed_terminal') {
      // DEVIATION (documentada em deliverTokenAlert): isolado no seu próprio
      // try/catch. No snippet do plano esta chamada roda dentro do MESMO
      // try/catch que envolve a função inteira — se ela lançasse (ex.: o
      // próprio canal de e-mail de fallback falhando), o catch externo
      // reclassificaria `ntfy` já corretamente calculado para
      // 'failed_transient' e pularia as escritas de attempt_at/sent_at logo
      // abaixo, apagando o resultado correto do alerta primário (que já foi
      // entregue com sucesso pelo fan-out acima) sem motivo. Isolar evita que
      // uma falha no aviso de "canal caído" corrompa o carimbo do alerta
      // principal.
      try {
        await fanOutToSiteAdminsDetailed({
          siteId: group.siteId,
          domain: 'system',
          type: 'system.cron_failure',
          priority: 5,
          title: 'Instagram alert channel down',
          message: `ntfy rejected (HTTP ${ntfyRes.ntfyStatus ?? 'unknown'})`,
          dedupKey: `instagram-alert-channel-down:${nowIso.slice(0, 10)}`,
          defaultChannels: ['email'],
        })
      } catch (fallbackErr) {
        Sentry.captureException(fallbackErr, {
          tags: { component: 'instagram-token-alert-channel-down' },
        })
      }
    }
    if (ntfy === 'failed_terminal' || ntfy === 'failed_transient') {
      Sentry.captureMessage('instagram token alert: ntfy not accepted', 'error')
    }

    // (c) marcas-passo: attempt_at em TODAS as linhas — sinaliza só "tentamos",
    // nunca "entregamos". sent_at nas linhas ainda nulas, e SÓ quando AMBOS os
    // canais confirmaram: ntfy aceito E ao menos 1 admin recebeu CMS/e-mail.
    // DEVIATION: o snippet do plano condicionava sent_at só a `ntfyRes.alerted`,
    // ignorando `fan.sent`. Isso deixava a cadência recuar para 23h/semanal
    // quando o push (efêmero, pode passar despercebido) foi aceito mas o
    // fan-out para CMS/e-mail (canal durável e acionável) falhou por completo
    // (`fan.sent === 0`, ex.: site sem admins) — o dono nunca veria o aviso em
    // nenhum lugar revisitável e o sistema, ainda assim, pararia de insistir.
    // Exigir os dois fecha exatamente o buraco de silêncio que este módulo
    // existe para eliminar, sem quebrar nenhum teste dado (o mock de fan-out
    // usado nos testes de sucesso já resolve com sent >= 1).
    const ids = group.rows.map((r) => r.id)
    await supabase
      .from('instagram_accounts')
      .update({ token_alert_attempt_at: nowIso })
      .in('id', ids)

    if (ntfyRes.alerted && fan.sent > 0) {
      const unsent = group.rows.filter((r) => r.token_alert_sent_at == null).map((r) => r.id)
      if (unsent.length > 0) {
        await supabase
          .from('instagram_accounts')
          .update({ token_alert_sent_at: nowIso })
          .in('id', unsent)
      }
    }

    return {
      siteId: group.siteId,
      identityKey: group.identityKey,
      notifications: fan.sent,
      ntfy,
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'instagram-token-alert' } })
    return {
      siteId: group.siteId,
      identityKey: group.identityKey,
      notifications: 0,
      ntfy: 'failed_transient',
    }
  }
}

/** ÚNICA porta de saída do alerta de token. */
export async function sweepTokenAlerts(
  supabase: SupabaseClient,
  filter?: { siteId?: string; identityKey?: string },
): Promise<ITokenAlertResult[]> {
  // MUST: `sweepStart` na PRIMEIRA linha. Medido a partir do runStart do cron,
  // `elapsed + 12_000 > 25_000` valeria para todo grupo, nada iniciaria,
  // attempt_at ficaria nulo e um token morreria sem ninguém ser avisado.
  const sweepStart = Date.now()

  const base = supabase
    .from('instagram_accounts')
    .select(TOKEN_ALERT_COLUMNS)
    .not('token_error_at', 'is', null)
  const { data, error } = await (filter?.siteId ? base.eq('site_id', filter.siteId) : base)
  if (error) throw new Error(`sweep select failed: ${error.message}`)

  const rows = (data ?? []) as ITokenAlertRow[]

  const buckets = new Map<string, ITokenAlertRow[]>()
  for (const row of rows) {
    const identityKey = identityKeyOf(row)
    if (filter?.identityKey && identityKey !== filter.identityKey) continue
    const key = `${row.site_id}|${identityKey}`
    const bucket = buckets.get(key)
    if (bucket) bucket.push(row)
    else buckets.set(key, [row])
  }

  const slugs = await loadSiteSlugs(
    supabase,
    [...new Set([...buckets.values()].map((g) => g[0]!.site_id))],
  )

  const results: ITokenAlertResult[] = []

  for (const groupRows of buckets.values()) {
    // Teto verificado ANTES de iniciar cada grupo, com `elapsed` relativo a
    // sweepStart. Grupos não iniciados ficam com attempt_at intocado => a
    // cadência permanece 1 h e eles saem na varredura seguinte.
    if (Date.now() - sweepStart + WORST_GROUP_MS > SWEEP_BUDGET_MS) break

    const now = Date.now()
    const due = groupRows.some(
      (r) =>
        r.token_alert_attempt_at == null ||
        Date.parse(r.token_alert_attempt_at) < now - cadenceMs(r, now),
    )
    if (!due) continue

    const first = groupRows[0]!
    const kind = groupRows
      .map((r) => kindFrom(r))
      .reduce((a, b) => (SEVERITY[a] >= SEVERITY[b] ? a : b))
    const errorDayMs = Math.min(
      ...groupRows.map((r) => (r.token_error_at ? Date.parse(r.token_error_at) : now)),
    )
    const errorDay = new Date(errorDayMs).toISOString().slice(0, 10)

    const group: ITokenAlertGroup = {
      siteId: first.site_id,
      identityKey: identityKeyOf(first),
      handle: first.handle,
      slug: slugs.get(first.site_id) ?? null,
      subject: subjectFor(groupRows),
      rows: groupRows,
    }

    results.push(
      await deliverTokenAlert(supabase, group, kind, errorDay, {
        reminder: groupRows.some((r) => r.token_alert_sent_at != null),
        longOpen: kind === 'transient' && errorDayMs < now - LONG_OPEN_MS,
      }),
    )
  }

  return results
}
