export interface VisitorRow {
  is_returning: boolean
  clicks: number
}

export interface NewVsReturningResult {
  newClicks: number
  returningClicks: number
  newPct: number
  returningPct: number
  donut: Array<{ k: string; v: number; color: string }>
}

export function computeNewVsReturning(rows: VisitorRow[]): NewVsReturningResult {
  let newClicks = 0
  let returningClicks = 0

  for (const row of rows) {
    if (row.is_returning) {
      returningClicks += row.clicks
    } else {
      newClicks += row.clicks
    }
  }

  const total = newClicks + returningClicks
  const newPct = total > 0 ? Math.round((newClicks / total) * 100) : 0
  const returningPct = total > 0 ? Math.round((returningClicks / total) * 100) : 0

  return {
    newClicks,
    returningClicks,
    newPct,
    returningPct,
    donut: [
      { k: 'Novos', v: newPct, color: '#3FA9C0' },
      { k: 'Retornantes', v: returningPct, color: '#E0A23C' },
    ],
  }
}
