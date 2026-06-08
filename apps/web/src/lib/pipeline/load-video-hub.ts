import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { videoColumn, type VideoColumn } from './video-lifecycle'
import { PILLARS, type PillarId } from './pillars'

export interface VideoHubCard {
  id: string
  code: string
  title: string
  column: VideoColumn
  stage: string
  language: string
  pillar?: PillarId
  duration: string
  beatsLabel: string
  beatsCount: number
  hasPt: boolean
  hasEn: boolean
  version: number
}

export interface VideoHubStats {
  total: number
  roteiro: number
  gravacao: number
  published: number
}

export interface VideoHubData {
  cards: VideoHubCard[]
  stats: VideoHubStats
  pillarCounts: Partial<Record<PillarId, number>>
}

interface HubRow {
  id: string
  code: string
  title_pt: string | null
  title_en: string | null
  language: string
  stage: string
  format_metadata: Record<string, unknown> | null
  version: number
  updated_at: string
  beats_count: number
  has_direction: boolean
  has_pt: boolean
  has_en: boolean
}

// Bounded projection (§3.7): the full `sections` JSONB body is NEVER returned to the
// client. Only scalar derivatives are projected, computed server-side directly on the
// `sections` column via JSONB operators (which return just the count/bool, not the blob):
//   • beats_count: jsonb_array_length on the per-language beats array
//   • has_direction/has_pt/has_en: cheap key-existence probes via the `?` operator
// `sections` is NOT a selected column — it only appears inside these operator expressions.
//
// Inline language mapping: (CASE language WHEN 'en' THEN 'en' ELSE 'pt' END)
// — there is no primary_lang() SQL function; the mapping is always inline.
const HUB_SELECT = `
  id, code, title_pt, title_en, language, stage, format_metadata, version, updated_at,
  coalesce(jsonb_array_length(
    sections #> ARRAY['roteiro_' || (CASE language WHEN 'en' THEN 'en' ELSE 'pt' END), 'beats']
  ), 0) AS beats_count,
  (sections ? ('ideia_' || (CASE language WHEN 'en' THEN 'en' ELSE 'pt' END))) AS has_direction,
  ((sections ? 'ideia_pt') OR (sections ? 'roteiro_pt')) AS has_pt,
  ((sections ? 'ideia_en') OR (sections ? 'roteiro_en')) AS has_en
`.trim()

function primaryLang(language: string): 'pt' | 'en' {
  return language === 'en' ? 'en' : 'pt'
}

function cardTitle(row: HubRow): string {
  const t = primaryLang(row.language) === 'en' ? row.title_en : row.title_pt
  return t && t.trim().length > 0 ? t : 'Sem título'
}

function beatsLabel(beatsCount: number, hasDirection: boolean): string {
  if (beatsCount > 0) return `${beatsCount} beats`
  if (hasDirection) return 'direção'
  return 'sem roteiro'
}

export async function loadVideoHub(siteId: string): Promise<VideoHubData> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('content_pipeline')
    .select(HUB_SELECT)
    .eq('format', 'video')
    .eq('site_id', siteId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  const rows = (data ?? []) as unknown as HubRow[]

  const cards: VideoHubCard[] = rows.map((row) => {
    const meta = row.format_metadata ?? {}
    const pillar = meta.pillar as PillarId | undefined
    const durationRange = meta.duration_range as string | undefined
    return {
      id: row.id,
      code: row.code,
      title: cardTitle(row),
      column: videoColumn(row.stage),
      stage: row.stage,
      language: row.language,
      pillar: pillar && PILLARS.some((p) => p.id === pillar) ? pillar : undefined,
      duration: durationRange ?? '—',
      beatsLabel: beatsLabel(row.beats_count, row.has_direction),
      beatsCount: row.beats_count,
      hasPt: row.has_pt,
      hasEn: row.has_en,
      version: row.version,
    }
  })

  const stats: VideoHubStats = {
    total: cards.length,
    roteiro: cards.filter((c) => c.column === 'roteiro').length,
    gravacao: cards.filter((c) => c.column === 'gravacao').length,
    published: cards.filter((c) => c.column === 'published').length,
  }

  const pillarCounts: Partial<Record<PillarId, number>> = {}
  for (const c of cards) {
    if (c.pillar) pillarCounts[c.pillar] = (pillarCounts[c.pillar] ?? 0) + 1
  }

  return { cards, stats, pillarCounts }
}
