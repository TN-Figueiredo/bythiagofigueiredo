import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveTemplates } from '@/lib/youtube/ab-templates'

describe('rotation dispatch logic', () => {
  describe('resolveTemplates in rotation context', () => {
    it('resolves multiple link templates with https:// prefix', () => {
      const rawDesc = '📩 Newsletter: {{link:newsletter}}\n🎓 Curso: {{link:curso}}'
      const linkMap = {
        newsletter: 'https://go.bythiagofigueiredo.com/AbCd123',
        curso: 'https://go.bythiagofigueiredo.com/XyZ456',
      }
      const resolved = resolveTemplates(rawDesc, linkMap)
      expect(resolved).toBe('📩 Newsletter: https://go.bythiagofigueiredo.com/AbCd123\n🎓 Curso: https://go.bythiagofigueiredo.com/XyZ456')
    })

    it('preserves unresolved templates (variant A uses original desc)', () => {
      const rawDesc = 'No templates here'
      const resolved = resolveTemplates(rawDesc, {})
      expect(resolved).toBe('No templates here')
    })
  })

  describe('updateVideoMetadata guard', () => {
    it('skips API call when both title and description are null', async () => {
      const mockFetch = vi.fn()
      vi.stubGlobal('fetch', mockFetch)

      const mod = await import('@/lib/youtube/ab-metadata')
      await mod.updateVideoMetadata('V1', null, null, 'TOKEN')

      expect(mockFetch).not.toHaveBeenCalled()
      vi.unstubAllGlobals()
    })

    it('still calls API when only title is provided', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [{ id: 'V1', snippet: { title: 'Old', description: 'D', categoryId: '22', tags: [] } }],
          }),
        })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      vi.stubGlobal('fetch', mockFetch)

      const mod = await import('@/lib/youtube/ab-metadata')
      await mod.updateVideoMetadata('V1', 'New Title', null, 'TOKEN')

      expect(mockFetch).toHaveBeenCalledTimes(2)
      vi.unstubAllGlobals()
    })
  })
})
