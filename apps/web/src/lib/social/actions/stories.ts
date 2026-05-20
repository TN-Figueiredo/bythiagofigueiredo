'use server'

import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  type ActionResult,
  SENTRY_TAG,
  zodError,
  requireEditAccess,
} from './_shared'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StoryTab = 'drafts' | 'live' | 'expired' | 'scheduled'

export interface StoryRow {
  id: string
  story_slides: unknown[]
  status: string
  scheduled_at: string | null
  published_at: string | null
  source_content_id: string | null
  source_content_type: string | null
  source_locale: string | null
  template_id: string | null
  created_at: string
  site_id: string
}

export interface StoryCounts {
  drafts: number
  live: number
  expired: number
  scheduled: number
}

export interface SourceContentResult {
  id: string
  title: string
  type: string
  url: string
  coverImageUrl: string | null
  excerpt: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const StoryRowSchema = z.object({
  id: z.string(),
  story_slides: z.array(z.unknown()).default([]),
  status: z.string().default('draft'),
  scheduled_at: z.string().nullable().default(null),
  published_at: z.string().nullable().default(null),
  source_content_id: z.string().nullable().default(null),
  source_content_type: z.string().nullable().default(null),
  source_locale: z.string().nullable().default(null),
  template_id: z.string().nullable().default(null),
  created_at: z.string(),
  site_id: z.string(),
})

function toStoryRow(row: unknown): StoryRow {
  return StoryRowSchema.parse(row)
}

function ago24h(): string {
  const d = new Date()
  d.setHours(d.getHours() - 24)
  return d.toISOString()
}

// ---------------------------------------------------------------------------
// getStories
// ---------------------------------------------------------------------------

export async function getStories(
  siteId: string,
  tab: StoryTab,
): Promise<ActionResult<StoryRow[]>> {
  const idParsed = z.string().uuid().safeParse(siteId)
  if (!idParsed.success) return { ok: false, error: 'ID do site inválido' }
  const tabParsed = z.enum(['drafts', 'live', 'expired', 'scheduled']).safeParse(tab)
  if (!tabParsed.success) return { ok: false, error: zodError(tabParsed.error) }

  try {
    const { siteId: authorizedSiteId } = await requireEditAccess()
    if (idParsed.data !== authorizedSiteId) return { ok: false, error: 'Sem permissão' }
    const supabase = getSupabaseServiceClient()

    let query = supabase
      .from('social_posts')
      .select('id, story_slides, status, scheduled_at, published_at, source_content_id, source_content_type, source_locale, template_id, created_at, site_id')
      .eq('site_id', authorizedSiteId)
      .not('story_slides', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100)

    switch (tabParsed.data) {
      case 'drafts':
        query = query.eq('status', 'draft')
        break
      case 'live':
        query = query
          .eq('status', 'completed')
          .gt('published_at', ago24h())
        break
      case 'expired':
        query = query
          .eq('status', 'completed')
          .lte('published_at', ago24h())
        break
      case 'scheduled':
        query = query.eq('status', 'scheduled')
        break
    }

    const { data, error } = await query

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'getStories' } })
      return { ok: false, error: error.message }
    }

    return { ok: true, data: (data ?? []).map(toStoryRow) }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'getStories' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// getStoryCounts
// ---------------------------------------------------------------------------

export async function getStoryCounts(siteId: string): Promise<ActionResult<StoryCounts>> {
  const idParsed = z.string().uuid().safeParse(siteId)
  if (!idParsed.success) return { ok: false, error: 'ID do site inválido' }

  try {
    const { siteId: authorizedSiteId } = await requireEditAccess()
    if (idParsed.data !== authorizedSiteId) return { ok: false, error: 'Sem permissão' }
    const supabase = getSupabaseServiceClient()

    const threshold = ago24h()

    const { data, error } = await supabase
      .from('social_posts')
      .select('status, published_at')
      .eq('site_id', authorizedSiteId)
      .not('story_slides', 'is', null)

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'getStoryCounts' } })
      return { ok: false, error: error.message }
    }

    const counts: StoryCounts = { drafts: 0, live: 0, expired: 0, scheduled: 0 }
    for (const row of data ?? []) {
      if (row.status === 'draft') counts.drafts++
      else if (row.status === 'scheduled') counts.scheduled++
      else if (row.status === 'completed') {
        if (row.published_at && row.published_at > threshold) counts.live++
        else counts.expired++
      }
    }

    return { ok: true, data: counts }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'getStoryCounts' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// searchSourceContent
