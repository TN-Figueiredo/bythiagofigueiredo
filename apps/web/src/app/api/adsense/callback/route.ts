import { requireArea } from '@tn-figueiredo/auth-nextjs/server'
import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { encrypt } from '@/lib/ads/crypto'
import * as Sentry from '@sentry/nextjs'

export async function GET(req: Request): Promise<Response> {
  await requireArea('admin')

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  if (!code) {
    return Response.json({ error: 'Missing OAuth2 code' }, { status: 400 })
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const tokenKey = process.env.ADSENSE_TOKEN_KEY
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (!clientId || !clientSecret || !tokenKey) {
    return Response.json({ error: 'AdSense OAuth2 not fully configured' }, { status: 503 })
  }

  const redirectUri = `${appUrl}/api/adsense/callback`

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenRes.json() as {
      access_token?: string
      refresh_token?: string
      error?: string
    }

    if (!tokenRes.ok || !tokenData.refresh_token) {
      return Response.json(
        { error: tokenData.error ?? 'Token exchange failed' },
        { status: 500 },
      )
    }

    const encryptedToken = encrypt(tokenData.refresh_token, tokenKey)

    const supabase = getSupabaseServiceClient()

    const { data: orgId, error: orgErr } = await supabase.rpc('get_master_org_id')
    if (orgErr || !orgId) {
      return Response.json({ error: 'Could not resolve organization' }, { status: 500 })
    }

    const { error: updateErr } = await supabase
      .from('organizations')
      .update({
        adsense_refresh_token_enc: encryptedToken,
        adsense_connected_at: new Date().toISOString(),
        adsense_sync_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orgId as string)

    if (updateErr) {
      Sentry.captureException(updateErr, { tags: { component: 'adsense-callback' } })
      return Response.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.redirect(`${appUrl}/admin/ads?tab=dashboard&adsense=connected`, 302)
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'adsense-callback' } })
    return Response.json({ error: 'Unexpected error during OAuth2 flow' }, { status: 500 })
  }
}
