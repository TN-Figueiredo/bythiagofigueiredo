import type { SupabaseClient } from '@supabase/supabase-js'
import type { IPostRepository } from '../interfaces/post-repository'
import type { Post, PostListItem, CreatePostInput, UpdatePostInput } from '../types/post'
import type { ContentListOpts, ContentCountOpts } from '../types/content'
import { SupabaseContentRepository } from './content-repository'

export class SupabasePostRepository extends SupabaseContentRepository implements IPostRepository {
  async list(opts: ContentListOpts): Promise<PostListItem[]> {
    const page = opts.page ?? 1
    const perPage = opts.perPage ?? 12
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    let q = this.supabase
      .from('blog_posts')
      .select(`
        id, status, published_at, cover_image_url,
        blog_translations!inner(locale, title, slug, excerpt, reading_time_min)
      `)
      .eq('site_id', opts.siteId)
      .eq('blog_translations.locale', opts.locale)

    if (opts.status) q = q.eq('status', opts.status)
    if (opts.search) q = q.ilike('blog_translations.title', `%${opts.search}%`)

    const { data, error } = await q.range(from, to).order('published_at', { ascending: false, nullsFirst: false })
    if (error) throw error
    return (data ?? []).map((row: Record<string, unknown>) => this.mapListItem(row))
  }

  async getById(id: string): Promise<Post | null> {
    const { data, error } = await this.supabase
      .from('blog_posts')
      .select(`
        id, site_id, author_id, status, published_at, scheduled_for, cover_image_url,
        created_at, updated_at,
        blog_translations(*)
      `)
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? this.mapPost(data) : null
  }

  async getBySlug(opts: { siteId: string; locale: string; slug: string }): Promise<Post | null> {
    const { data, error } = await this.supabase
      .from('blog_posts')
      .select(`
        id, site_id, author_id, status, published_at, scheduled_for, cover_image_url,
        created_at, updated_at,
        blog_translations!inner(*)
      `)
      .eq('site_id', opts.siteId)
      .eq('blog_translations.locale', opts.locale)
      .eq('blog_translations.slug', opts.slug)
      .maybeSingle()
    if (error) throw error
    return data ? this.mapPost(data) : null
  }

  async create(input: CreatePostInput): Promise<Post> {
    const { data: post, error: pErr } = await this.supabase
      .from('blog_posts')
      .insert({
        site_id: input.site_id,
        author_id: input.author_id,
        status: 'draft',
      })
      .select()
      .single()
    if (pErr || !post) throw pErr ?? new Error('post insert failed')

    const { error: tErr } = await this.supabase.from('blog_translations').insert({
      post_id: post.id,
      locale: input.initial_translation.locale,
      title: input.initial_translation.title,
      slug: input.initial_translation.slug,
      excerpt: input.initial_translation.excerpt ?? null,
      content_mdx: input.initial_translation.content_mdx,
    })
    if (tErr) throw tErr

    const loaded = await this.getById(post.id)
    if (!loaded) throw new Error('post disappeared after create')
    return loaded
  }

  async update(id: string, patch: UpdatePostInput): Promise<Post> {
    if (patch.status !== undefined || patch.scheduled_for !== undefined || patch.cover_image_url !== undefined) {
      const { error } = await this.supabase.from('blog_posts').update({
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.scheduled_for !== undefined ? { scheduled_for: patch.scheduled_for } : {}),
        ...(patch.cover_image_url !== undefined ? { cover_image_url: patch.cover_image_url } : {}),
      }).eq('id', id)
      if (error) throw error
    }

    if (patch.translation) {
      const t = patch.translation
      const { error } = await this.supabase.from('blog_translations').update({
        ...(t.title !== undefined ? { title: t.title } : {}),
        ...(t.slug !== undefined ? { slug: t.slug } : {}),
        ...(t.excerpt !== undefined ? { excerpt: t.excerpt } : {}),
        ...(t.content_mdx !== undefined ? { content_mdx: t.content_mdx } : {}),
        ...(t.content_compiled !== undefined ? { content_compiled: t.content_compiled } : {}),
        ...(t.content_toc !== undefined ? { content_toc: t.content_toc } : {}),
        ...(t.reading_time_min !== undefined ? { reading_time_min: t.reading_time_min } : {}),
      }).eq('post_id', id).eq('locale', t.locale)
      if (error) throw error
    }

