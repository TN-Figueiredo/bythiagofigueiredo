import { describe, it, expect } from 'vitest'
import { computeValidationScore } from '@/lib/pipeline/validation'

describe('computeValidationScore', () => {
  it('returns 0 for empty item', () => {
    const score = computeValidationScore({
      title_pt: null,
      title_en: null,
      hook: null,
      synopsis: null,
      body_content: null,
      tags: [],
      production_checklist: [],
      format_metadata: {},
      format: 'video',
    })
    expect(score.overall).toBe(0)
    expect(score.breakdown.has_title).toBe(false)
  })

  it('returns 100 for fully complete item', () => {
    const score = computeValidationScore({
      title_pt: 'Título',
      title_en: 'Title',
      hook: 'Great hook',
      synopsis: 'A synopsis here',
      body_content: 'Full body content',
      tags: ['ai'],
      production_checklist: [
        { label: 'A', done: true },
        { label: 'B', done: true },
      ],
      format_metadata: { playlist_letter: 'G', episode_number: 1 },
      format: 'video',
    })
    expect(score.overall).toBe(100)
    expect(score.breakdown.has_title).toBe(true)
    expect(score.breakdown.checklist_pct).toBe(100)
  })

  it('handles partial checklist', () => {
    const score = computeValidationScore({
      title_pt: 'X',
      title_en: null,
      hook: null,
      synopsis: null,
      body_content: null,
      tags: [],
      production_checklist: [
        { label: 'A', done: true },
        { label: 'B', done: false },
        { label: 'C', done: false },
        { label: 'D', done: true },
      ],
      format_metadata: {},
      format: 'blog_post',
    })
    expect(score.breakdown.checklist_pct).toBe(50)
    expect(score.breakdown.has_title).toBe(true)
    // blog_post uses WEIGHTS_BLOG: has_title=12, checklist_pct weight=15
    expect(score.overall).toBe(12 + Math.round(0.5 * 15)) // title(12) + checklist(7.5 rounded=8)
  })

  it('metadata_complete requires valid non-empty metadata', () => {
    const score = computeValidationScore({
      title_pt: 'X',
      title_en: null,
      hook: null,
      synopsis: null,
      body_content: null,
      tags: [],
      production_checklist: [],
      format_metadata: {},
      format: 'video',
    })
    expect(score.breakdown.metadata_complete).toBe(false)
  })
})

describe('blog_post format-specific validation', () => {
  const blogBase = {
    title_pt: 'Test Title',
    title_en: null,
    hook: 'A compelling hook',
    synopsis: 'Synopsis text',
    body_content: 'Some body content here',
    tags: ['tag1'],
    production_checklist: [{ label: 'item', done: true }],
    format_metadata: {},
    format: 'blog_post' as const,
    sections: {
      draft_pt: { rev: 1, content: { slug: 'test-slug', excerpt: 'An excerpt' }, source: 'user', edited: true, updated_at: new Date().toISOString() },
      seo_pt: { rev: 1, content: { meta_title: 'Meta Title', meta_description: 'Meta desc' }, source: 'user', edited: true, updated_at: new Date().toISOString() },
      images_shared: { rev: 1, content: { cover: { image_url: 'https://example.com/img.jpg' } }, source: 'user', edited: true, updated_at: new Date().toISOString() },
    },
  }

  it('includes has_slug factor for blog_post', () => {
    const result = computeValidationScore(blogBase)
    expect(result.breakdown.has_slug).toBe(true)
  })

  it('has_slug is false when slug missing', () => {
    const input = {
      ...blogBase,
      sections: {
        ...blogBase.sections,
        draft_pt: { rev: 1, content: {}, source: 'user', edited: true, updated_at: new Date().toISOString() },
      },
    }
    const result = computeValidationScore(input)
    expect(result.breakdown.has_slug).toBe(false)
  })

  it('includes has_excerpt factor for blog_post', () => {
    const result = computeValidationScore(blogBase)
    expect(result.breakdown.has_excerpt).toBe(true)
  })

  it('includes has_seo factor for blog_post', () => {
    const result = computeValidationScore(blogBase)
    expect(result.breakdown.has_seo).toBe(true)
  })

  it('includes has_cover factor for blog_post', () => {
    const result = computeValidationScore(blogBase)
    expect(result.breakdown.has_cover).toBe(true)
  })

  it('non-blog format does not include blog factors', () => {
    const videoInput = { ...blogBase, format: 'video' as const, sections: undefined }
    const result = computeValidationScore(videoInput)
    expect(result.breakdown).not.toHaveProperty('has_slug')
  })
})
