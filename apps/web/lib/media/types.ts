export type MediaFolder =
  | 'authors'
  | 'blog'
  | 'pipeline'
  | 'newsletters'
  | 'branding'
  | 'og'
  | 'ads'
  | 'links'
  | 'general'

export interface UploadMediaInput {
  file: File | Buffer
  filename: string
  folder: MediaFolder
  siteId: string
  uploadedBy: string
  altText?: string
  tags?: string[]
}

export interface MediaAsset {
  id: string
  siteId: string
  blobUrl: string
  blobPathname: string
  filename: string
  altText: string | null
  width: number | null
  height: number | null
  mimeType: string
  fileSize: number
  contentHash: string
  folder: MediaFolder
  tags: string[]
  uploadedBy: string | null
  createdAt: string
}

export type UploadErrorCode =
  | 'no_file'
  | 'unsupported_format'
  | 'file_too_large'
  | 'empty_file'
  | 'dimension_exceeded'
  | 'blob_upload_failed'
  | 'db_insert_failed'
  | 'processing_failed'

export type UploadResult =
  | { ok: true; asset: MediaAsset; deduplicated: boolean }
  | { ok: false; error: string; code: UploadErrorCode }

export interface MediaAssetRow {
  id: string
  site_id: string
  blob_url: string
  blob_pathname: string
  filename: string
  alt_text: string | null
  width: number | null
  height: number | null
  mime_type: string
  file_size: number
  content_hash: string
  folder: string
  tags: string[]
  uploaded_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface FolderLimit {
  maxSizeBytes: number
  maxDimensionPx: number
}

export const FOLDER_LIMITS: Record<MediaFolder, FolderLimit> = {
  authors:     { maxSizeBytes: 2 * 1024 * 1024,  maxDimensionPx: 2048 },
  blog:        { maxSizeBytes: 5 * 1024 * 1024,  maxDimensionPx: 4096 },
  pipeline:    { maxSizeBytes: 5 * 1024 * 1024,  maxDimensionPx: 4096 },
  newsletters: { maxSizeBytes: 2 * 1024 * 1024,  maxDimensionPx: 2048 },
  branding:    { maxSizeBytes: 1 * 1024 * 1024,  maxDimensionPx: 2048 },
  og:          { maxSizeBytes: 2 * 1024 * 1024,  maxDimensionPx: 2400 },
  ads:         { maxSizeBytes: 5 * 1024 * 1024,  maxDimensionPx: 4096 },
  links:       { maxSizeBytes: 5 * 1024 * 1024,  maxDimensionPx: 4096 },
  general:     { maxSizeBytes: 5 * 1024 * 1024,  maxDimensionPx: 4096 },
}

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
] as const

export const GLOBAL_MAX_DIMENSION = 8192
export const GLOBAL_MIN_DIMENSION = 10

export function toMediaAsset(row: MediaAssetRow): MediaAsset {
  return {
    id: row.id,
    siteId: row.site_id,
    blobUrl: row.blob_url,
    blobPathname: row.blob_pathname,
    filename: row.filename,
    altText: row.alt_text,
    width: row.width,
    height: row.height,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    contentHash: row.content_hash,
    folder: row.folder as MediaFolder,
    tags: row.tags ?? [],
    uploadedBy: row.uploaded_by ?? null,
    createdAt: row.created_at,
  }
}

export function mimeToExt(mime: string): string {
  switch (mime) {
    case 'image/jpeg': return 'jpg'
    case 'image/png': return 'png'
    case 'image/webp': return 'webp'
    case 'image/gif': return 'gif'
    case 'image/svg+xml': return 'svg'
    default: return 'bin'
  }
}

export type MediaAssetType = 'cover' | 'inline' | 'avatar' | 'og' | 'orphan'
