// ---------------------------------------------------------------------------
// MCP Resources — exposes pipeline data as structured resources that LLM
// clients can browse and read.  Each resource is either a static URI or a
// URI template with variables.
//
// Service functions (services/*.ts) provide the actual data — this module
// only wires registration and serialisation.
// ---------------------------------------------------------------------------

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'

import { API_REGISTRY, type DomainId } from '@/lib/pipeline/api-registry'
import { WORKFLOWS, DEFAULT_CHECKLISTS } from '@/lib/pipeline/workflows'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import * as youtube from '@/lib/pipeline/services/youtube'
import type { ServiceContext } from '@/lib/pipeline/services/types'

import * as fs from 'node:fs/promises'
import * as path from 'node:path'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOMAIN_IDS: DomainId[] = [
  'items-and-sections',
  'playlists',
  'libraries',
  'research',
  'youtube',
  'utilities',
  'course',
]

const SKILL_IDS = [
  'ideator',
  'writer',
  'producer',
  'product_eval',
  'perf_review',
  'curator',
  'architect',
] as const

// Pipeline docs live relative to the web app data directory
const PIPELINE_DOCS_DIR = path.resolve(
  process.cwd(),
  'data',
  'pipeline-docs',
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ResourceContents {
  [key: string]: unknown
  contents: Array<{ uri: string; mimeType: string; text: string }>
}

/** Build a read-only ServiceContext for resource handlers. */
async function buildResourceCtx(): Promise<{ ctx: ServiceContext; siteId: string }> {
  const supabase = getSupabaseServiceClient()
  const { data: site } = await supabase.from('sites').select('id').limit(1).single()
  if (!site) throw new Error('No site found')
  const ctx: ServiceContext = {
    siteId: site.id,
    permissions: ['read'],
    keyHash: 'resource-reader',
    supabase,
    source: 'api_key',
  }
  return { ctx, siteId: site.id }
}

function jsonResource(data: unknown): ResourceContents {
  return {
    contents: [{
      uri: '', // placeholder — overridden per handler
      mimeType: 'application/json',
      text: JSON.stringify(data, null, 2),
    }],
  }
}

function mdResource(text: string): ResourceContents {
  return {
    contents: [{
      uri: '',
      mimeType: 'text/markdown',
      text,
    }],
  }
}

// ---------------------------------------------------------------------------
// registerResources
// ---------------------------------------------------------------------------

export function registerResources(server: McpServer): void {
  // -------------------------------------------------------------------------
  // 1. pipeline://catalog — static API catalog (from api-registry.ts)
  // -------------------------------------------------------------------------
  server.resource(
    'catalog',
    'pipeline://catalog',
    {
      description: 'API catalog with all capability domains, endpoints, and cross-domain workflows',
      mimeType: 'application/json',
      size: 8_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const result = jsonResource(API_REGISTRY)
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 2. pipeline://docs/{domain} — domain documentation (7 markdown files)
  // -------------------------------------------------------------------------
  server.resource(
    'domain-docs',
    new ResourceTemplate('pipeline://docs/{domain}', { list: undefined }),
    {
      description: 'Tier-2 documentation guide for a capability domain (items-and-sections, playlists, libraries, research, youtube, utilities, course)',
      mimeType: 'text/markdown',
      size: 25_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri, variables) => {
      const domain = String(variables.domain)
      if (!DOMAIN_IDS.includes(domain as DomainId)) {
        throw new Error(`Unknown domain: ${domain}. Valid: ${DOMAIN_IDS.join(', ')}`)
      }
      const filePath = path.join(PIPELINE_DOCS_DIR, `cowork-docs-${domain}.md`)
      const content = await fs.readFile(filePath, 'utf-8')
      const result = mdResource(content)
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 3. pipeline://context/{skill} — skill-specific reference documents
  // -------------------------------------------------------------------------
  server.resource(
    'skill-context',
    new ResourceTemplate('pipeline://context/{skill}', { list: undefined }),
    {
      description: 'Skill-specific reference content for a Cowork skill (ideator, writer, producer, product_eval, perf_review, curator, architect)',
      mimeType: 'text/markdown',
      size: 12_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri, variables) => {
      const skill = String(variables.skill)
      if (!SKILL_IDS.includes(skill as typeof SKILL_IDS[number])) {
        throw new Error(`Unknown skill: ${skill}. Valid: ${SKILL_IDS.join(', ')}`)
      }

      const supabase = getSupabaseServiceClient()
      const { data, error } = await supabase
        .from('pipeline_context')
        .select('key, title, body')
        .contains('skills', [skill])
        .order('sort_order', { ascending: true })

      if (error) throw new Error(`Failed to fetch context for skill ${skill}: ${error.message}`)

      const docs = (data ?? [])
        .map((d: { key: string; title: string; body: string }) =>
          `## ${d.title}\n\n${d.body}`,
        )
        .join('\n\n---\n\n')

      const result = mdResource(docs || `No reference content found for skill: ${skill}`)
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 4. pipeline://stats — pipeline statistics
  // -------------------------------------------------------------------------
  server.resource(
    'stats',
    'pipeline://stats',
    {
      description: 'Pipeline statistics: item counts by format, stage, and priority',
      mimeType: 'application/json',
      size: 2_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const supabase = getSupabaseServiceClient()

      const { data: items, error } = await supabase
        .from('content_pipeline')
        .select('format, stage, priority, archived')
        .eq('archived', false)

      if (error) throw new Error(`Failed to fetch stats: ${error.message}`)

      const rows = items ?? []

      const byFormat: Record<string, number> = {}
      const byStage: Record<string, number> = {}
      const byPriority: Record<number, number> = {}

      for (const row of rows) {
        const f = row.format as string
        const s = row.stage as string
        const p = row.priority as number
        byFormat[f] = (byFormat[f] ?? 0) + 1
        byStage[s] = (byStage[s] ?? 0) + 1
        byPriority[p] = (byPriority[p] ?? 0) + 1
      }

      const result = jsonResource({
        total: rows.length,
        byFormat,
        byStage,
        byPriority,
        generatedAt: new Date().toISOString(),
      })
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 5. pipeline://workflows — workflow definitions + checklists
  // -------------------------------------------------------------------------
  server.resource(
    'workflows',
    'pipeline://workflows',
    {
      description: 'Workflow stage definitions and default production checklists for all content formats',
      mimeType: 'application/json',
      size: 3_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const result = jsonResource({
        workflows: WORKFLOWS,
        checklists: DEFAULT_CHECKLISTS,
      })
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 6. pipeline://up-next — today's actions, week grid, streak
  // -------------------------------------------------------------------------
  server.resource(
    'up-next',
    'pipeline://up-next',
    {
      description: "Today's actions, week grid, production streak, and suggestions from the Command Center",
      mimeType: 'application/json',
      size: 4_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      // Defer to the shared fetcher — requires siteId resolution
      const { fetchUpNextData } = await import('@/lib/pipeline/up-next-fetcher')
      const supabase = getSupabaseServiceClient()

      // Resolve the default site (first active site)
      const { data: site } = await supabase
        .from('sites')
        .select('id')
        .limit(1)
        .single()

      if (!site) throw new Error('No site found for up-next resource')

      const data = await fetchUpNextData(
        supabase,
        site.id,
        'America/Sao_Paulo',
        new Date(),
        10,
      )

      const result = jsonResource(data)
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 7. pipeline://youtube/intelligence — channel intelligence snapshot
  // -------------------------------------------------------------------------
  server.resource(
    'youtube-intelligence',
    'pipeline://youtube/intelligence',
    {
      description: 'YouTube channel intelligence snapshot: health score, grade distribution, top/bottom videos, demographics, search terms',
      mimeType: 'application/json',
      size: 5_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const { ctx } = await buildResourceCtx()
      const supabase = getSupabaseServiceClient()

      // Resolve the first channel for the site
      const { data: channel } = await supabase
        .from('youtube_channels')
        .select('id')
        .limit(1)
        .single()

      if (!channel) throw new Error('No YouTube channel found')

      const snapshot = await youtube.getIntelligenceSnapshot(ctx, channel.id)
      if (!snapshot.data) throw new Error('Failed to fetch YouTube intelligence snapshot')

      const result = jsonResource(snapshot.data)
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 8. pipeline://youtube/ab-performance — A/B test winning patterns
  // -------------------------------------------------------------------------
  server.resource(
    'youtube-ab-performance',
    'pipeline://youtube/ab-performance',
    {
      description: 'Aggregate A/B test winning patterns from completed tests: win rates by type, average CTR lift, top strategies',
      mimeType: 'application/json',
      size: 3_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const { ctx } = await buildResourceCtx()
      const performance = await youtube.getAbPerformance(ctx)
      if (!performance.data) throw new Error('Failed to fetch AB performance')

      const result = jsonResource({
        ...performance.data,
        generatedAt: new Date().toISOString(),
      })
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 9. pipeline://audio/stats — audio library statistics
  // -------------------------------------------------------------------------
  server.resource(
    'audio-stats',
    'pipeline://audio/stats',
    {
      description: 'Audio library statistics: counts by category, mood, energy level, most used tracks',
      mimeType: 'application/json',
      size: 1_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const supabase = getSupabaseServiceClient()

      const { data: assets, error } = await supabase
        .from('audio_library')
        .select('id, category, mood, energy, usage_count, retired')
        .eq('retired', false)

      if (error) throw new Error(`Failed to fetch audio stats: ${error.message}`)

      const rows = assets ?? []
      const byCategory: Record<string, number> = {}
      const byMood: Record<string, number> = {}
      const byEnergy: Record<string, number> = {}
      let totalUsages = 0

      for (const a of rows) {
        const cat = (a.category as string) ?? 'uncategorized'
        byCategory[cat] = (byCategory[cat] ?? 0) + 1
        if (a.mood) {
          const m = a.mood as string
          byMood[m] = (byMood[m] ?? 0) + 1
        }
        if (a.energy) {
          const e = a.energy as string
          byEnergy[e] = (byEnergy[e] ?? 0) + 1
        }
        totalUsages += (a.usage_count as number) ?? 0
      }

      const topUsed = [...rows]
        .sort((a, b) => ((b.usage_count as number) ?? 0) - ((a.usage_count as number) ?? 0))
        .slice(0, 10)
        .map(a => ({ id: a.id, category: a.category, mood: a.mood, usageCount: a.usage_count }))

      const result = jsonResource({
        totalAssets: rows.length,
        totalUsages,
        byCategory,
        byMood,
        byEnergy,
        topUsed,
        generatedAt: new Date().toISOString(),
      })
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 10. pipeline://research/topics — hierarchical topic tree
  // -------------------------------------------------------------------------
  server.resource(
    'research-topics',
    'pipeline://research/topics',
    {
      description: 'Hierarchical research topic tree with item counts per topic',
      mimeType: 'application/json',
      size: 3_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const supabase = getSupabaseServiceClient()

      const { data: topics, error } = await supabase
        .from('research_topics')
        .select('id, name, slug, path, parent_id')
        .order('path', { ascending: true })

      if (error) throw new Error(`Failed to fetch research topics: ${error.message}`)

      // Count research items per topic
      const { data: counts } = await supabase
        .from('research_items')
        .select('topic_id')

      const countMap: Record<string, number> = {}
      for (const c of counts ?? []) {
        const tid = c.topic_id as string
        countMap[tid] = (countMap[tid] ?? 0) + 1
      }

      const enriched = (topics ?? []).map((t: { id: string; name: string; slug: string; path: string; parent_id: string | null }) => ({
        ...t,
        itemCount: countMap[t.id] ?? 0,
      }))

      const result = jsonResource({
        topics: enriched,
        totalTopics: enriched.length,
        generatedAt: new Date().toISOString(),
      })
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 11. pipeline://items/{id} — single item skeleton
  // -------------------------------------------------------------------------
  server.resource(
    'item-skeleton',
    new ResourceTemplate('pipeline://items/{id}', { list: undefined }),
    {
      description: 'Single pipeline item skeleton: metadata, section names, and word counts (not full content)',
      mimeType: 'application/json',
      size: 5_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri, variables) => {
      const id = String(variables.id)
      const supabase = getSupabaseServiceClient()

      const { data: item, error } = await supabase
        .from('content_pipeline')
        .select('id, code, format, stage, priority, language, title_pt, title_en, hook, synopsis, tags, version, sections, created_at, updated_at')
        .eq('id', id)
        .single()

      if (error || !item) throw new Error(`Item not found: ${id}`)

      // Build section skeleton: name + word count (no full content)
      const sections = item.sections as Record<string, unknown> | null
      const sectionSkeleton: Array<{ key: string; wordCount: number }> = []

      if (sections && typeof sections === 'object') {
        for (const [key, value] of Object.entries(sections)) {
          let wordCount = 0
          if (typeof value === 'string') {
            wordCount = value.split(/\s+/).filter(Boolean).length
          } else if (value && typeof value === 'object') {
            const text = JSON.stringify(value)
            wordCount = text.split(/\s+/).filter(Boolean).length
          }
          sectionSkeleton.push({ key, wordCount })
        }
      }

      const skeleton = {
        id: item.id,
        code: item.code,
        format: item.format,
        stage: item.stage,
        priority: item.priority,
        language: item.language,
        title_pt: item.title_pt,
        title_en: item.title_en,
        hook: item.hook,
        synopsis: item.synopsis,
        tags: item.tags,
        version: item.version,
        sections: sectionSkeleton,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }

      const result = jsonResource(skeleton)
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 12. pipeline://youtube/ab-tests — A/B test list
  // -------------------------------------------------------------------------
  server.resource(
    'youtube-ab-tests',
    'pipeline://youtube/ab-tests',
    {
      description: 'All A/B tests with variants, grouped by status',
      mimeType: 'application/json',
      size: 8_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const { ctx } = await buildResourceCtx()
      const data = await youtube.listAbTests(ctx, {})
      const result = jsonResource(data.data)
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 13. pipeline://youtube/ab-learnings — learnings from completed tests
  // -------------------------------------------------------------------------
  server.resource(
    'youtube-ab-learnings',
    'pipeline://youtube/ab-learnings',
    {
      description: 'Tag win rates and channel insights from completed A/B tests',
      mimeType: 'application/json',
      size: 3_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const { ctx } = await buildResourceCtx()
      const data = await youtube.getAbLearnings(ctx)
      const result = jsonResource(data.data)
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 14. pipeline://youtube/ab-suggestions — suggested videos for testing
  // -------------------------------------------------------------------------
  server.resource(
    'youtube-ab-suggestions',
    'pipeline://youtube/ab-suggestions',
    {
      description: 'Suggested videos for A/B testing based on underperformance signals',
      mimeType: 'application/json',
      size: 2_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const { ctx } = await buildResourceCtx()
      const data = await youtube.getAbSuggestions(ctx)
      const result = jsonResource(data.data)
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 15. pipeline://youtube/ab-fatigue — pending fatigue alerts
  // -------------------------------------------------------------------------
  server.resource(
    'youtube-ab-fatigue',
    'pipeline://youtube/ab-fatigue',
    {
      description: 'Pending CTR fatigue alerts for videos with declining performance',
      mimeType: 'application/json',
      size: 2_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const { ctx } = await buildResourceCtx()
      const data = await youtube.getAbFatigueAlerts(ctx)
      const result = jsonResource(data.data)
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 16. pipeline://youtube/ab-dashboard — aggregate dashboard stats
  // -------------------------------------------------------------------------
  server.resource(
    'youtube-ab-dashboard',
    'pipeline://youtube/ab-dashboard',
    {
      description: 'Aggregate A/B test dashboard: active tests, avg confidence, win rate, avg lift, tests by status',
      mimeType: 'application/json',
      size: 1_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const { ctx } = await buildResourceCtx()
      const data = await youtube.getAbDashboard(ctx)
      const result = jsonResource(data.data)
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 17. pipeline://youtube/thumbnails/library — thumbnail library
  // -------------------------------------------------------------------------
  server.resource(
    'youtube-thumbnails-library',
    'pipeline://youtube/thumbnails/library',
    {
      description: 'Winning thumbnails library with lift data, tags, and longevity scores',
      mimeType: 'application/json',
      size: 5_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const { ctx } = await buildResourceCtx()
      const data = await youtube.getThumbnailLibrary(ctx)
      const result = jsonResource(data.data)
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 18. pipeline://youtube/thumbnails/fatigue — thumbnail fatigue alerts
  // -------------------------------------------------------------------------
  server.resource(
    'youtube-thumbnails-fatigue',
    'pipeline://youtube/thumbnails/fatigue',
    {
      description: 'Pending thumbnail fatigue alerts with CTR decline data',
      mimeType: 'application/json',
      size: 2_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const { ctx } = await buildResourceCtx()
      const data = await youtube.getThumbnailFatigueAlerts(ctx)
      const result = jsonResource(data.data)
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 19. pipeline://youtube/competitors/channels — tracked competitor channels
  // -------------------------------------------------------------------------
  server.resource(
    'youtube-competitors-channels',
    'pipeline://youtube/competitors/channels',
    {
      description: 'Tracked competitor YouTube channels with sync status',
      mimeType: 'application/json',
      size: 3_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const supabase = getSupabaseServiceClient()
      const { siteId } = await buildResourceCtx()

      const { data } = await supabase
        .from('competitor_channels')
        .select('id, channel_id, channel_name, subscriber_count, video_count, youtube_video_count, sync_status, last_synced_at')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })

      const result = jsonResource({ channels: data ?? [] })
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 20. pipeline://youtube/competitors/changes — recent competitor changes
  // -------------------------------------------------------------------------
  server.resource(
    'youtube-competitors-changes',
    'pipeline://youtube/competitors/changes',
    {
      description: 'Recent title/thumbnail/description changes detected on competitor channels',
      mimeType: 'application/json',
      size: 5_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const supabase = getSupabaseServiceClient()
      const { siteId } = await buildResourceCtx()

      const { data } = await supabase
        .from('competitor_changes')
        .select('id, competitor_channel_id, youtube_video_id, field, old_value, new_value, bookmarked, detected_at')
        .eq('site_id', siteId)
        .order('detected_at', { ascending: false })
        .limit(50)

      const result = jsonResource({ changes: data ?? [] })
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 21. pipeline://youtube/competitors/outliers — bookmarked competitor changes
  // -------------------------------------------------------------------------
  server.resource(
    'youtube-competitors-outliers',
    'pipeline://youtube/competitors/outliers',
    {
      description: 'Bookmarked notable competitor changes for study',
      mimeType: 'application/json',
      size: 3_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const supabase = getSupabaseServiceClient()
      const { siteId } = await buildResourceCtx()

      const { data } = await supabase
        .from('competitor_changes')
        .select('id, competitor_channel_id, youtube_video_id, field, old_value, new_value, detected_at')
        .eq('site_id', siteId)
        .eq('bookmarked', true)
        .order('detected_at', { ascending: false })
        .limit(20)

      const result = jsonResource({ outliers: data ?? [] })
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 22. pipeline://youtube/competitors/insights — aggregate competitor insights
  // -------------------------------------------------------------------------
  server.resource(
    'youtube-competitors-insights',
    'pipeline://youtube/competitors/insights',
    {
      description: 'Aggregate competitor intelligence: change counts, most active channels',
      mimeType: 'application/json',
      size: 2_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const supabase = getSupabaseServiceClient()
      const { siteId } = await buildResourceCtx()

      const [channelsRes, changesRes] = await Promise.all([
        supabase
          .from('competitor_channels')
          .select('id, channel_name, subscriber_count, video_count')
          .eq('site_id', siteId),
        supabase
          .from('competitor_changes')
          .select('field, competitor_channel_id')
          .eq('site_id', siteId)
          .gte('detected_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      ])

      const changesByField: Record<string, number> = {}
      for (const c of changesRes.data ?? []) {
        const field = c.field as string
        changesByField[field] = (changesByField[field] ?? 0) + 1
      }

      const result = jsonResource({
        totalChannels: (channelsRes.data ?? []).length,
        recentChanges7d: (changesRes.data ?? []).length,
        changesByField,
        generatedAt: new Date().toISOString(),
      })
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 23. pipeline://youtube/videos — recent videos summary
  // -------------------------------------------------------------------------
  server.resource(
    'youtube-videos',
    'pipeline://youtube/videos',
    {
      description: 'Recent YouTube videos with key metrics (view count, CTR, impressions)',
      mimeType: 'application/json',
      size: 5_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const supabase = getSupabaseServiceClient()
      const { siteId } = await buildResourceCtx()

      const { data } = await supabase
        .from('youtube_videos')
        .select('id, youtube_video_id, title, published_at, view_count, ctr, impressions, avg_view_percentage, category_id, is_featured, channel_id')
        .eq('site_id', siteId)
        .eq('is_hidden', false)
        .order('published_at', { ascending: false })
        .limit(30)

      const result = jsonResource({ videos: data ?? [] })
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 24. pipeline://youtube/categories — video categories
  // -------------------------------------------------------------------------
  server.resource(
    'youtube-categories',
    'pipeline://youtube/categories',
    {
      description: 'YouTube video categories with slugs, colors, and match keywords',
      mimeType: 'application/json',
      size: 2_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const supabase = getSupabaseServiceClient()
      const { siteId } = await buildResourceCtx()

      const { data } = await supabase
        .from('youtube_categories')
        .select('id, slug, name_pt, name_en, color, match_keywords, auto_approve, sort_order')
        .eq('site_id', siteId)
        .order('sort_order', { ascending: true })

      const result = jsonResource({ categories: data ?? [] })
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 25. pipeline://youtube/channels — channel summary
  // -------------------------------------------------------------------------
  server.resource(
    'youtube-channels',
    'pipeline://youtube/channels',
    {
      description: 'YouTube channels linked to this site with subscriber counts and sync status',
      mimeType: 'application/json',
      size: 2_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const supabase = getSupabaseServiceClient()
      const { siteId } = await buildResourceCtx()

      const { data } = await supabase
        .from('youtube_channels')
        .select('id, channel_id, name, handle, subscriber_count, total_views, video_count, locale, last_synced_at')
        .eq('site_id', siteId)

      const result = jsonResource({ channels: data ?? [] })
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 26. pipeline://youtube/grades — latest video grades
  // -------------------------------------------------------------------------
  server.resource(
    'youtube-grades',
    'pipeline://youtube/grades',
    {
      description: 'Latest 6-axis video performance grades (ctr, retention, reach, engagement, growth, sub_impact)',
      mimeType: 'application/json',
      size: 5_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const supabase = getSupabaseServiceClient()
      const { siteId } = await buildResourceCtx()

      // Get latest grade per video using distinct-on pattern
      const { data } = await supabase
        .from('video_grade_history')
        .select('youtube_video_id, grade, score, ctr, retention, reach, engagement, growth, sub_impact, week_iso')
        .eq('site_id', siteId)
        .order('recorded_at', { ascending: false })
        .limit(100)

      // Deduplicate: keep only latest per video
      const seen = new Set<string>()
      const unique = (data ?? []).filter(g => {
        const vid = g.youtube_video_id as string
        if (seen.has(vid)) return false
        seen.add(vid)
        return true
      })

      const result = jsonResource({ grades: unique })
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 27. pipeline://youtube/notes — channel notes
  // -------------------------------------------------------------------------
  server.resource(
    'youtube-notes',
    'pipeline://youtube/notes',
    {
      description: 'Human and bot notes/annotations on YouTube channels',
      mimeType: 'application/json',
      size: 3_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const supabase = getSupabaseServiceClient()
      const { siteId } = await buildResourceCtx()

      const { data } = await supabase
        .from('youtube_notes')
        .select('id, channel_id, author_name, text, is_bot, source, created_at')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(50)

      const result = jsonResource({ notes: data ?? [] })
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 28. pipeline://youtube/optimization-cycles — active optimization cycles
  // -------------------------------------------------------------------------
  server.resource(
    'youtube-optimization-cycles',
    'pipeline://youtube/optimization-cycles',
    {
      description: 'Active optimization cycles: flagged/diagnosed/treated videos with state progression',
      mimeType: 'application/json',
      size: 3_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const supabase = getSupabaseServiceClient()
      const { siteId } = await buildResourceCtx()

      const { data } = await supabase
        .from('optimization_cycles')
        .select('id, youtube_video_id, state, diagnosis_summary, created_at, diagnosed_at, treated_at')
        .eq('site_id', siteId)
        .not('state', 'in', '("resolved","exhausted","unmonitored")')
        .order('created_at', { ascending: false })
        .limit(20)

      const result = jsonResource({ cycles: data ?? [] })
      result.contents[0]!.uri = uri.href
      return result
    },
  )

  // -------------------------------------------------------------------------
  // 29. pipeline://research/foco/active — current active quarterly focus
  // -------------------------------------------------------------------------
  server.resource(
    'research-foco-active',
    'pipeline://research/foco/active',
    {
      description: 'O foco estratégico do trimestre vigente (state:ativo). INVARIANTE single-active: só pode existir 1 foco ativo por site. Governança propose-vs-activate: o Cowork PROPÕE (cria com state:proposto), o dono ATIVA (activate exige confirmação). Retorna null quando não há foco ativo.',
      mimeType: 'application/json',
      size: 3_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const { getActiveFoco } = await import('@/lib/pipeline/services/research-focos')
      const { ctx } = await buildResourceCtx()

      const result = await getActiveFoco(ctx)

      const out = jsonResource({
        active: result.data,
        generatedAt: new Date().toISOString(),
      })
      out.contents[0]!.uri = uri.href
      return out
    },
  )

  // -------------------------------------------------------------------------
  // 30. pipeline://research/decisoes — decision log grouped by horizon
  // -------------------------------------------------------------------------
  server.resource(
    'research-decisoes',
    'pipeline://research/decisoes',
    {
      description: 'Log de decisões estratégicas que enquadram o conteúdo (status decidido/testando/revisar, arquivadas excluídas), agrupadas por horizonte (agora > proximo > explorar, RS4). Cada decisão carrega metric + revisit + source_research_ids. Decisão com revisit vencido é dívida (RS5) e deve subir pro topo.',
      mimeType: 'application/json',
      size: 4_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const { listResearchDecisions } = await import('@/lib/pipeline/services/research-decisions')
      const { ctx } = await buildResourceCtx()

      // Resource description scopes this to decidido/testando/revisar —
      // exclude archived decisions.
      const result = await listResearchDecisions(ctx, {
        limit: 200,
        status: ['decidido', 'testando', 'revisar'],
      })
      const decisions = result.data.data

      const byHorizon: Record<string, typeof decisions> = {}
      for (const d of decisions) {
        ;(byHorizon[d.horizon] ??= []).push(d)
      }

      const out = jsonResource({
        byHorizon,
        totalDecisions: decisions.length,
        generatedAt: new Date().toISOString(),
      })
      out.contents[0]!.uri = uri.href
      return out
    },
  )

  // -------------------------------------------------------------------------
  // 31. pipeline://research/focos — full foco list (all states)
  // -------------------------------------------------------------------------
  server.resource(
    'research-focos',
    'pipeline://research/focos',
    {
      description: 'Lista completa de focos estratégicos em todos os estados (ativo, proposto, rascunho, arquivado). Diferente de foco/active (só o vigente): inclui os propostos que aguardam ativação do dono e os rascunhos em construção. Use pra ver o que o Cowork já propôs vs. o que está de fato ativo.',
      mimeType: 'application/json',
      size: 5_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const { listResearchFocos } = await import('@/lib/pipeline/services/research-focos')
      const { ctx } = await buildResourceCtx()

      const result = await listResearchFocos(ctx, { limit: 200 })
      const focos = result.data.data

      const byState: Record<string, typeof focos> = {}
      for (const f of focos) {
        ;(byState[f.state] ??= []).push(f)
      }

      const out = jsonResource({
        focos,
        byState,
        totalFocos: focos.length,
        generatedAt: new Date().toISOString(),
      })
      out.contents[0]!.uri = uri.href
      return out
    },
  )

  // -------------------------------------------------------------------------
  // 32. pipeline://research/items-fresca — triage backlog (status=fresca)
  // -------------------------------------------------------------------------
  server.resource(
    'research-items-fresca',
    'pipeline://research/items-fresca',
    {
      description: 'Backlog de triagem: research com status "fresca" (recém-entrado, ainda sem takeaway). É o que o modo TRIAGE varre primeiro. Ordenado por idade (mais antigo primeiro) — fresca > 14d é stale e precisa de takeaway ou arquivamento (RS1).',
      mimeType: 'application/json',
      size: 5_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const { listResearchItems } = await import('@/lib/pipeline/services/research')
      const { ctx } = await buildResourceCtx()

      const result = await listResearchItems(ctx, { status: ['fresca'], limit: 200 })
      const items = result.data.data

      // Oldest first — that's the triage order (RS: idade prioriza).
      const sorted = [...items].sort((a, b) => a.created_at.localeCompare(b.created_at))

      const now = Date.now()
      const STALE_MS = 14 * 86400000
      const staleCount = sorted.filter((i) => now - Date.parse(i.created_at) > STALE_MS).length

      const out = jsonResource({
        items: sorted,
        totalFresca: sorted.length,
        staleCount,
        staleThresholdDays: 14,
        generatedAt: new Date().toISOString(),
      })
      out.contents[0]!.uri = uri.href
      return out
    },
  )

  // -------------------------------------------------------------------------
  // 33. pipeline://research/digest — pre-computed strategy signals
  // -------------------------------------------------------------------------
  server.resource(
    'research-digest',
    'pipeline://research/digest',
    {
      description: 'Sinais pré-computados da estratégia para o DIGEST/Preflight: contagens por status, decisões com revisit vencido (RS5), research stale (fresca>14d / analise>30d), temas amadurecendo (≥3 itens sem foco). Leitura única que alimenta o resumo pro dono sem múltiplas chamadas.',
      mimeType: 'application/json',
      size: 4_000,
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const { computeResearchDigest } = await import('@/lib/pipeline/research-digest')
      const supabase = getSupabaseServiceClient()
      const { siteId } = await buildResourceCtx()

      const signals = await computeResearchDigest(supabase, siteId)

      const out = jsonResource(signals)
      out.contents[0]!.uri = uri.href
      return out
    },
  )
}
