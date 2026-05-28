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
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const supabase = getSupabaseServiceClient()

      const { data, error } = await supabase
        .from('youtube_intelligence')
        .select('*')
        .order('snapshot_at', { ascending: false })
        .limit(1)
        .single()

      if (error) throw new Error(`Failed to fetch YouTube intelligence: ${error.message}`)

      const result = jsonResource(data)
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
      annotations: { audience: ['assistant'] },
    },
    async (uri) => {
      const supabase = getSupabaseServiceClient()

      const { data: tests, error } = await supabase
        .from('youtube_ab_tests')
        .select('id, test_type, status, winner_variant_id, completed_reason, started_at, completed_at')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(50)

      if (error) throw new Error(`Failed to fetch AB performance: ${error.message}`)

      // Aggregate patterns
      const rows = tests ?? []
      const byType: Record<string, { total: number; withWinner: number }> = {}
      for (const t of rows) {
        const type = t.test_type as string
        if (!byType[type]) byType[type] = { total: 0, withWinner: 0 }
        byType[type]!.total++
        if (t.winner_variant_id) byType[type]!.withWinner++
      }

      const result = jsonResource({
        completedTests: rows.length,
        byType,
        recentTests: rows.slice(0, 10),
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
}
