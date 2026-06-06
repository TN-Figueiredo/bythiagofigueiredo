import { describe, it, expect } from 'vitest'
import {
  RESEARCH_STATUS,
  ResearchItemCreateSchema,
  ResearchItemUpdateSchema,
  ResearchImportSchema,
  ResearchTopicCreateSchema,
  ResearchTopicUpdateSchema,
  ResearchLinkSchema,
} from '@/lib/pipeline/research-schemas'

describe('research-schemas', () => {
  describe('RESEARCH_STATUS', () => {
    it('has exactly 4 statuses', () => {
      expect(RESEARCH_STATUS).toEqual(['fresca', 'analise', 'aplicada', 'arquivada'])
    })
  })

  describe('ResearchItemCreateSchema', () => {
    it('accepts valid minimal input', () => {
      const result = ResearchItemCreateSchema.safeParse({
        title: 'WYD Ongame Era',
        topic_slug: 'gaming-history/wyd',
        content_md: '# WYD Research\n\nContent here.',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sources).toEqual([])
      }
    })

    it('accepts full input with sources', () => {
      const result = ResearchItemCreateSchema.safeParse({
        title: 'WYD Ongame Era',
        topic_slug: 'gaming-history/wyd',
        content_md: '# Research',
        summary: 'Short summary',
        sources: [
          { url: 'https://example.com/article', title: 'Example Article', accessed_at: '2026-05-14T00:00:00Z' },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty title', () => {
      const result = ResearchItemCreateSchema.safeParse({
        title: '',
        topic_slug: 'test',
        content_md: 'content',
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty content_md', () => {
      const result = ResearchItemCreateSchema.safeParse({
        title: 'Test',
        topic_slug: 'test',
        content_md: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects title over 500 chars', () => {
      const result = ResearchItemCreateSchema.safeParse({
        title: 'x'.repeat(501),
        topic_slug: 'test',
        content_md: 'content',
      })
      expect(result.success).toBe(false)
    })

    it('rejects more than 50 sources', () => {
      const sources = Array.from({ length: 51 }, (_, i) => ({
        url: `https://example.com/${i}`,
        title: `Source ${i}`,
      }))
      const result = ResearchItemCreateSchema.safeParse({
        title: 'Test',
        topic_slug: 'test',
        content_md: 'content',
        sources,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ResearchItemUpdateSchema', () => {
    it('accepts partial update', () => {
      const result = ResearchItemUpdateSchema.safeParse({
        title: 'Updated title',
        status: 'aplicada',
      })
      expect(result.success).toBe(true)
    })

    it('accepts empty object', () => {
      const result = ResearchItemUpdateSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('rejects content_json + content_md together', () => {
      const result = ResearchItemUpdateSchema.safeParse({
        content_json: { type: 'doc', content: [] },
        content_md: 'text',
      })
      expect(result.success).toBe(false)
    })

    it('accepts content_json alone', () => {
      const result = ResearchItemUpdateSchema.safeParse({
        content_json: { type: 'doc', content: [] },
      })
      expect(result.success).toBe(true)
    })

    it('accepts content_md alone', () => {
      const result = ResearchItemUpdateSchema.safeParse({
        content_md: 'updated markdown',
      })
      expect(result.success).toBe(true)
    })

    it('allows nullable summary', () => {
      const result = ResearchItemUpdateSchema.safeParse({ summary: null })
      expect(result.success).toBe(true)
    })

    it('rejects invalid status', () => {
      const result = ResearchItemUpdateSchema.safeParse({ status: 'draft' })
      expect(result.success).toBe(false)
    })
  })

  describe('ResearchImportSchema', () => {
    it('accepts array of 1-50 items', () => {
      const result = ResearchImportSchema.safeParse({
        items: [{ title: 'A', topic_slug: 'test', content_md: 'content' }],
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty array', () => {
      const result = ResearchImportSchema.safeParse({ items: [] })
      expect(result.success).toBe(false)
    })

    it('rejects more than 50 items', () => {
      const items = Array.from({ length: 51 }, (_, i) => ({
        title: `Item ${i}`,
        topic_slug: 'test',
        content_md: 'content',
      }))
      const result = ResearchImportSchema.safeParse({ items })
      expect(result.success).toBe(false)
    })
  })

  describe('ResearchTopicCreateSchema', () => {
    it('accepts valid topic', () => {
      const result = ResearchTopicCreateSchema.safeParse({
        name: 'Gaming History',
        slug: 'gaming-history',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.color).toBe('#a78bfa')
        expect(result.data.icon).toBe('📁')
      }
    })

    it('rejects invalid slug characters', () => {
      const result = ResearchTopicCreateSchema.safeParse({
        name: 'Test',
        slug: 'UPPER_CASE',
      })
      expect(result.success).toBe(false)
    })

    it('accepts slug with numbers and hyphens', () => {
      const result = ResearchTopicCreateSchema.safeParse({
        name: 'AI Dev 101',
        slug: 'ai-dev-101',
      })
      expect(result.success).toBe(true)
    })

    it('rejects hex color without hash', () => {
      const result = ResearchTopicCreateSchema.safeParse({
        name: 'Test',
        slug: 'test',
        color: 'a78bfa',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ResearchTopicUpdateSchema', () => {
    it('accepts partial update', () => {
      const result = ResearchTopicUpdateSchema.safeParse({
        name: 'Updated Name',
        color: '#ff0000',
      })
      expect(result.success).toBe(true)
    })

    it('accepts sort_order change', () => {
      const result = ResearchTopicUpdateSchema.safeParse({
        sort_order: 3,
      })
      expect(result.success).toBe(true)
    })

    it('strips unknown fields', () => {
      const result = ResearchTopicUpdateSchema.safeParse({
        slug: 'new-slug',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(Object.keys(result.data)).not.toContain('slug')
      }
    })
  })

  describe('ResearchLinkSchema', () => {
    it('accepts valid link', () => {
      const result = ResearchLinkSchema.safeParse({
        pipeline_item_id: '123e4567-e89b-12d3-a456-426614174000',
      })
      expect(result.success).toBe(true)
    })

    it('accepts link with note', () => {
      const result = ResearchLinkSchema.safeParse({
        pipeline_item_id: '123e4567-e89b-12d3-a456-426614174000',
        note: 'Source for intro section',
      })
      expect(result.success).toBe(true)
    })

    it('rejects note over 500 chars', () => {
      const result = ResearchLinkSchema.safeParse({
        pipeline_item_id: '123e4567-e89b-12d3-a456-426614174000',
        note: 'x'.repeat(501),
      })
      expect(result.success).toBe(false)
    })
  })
})
