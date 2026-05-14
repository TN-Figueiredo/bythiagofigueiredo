import { describe, it, expect } from 'vitest'
import { generateCsv, generateJson } from '@/app/cms/(authed)/playlists/[id]/_components/export-menu'
import type { PlaylistItemEnriched } from '@/lib/playlists/types'

function makeItem(overrides: Partial<PlaylistItemEnriched> & { id: string }): PlaylistItemEnriched {
  return {
    playlist_id: 'p1', blog_post_id: null, newsletter_edition_id: null,
    pipeline_id: null, sort_order: 0, position_x: 0, position_y: 0,
    created_at: '', content_type: 'blog_post', title: 'Test', status: null,
    category: null, metadata: null, is_ghost: false,
    other_playlist_count: 0, language: null,
    ...overrides,
  }
}

describe('generateCsv', () => {
  it('produces CSV with headers', () => {
    const items = [
      makeItem({ id: 'a', title: 'First Video', content_type: 'video', language: 'pt-br', status: 'published' }),
      makeItem({ id: 'b', title: 'Second Blog', content_type: 'blog_post', language: 'en', status: 'draft' }),
    ]
    const viewNumbers = new Map([['a', 1], ['b', 2]]) as Map<string, number | null>
    const csv = generateCsv(items, viewNumbers)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('#,type,language,status,title,category,metadata,uuid')
    expect(lines[1]).toContain('1,video,pt-br,published,First Video')
    expect(lines[2]).toContain('2,blog_post,en,draft,Second Blog')
  })

  it('skips items with null view number', () => {
    const items = [
      makeItem({ id: 'a', title: 'Match' }),
      makeItem({ id: 'b', title: 'Skip' }),
    ]
    const viewNumbers = new Map([['a', 1], ['b', null]]) as Map<string, number | null>
    const csv = generateCsv(items, viewNumbers)
    expect(csv).not.toContain('Skip')
  })
})

describe('generateJson', () => {
  it('produces correct JSON structure', () => {
    const items = [
      makeItem({ id: 'a', title: 'First', content_type: 'video', language: 'pt-br', status: 'published' }),
    ]
    const viewNumbers = new Map([['a', 1]]) as Map<string, number | null>
    const json = generateJson(items, viewNumbers, 'Test Playlist', 'Video — PT-BR')
    const parsed = JSON.parse(json)
    expect(parsed.playlist).toBe('Test Playlist')
    expect(parsed.filter).toBe('Video — PT-BR')
    expect(parsed.items).toHaveLength(1)
    expect(parsed.items[0].order).toBe(1)
    expect(parsed.items[0].type).toBe('video')
  })
})
