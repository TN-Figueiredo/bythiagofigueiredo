import { NextRequest, NextResponse } from 'next/server'
import { authenticateWrite, pipelineSuccess, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { linkPostToItem } from '@/lib/pipeline/blog-link'
import { z } from 'zod'

const LinkSchema = z.object({
  blog_post_id: z.string().uuid(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID format', 400)
  }

  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = LinkSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)

  const linkResult = await linkPostToItem(id, parsed.data.blog_post_id, auth.siteId, null)

  if (!linkResult.ok) {
    const status = linkResult.code === 'NOT_FOUND' ? 404 : linkResult.code === 'FORBIDDEN' ? 403 : linkResult.code === 'DUPLICATE' || linkResult.code === 'ALREADY_LINKED' ? 409 : 400
    return NextResponse.json({ error: { code: linkResult.code ?? 'LINK_FAILED', message: linkResult.error } }, { status })
  }

  return pipelineSuccess({ linked: true, blog_post_id: parsed.data.blog_post_id }, 200, auth)
}
