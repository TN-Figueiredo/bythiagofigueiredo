import { describe, it, expect } from 'vitest'
import { getSectionKey, getSectionsForFormat, flattenSections, SectionDataSchema, SectionPatchSchema } from '@/lib/pipeline/sections'

describe('getSectionKey', () => {
  it('returns shared key for shared sections', () => {
    expect(getSectionKey('ideia', 'en')).toBe('ideia_shared')
    expect(getSectionKey('images', 'pt')).toBe('images_shared')
  })

  it('returns lang-specific key for bilateral sections', () => {
    expect(getSectionKey('roteiro', 'en')).toBe('roteiro_en')
    expect(getSectionKey('roteiro', 'pt')).toBe('roteiro_pt')
    expect(getSectionKey('publish', 'en')).toBe('publish_en')
  })

  it('returns lang-specific key for postprod (no longer shared)', () => {
    expect(getSectionKey('postprod', 'en')).toBe('postprod_en')
    expect(getSectionKey('postprod', 'pt')).toBe('postprod_pt')
  })

  it('brolls is no longer shared — returns lang-specific key', () => {
    expect(getSectionKey('brolls', 'en')).toBe('brolls_en')
    expect(getSectionKey('brolls', 'pt')).toBe('brolls_pt')
  })

  it('returns lang-specific key for legacy postprod sub-section keys', () => {
    expect(getSectionKey('postprod_scenes', 'en')).toBe('postprod_scenes_en')
    expect(getSectionKey('postprod_crossref', 'pt')).toBe('postprod_crossref_pt')
    expect(getSectionKey('postprod_speedramps', 'en')).toBe('postprod_speedramps_en')
  })
})

describe('getSectionsForFormat', () => {
  it('returns 4 primary sections for video (brolls removed)', () => {
    const sections = getSectionsForFormat('video')
    expect(sections.map(s => s.key)).toEqual([
      'ideia', 'roteiro', 'postprod', 'publish',
    ])
  })

  it('marks only ideia as shared for video', () => {
    const sections = getSectionsForFormat('video')
    expect(sections.find(s => s.key === 'ideia')!.shared).toBe(true)
    expect(sections.find(s => s.key === 'roteiro')!.shared).toBe(false)
    expect(sections.find(s => s.key === 'postprod')!.shared).toBe(false)
  })

  it('postprod has no subSections', () => {
    const sections = getSectionsForFormat('video')
    const postprod = sections.find(s => s.key === 'postprod')!
    expect(postprod.subSections).toBeUndefined()
  })

  it('brolls is not in video sections', () => {
    const sections = getSectionsForFormat('video')
    expect(sections.find(s => s.key === 'brolls')).toBeUndefined()
  })

  it('returns sections for blog_post', () => {
    const sections = getSectionsForFormat('blog_post')
    expect(sections.map(s => s.key)).toEqual([
      'ideia', 'draft', 'seo', 'images', 'publish',
    ])
  })

  it('flattenSections with no sub-sections returns same array', () => {
    const sections = getSectionsForFormat('video')
    expect(flattenSections(sections)).toEqual(sections)
  })
})

describe('SectionDataSchema', () => {
  it('validates a valid section', () => {
    const result = SectionDataSchema.safeParse({
      rev: 1,
      source: 'producer',
      edited: false,
      content: 'some content',
      updated_at: '2026-05-10T14:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('allows null cowork_rev', () => {
    const result = SectionDataSchema.safeParse({
      rev: 1,
      cowork_rev: null,
      source: 'user',
      edited: false,
      content: { beats: [] },
      updated_at: '2026-05-10T14:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative rev', () => {
    const result = SectionDataSchema.safeParse({
      rev: -1,
      source: 'user',
      edited: false,
      content: '',
      updated_at: '2026-05-10T14:00:00Z',
    })
    expect(result.success).toBe(false)
  })
})

describe('SectionPatchSchema', () => {
  it('validates a patch with content and rev', () => {
    const result = SectionPatchSchema.safeParse({
      content: 'updated content',
      rev: 2,
    })
    expect(result.success).toBe(true)
  })

  it('rejects patch without rev', () => {
    const result = SectionPatchSchema.safeParse({
      content: 'updated',
    })
    expect(result.success).toBe(false)
  })
})
