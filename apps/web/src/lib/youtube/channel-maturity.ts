/**
 * YouTube CMS — Channel Maturity
 *
 * Determines what UI elements can be shown based on how much data has been
 * collected for a competitor channel. Stages progress from `just_added`
 * (no data yet) through `mature` (30+ daily snapshots available).
 *
 * Pure functions — no DB or network calls.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChannelMaturity = 'just_added' | 'seedling' | 'sprouting' | 'growing' | 'mature'

export interface ChannelMaturityInfo {
  stage: ChannelMaturity
  snapshotCount: number
  videoCount: number
  hoursSinceAdded: number
  firstSyncDone: boolean
}

export interface MaturityCapabilities {
  showSubscribers: boolean
  showVideoShelf: boolean
  showEngagement: boolean
  showGrowthDelta: boolean
  showSparkline: boolean
  showVsYou: boolean
  showGrowthScore: boolean
  growthScoreConfidence: 'none' | 'low' | 'medium' | 'high'
  /** Human-readable status in PT-BR. Empty string when channel is mature. */
  statusMessage: string
  /** Optional hint text in PT-BR. Null when no hint is relevant. */
  statusHint: string | null
}

// ---------------------------------------------------------------------------
// getChannelMaturity
// ---------------------------------------------------------------------------

interface GetChannelMaturityInput {
  snapshotCount: number
  videoCount: number
  addedAt: string | Date
  lastSyncedAt: string | Date | null
}

/** Derives a `ChannelMaturityInfo` from raw channel metrics. */
export function getChannelMaturity(input: GetChannelMaturityInput): ChannelMaturityInfo {
  const { snapshotCount, videoCount, addedAt, lastSyncedAt } = input

  const addedMs = typeof addedAt === 'string' ? new Date(addedAt).getTime() : addedAt.getTime()
  const nowMs = Date.now()
  const hoursSinceAdded = (nowMs - addedMs) / (1000 * 60 * 60)

  const firstSyncDone = lastSyncedAt !== null

  let stage: ChannelMaturity
  if (snapshotCount === 0) {
    stage = 'just_added'
  } else if (snapshotCount === 1) {
    stage = 'seedling'
  } else if (snapshotCount <= 6) {
    stage = 'sprouting'
  } else if (snapshotCount <= 29) {
    stage = 'growing'
  } else {
    stage = 'mature'
  }

  return { stage, snapshotCount, videoCount, hoursSinceAdded, firstSyncDone }
}

// ---------------------------------------------------------------------------
// getMaturityCapabilities
// ---------------------------------------------------------------------------

/** Returns which UI elements may be rendered for the given maturity state. */
export function getMaturityCapabilities(maturity: ChannelMaturityInfo): MaturityCapabilities {
  const { stage, snapshotCount, videoCount, firstSyncDone } = maturity

  const hasVideos = videoCount > 0
  const hasEngagementData = videoCount >= 3

  // Shared across seedling + every stage that has a first sync
  const baseWithSync = {
    showSubscribers: true,
    showVideoShelf: hasVideos,
    showEngagement: hasEngagementData,
    showVsYou: hasEngagementData,
  }

  switch (stage) {
    case 'just_added': {
      if (!firstSyncDone) {
        return {
          showSubscribers: false,
          showVideoShelf: false,
          showEngagement: false,
          showGrowthDelta: false,
          showSparkline: false,
          showVsYou: false,
          showGrowthScore: false,
          growthScoreConfidence: 'none',
          statusMessage: 'Sincronizando dados do canal...',
          statusHint: 'A primeira sincronização pode levar alguns minutos.',
        }
      }
      return {
        ...baseWithSync,
        showGrowthDelta: false,
        showSparkline: false,
        showGrowthScore: false,
        growthScoreConfidence: 'none',
        statusMessage: 'Canal adicionado — primeira coleta realizada',
        statusHint: 'Métricas de crescimento aparecem amanhã com a segunda coleta.',
      }
    }

    case 'seedling': {
      return {
        ...baseWithSync,
        showGrowthDelta: false,
        showSparkline: false,
        showGrowthScore: false,
        growthScoreConfidence: 'none',
        statusMessage: 'Coletando histórico — 1 dia de dados',
        statusHint: 'Crescimento e tendências precisam de pelo menos 2 dias de dados.',
      }
    }

    case 'sprouting': {
      const n = snapshotCount
      return {
        ...baseWithSync,
        showGrowthDelta: true,
        showSparkline: false,
        showGrowthScore: true,
        growthScoreConfidence: 'low',
        statusMessage: `${n} dias de dados — tendências iniciais`,
        statusHint: 'Sparkline de crescimento aparece com 7+ dias de monitoramento.',
      }
    }

    case 'growing': {
      const n = snapshotCount
      const hint = snapshotCount < 14 ? 'Dados completos com 30+ dias de monitoramento.' : null
      return {
        ...baseWithSync,
        showGrowthDelta: true,
        showSparkline: true,
        showGrowthScore: true,
        growthScoreConfidence: 'medium',
        statusMessage: `${n} dias de dados`,
        statusHint: hint,
      }
    }

    case 'mature': {
      return {
        showSubscribers: true,
        showVideoShelf: hasVideos,
        showEngagement: hasEngagementData,
        showGrowthDelta: true,
        showSparkline: true,
        showVsYou: hasEngagementData,
        showGrowthScore: true,
        growthScoreConfidence: 'high',
        statusMessage: '',
        statusHint: null,
      }
    }
  }
}
