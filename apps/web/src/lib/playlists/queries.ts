import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { slugifyPlaylist } from './slug'
import type {
  PlaylistRow,
  PlaylistItemRow,
  PlaylistEdgeRow,
  PlaylistItemEnriched,
  PlaylistGraph,
  ContentType,
} from './types'

export function normalizeLang(locale: string | null | undefined): 'pt-br' | 'en' | null {
  if (!locale) return null
  const lower = locale.toLowerCase()
  if (lower.startsWith('pt')) return 'pt-br'
  if (lower.startsWith('en')) return 'en'
  return null
}

interface BlogPostRef {
  id: string
  status: string | null
  category: string | null
  blog_translations: Array<{ title: string; locale: string }>
}

interface NewsletterRef {
  id: string
  subject: string
  status: string | null
  edition_kind: string | null
  newsletter_types: Array<{ locale: string }> | null
}

interface PipelineRef {
  id: string
  title_pt: string | null
  title_en: string | null
  format: string | null
  stage: string | null
  version: number
  language: string | null
  tags: string[]
  hook: string | null
  synopsis: string | null
}

interface CrossPlaylistRef {
  blog_post_id: string | null
  newsletter_edition_id: string | null
  pipeline_id: string | null
  playlist_id: string
}

export async function listPlaylists(
  siteId: string,
  filters?: { status?: string; category?: string; search?: string },
): Promise<PlaylistRow[]> {
  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('playlists')
    .select('*')
    .eq('site_id', siteId)
    .order('updated_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.category) {
    query = query.ilike('category', filters.category)
  }
  if (filters?.search && filters.search.length >= 2) {
    const safe = filters.search.replace(/[.,()\\%_]/g, '')
    if (safe.length >= 2) {
      query = query.or(`name_en.ilike.%${safe}%,name_pt.ilike.%${safe}%`)
    }
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as PlaylistRow[]
}

export async function getPlaylistById(
  playlistId: string,
  siteId: string,
): Promise<PlaylistRow | null> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('id', playlistId)
    .eq('site_id', siteId)
    .maybeSingle()

  if (error) return null
  return data as PlaylistRow | null
}

export async function getPlaylistBySlug(
  slug: string,
  siteId: string,
): Promise<PlaylistRow | null> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('slug', slug)
    .eq('site_id', siteId)
    .maybeSingle()

  if (error) return null
  return data as PlaylistRow | null
}

function resolveContentType(
  item: PlaylistItemRow,
  pipelineMap: Map<string, PipelineRef>,
): ContentType | null {
  if (item.blog_post_id) return 'blog_post'
  if (item.newsletter_edition_id) return 'newsletter'
  if (item.pipeline_id) {
    const pl = pipelineMap.get(item.pipeline_id)
    if (pl?.format === 'video' || pl?.format === 'ig_reel') return 'video'
    return 'pipeline'
  }
  return null
}

