// ---------------------------------------------------------------------------
// MCP Prompts — composable prompt templates that auto-inject relevant
// resources and delegate to existing prompt builder functions.
//
// Each prompt accepts typed arguments, fetches necessary data, calls the
// appropriate builder, and returns a `messages` array for the LLM client.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { getSupabaseServiceClient } from '@/lib/supabase/service'

import {
  buildPrompt,
  generatePrompt,
  summarizeContent,
  type PipelineItemForPrompt,
  type SectionForPrompt,
} from '@/lib/pipeline/prompt-builders'
import { WORKFLOWS, DEFAULT_CHECKLISTS } from '@/lib/pipeline/workflows'
import { SECTION_DEFINITIONS, getSectionKey } from '@/lib/pipeline/sections'
import { buildAbBriefingPrompt, buildAbWritePrompt, buildAbReviewPrompt } from '@/lib/youtube/prompt-builders-ab'
import { buildPlaylistPrompt, type PlaylistPromptInput } from '@/lib/playlists/prompt-builder'
import type { TestType } from '@/lib/youtube/ab-types'
import type { AbBriefingData } from '@/lib/youtube/prompt-types'
import type { Format } from '@/lib/pipeline/schemas'
import type { PlaylistEdgeRow, PlaylistItemEnriched, PlaylistRow } from '@/lib/playlists/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a single user-role message for MCP prompt responses. */
function userMessage(text: string) {
  return {
    messages: [{
      role: 'user' as const,
      content: { type: 'text' as const, text },
    }],
  }
}

/** Fetch skill-specific context references as markdown. */
async function fetchSkillContext(skill: string): Promise<string> {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('pipeline_context')
    .select('key, title, body')
    .contains('skills', [skill])
    .order('sort_order', { ascending: true })

  if (!data || data.length === 0) return ''
  return data
    .map((d: { key: string; title: string; body: string }) => `## ${d.title}\n\n${d.body}`)
    .join('\n\n---\n\n')
}

/** Fetch pipeline stats summary as a compact string. */
async function fetchStatsSummary(): Promise<string> {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('content_pipeline')
    .select('format, stage, priority')
    .eq('archived', false)

  const rows = data ?? []
  const byFormat: Record<string, number> = {}
  const byStage: Record<string, number> = {}
  for (const row of rows) {
    const f = row.format as string
    const s = row.stage as string
    byFormat[f] = (byFormat[f] ?? 0) + 1
    byStage[s] = (byStage[s] ?? 0) + 1
  }

  const formatLine = Object.entries(byFormat).map(([k, v]) => `${k}: ${v}`).join(', ')
  const stageLine = Object.entries(byStage).map(([k, v]) => `${k}: ${v}`).join(', ')
  return `Pipeline: ${rows.length} active items\nBy format: ${formatLine}\nBy stage: ${stageLine}`
}

/** Fetch YouTube channel info for AB prompts. */
async function fetchChannelInfo(): Promise<AbBriefingData['channel']> {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('youtube_channels')
    .select('channel_name, subscriber_count, tier')
    .limit(1)
    .single()

  if (!data) {
    return { name: 'Unknown', subscribers: 0, tier: 'nano' as const }
  }
  return {
    name: data.channel_name as string,
    subscribers: (data.subscriber_count as number) ?? 0,
    tier: (data.tier as AbBriefingData['channel']['tier']) ?? 'nano',
  }
}

/** Fetch the latest YouTube intelligence snapshot age. */
async function fetchSnapshotAge(): Promise<number> {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('youtube_intelligence')
    .select('generated_at')
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()

  if (!data?.generated_at) return 999
  return Math.floor((Date.now() - new Date(data.generated_at as string).getTime()) / 3600000)
}

/** Read a pipeline docs markdown file. */
async function fetchDomainDocs(domain: string): Promise<string> {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const filePath = path.resolve(process.cwd(), 'data', 'pipeline-docs', `cowork-docs-${domain}.md`)
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return `(Documentation for domain "${domain}" not available)`
  }
}

// ---------------------------------------------------------------------------
// registerPrompts
// ---------------------------------------------------------------------------

