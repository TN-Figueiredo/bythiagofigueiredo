import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { readRoteiro, type RoteiroContentV3 } from './roteiro-schemas'
import { IdeiaSectionSchema, type IdeiaSection } from './video-schemas'
import { PILLARS, type PillarId } from './pillars'

export interface VideoDetail {
  id: string
  code: string
  stage: string
  version: number
  language: string
  status: string
  pillar: PillarId | undefined
  durationRange: string | undefined
  blogPostId: string | null
  youtubeVideoId: string | null
  ideia: { pt: IdeiaSection; en: IdeiaSection }
  roteiro: { pt: RoteiroContentV3 | null; en: RoteiroContentV3 | null }
}

interface SectionEnvelope {
  content?: unknown
}

function readIdeia(sections: Record<string, SectionEnvelope>, lang: 'pt' | 'en'): IdeiaSection {
  const raw = sections[`ideia_${lang}`]?.content
  // IdeiaSectionSchema is `.strict()` with defaults; parse tolerates `{}`/missing,
  // but rejects unknown keys. Fall back to a clean empty payload on any mismatch.
  const parsed = IdeiaSectionSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : IdeiaSectionSchema.parse({})
}

function readRoteiroLang(sections: Record<string, SectionEnvelope>, lang: 'pt' | 'en'): RoteiroContentV3 | null {
  const raw = sections[`roteiro_${lang}`]?.content
  if (raw == null) return null
  return readRoteiro(raw)
}

/**
 * Loads the full editor detail for a single video item, scoped to `siteId`.
 *
 * Returns `null` when the row does not exist, is not a video, or is not visible
 * to the given site — the page turns that into `notFound()`. Per-language ideia
 * payloads are validated through `IdeiaSectionSchema`; roteiro bodies run through
 * the canonical `readRoteiro` v3 adapter. Production scalars (pillar, duration
 * range) come from `format_metadata`.
 */
export async function loadVideoDetail(id: string, siteId: string): Promise<VideoDetail | null> {
  const supabase = getSupabaseServiceClient()

  const { data: item, error } = await supabase
    .from('content_pipeline')
    .select('id, code, stage, format, language, version, sections, format_metadata, blog_post_id, social_post_id')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (error || !item) return null
  if (item.format !== 'video') return null

  const sections = (item.sections ?? {}) as Record<string, SectionEnvelope>
  const meta = (item.format_metadata ?? {}) as Record<string, unknown>

  const rawPillar = meta.pillar
  const pillar = PILLARS.some((p) => p.id === rawPillar) ? (rawPillar as PillarId) : undefined
  const durationRange = typeof meta.duration_range === 'string' ? meta.duration_range : undefined
  const youtubeVideoId = typeof meta.youtube_video_id === 'string' ? meta.youtube_video_id : null

  return {
    id: item.id as string,
    code: item.code as string,
    stage: item.stage as string,
    version: item.version as number,
    language: (item.language as string) ?? 'pt-br',
    status: item.stage as string,
    pillar,
    durationRange,
    blogPostId: (item.blog_post_id as string | null) ?? null,
    youtubeVideoId,
    ideia: { pt: readIdeia(sections, 'pt'), en: readIdeia(sections, 'en') },
    roteiro: { pt: readRoteiroLang(sections, 'pt'), en: readRoteiroLang(sections, 'en') },
  }
}
