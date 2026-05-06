import type { HeatmapMatrix } from '../types.js'

/**
 * Build a 7x24 heatmap matrix from click timestamps.
 * Rows = day of week (0=Monday..6=Sunday), Columns = hour (0..23 UTC).
 */
export function buildHeatmap(timestamps: Date[]): HeatmapMatrix {
  // Initialize 7x24 matrix
  const matrix: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0),
  )

  let max = 0
  let total = 0

  for (const ts of timestamps) {
    // getUTCDay: 0=Sunday..6=Saturday → convert to 0=Monday..6=Sunday
    const jsDay = ts.getUTCDay() // 0=Sun
    const day = jsDay === 0 ? 6 : jsDay - 1 // 0=Mon..6=Sun
    const hour = ts.getUTCHours()

    matrix[day]![hour]!++
    total++

    if (matrix[day]![hour]! > max) {
      max = matrix[day]![hour]!
    }
  }

  return { matrix, max, total }
}
