import { ALLOWED_MIME_TYPES, FOLDER_LIMITS, GLOBAL_MAX_DIMENSION, GLOBAL_MIN_DIMENSION, type MediaFolder } from './types'

const MAX_FILENAME_LENGTH = 200

type ValidationOk = { ok: true }
type ValidationFail<C extends string> = { ok: false; code: C; error: string }

export function validateMimeType(
  mime: string,
): ValidationOk | ValidationFail<'unsupported_format'> {
  if ((ALLOWED_MIME_TYPES as readonly string[]).includes(mime)) {
    return { ok: true }
  }
  return {
    ok: false,
    code: 'unsupported_format',
    error: `Unsupported format "${mime}". Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
  }
}

export function validateFileSize(
  size: number,
  folder: MediaFolder,
): ValidationOk | ValidationFail<'file_too_large'> {
  if (size <= 0) {
    return { ok: false, code: 'file_too_large', error: 'File is empty' }
  }
  const limit = FOLDER_LIMITS[folder].maxSizeBytes
  if (size > limit) {
    const limitMb = (limit / 1_048_576).toFixed(0)
    return {
      ok: false,
      code: 'file_too_large',
      error: `File size ${(size / 1_048_576).toFixed(1)}MB exceeds ${limitMb}MB limit for "${folder}" folder`,
    }
  }
  return { ok: true }
}

export function validateDimensions(
  width: number,
  height: number,
  folder: MediaFolder,
): ValidationOk | ValidationFail<'dimension_exceeded'> {
  if (width < GLOBAL_MIN_DIMENSION || height < GLOBAL_MIN_DIMENSION) {
    return {
      ok: false,
      code: 'dimension_exceeded',
      error: `Dimensions ${width}×${height} below minimum ${GLOBAL_MIN_DIMENSION}×${GLOBAL_MIN_DIMENSION}`,
    }
  }
  if (width > GLOBAL_MAX_DIMENSION || height > GLOBAL_MAX_DIMENSION) {
    return {
      ok: false,
      code: 'dimension_exceeded',
      error: `Dimensions ${width}×${height} exceed maximum ${GLOBAL_MAX_DIMENSION}×${GLOBAL_MAX_DIMENSION}`,
    }
  }
  const folderMax = FOLDER_LIMITS[folder].maxDimensionPx
  if (width > folderMax || height > folderMax) {
    return {
      ok: false,
      code: 'dimension_exceeded',
      error: `Dimensions ${width}×${height} exceed ${folderMax}px limit for "${folder}" folder`,
    }
  }
  return { ok: true }
}

export function sanitizeFilename(name: string): string {
  let sanitized = name.replace(/\.\.\//g, '').replace(/\.\.\\/g, '').replace(/[\/\\]+/g, '-')

  const lastDot = sanitized.lastIndexOf('.')
  let stem = lastDot > 0 ? sanitized.slice(0, lastDot) : sanitized
  const ext = lastDot > 0 ? sanitized.slice(lastDot).toLowerCase() : ''

  stem = stem
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9\-\.]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')

  const maxStemLength = MAX_FILENAME_LENGTH - ext.length
  if (stem.length > maxStemLength) {
    stem = stem.slice(0, maxStemLength).replace(/-+$/, '')
  }

  return stem + ext
}
