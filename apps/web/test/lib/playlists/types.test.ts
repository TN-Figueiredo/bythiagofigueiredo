import { describe, it, expect } from 'vitest'
import { CONTENT_TYPES, FILTER_LANGUAGES } from '@/lib/playlists/types'
import type { ContentType, FilterState, PlaylistItemEnriched } from '@/lib/playlists/types'

describe('playlist types', () => {
  it('CONTENT_TYPES includes video', () => {
    expect(CONTENT_TYPES).toContain('video')
  })

  it('CONTENT_TYPES has 4 entries', () => {
    expect(CONTENT_TYPES).toHaveLength(4)
    expect(CONTENT_TYPES).toEqual(['blog_post', 'newsletter', 'pipeline', 'video'])
  })

  it('FILTER_LANGUAGES is pt-br and en', () => {
    expect(FILTER_LANGUAGES).toEqual(['pt-br', 'en'])
  })

  it('ContentType union accepts video', () => {
    const ct: ContentType = 'video'
    expect(ct).toBe('video')
  })

  it('FilterState has correct shape', () => {
    const filter: FilterState = {
      types: new Set(['video', 'blog_post']),
      languages: new Set(['pt-br']),
      mode: 'dim',
      search: '',
    }
    expect(filter.types.has('video')).toBe(true)
    expect(filter.mode).toBe('dim')
  })

  it('PlaylistItemEnriched includes language field', () => {
    const item = {
      id: '1', playlist_id: '1', blog_post_id: null, newsletter_edition_id: null,
      pipeline_id: null, sort_order: 0, position_x: 0, position_y: 0, created_at: '',
      content_type: 'video' as ContentType, title: 'Test', status: null,
      category: null, metadata: null, is_ghost: false, other_playlist_count: 0,
      language: 'pt-br' as const,
    } satisfies PlaylistItemEnriched
    expect(item.language).toBe('pt-br')
  })
})
