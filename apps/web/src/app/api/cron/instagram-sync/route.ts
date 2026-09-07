import { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { list } from '@vercel/blob'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { syncInstagramAccount, checkImageCacheHealth } from '@/lib/instagram/sync'
import { openSyncRow, closeSyncRow } from '@/lib/instagram/sync-log'
import {
  classifyInstagramError,
  evaluateTransientStreak,
  getVaultKeyOrNull,
  markTokenInvalid,
  probeToken,
  readAccessToken,
  redact,
  sweepTokenAlerts,
  type NtfyOutcome,
} from '@/lib/instagram/token'
import { resumeStuckDeletionRequest, DELETION_BLOB_BUDGET_MS } from '@/lib/instagram/deletion'
import { sendNtfyAlert, isTerminalRefusal, type INtfyResult } from '@/lib/ops/ntfy'
import { claimAlert, readAlertStamp, releaseAlert, touchAlert } from '@/lib/ops/alert-state'
import { NO_SITE_ADMINS_ERROR, fanOutToSiteAdminsDetailed } from '@/lib/notifications/fan-out-to-admins'
import type { InstagramAccountRow, InstagramSyncMode } from '@/lib/instagram/types'

export const runtime = 'nodejs'
export const maxDuration = 180

const HOUR = 3_600_000
const CRON_TAG = 'instagram-sync'
// Absoluto POR DECISÃO: os probes que o precedem são isentos de orçamento e não
// podem empurrar o fim do run. 100 s (era 110) devolvem 17 s de folga contra os
// 180 s, agora que a sonda diária divide este cron.
const SYNC_DEADLINE_MS = 100_000
// Guarda contra RUNAWAY, nunca orçamento: 6 é o ponto de projeto que a
// aritmética de §3.4 fecha (12 × 10 s = 197 s > maxDuration => função morta,
// cron_health mudo e alertas do dia perdidos).
const MAX_PROBES_PER_RUN = 6
const OPTIONAL_GATE_MS = 8_000
const BLOB_WATCH_BYTES = 400 * 1024 * 1024
const BLOB_MAX_PAGES = 10
const BLOB_MAX_MS = 15_000
const RETENTION_MS = 180 * 24 * HOUR
const EPISODE_KEY = `ntfy_transient:${CRON_TAG}`
const HEARTBEAT_STALE_MS = 8 * 24 * HOUR

/**
 * DEVIATION (plan bug, herdada da Tarefa 12): `err instanceof Error ?
 * err.message : String(err)` devolve `'[object Object]'` para erros
 * PostgREST/Supabase (objeto plano, não `Error`) — apagando a mensagem real e
 * quebrando o casamento por texto da janela C2→C4. Corrigido espelhando a
 * extração já usada em `classifyInstagramError`.
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

  // MANTIDO por A/A5 — apagar `mode`/`accountId` é conteúdo de A5, nunca de C2.
  const mode = (req.nextUrl.searchParams.get('mode') ?? 'daily') as InstagramSyncMode
  if (!['daily', 'manual'].includes(mode)) {
    return Response.json({ error: 'invalid mode' }, { status: 400 })
  }
  const accountId = req.nextUrl.searchParams.get('accountId')

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, `instagram-sync-${mode}`, runId, CRON_TAG, async () => {
    const runStart = Date.now()

    let stepErrors = 0
    let probed = 0
    let synced = 0
    let totalInserted = 0
    let totalUpdated = 0
    let totalCached = 0
    let neverConnected = 0
    let tokenInvalid = 0
    let failedPermanent = 0
    let failedTransient = 0
    let failedInfra = 0
    let deferred = 0

    const refusals: INtfyResult[] = []
    const alertOutcomes: NtfyOutcome[] = []

    async function step(name: string, fn: () => Promise<void>): Promise<void> {
      try {
        await fn()
      } catch (err) {
        stepErrors++
        Sentry.captureException(err, { tags: { component: CRON_TAG, step: name } })
      }
    }

    function noteDelivery(result: INtfyResult): void {
      if (!result.alerted && result.reason !== 'NTFY_URL unset') refusals.push(result)
    }

    // passo 0: vazio (ver §3.3 — nada de rede antes do passo 1)

    // passo 1: flags
    const isProduction = process.env.VERCEL_ENV === 'production'
    const alertChannelUnset = !process.env.NTFY_URL
    const vaultDown = getVaultKeyOrNull() === null

    // passo 2: select
    let query = supabase
      .from('instagram_accounts')
      .select('*')
      .order('last_synced_at', { ascending: true, nullsFirst: true })
    if (accountId) query = query.eq('id', accountId)
    const { data: accountsData, error: selectError } = await query
    if (selectError) {
      return { status: 'error' as const, error: `select failed: ${selectError.message}` }
    }
    const accounts = (accountsData ?? []) as InstagramAccountRow[]

    // passo 3: independentes (retenção + retomada + CENSO DE BLOB)
    await step('retention', async () => {
      const cutoff = new Date(Date.now() - RETENTION_MS).toISOString()
      await supabase.from('instagram_sync_log').delete().lt('created_at', cutoff)
      await supabase.from('instagram_deletion_requests').delete().lt('requested_at', cutoff)
      const twoDays = new Date(Date.now() - 2 * 24 * HOUR).toISOString()
      await supabase.from('ops_alert_state').delete().like('key', 'ddpage:%').lt('last_at', twoDays)
      await supabase.from('ops_alert_state').delete().like('key', 'sigreq:%').lt('last_at', twoDays)
    })

    await step('resume-deletion', async () => {
      await resumeStuckDeletionRequest(supabase, runStart + DELETION_BLOB_BUDGET_MS)
    })

    await step('blob-census', async () => {
      if (Date.now() - runStart >= OPTIONAL_GATE_MS) {
        await releaseAlert(supabase, 'blobsize')
        return
      }
      if (!(await claimAlert(supabase, 'blobsize', '6 days 23 hours'))) return
      if (Date.now() - runStart >= OPTIONAL_GATE_MS) {
        await releaseAlert(supabase, 'blobsize')
        return
      }

      const censusStart = Date.now()
      const click = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cms/settings/instagram`
      let total = 0
      let objects = 0
      let pages = 0
      let cursor: string | undefined
      let truncated = false

      for (;;) {
        if (pages >= BLOB_MAX_PAGES || Date.now() - censusStart >= BLOB_MAX_MS) {
          truncated = true
          break
        }
        const page = await list({ prefix: 'instagram/', cursor, limit: 1000 })
        pages++
        for (const blob of page.blobs) {
          total += blob.size
          objects++
        }
        if (!page.hasMore) break
        cursor = page.cursor
      }

      if (truncated) {
        // MUST: comparar uma soma sabidamente parcial faria o monitor emudecer
        // exatamente quando o que ele vigia cresce.
        noteDelivery(
          await sendNtfyAlert({
            title: `Instagram blob census truncated at ${objects} objects`,
            body: 'The instagram/ census hit its page/time cap — no size comparison was made. See the runbook.',
            priority: 'low',
            tags: ['package'],
            click,
          }),
        )
        return
      }
      if (total > BLOB_WATCH_BYTES) {
        noteDelivery(
          await sendNtfyAlert({
            title: `Instagram blob store at ${Math.round(total / (1024 * 1024))} MB`,
            body: 'Prefix instagram/ is above the 400 MB watch line. See the runbook.',
            priority: 'low',
            tags: ['package'],
            click,
          }),
        )
      }
    })

    // ── PROBES: toda conta com token, ISENTAS de deadline e de orçamento ────
    const withToken = accounts.filter((a) => a.access_token != null)

    if (withToken.length > MAX_PROBES_PER_RUN) {
      // Condição de FROTA, nunca de descarte: é acima do ponto de projeto que a
      // aritmética de maxDuration MUST ser refeita.
      await step('probe-starved', async () => {
        if (await claimAlert(supabase, 'probe_starved', '23 hours')) {
          Sentry.captureMessage('instagram probe fleet exceeds design point', 'warning')
        }
      })
    }

    const probeTargets = withToken.slice(0, MAX_PROBES_PER_RUN)
    const skippedProbes = withToken.slice(MAX_PROBES_PER_RUN)
    deferred += skippedProbes.length

    for (const account of accounts.filter((a) => a.access_token == null)) {
      await step(`never-connected:${account.id}`, async () => {
        if (!(await claimAlert(supabase, `never_connected:${account.id}`, '6 days 23 hours'))) return
        neverConnected++
        const logId = await openSyncRow(supabase, account, 'daily')
        await closeSyncRow(supabase, logId, null, 'never_connected')
      })
    }

    for (const account of probeTargets) {
      if (vaultDown) continue
      await step(`probe:${account.id}`, async () => {
        const { token } = readAccessToken(account)
        if (token === null) {
          await markTokenInvalid(supabase, account, 'decrypt_failed', { fatal: true })
          failedPermanent++
          return
        }

        // `token_error` OU expirado => linha token_invalid; o probe roda assim
        // mesmo (é ele que confirma a recuperação em ≤ 24 h).
        const expiresAt = account.token_expires_at ? Date.parse(account.token_expires_at) : null
        const isExpired = expiresAt !== null && expiresAt <= Date.now()
        if (account.token_error != null || isExpired) {
          tokenInvalid++
          const reason = account.token_error ?? 'expired'
          const logId = await openSyncRow(supabase, account, 'daily')
          await closeSyncRow(supabase, logId, null, `token_invalid: ${redact(reason)}`)
        }

        probed++
        const result = await probeToken(token)
        if (result.ok) return

        const kind = classifyInstagramError(result.error)
        const message = redact(errMessage(result.error))
        const logId = await openSyncRow(supabase, account, 'daily')
        if (kind === 'infra') {
          await closeSyncRow(supabase, logId, null, `infra: ${message}`)
          failedInfra++
          stepErrors++
        } else if (kind === 'permanent') {
          await closeSyncRow(supabase, logId, null, `permanent: ${message}`)
          await markTokenInvalid(supabase, account, message, { fatal: true })
          failedPermanent++
        } else {
          await closeSyncRow(supabase, logId, null, `transient: ${message}`)
          await evaluateTransientStreak(supabase, account, 'daily')
          failedTransient++
        }
      })
    }

    // ── SYNCS completos, sob deadline. `deferred` custa posts frescos, nunca detecção.
    const deadline = runStart + SYNC_DEADLINE_MS
    const syncTargets = accounts.filter(
      (a) => a.sync_enabled && a.access_token != null && a.token_error == null,
    )

    for (const account of syncTargets) {
      if (Date.now() >= deadline || vaultDown) {
        deferred++
        continue
      }
      await step(`sync:${account.id}`, async () => {
        const { token } = readAccessToken(account)
        if (token === null) return

        const logId = await openSyncRow(supabase, account, mode)
        try {
          const result = await syncInstagramAccount(supabase, account, token, { deadlineAt: deadline })
          synced++
          totalInserted += result.postsInserted
          totalUpdated += result.postsUpdated
          totalCached += result.mediaCached
          await closeSyncRow(supabase, logId, result)
          await checkImageCacheHealth(supabase, account.id)
        } catch (err) {
          const kind = classifyInstagramError(err)
          const message = redact(errMessage(err))
          if (kind === 'infra') {
            await closeSyncRow(supabase, logId, null, `infra: ${message}`)
            failedInfra++
            if (/duplicate key value.*instagram_posts_ig_media_id_key/.test(message)) {
              // Janela C2→C4 — ramo REMOVIDO em C4.
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
            await evaluateTransientStreak(supabase, account, 'daily')
            failedTransient++
          }
        }
      })
    }

    if (totalInserted > 0 || totalUpdated > 0) revalidateTag('instagram-feed', { expire: 0 })

    // passo 5: varredura — executa em TODO run
    await step('sweep', async () => {
      for (const r of await sweepTokenAlerts(supabase)) {
        alertOutcomes.push(r.ntfy)
        if (r.ntfy === 'failed_terminal') refusals.push({ alerted: false, ntfyStatus: 403 })
        else if (r.ntfy === 'failed_transient') refusals.push({ alerted: false, ntfyStatus: 503 })
      }
    })

    // passo 5b: só a SONDA (o heartbeat visível é exclusivo do refresh)
    let probeOutcome: NtfyOutcome | 'not_due' = 'not_due'
    await step('ntfy-probe', async () => {
      if (!(await claimAlert(supabase, 'ntfy_probe_due', '23 hours'))) return
      const result = await sendNtfyAlert({
        title: 'Instagram ops probe',
        body: 'channel probe',
        priority: 'min',
        tags: ['mag'],
      })
      probeOutcome = result.alerted
        ? 'sent'
        : result.reason === 'NTFY_URL unset'
          ? 'skipped'
          : isTerminalRefusal(result)
            ? 'failed_terminal'
            : 'failed_transient'
      noteDelivery(result)
      if (result.alerted) await claimAlert(supabase, 'ntfy_heartbeat_ok', '0')
      else await releaseAlert(supabase, 'ntfy_probe_due')
    })

    // passo 6
    if (stepErrors > 0) {
      await step('step-errors-push', async () => {
        if (!(await claimAlert(supabase, `step_errors:${CRON_TAG}`, '23 hours'))) return
        noteDelivery(
          await sendNtfyAlert({
            title: 'Instagram cron degraded',
            body: `${stepErrors} step(s) failed — see Sentry`,
            priority: 'default',
            tags: ['warning'],
            click: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cms/settings/instagram`,
          }),
        )
      })
    }

    // passo 7 — idêntico ao do refresh, com as chaves DESTE cron
    const terminalRefusal = refusals.find((r) => isTerminalRefusal(r))
    let transientPersistent = false

    await step('channel-episode', async () => {
      if (refusals.length === 0) {
        await releaseAlert(supabase, EPISODE_KEY)
        return
      }
      if (await claimAlert(supabase, EPISODE_KEY, '365 days')) return
      const stamp = await readAlertStamp(supabase, EPISODE_KEY)
      if (!stamp) return
      const age = Date.now() - stamp.getTime()
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
    if (heartbeatStale) causes.push('alert channel down: no heartbeat accepted for 8d')
    if (fallbackEmailDead) causes.push('alert channel down: fallback email dead')
    if (vaultDown) causes.push('vault unavailable: SOCIAL_MASTER_KEY missing/malformed')

    const shouldEscalate =
      isProduction &&
      (alertChannelUnset ||
        Boolean(terminalRefusal) ||
        transientPersistent ||
        heartbeatStale ||
        fallbackEmailDead ||
        vaultDown)

    if (shouldEscalate) {
      await step('second-channel', async () => {
        for (const siteId of [...new Set(accounts.map((a) => a.site_id))]) {
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

    const status = shouldEscalate ? ('error' as const) : ('ok' as const)

    return {
      status,
      ...(status === 'error' ? { error: causes.join(' · ') } : {}),
      mode,
      probed,
      synced,
      inserted: totalInserted,
      updated: totalUpdated,
      cached: totalCached,
      never_connected: neverConnected,
      token_invalid: tokenInvalid,
      failed_permanent: failedPermanent,
      failed_transient: failedTransient,
      failed_infra: failedInfra,
      still_broken: accounts.filter((a) => a.token_error_at != null).length,
      deferred,
      step_errors: stepErrors,
      alert_channels: { probe: probeOutcome, alerts: alertOutcomes },
    }
  })
}
