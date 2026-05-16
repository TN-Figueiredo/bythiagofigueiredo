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
    expect(score.overall).toBe(20 + Math.round(0.5 * 15)) // title(20) + checklist(7.5 rounded)
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
