import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'node:crypto'
import { getSiteContext } from '@/lib/cms/site-context'

export const runtime = 'nodejs'

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
].join(' ')

const META_OAUTH_URL = 'https://www.facebook.com/v25.0/dialog/oauth'
const META_SCOPES = [
  'pages_read_engagement',
  'pages_show_list',
  'pages_manage_posts',
  'instagram_basic',
  'business_management',
].join(',')

function signState(payload: string, key: string): string {
  const hmac = createHmac('sha256', key).update(payload).digest('hex')
  return `${Buffer.from(payload).toString('base64')}.${hmac}`
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
  const { siteId } = await getSiteContext()

  const masterKey = process.env.SOCIAL_MASTER_KEY
  if (!masterKey) {
    return NextResponse.json(
      { error: 'SOCIAL_MASTER_KEY not configured' },
      { status: 500 },
    )
  }

  const statePayload = JSON.stringify({ siteId })
  const signedState = encodeURIComponent(signState(statePayload, masterKey))

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
