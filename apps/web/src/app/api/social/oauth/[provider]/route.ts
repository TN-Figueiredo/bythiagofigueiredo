import { NextRequest, NextResponse } from 'next/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import {
  deriveHmacKey,
  signState,
  SOCIAL_STATE_LABEL,
  STATE_TTL_SECONDS,
} from '@/lib/oauth/state'

export const runtime = 'nodejs'

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
].join(' ')

const META_OAUTH_URL = 'https://www.facebook.com/v25.0/dialog/oauth'
// Scope set = exactly what the code calls (App Review rejects unused scopes):
// pages_* for /feed + /photos publishing and page listing; instagram_* for
// media/media_publish (REELS/STORIES); read_insights + instagram_manage_insights
// for the metrics poller (/insights on FB pages and IG accounts).
// business_management removed 2026-07-03 — no endpoint required it
// (/me/accounts only needs pages_show_list).
const META_SCOPES = [
  'pages_read_engagement',
  'pages_show_list',
  'pages_manage_posts',
  'read_insights',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
].join(',')

function getCallbackUrl(provider: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base}/api/social/oauth/${provider}/callback`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  const { siteId } = await getSiteContext()

  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!auth.ok) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const masterKey = process.env.SOCIAL_MASTER_KEY
  if (!masterKey) {
    return NextResponse.json(
      { error: 'SOCIAL_MASTER_KEY not configured' },
      { status: 500 },
    )
  }

  const signedState = encodeURIComponent(
    signState(
      {
        typ: 'state',
        siteId,
        userId: auth.user.id,
        // Seconds since the epoch. The Meta/Google `code` lives ~1 h; the state
        // closes at 30 min so a captured URL stops being a completion token.
        exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
      },
      deriveHmacKey(masterKey, SOCIAL_STATE_LABEL),
    ),
  )

  switch (provider) {
    case 'google': {
      const url = new URL(GOOGLE_OAUTH_URL)
      url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID ?? '')
      url.searchParams.set('redirect_uri', getCallbackUrl('google'))
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('scope', GOOGLE_SCOPES)
      url.searchParams.set('access_type', 'offline')
      url.searchParams.set('prompt', 'consent')
      url.searchParams.set('state', signedState)
      return NextResponse.redirect(url.toString())
    }

    case 'meta': {
      const url = new URL(META_OAUTH_URL)
      url.searchParams.set('client_id', process.env.META_APP_ID ?? '')
      url.searchParams.set('redirect_uri', getCallbackUrl('meta'))
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('scope', META_SCOPES)
      url.searchParams.set('state', signedState)
      return NextResponse.redirect(url.toString())
    }

    default:
      return NextResponse.json(
        { error: `Unsupported provider: ${provider}` },
        { status: 400 },
      )
  }
}
