import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { encrypt, getMasterKey } from '@tn-figueiredo/social/vault'
import { deriveHmacKey, verifyState, SOCIAL_STATE_LABEL } from '@/lib/oauth/state'
import { oauthResultHtml, type OauthResultExtra } from '@/lib/oauth/popup-result'
import { recordSocialConsent } from '@/lib/oauth/consent'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

export const runtime = 'nodejs'

/** Where the popup sends the user when it cannot close itself. */
const SOCIAL_BACK_HREF = '/cms/social/accounts'

function getTargetOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

function resultHtml(
  provider: string,
  success: boolean,
  nonce: string,
  opts: { error?: string; extra?: OauthResultExtra; status?: number } = {},
): Response {
  return oauthResultHtml({
    messageType: 'social-oauth-result',
    provider,
    success,
    error: opts.error,
    extra: opts.extra,
    backHref: SOCIAL_BACK_HREF,
    targetOrigin: getTargetOrigin(),
    nonce,
    status: opts.status,
  })
}

async function exchangeGoogleCode(code: string, redirectUri: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`)
  return res.json() as Promise<{
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type: string
  }>
}

interface YouTubeChannelInfo {
  channelId: string
  channelTitle: string
  customUrl: string | null
  thumbnailUrl: string | null
  subscriberCount: string | null
  videoCount: string | null
  viewCount: string | null
}

async function fetchYouTubeChannel(accessToken: string): Promise<YouTubeChannelInfo> {
  const url = 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true'
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`YouTube channel fetch failed: ${res.status}`)

  const data = (await res.json()) as {
    items?: Array<{
      id: string
      snippet: {
        title: string
        customUrl?: string
        thumbnails?: { default?: { url: string } }
      }
      statistics?: { subscriberCount?: string; videoCount?: string; viewCount?: string }
    }>
  }
  const channel = data.items?.[0]
  if (!channel) throw new Error('No YouTube channel found for this account')

  return {
    channelId: channel.id,
    channelTitle: channel.snippet.title,
    customUrl: channel.snippet.customUrl ?? null,
    thumbnailUrl: channel.snippet.thumbnails?.default?.url ?? null,
    subscriberCount: channel.statistics?.subscriberCount ?? null,
    videoCount: channel.statistics?.videoCount ?? null,
    viewCount: channel.statistics?.viewCount ?? null,
  }
}

async function exchangeMetaCode(code: string, redirectUri: string) {
  const shortUrl = new URL('https://graph.facebook.com/v25.0/oauth/access_token')
  shortUrl.searchParams.set('client_id', process.env.META_APP_ID ?? '')
  shortUrl.searchParams.set('client_secret', process.env.META_APP_SECRET ?? '')
  shortUrl.searchParams.set('redirect_uri', redirectUri)
  shortUrl.searchParams.set('code', code)

  const shortRes = await fetch(shortUrl.toString())
  if (!shortRes.ok) throw new Error(`Meta short-lived token exchange failed: ${shortRes.status}`)
  const shortData = (await shortRes.json()) as { access_token: string }

  const longUrl = new URL('https://graph.facebook.com/v25.0/oauth/access_token')
  longUrl.searchParams.set('grant_type', 'fb_exchange_token')
  longUrl.searchParams.set('client_id', process.env.META_APP_ID ?? '')
  longUrl.searchParams.set('client_secret', process.env.META_APP_SECRET ?? '')
  longUrl.searchParams.set('fb_exchange_token', shortData.access_token)

  const longRes = await fetch(longUrl.toString())
  if (!longRes.ok) throw new Error(`Meta long-lived token exchange failed: ${longRes.status}`)
  return (await longRes.json()) as {
    access_token: string
    expires_in: number
    token_type: string
  }
}

interface MetaPage {
  id: string
  name: string
  access_token: string
  picture?: { data: { url: string } }
  fan_count?: number
  followers_count?: number
}

interface MetaIgAccount {
  id: string
  username: string
}

async function fetchMetaPages(userAccessToken: string): Promise<MetaPage[]> {
  const res = await fetch(
    `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token,picture{url},fan_count,followers_count&access_token=${userAccessToken}`,
  )
  if (!res.ok) throw new Error(`Meta pages fetch failed: ${res.status}`)
  const data = (await res.json()) as { data: MetaPage[] }
  return data.data ?? []
}

async function fetchInstagramAccount(
  pageId: string,
  userAccessToken: string,
): Promise<MetaIgAccount | null> {
  const res = await fetch(
    `https://graph.facebook.com/v25.0/${pageId}?fields=instagram_business_account{id,username}&access_token=${userAccessToken}`,
  )
  if (!res.ok) return null
  const data = (await res.json()) as {
    instagram_business_account?: { id: string; username: string }
  }
  return data.instagram_business_account ?? null
}

