import type { MediaFolder, MediaAssetType } from './types'

const INLINE_FIELD_NAMES = new Set(['inline_image', 'content_inline'])

const FOLDER_TO_TYPE: Record<string, MediaAssetType> = {
  authors: 'avatar',
  og: 'og',
  branding: 'cover',
  newsletters: 'inline',
  pipeline: 'inline',
  ads: 'inline',
  links: 'inline',
  general: 'inline',
}

export function resolveAssetType(
  folder: MediaFolder | string,
  usageCount: number,
  primaryFieldName: string | null,
): MediaAssetType {
  if (usageCount === 0) return 'orphan'
  if (folder === 'authors') return 'avatar'
  if (folder === 'og') return 'og'
  if (folder === 'blog') {
    return primaryFieldName && INLINE_FIELD_NAMES.has(primaryFieldName) ? 'inline' : 'cover'
  }
  return FOLDER_TO_TYPE[folder] ?? 'inline'
}
