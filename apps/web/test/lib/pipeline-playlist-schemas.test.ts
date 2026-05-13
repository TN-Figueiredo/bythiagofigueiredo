import { describe, it, expect } from 'vitest'
import {
  PipelineCreatePlaylistSchema,
  PipelineUpdatePlaylistSchema,
  PipelineAddItemSchema,
  PipelineBulkAddItemsSchema,
  PipelineCreateEdgeSchema,
  PipelineBulkCreateEdgesSchema,
  PipelineReorderSchema,
} from '@/lib/pipeline/schemas'

describe('PipelineCreatePlaylistSchema', () => {
  it('validates minimal playlist (name_en only)', () => {
    const result = PipelineCreatePlaylistSchema.safeParse({ name_en: 'My Playlist' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name_pt).toBe('')
      expect(result.data.status).toBe('draft')
    }
  })

  it('validates full playlist', () => {
    const result = PipelineCreatePlaylistSchema.safeParse({
      name_en: 'Getting Started',
      name_pt: 'Começando',
      description_en: 'A series',
      description_pt: 'Uma série',
      category: 'typescript',
      status: 'published',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name_en', () => {
    const result = PipelineCreatePlaylistSchema.safeParse({ name_en: '' })
    expect(result.success).toBe(false)
  })

  it('rejects name_en over 200 chars', () => {
    const result = PipelineCreatePlaylistSchema.safeParse({ name_en: 'x'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status', () => {
    const result = PipelineCreatePlaylistSchema.safeParse({ name_en: 'Test', status: 'live' })
    expect(result.success).toBe(false)
  })
})

describe('PipelineUpdatePlaylistSchema', () => {
  it('accepts empty object (all optional)', () => {
    const result = PipelineUpdatePlaylistSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts partial update', () => {
    const result = PipelineUpdatePlaylistSchema.safeParse({ name_en: 'Updated', status: 'archived' })
    expect(result.success).toBe(true)
  })

  it('accepts nullable fields', () => {
    const result = PipelineUpdatePlaylistSchema.safeParse({
      description_en: null,
      category: null,
      cover_image_url: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid cover_image_url', () => {
    const result = PipelineUpdatePlaylistSchema.safeParse({ cover_image_url: 'not-a-url' })
    expect(result.success).toBe(false)
  })
})

describe('PipelineAddItemSchema', () => {
  it('accepts blog_post_id', () => {
    const result = PipelineAddItemSchema.safeParse({
      blog_post_id: '00000000-0000-0000-0000-000000000001',
    })
    expect(result.success).toBe(true)
  })

  it('accepts newsletter_edition_id with position', () => {
    const result = PipelineAddItemSchema.safeParse({
      newsletter_edition_id: '00000000-0000-0000-0000-000000000001',
      sort_order: 2000,
      position_x: 100,
      position_y: 200,
    })
    expect(result.success).toBe(true)
  })

  it('rejects zero content references', () => {
    const result = PipelineAddItemSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects multiple content references', () => {
    const result = PipelineAddItemSchema.safeParse({
      blog_post_id: '00000000-0000-0000-0000-000000000001',
      pipeline_id: '00000000-0000-0000-0000-000000000002',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-uuid content reference', () => {
    const result = PipelineAddItemSchema.safeParse({ blog_post_id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('PipelineBulkAddItemsSchema', () => {
  it('accepts 1-50 items', () => {
    const result = PipelineBulkAddItemsSchema.safeParse({
      items: [{ blog_post_id: '00000000-0000-0000-0000-000000000001' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty items array', () => {
    const result = PipelineBulkAddItemsSchema.safeParse({ items: [] })
    expect(result.success).toBe(false)
  })

  it('rejects over 50 items', () => {
    const items = Array.from({ length: 51 }, (_, i) => ({
      blog_post_id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
    }))
    const result = PipelineBulkAddItemsSchema.safeParse({ items })
    expect(result.success).toBe(false)
  })
})

describe('PipelineCreateEdgeSchema', () => {
  it('validates a sequence edge', () => {
    const result = PipelineCreateEdgeSchema.safeParse({
      source_item_id: '00000000-0000-0000-0000-000000000001',
      target_item_id: '00000000-0000-0000-0000-000000000002',
      edge_type: 'sequence',
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional label', () => {
    const result = PipelineCreateEdgeSchema.safeParse({
      source_item_id: '00000000-0000-0000-0000-000000000001',
      target_item_id: '00000000-0000-0000-0000-000000000002',
      edge_type: 'related',
      label: 'See also',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid edge_type', () => {
    const result = PipelineCreateEdgeSchema.safeParse({
      source_item_id: '00000000-0000-0000-0000-000000000001',
      target_item_id: '00000000-0000-0000-0000-000000000002',
      edge_type: 'depends_on',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing source_item_id', () => {
    const result = PipelineCreateEdgeSchema.safeParse({
      target_item_id: '00000000-0000-0000-0000-000000000002',
      edge_type: 'sequence',
    })
    expect(result.success).toBe(false)
  })
})

describe('PipelineBulkCreateEdgesSchema', () => {
  it('accepts 1-100 edges', () => {
    const result = PipelineBulkCreateEdgesSchema.safeParse({
      edges: [{
        source_item_id: '00000000-0000-0000-0000-000000000001',
        target_item_id: '00000000-0000-0000-0000-000000000002',
        edge_type: 'sequence',
      }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty edges array', () => {
    const result = PipelineBulkCreateEdgesSchema.safeParse({ edges: [] })
    expect(result.success).toBe(false)
  })

  it('rejects over 100 edges', () => {
    const edges = Array.from({ length: 101 }, (_, i) => ({
      source_item_id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      target_item_id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
      edge_type: 'sequence' as const,
    }))
    const result = PipelineBulkCreateEdgesSchema.safeParse({ edges })
    expect(result.success).toBe(false)
  })
})

describe('PipelineReorderSchema', () => {
  it('accepts array of UUIDs', () => {
    const result = PipelineReorderSchema.safeParse({
      item_ids: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty array', () => {
    const result = PipelineReorderSchema.safeParse({ item_ids: [] })
    expect(result.success).toBe(false)
  })

  it('rejects non-uuid strings', () => {
    const result = PipelineReorderSchema.safeParse({ item_ids: ['abc'] })
    expect(result.success).toBe(false)
  })
})
