import { NextRequest, NextResponse } from 'next/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

interface UploadSessionBody {
  title: string
  description?: string
  tags?: string[]
  categoryId?: string
  privacyStatus: 'private' | 'unlisted' | 'public'
}

export async function POST(req: NextRequest) {
  const { siteId } = await getSiteContext()
  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json()) as UploadSessionBody
  const supabase = getSupabaseServiceClient()

  const { data: connection } = await supabase
    .from('social_connections')
    .select('access_token_encrypted, token_expires_at')
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

  // TODO: decrypt access_token_encrypted via vault
  const accessToken = connection.access_token_encrypted

  const metadata = {
    snippet: {
      title: body.title,
      description: body.description ?? '',
      tags: body.tags ?? [],
      categoryId: body.categoryId ?? '22', // "People & Blogs" default
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
