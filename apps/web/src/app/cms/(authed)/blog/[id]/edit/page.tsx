import { notFound } from 'next/navigation'
import { marked } from 'marked'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getPipelineItemForPost } from '@/lib/pipeline/blog-link'
import { buildInitialState } from './reducer'
import type { ServerSibling } from './reducer'
import type { PostStatus, CategoryInfo, SeoAudit } from './types'
import { EditorClient } from './editor-client'

export const dynamic = 'force-dynamic'

const VALID_STATUSES: PostStatus[] = ['idea', 'draft', 'ready', 'pending_review', 'scheduled', 'published', 'archived']

interface Props {
  params: Promise<{ id: string }>
}

function isContentJsonEmpty(json: Record<string, unknown> | null): boolean {
  if (!json) return true
  const content = json.content as Array<{ type?: string; content?: unknown[] }> | undefined
  if (!content?.length) return true
  return content.length === 1 && content[0]?.type === 'paragraph' && !content[0]?.content?.length
}

interface PipelineBodyResult {
  html: string
  bodyImages: Array<{ refId: string; description: string }>
  coverPrompt: string
  coverImageUrl: string | null
}

async function getPipelineBody(
  sections: Record<string, unknown> | null,
  locale: string,
  bodyContent: string | null = null,
): Promise<PipelineBodyResult | null> {
  if (!sections && !bodyContent) return null
  const draftKey = locale === 'en' ? 'draft_en' : 'draft_pt'
  const draft = sections?.[draftKey] as { content?: { body?: unknown } } | undefined
  const draftBody = typeof draft?.content?.body === 'string' ? draft.content.body : null

  const markdown = draftBody || bodyContent
  if (!markdown || markdown.trim().length === 0) return null

  let html = await marked.parse(markdown)

  // Transform placeholder images (placehold.co URLs or img-*: alt prefix) into <figure data-blog-image>
  html = html.replace(
    /<img\s+[^>]*?src="https?:\/\/placehold\.co[^"]*"[^>]*?\/?>/gi,
    (imgTag) => {
      const altMatch = imgTag.match(/alt="([^"]*)"/)
      const alt = altMatch?.[1] ?? ''
      const refIdMatch = alt.match(/^img-(\w+):\s*(.*)/)
      const refId = refIdMatch ? `img-${refIdMatch[1]}` : null
      const caption = refIdMatch?.[2]?.trim() ?? alt
      return `<figure data-blog-image data-image-id="${refId || ''}" data-status="empty"><figcaption>${caption}</figcaption></figure>`
    },
  )

  // Extract images from images_shared section and inject as <figure data-blog-image>
  const imagesShared = sections?.['images_shared'] as {
    content?: {
      cover?: { prompts?: Array<{ prompt?: string; alt_text_pt?: string; alt_text_en?: string }>; image_url?: string | null }
      body_images?: Array<{ ref_id: string; placement?: string; description?: string; prompts?: Array<{ alt_text_pt?: string; alt_text_en?: string }> }>
    }
  } | undefined
  const bodyImages: Array<{ refId: string; description: string }> = []
  const altKey = locale === 'en' ? 'alt_text_en' : 'alt_text_pt'

  function makeFigure(id: string, caption: string): string {
    return `<figure data-blog-image data-image-id="${id}" data-status="empty"><figcaption>${caption}</figcaption></figure>`
  }

  function insertAfterNthTag(src: string, tag: string, n: number, content: string): string {
    const re = new RegExp(`</${tag}>`, 'gi')
    let count = 0
    let lastIndex = -1
    let match: RegExpExecArray | null
    while ((match = re.exec(src)) !== null) {
      count++
      if (count === n) { lastIndex = match.index + match[0].length; break }
    }
    if (lastIndex > 0) return src.slice(0, lastIndex) + '\n' + content + src.slice(lastIndex)
    return src + '\n' + content
  }

  // Body image placeholders — use placement to position correctly
  if (imagesShared?.content?.body_images) {
    for (const img of imagesShared.content.body_images) {
      const refId = img.ref_id.startsWith('img-') ? img.ref_id : `img-${img.ref_id}`
      const desc = img.description || img.prompts?.[0]?.[altKey] || ''
      bodyImages.push({ refId, description: desc })
      if (!html.includes(`data-image-id="${refId}"`)) {
        const figure = makeFigure(refId, desc)
        const placementMatch = img.placement?.match(/^after_(h[1-6]|paragraph):(\d+)$/)
        if (placementMatch?.[1] && placementMatch[2]) {
          const tag = placementMatch[1] === 'paragraph' ? 'p' : placementMatch[1]
          html = insertAfterNthTag(html, tag, parseInt(placementMatch[2], 10), figure)
        } else {
          html += '\n' + figure
        }
      }
    }
  }

  const coverPrompt = imagesShared?.content?.cover?.prompts?.[0]?.prompt ?? ''
  const coverImageUrl = imagesShared?.content?.cover?.image_url ?? null
  return { html, bodyImages, coverPrompt, coverImageUrl }
}

