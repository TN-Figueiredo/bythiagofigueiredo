import { NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { encrypt, getMasterKey } from '@tn-figueiredo/social'

export const runtime = 'nodejs'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function oauthResultHtml(provider: string, success: boolean, error?: string): Response {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const payload = success
    ? JSON.stringify({ type: 'social-oauth-result', success: true, provider })
    : JSON.stringify({ type: 'social-oauth-result', success: false, provider, error })
  // Escape </script> inside JSON to prevent breaking out of the script tag
  const safePayload = payload.replace(/<\//g, '<\\/')
  const safeError = escapeHtml(error ?? 'unknown')

  const html = `<!DOCTYPE html>
<html><head><title>OAuth Complete</title></head>
<body>
<p>${success ? 'Connected! This window will close.' : `Error: ${safeError}`}</p>
<script>
  try { window.opener.postMessage(${safePayload}, '${origin}') } catch {}
  setTimeout(() => window.close(), 1500)
</script>
</body></html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function verifyState(signed: string, secret: string): { siteId: string } | null {
  const decoded = decodeURIComponent(signed)
  const dotIdx = decoded.lastIndexOf('.')
  if (dotIdx === -1) return null

  const b64 = decoded.substring(0, dotIdx)
  const hmac = decoded.substring(dotIdx + 1)
  if (!b64 || !hmac) return null

  const payload = Buffer.from(b64, 'base64').toString('utf-8')
  const expected = createHmac('sha256', secret).update(payload).digest('hex')

  if (hmac.length !== expected.length) return null
  const hmacBuf = Buffer.from(hmac, 'hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  if (!timingSafeEqual(hmacBuf, expectedBuf)) return null

  return JSON.parse(payload) as { siteId: string }
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

  if (errorParam) {
    return oauthResultHtml(provider, false, errorParam)
  }

  if (!code || !stateRaw) {
    return oauthResultHtml(provider, false, 'Missing code or state')
  }

  try {
    const masterKeyHex = process.env.SOCIAL_MASTER_KEY
    if (!masterKeyHex) {
      return oauthResultHtml(provider, false, 'SOCIAL_MASTER_KEY not configured')
    }

    const stateData = verifyState(stateRaw, masterKeyHex)
    if (!stateData) {
      return oauthResultHtml(provider, false, 'Invalid or tampered state parameter')
    }

    const { siteId } = stateData
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
        return oauthResultHtml('youtube', true)
      }

      case 'meta': {
        const tokens = await exchangeMetaCode(code, redirectUri)
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

        const userAccessTokenEnc = encrypt(tokens.access_token, encKey)

        const pages = await fetchMetaPages(tokens.access_token)
        if (pages.length === 0) {
          return oauthResultHtml('facebook', false, 'No Facebook Pages found for this account')
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
              'instagram_basic',
              'instagram_content_publish',
              'business_management',
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
              scopes: ['instagram_basic', 'instagram_content_publish'],
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

        return oauthResultHtml('facebook', true)
      }

      default:
        return oauthResultHtml(provider, false, `Unsupported provider: ${provider}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return oauthResultHtml(provider, false, message)
  }
}
