// apps/web/test/lib/pipeline-schemas.test.ts
import { describe, it, expect } from 'vitest'
import {
  PipelineItemCreateSchema,
  PipelineItemUpdateSchema,
  VideoMetadataSchema,
  BlogPostMetadataSchema,
  NewsletterMetadataSchema,
  CourseMetadataSchema,
  CampaignMetadataSchema,
  CollectionCreateSchema,
  ReferenceContentUpsertSchema,
  BulkOperationSchema,
} from '@/lib/pipeline/schemas'
import { getNextStage, getPreviousStage, isFinalStage, isFirstStage, generateCode } from '@/lib/pipeline/workflows'

describe('PipelineItemCreateSchema', () => {
  it('validates a minimal video item', () => {
    const result = PipelineItemCreateSchema.safeParse({
      title_pt: 'Meu vídeo',
      format: 'video',
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown format', () => {
    const result = PipelineItemCreateSchema.safeParse({
      title_pt: 'X',
      format: 'podcast',
    })
    expect(result.success).toBe(false)
  })

  it('rejects priority out of range', () => {
    const result = PipelineItemCreateSchema.safeParse({
      title_pt: 'X',
      format: 'video',
      priority: 10,
    })
    expect(result.success).toBe(false)
  })

  it('accepts bilingual item', () => {
    const result = PipelineItemCreateSchema.safeParse({
      title_pt: 'Título PT',
      title_en: 'Title EN',
      format: 'blog_post',
      language: 'both',
      tags: ['ai', 'tools'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects item with no title', () => {
    const result = PipelineItemCreateSchema.safeParse({ format: 'video' })
    expect(result.success).toBe(false)
  })

  it('accepts item with title_en only', () => {
    const result = PipelineItemCreateSchema.safeParse({ format: 'blog_post', title_en: 'English Only' })
    expect(result.success).toBe(true)
  })
})

describe('VideoMetadataSchema', () => {
  it('validates complete video metadata', () => {
    const result = VideoMetadataSchema.safeParse({
      playlist_letter: 'G',
      episode_number: 14,
      duration_estimate_min: 12,
    })
    expect(result.success).toBe(true)
  })

  it('allows empty object', () => {
    expect(VideoMetadataSchema.safeParse({}).success).toBe(true)
  })

  it('rejects unknown keys (strict)', () => {
    expect(VideoMetadataSchema.safeParse({ unknown_field: 'x' }).success).toBe(false)
  })
})

describe('CollectionCreateSchema', () => {
  it('validates a launch collection', () => {
    const result = CollectionCreateSchema.safeParse({
      code: 'q2-launch',
      name: 'Q2 Launch',
      type: 'launch',
      metadata: { target_date: '2026-06-01', description: 'Ship it' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid type', () => {
    const result = CollectionCreateSchema.safeParse({
      code: 'x',
      name: 'X',
      type: 'invalid',
    })
    expect(result.success).toBe(false)
  })
})

describe('ReferenceContentUpsertSchema', () => {
  it('validates markdown reference', () => {
    const result = ReferenceContentUpsertSchema.safeParse({
      title: 'Audience Profile',
      content_md: '# Profile\n\nTech founders aged 25-40',
    })
    expect(result.success).toBe(true)
  })

  it('validates compact JSON reference', () => {
    const result = ReferenceContentUpsertSchema.safeParse({
      title: 'Guidelines',
      content_compact: { tone: 'casual', length: 'medium' },
    })
    expect(result.success).toBe(true)
  })
})

describe('BulkOperationSchema', () => {
  it('validates advance op', () => {
    const result = BulkOperationSchema.safeParse({
      operations: [{ op: 'advance', id: '00000000-0000-0000-0000-000000000001' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects >50 operations', () => {
    const ops = Array.from({ length: 51 }, (_, i) => ({
      op: 'advance' as const,
      id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
    }))
    const result = BulkOperationSchema.safeParse({ operations: ops })
    expect(result.success).toBe(false)
  })
})

describe('Workflow helpers', () => {
  it('video: idea -> roteiro', () => {
    expect(getNextStage('video', 'idea')).toBe('roteiro')
  })

  it('video: published -> null (final)', () => {
    expect(getNextStage('video', 'published')).toBeNull()
  })

  it('video: idea has no previous', () => {
    expect(getPreviousStage('video', 'idea')).toBeNull()
  })

  it('video: roteiro -> idea (retreat)', () => {
    expect(getPreviousStage('video', 'roteiro')).toBe('idea')
  })

  it('blog_post: draft -> ready', () => {
    expect(getNextStage('blog_post', 'draft')).toBe('ready')
  })

  it('isFinalStage works', () => {
    expect(isFinalStage('video', 'published')).toBe(true)
    expect(isFinalStage('video', 'edicao')).toBe(false)
    expect(isFinalStage('campaign', 'sent')).toBe(true)
  })

  it('isFirstStage works', () => {
    expect(isFirstStage('video', 'idea')).toBe(true)
    expect(isFirstStage('video', 'roteiro')).toBe(false)
  })

  it('generateCode for video with metadata', () => {
    const code = generateCode('video', 'AI Agents and Tools', { playlist_letter: 'G', episode_number: 14 })
    expect(code).toBe('G14-ai-agents-and-tools')
  })

  it('generateCode for video without metadata', () => {
    const code = generateCode('video', 'Some Video Title')
    expect(code).toBe('vid-some-video-title')
  })

  it('generateCode for blog_post', () => {
    const code = generateCode('blog_post', 'Building a CMS')
    expect(code).toBe('blog-building-a-cms')
  })

  it('generateCode strips diacritics', () => {
    const code = generateCode('newsletter', 'Edição Especial')
    expect(code).toBe('nl-edicao-especial')
  })
})
