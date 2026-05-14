'use server'

import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  encrypt,
  getMasterKey,
  type Provider,
} from '@tn-figueiredo/social'
import {
  type ActionResult,
  type SafeConnection,
  SENTRY_TAG,
  zodError,
  requireEditAccess,
  revalidateSocialPaths,
} from './_shared'
import { toSafeConnections } from '../row-parsers'

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

const connectSchema = z.object({
  provider: z.enum(['youtube', 'facebook', 'instagram', 'bluesky']),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  pageToken: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  accountId: z.string().min(1),
  accountName: z.string().min(1),
  scopes: z.array(z.string()),
  metadata: z.record(z.unknown()).optional(),
})

export async function connectSocial(
  provider: Provider,
  tokens: {
    accessToken: string
    refreshToken?: string
    pageToken?: string
    expiresAt?: string
    accountId: string
    accountName: string
    scopes: string[]
    metadata?: Record<string, unknown>
  },
): Promise<ActionResult<{ id: string }>> {
  const parsed = connectSchema.safeParse({ provider, ...tokens })
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  try {
    const { siteId } = await requireEditAccess()
    const key = getMasterKey()
    const supabase = getSupabaseServiceClient()

    const row = {
      site_id: siteId,
      provider: parsed.data.provider,
      account_id: parsed.data.accountId,
      account_name: parsed.data.accountName,
      access_token_enc: encrypt(parsed.data.accessToken, key),
      refresh_token_enc: parsed.data.refreshToken
        ? encrypt(parsed.data.refreshToken, key)
        : null,
      page_token_enc: parsed.data.pageToken
        ? encrypt(parsed.data.pageToken, key)
        : null,
      token_expires_at: parsed.data.expiresAt ?? null,
      scopes: parsed.data.scopes,
      metadata: parsed.data.metadata ?? {},
    }

    const { data, error } = await supabase
      .from('social_connections')
      .insert(row)
      .select('id')
      .single()

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'connectSocial' } })
      return { ok: false, error: error.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: { id: data.id as string } }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'connectSocial' } })
    throw err
  }
}

export async function disconnectSocial(
  connectionId: string,
): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(connectionId)
  if (!parsed.success) return { ok: false, error: 'Invalid connection ID' }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const { error } = await supabase
      .from('social_connections')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', parsed.data)
      .eq('site_id', siteId)
      .is('revoked_at', null)

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'disconnectSocial' } })
      return { ok: false, error: error.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'disconnectSocial' } })
    throw err
  }
}

export async function getConnections(
  siteId: string,
): Promise<ActionResult<SafeConnection[]>> {
  const parsed = z.string().uuid().safeParse(siteId)
  if (!parsed.success) return { ok: false, error: 'Invalid site ID' }

  try {
    const { siteId: authorizedSiteId } = await requireEditAccess()
    if (parsed.data !== authorizedSiteId) {
      return { ok: false, error: 'forbidden' }
    }
    const supabase = getSupabaseServiceClient()

    const { data, error } = await supabase
      .from('social_connections')
      .select('*')
      .eq('site_id', authorizedSiteId)
      .is('revoked_at', null)
      .order('connected_at', { ascending: false })

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'getConnections' } })
      return { ok: false, error: error.message }
    }

    const safe = toSafeConnections(data ?? [])
    return { ok: true, data: safe }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'getConnections' } })
    throw err
  }
}
