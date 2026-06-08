import { describe, it, expect } from 'vitest'
import {
  getSectionKey,
  getSectionsForFormat,
  flattenSections,
  SectionDataSchema,
  SectionPatchSchema,
  FORMAT_SHARED_SECTIONS,
} from '@/lib/pipeline/sections'
import type { Format } from '@/lib/pipeline/schemas'

describe('getSectionKey (format-aware)', () => {
  it('video ideia is PER-LANGUAGE (not shared)', () => {
    expect(getSectionKey('ideia', 'pt', 'video')).toBe('ideia_pt')
    expect(getSectionKey('ideia', 'en', 'video')).toBe('ideia_en')
    expect(getSectionKey('ideia', 'pt-br', 'video')).toBe('ideia_pt')
  })

  it('blog_post + newsletter ideia stay SHARED', () => {
    expect(getSectionKey('ideia', 'pt', 'blog_post')).toBe('ideia_shared')
    expect(getSectionKey('ideia', 'pt', 'newsletter')).toBe('ideia_shared')
  })

  it('video roteiro/postprod/publish are per-language', () => {
    expect(getSectionKey('roteiro', 'pt', 'video')).toBe('roteiro_pt')
    expect(getSectionKey('roteiro', 'en', 'video')).toBe('roteiro_en')
    expect(getSectionKey('postprod', 'en', 'video')).toBe('postprod_en')
    expect(getSectionKey('publish', 'en', 'video')).toBe('publish_en')
  })

  it('blog images/course curriculum+launch stay shared', () => {
    expect(getSectionKey('images', 'pt', 'blog_post')).toBe('images_shared')
    expect(getSectionKey('curriculum', 'en', 'course')).toBe('curriculum_shared')
    expect(getSectionKey('launch', 'pt', 'course')).toBe('launch_shared')
  })

  it('legacy postprod sub-section keys stay per-language for video', () => {
    expect(getSectionKey('postprod_scenes', 'en', 'video')).toBe('postprod_scenes_en')
    expect(getSectionKey('postprod_crossref', 'pt', 'video')).toBe('postprod_crossref_pt')
  })
})

describe('FORMAT_SHARED_SECTIONS', () => {
  it('is exhaustive over the 5 Format members (no social, has newsletter)', () => {
    const keys = Object.keys(FORMAT_SHARED_SECTIONS).sort()
    expect(keys).toEqual(['blog_post', 'campaign', 'course', 'newsletter', 'video'].sort())
    // compile-time exhaustiveness guard: every Format member resolves a set
    const all: Record<Format, ReadonlySet<string>> = FORMAT_SHARED_SECTIONS
    expect(all.video.has('ideia')).toBe(false)
    expect(all.blog_post.has('ideia')).toBe(true)
    expect(all.newsletter.has('ideia')).toBe(true)
  })
})

describe('getSectionsForFormat', () => {
  it('returns 4 primary sections for video (brolls removed)', () => {
    const sections = getSectionsForFormat('video')
    expect(sections.map(s => s.key)).toEqual([
      'ideia', 'roteiro', 'postprod', 'publish',
    ])
  })

  it('marks ideia as per-language (shared:false) for video', () => {
    const sections = getSectionsForFormat('video')
    expect(sections.find(s => s.key === 'ideia')!.shared).toBe(false)
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
