export interface ClickRow {
  clicks: number
  unique_visitors: number
  is_bot: boolean
}

export interface FilteredMetrics {
  totalClicks: number
  totalUnique: number
  botClicks: number
  botPct: number
}

export function recalcWithoutBots(rows: ClickRow[], includeBots = false): FilteredMetrics {
  let humanClicks = 0
  let humanUnique = 0
  let botClicks = 0
  let allClicks = 0

  for (const row of rows) {
    allClicks += row.clicks
    if (row.is_bot) {
      botClicks += row.clicks
    } else {
      humanClicks += row.clicks
      humanUnique += row.unique_visitors
    }
  }

  return {
    totalClicks: includeBots ? allClicks : humanClicks,
    totalUnique: includeBots ? rows.reduce((s, r) => s + r.unique_visitors, 0) : humanUnique,
    botClicks,
    botPct: allClicks > 0 ? Math.round((botClicks / allClicks) * 100) : 0,
  }
}
