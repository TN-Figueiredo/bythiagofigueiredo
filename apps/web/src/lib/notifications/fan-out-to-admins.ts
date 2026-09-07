import * as Sentry from '@sentry/nextjs'
import { createNotification } from './create'
import { getSiteAdminUserIds } from './get-site-admin-users'
import type { NotificationDomain, DeliveryChannel } from './types'

/**
 * Fan-out helper: sends a notification to every site admin (org_admin + super_admin).
 *
 * Maps the old yt_notifications shape (site-scoped, no user_id)
 * to the new notifications table (user-scoped).
 *
 * Returns the number of notifications successfully created.
 */
export async function fanOutToSiteAdmins(opts: {
  siteId: string
  domain: NotificationDomain
  type: string
  priority: number
  title: string
  message: string
  dedupKey: string
  payload?: Record<string, unknown>
  suggestedAction?: string
  actionHref?: string
  groupKey?: string
}): Promise<number> {
  const userIds = await getSiteAdminUserIds(opts.siteId)
  if (userIds.length === 0) return 0

  let sent = 0

  for (const userId of userIds) {
    const result = await createNotification({
      site_id: opts.siteId,
      user_id: userId,
      domain: opts.domain,
      type: opts.type,
      priority: opts.priority,
      title: opts.title,
      message: opts.message,
      dedup_key: opts.dedupKey,
      payload: opts.payload ?? null,
      suggested_action: opts.suggestedAction ?? null,
      action_href: opts.actionHref ?? null,
      group_key: opts.groupKey ?? null,
    })

    if (result.success) sent++
  }

  return sent
}

/** Razão que o cron põe no `error` do `status:'error'` quando `total === 0`. */
export const NO_SITE_ADMINS_ERROR = 'no site admins to email'

export interface IFanOutDetailedResult {
  total: number
  sent: number
  suppressed: number
  errors: string[]
}

/**
 * Irmã detalhada de `fanOutToSiteAdmins`. Existe porque o segundo canal
 * (e-mail) é justamente o que precisa funcionar quando o ntfy morre — e a
 * versão que devolve só `number` não distingue "0 admins" de "0 falhas".
 *
 * `total === 0` é CONDIÇÃO DE ERRO (MUST): getSiteAdminUserIds devolve [] tanto
 * quando o site não existe quanto quando o Supabase engole um erro, e a
 * invariante `0 + 0 + 0 === 0` seria satisfeita com ninguém avisado.
 */
export async function fanOutToSiteAdminsDetailed(opts: {
  siteId: string
  domain: NotificationDomain
  type: string
  priority: number
  title: string
  message: string
  dedupKey: string
  payload?: Record<string, unknown>
  suggestedAction?: string
  actionHref?: string
  groupKey?: string
  defaultChannels?: readonly DeliveryChannel[]
}): Promise<IFanOutDetailedResult> {
  const userIds = await getSiteAdminUserIds(opts.siteId)
  const total = userIds.length

  if (total === 0) {
    Sentry.captureMessage(NO_SITE_ADMINS_ERROR, 'error')
    return { total: 0, sent: 0, suppressed: 0, errors: [] }
  }

  let sent = 0
  let suppressed = 0
  const errors: string[] = []

  for (const userId of userIds) {
    const result = await createNotification({
      site_id: opts.siteId,
      user_id: userId,
      domain: opts.domain,
      type: opts.type,
      priority: opts.priority,
      title: opts.title,
      message: opts.message,
      dedup_key: opts.dedupKey,
      payload: opts.payload ?? null,
      suggested_action: opts.suggestedAction ?? null,
      action_href: opts.actionHref ?? null,
      group_key: opts.groupKey ?? null,
      ...(opts.defaultChannels ? { defaultChannels: [...opts.defaultChannels] } : {}),
    })

    if (!result.success) errors.push(result.error ?? 'unknown error')
    else if (result.suppressed) suppressed++
    else sent++
  }

  // create.ts:120 detecta supressão por match de string — dívida registrada em §8.
  if (errors.length > 0) Sentry.captureMessage('partial fan-out', 'warning')

  return { total, sent, suppressed, errors }
}
