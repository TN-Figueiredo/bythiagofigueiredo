/**
 * YouTube Competitor Channel — Growth Score
 *
 * Computes a composite growth score (0–100) that summarises how fast and
 * healthily a competitor channel is growing.  Pure function — no DB or
 * network calls.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GrowthScoreInput {
  /** Daily channel snapshots sorted by date ascending. */
  snapshots: ReadonlyArray<{
    view_count: number | null
    subscriber_count: number | null
    video_count: number | null
    snapshot_date: string
  }>
  /** Competitor videos (any order). */
  videos: ReadonlyArray<{
    view_count: number | null
    like_count: number | null
    comment_count: number | null
    published_at: string | null
  }>
}

export interface GrowthScoreResult {
  /** Final composite score, 0–100 (clamped). */
  score: number
  /** Reliability weight, 0.4–1.0. */
  confidence: number
  /** Human-readable label in PT-BR. */
  label: string
  /** CSS colour string for the label. */
  labelColor: string
  breakdown: {
    viewMomentum: number       // 0-100
    engagement: number         // 0-100
    uploadConsistency: number  // 0-100
    audienceGrowth: number     // 0-100
  }
}

// ---------------------------------------------------------------------------
// Pure math helpers
// ---------------------------------------------------------------------------

/** Logistic sigmoid centred at 0, returns 0–100. */
function sigmoid(x: number, steepness: number): number {
  return 100 / (1 + Math.exp(-steepness * x))
}

/**
 * Maps a positive ratio to a 0–100 score via a log-sigmoid.
 * ratio ≤ 0 → 5 (floor signal).
 */
function ratioToScore(ratio: number, steepness: number): number {
  if (ratio <= 0) return 5
  return sigmoid(Math.log(ratio), steepness)
}

/**
 * Median of a numeric array.
 * - Empty → 0
 * - Odd length → middle element
 * - Even length → average of two middle elements
 */
export function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return sorted[mid]!
  }
  return (sorted[mid - 1]! + sorted[mid]!) / 2
}

// ---------------------------------------------------------------------------
// Sub-scores
// ---------------------------------------------------------------------------

/** Sub-score 1 — ViewMomentum (weight 0.35) */
function computeViewMomentum(
  snapshots: GrowthScoreInput['snapshots'],
): number {
  if (snapshots.length < 2) return 50 // insufficient data

  // Compute daily view deltas
  const deltas: number[] = []
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1]!
    const curr = snapshots[i]!
    deltas.push((curr.view_count ?? 0) - (prev.view_count ?? 0))
  }

  if (deltas.length < 8) return 50 // need at least 8 deltas (9 snapshots)

  const recentDeltas = deltas.slice(-7)          // last 7 deltas → "last 7 days"
  const olderDeltas = deltas.slice(0, -7)        // everything before

  const recentAvg = recentDeltas.reduce((s, v) => s + v, 0) / recentDeltas.length
  const olderAvg = olderDeltas.reduce((s, v) => s + v, 0) / olderDeltas.length

  if (recentAvg === 0 && olderAvg === 0) return 50
  if (olderAvg === 0 && recentAvg > 0) return 95
  if (recentAvg === 0) return 5

  const accelerationRatio = recentAvg / olderAvg
  return ratioToScore(accelerationRatio, 4)
}

/** Sub-score 2 — Engagement (weight 0.30) */
function computeEngagement(
  videos: GrowthScoreInput['videos'],
  now: Date,
): number {
  const nowMs = now.getTime()
  const cutoff30d = nowMs - 30 * 86_400_000

  const recent = videos.filter(v => {
    if (!v.published_at) return false
    return new Date(v.published_at).getTime() >= cutoff30d
  })

  if (recent.length === 0) return 30 // no recent videos

  let totalWeight = 0
  let weightedLikeRate = 0
  let weightedCommentRate = 0
  let anyViews = false

  for (const v of recent) {
    const viewCount = v.view_count ?? 0
    const likeCount = v.like_count ?? 0
    const commentCount = v.comment_count ?? 0

    if (viewCount > 0) anyViews = true

    const daysSince = (nowMs - new Date(v.published_at!).getTime()) / 86_400_000
    const recencyWeight = Math.exp(-0.05 * daysSince)

    const likeRate = likeCount / Math.max(viewCount, 1)
    const commentRate = commentCount / Math.max(viewCount, 1)

    weightedLikeRate += recencyWeight * likeRate
    weightedCommentRate += recencyWeight * commentRate
    totalWeight += recencyWeight
  }

  if (!anyViews) return 10 // videos with 0 views

  if (totalWeight === 0) return 30

  const avgLikeRate = weightedLikeRate / totalWeight
  const avgCommentRate = weightedCommentRate / totalWeight

  const engagementRate = 0.6 * avgLikeRate + 0.4 * avgCommentRate
  const benchmark = 0.02 // 2 %
  return ratioToScore(engagementRate / benchmark, 3)
}

