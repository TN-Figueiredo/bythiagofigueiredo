import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { decrypt, getMasterKey } from '@tn-figueiredo/social/vault'

export const runtime = 'nodejs'

const UploadSessionSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  categoryId: z.string().regex(/^\d+$/).optional(),
  privacyStatus: z.enum(['private', 'unlisted', 'public']),
})

export async function POST(req: NextRequest) {
  const { siteId } = await getSiteContext()
  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = UploadSessionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const body = parsed.data
  const supabase = getSupabaseServiceClient()

  const { data: connection } = await supabase
    .from('social_connections')
    .select('access_token_enc, token_expires_at')
    .eq('site_id', siteId)
    .eq('provider', 'google')
    .eq('status', 'active')
    .single()

  if (!connection) {
    return NextResponse.json(
      { error: 'No active YouTube connection found' },
      { status: 404 },
    )
  }

  const accessToken = decrypt(connection.access_token_enc as string, getMasterKey())

  const metadata = {
    snippet: {
      title: body.title,
      description: body.description ?? '',
      tags: body.tags ?? [],
      categoryId: body.categoryId ?? '22',
    },
    status: {
      privacyStatus: body.privacyStatus,
    },
  }

  const res = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/*',
      },
      body: JSON.stringify(metadata),
      signal: AbortSignal.timeout(15_000),
    },
  )

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json(
      { error: `YouTube API error: ${res.status}`, details: text },
      { status: 502 },
    )
  }

  const uploadUri = res.headers.get('location')
  if (!uploadUri) {
    return NextResponse.json(
      { error: 'YouTube did not return an upload URI' },
      { status: 502 },
    )
  }

  return NextResponse.json({ uploadUri })
}
