import type { SupabaseClient } from '@supabase/supabase-js'
import { isCertainShort } from '@/lib/youtube/short-classifier'

export interface VideoDoPicker {
  id: string
  title: string
  thumbnailUrl: string | null
  durationSeconds: number
  channelHandle: string
  hasActiveTest: boolean
  previousLift: number | null
  sourcePipelineId: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Vídeo do site que não está entre os 100 mais recentes do picker. Leitura por chave primária, escopada ao site.
 * Short, vídeo sem thumbnail HQ (as duas recusas de `createAbTest`), outro site ou erro: null (a página mantém o aviso).
 * `hasActiveTest` conta draft/active/paused/queued.
 */
export async function lerVideoForaDosCem(sb: SupabaseClient, siteId: string, videoUuid: string): Promise<VideoDoPicker | null> {
  if (!UUID.test(videoUuid)) return null
  const { data: v, error } = await sb
    .from('youtube_videos')
    .select('id, title, thumbnail_url, thumbnail_hq_url, duration_seconds, youtube_channels(handle)')
    .eq('site_id', siteId)
    .eq('id', videoUuid)
    .maybeSingle()
  if (error || !v) return null
  const dur = typeof v.duration_seconds === 'number' ? v.duration_seconds : 0
  if (isCertainShort(dur) || !v.thumbnail_hq_url) return null
  const { data: abertos, error: e2 } = await sb
    .from('ab_tests')
    .select('id')
    .eq('site_id', siteId)
    .eq('youtube_video_id', videoUuid)
    .in('status', ['draft', 'active', 'paused', 'queued'])
    .limit(1)
  if (e2) return null
  const canal = (Array.isArray(v.youtube_channels) ? v.youtube_channels[0] : v.youtube_channels) as { handle?: string } | null | undefined
  return {
    id: v.id as string,
    title: v.title as string,
    thumbnailUrl: (v.thumbnail_url as string | null) ?? null,
    durationSeconds: dur,
    channelHandle: canal?.handle ?? '',
    hasActiveTest: (abertos ?? []).length > 0,
    previousLift: null,
    sourcePipelineId: null,
  }
}
