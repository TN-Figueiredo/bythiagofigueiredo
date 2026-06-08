import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { videoColumn, type VideoColumn } from './video-lifecycle'
import { PILLARS, type PillarId } from './pillars'
import { readRoteiro } from './roteiro-schemas'

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

interface SectionEnvelope {
  content?: unknown
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
  sections: Record<string, SectionEnvelope> | null
}

// PostgREST `.select()` accepts column names + embeds only — it cannot evaluate SQL
// expressions (jsonb_array_length / CASE / the `?` operator). So we select the `sections`
// column and derive the per-card scalars in JS, matching the established loaders
// (load-pipeline-detail / load-video-detail). Video lists are small; if they grow, a
// bounded RPC or a computed view is the future optimization.
const HUB_SELECT =
  'id, code, title_pt, title_en, language, stage, format_metadata, version, updated_at, sections'

function primaryLang(language: string): 'pt' | 'en' {
  return language === 'en' ? 'en' : 'pt'
}

function cardTitle(row: HubRow): string {
  const t = primaryLang(row.language) === 'en' ? row.title_en : row.title_pt
  return t && t.trim().length > 0 ? t : 'Sem título'
}

// Count beats from the primary-language roteiro section, via the canonical v1→v3 adapter.
// Never throws on a malformed body — a bad row degrades to 0 beats, not a hub-wide crash.
function beatsCountFor(sections: Record<string, SectionEnvelope>, lang: 'pt' | 'en'): number {
  const raw = sections[`roteiro_${lang}`]?.content
  if (raw == null) return 0
  try {
    return readRoteiro(raw).beats.length
  } catch {
    return 0
  }
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
    const sections = row.sections ?? {}
    const lang = primaryLang(row.language)
    const beatsCount = beatsCountFor(sections, lang)
    const hasDirection = sections[`ideia_${lang}`] != null
    return {
      id: row.id,
      code: row.code,
      title: cardTitle(row),
      column: videoColumn(row.stage),
      stage: row.stage,
      language: row.language,
      pillar: pillar && PILLARS.some((p) => p.id === pillar) ? pillar : undefined,
      duration: durationRange ?? '—',
      beatsLabel: beatsLabel(beatsCount, hasDirection),
      beatsCount,
      hasPt: sections.ideia_pt != null || sections.roteiro_pt != null,
      hasEn: sections.ideia_en != null || sections.roteiro_en != null,
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