// ---------------------------------------------------------------------------

const searchContentTypeSchema = z.enum(['blog', 'newsletter', 'campaign'])

export async function searchSourceContent(
  siteId: string,
  type: string,
  search: string,
): Promise<ActionResult<SourceContentResult[]>> {
  const idParsed = z.string().uuid().safeParse(siteId)
  if (!idParsed.success) return { ok: false, error: 'ID do site inválido' }
  const typeParsed = searchContentTypeSchema.safeParse(type)
  if (!typeParsed.success) return { ok: false, error: 'Tipo de conteúdo inválido' }

  try {
    const { siteId: authorizedSiteId } = await requireEditAccess()
    if (idParsed.data !== authorizedSiteId) return { ok: false, error: 'Sem permissão' }
    const supabase = getSupabaseServiceClient()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const trimmedSearch = search.slice(0, 200)
    const escapedSearch = trimmedSearch.replace(/%/g, '\\%').replace(/_/g, '\\_')

    if (typeParsed.data === 'blog') {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, cover_image_url, blog_translations(title, slug, locale, cover_image_url, excerpt)')
        .eq('site_id', authorizedSiteId)
        .ilike('blog_translations.title', `%${escapedSearch}%`)
        .limit(20)

      if (error) return { ok: false, error: error.message }

      const results: SourceContentResult[] = []
      for (const row of (data ?? []) as Array<{
        id: string
        cover_image_url: string | null
        blog_translations: Array<{ title: string; slug: string; locale: string; cover_image_url: string | null; excerpt: string | null }> | null
      }>) {
        const tx = row.blog_translations?.[0]
        if (!tx) continue
        results.push({
          id: row.id,
          title: tx.title,
          type: 'blog',
          url: `${appUrl}/blog/${tx.slug}`,
          coverImageUrl: tx.cover_image_url ?? row.cover_image_url ?? null,
          excerpt: tx.excerpt ?? null,
        })
      }
      return { ok: true, data: results }
    }

    if (typeParsed.data === 'newsletter') {
      const { data, error } = await supabase
        .from('newsletter_editions')
        .select('id, subject')
        .eq('site_id', authorizedSiteId)
        .ilike('subject', `%${escapedSearch}%`)
        .limit(20)

      if (error) return { ok: false, error: error.message }

      return {
        ok: true,
        data: (data ?? []).map((row) => ({
          id: row.id as string,
          title: row.subject as string,
          type: 'newsletter',
          url: `${appUrl}/newsletter/${row.id}`,
          coverImageUrl: null,
          excerpt: null,
        })),
      }
    }

    if (typeParsed.data === 'campaign') {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, campaign_translations(meta_title, slug)')
        .eq('site_id', authorizedSiteId)
        .ilike('campaign_translations.meta_title', `%${escapedSearch}%`)
        .limit(20)

      if (error) return { ok: false, error: error.message }

      const results: SourceContentResult[] = []
      for (const row of (data ?? []) as Array<{ id: string; campaign_translations: Array<{ meta_title: string; slug: string }> | null }>) {
        const tx = row.campaign_translations?.[0]
        if (!tx) continue
        results.push({
          id: row.id,
          title: tx.meta_title,
          type: 'campaign',
          url: `${appUrl}/campaigns/${tx.slug}`,
          coverImageUrl: null,
          excerpt: null,
        })
      }
      return { ok: true, data: results }
    }

    return { ok: false, error: 'Tipo de conteúdo não suportado' }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'searchSourceContent' } })
    throw err
  }
}
