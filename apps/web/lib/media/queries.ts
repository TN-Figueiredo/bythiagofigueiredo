import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { MediaAssetRow } from './types'

export interface ListMediaOptions {
  siteId: string
  folder?: string
  search?: string
  tags?: string[]
  includeDeleted?: boolean
  cursor?: string
  limit?: number
}

export interface ListMediaResult {
  assets: MediaAssetRow[]
  nextCursor: string | null
}

export async function listMediaAssets(opts: ListMediaOptions): Promise<ListMediaResult> {
  const supabase = getSupabaseServiceClient()
  const limit = opts.limit ?? 24

  let query = supabase
    .from('media_assets')
    .select('*')
    .eq('site_id', opts.siteId)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (!opts.includeDeleted) {
    query = query.is('deleted_at', null)
  }
  if (opts.folder) {
    query = query.eq('folder', opts.folder)
  }
  if (opts.search) {
    const escaped = opts.search.replace(/[%_\\]/g, '\\$&')
    query = query.ilike('filename', `%${escaped}%`)
  }
  if (opts.tags?.length) {
    query = query.contains('tags', opts.tags)
  }
  if (opts.cursor) {
    query = query.lt('created_at', opts.cursor)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as MediaAssetRow[]
  const hasMore = rows.length > limit
  const assets = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? assets[assets.length - 1]?.created_at ?? null : null

  return { assets, nextCursor }
}

export async function getMediaAsset(
  assetId: string,
  siteId: string,
): Promise<MediaAssetRow | null> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .eq('id', assetId)
    .eq('site_id', siteId)
    .single()
  if (error) return null
  return data as MediaAssetRow | null
}

export async function getAssetUsageCount(assetId: string): Promise<number> {
  const supabase = getSupabaseServiceClient()
  const { count, error } = await supabase
    .from('media_asset_usage')
    .select('id', { count: 'exact', head: true })
    .eq('asset_id', assetId)
  if (error) return 0
  return count ?? 0
}

interface FolderStat {
  count: number
  sizeBytes: number
}

export interface MediaStats {
  totalCount: number
  totalSizeBytes: number
  orphanCount: number
  softDeletedCount: number
  folderBreakdown: Record<string, FolderStat>
}

export async function getMediaStats(siteId: string): Promise<MediaStats> {
  const supabase = getSupabaseServiceClient()

  const [allResult, deletedResult, orphanResult] = await Promise.all([
    supabase
      .from('media_assets')
      .select('folder, file_size')
      .eq('site_id', siteId)
      .is('deleted_at', null),
    supabase
      .from('media_assets')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .not('deleted_at', 'is', null),
    supabase.rpc('count_orphan_media_assets', { p_site_id: siteId }),
  ])

  const rows = (allResult.data ?? []) as Array<{ folder: string; file_size: number }>
  const folderBreakdown: Record<string, FolderStat> = {}
  let totalSizeBytes = 0

  for (const row of rows) {
    totalSizeBytes += row.file_size
    const existing = folderBreakdown[row.folder]
    if (existing) {
      existing.count += 1
      existing.sizeBytes += row.file_size
    } else {
      folderBreakdown[row.folder] = { count: 1, sizeBytes: row.file_size }
    }
  }

  return {
    totalCount: rows.length,
    totalSizeBytes,
    orphanCount: typeof orphanResult.data === 'number' ? orphanResult.data : 0,
    softDeletedCount: deletedResult.count ?? 0,
    folderBreakdown,
  }
}
