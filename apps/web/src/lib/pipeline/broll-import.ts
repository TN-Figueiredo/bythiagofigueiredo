import type { BRollAssetRow, BRollImportItem } from './broll-schemas'

export function mapBRollJsonToDbRow(
  item: BRollImportItem,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    asset_id: item.asset_id,
    original_filename: item.original_filename,
    renamed_to: item.renamed_to,
    sha256: item.sha256,
    file_size_bytes: item.file_size_bytes,
    type: item.type ?? 'footage',
    source: item.source ?? 'local',
    source_type: item.source_type ?? 'pessoal',
    category: item.category,
    subcategory: item.subcategory,
    location: item.location,
    description: item.description,
    codec: item.codec,
    fps: item.fps,
    resolution: item.resolution ?? '1080p',
    width: item.width,
    height: item.height,
    duration_seconds: item.duration_seconds,
    bitrate_kbps: item.bitrate_kbps,
    has_audio: item.has_audio ?? false,
    color_profile: item.color_profile,
    storage_url: item.storage_url,
    thumbnail_url: item.thumbnail_url,
    proxy_url: item.proxy_url,
    reusable: item.reusable ?? true,
    status: item.status ?? 'available',
    captured_at: item.captured_at,
  }

  if (Array.isArray(item.tags)) row.tags = item.tags
  if (item.metadata !== undefined) row.metadata = item.metadata

  return row
}

export function classifyBRollImportItem(
  row: Record<string, unknown>,
  existing: Pick<BRollAssetRow, 'sha256' | 'tags'> | null,
): 'create' | 'update' | 'skip' {
  if (!existing) return 'create'
  if (existing.sha256 && row.sha256 === existing.sha256) {
    const diffs = buildBRollDiffLog(existing as Record<string, unknown>, row)
    return diffs.length > 0 ? 'update' : 'skip'
  }
  return 'update'
}

export function buildBRollDiffLog(
  oldRow: Record<string, unknown>,
  newRow: Record<string, unknown>,
): Array<{ asset_id: string; field: string; old: unknown; new: unknown }> {
  const diffs: Array<{ asset_id: string; field: string; old: unknown; new: unknown }> = []
  const assetId = (newRow.asset_id ?? oldRow.asset_id) as string

  for (const key of Object.keys(newRow)) {
    if (key === 'asset_id' || key === 'sha256') continue
    if (newRow[key] === undefined) continue
    const oldVal = JSON.stringify(oldRow[key])
    const newVal = JSON.stringify(newRow[key])
    if (oldVal !== newVal) {
      diffs.push({ asset_id: assetId, field: key, old: oldRow[key], new: newRow[key] })
    }
  }
  return diffs
}

export function buildBRollExportJson(assets: BRollAssetRow[]): {
  schema: string
  schema_version: string
  exported_at: string
  items: BRollAssetRow[]
  summary: { total: number; by_type: Record<string, number> }
  search_index: { tags: string[]; categories: string[]; locations: string[] }
} {
  const byType: Record<string, number> = {}
  const allTags = new Set<string>()
  const allCategories = new Set<string>()
  const allLocations = new Set<string>()

  for (const asset of assets) {
    byType[asset.type] = (byType[asset.type] ?? 0) + 1
    for (const tag of asset.tags ?? []) allTags.add(tag)
    if (asset.category) allCategories.add(asset.category)
    if (asset.location) allLocations.add(asset.location)
  }

  return {
    schema: 'broll-library',
    schema_version: '1.0.0',
    exported_at: new Date().toISOString(),
    items: assets,
    summary: { total: assets.length, by_type: byType },
    search_index: {
      tags: [...allTags],
      categories: [...allCategories],
      locations: [...allLocations],
    },
  }
}
