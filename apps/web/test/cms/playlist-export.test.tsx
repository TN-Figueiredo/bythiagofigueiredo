import { describe, it, expect } from 'vitest'
import { generateCsv, generateJson } from '@/app/cms/(authed)/playlists/[id]/_components/export-menu'
import type { PlaylistItemEnriched } from '@/lib/playlists/types'

function makeItem(overrides: Partial<PlaylistItemEnriched> & { id: string }): PlaylistItemEnriched {
  return {
    playlist_id: 'p1', blog_post_id: null, newsletter_edition_id: null,
    pipeline_id: null, sort_order: 0, position_x: 0, position_y: 0,
    created_at: '', content_type: 'blog_post', title: 'Test', status: null,
    category: null, metadata: null, is_ghost: false,
    other_playlist_count: 0, language: null, tags: [], hook: null, synopsis: null,
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
    expect(lines[0]).toBe('order,type,language,status,title,tags,uuid')
    expect(lines[1]).toBe('1,video,pt-br,published,First Video,,a')
    expect(lines[2]).toBe('2,blog_post,en,draft,Second Blog,,b')
  })

  it('includes tags separated by semicolons', () => {
    const items = [
      makeItem({ id: 'a', title: 'Tagged', tags: ['travel', 'asia'] }),
    ]
    const viewNumbers = new Map([['a', 1]]) as Map<string, number | null>
    const csv = generateCsv(items, viewNumbers)
    expect(csv).toContain('travel; asia')
  })

  it('escapes titles with commas, quotes and newlines', () => {
    const items = [
      makeItem({ id: 'a', title: 'He said "hello, world"' }),
      makeItem({ id: 'b', title: 'Line1\nLine2' }),
    ]
    const viewNumbers = new Map([['a', 1], ['b', 2]]) as Map<string, number | null>
    const csv = generateCsv(items, viewNumbers)
    const lines = csv.split('\n')
    expect(lines[1]).toContain('"He said ""hello, world"""')
    expect(csv).toContain('"Line1\nLine2"')
  })

  it('sorts items by view number regardless of input order', () => {
    const items = [
      makeItem({ id: 'b', title: 'Second' }),
      makeItem({ id: 'a', title: 'First' }),
    ]
    const viewNumbers = new Map([['a', 1], ['b', 2]]) as Map<string, number | null>
    const csv = generateCsv(items, viewNumbers)
    const lines = csv.split('\n')
    expect(lines[1]).toContain('1,')
    expect(lines[1]).toContain('First')
    expect(lines[2]).toContain('2,')
    expect(lines[2]).toContain('Second')
  })

  it('returns header only for empty items', () => {
    const csv = generateCsv([], new Map())
    expect(csv).toBe('order,type,language,status,title,tags,uuid')
  })

  it('handles undefined tags without throwing', () => {
    const items = [
      makeItem({ id: 'a', title: 'No Tags', tags: undefined as unknown as string[] }),
    ]
    const viewNumbers = new Map([['a', 1]]) as Map<string, number | null>
    expect(() => generateCsv(items, viewNumbers)).not.toThrow()
    const csv = generateCsv(items, viewNumbers)
    expect(csv).toContain('No Tags,,a')
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
    expect(parsed.items[0].tags).toEqual([])
    expect(parsed.items[0]).not.toHaveProperty('category')
  })

  it('sorts items by view number', () => {
    const items = [
      makeItem({ id: 'b', title: 'Second' }),
      makeItem({ id: 'a', title: 'First' }),
    ]
    const viewNumbers = new Map([['a', 1], ['b', 2]]) as Map<string, number | null>
    const json = generateJson(items, viewNumbers, 'P', '')
    const parsed = JSON.parse(json)
    expect(parsed.items[0].title).toBe('First')
    expect(parsed.items[1].title).toBe('Second')
  })

  it('includes tags array in JSON output', () => {
    const items = [
      makeItem({ id: 'a', title: 'Tagged', tags: ['travel', 'asia'] }),
    ]
    const viewNumbers = new Map([['a', 1]]) as Map<string, number | null>
    const json = generateJson(items, viewNumbers, 'P', '')
    const parsed = JSON.parse(json)
    expect(parsed.items[0].tags).toEqual(['travel', 'asia'])
  })
})
