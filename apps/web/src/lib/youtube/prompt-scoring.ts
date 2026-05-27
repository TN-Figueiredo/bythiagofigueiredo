import { assignGrade } from './scoring'
import type { Grade } from './scoring-types'

/**
 * Lightweight score for prompt context — uses only ctr + retention (the two
 * metrics always available from youtube_videos). The canonical `scoreVideo()`
 * in scoring.ts uses 6 weighted axes but requires daily view data and channel
 * baseline that prompt actions don't fetch.
 */
export function scoreForPrompt(ctr: number, retention: number): { score: number; grade: Grade } {
  const score = Math.round(ctr * 0.3 + retention * 0.7)
  const grade = assignGrade(score)
  return { score, grade }
}
