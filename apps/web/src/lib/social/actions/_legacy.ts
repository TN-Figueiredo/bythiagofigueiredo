'use server'

import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  type ActionResult,
  SENTRY_TAG,
  requireEditAccess,
  revalidateSocialPaths,
} from './_shared'

// ---------------------------------------------------------------------------
// retryPostDeliveries — bulk retry all failed/skipped deliveries for a post
// ---------------------------------------------------------------------------

export async function retryPostDeliveries(
  postId: string,
): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(postId)
  if (!parsed.success) return { ok: false, error: 'Invalid post ID' }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const { data: post } = await supabase
      .from('social_posts')
      .select('id')
      .eq('id', parsed.data)
      .eq('site_id', siteId)
      .single()

    if (!post) return { ok: false, error: 'forbidden' }

    const { data: deliveries, error: fetchErr } = await supabase
      .from('social_deliveries')
      .select('id, status')
      .eq('post_id', parsed.data)
      .in('status', ['failed', 'skipped'])

    if (fetchErr) return { ok: false, error: fetchErr.message }
    if (!deliveries || deliveries.length === 0) {
      return { ok: false, error: 'No retryable deliveries' }
    }

    const { error: updateErr } = await supabase
      .from('social_deliveries')
      .update({ status: 'pending', attempt: 0, last_error: null, error_type: null })
      .in('id', deliveries.map((d) => d.id as string))

    if (updateErr) return { ok: false, error: updateErr.message }

    await supabase
      .from('social_posts')
      .update({ status: 'scheduled', updated_at: new Date().toISOString() })
      .eq('id', parsed.data)
      .in('status', ['failed', 'partial_failure'])

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { ...SENTRY_TAG, action: 'retryPostDeliveries' },
    })
    throw err
  }
}

// ---------------------------------------------------------------------------
// markAsPosted — manual Story posting flow
// ---------------------------------------------------------------------------

export async function markAsPosted(postId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(postId)
  if (!parsed.success) return { ok: false, error: 'Invalid post ID' }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const now = new Date().toISOString()

    const { error: postError } = await supabase
      .from('social_posts')
      .update({
        status: 'completed',
        published_at: now,
        updated_at: now,
      })
      .eq('id', parsed.data)
      .eq('site_id', siteId)
      .in('status', ['publishing', 'scheduled', 'draft'])

    if (postError) {
      Sentry.captureException(postError, {
        tags: { ...SENTRY_TAG, action: 'markAsPosted' },
      })
      return { ok: false, error: 'Failed to mark post as posted' }
    }

    // Mark pending deliveries as completed
    const { error: deliveryError } = await supabase
      .from('social_deliveries')
      .update({ status: 'delivered', delivered_at: now })
      .eq('post_id', parsed.data)
      .in('status', ['pending', 'publishing'])

    if (deliveryError) {
      // Non-fatal: post status already updated
      Sentry.captureException(deliveryError, {
        tags: { ...SENTRY_TAG, action: 'markAsPosted', step: 'delivery-update' },
      })
    }

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { ...SENTRY_TAG, action: 'markAsPosted' },
    })
    throw err
  }
}
