import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { refreshAccessToken } from '@/lib/instagram/api-client'
import { openSyncRow, closeSyncRow } from '@/lib/instagram/sync-log'
import {
  classifyInstagramError,
  evaluateTransientStreak,
  getVaultKeyOrNull,
  loadSiteSlugs,
  markTokenInvalid,
  readAccessToken,
  redact,
  sweepTokenAlerts,
  writeAccessToken,
  type NtfyOutcome,
} from '@/lib/instagram/token'
import { resumeStuckDeletionRequest, DELETION_BLOB_BUDGET_MS } from '@/lib/instagram/deletion'
import { sendNtfyAlert, sendNtfyHeartbeat, isTerminalRefusal, type INtfyResult } from '@/lib/ops/ntfy'
import { claimAlert, readAlertStamp, releaseAlert, touchAlert } from '@/lib/ops/alert-state'
import {
  NO_SITE_ADMINS_ERROR,
  fanOutToSiteAdminsDetailed,
} from '@/lib/notifications/fan-out-to-admins'
import type { InstagramAccountRow, SyncResult } from '@/lib/instagram/types'

export const runtime = 'nodejs'
// 180: o projeto já entrega quatro crons com 300 no plano Pro.
export const maxDuration = 180

const HOUR = 3_600_000
const CRON_TAG = 'instagram-token-refresh'
const WORK_PHASE_BUDGET_MS = 35_000
const OPTIONAL_GATE_MS = 8_000
const REFRESH_MIN_AGE_MS = 25 * HOUR
const SELECT_STALE_MS = 167 * HOUR
const SELECT_EXPIRY_MS = 15 * 24 * HOUR
const REPROBE_SOON_MS = 23 * HOUR
const REPROBE_LATE_MS = 167 * HOUR
const EXPIRING_WINDOW_MS = 7 * 24 * HOUR
const RETENTION_MS = 180 * 24 * HOUR
const ORPHAN_MS = 30 * 60_000
const EPISODE_KEY = `ntfy_transient:${CRON_TAG}`
const HEARTBEAT_STALE_MS = 8 * 24 * HOUR

const EMPTY_RESULT: SyncResult = {
  postsFound: 0, postsInserted: 0, postsUpdated: 0, mediaCached: 0, partial: false, mediaFailed: 0,
}

function ms(iso: string | null): number | null {
  return iso ? Date.parse(iso) : null
}

/**
 * DEVIATION (plan bug): o plano extrai a mensagem do erro com
 * `err instanceof Error ? err.message : String(err)`. Erros vindos do
 * PostgREST/Supabase (ex.: `{ code: '23505', message: '…', details, hint }`)
 * chegam como OBJETO PLANO, não `Error` — `String(err)` devolve
 * `'[object Object]'`, apagando a mensagem real e quebrando o casamento por
 * texto (`/duplicate key value…/`) que a janela C2→C4 depende. Corrigido
 * espelhando a extração já usada em `classifyInstagramError`
 * (`typeof e.message === 'string'`).
 */
