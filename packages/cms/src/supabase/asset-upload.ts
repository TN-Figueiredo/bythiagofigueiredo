import type { SupabaseClient } from '@supabase/supabase-js'

export interface UploadContentAssetOpts {
  siteId: string
  contentType: 'blog' | 'campaigns'
  contentId: string
  file: File | Blob
  filename: string
}

export interface UploadedAsset {
  path: string
  signedUrl: string
}

export async function uploadContentAsset(
  supabase: SupabaseClient,
  opts: UploadContentAssetOpts,
): Promise<UploadedAsset> {
  const path = `${opts.siteId}/${opts.contentType}/${opts.contentId}/${opts.filename}`
  const { error: uErr } = await supabase.storage.from('content-files').upload(path, opts.file, { upsert: false })
  if (uErr) throw uErr

  const { data: signed, error: sErr } = await supabase.storage
    .from('content-files')
    .createSignedUrl(path, 60 * 60 * 24 * 7)
  if (sErr || !signed) throw sErr ?? new Error('signed URL failed')

  return { path, signedUrl: signed.signedUrl }
}
