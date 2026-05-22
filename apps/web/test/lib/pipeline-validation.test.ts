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

  it('blog_post weights sum to 100', () => {
    // Verify WEIGHTS_BLOG totals to 100 by scoring a fully complete blog_post
    const result = computeValidationScore({
      ...blogBase,
      title_pt: 'Title',
      hook: 'Hook',
      synopsis: 'Synopsis',
      body_content: 'Body',
      tags: ['tag'],
      production_checklist: [{ label: 'item', done: true }],
      format_metadata: {},
    })
    // All blog factors true + checklist 100% = full score of 100
    // has_title(12)+has_hook(10)+has_synopsis(8)+has_body(15)+has_tags(10)+checklist(15)+metadata(0)+slug(5)+excerpt(5)+seo(5)+cover(5) = 90 without metadata
    // metadata_complete is false (empty format_metadata), so max without metadata = 90
    // With metadata_complete false: 100 - 10 = 90
    expect(result.overall).toBe(90)
  })

  it('non-blog format does not include blog factors', () => {
    const videoInput = { ...blogBase, format: 'video' as const, sections: undefined }
    const result = computeValidationScore(videoInput)
    expect(result.breakdown).not.toHaveProperty('has_slug')
  })
})

describe('blog_post per-locale validation', () => {
  const makeSection = (content: Record<string, unknown>) => ({
    rev: 1, content, source: 'user', edited: true, updated_at: new Date().toISOString(),
  })

  const fullSections = {
    draft_pt: makeSection({ slug: 'slug-pt', excerpt: 'Resumo' }),
    draft_en: makeSection({ slug: 'slug-en', excerpt: 'Excerpt' }),
    seo_pt: makeSection({ meta_title: 'Título SEO', meta_description: 'Desc SEO' }),
    seo_en: makeSection({ meta_title: 'SEO Title', meta_description: 'SEO Desc' }),
    images_shared: makeSection({ cover: { image_url: 'https://example.com/img.jpg' } }),
  }

  const baseInput = {
    title_pt: 'Título',
    title_en: 'Title',
    hook: 'Hook',
    synopsis: 'Synopsis',
    body_content: 'Body',
    tags: ['tag'],
    production_checklist: [{ label: 'item', done: true }],
    format_metadata: {},
    format: 'blog_post' as const,
  }

  it('pt-br language: checks only PT sections (default behavior)', () => {
    const result = computeValidationScore({
      ...baseInput,
      language: 'pt-br',
      sections: {
        draft_pt: makeSection({ slug: 'slug-pt', excerpt: 'Resumo' }),
        seo_pt: makeSection({ meta_title: 'Meta', meta_description: 'Desc' }),
        images_shared: fullSections.images_shared,
      },
    })
    expect(result.breakdown.has_slug).toBe(true)
    expect(result.breakdown.has_excerpt).toBe(true)
    expect(result.breakdown.has_seo).toBe(true)
    expect(result.breakdown.has_cover).toBe(true)
  })

  it('undefined language: defaults to PT sections', () => {
    const result = computeValidationScore({
      ...baseInput,
      sections: {
        draft_pt: makeSection({ slug: 'slug-pt', excerpt: 'Resumo' }),
        seo_pt: makeSection({ meta_title: 'Meta', meta_description: 'Desc' }),
        images_shared: fullSections.images_shared,
      },
    })
    expect(result.breakdown.has_slug).toBe(true)
    expect(result.breakdown.has_excerpt).toBe(true)
    expect(result.breakdown.has_seo).toBe(true)
  })

  it('en language: checks only EN sections', () => {
    const result = computeValidationScore({
      ...baseInput,
      language: 'en',
      sections: {
        draft_en: makeSection({ slug: 'slug-en', excerpt: 'Excerpt' }),
        seo_en: makeSection({ meta_title: 'SEO Title', meta_description: 'SEO Desc' }),
        images_shared: fullSections.images_shared,
      },
    })
    expect(result.breakdown.has_slug).toBe(true)
    expect(result.breakdown.has_excerpt).toBe(true)
    expect(result.breakdown.has_seo).toBe(true)
  })

  it('en language: PT-only sections yield false for slug/excerpt/seo', () => {
    const result = computeValidationScore({
      ...baseInput,
      language: 'en',
      sections: {
        draft_pt: makeSection({ slug: 'slug-pt', excerpt: 'Resumo' }),
        seo_pt: makeSection({ meta_title: 'Meta', meta_description: 'Desc' }),
        images_shared: fullSections.images_shared,
      },
    })
    expect(result.breakdown.has_slug).toBe(false)
    expect(result.breakdown.has_excerpt).toBe(false)
    expect(result.breakdown.has_seo).toBe(false)
  })

  it('both language: requires both locales — full data yields true', () => {
    const result = computeValidationScore({
      ...baseInput,
      language: 'both',
      sections: fullSections,
    })
    expect(result.breakdown.has_slug).toBe(true)
    expect(result.breakdown.has_excerpt).toBe(true)
    expect(result.breakdown.has_seo).toBe(true)
    expect(result.breakdown.has_cover).toBe(true)
  })

  it('both language: missing EN slug yields has_slug=false', () => {
    const result = computeValidationScore({
      ...baseInput,
      language: 'both',
      sections: {
        ...fullSections,
        draft_en: makeSection({ excerpt: 'Excerpt only' }),
      },
    })
    expect(result.breakdown.has_slug).toBe(false)
    expect(result.breakdown.has_excerpt).toBe(true)
  })

  it('both language: missing EN SEO yields has_seo=false', () => {
    const result = computeValidationScore({
      ...baseInput,
      language: 'both',
      sections: {
        draft_pt: fullSections.draft_pt,
        draft_en: fullSections.draft_en,
        seo_pt: fullSections.seo_pt,
        // seo_en missing
        images_shared: fullSections.images_shared,
      },
    })
    expect(result.breakdown.has_seo).toBe(false)
  })

  it('both language: score is lower when EN content is empty', () => {
    const fullScore = computeValidationScore({
      ...baseInput,
      language: 'both',
      sections: fullSections,
    })
    const partialScore = computeValidationScore({
      ...baseInput,
      language: 'both',
      sections: {
        draft_pt: fullSections.draft_pt,
        seo_pt: fullSections.seo_pt,
        images_shared: fullSections.images_shared,
        // EN sections completely missing
      },
    })
    expect(partialScore.overall).toBeLessThan(fullScore.overall)
    // Specifically: slug(5) + excerpt(5) + seo(5) = 15 points difference
    expect(fullScore.overall - partialScore.overall).toBe(15)
  })

  it('both language: has_title requires both titles', () => {
    const result = computeValidationScore({
      ...baseInput,
      title_en: null,  // missing EN title
      language: 'both',
      sections: fullSections,
    })
    expect(result.breakdown.has_title).toBe(false)
  })

  it('en language: has_title requires title_en', () => {
    const result = computeValidationScore({
      ...baseInput,
      title_pt: 'Título PT',
      title_en: null,
      language: 'en',
      sections: fullSections,
    })
    expect(result.breakdown.has_title).toBe(false)
  })

  it('pt-br language: has_title works with only title_pt', () => {
    const result = computeValidationScore({
      ...baseInput,
      title_pt: 'Título',
      title_en: null,
      language: 'pt-br',
      sections: fullSections,
    })
    expect(result.breakdown.has_title).toBe(true)
  })

  it('non-blog format: language has no effect on score', () => {
    const videoInput = {
      ...baseInput,
      format: 'video' as const,
      sections: undefined,
    }
    const scorePt = computeValidationScore({ ...videoInput, language: 'pt-br' })
    const scoreEn = computeValidationScore({ ...videoInput, language: 'en' })
    const scoreBoth = computeValidationScore({ ...videoInput, language: 'both' })
    expect(scorePt.overall).toBe(scoreEn.overall)
    expect(scoreEn.overall).toBe(scoreBoth.overall)
  })
})