export function registerPrompts(server: McpServer): void {
  // -------------------------------------------------------------------------
  // 1. ideator — content ideation prompt
  // -------------------------------------------------------------------------
  server.prompt(
    'ideator',
    'Generate content ideas based on topic seed, format, and pipeline context',
    {
      topic_seed: z.string().optional().describe('Starting topic or theme (optional)'),
      format: z.string().optional().describe('Content format: video, blog_post, newsletter, or course'),
      count: z.string().optional().describe('Number of ideas to generate (default: 5)'),
    },
    async (args) => {
      const topicSeed = args.topic_seed ?? ''
      const format = args.format ?? 'video'
      const count = args.count ? parseInt(args.count, 10) : 5

      // Auto-inject: context/ideator + stats
      const [context, stats] = await Promise.all([
        fetchSkillContext('ideator'),
        fetchStatsSummary(),
      ])

      const lines: string[] = []
      lines.push('# Content Ideation Prompt')
      lines.push('')

      if (topicSeed) {
        lines.push(`## Topic Seed: ${topicSeed}`)
        lines.push('')
      }

      lines.push(`Format: ${format} | Ideas requested: ${count}`)
      lines.push('')

      lines.push('## Current Pipeline State')
      lines.push(stats)
      lines.push('')

      if (context) {
        lines.push('## Ideator Reference Context')
        lines.push(context)
        lines.push('')
      }

      lines.push('## Instructions')
      lines.push(`Generate ${count} original content ideas${topicSeed ? ` around the topic "${topicSeed}"` : ''} for the ${format} format.`)
      lines.push('')
      lines.push('For each idea, provide:')
      lines.push('1. **Title** (working title, PT-BR)')
      lines.push('2. **Hook** (one sentence that captures the viewer/reader)')
      lines.push('3. **Synopsis** (2-3 sentences describing the content)')
      lines.push('4. **Tags** (3-5 relevant tags)')
      lines.push('5. **Priority** (1-5, where 5 is highest)')
      lines.push('6. **Rationale** (why this idea is worth producing now)')
      lines.push('')
      lines.push('Consider:')
      lines.push('- Gaps in the current pipeline (see stats above)')
      lines.push('- Audience relevance and search demand')
      lines.push('- Production feasibility and timeline')
      lines.push('- Alignment with channel strategy (see reference context)')

      return userMessage(lines.join('\n'))
    },
  )

  // -------------------------------------------------------------------------
  // 2. writer — section writing prompt (delegates to buildPrompt)
  // -------------------------------------------------------------------------
  server.prompt(
    'writer',
    'Write or rewrite a specific section of a pipeline item',
    {
      item_id: z.string().describe('Pipeline item UUID'),
      section_key: z.string().describe('Section type key (e.g., ideia, roteiro, draft, seo)'),
      instructions: z.string().optional().describe('Writing instructions for the section'),
      lang: z.string().optional().describe('Language: pt or en (default: pt)'),
    },
    async (args) => {
      const itemId = args.item_id
      const sectionKey = args.section_key
      const instructions = args.instructions ?? 'Write this section following the schema guidelines and reference context.'
      const lang = args.lang ?? 'pt'

      const supabase = getSupabaseServiceClient()

      // Fetch item
      const { data: item, error } = await supabase
        .from('content_pipeline')
        .select('id, code, format, stage, priority, language, title_pt, title_en, hook, synopsis, tags, sections, version')
        .eq('id', itemId)
        .single()

      if (error || !item) throw new Error(`Item not found: ${itemId}`)

      // Resolve section
      const format = item.format as Format
      const sectionDefs = SECTION_DEFINITIONS[format] ?? []
      const sectionDef = sectionDefs.find(s => s.key === sectionKey || s.type === sectionKey)
      const sectionLabel = sectionDef?.label_pt ?? sectionKey
      const sectionBase = sectionDef?.type ?? sectionKey
      const fullSectionKey = getSectionKey(sectionBase, lang === 'pt' ? 'pt-br' : lang)

      // Get current section content summary
      const sections = item.sections as Record<string, unknown> | null
      const currentContent = sections?.[fullSectionKey]
      const contentSummary = summarizeContent(currentContent)

      // Determine revision
      let rev = 0
      if (currentContent && typeof currentContent === 'object' && currentContent !== null && 'rev' in currentContent) {
        rev = (currentContent as { rev: number }).rev
      }

      // Auto-inject: context/writer + docs/items-and-sections
      const [writerContext, domainDocs] = await Promise.all([
        fetchSkillContext('writer'),
        fetchDomainDocs('items-and-sections'),
      ])

      // Build prompt using existing builder
      const promptText = buildPrompt({
        itemCode: item.code as string,
        itemTitle: (lang === 'en' ? item.title_en : item.title_pt) as string ?? '(sem titulo)',
        format: item.format as string,
        stage: item.stage as string,
        tags: (item.tags as string[]) ?? [],
        hook: item.hook as string | null,
        synopsis: item.synopsis as string | null,
        sectionLabel,
        sectionKey: fullSectionKey,
        lang,
        rev,
        contentSummary,
        instructions,
        itemId,
        sectionBase,
        references: new Map(),
      })

      // Compose with injected context
      const parts: string[] = [promptText]

      if (writerContext) {
        parts.push('\n\n---\n\n## Writer Reference Context\n\n' + writerContext)
      }

      if (domainDocs) {
        // Include a truncated version — the full docs are very large
        const truncated = domainDocs.length > 8000
          ? domainDocs.slice(0, 8000) + '\n\n...(truncated — use pipeline://docs/items-and-sections for full docs)'
          : domainDocs
        parts.push('\n\n---\n\n## Section Schema Reference\n\n' + truncated)
      }

      return userMessage(parts.join(''))
    },
  )

  // -------------------------------------------------------------------------
  // 3. producer — production review prompt
  // -------------------------------------------------------------------------
  server.prompt(
    'producer',
    'Review production readiness of a pipeline item: checklist, assets, timeline',
    {
      item_id: z.string().describe('Pipeline item UUID'),
    },
    async (args) => {
      const itemId = args.item_id

      const supabase = getSupabaseServiceClient()
      const { data: item, error } = await supabase
        .from('content_pipeline')
        .select('id, code, format, stage, priority, language, title_pt, title_en, hook, synopsis, tags, production_checklist, sections, scheduled_at')
        .eq('id', itemId)
        .single()

      if (error || !item) throw new Error(`Item not found: ${itemId}`)

      // Auto-inject: context/producer + workflows
      const producerContext = await fetchSkillContext('producer')

      const format = item.format as Format
      const workflow = WORKFLOWS[format]
      const checklist = (item.production_checklist as Array<{ label: string; done: boolean }>) ?? DEFAULT_CHECKLISTS[format]
      const doneCount = checklist.filter((c: { done: boolean }) => c.done).length

      // Section completeness
      const sections = item.sections as Record<string, unknown> | null
      const sectionDefs = SECTION_DEFINITIONS[format] ?? []
      const sectionStatus = sectionDefs.map(def => {
        const key = getSectionKey(def.type, 'pt-br')
        const content = sections?.[key]
        const hasCont = content !== null && content !== undefined
        const summary = hasCont ? summarizeContent(content) : 'Empty'
        return `- ${def.label_pt} (${key}): ${summary}`
      })

      const lines: string[] = []
      lines.push(`# Production Review: ${(item.title_pt as string) ?? (item.title_en as string) ?? item.code}`)
      lines.push(`Code: ${item.code} | Format: ${format} | Stage: ${item.stage} | P${item.priority}`)
      lines.push('')

      lines.push('## Workflow Progress')
      const stageIndex = workflow.findIndex(s => s.stage === item.stage)
      lines.push(`Stage ${stageIndex + 1}/${workflow.length}: ${workflow[stageIndex]?.label_pt ?? item.stage}`)
      lines.push(`Stages: ${workflow.map((s, i) => i === stageIndex ? `[${s.label_pt}]` : s.label_pt).join(' -> ')}`)
      lines.push('')

      lines.push('## Production Checklist')
      lines.push(`Progress: ${doneCount}/${checklist.length}`)
      for (const c of checklist) {
        lines.push(`- [${c.done ? 'x' : ' '}] ${c.label}`)
      }
      lines.push('')

      lines.push('## Section Completeness')
      lines.push(sectionStatus.join('\n'))
      lines.push('')

      if (item.scheduled_at) {
        lines.push(`## Scheduled: ${item.scheduled_at}`)
        lines.push('')
      }

      lines.push('## Instructions')
      lines.push('Review this item for production readiness:')
      lines.push('1. Identify incomplete checklist items and prioritize them')
      lines.push('2. Flag any empty or thin sections that need attention')
      lines.push('3. Check if the item is ready to advance to the next stage')
      lines.push('4. Suggest specific next actions with deadlines')
      lines.push('5. Note any blocking dependencies or asset needs')

      if (producerContext) {
        lines.push('\n---\n\n## Producer Reference Context\n\n' + producerContext)
      }

      return userMessage(lines.join('\n'))
    },
  )

  // -------------------------------------------------------------------------
  // 4. ab-ideate — A/B test ideation (delegates to buildAbBriefingPrompt)
  // -------------------------------------------------------------------------
  server.prompt(
    'ab-ideate',
    'Brainstorm A/B test variants for a YouTube video (thumbnail, title, description, or combo)',
    {
      test_type: z.string().describe('Test type: thumbnail, title, description, or combo'),
      video_context: z.string().optional().describe('Additional context about the video or focus area'),
      lang: z.string().optional().describe('Locale: pt or en (default: pt)'),
    },
    async (args) => {
      const testType = args.test_type as TestType
      const videoContext = args.video_context ?? undefined
      const locale = (args.lang === 'en' ? 'en' : 'pt') as 'pt' | 'en'

      if (!['thumbnail', 'title', 'description', 'combo'].includes(testType)) {
        throw new Error(`Invalid test_type: ${testType}. Must be thumbnail, title, description, or combo.`)
      }

      // Auto-inject: youtube/intelligence + youtube/ab-performance
      const [channel, snapshotAge] = await Promise.all([
        fetchChannelInfo(),
        fetchSnapshotAge(),
      ])

      // Fetch latest AB test history
      const supabase = getSupabaseServiceClient()
      const { data: testHistory } = await supabase
        .from('youtube_ab_tests')
        .select('test_type, winner_variant_id, completed_reason')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(10)

      const history = (testHistory ?? []).map((t: Record<string, unknown>) => ({
        test_type: t.test_type as string,
        winner_label: t.winner_variant_id ? 'variant' : null,
        ctr_lift_percent: null,
      }))

      // Build briefing data
      const briefingData: AbBriefingData = {
        channel,
        locale,
        video: {
          title: '(specify video when creating a test)',
          thumbnailUrl: null,
          ctr: null,
          avgViewPercentage: null,
          score: null,
          grade: null,
        },
        testHistory: history,
        snapshotAgeHours: snapshotAge,
      }

      const promptText = buildAbBriefingPrompt({
        testType,
        data: briefingData,
        focus: videoContext,
      })

      return userMessage(promptText)
    },
  )

  // -------------------------------------------------------------------------
  // 5. ab-write — A/B test variant writing (delegates to buildAbWritePrompt)
  // -------------------------------------------------------------------------
  server.prompt(
    'ab-write',
    'Write A/B test variants for an existing test with API workflow instructions',
    {
      test_id: z.string().describe('A/B test UUID'),
      variant_count: z.string().optional().describe('Number of variants to create (default: 3)'),
      slot_notes: z.string().optional().describe('Per-variant direction notes (JSON: {"B": "...", "C": "..."})'),
      lang: z.string().optional().describe('Locale: pt or en (default: pt)'),
    },
    async (args) => {
      const testId = args.test_id
      const variantCount = args.variant_count ? parseInt(args.variant_count, 10) : 3
      const slotNotes = args.slot_notes ? JSON.parse(args.slot_notes) as Record<string, string> : undefined
      const locale = (args.lang === 'en' ? 'en' : 'pt') as 'pt' | 'en'

      const supabase = getSupabaseServiceClient()

      // Fetch test details
      const { data: test, error } = await supabase
        .from('youtube_ab_tests')
        .select('id, test_type, youtube_video_id, original_title, original_thumbnail_url, original_description, status')
        .eq('id', testId)
        .single()

      if (error || !test) throw new Error(`A/B test not found: ${testId}`)

      // Fetch video performance
      const { data: video } = await supabase
        .from('youtube_videos')
        .select('id, title, youtube_video_id, thumbnail_url, ctr_percent, avg_view_percentage')
        .eq('youtube_video_id', test.youtube_video_id)
        .single()

      // Auto-inject: youtube/intelligence (channel info)
      const [channel, snapshotAge] = await Promise.all([
        fetchChannelInfo(),
        fetchSnapshotAge(),
      ])

      // Fetch test history
      const { data: testHistory } = await supabase
        .from('youtube_ab_tests')
        .select('test_type, winner_variant_id, completed_reason')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(10)

      const history = (testHistory ?? []).map((t: Record<string, unknown>) => ({
        test_type: t.test_type as string,
        winner_label: t.winner_variant_id ? 'variant' : null,
        ctr_lift_percent: null,
      }))

      const briefingData: AbBriefingData = {
        channel,
        locale,
        testId,
        video: {
          youtubeVideoId: test.youtube_video_id as string,
          title: (video?.title ?? test.original_title ?? '') as string,
          thumbnailUrl: (video?.thumbnail_url ?? test.original_thumbnail_url ?? null) as string | null,
          ctr: (video?.ctr_percent ?? null) as number | null,
          avgViewPercentage: (video?.avg_view_percentage ?? null) as number | null,
          score: null,
          grade: null,
        },
        testHistory: history,
        snapshotAgeHours: snapshotAge,
      }

      let promptText = buildAbWritePrompt({
        testType: test.test_type as TestType,
        data: briefingData,
      })

      // Append variant count and slot notes
      const extras: string[] = []
      if (variantCount !== 3) {
        extras.push(`\nGenerate exactly ${variantCount} variant(s) (labels: ${['B', 'C', 'D'].slice(0, variantCount).join(', ')}).`)
      }
      if (slotNotes) {
        extras.push('\nPer-variant directions:')
        for (const [label, note] of Object.entries(slotNotes)) {
          extras.push(`- ${label}: ${note}`)
        }
      }
      if (extras.length > 0) {
        promptText += '\n' + extras.join('\n')
      }

      // Override HTTP workflow steps — MCP clients should use the tool instead
      const mcpOverride = locale === 'pt'
        ? `\n\n---\n**MCP: Ignore as instruções HTTP acima.** Use a ferramenta \`manage_ab_test\` com action \`upsert_variants\` para salvar variantes. Exemplo:\n\`\`\`json\n{ "action": "upsert_variants", "test_id": "${testId}", "variants": [...], "dry_run": false }\n\`\`\``
        : `\n\n---\n**MCP: Ignore the HTTP workflow steps above.** Use the \`manage_ab_test\` tool with action \`upsert_variants\` to save variants. Example:\n\`\`\`json\n{ "action": "upsert_variants", "test_id": "${testId}", "variants": [...], "dry_run": false }\n\`\`\``
      promptText += mcpOverride

      return userMessage(promptText)
    },
  )

  // -------------------------------------------------------------------------
  // 6. ab-review — A/B test variant review (delegates to buildAbReviewPrompt)
  // -------------------------------------------------------------------------
  server.prompt(
    'ab-review',
    'Review A/B test variants: evaluate quality, differentiation, and click probability',
    {
      test_id: z.string().describe('A/B test UUID'),
      lang: z.string().optional().describe('Locale: pt or en (default: pt)'),
    },
    async (args) => {
      const testId = args.test_id
      const locale = (args.lang === 'en' ? 'en' : 'pt') as 'pt' | 'en'

      const supabase = getSupabaseServiceClient()

      // Fetch test variants
      const { data: variants, error } = await supabase
        .from('ab_test_variants')
        .select('label, title_text, description_text, blob_url, metadata')
        .eq('test_id', testId)
        .order('sort_order', { ascending: true })

      if (error) throw new Error(`Failed to fetch variants for test ${testId}: ${error.message}`)
      if (!variants || variants.length === 0) throw new Error(`No variants found for test ${testId}`)

      // Fetch channel info for tier context
      const channel = await fetchChannelInfo()

      const promptText = buildAbReviewPrompt({
        testId,
        locale,
        variants: variants.map(v => ({
          label: v.label as string,
          title_text: v.title_text as string | null,
          description_text: v.description_text as string | null,
          blob_url: v.blob_url as string | null,
          metadata: (v.metadata ?? {}) as Record<string, unknown>,
        })),
        channel: {
          tier: channel.tier,
          subscribers: channel.subscribers,
        },
      })

      return userMessage(promptText)
    },
  )

  // -------------------------------------------------------------------------
  // 7. playlist-architect — playlist management (delegates to buildPlaylistPrompt)
  // -------------------------------------------------------------------------
  server.prompt(
    'playlist-architect',
    'Architect or reorganize a playlist: build, connect, fill gaps, reorg, campaign, or course mode',
    {
      playlist_id: z.string().describe('Playlist UUID'),
      mode: z.string().optional().describe('Architect mode: build, connect, gap, reorg, campaign, or course'),
      instructions: z.string().optional().describe('Additional instructions for the architect'),
    },
    async (args) => {
      const playlistId = args.playlist_id
      const mode = args.mode ?? 'build'
      const instructions = args.instructions ?? ''

      const supabase = getSupabaseServiceClient()

      // Fetch playlist with items and edges
      const [playlistRes, itemsRes, edgesRes] = await Promise.all([
        supabase.from('playlists').select('*').eq('id', playlistId).single(),
        supabase
          .from('playlist_items')
          .select(`
            id, playlist_id, blog_post_id, newsletter_edition_id, pipeline_id,
            sort_order, position_x, position_y, created_at
          `)
          .eq('playlist_id', playlistId)
          .order('sort_order', { ascending: true }),
        supabase.from('playlist_edges').select('*').eq('playlist_id', playlistId),
      ])

      if (playlistRes.error || !playlistRes.data) throw new Error(`Playlist not found: ${playlistId}`)

      const playlist = playlistRes.data as PlaylistRow
      const rawItems = (itemsRes.data ?? []) as Array<Record<string, unknown>>
      const edges = (edgesRes.data ?? []) as PlaylistEdgeRow[]

      // Enrich items with pipeline data
      const pipelineIds = rawItems.map(i => i.pipeline_id).filter(Boolean) as string[]

      const { data: pipelineItems } = pipelineIds.length > 0
        ? await supabase
            .from('content_pipeline')
            .select('id, code, format, stage, language, title_pt, hook, synopsis, tags')
            .in('id', pipelineIds)
        : { data: [] }

      const pipelineMap = new Map(
        (pipelineItems ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      )

      const enrichedItems: PlaylistItemEnriched[] = rawItems.map(item => {
        const pid = item.pipeline_id as string | null
        const pi = pid ? pipelineMap.get(pid) : null
        return {
          id: item.id as string,
          playlist_id: item.playlist_id as string,
          blog_post_id: item.blog_post_id as string | null,
          newsletter_edition_id: item.newsletter_edition_id as string | null,
          pipeline_id: pid,
          sort_order: item.sort_order as number,
          position_x: item.position_x as number,
          position_y: item.position_y as number,
          created_at: item.created_at as string,
          content_type: pi ? 'pipeline' : null,
          title: pi ? (pi.title_pt as string ?? '(sem titulo)') : '(sem titulo)',
          status: pi ? (pi.stage as string) : null,
          category: pi ? (pi.format as string) : null,
          metadata: null,
          is_ghost: !pi && !item.blog_post_id && !item.newsletter_edition_id,
          other_playlist_count: 0,
          language: pi ? (pi.language as 'pt-br' | 'en' | null) : null,
          tags: pi ? (pi.tags as string[]) ?? [] : [],
          hook: pi ? (pi.hook as string | null) : null,
          synopsis: pi ? (pi.synopsis as string | null) : null,
        }
      })

      // Fetch reuse candidates (items not in this playlist)
      const { data: candidates } = await supabase
        .from('content_pipeline')
        .select('id, title_pt, format, language, stage, tags')
        .eq('archived', false)
        .not('id', 'in', `(${pipelineIds.join(',')})`)
        .limit(20)

      const reuseCandidates = (candidates ?? []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        title: (c.title_pt as string) ?? '(sem titulo)',
        format: c.format as string,
        language: (c.language as string) ?? 'pt-br',
        stage: c.stage as string,
        tags: (c.tags as string[]) ?? [],
      }))

      // Build mode instruction prefix
      const modeInstructions: Record<string, string> = {
        build: 'BUILD mode: Create the playlist structure from scratch. Add items, set sequence, connect edges.',
        connect: 'CONNECT mode: Create edges between existing items. Focus on prerequisites, sequences, and related links.',
        gap: 'GAP mode: Identify missing content gaps. Suggest new items to fill holes in the series.',
        reorg: 'REORG mode: Reorganize existing items. Optimize order, remove ghosts, rename TBDs.',
        campaign: 'CAMPAIGN mode: Structure items for a marketing campaign sequence with clear CTAs.',
        course: 'COURSE mode: Structure as a course with modules, prerequisites, and lesson progression.',
      }

      const fullInstructions = [
        modeInstructions[mode] ?? `Mode: ${mode}`,
        instructions,
      ].filter(Boolean).join('\n\n')

      const input: PlaylistPromptInput = {
        playlist,
        items: enrichedItems,
        edges,
        focusedItemIds: [],
        reuseCandidates,
        userInstructions: fullInstructions,
      }

      // Auto-inject: docs/playlists + workflows
      const [playlistDocs] = await Promise.all([
        fetchDomainDocs('playlists'),
      ])

      let promptText = buildPlaylistPrompt(input).text

      if (playlistDocs) {
        const truncated = playlistDocs.length > 5000
          ? playlistDocs.slice(0, 5000) + '\n\n...(truncated — use pipeline://docs/playlists for full docs)'
          : playlistDocs
        promptText += '\n\n---\n\n## Playlist API Reference\n\n' + truncated
      }

      // Append workflow info
      promptText += '\n\n---\n\n## Available Workflows\n\n' + JSON.stringify(
        { workflows: Object.keys(WORKFLOWS), checklists: Object.keys(DEFAULT_CHECKLISTS) },
        null,
        2,
      )

      return userMessage(promptText)
    },
  )

  // -------------------------------------------------------------------------
  // 8. translate — content translation (delegates to generatePrompt)
  // -------------------------------------------------------------------------
  server.prompt(
    'translate',
    'Translate a pipeline item to a target locale with cultural adaptation',
    {
      item_id: z.string().describe('Pipeline item UUID'),
      target_locale: z.string().describe('Target locale: pt-br or en'),
    },
    async (args) => {
      const itemId = args.item_id
      const targetLocale = args.target_locale as 'pt-br' | 'en'

      if (!['pt-br', 'en'].includes(targetLocale)) {
        throw new Error(`Invalid target_locale: ${targetLocale}. Must be pt-br or en.`)
      }

      const supabase = getSupabaseServiceClient()

      const { data: item, error } = await supabase
        .from('content_pipeline')
        .select('id, code, format, stage, priority, language, title_pt, title_en, hook, synopsis, sections')
        .eq('id', itemId)
        .single()

      if (error || !item) throw new Error(`Item not found: ${itemId}`)

      // Build item for prompt
      const itemForPrompt: PipelineItemForPrompt = {
        id: item.id as string,
        code: item.code as string,
        format: item.format as string,
        stage: item.stage as string,
        priority: item.priority as number,
        language: (item.language as 'pt-br' | 'en' | 'both') ?? 'pt-br',
        title_pt: item.title_pt as string | null,
        title_en: item.title_en as string | null,
        hook: item.hook as string | null,
        synopsis: item.synopsis as string | null,
      }

      // Collect sections in the source language
      const sourceLocale: 'pt-br' | 'en' = targetLocale === 'en' ? 'pt-br' : 'en'
      const sourceSuffix = sourceLocale === 'pt-br' ? 'pt' : 'en'
      const sections = item.sections as Record<string, unknown> | null
      const sectionsForPrompt: SectionForPrompt[] = []

      if (sections) {
        for (const [key, value] of Object.entries(sections)) {
          if (key.endsWith(`_${sourceSuffix}`) || key.endsWith('_shared')) {
            const content = typeof value === 'string' ? value : JSON.stringify(value)
            sectionsForPrompt.push({
              section_type: key,
              language: sourceLocale,
              content,
            })
          }
        }
      }

      const { text: promptText } = generatePrompt(itemForPrompt, sectionsForPrompt, targetLocale)

      // Auto-inject: docs/items-and-sections
      const domainDocs = await fetchDomainDocs('items-and-sections')

      let fullPrompt = promptText
      if (domainDocs) {
        const truncated = domainDocs.length > 6000
          ? domainDocs.slice(0, 6000) + '\n\n...(truncated — use pipeline://docs/items-and-sections for full docs)'
          : domainDocs
        fullPrompt += '\n\n---\n\n## Section Schema Reference\n\n' + truncated
      }

      return userMessage(fullPrompt)
    },
  )

  // -------------------------------------------------------------------------
  // 9. youtube-analyst — complete channel analysis with coaching
  // -------------------------------------------------------------------------
  server.prompt(
    'youtube-analyst',
    'Generate a complete YouTube channel analysis with coaching recommendations',
    {
      channel_id: z.string().describe('YouTube channel UUID (internal DB id)'),
    },
    async (args) => {
      const channelId = args.channel_id

      // Auto-inject: channel info + snapshot age + youtube docs
      const [channel, snapshotAge, youtubeDocs] = await Promise.all([
        fetchChannelInfo(),
        fetchSnapshotAge(),
        fetchDomainDocs('youtube'),
      ])

      const lines: string[] = []
      lines.push('# YouTube Channel Analyst — Complete Analysis')
      lines.push('')
      lines.push(`Channel: ${channel.name} | ${channel.subscribers.toLocaleString()} subscribers | Tier: ${channel.tier}`)
      lines.push(`Intelligence snapshot age: ${snapshotAge}h`)
      lines.push('')

      lines.push('## Step 1: Collect Channel Health')
      lines.push('')
      lines.push('Call `manage_ab_test` with action `get_intelligence` and `channel_id: "' + channelId + '"` to retrieve the full channel intelligence snapshot.')
      lines.push('')
      lines.push('From the response, extract:')
      lines.push('- Channel summary (subscribers, tier)')
      lines.push('- All videos with CTR, retention, impressions, traffic sources')
      lines.push('- Grade history (weekly grades per video)')
      lines.push('- Active optimization cycles')
      lines.push('- Existing intelligence recommendations')
      lines.push('')

      lines.push('## Step 2: Evaluate Video Performance')
      lines.push('')
      lines.push('For each video in the snapshot, compute:')
      lines.push('1. **CTR Score** — compare vs channel median CTR (weight: 25%)')
      lines.push('2. **Retention Score** — avg_view_percentage vs median (weight: 25%)')
      lines.push('3. **Reach Score** — impressions log2 normalized (weight: 15%)')
      lines.push('4. **Engagement Score** — (likes+comments+shares)/views (weight: 15%)')
      lines.push('5. **Growth Score** — daily view velocity (weight: 12%)')
      lines.push('6. **Sub Impact Score** — subscribers gained (weight: 8%)')
      lines.push('')
      lines.push('Apply lifecycle modifiers: < 7 days = 120% CTR weight; > 180 days = evergreen bonus.')
      lines.push('Apply tier modifiers: Nano +0.5 CTR / +0.3 retention; Micro +0.2 / +0.1; etc.')
      lines.push('')
      lines.push('Grade: A >= 85, B >= 65, C >= 40, D < 40')
      lines.push('')

      lines.push('## Step 3: Analyze Competitor Intelligence')
      lines.push('')
      lines.push('If competitor data is available, call `manage_ab_test` with action `get_intelligence` to check for competitor insights.')
      lines.push('Cross-reference:')
      lines.push('- Content gaps (topics competitors cover that we don\'t)')
      lines.push('- Title formulas with high multiplier')
      lines.push('- Upload timing patterns (heatmap analysis)')
      lines.push('- Engagement rate comparison')
      lines.push('')

      lines.push('## Step 4: Identify Weak Axes & Recommend Actions')
      lines.push('')
      lines.push('Sort the 6 axes by score (ascending = worst first). For each weak axis:')
      lines.push('- Write a specific diagnosis (max 300 chars, PT-BR)')
      lines.push('- Write a concrete action executable in 7 days (max 300 chars, PT-BR)')
      lines.push('- Assign confidence (0.9+ = clear pattern, 0.5-0.7 = hypothesis)')
      lines.push('')
      lines.push('For videos with grade C/D:')
      lines.push('- Suggest specific action_type: thumbnail_test, title_test, retention_fix, seo_optimization, etc.')
      lines.push('- Include data in reasoning (e.g., "CTR 1.8% vs channel avg 3.2%")')
      lines.push('')

      lines.push('## Step 5: Submit Coaching Data')
      lines.push('')
      lines.push('Call `manage_ab_test` with action `submit_intelligence` and the following `intel_payload`:')
      lines.push('')
      lines.push('```json')
      lines.push('{')
      lines.push('  "task_id": "<from claim_task>",')
      lines.push('  "video_recommendations": [')
      lines.push('    {')
      lines.push('      "video_id": "<uuid>",')
      lines.push('      "action_type": "thumbnail_test | title_test | retention_fix | seo_optimization | engagement_boost",')
      lines.push('      "priority": "high | medium | low",')
      lines.push('      "confidence": 0.0-1.0,')
      lines.push('      "reasoning": "Explanation in PT-BR, max 500 chars"')
      lines.push('    }')
      lines.push('  ],')
      lines.push('  "coaching": {')
      lines.push('    "summary": "1-2 sentence channel state summary, PT-BR",')
      lines.push('    "priorities": [')
      lines.push('      {')
      lines.push('        "axis": "ctr | retention | reach | engagement | growth | sub_impact",')
      lines.push('        "score": 0-10,')
      lines.push('        "diagnosis": "What is happening (max 300 chars)",')
      lines.push('        "action": "What to do to improve (max 300 chars)"')
      lines.push('      }')
      lines.push('    ]')
      lines.push('  },')
      lines.push('  "notifications": [')
      lines.push('    {')
      lines.push('      "type": "optimization_available | grade_drop | ctr_drop | trending_viral",')
      lines.push('      "video_id": "<uuid>",')
      lines.push('      "priority": 1-5,')
      lines.push('      "title": "Short title",')
      lines.push('      "message": "Detailed message"')
      lines.push('    }')
      lines.push('  ]')
      lines.push('}')
      lines.push('```')
      lines.push('')

      lines.push('## Rules')
      lines.push('- Max 25 video_recommendations per submission')
      lines.push('- Max 6 coaching priorities (one per axis)')
      lines.push('- Order priorities by score ascending (worst first)')
      lines.push('- All text in PT-BR')
      lines.push('- Do not suggest thumbnail_test if video is already in testing cycle')
      lines.push('- Confidence 0.9+ = clear data pattern; 0.5-0.7 = hypothesis')

      if (youtubeDocs) {
        const truncated = youtubeDocs.length > 8000
          ? youtubeDocs.slice(0, 8000) + '\n\n...(truncated — use pipeline://docs/youtube for full docs)'
          : youtubeDocs
        lines.push('\n---\n\n## YouTube Intelligence Reference\n\n' + truncated)
      }

      return userMessage(lines.join('\n'))
    },
  )

  // -------------------------------------------------------------------------
  // 10. competitor-report — competitor landscape report
  // -------------------------------------------------------------------------
  server.prompt(
    'competitor-report',
    'Generate a competitor landscape report with actionable insights',
    {},
    async () => {
      // Auto-inject: channel info + youtube docs
      const [channel, youtubeDocs] = await Promise.all([
        fetchChannelInfo(),
        fetchDomainDocs('youtube'),
      ])

      const lines: string[] = []
      lines.push('# Competitor Landscape Report')
      lines.push('')
      lines.push(`Your channel: ${channel.name} | ${channel.subscribers.toLocaleString()} subscribers | Tier: ${channel.tier}`)
      lines.push('')

      lines.push('## Step 1: Gather Competitor Data')
      lines.push('')
      lines.push('Execute the following tool calls in sequence:')
      lines.push('')
      lines.push('### 1a. List tracked competitors')
      lines.push('Call the **Competitor Observatory** endpoint `GET /api/pipeline/youtube/competitors/channels` to retrieve all tracked competitor channels.')
      lines.push('')
      lines.push('For each channel, note:')
      lines.push('- Channel name, subscriber count, video count')
      lines.push('- Average engagement rate')
      lines.push('- Growth delta (30-day subscriber change)')
      lines.push('- Recent videos (titles, views, outlier status)')
      lines.push('- VsYou comparison (subs delta, engagement delta, frequency delta)')
      lines.push('')

      lines.push('### 1b. Identify outlier videos')
      lines.push('Call `GET /api/pipeline/youtube/competitors/outliers` to find viral competitor videos.')
      lines.push('')
      lines.push('Categorize by tier:')
      lines.push('- **Top tier (>10x median):** Study these deeply — title formula, thumbnail style, topic, length')
      lines.push('- **High tier (5-10x):** Note patterns across multiple channels')
      lines.push('- **Mid tier (2-5x):** Track recurring topics and formats')
      lines.push('')

      lines.push('### 1c. Get aggregated insights')
      lines.push('Call `GET /api/pipeline/youtube/competitors/insights` for the full intelligence picture.')
      lines.push('')

      lines.push('## Step 2: Analyze & Produce Report')
      lines.push('')
      lines.push('Structure your report with these sections:')
      lines.push('')

      lines.push('### Play of the Week')
      lines.push('From `insights.play`, present the single highest-leverage content opportunity:')
      lines.push('- **Topic:** What to cover (from `topicBold`)')
      lines.push('- **Formula:** Title pattern to use (from `formulaBold` with `formulaMult` multiplier)')
      lines.push('- **Timing:** When to publish (from `windowBold` with `windowReason`)')
      lines.push('- **Why now:** Explain urgency based on competitor activity and gaps')
      lines.push('')

      lines.push('### Gap Analysis')
      lines.push('From `insights.gaps`, list topics where `weCover: false`:')
      lines.push('- Topic name')
      lines.push('- Number of competitors covering it')
      lines.push('- Average views for that topic')
      lines.push('- Which competitor channels cover it')
      lines.push('- Recommended priority (high if avgViews > channel median AND competitorCount >= 2)')
      lines.push('')

      lines.push('### Timing Recommendations')
      lines.push('From `insights.heatmap` and `insights.hitsHeatmap`:')
      lines.push('- Identify the 3 best publishing windows (day + hour)')
      lines.push('- Cross-reference heatmap (avg views) with hitsHeatmap (outlier concentration)')
      lines.push('- Compare with our current publishing pattern')
      lines.push('')

      lines.push('### Title Patterns')
      lines.push('From `insights.formulas`, rank the top 5 title formulas:')
      lines.push('- Formula label and multiplier')
      lines.push('- Example title')
      lines.push('- Copywriting hint')
      lines.push('- How many competitor videos use this pattern')
      lines.push('')

      lines.push('### Engagement Comparison')
      lines.push('From `insights.engagement`:')
      lines.push('- Rank all channels (competitors + ours) by engagement rate')
      lines.push('- Highlight our position (the entry with `isUs: true`)')
      lines.push('- Identify who outperforms us and what they do differently')
      lines.push('')

      lines.push('### Upload Cadence')
      lines.push('From `insights.cadence`:')
      lines.push('- Each competitor\'s upload frequency (videos/week)')
      lines.push('- Days since their last upload')
      lines.push('- Recommend if we should increase or maintain our cadence')
      lines.push('')

      lines.push('### Tag Intelligence')
      lines.push('From `insights.tags`, `insights.ownTagsByChannel`, `insights.competitorTagsByChannel`:')
      lines.push('- Top 10 competitor tags by frequency')
      lines.push('- Tags competitors use that we don\'t')
      lines.push('- Tags we use that competitors don\'t (potential differentiators)')
      lines.push('')

      lines.push('## Step 3: Actionable Next Steps')
      lines.push('')
      lines.push('Conclude with 3-5 prioritized actions:')
      lines.push('1. Each action must reference specific data from the report')
      lines.push('2. Include expected impact (based on multiplier, views, or gap size)')
      lines.push('3. Include timeline (this week / this month / next quarter)')
      lines.push('4. When appropriate, suggest creating a pipeline item via `create_item` tool')
      lines.push('')

      lines.push('## Output Format')
      lines.push('')
      lines.push('All text in PT-BR. Use markdown formatting. Include data points to support each recommendation.')
      lines.push('The report should be actionable — every insight must map to a concrete next step.')

      if (youtubeDocs) {
        const truncated = youtubeDocs.length > 6000
          ? youtubeDocs.slice(0, 6000) + '\n\n...(truncated — use pipeline://docs/youtube for full docs)'
          : youtubeDocs
        lines.push('\n\n---\n\n## YouTube Observatory Reference\n\n' + truncated)
      }

      return userMessage(lines.join('\n'))
    },
  )
}