function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message
  }
  return String(err)
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, CRON_TAG, runId, CRON_TAG, async () => {
    const runStart = Date.now()

    let stepErrors = 0
    let refreshed = 0
    let skippedFresh = 0
    let reprobed = 0
    let failedPermanent = 0
    let failedTransient = 0
    let failedInfra = 0
    let deferred = 0

    // Cada recusa alimenta o passo 7. `alerts` guarda o desfecho de cada grupo.
    const refusals: INtfyResult[] = []
    let acceptedAny = false
    const alertOutcomes: NtfyOutcome[] = []

    /** Toda etapa em try/catch: exceção => captureException + step_errors++, nunca propaga. */
    async function step(name: string, fn: () => Promise<void>): Promise<void> {
      try {
        await fn()
      } catch (err) {
        stepErrors++
        Sentry.captureException(err, { tags: { component: CRON_TAG, step: name } })
      }
    }

    function noteDelivery(result: INtfyResult): void {
      if (result.alerted) acceptedAny = true
      else if (result.reason !== 'NTFY_URL unset') refusals.push(result)
    }

    // ── passo 0: DELIBERADAMENTE VAZIO ──────────────────────────────────────
    // As duas emissões de canal viraram o passo 5b. NADA de rede roda antes do
    // passo 1 — é essa invariante que torna o portão de 8 s do passo 3
    // alcançável e devolve os 35 s inteiros ao trabalho de token.
    // MUST: um patch que reintroduza sendNtfyAlert/sendNtfyHeartbeat aqui é
    // recusado; §6 tem o teste de regressão.

    // ── passo 1: flags ──────────────────────────────────────────────────────
    const isProduction = process.env.VERCEL_ENV === 'production'
    const alertChannelUnset = !process.env.NTFY_URL
    const vaultDown = getVaultKeyOrNull() === null

    // ── passo 2: select inicial (ÚNICO retorno cedo) ────────────────────────
    const { data: accountsData, error: selectError } = await supabase
      .from('instagram_accounts')
      .select('*')
      .order('last_synced_at', { ascending: true, nullsFirst: true })

    if (selectError) {
      return { status: 'error' as const, error: `select failed: ${selectError.message}` }
    }
    const accounts = (accountsData ?? []) as InstagramAccountRow[]

    // ── passo 3: independentes da seleção ───────────────────────────────────
    await step('orphans', async () => {
      const cutoff = new Date(Date.now() - ORPHAN_MS).toISOString()
      const { data: orphans } = await supabase
        .from('instagram_sync_log')
        .select('id, mode')
        .eq('status', 'started')
        .lt('started_at', cutoff)
      const rows = (orphans ?? []) as Array<{ id: string; mode: string }>
      if (rows.length === 0) return
      await supabase
        .from('instagram_sync_log')
        .update({ status: 'failed', error_message: 'timeout', completed_at: new Date().toISOString() })
        .in('id', rows.map((r) => r.id))
      if (rows.some((r) => r.mode === 'manual')) {
        Sentry.captureMessage('instagram manual sync timed out', 'warning')
      }
    })

    await step('retention', async () => {
      const cutoff = new Date(Date.now() - RETENTION_MS).toISOString()
      await supabase.from('instagram_sync_log').delete().lt('created_at', cutoff)
      await supabase.from('instagram_deletion_requests').delete().lt('requested_at', cutoff)
      // MUST: a retenção de ops_alert_state roda nos DOIS crons — com uma só
      // varredora, um mês de cron parado deixa as linhas por-IP-por-dia de
      // /data-deletion acumulando numa base de 500 MB.
      const twoDays = new Date(Date.now() - 2 * 24 * HOUR).toISOString()
      await supabase.from('ops_alert_state').delete().like('key', 'ddpage:%').lt('last_at', twoDays)
      await supabase.from('ops_alert_state').delete().like('key', 'sigreq:%').lt('last_at', twoDays)
    })

    await step('resume-deletion', async () => {
      await resumeStuckDeletionRequest(supabase, runStart + DELETION_BLOB_BUDGET_MS)
    })

    const slugs = await loadSiteSlugs(supabase, [...new Set(accounts.map((a) => a.site_id))])

    await step('expiring-clean', async () => {
      const horizon = Date.now() + EXPIRING_WINDOW_MS
      // MUST: dispara TAMBÉM com episódio transitório aberto — o predicado é
      // `token_error is null`, não "episódio limpo". O predicado antigo
      // desligava o único aviso de expiração justamente quando a renovação já
      // estava falhando.
      const expiring = accounts.filter((a) => {
        const exp = ms(a.token_expires_at ?? null)
        return a.token_error == null && exp !== null && exp <= horizon
      })
      for (const account of expiring) {
        const key = `expiring_clean:${account.id}`
        // Portão medido ANTES de qualquer chamada ao ntfy do run.
        if (Date.now() - runStart >= OPTIONAL_GATE_MS) {
          await releaseAlert(supabase, key)
          continue
        }
        if (!(await claimAlert(supabase, key, '23 hours'))) continue
        if (Date.now() - runStart >= OPTIONAL_GATE_MS) {
          await releaseAlert(supabase, key)
          continue
        }
        const days = Math.max(0, Math.ceil((ms(account.token_expires_at ?? null)! - Date.now()) / (24 * HOUR)))
        Sentry.captureMessage(
          `instagram token expiring without renewal: @${account.handle} in ${days}d`,
          'warning',
        )
        const slug = slugs.get(account.site_id)
        // REGRA-PII-NTFY (§0): nunca `· @handle` aqui — só o slug do site.
        const result = await sendNtfyAlert({
          title: `Instagram token expiring without renewal${slug ? ` · ${slug}` : ''}`,
          body: `${days} day(s) left. Open the CMS to reconnect.`,
          priority: 'default',
          tags: ['warning'],
          click: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cms/settings/instagram`,
        })
        noteDelivery(result)
      }
    })

    // ── passo 4: seleção + reprova sob o deadline DA FASE ────────────────────
    const workPhaseStart = Date.now()
    const deadline = workPhaseStart + WORK_PHASE_BUDGET_MS

    function needsRefresh(a: InstagramAccountRow): boolean {
      if (a.access_token == null || a.token_error != null) return false
      const exp = ms(a.token_expires_at ?? null)
      const refreshedAt = ms(a.token_refreshed_at ?? null) ?? Date.parse(a.created_at)
      return (
        (exp !== null && exp < Date.now() + SELECT_EXPIRY_MS) ||
        exp === null ||
        refreshedAt < Date.now() - SELECT_STALE_MS
      )
    }

    function needsReprobe(a: InstagramAccountRow): boolean {
      if (a.access_token == null || a.token_error == null) return false
      const last = ms(a.token_reprobe_at ?? null) ?? ms(a.token_error_at ?? null)
      if (last === null) return true
      const exp = ms(a.token_expires_at ?? null)
      const interval = exp !== null && exp <= Date.now() + 10 * 24 * HOUR ? REPROBE_SOON_MS : REPROBE_LATE_MS
      return last < Date.now() - interval
    }

    const work = accounts.filter((a) => needsRefresh(a) || needsReprobe(a))

    for (const account of work) {
      if (Date.now() >= deadline) {
        deferred++
        await step('deferred-signal', async () => {
          if (await claimAlert(supabase, `deferred:${account.id}`, '23 hours')) {
            Sentry.captureMessage('instagram cron budget starving an account', 'warning')
          }
        })
        continue
      }
      if (vaultDown) {
        // Nenhuma conta é marcada, em nenhum ambiente.
        deferred++
        continue
      }

      const isReprobe = needsReprobe(account)

      await step(`account:${account.id}`, async () => {
        const { token } = readAccessToken(account)
        if (token === null) {
          await markTokenInvalid(supabase, account, 'decrypt_failed', { fatal: true })
          const logId = await openSyncRow(supabase, account, 'token_refresh')
          await closeSyncRow(supabase, logId, null, 'permanent: decrypt_failed')
          failedPermanent++
          return
        }

        // Token já expirado: linha `failed`/'expired' SEM chamada à Meta.
        const exp = ms(account.token_expires_at ?? null)
        if (exp !== null && exp <= Date.now()) {
          const logId = await openSyncRow(supabase, account, 'token_refresh')
          await markTokenInvalid(supabase, account, 'expired', { fatal: true })
          await closeSyncRow(supabase, logId, null, 'expired')
          failedPermanent++
          return
        }

        // A Meta exige "at least 24 hours old" — 25 h por causa do jitter.
        const refreshedAt = ms(account.token_refreshed_at ?? null)
        if (refreshedAt !== null && refreshedAt > Date.now() - REFRESH_MIN_AGE_MS) {
          skippedFresh++
          return
        }

        const logId = await openSyncRow(supabase, account, 'token_refresh')
        try {
          const { accessToken, expiresIn } = await refreshAccessToken(token)
          await supabase
            .from('instagram_accounts')
            .update({
              access_token: writeAccessToken(accessToken),
              token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
              token_refreshed_at: new Date().toISOString(),
              // Sucesso em QUALQUER caminho zera o episódio + o marca-passo.
              token_error: null,
              token_error_at: null,
              token_error_mode: null,
              token_alert_sent_at: null,
              token_alert_attempt_at: null,
              token_reprobe_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', account.id)
            .eq('site_id', account.site_id)

          if (isReprobe) {
            reprobed++
            await closeSyncRow(supabase, logId, EMPTY_RESULT)
            await supabase
              .from('instagram_sync_log')
              .update({ error_message: 'detail: recovered' })
              .eq('id', logId ?? '')
          } else {
            refreshed++
            await closeSyncRow(supabase, logId, EMPTY_RESULT)
          }
        } catch (err) {
          const kind = classifyInstagramError(err)
          const message = redact(errMessage(err))

          if (kind === 'infra') {
            await closeSyncRow(supabase, logId, null, `infra: ${message}`)
            failedInfra++
            // Exclusão explícita da janela C2→C4 (REMOVIDA EM C4): a segunda
            // linha de locale colide com instagram_posts_ig_media_id_key.
            if (/duplicate key value.*instagram_posts_ig_media_id_key/.test(message)) {
              if (await claimAlert(supabase, `c2c4dup:${account.id}`, '23 hours')) {
                Sentry.captureMessage('instagram duplicate media in C2→C4 window', 'info')
              }
            } else {
              stepErrors++
              Sentry.captureException(err, { tags: { component: CRON_TAG, account_id: account.id } })
            }
          } else if (kind === 'permanent') {
            await closeSyncRow(supabase, logId, null, `permanent: ${message}`)
            await markTokenInvalid(supabase, account, message, { fatal: true })
            failedPermanent++
          } else {
            await closeSyncRow(supabase, logId, null, `transient: ${message}`)
            await evaluateTransientStreak(supabase, account, 'token_refresh')
            failedTransient++
          }
        } finally {
          if (isReprobe) {
            await supabase
              .from('instagram_accounts')
              .update({ token_reprobe_at: new Date().toISOString() })
              .eq('id', account.id)
              .eq('site_id', account.site_id)
          }
        }
      })
    }

    // ── passo 5: varredura ──────────────────────────────────────────────────
    await step('sweep', async () => {
      const results = await sweepTokenAlerts(supabase)
      for (const r of results) {
        alertOutcomes.push(r.ntfy)
        if (r.ntfy === 'sent') acceptedAny = true
        else if (r.ntfy === 'failed_terminal') refusals.push({ alerted: false, ntfyStatus: 403 })
        else if (r.ntfy === 'failed_transient') refusals.push({ alerted: false, ntfyStatus: 503 })
      }
    })

    // ── passo 5b: canal (era o passo 0) ─────────────────────────────────────
    let probeOutcome: NtfyOutcome | 'not_due' = 'not_due'
    let heartbeatOutcome: NtfyOutcome | 'not_due' = 'not_due'

    function outcomeOf(r: INtfyResult): NtfyOutcome {
      if (r.alerted) return 'sent'
      if (r.reason === 'NTFY_URL unset') return 'skipped'
      return isTerminalRefusal(r) ? 'failed_terminal' : 'failed_transient'
    }

    await step('probe', async () => {
      // Chave COMPARTILHADA com o cron do sync — quem chegar primeiro emite.
      if (!(await claimAlert(supabase, 'ntfy_probe_due', '23 hours'))) return
      const result = await sendNtfyAlert({
        title: 'Instagram ops probe',
        body: 'channel probe',
        priority: 'min', // prioridade 1 entra na gaveta e não notifica o aparelho
        tags: ['mag'],
      })
      probeOutcome = outcomeOf(result)
      noteDelivery(result)
      if (result.alerted) await claimAlert(supabase, 'ntfy_heartbeat_ok', '0')
      else await releaseAlert(supabase, 'ntfy_probe_due')
    })

    await step('heartbeat', async () => {
      // Heartbeat visível é EXCLUSIVO deste cron.
      if (!(await claimAlert(supabase, 'ntfy_heartbeat_due', '5 days'))) return
      const result = await sendNtfyHeartbeat()
      heartbeatOutcome = outcomeOf(result)
      noteDelivery(result)
      if (result.alerted) await claimAlert(supabase, 'ntfy_heartbeat_ok', '0')
      else await releaseAlert(supabase, 'ntfy_heartbeat_due')
    })

    // ── passo 6: step_errors ────────────────────────────────────────────────
    if (stepErrors > 0) {
      await step('step-errors-push', async () => {
        if (!(await claimAlert(supabase, `step_errors:${CRON_TAG}`, '23 hours'))) return
        const result = await sendNtfyAlert({
          title: 'Instagram cron degraded',
          body: `${stepErrors} step(s) failed — see Sentry`,
          priority: 'default',
          tags: ['warning'],
          click: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cms/settings/instagram`,
        })
        noteDelivery(result)
      })
    }

    // ── passo 7: canal, status e segundo canal ──────────────────────────────
    const terminalRefusal = refusals.find((r) => isTerminalRefusal(r))
    let transientPersistent = false

    await step('channel-episode', async () => {
      if (refusals.length === 0) {
        // Todo run sem NENHUMA recusa (inclusive sem entrega) apaga a chave.
        await releaseAlert(supabase, EPISODE_KEY)
        return
      }
      if (await claimAlert(supabase, EPISODE_KEY, '365 days')) return // abre, não persistente
      const stamp = await readAlertStamp(supabase, EPISODE_KEY)
      if (!stamp) return
      const age = Date.now() - stamp.getTime()
      // "persistente" = o SEGUNDO run consecutivo do MESMO cron com recusa.
      // 24 h ± jitter; > 30 h é fóssil (cron parado, deploy longo).
      if (age >= 20 * HOUR && age <= 30 * HOUR) {
        transientPersistent = true
        await touchAlert(supabase, EPISODE_KEY)
      } else if (age > 30 * HOUR) {
        await touchAlert(supabase, EPISODE_KEY)
      }
    })

    let heartbeatStale = false
    await step('heartbeat-watch', async () => {
      const stamp = await readAlertStamp(supabase, 'ntfy_heartbeat_ok')
      // Carimbo AUSENTE não conta — o run de estreia é o caso esperado.
      if (stamp && Date.now() - stamp.getTime() > HEARTBEAT_STALE_MS) heartbeatStale = true
    })

    let fallbackEmailDead = false
    await step('dead-fallback-email', async () => {
      const { count } = await supabase
        .from('notification_deliveries')
        .select('id, notifications!inner(dedup_key)', { count: 'exact', head: true })
        .eq('status', 'dead')
        .gt('created_at', new Date(Date.now() - 2 * 24 * HOUR).toISOString())
        .like('notifications.dedup_key', 'instagram-alert-channel-down:%')
      if ((count ?? 0) > 0) fallbackEmailDead = true
    })

    const causes: string[] = []
    if (alertChannelUnset) causes.push('alert channel down: NTFY_URL unset')
    if (terminalRefusal) {
      causes.push(`alert channel down: terminal refusal (HTTP ${terminalRefusal.ntfyStatus ?? 'unknown'})`)
    }
    if (transientPersistent) causes.push('alert channel down: transient for 2 runs')
    if (heartbeatStale) {
      causes.push(
        `alert channel down: no heartbeat accepted for ${Math.floor(HEARTBEAT_STALE_MS / (24 * HOUR))}d`,
      )
    }
    if (fallbackEmailDead) causes.push('alert channel down: fallback email dead')
    if (vaultDown) causes.push('vault unavailable: SOCIAL_MASTER_KEY missing/malformed')

    const alertChannelPersistentlyDown =
      alertChannelUnset || Boolean(terminalRefusal) || transientPersistent || heartbeatStale || fallbackEmailDead

    const shouldEscalate = isProduction && (alertChannelPersistentlyDown || vaultDown)

    if (shouldEscalate) {
      await step('second-channel', async () => {
        const siteIds = [...new Set(accounts.map((a) => a.site_id))]
        for (const siteId of siteIds) {
          const fan = await fanOutToSiteAdminsDetailed({
            siteId,
            domain: 'system',
            type: 'system.cron_failure',
            priority: 5,
            title: vaultDown ? 'Instagram token storage unavailable' : 'Instagram alert channel down',
            message: causes.join(' · '),
            dedupKey: `instagram-alert-channel-down:${new Date().toISOString().slice(0, 10)}`,
            defaultChannels: ['email'],
          })
          if (fan.total === 0) {
            stepErrors++
            causes.push(NO_SITE_ADMINS_ERROR)
          }
        }
      })
    }

    const stillBroken = accounts.filter((a) => a.token_error_at != null).length

    // Important #2 (review blocos 3-5): `step_errors` MUST degradar a saúde
    // declarada do run. Sem isto, uma varredura morta, uma retenção que lançou
    // ou um `markTokenInvalid` que nem pelo fallback conseguiu escrever
    // devolviam `status:'ok'` => `recordCronSuccess` => `/api/health` verde,
    // com o dono dependendo de um único push genérico ("cron degraded") que a
    // primeira recusa transitória do episódio engole. Não é gated por
    // `isProduction`: uma etapa que lançou é falha real em qualquer ambiente.
    if (stepErrors > 0) causes.push(`${stepErrors} step(s) failed`)
    const status = shouldEscalate || stepErrors > 0 ? ('error' as const) : ('ok' as const)

    return {
      status,
      ...(status === 'error' ? { error: causes.join(' · ') } : {}),
      refreshed,
      skipped_fresh: skippedFresh,
      reprobed,
      failed_permanent: failedPermanent,
      failed_transient: failedTransient,
      failed_infra: failedInfra,
      still_broken: stillBroken,
      deferred,
      step_errors: stepErrors,
      ...(heartbeatOutcome !== 'not_due' ? { heartbeat: heartbeatOutcome } : {}),
      alert_channels: { probe: probeOutcome, heartbeat: heartbeatOutcome, alerts: alertOutcomes },
    }
  })
}
