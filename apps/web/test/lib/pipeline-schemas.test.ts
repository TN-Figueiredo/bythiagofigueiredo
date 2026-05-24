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
  ReferenceContentUpsertSchema,
  BulkOperationSchema,
  GraduateSchema,
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

describe('CourseMetadataSchema', () => {
  it('accepts minimal empty object', () => {
    expect(CourseMetadataSchema.safeParse({}).success).toBe(true)
  })

  it('accepts full product metadata', () => {
    const result = CourseMetadataSchema.safeParse({
      module_count: 3,
      platform: 'hotmart',
      product_type: 'course',
      tier: 'core',
      pricing_model: 'one_time',
      price_cents: 29700,
      currency: 'BRL',
      funnel_stage: 'bofu',
      topic_clusters: ['ai-fundamentals'],
      launch_type: 'seed',
      difficulty: 'beginner',
    })
    expect(result.success).toBe(true)
  })

  it('accepts upsell/downsell refs', () => {
    const result = CourseMetadataSchema.safeParse({
      upsell_ref: '550e8400-e29b-41d4-a716-446655440000',
      downsell_ref: '550e8400-e29b-41d4-a716-446655440001',
      prerequisite_courses: ['550e8400-e29b-41d4-a716-446655440002'],
    })
    expect(result.success).toBe(true)
  })

  it('accepts playlist_id for graduation', () => {
    const result = CourseMetadataSchema.safeParse({
      playlist_id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown fields (strict)', () => {
    const result = CourseMetadataSchema.safeParse({ bogus_field: 'x' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid tier', () => {
    const result = CourseMetadataSchema.safeParse({ tier: 'mega' })
    expect(result.success).toBe(false)
  })
})

describe('GraduateSchema', () => {
  it('accepts course target', () => {
    const result = GraduateSchema.safeParse({ target: 'course' })
    expect(result.success).toBe(true)
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
