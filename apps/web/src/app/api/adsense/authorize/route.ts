import { requireArea } from '@tn-figueiredo/auth-nextjs/server'
import { NextResponse } from 'next/server'

const SCOPE = [
  'https://www.googleapis.com/auth/adsense.readonly',
].join(' ')

export async function GET(_req: Request): Promise<Response> {
  await requireArea('admin')

  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return Response.json({ error: 'Google OAuth2 not configured' }, { status: 503 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/adsense/callback`

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    302,
  )
}
