import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MediaFolder, MediaAssetRow } from './types'

export function computeContentHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export async function checkDedup(
  supabase: SupabaseClient,
  siteId: string,
  contentHash: string,
): Promise<MediaAssetRow | null> {
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .eq('site_id', siteId)
    .eq('content_hash', contentHash)
    .is('deleted_at', null)
    .limit(1)
    .single()

  if (error || !data) return null
  return data as MediaAssetRow
}

export function buildBlobPathname(
  siteId: string,
  folder: MediaFolder,
  contentHash: string,
  ext: string,
): string {
  return `${siteId}/${folder}/${contentHash.slice(0, 16)}.${ext}`
}
