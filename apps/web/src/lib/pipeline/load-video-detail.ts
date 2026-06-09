import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { readRoteiro, type RoteiroContentV3 } from './roteiro-schemas'
import { IdeiaSectionSchema, type IdeiaSection } from './video-schemas'
import { PILLARS, type PillarId } from './pillars'
import type { AbJoinFacts } from './video-ab-precondition'

export interface VideoDetail {
  id: string
  code: string
  /** Soft-deleted: the editor redirects archived items to the hub so a stale/duplicate
   *  link never opens a dead item. */
  isArchived: boolean
  stage: string
  version: number
  language: string
  status: string
  pillar: PillarId | undefined
  durationRange: string | undefined
  blogPostId: string | null
  /** External YouTube video id (string) from `format_metadata.youtube_video_id`. */
  youtubeVideoId: string | null
  ideia: { pt: IdeiaSection; en: IdeiaSection }
  roteiro: { pt: RoteiroContentV3 | null; en: RoteiroContentV3 | null }
  /**
   * Raw per-(section,lang) payload map from `content_pipeline.sections`. Consumed by
   * publish-time A/B materialization (`publishVideo`) to read the `publish_<lang>` draft.
   */
  sections: Record<string, unknown>
  /**
   * Facts for the A/B publish CTA, derived from the `content_pipeline ⋈ youtube_videos`
   * join (§3.8). `youtubeVideoId` here is the linked `youtube_videos.id` uuid (FK),
   * distinct from the external-id `youtubeVideoId` above. `abPublishCtaState` consumes this.
   */
  abJoinFacts: AbJoinFacts
}

/** Shape of the embedded `youtube_videos` join row (left join → possibly null). */
interface YoutubeJoinRow {
  thumbnail_hq_url: string | null
  duration_seconds: number | null
}

interface SectionEnvelope {
  content?: unknown
}

/** Read the first non-empty string among `keys` off an unknown object (never throws). */
function pickStr(obj: unknown, keys: string[]): string {
  if (!obj || typeof obj !== 'object') return ''
  const rec = obj as Record<string, unknown>
  for (const k of keys) {
    const v = rec[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function readIdeia(
  sections: Record<string, SectionEnvelope>,
  lang: 'pt' | 'en',
  fallback: { title?: string | null; direction?: string | null } = {},
): IdeiaSection {
  const raw = sections[`ideia_${lang}`]?.content
  // IdeiaSectionSchema is `.strict()` with defaults; parse tolerates `{}`/missing but
  // rejects unknown keys → a legacy old-shape envelope (`{premise, body, …}` that
  // migration 20260608000001 copied verbatim into ideia_<lang>) fails the parse and
  // would collapse to empty. Salvage title/direction from the RAW payload first, then
  // fall back to the title_<lang> column / synopsis|hook, so opening a legacy video
  // shows its real title + direction instead of placeholders.
  const parsed = IdeiaSectionSchema.safeParse(raw ?? {})
  const base = parsed.success ? parsed.data : IdeiaSectionSchema.parse({})
  const legacyTitle = pickStr(raw, ['title', 'premise', 'headline'])
  const legacyDirection = pickStr(raw, ['direction', 'body', 'synopsis'])
  // Title precedence: the `title_<lang>` COLUMN is canonical (it's what the hub card
  // shows and what saveVideoTitle keeps in sync) — it wins over any section-level
  // value, which on legacy items is often a stale "TBD" placeholder. New-shape
  // section title is the next fallback, then the old-shape salvage.
  return {
    ...base,
    title: (fallback.title ?? '').trim() || (base.title?.trim() ? base.title.trim() : '') || legacyTitle,
    direction:
      (base.direction?.trim() ? base.direction.trim() : '') || legacyDirection || (fallback.direction ?? '').trim(),
  }
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
    .select(
      'id, code, is_archived, stage, format, language, version, title_pt, title_en, hook, synopsis, sections, format_metadata, blog_post_id, social_post_id, youtube_video_id, youtube_videos(thumbnail_hq_url, duration_seconds)',
    )
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

  // A/B publish CTA facts from the youtube_videos join (§3.8). PostgREST embeds a
  // to-one relation as an object (or array, depending on inference); normalize both.
  const ytEmbed = (item as { youtube_videos?: YoutubeJoinRow | YoutubeJoinRow[] | null }).youtube_videos
  const yt = Array.isArray(ytEmbed) ? (ytEmbed[0] ?? null) : (ytEmbed ?? null)
  const linkedYoutubeVideoId = (item.youtube_video_id as string | null) ?? null

  return {
    id: item.id as string,
    code: item.code as string,
    isArchived: (item.is_archived as boolean | null) ?? false,
    stage: item.stage as string,
    version: item.version as number,
    language: (item.language as string) ?? 'pt-br',
    status: item.stage as string,
    pillar,
    durationRange,
    blogPostId: (item.blog_post_id as string | null) ?? null,
    youtubeVideoId,
    ideia: {
      pt: readIdeia(sections, 'pt', {
        title: item.title_pt as string | null,
        direction: (item.synopsis as string | null) ?? (item.hook as string | null),
      }),
      en: readIdeia(sections, 'en', {
        title: item.title_en as string | null,
        direction: (item.synopsis as string | null) ?? (item.hook as string | null),
      }),
    },
    roteiro: { pt: readRoteiroLang(sections, 'pt'), en: readRoteiroLang(sections, 'en') },
    sections: sections as Record<string, unknown>,
    abJoinFacts: {
      youtubeVideoId: linkedYoutubeVideoId,
      thumbnailHqUrl: yt?.thumbnail_hq_url ?? null,
      durationSeconds: yt?.duration_seconds ?? null,
    },
  }
}
