import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { decrypt, encrypt, getMasterKey } from '@tn-figueiredo/social'
import type { Provider } from '@tn-figueiredo/social'

export class TokenRevokedError extends Error {
  public readonly provider: Provider
  public readonly connectionId: string

  constructor(provider: Provider, connectionId: string) {
    super(`${provider} token has been revoked — user must reconnect`)
    this.name = 'TokenRevokedError'
    this.provider = provider
    this.connectionId = connectionId
  }
}

interface FreshToken {
  accessToken: string
  connectionId: string
}

interface GoogleRefreshResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
}

interface MetaRefreshResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export async function ensureFreshToken(
  siteId: string,
  provider: Provider,
  accountId?: string,
): Promise<FreshToken> {
  const supabase = getSupabaseServiceClient()

  let query = supabase
    .from('social_connections')
    .select('id, access_token_enc, refresh_token_enc, token_expires_at')
    .eq('site_id', siteId)
    .eq('provider', provider)
    .is('revoked_at', null)
  if (accountId) query = query.eq('account_id', accountId)
  const { data: conn, error } = await query
    .order('connected_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !conn) {
    throw new Error(`No active ${provider} connection found for site ${siteId}`)
  }

  const key = getMasterKey()
  const accessToken = decrypt(conn.access_token_enc as string, key)

  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : null
  const isExpired = expiresAt && expiresAt.getTime() - Date.now() < 5 * 60 * 1000

  if (!isExpired) {
    return { accessToken, connectionId: conn.id as string }
  }

  const connectionId = conn.id as string
  const oldExpiresAt = conn.token_expires_at as string

  switch (provider) {
    case 'youtube':
      return refreshGoogle(supabase, conn, key, connectionId, oldExpiresAt)
    case 'facebook':
    case 'instagram':
      return refreshMeta(supabase, accessToken, key, connectionId, oldExpiresAt, provider)
    case 'bluesky':
      throw new Error('Bluesky token refresh not yet supported')
  }
}

async function refreshGoogle(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  conn: { id: unknown; refresh_token_enc: unknown; token_expires_at: unknown },
  key: Buffer,
  connectionId: string,
  oldExpiresAt: string,
): Promise<FreshToken> {
  if (!conn.refresh_token_enc) {
    throw new Error('YouTube access token expired and no refresh token available')
  }

  const refreshToken = decrypt(conn.refresh_token_enc as string, key)
  const refreshed = await callGoogleRefresh(refreshToken, connectionId)

  const newAccessTokenEnc = encrypt(refreshed.access_token, key)
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

  const updatePayload: Record<string, string> = {
    access_token_enc: newAccessTokenEnc,
    token_expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  }

  if (refreshed.refresh_token) {
    updatePayload.refresh_token_enc = encrypt(refreshed.refresh_token, key)
  }

  const { count } = await supabase
    .from('social_connections')
    .update(updatePayload, { count: 'exact' })
    .eq('id', connectionId)
    .eq('token_expires_at', oldExpiresAt)

  if (count === 0) {
    return reReadFreshToken(supabase, connectionId, key)
  }

  return { accessToken: refreshed.access_token, connectionId }
}

async function refreshMeta(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  currentAccessToken: string,
  key: Buffer,
  connectionId: string,
  oldExpiresAt: string,
  provider: Provider,
): Promise<FreshToken> {
  const refreshed = await callMetaRefresh(currentAccessToken, connectionId, provider)

  const newAccessTokenEnc = encrypt(refreshed.access_token, key)
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

  const { count } = await supabase
    .from('social_connections')
    .update(
      {
        access_token_enc: newAccessTokenEnc,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      },
      { count: 'exact' },
    )
    .eq('id', connectionId)
    .eq('token_expires_at', oldExpiresAt)

  if (count === 0) {
    return reReadFreshToken(supabase, connectionId, key)
  }

  return { accessToken: refreshed.access_token, connectionId }
}

async function reReadFreshToken(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  connectionId: string,
  key: Buffer,
): Promise<FreshToken> {
  const { data } = await supabase
    .from('social_connections')
    .select('access_token_enc')
    .eq('id', connectionId)
    .single()

  if (!data) {
    throw new Error('Connection disappeared during concurrent refresh')
  }

  return {
    accessToken: decrypt(data.access_token_enc as string, key),
    connectionId,
  }
}

async function callGoogleRefresh(
  refreshToken: string,
  connectionId: string,
): Promise<GoogleRefreshResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const text = await res.text()

    if (res.status === 400 || res.status === 401) {
      const isRevoked =
        text.includes('invalid_grant') || text.includes('Token has been expired or revoked')

      if (isRevoked) {
        await markConnectionRevoked(connectionId)
        throw new TokenRevokedError('youtube', connectionId)
      }
    }

    throw new Error(`Google token refresh failed (${res.status}): ${text}`)
  }

  return res.json() as Promise<GoogleRefreshResponse>
}

async function callMetaRefresh(
  currentAccessToken: string,
  connectionId: string,
  provider: Provider,
): Promise<MetaRefreshResponse> {
  const url = new URL('https://graph.facebook.com/v25.0/oauth/access_token')
  url.searchParams.set('grant_type', 'fb_exchange_token')
  url.searchParams.set('client_id', process.env.META_APP_ID ?? '')
  url.searchParams.set('client_secret', process.env.META_APP_SECRET ?? '')
  url.searchParams.set('fb_exchange_token', currentAccessToken)

  const res = await fetch(url.toString())

  if (!res.ok) {
    const text = await res.text()

    if (res.status === 400 || res.status === 401) {
      const isRevoked =
        text.includes('OAuthException') &&
        (text.includes('expired') || text.includes('invalid') || text.includes('revoked'))

      if (isRevoked) {
        await markConnectionRevoked(connectionId)
        throw new TokenRevokedError(provider, connectionId)
      }
    }

    throw new Error(`Meta token refresh failed for ${provider} (${res.status}): ${text}`)
  }

  return res.json() as Promise<MetaRefreshResponse>
}

async function markConnectionRevoked(connectionId: string): Promise<void> {
  const supabase = getSupabaseServiceClient()

  await supabase
    .from('social_connections')
    .update({
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', connectionId)
}
