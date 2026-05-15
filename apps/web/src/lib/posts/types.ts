export type PostTab = 'content' | 'images' | 'seo' | 'social' | 'publish'

export type SectionStatus = 'done' | 'warn' | 'empty'

export interface PostTabMeta {
  tab: PostTab
  labelPt: string
  labelEn: string
}

export const POST_TABS: PostTabMeta[] = [
  { tab: 'content', labelPt: 'Conteúdo', labelEn: 'Content' },
  { tab: 'images', labelPt: 'Imagens', labelEn: 'Images' },
  { tab: 'seo', labelPt: 'SEO', labelEn: 'SEO' },
  { tab: 'social', labelPt: 'Social', labelEn: 'Social' },
  { tab: 'publish', labelPt: 'Publicação', labelEn: 'Publication' },
]

export type PostStage = 'editing' | 'scheduled' | 'published'

export const POST_STAGES: Array<{ stage: PostStage; labelPt: string; dbStatus: string }> = [
  { stage: 'editing', labelPt: 'Em edição', dbStatus: 'draft' },
  { stage: 'scheduled', labelPt: 'Agendado', dbStatus: 'scheduled' },
  { stage: 'published', labelPt: 'Publicado', dbStatus: 'published' },
]

export function dbStatusToStage(status: string): PostStage {
  if (status === 'scheduled') return 'scheduled'
  if (status === 'published') return 'published'
  return 'editing'
}

export interface PostDetailData {
  id: string
  siteId: string
  authorId: string
  status: string
  category: string | null
  coverImageUrl: string | null
  locale: string
  scheduledAt: string | null
  publishedAt: string | null
  socialConfig: import('@/lib/social/types').SocialConfig | null
  includeInNewsletter: boolean
  rssIncluded: boolean
  searchIndexable: boolean
  canonicalUrl: string | null
  translations: PostTranslation[]
  pipelineItem: { id: string; code: string; format: string; stage: string; priority: number } | null
  createdAt: string
  updatedAt: string
}

export interface PostTranslation {
  locale: string
  title: string
  slug: string
  excerpt: string | null
  contentMdx: string | null
  contentJson: Record<string, unknown> | null
  contentHtml: string | null
  metaTitle: string | null
  metaDescription: string | null
  ogImageUrl: string | null
  keyPoints: string[] | null
  pullQuote: string | null
}
