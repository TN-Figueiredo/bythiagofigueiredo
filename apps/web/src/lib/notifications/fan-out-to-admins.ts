import { createNotification } from './create'
import { getSiteAdminUserIds } from './get-site-admin-users'
import type { NotificationDomain } from './types'

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
