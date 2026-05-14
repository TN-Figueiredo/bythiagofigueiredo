'use server'

import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import {
  type ActionResult,
  SENTRY_TAG,
  requireEditAccess,
} from './_shared'

// ---------------------------------------------------------------------------
// Queue slot (server action wrapper)
// ---------------------------------------------------------------------------

export async function getNextQueueSlotAction(
  siteId: string | undefined,
  timezone: string,
): Promise<ActionResult<{ date: string; hour: number; scheduledAt: string; label: string } | null>> {
  const parsedSite = z.string().uuid().safeParse(siteId)
  if (!parsedSite.success) return { ok: false, error: 'Invalid site ID' }

  try {
    const { siteId: authorizedSiteId } = await requireEditAccess()
    if (parsedSite.data !== authorizedSiteId) {
      return { ok: false, error: 'forbidden' }
    }
    const { getNextQueueSlot } = await import('@/lib/social/queue')
    const slot = await getNextQueueSlot(authorizedSiteId, timezone)
    return { ok: true, data: slot }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'getNextQueueSlotAction' } })
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}
