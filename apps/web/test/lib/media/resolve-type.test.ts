import { describe, it, expect } from 'vitest'
import { resolveAssetType } from '@/lib/media/resolve-type'

describe('resolveAssetType', () => {
  it('uses folder-based classification regardless of usageCount', () => {
    expect(resolveAssetType('blog', 0, null)).toBe('cover')
    expect(resolveAssetType('general', 0, null)).toBe('inline')
    expect(resolveAssetType('authors', 0, null)).toBe('avatar')
  })

  it('returns avatar for authors folder', () => {
    expect(resolveAssetType('authors', 1, 'avatar')).toBe('avatar')
    expect(resolveAssetType('authors', 3, null)).toBe('avatar')
  })

  it('returns og for og folder', () => {
    expect(resolveAssetType('og', 1, 'og_image')).toBe('og')
    expect(resolveAssetType('og', 2, null)).toBe('og')
  })

  it('returns inline for blog folder with inline_image field', () => {
    expect(resolveAssetType('blog', 1, 'inline_image')).toBe('inline')
    expect(resolveAssetType('blog', 1, 'content_inline')).toBe('inline')
  })

  it('returns cover for blog folder with cover_image field', () => {
    expect(resolveAssetType('blog', 1, 'cover_image')).toBe('cover')
  })

  it('returns cover for blog folder with no field info', () => {
    expect(resolveAssetType('blog', 1, null)).toBe('cover')
  })

  it('returns cover for branding folder', () => {
    expect(resolveAssetType('branding', 1, 'logo_url')).toBe('cover')
  })

  it('returns inline for newsletters folder', () => {
    expect(resolveAssetType('newsletters', 1, 'content_inline')).toBe('inline')
  })

  it('returns inline for pipeline folder', () => {
    expect(resolveAssetType('pipeline', 1, 'cover_image')).toBe('inline')
  })

  it('returns inline for unknown folders', () => {
    expect(resolveAssetType('general', 1, null)).toBe('inline')
    expect(resolveAssetType('ads', 1, null)).toBe('inline')
    expect(resolveAssetType('links', 1, null)).toBe('inline')
  })
})