export default async function BlogEditorPage({ params }: Props) {
  const { id } = await params
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  // 1. Load post
  const { data: post, error: postError } = await supabase
    .from('blog_posts')
    .select('id, site_id, status, cover_image_url, category, tag_id, previous_post_id, continues_in_next, published_at, updated_at')
    .eq('id', id)
    .single()

  if (!post || postError || post.site_id !== ctx.siteId) notFound()

  // 2. Load translation (prefer site default locale, fallback to any)
  const { data: translations } = await supabase
    .from('blog_translations')
    .select('locale, title, slug, excerpt, content_json, content_html, content_mdx, meta_title, meta_description, og_image_url, reading_time_min, key_points, pull_quote, notes, colophon')
    .eq('post_id', id)
    .order('locale')

  if (!translations?.length) notFound()
  const preferredLocale = ctx.defaultLocale.startsWith('en') ? 'en' : 'pt-BR'
  const preferred = translations.find(t => t.locale === preferredLocale)
  const withContent = translations.find(t => !!t.title)
  const tx = (preferred?.title ? preferred : withContent) ?? preferred ?? translations[0]
  if (!tx) notFound()

  // 3. Parallel fetches for remaining data
  const [tagsResult, hashtagResult, pipelineItem] = await Promise.all([
    supabase.from('blog_tags').select('id, name, color').eq('site_id', ctx.siteId).order('sort_order'),
    supabase.from('post_hashtags').select('hashtags(id, name, slug)').eq('post_id', id),
    getPipelineItemForPost(id).catch(() => null),
  ])

  // 4. Sections do pipeline (fetch único) — draft fallback, cover, direção, prompts, seo audit
  let sectionsMap: Record<string, unknown> | null = null
  let pipelineBodyContent: string | null = null
  if (pipelineItem) {
    const { data: itemRow } = await supabase
      .from('content_pipeline')
      .select('sections, body_content')
      .eq('id', pipelineItem.id)
      .single()
    sectionsMap = (itemRow?.sections as Record<string, unknown> | null) ?? null
    pipelineBodyContent = (itemRow?.body_content as string | null) ?? null
  }

  let contentJson = tx.content_json as Record<string, unknown> | null
  let contentHtml = tx.content_html as string | null
  let coverPrompt = ''
  let pipelineCoverUrl: string | null = null

  if (isContentJsonEmpty(contentJson) && pipelineItem) {
    const pipelineBody = await getPipelineBody(sectionsMap, tx.locale, pipelineBodyContent)
    if (pipelineBody) {
      contentJson = null
      contentHtml = pipelineBody.html
      coverPrompt = pipelineBody.coverPrompt
      pipelineCoverUrl = pipelineBody.coverImageUrl
    }
  } else if (sectionsMap) {
    const cover = (sectionsMap['images_shared'] as {
      content?: { cover?: { prompts?: Array<{ prompt?: string }>; image_url?: string | null } }
    } | undefined)?.content?.cover
    coverPrompt = cover?.prompts?.[0]?.prompt ?? ''
    pipelineCoverUrl = cover?.image_url ?? null
  }

  // Pipeline extras: direção + alternativas (ideia_shared), prompts por imagem
  // (images_shared) e auditoria SEO (seo_{lang}.audit)
  let direction = ''
  let directionAlts: string[] = []
  const imagePrompts: Record<string, string> = {}
  let seoAudit: SeoAudit | null = null

  if (sectionsMap) {
    const ideia = sectionsMap['ideia_shared'] as
      | { content?: { angle?: string; siblings?: string[] } } | undefined
    direction = typeof ideia?.content?.angle === 'string' ? ideia.content.angle : ''
    directionAlts = Array.isArray(ideia?.content?.siblings)
      ? ideia.content.siblings.filter((s): s is string => typeof s === 'string')
      : []

    const imgs = sectionsMap['images_shared'] as
      | { content?: { body_images?: Array<{ ref_id?: string; prompts?: Array<{ prompt?: string }> }> } } | undefined
    for (const bi of imgs?.content?.body_images ?? []) {
      const p = bi.prompts?.[0]?.prompt
      if (bi.ref_id && typeof p === 'string' && p) {
        imagePrompts[bi.ref_id.startsWith('img-') ? bi.ref_id : `img-${bi.ref_id}`] = p
      }
    }

    const seoKey = tx.locale === 'en' ? 'seo_en' : 'seo_pt'
    const seoSection = sectionsMap[seoKey] as
      | { content?: { audit?: Record<string, unknown> } } | undefined
    const a = seoSection?.content?.audit
    if (a && typeof a.score === 'number') {
      seoAudit = {
        score: a.score,
        grade: typeof a.grade === 'string' ? a.grade : '',
        ranAt: typeof a.ran_at === 'string' ? a.ran_at : '',
        phase: a.phase === 'post_publish' ? 'post_publish' : 'pre_publish',
        keyword: typeof a.keyword === 'string' ? a.keyword : '',
        issues: Array.isArray(a.issues) ? (a.issues as SeoAudit['issues']) : [],
        titleSuggestions: Array.isArray(a.title_suggestions)
          ? (a.title_suggestions as SeoAudit['titleSuggestions']) : [],
        metaSuggestion: (a.meta_suggestion ?? null) as SeoAudit['metaSuggestion'],
      }
    }
  }

  // 5. Blog categories (content_collections was dropped — hardcoded from design handoff)
  const categories: CategoryInfo[] = [
    { id: 'bts',      labelPt: 'Behind the Scenes', labelEn: 'Behind the Scenes', color: '#c14513', colorDark: '#FF8240' },
    { id: 'stories',  labelPt: 'Histórias',         labelEn: 'Stories',            color: '#22b8d6', colorDark: '#3fcdea' },
    { id: 'building', labelPt: 'Construindo',        labelEn: 'Building',           color: '#22c55e', colorDark: '#3ad675' },
    { id: 'money',    labelPt: 'Dinheiro',           labelEn: 'Money',              color: '#a855f7', colorDark: '#c084fc' },
    { id: 'ai',       labelPt: 'AI Empire',          labelEn: 'AI Empire',          color: '#f59e0b', colorDark: '#ffb02e' },
    { id: 'control',  labelPt: 'Controle',           labelEn: 'Control',            color: '#a855f7', colorDark: '#c084fc' },
  ]

  // 6. Resolve title/excerpt with pipeline fallbacks
  const resolvedTitle = tx.title
    || (pipelineItem ? (tx.locale === 'en' ? pipelineItem.title_en ?? pipelineItem.title_pt : pipelineItem.title_pt ?? pipelineItem.title_en) : null)
    || ''
  const resolvedExcerpt = tx.excerpt || pipelineItem?.synopsis || ''

  // 6b. Hydrate other-language versions already stored (post-level cover + status apply to all).
  const postPublished = post.status === 'published'
  const siblings: ServerSibling[] = (translations ?? [])
    .filter((t) => t.locale !== tx.locale && !!t.title)
    .map((t) => ({
      locale: t.locale,
      title: t.title ?? '',
      slug: t.slug ?? '',
      excerpt: t.excerpt ?? '',
      contentJson: (t.content_json as Record<string, unknown> | null) ?? null,
      contentHtml: (t.content_html as string | null) ?? null,
      coverImageUrl: post.cover_image_url ?? null,
      coverReady: !!post.cover_image_url,
      metaTitle: (t.meta_title as string) || (t.title ?? ''),
      metaDesc: (t.meta_description as string) || (t.excerpt ?? ''),
      ogImageUrl: (t.og_image_url as string | null) ?? null,
      published: postPublished,
      publishedAt: post.published_at ?? null,
      updatedAt: post.updated_at ?? null,
      readingTimeMin: (t.reading_time_min as number) ?? 0,
    }))

  // 7. Build initial state
  const initialState = buildInitialState({
    postId: id,
    code: pipelineItem?.code ?? `post-${id.slice(0, 4)}`,
    siteId: ctx.siteId,
    siteTimezone: ctx.timezone,
    locale: tx.locale,
    title: resolvedTitle,
    slug: tx.slug,
    excerpt: resolvedExcerpt,
    status: VALID_STATUSES.includes(post.status as PostStatus) ? post.status as PostStatus : 'draft',
    contentJson: contentJson,
    contentHtml: contentHtml,
    coverImageUrl: post.cover_image_url || pipelineCoverUrl,
    metaTitle: tx.meta_title || resolvedTitle,
    metaDesc: tx.meta_description || resolvedExcerpt,
    ogImageUrl: tx.og_image_url,
    keyPoints: (tx.key_points as string[]) ?? [],
    pullQuote: (tx.pull_quote as string) ?? '',
    notes: (tx.notes as string[]) ?? [],
    colophon: (tx.colophon as string) ?? '',
    coverPrompt,
    previousPostId: post.previous_post_id ?? null,
    continuesInNext: post.continues_in_next ?? false,
    hashtags: ((hashtagResult.data ?? []) as unknown as Array<{ hashtags: { id: string; name: string; slug: string } | null }>)
      .map(r => r.hashtags)
      .filter((h): h is { id: string; name: string; slug: string } => h !== null),
    tags: (tagsResult.data ?? []).map((t: { id: string; name: string; color: string }) => t.name),
    hook: pipelineItem?.hook ?? '',
    synopsis: pipelineItem?.synopsis ?? '',
    plevel: `P${pipelineItem?.priority ?? 3}`,
    history: [],
    category: post.category,
    tagId: post.tag_id,
    categories,
    publishedAt: post.published_at ?? null,
    updatedAt: post.updated_at ?? null,
    readingTimeMin: (tx.reading_time_min as number) ?? 0,
    siblings,
    pipelineItemId: pipelineItem?.id ?? null,
    direction,
    directionAlts,
    imagePrompts,
    seoAudit,
  })

  return <EditorClient initialState={initialState} />
}
