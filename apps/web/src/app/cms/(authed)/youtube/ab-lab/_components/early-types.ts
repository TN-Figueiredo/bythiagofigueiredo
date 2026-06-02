import type { DisplayLabel, TestType, AbTestConfig } from '@/lib/youtube/ab-types'

/** Checkpoint in the early state progress tracker. */
export interface EarlyCheckpoint {
  /** Display label (e.g. "Primeiro ciclo", "Burn-in completo", "Confianca minima"). */
  label: string
  /** Whether this checkpoint has been reached. */
  reached: boolean
  /** Estimated time to reach this checkpoint (e.g. "~6h", "~48h"). Null hides ETA. */
  eta: string | null
  /** Actual date when reached. Null if not yet reached. */
  reachedAt: string | null
  /** True when this is the next upcoming checkpoint (styled with --accent). */
  isSoon: boolean
}

/** Early state view data. */
export interface AbEarlyStateView {
  testId: string
  videoTitle: string
  flag: TestType
  dayOf: number
  totalDays: number
  checkpoints: EarlyCheckpoint[]
  variants: Array<{
    label: DisplayLabel
    color: string
    thumbUrl: string | null
    titleText: string | null
    ctr: null
    isOriginal: boolean
  }>
  config?: AbTestConfig
  sourcePipelineId: string | null
}
