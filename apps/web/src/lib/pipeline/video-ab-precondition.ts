/** Projection from the load-video-detail.ts join (content_pipeline LEFT JOIN youtube_videos). */
export interface AbJoinFacts {
  youtubeVideoId: string | null
  thumbnailHqUrl: string | null
  durationSeconds: number | null
}

export interface AbCtaState {
  enabled: boolean
  tooltip: string | null
  deepLink: string | null
}

/**
 * Mirrors createAbTest's data preconditions (actions.ts:119 Short, :123 thumbnail) at the UI
 * layer so the user never hits a NOT-NULL data-layer error. Re-checked server-side before
 * any createAbTest/createTextVariant call (§3.8).
 */
export function abPublishCtaState(facts: AbJoinFacts, pipelineId: string): AbCtaState {
  const deepLink = `/cms/youtube/ab-lab/new?pipeline=${pipelineId}`
  if (!facts.youtubeVideoId) {
    return { enabled: false, tooltip: 'Vincule o vídeo do YouTube primeiro', deepLink }
  }
  if (!facts.thumbnailHqUrl) {
    return { enabled: false, tooltip: 'Sincronize a thumbnail do YouTube primeiro', deepLink }
  }
  if ((facts.durationSeconds ?? 0) <= 60) {
    return { enabled: false, tooltip: 'Testes A/B não se aplicam a Shorts (≤60s)', deepLink: null }
  }
  return { enabled: true, tooltip: null, deepLink: null }
}
