// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/utils.ts

import { PRIMARY_H } from './constants'

/**
 * Format seconds as MM:SS.
 */
export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Format duration as human-friendly string (e.g. "24s", "1m33s").
 */
export function fmtDur(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${m}m`
}

/**
 * Deterministic pseudo-random [0,1) for procedural generation.
 */
export function pRand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Given a hex color, returns '#111' or '#fff' for readable text.
 */
export function badgeTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.52 ? '#111' : '#fff'
}

/**
 * Choose ruler tick interval based on beat duration.
 */
export function tickInterval(dur: number): number {
  if (dur <= 15) return 1
  if (dur <= 30) return 2
  if (dur <= 60) return 5
  if (dur <= 180) return 10
  if (dur <= 600) return 30
  return 60
}

/**
 * Compute pixels-per-second from available width, beat duration, and zoom.
 */
export function calcPxPerSec(availW: number, duration: number, zoom: number): number {
  return (availW / duration) * zoom
}

/**
 * Compute effective track height: full height if clips present, EMPTY_H otherwise.
 */
export function effectiveTrackH(
  trackId: string,
  clips: Record<string, unknown[]>,
  trackHeights: Record<string, number>,
  emptyH: number,
): number {
  return (clips[trackId]?.length ?? 0) > 0 ? (trackHeights[trackId] ?? emptyH) : emptyH
}

/**
 * Difficulty badge color.
 */
export function difficultyColor(difficulty: string): string {
  switch (difficulty.toUpperCase()) {
    case 'EASY': return '#27AE60'
    case 'HARD': return '#E74C3C'
    default: return '#E67E22'
  }
}

/**
 * Parse PostProd section content from 3 useSection() instances.
 * Merges scenes, crossRef, speedRamps into a single PostProdContent object.
 */
export function parsePostProdContent(
  scenesContent: unknown,
  crossRefContent: unknown,
  speedRampsContent: unknown,
): import('./types').PostProdContent {
  const result: import('./types').PostProdContent = {}

  // Parse scenes -> beats + assets
  if (scenesContent && typeof scenesContent === 'object' && !Array.isArray(scenesContent)) {
    const sc = scenesContent as Record<string, unknown>
    if (Array.isArray(sc.beats)) result.beats = sc.beats as import('./types').BeatData[]
    if (sc.assets && typeof sc.assets === 'object') result.assets = sc.assets as Record<number, import('./types').BeatAssets>
  }

  // Parse crossRef
  if (crossRefContent && typeof crossRefContent === 'object' && !Array.isArray(crossRefContent)) {
    result.crossRef = crossRefContent as import('./types').CrossRefData
  }

  // Parse speedRamps
  if (speedRampsContent && typeof speedRampsContent === 'object' && !Array.isArray(speedRampsContent)) {
    result.speedRamps = speedRampsContent as import('./types').SpeedRampData
  }

  return result
}

/**
 * Build default track height map (V1 + A1 get 42px, rest get defH).
 */
export function buildDefaultTrackHeights(tracks: import('./types').TrackDef[], defH: number): Record<string, number> {
  const heights: Record<string, number> = {}
  for (const t of tracks) {
    heights[t.id] = (t.id === 'V1' || t.id === 'A1') ? PRIMARY_H : defH
  }
  return heights
}
