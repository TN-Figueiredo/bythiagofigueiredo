export function mapJsonToDbRow(
  item: Record<string, unknown>,
  type: 'music' | 'sfx',
): Record<string, unknown> {
  const audio = (item.audio ?? {}) as Record<string, unknown>

  const row: Record<string, unknown> = {
    type,
    asset_id: item.asset_id,
    original_filename: item.original_filename,
    renamed_to: item.rename_to ?? item.renamed_to,
    sha256: item.sha256,
    source: item.source ?? 'artlist',
    category: item.category,
    subcategory: item.subcategory,
    genre: item.genre,
    artist: item.artist,
    track_name: item.track_name,
    artlist_url: item.artlist_url,
    music_key: item.key ?? item.music_key,
    bpm: item.bpm,
    energy: item.energy,
    tempo_feel: item.tempo_feel,
    duration_seconds: audio.duration_seconds ?? item.duration_seconds,
    status: item.status ?? 'downloaded',
    priority: item.priority,
    reusable: item.reusable ?? true,
  }

  for (const field of ['tags', 'mood', 'instruments', 'use_cases', 'reuse_scenarios'] as const) {
    if (Array.isArray(item[field])) row[field] = item[field]
  }

  const metadata: Record<string, unknown> = {}
  for (const key of [
    'audio',
    'mix_notes',
    'video_mapping',
    'pairs_well_with',
    'avoid_with',
    'entry_style',
    'duration_hint',
    'loudness_headroom',
    'measured_loudness',
  ] as const) {
    if (item[key] !== undefined) metadata[key] = item[key]
  }
  if (Object.keys(metadata).length > 0) row.metadata = metadata

  return row
}

export function classifyImportItem(
  row: Record<string, unknown>,
  existing: Record<string, unknown> | null,
): 'create' | 'update' | 'skip' {
  if (!existing) return 'create'
  if (existing.sha256 && row.sha256 === existing.sha256) {
    const diffs = buildDiffLog(existing, row)
    return diffs.length > 0 ? 'update' : 'skip'
  }
  return 'update'
}

export function buildDiffLog(
  oldRow: Record<string, unknown>,
  newRow: Record<string, unknown>,
): Array<{ asset_id: string; field: string; old: unknown; new: unknown }> {
  const diffs: Array<{ asset_id: string; field: string; old: unknown; new: unknown }> = []
  const assetId = (newRow.asset_id ?? oldRow.asset_id) as string

  for (const key of Object.keys(newRow)) {
    if (key === 'asset_id' || key === 'sha256') continue
    const oldVal = JSON.stringify(oldRow[key])
    const newVal = JSON.stringify(newRow[key])
    if (oldVal !== newVal) {
      diffs.push({ asset_id: assetId, field: key, old: oldRow[key], new: newRow[key] })
    }
  }
  return diffs
}

export function buildExportJson(
  assets: Array<Record<string, unknown>>,
  _stats: unknown,
): {
  schema: string
  schema_version: string
  exported_at: string
  music: Array<Record<string, unknown>>
  sfx: Array<Record<string, unknown>>
  summary: { total: number; music_count: number; sfx_count: number }
  search_index: { tags: string[]; moods: string[]; instruments: string[]; categories: string[] }
} {
  const music = assets.filter(a => a.type === 'music')
  const sfx = assets.filter(a => a.type === 'sfx')

  const allTags = new Set<string>()
  const allMoods = new Set<string>()
  const allInstruments = new Set<string>()
  const allCategories = new Set<string>()

  for (const asset of assets) {
    for (const tag of (asset.tags as string[]) ?? []) allTags.add(tag)
    for (const m of (asset.mood as string[]) ?? []) allMoods.add(m)
    for (const i of (asset.instruments as string[]) ?? []) allInstruments.add(i)
    if (asset.category) allCategories.add(asset.category as string)
  }

  return {
    schema: 'audio-library',
    schema_version: '6.1.0',
    exported_at: new Date().toISOString(),
    music,
    sfx,
    summary: {
      total: assets.length,
      music_count: music.length,
      sfx_count: sfx.length,
    },
    search_index: {
      tags: [...allTags],
      moods: [...allMoods],
      instruments: [...allInstruments],
      categories: [...allCategories],
    },
  }
}