/** Sub-score 3 — UploadConsistency (weight 0.15) */
function computeUploadConsistency(
  videos: GrowthScoreInput['videos'],
  now: Date,
): number {
  const nowMs = now.getTime()
  const cutoff30d = nowMs - 30 * 86_400_000
  const cutoff60d = nowMs - 60 * 86_400_000

  let videosLast30 = 0
  let videosPrior30 = 0

  for (const v of videos) {
    if (!v.published_at) continue
    const publishedMs = new Date(v.published_at).getTime()
    if (publishedMs >= cutoff30d) {
      videosLast30++
    } else if (publishedMs >= cutoff60d) {
      videosPrior30++
    }
  }

  // Frequency component: target ≥4 videos/month → score 100, cap at 2× target
  const frequencyScore = Math.min(videosLast30 / 4, 2.0)
  const frequencyNorm = (frequencyScore / 2) * 100

  // Acceleration component
  let accelNorm: number
  if (videosPrior30 > 0) {
    const uploadAccel = videosLast30 / videosPrior30
    accelNorm = ratioToScore(uploadAccel, 3)
  } else if (videosLast30 > 0) {
    accelNorm = 80
  } else {
    accelNorm = 20
  }

  return 0.6 * frequencyNorm + 0.4 * accelNorm
}

/** Sub-score 4 — AudienceGrowth (weight 0.20) */
function computeAudienceGrowth(
  snapshots: GrowthScoreInput['snapshots'],
  videos: GrowthScoreInput['videos'],
): number {
  // --- Subscriber growth rate ---
  let subNorm = 50

  if (snapshots.length >= 2) {
    const first = snapshots[0]!
    const last = snapshots[snapshots.length - 1]!

    const subStart = first.subscriber_count ?? 0
    const subEnd = last.subscriber_count ?? 0

    const daySpan =
      (new Date(last.snapshot_date).getTime() - new Date(first.snapshot_date).getTime()) /
      86_400_000

    if (daySpan === 0) {
      subNorm = 50
    } else {
      const subGrowthRate = ((subEnd - subStart) / Math.max(subStart, 1) / Math.max(daySpan, 1)) * 30
      subNorm = 100 / (1 + Math.exp(-40 * (subGrowthRate - 0.03)))
    }
  }

  // --- Views-per-video trend ---
  const sorted = [...videos]
    .filter(v => v.published_at !== null)
    .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime())

  let vpvNorm = 50

  const recent5 = sorted.slice(0, 5).map(v => v.view_count ?? 0)
  const older5 = sorted.slice(5, 10).map(v => v.view_count ?? 0)

  if (recent5.length >= 3 && older5.length >= 3) {
    const recentMedian = median(recent5)
    const olderMedian = median(older5)
    const vpvRatio = recentMedian / Math.max(olderMedian, 1)
    vpvNorm = ratioToScore(vpvRatio, 3)
  }
  // else vpvNorm stays 50 (neutral, insufficient data)

  return 0.4 * subNorm + 0.6 * vpvNorm
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

function computeConfidence(
  snapshotDays: number,
  videoCount: number,
): number {
  const dayConfidence = Math.min(snapshotDays / 14, 1.0)
  const videoConfidence = Math.min(videoCount / 10, 1.0)
  const raw = 0.4 + 0.6 * (0.6 * dayConfidence + 0.4 * videoConfidence)
  return Math.max(0.4, Math.min(1.0, raw))
}

// ---------------------------------------------------------------------------
// Label / colour
// ---------------------------------------------------------------------------

interface LabelEntry {
  min: number
  label: string
  color: string
}

const LABELS: LabelEntry[] = [
  { min: 90, label: 'Explosivo',     color: '#22c55e' },
  { min: 75, label: 'Forte',         color: '#84cc16' },
  { min: 60, label: 'Saudável',      color: '#eab308' },
  { min: 40, label: 'Estável',       color: '#f97316' },
  { min: 25, label: 'Desacelerando', color: '#ef4444' },
  { min: 0,  label: 'Declínio',      color: '#991b1b' },
]

function getLabel(score: number, confidence: number): { label: string; labelColor: string } {
  const entry = LABELS.find(l => score >= l.min) ?? LABELS[LABELS.length - 1]!
  const label = confidence < 0.7 ? `${entry.label} (dados limitados)` : entry.label
  return { label, labelColor: entry.color }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Computes a composite growth score (0–100) for a YouTube competitor channel.
 *
 * All sub-scores are pure functions of the supplied snapshot + video data.
 * Pass `_now` to inject a fixed reference time in tests.
 */
export function computeGrowthScore(
  input: GrowthScoreInput,
  _now: Date = new Date(),
): GrowthScoreResult {
  const { snapshots, videos } = input

  const snapshotDays = snapshots.length
  const videoCount = videos.length

  // Sub-scores
  const viewMomentum = computeViewMomentum(snapshots)
  const engagement = computeEngagement(videos, _now)
  const uploadConsistency = computeUploadConsistency(videos, _now)
  const audienceGrowth = computeAudienceGrowth(snapshots, videos)

  // Confidence
  const confidence = computeConfidence(snapshotDays, videoCount)

  // Weighted composite (before confidence)
  const rawScore =
    0.35 * viewMomentum +
    0.30 * engagement +
    0.15 * uploadConsistency +
    0.20 * audienceGrowth

  // Apply confidence and clamp to [0, 100]
  const score = Math.round(Math.max(0, Math.min(100, confidence * rawScore)))

  const { label, labelColor } = getLabel(score, confidence)

  return {
    score,
    confidence,
    label,
    labelColor,
    breakdown: {
      viewMomentum,
      engagement,
      uploadConsistency,
      audienceGrowth,
    },
  }
}
