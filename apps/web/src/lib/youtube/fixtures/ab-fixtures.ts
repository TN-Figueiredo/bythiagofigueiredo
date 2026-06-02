/**
 * A/B Lab fixtures — development-only mock data for early-state checkpoints + ETA.
 * Gated by NODE_ENV === 'development'.
 */

export interface AbCheckpoint {
  /** Days since test start */
  day: number
  /** Cumulative impressions at this checkpoint */
  impressions: number
  /** Confidence at this checkpoint (0-100) */
  confidence: number
  /** Whether the leader changed at this checkpoint */
  leaderChanged: boolean
}

export interface AbEarlyState {
  /** Test name */
  name: string
  /** Days elapsed so far */
  daysElapsed: number
  /** Target confidence threshold */
  targetConfidence: number
  /** Current leader variant label */
  leader: 'A' | 'B'
  /** Checkpoints collected so far */
  checkpoints: AbCheckpoint[]
  /** Estimated days to reach target confidence (null if too early) */
  etaDays: number | null
  /** Minimum impressions still needed (null if enough data) */
  impressionsNeeded: number | null
}

export const FIXTURE_AB_EARLY_STATE = {
  name: 'Thumbnail — Praia vs Escritório',
  daysElapsed: 3,
  targetConfidence: 95,
  leader: 'B',
  checkpoints: [
    { day: 1, impressions: 420, confidence: 52.3, leaderChanged: false },
    { day: 2, impressions: 1_180, confidence: 61.7, leaderChanged: true },
    { day: 3, impressions: 2_340, confidence: 68.4, leaderChanged: false },
  ],
  etaDays: 8,
  impressionsNeeded: 4_200,
} as const satisfies AbEarlyState

/** Multiple early-state fixtures for different scenarios. */
export const FIXTURE_AB_EARLY_STATES = [
  FIXTURE_AB_EARLY_STATE,
  {
    name: 'Título — Pergunta vs Afirmação',
    daysElapsed: 1,
    targetConfidence: 95,
    leader: 'A',
    checkpoints: [
      { day: 1, impressions: 180, confidence: 48.1, leaderChanged: false },
    ],
    etaDays: null,
    impressionsNeeded: 8_500,
  },
  {
    name: 'Combo — Thumbnail + Título dark',
    daysElapsed: 5,
    targetConfidence: 95,
    leader: 'B',
    checkpoints: [
      { day: 1, impressions: 620, confidence: 54.0, leaderChanged: false },
      { day: 2, impressions: 1_540, confidence: 63.2, leaderChanged: false },
      { day: 3, impressions: 2_890, confidence: 72.8, leaderChanged: true },
      { day: 4, impressions: 4_120, confidence: 78.5, leaderChanged: false },
      { day: 5, impressions: 5_600, confidence: 83.1, leaderChanged: false },
    ],
    etaDays: 4,
    impressionsNeeded: 1_800,
  },
] as const satisfies ReadonlyArray<AbEarlyState>