    const loaded = await this.getById(id)
    if (!loaded) throw new Error('post disappeared after update')
    return loaded
  }

  async publish(id: string): Promise<Post> {
    const { data, error } = await this.supabase
      .from('blog_posts')
      .update({ status: 'published', published_at: this.nowIso() })
      .eq('id', id)
      .select(`
        id, site_id, author_id, status, published_at, scheduled_for, cover_image_url,
        created_at, updated_at,
        blog_translations(*)
      `)
      .single()
    if (error || !data) throw error ?? new Error('publish failed')
    return this.mapPost(data)
  }

  async unpublish(id: string): Promise<Post> {
    const { data, error } = await this.supabase
      .from('blog_posts')
      .update({ status: 'draft', published_at: null })
      .eq('id', id)
      .select(`id, site_id, author_id, status, published_at, scheduled_for, cover_image_url, created_at, updated_at, blog_translations(*)`)
      .single()
    if (error || !data) throw error ?? new Error('unpublish failed')
    return this.mapPost(data)
  }

  async schedule(id: string, scheduledFor: Date): Promise<Post> {
    const { data, error } = await this.supabase
      .from('blog_posts')
      .update({ status: 'scheduled', scheduled_for: scheduledFor.toISOString() })
      .eq('id', id)
      .select(`id, site_id, author_id, status, published_at, scheduled_for, cover_image_url, created_at, updated_at, blog_translations(*)`)
      .single()
    if (error || !data) throw error ?? new Error('schedule failed')
    return this.mapPost(data)
  }

  async archive(id: string): Promise<Post> {
    const { data, error } = await this.supabase
      .from('blog_posts')
      .update({ status: 'archived' })
      .eq('id', id)
      .select(`id, site_id, author_id, status, published_at, scheduled_for, cover_image_url, created_at, updated_at, blog_translations(*)`)
      .single()
    if (error || !data) throw error ?? new Error('archive failed')
    return this.mapPost(data)
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('blog_posts').delete().eq('id', id)
    if (error) throw error
  }

  async count(opts: ContentCountOpts): Promise<number> {
    let q = this.supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('site_id', opts.siteId)
    if (opts.status) q = q.eq('status', opts.status)
    const { count, error } = await q
    if (error) throw error
    return count ?? 0
  }

  async getByAuthor(_authorId: string, opts: ContentListOpts): Promise<PostListItem[]> {
    // Sprint 2: thin wrapper over list. Full author filter is a small refinement for later.
    return this.list(opts)
  }

  private mapListItem(row: Record<string, unknown>): PostListItem {
    const translations = (row.blog_translations as Record<string, unknown>[]) ?? []
    const t = translations[0] ?? {}
    return {
      id: row.id as string,
      status: row.status as PostListItem['status'],
      published_at: (row.published_at as string | null) ?? null,
      cover_image_url: (row.cover_image_url as string | null) ?? null,
      translation: {
        locale: t.locale as string,
        title: t.title as string,
        slug: t.slug as string,
        excerpt: (t.excerpt as string | null) ?? null,
        reading_time_min: (t.reading_time_min as number) ?? 0,
      },
      available_locales: translations.map((x) => x.locale as string),
    }
  }

  private mapPost(row: Record<string, unknown>): Post {
    return {
      id: row.id as string,
      site_id: row.site_id as string,
      author_id: row.author_id as string,
      status: row.status as Post['status'],
      published_at: (row.published_at as string | null) ?? null,
      scheduled_for: (row.scheduled_for as string | null) ?? null,
      cover_image_url: (row.cover_image_url as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      translations: ((row.blog_translations as Record<string, unknown>[]) ?? []).map((t) => ({
        id: t.id as string,
        post_id: t.post_id as string,
        locale: t.locale as string,
        title: t.title as string,
        slug: t.slug as string,
        excerpt: (t.excerpt as string | null) ?? null,
        content_mdx: t.content_mdx as string,
        content_compiled: (t.content_compiled as string | null) ?? null,
        content_toc: (t.content_toc as Array<{ depth: number; text: string; slug: string }>) ?? [],
        reading_time_min: (t.reading_time_min as number) ?? 0,
        created_at: t.created_at as string,
        updated_at: t.updated_at as string,
      })),
    }
  }
}
