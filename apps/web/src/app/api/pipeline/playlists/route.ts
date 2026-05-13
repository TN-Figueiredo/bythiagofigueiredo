import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { listPlaylists, getPlaylistItemCounts, resolveUniqueSlug } from '@/lib/playlists/queries'
import { PipelineCreatePlaylistSchema } from '@/lib/pipeline/schemas'
import { authenticateRead, authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const url = req.nextUrl
  const filters = {
    status: url.searchParams.get('status') ?? undefined,
    category: url.searchParams.get('category') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
  }

  const [playlists, counts] = await Promise.all([
    listPlaylists(auth.siteId, filters),
    getPlaylistItemCounts(auth.siteId),
  ])

  return pipelineSuccess(playlists.map(p => ({
    id: p.id,
    name_pt: p.name_pt,
    name_en: p.name_en,
    slug: p.slug,
    status: p.status,
    category: p.category,
    description_pt: p.description_pt,
    description_en: p.description_en,
    cover_image_url: p.cover_image_url,
    item_count: counts.get(p.id) ?? 0,
    created_at: p.created_at,
    updated_at: p.updated_at,
  })), 200, auth)
}

export async function POST(req: NextRequest) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = PipelineCreatePlaylistSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)

  let slug: string
  try {
    slug = await resolveUniqueSlug(parsed.data.name_en, auth.siteId)
  } catch {
    return pipelineError('ALREADY_EXISTS', 'Could not generate unique slug after 99 attempts', 409, auth)
  }

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('playlists')
    .insert({
      site_id: auth.siteId,
      name_en: parsed.data.name_en,
      name_pt: parsed.data.name_pt,
      slug,
      description_en: parsed.data.description_en ?? null,
      description_pt: parsed.data.description_pt ?? null,
      category: parsed.data.category ?? null,
      status: parsed.data.status,
    })
    .select('*')
    .single()

  if (error) return pipelineError('VALIDATION_ERROR', error.message, 400, auth)

  return pipelineSuccess({
    id: data.id,
    name_en: data.name_en,
    name_pt: data.name_pt,
    slug: data.slug,
    status: data.status,
    category: data.category,
    description_en: data.description_en,
    description_pt: data.description_pt,
    cover_image_url: data.cover_image_url,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }, 201, auth)
}
