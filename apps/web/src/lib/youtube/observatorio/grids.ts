// Legacy 7×24 grids (Mon-first weekday × SP hour) built from the engine; the one adapter for the page and the pipeline service.
import type { Observatory } from './index'

export interface LegacyGrids { heatmap: number[][]; hitsHeatmap: number[][] }

/**
 * - heatmap: engine publication count per 2 h block (7 × 12), spread onto both hours of the block.
 * - hitsHeatmap: engine outliers (every age window) per SP weekday (Mon = 0) × hour.
 */
export function legacyGrids(obs: Observatory): LegacyGrids {
  const heatmap = obs.heatmap('todos', 'long').cells.map(row => Array.from({ length: 24 }, (_, h) => row[h >> 1]!.n))
  const hitsHeatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  for (const it of obs.outliers({ ages: 'all', fmt: 'long' }).items) {
    const p = obs.date.parts(it.video.pub)
    hitsHeatmap[(p.dow + 6) % 7]![p.h]!++
  }
  return { heatmap, hitsHeatmap }
}
