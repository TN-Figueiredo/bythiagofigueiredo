import { put, del } from '@vercel/blob'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  validateMimeType,
  validateFileSize,
  validateDimensions,
  sanitizeFilename,
} from './validation'
import { processImage } from './process'
import { computeContentHash, checkDedup, buildBlobPathname } from './hash'
import type {
  UploadMediaInput,
  UploadResult,
  UploadErrorCode,
  MediaAssetRow,
} from './types'
import { toMediaAsset, mimeToExt } from './types'

function detectMimeType(file: File | Buffer, filename: string): string {
  if (file instanceof File) return file.type
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const extMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
  }
  return extMap[ext] ?? 'application/octet-stream'
}

async function toBuffer(file: File | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(file)) return file
  return Buffer.from(await file.arrayBuffer())
}

function fail(code: UploadErrorCode, error: string): UploadResult {
  return { ok: false, code, error }
}

export async function uploadMediaAsset(
  input: UploadMediaInput,
): Promise<UploadResult> {
  const { filename: rawFilename, folder, siteId, uploadedBy, altText, tags } = input

  const mimeType = detectMimeType(input.file, rawFilename)
  const mimeCheck = validateMimeType(mimeType)
  if (!mimeCheck.ok) return fail(mimeCheck.code, mimeCheck.error)

  let buffer: Buffer
  try {
    buffer = await toBuffer(input.file)
  } catch {
    return fail('processing_failed', 'Failed to read file data')
  }

  const sizeCheck = validateFileSize(buffer.length, folder)
  if (!sizeCheck.ok) return fail(sizeCheck.code, sizeCheck.error)

  let processed
  try {
    processed = await processImage(buffer, mimeType)
  } catch (err) {
    Sentry.captureException(err, {
      tags: { media: 'true', component: 'media-upload', step: 'exif' },
    })
    return fail('processing_failed', 'Image processing failed')
  }

  if (processed.width !== null && processed.height !== null) {
    const dimCheck = validateDimensions(processed.width, processed.height, folder)
    if (!dimCheck.ok) return fail(dimCheck.code, dimCheck.error)
  }

  const contentHash = computeContentHash(processed.buffer)

  const supabase = getSupabaseServiceClient()
  const existing = await checkDedup(supabase, siteId, contentHash)
  if (existing) {
    return { ok: true, asset: toMediaAsset(existing), deduplicated: true }
  }

  const ext = mimeToExt(mimeType)
  const pathname = buildBlobPathname(siteId, folder, contentHash, ext)
  const filename = sanitizeFilename(rawFilename)

  let blobResult: { url: string; pathname: string }
  try {
    blobResult = await put(pathname, processed.buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: mimeType,
    })
  } catch (err) {
    Sentry.captureException(err, {
      tags: { media: 'true', component: 'media-upload', step: 'blob-put' },
    })
    return fail('blob_upload_failed', 'Failed to upload to storage')
  }

  const { data: row, error: insertError } = await supabase
    .from('media_assets')
    .upsert(
      {
        site_id: siteId,
        blob_url: blobResult.url,
        blob_pathname: blobResult.pathname,
        filename,
        alt_text: altText ?? null,
        width: processed.width,
        height: processed.height,
        mime_type: mimeType,
        file_size: processed.buffer.length,
        content_hash: contentHash,
        folder,
        tags: tags ?? [],
        uploaded_by: uploadedBy,
      },
      { onConflict: 'site_id,content_hash', ignoreDuplicates: false },
    )
    .select('*')
    .single()

  if (insertError || !row) {
    try {
      await del(blobResult.url)
    } catch {
      // Best-effort cleanup
    }
    Sentry.captureException(
      new Error(insertError?.message ?? 'DB insert returned null'),
      { tags: { media: 'true', component: 'media-upload', step: 'db-insert' } },
    )
    return fail('db_insert_failed', insertError?.message ?? 'Failed to save asset metadata')
  }

  return {
    ok: true,
    asset: toMediaAsset(row as MediaAssetRow),
    deduplicated: false,
  }
}

export async function uploadMediaAssets(
  inputs: UploadMediaInput[],
  concurrency = 3,
): Promise<UploadResult[]> {
  const results: UploadResult[] = new Array(inputs.length)

  for (let i = 0; i < inputs.length; i += concurrency) {
    const chunk = inputs.slice(i, i + concurrency)
    const chunkResults = await Promise.all(
      chunk.map((input) => uploadMediaAsset(input)),
    )
    for (let j = 0; j < chunkResults.length; j++) {
      results[i + j] = chunkResults[j]
    }
  }

  return results
}
