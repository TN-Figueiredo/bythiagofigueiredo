// NOTE (2026-07-03): this client-upload token route currently has NO consumer —
// all real uploads go through server actions (uploadMediaAction → put(), with
// serverActions.bodySizeLimit 50mb). It stays as the sanctioned path for future
// browser-direct uploads past the server-action limit. Auth guard below is what
// keeps it safe to keep around. Since @vercel/blob 2.x the completion callback
// URL is env-inferred on Vercel; onUploadCompleted here is intentionally a no-op.
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]

const MAX_SIZE_BYTES = 50 * 1024 * 1024

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const { siteId } = await getSiteContext()
        const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
        if (!res.ok) {
          throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_SIZE_BYTES,
        }
      },
      onUploadCompleted: async () => {
        // No-op: DB record creation handled by caller if needed
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 },
    )
  }
}