export async function getPlaylistGraph(
  playlistId: string,
  siteId: string,
): Promise<PlaylistGraph | null> {
  const supabase = getSupabaseServiceClient()

  const [playlistRes, itemsRes, edgesRes] = await Promise.all([
    supabase
      .from('playlists')
      .select('*')
      .eq('id', playlistId)
      .eq('site_id', siteId)
      .maybeSingle(),
    supabase
      .from('playlist_items')
      .select('*')
      .eq('playlist_id', playlistId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('playlist_edges')
      .select('*')
      .eq('playlist_id', playlistId),
  ])

  if (playlistRes.error || !playlistRes.data) return null

  const rawItems = (itemsRes.data ?? []) as PlaylistItemRow[]
  const edges = (edgesRes.data ?? []) as PlaylistEdgeRow[]

  const enriched = await enrichItems(rawItems, playlistId)

  return {
    playlist: playlistRes.data as PlaylistRow,
    items: enriched,
    edges,
  }
}

async function enrichItems(
  items: PlaylistItemRow[],
  playlistId: string,
): Promise<PlaylistItemEnriched[]> {
  if (items.length === 0) return []

  const supabase = getSupabaseServiceClient()
  const blogIds = items.map(i => i.blog_post_id).filter(Boolean) as string[]
  const newsletterIds = items.map(i => i.newsletter_edition_id).filter(Boolean) as string[]
  const pipelineIds = items.map(i => i.pipeline_id).filter(Boolean) as string[]

  const [blogRes, newsletterRes, pipelineRes, crossRes] = await Promise.all([
    blogIds.length > 0
      ? supabase
          .from('blog_posts')
          .select('id, status, category, blog_translations!inner(title, locale)')
          .in('id', blogIds)
      : { data: [] },
    newsletterIds.length > 0
      ? supabase
          .from('newsletter_editions')
          .select('id, subject, status, edition_kind, newsletter_types(locale)')
          .in('id', newsletterIds)
      : { data: [] },
    pipelineIds.length > 0
      ? supabase
          .from('content_pipeline')
          .select('id, title_pt, title_en, format, stage, version, language, tags, hook, synopsis')
          .in('id', pipelineIds)
      : { data: [] },
    supabase
      .from('playlist_items')
      .select('blog_post_id, newsletter_edition_id, pipeline_id, playlist_id')
      .or(
        [
          blogIds.length > 0 ? `blog_post_id.in.(${blogIds.join(',')})` : null,
          newsletterIds.length > 0 ? `newsletter_edition_id.in.(${newsletterIds.join(',')})` : null,
          pipelineIds.length > 0 ? `pipeline_id.in.(${pipelineIds.join(',')})` : null,
        ].filter(Boolean).join(','),
      )
      .neq('playlist_id', playlistId),
  ])

  const blogMap = new Map((blogRes.data ?? []).map((b) => [(b as BlogPostRef).id, b as BlogPostRef]))
  const newsletterMap = new Map((newsletterRes.data ?? []).map((n) => [(n as NewsletterRef).id, n as NewsletterRef]))
  const pipelineMap = new Map((pipelineRes.data ?? []).map((p) => [(p as PipelineRef).id, p as PipelineRef]))

  const crossCounts = new Map<string, number>()
  for (const row of (crossRes.data ?? []) as CrossPlaylistRef[]) {
    const key = row.blog_post_id ?? row.newsletter_edition_id ?? row.pipeline_id
    if (key) crossCounts.set(key, (crossCounts.get(key) ?? 0) + 1)
  }

  return items.map((item): PlaylistItemEnriched => {
    const contentType = resolveContentType(item, pipelineMap)
    const isGhost = contentType === null

    let title = 'Content removed'
    let status: string | null = null
    let category: string | null = null
    let metadata: string | null = null
    let refId: string | null = null
    let language: 'pt-br' | 'en' | null = null
    let tags: string[] = []
    let hook: string | null = null
    let synopsis: string | null = null

    if (item.blog_post_id && blogMap.has(item.blog_post_id)) {
      const blog = blogMap.get(item.blog_post_id)!
      title = blog.blog_translations?.[0]?.title ?? 'Untitled'
      status = blog.status
      category = blog.category
      language = normalizeLang(blog.blog_translations?.[0]?.locale)
      refId = item.blog_post_id
    } else if (item.newsletter_edition_id && newsletterMap.has(item.newsletter_edition_id)) {
      const nl = newsletterMap.get(item.newsletter_edition_id)!
      title = nl.subject
      status = nl.status
      metadata = nl.edition_kind
      language = normalizeLang(nl.newsletter_types?.[0]?.locale)
      refId = item.newsletter_edition_id
    } else if (item.pipeline_id && pipelineMap.has(item.pipeline_id)) {
      const pl = pipelineMap.get(item.pipeline_id)!
      title = pl.title_pt ?? pl.title_en ?? 'Untitled'
      status = pl.stage
      category = pl.format
      metadata = `v${pl.version}`
      language = normalizeLang(pl.language)
      tags = pl.tags ?? []
      hook = pl.hook ?? null
      synopsis = pl.synopsis ?? null
      refId = item.pipeline_id
    }

    return {
      ...item,
      content_type: contentType,
      title,
      status,
      category,
      metadata,
      language,
      tags,
      hook,
      synopsis,
      is_ghost: isGhost,
      other_playlist_count: refId ? (crossCounts.get(refId) ?? 0) : 0,
    }
  })
}

export async function getNextSortOrder(playlistId: string): Promise<number> {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('playlist_items')
    .select('sort_order')
    .eq('playlist_id', playlistId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  return ((data as { sort_order: number } | null)?.sort_order ?? 0) + 1000
}

export async function getPlaylistItemCounts(
  siteId: string,
): Promise<Map<string, number>> {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('playlist_items')
    .select('playlist_id, playlists!inner(site_id)')
    .eq('playlists.site_id', siteId)

  const counts = new Map<string, number>()
  for (const row of (data ?? []) as { playlist_id: string }[]) {
    counts.set(row.playlist_id, (counts.get(row.playlist_id) ?? 0) + 1)
  }
  return counts
}

export async function resolveUniqueSlug(name: string, siteId: string): Promise<string> {
  const base = slugifyPlaylist(name)
  const supabase = getSupabaseServiceClient()

  const { data } = await supabase
    .from('playlists')
    .select('slug')
    .eq('site_id', siteId)
    .like('slug', `${base}%`)

  const taken = new Set((data ?? []).map((d: { slug: string }) => d.slug))
  if (!taken.has(base)) return base

  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`
    if (!taken.has(candidate)) return candidate
  }

  throw new Error('SLUG_EXHAUSTED')
}
