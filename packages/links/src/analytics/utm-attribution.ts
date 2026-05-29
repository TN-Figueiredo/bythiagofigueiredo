export interface UtmClickRow {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  clicks: number
}

export interface UtmGroup {
  key: string
  clicks: number
  pct: number
}

type UtmDimension = 'source' | 'medium' | 'campaign'

const FIELD_MAP: Record<UtmDimension, keyof UtmClickRow> = {
  source: 'utm_source',
  medium: 'utm_medium',
  campaign: 'utm_campaign',
}

const DIRECT_LABEL = '(direct)'

export function aggregateByUtm(rows: UtmClickRow[], dimension: UtmDimension): UtmGroup[] {
  if (rows.length === 0) return []

  const field = FIELD_MAP[dimension]
  const map = new Map<string, number>()
  let total = 0

  for (const row of rows) {
    const key = (row[field] as string | null) ?? DIRECT_LABEL
    map.set(key, (map.get(key) ?? 0) + row.clicks)
    total += row.clicks
  }

  if (total === 0) return []

  return Array.from(map.entries())
    .map(([key, clicks]) => ({
      key,
      clicks,
      pct: Math.round((clicks / total) * 1000) / 10,
    }))
    .sort((a, b) => b.clicks - a.clicks)
}