async function fetchInstagramProfile(
  igUserId: string,
  userAccessToken: string,
): Promise<{ profilePictureUrl: string | null; followersCount: number | null; mediaCount: number | null }> {
  const res = await fetch(
    `https://graph.facebook.com/v25.0/${igUserId}?fields=profile_picture_url,followers_count,media_count&access_token=${userAccessToken}`,
  )
  if (!res.ok) return { profilePictureUrl: null, followersCount: null, mediaCount: null }
  const data = (await res.json()) as {
    profile_picture_url?: string
    followers_count?: number
    media_count?: number
  }
  return {
    profilePictureUrl: data.profile_picture_url ?? null,
    followersCount: data.followers_count ?? null,
    mediaCount: data.media_count ?? null,
  }
}

function getCallbackUrl(provider: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base}/api/social/oauth/${provider}/callback`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  const code = req.nextUrl.searchParams.get('code')
  const stateRaw = req.nextUrl.searchParams.get('state')
  const errorParam = req.nextUrl.searchParams.get('error')
  // `src/middleware.ts:169`. Under `getCspMode() === 'enforced'` an untagged
  // inline script would be blocked and the opener would never hear back.
  const nonce = (await headers()).get('x-nonce') ?? ''

  if (errorParam) {
    return resultHtml(provider, false, nonce, { error: errorParam })
  }

  if (!code || !stateRaw) {
    return resultHtml(provider, false, nonce, { error: 'Missing code or state' })
  }

  try {
    const masterKeyHex = process.env.SOCIAL_MASTER_KEY
    if (!masterKeyHex) {
      return resultHtml(provider, false, nonce, { error: 'SOCIAL_MASTER_KEY not configured' })
    }

    const stateData = verifyState(
      stateRaw,
      deriveHmacKey(masterKeyHex, SOCIAL_STATE_LABEL),
      { typ: 'state', requireExp: true },
    )
    if (!stateData || !stateData.userId) {
      return resultHtml(provider, false, nonce, {
        error: 'Invalid or expired authorization (it expires after 30 minutes) — start again from the CMS',
        extra: { code: 'invalid_state' },
        status: 400,
      })
    }

    const { siteId, userId } = stateData

    // The callback used to write with the service client and NO session at all.
    const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
    if (!auth.ok) {
      return resultHtml(provider, false, nonce, {
        error: 'Session changed during authorization — sign in and try again',
        extra: { code: 'session_changed' },
        status: auth.reason === 'unauthenticated' ? 401 : 403,
      })
    }
    if (auth.user.id !== userId) {
      return resultHtml(provider, false, nonce, {
        error: 'Session changed during authorization — sign in and try again',
        extra: { code: 'session_changed' },
        status: 401,
      })
    }

    const supabase = getSupabaseServiceClient()
    const redirectUri = getCallbackUrl(provider)
    const encKey = getMasterKey()

    switch (provider) {
      case 'google': {
        const tokens = await exchangeGoogleCode(code, redirectUri)
        const channel = await fetchYouTubeChannel(tokens.access_token)
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

        const accessTokenEnc = encrypt(tokens.access_token, encKey)
        const refreshTokenEnc = tokens.refresh_token
          ? encrypt(tokens.refresh_token, encKey)
          : null

        const { error } = await supabase.from('social_connections').upsert(
          {
            site_id: siteId,
            provider: 'youtube' as const,
            account_id: channel.channelId,
            account_name: channel.customUrl ?? channel.channelTitle,
            access_token_enc: accessTokenEnc,
            refresh_token_enc: refreshTokenEnc,
            token_expires_at: expiresAt,
            scopes: ['youtube.upload', 'youtube', 'yt-analytics.readonly'],
            metadata: {
              channel_id: channel.channelId,
              channel_title: channel.channelTitle,
              custom_url: channel.customUrl,
              thumbnail_url: channel.thumbnailUrl,
              subscriber_count: channel.subscriberCount,
              video_count: channel.videoCount,
              view_count: channel.viewCount,
            },
            revoked_at: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'site_id,provider,account_id' },
        )

        if (error) throw new Error(`DB upsert failed: ${error.message}`)
        await recordSocialConsent(supabase, {
          userId,
          siteId,
          category: 'social_integration',
          req,
        })
        return resultHtml('youtube', true, nonce)
      }

      case 'meta': {
        const tokens = await exchangeMetaCode(code, redirectUri)
        const expiresInMs = (tokens.expires_in ?? 5_184_000) * 1000
        const expiresAt = new Date(Date.now() + expiresInMs).toISOString()

        const userAccessTokenEnc = encrypt(tokens.access_token, encKey)

        const pages = await fetchMetaPages(tokens.access_token)
        if (pages.length === 0) {
          return resultHtml('facebook', false, nonce, {
            error: 'No Facebook Pages found for this account',
          })
        }

        // v1: use the first page
        const page = pages[0]!
        const pageTokenEnc = encrypt(page.access_token, encKey)

        // Upsert Facebook connection
        const { error: fbError } = await supabase.from('social_connections').upsert(
          {
            site_id: siteId,
            provider: 'facebook' as const,
            account_id: page.id,
            account_name: page.name,
            access_token_enc: userAccessTokenEnc,
            refresh_token_enc: null,
            page_token_enc: pageTokenEnc,
            token_expires_at: expiresAt,
            scopes: [
              'pages_manage_posts',
              'pages_read_engagement',
              'pages_show_list',
              'read_insights',
              'instagram_basic',
              'instagram_content_publish',
              'instagram_manage_insights',
            ],
            metadata: {
              page_id: page.id,
              page_name: page.name,
              picture_url: page.picture?.data?.url ?? null,
              fan_count: page.fan_count ?? null,
              follower_count: page.followers_count ?? null,
            },
            revoked_at: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'site_id,provider,account_id' },
        )

        if (fbError) throw new Error(`Facebook DB upsert failed: ${fbError.message}`)

        // Check for Instagram business account linked to this page
        const igAccount = await fetchInstagramAccount(page.id, tokens.access_token)

        if (igAccount) {
          const igProfile = await fetchInstagramProfile(igAccount.id, tokens.access_token)

          const { error: igError } = await supabase.from('social_connections').upsert(
            {
              site_id: siteId,
              provider: 'instagram' as const,
              account_id: igAccount.id,
              account_name: igAccount.username,
              access_token_enc: userAccessTokenEnc,
              refresh_token_enc: null,
              page_token_enc: pageTokenEnc,
              token_expires_at: expiresAt,
              scopes: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_insights'],
              metadata: {
                ig_user_id: igAccount.id,
                ig_username: igAccount.username,
                page_id: page.id,
                page_name: page.name,
                profile_picture_url: igProfile.profilePictureUrl,
                followers_count: igProfile.followersCount,
                media_count: igProfile.mediaCount,
              },
              revoked_at: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'site_id,provider,account_id' },
          )

          if (igError) throw new Error(`Instagram DB upsert failed: ${igError.message}`)
        }

        await recordSocialConsent(supabase, {
          userId,
          siteId,
          category: 'social_integration',
          req,
        })
        return resultHtml('facebook', true, nonce)
      }

      default:
        return resultHtml(provider, false, nonce, {
          error: `Unsupported provider: ${provider}`,
        })
    }
  } catch (err) {
    console.error('[oauth-callback]', provider, err)
    return resultHtml(provider, false, nonce, {
      error: 'OAuth authentication failed. Please try again.',
    })
  }
}
