import { describe, it, expect } from 'vitest'

import { buildPlaylistPrompt } from '@/lib/playlists/prompt-builder'
import type {
  PlaylistPromptInput,
  ReuseCandidateItem,
} from '@/lib/playlists/prompt-builder'
import type {
  PlaylistRow,
  PlaylistItemEnriched,
  PlaylistEdgeRow,
} from '@/lib/playlists/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const basePlaylist: PlaylistRow = {
  id: 'pl-001',
  site_id: 'site-001',
  name_pt: 'Minha Playlist',
  name_en: 'My Playlist',
  slug: 'my-playlist',
  description_pt: null,
  description_en: null,
  cover_image_url: null,
  status: 'draft',
  category: 'series',
  viewport_state: null,
  notes: null,
  created_by: 'user-001',
  created_at: '2026-05-22T00:00:00Z',
  updated_at: '2026-05-22T00:00:00Z',
}

function makeItem(overrides: Partial<PlaylistItemEnriched> = {}): PlaylistItemEnriched {
  return {
    id: 'item-001',
    playlist_id: 'pl-001',
    blog_post_id: null,
    newsletter_edition_id: null,
    pipeline_id: 'pip-001',
    sort_order: 0,
    position_x: 0,
    position_y: 0,
    created_at: '2026-05-22T00:00:00Z',
    content_type: 'pipeline',
    title: 'How to Record Pro Audio',
    status: 'draft',
    category: 'video',
    metadata: null,
    is_ghost: false,
    other_playlist_count: 0,
    language: 'en',
    tags: [],
    hook: null,
    synopsis: null,
    ...overrides,
  }
}

const baseEdge: PlaylistEdgeRow = {
  id: 'edge-001',
  playlist_id: 'pl-001',
  source_item_id: 'item-001',
  target_item_id: 'item-002',
  edge_type: 'sequence',
  label: null,
  created_at: '2026-05-22T00:00:00Z',
}

const baseReuse: ReuseCandidateItem = {
  id: 'reuse-001',
  title: 'Existing Pipeline Item',
  format: 'video',
  language: 'en',
  stage: 'published',
  tags: ['audio', 'production'],
}

function makeInput(overrides: Partial<PlaylistPromptInput> = {}): PlaylistPromptInput {
  return {
    playlist: basePlaylist,
    items: [makeItem()],
    edges: [baseEdge],
    focusedItemIds: [],
    reuseCandidates: [],
    userInstructions: '',
    ...overrides,
  }
}

function tiptapDoc(text: string): Record<string, unknown> {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  }
}

function longTiptapDoc(wordCount: number): Record<string, unknown> {
  const words = Array.from({ length: wordCount }, (_, i) => `word${i}`)
  return tiptapDoc(words.join(' '))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildPlaylistPrompt', () => {
  it('generates header with playlist name and stats', () => {
    const items = [makeItem(), makeItem({ id: 'item-002', title: 'Second Item', sort_order: 1 })]
    const edges = [baseEdge]
    const result = buildPlaylistPrompt(makeInput({ items, edges }))

    expect(result.text).toContain('# Playlist: My Playlist')
    expect(result.text).toContain('Status: draft')
    expect(result.text).toContain('Items: 2')
    expect(result.text).toContain('Edges: 1')
  })

  it('omits notes section when notes is null', () => {
    const result = buildPlaylistPrompt(
      makeInput({ playlist: { ...basePlaylist, notes: null } }),
    )
    expect(result.text).not.toContain('Notas & Decisões')
  })

  it('includes notes section when notes exist', () => {
    const playlist = {
      ...basePlaylist,
      notes: tiptapDoc('Decisão importante sobre o formato do curso'),
    }
    const result = buildPlaylistPrompt(makeInput({ playlist }))

    expect(result.text).toContain('Notas & Decisões')
    expect(result.text).toContain('Decisão importante sobre o formato do curso')
  })

  it('truncates notes over 1500 words', () => {
    const playlist = { ...basePlaylist, notes: longTiptapDoc(2000) }
    const result = buildPlaylistPrompt(makeInput({ playlist }))

    expect(result.text).toContain('(truncado)')
    expect(result.text).not.toContain('word1999')
    expect(result.text).toContain('word0')
  })

  it('omits focused items section when no items selected', () => {
    const result = buildPlaylistPrompt(makeInput({ focusedItemIds: [] }))
    expect(result.text).not.toContain('Items em Foco')
  })

  it('includes focused items when selectedItemIds provided', () => {
    const items = [
      makeItem({ id: 'item-A', title: 'Alpha Video' }),
      makeItem({ id: 'item-B', title: 'Beta Article', sort_order: 1 }),
    ]
    const result = buildPlaylistPrompt(
      makeInput({ items, focusedItemIds: ['item-A', 'item-B'] }),
    )

    expect(result.text).toContain('Items em Foco')
    expect(result.text).toContain('Alpha Video')
    expect(result.text).toContain('Beta Article')
  })

  it('includes tags, hook, and synopsis in focused items when available', () => {
    const items = [
      makeItem({
        id: 'item-A',
        title: 'Pro Audio Guide',
        tags: ['audio', 'production'],
        hook: 'Master your audio setup',
        synopsis: 'A deep dive into professional audio recording techniques',
      }),
    ]
    const result = buildPlaylistPrompt(
      makeInput({ items, focusedItemIds: ['item-A'] }),
    )

    expect(result.text).toContain('Tags: audio, production')
    expect(result.text).toContain('Hook: Master your audio setup')
    expect(result.text).toContain('Synopsis: A deep dive into professional audio recording techniques')
  })

  it('counts TBD items correctly', () => {
    const items = [
      makeItem({ id: 'i1', title: 'TBD', sort_order: 0 }),
      makeItem({ id: 'i2', title: 'tbd', sort_order: 1 }),
      makeItem({ id: 'i3', title: 'TBD something', sort_order: 2 }),
      makeItem({ id: 'i4', title: 'TBDX', sort_order: 3 }),
      makeItem({ id: 'i5', title: 'Real Title', sort_order: 4 }),
    ]
    const result = buildPlaylistPrompt(makeInput({ items }))

    expect(result.tbdCount).toBe(3)
  })

  it('marks ghost items in graph section', () => {
    const items = [
      makeItem({ id: 'ghost-1', title: 'Deleted Reference', is_ghost: true }),
    ]
    const result = buildPlaylistPrompt(makeInput({ items, edges: [] }))

    expect(result.text).toContain('GHOST')
    expect(result.text).toContain('Deleted Reference')
  })

  it('includes reuse candidates when provided', () => {
    const reuseCandidates = [
      { ...baseReuse, id: 'r1', title: 'Reusable Audio Guide' },
      { ...baseReuse, id: 'r2', title: 'Existing Video Course' },
    ]
    const result = buildPlaylistPrompt(makeInput({ reuseCandidates }))

    expect(result.text).toContain('Candidatos para Reuso')
    expect(result.text).toContain('Reusable Audio Guide')
    expect(result.text).toContain('Existing Video Course')
  })

  it('shows inline note when no reuse candidates', () => {
    const result = buildPlaylistPrompt(makeInput({ reuseCandidates: [] }))
    expect(result.text).toContain('Nenhum candidato')
  })

  it('includes user instructions in output', () => {
    const result = buildPlaylistPrompt(
      makeInput({ userInstructions: 'Foque em vídeos curtos de 3 minutos' }),
    )
    expect(result.text).toContain('Foque em vídeos curtos de 3 minutos')
    expect(result.text).toContain('Instruções do Produtor')
  })

  it('returns correct wordCount and tbdCount', () => {
    const items = [
      makeItem({ id: 'i1', title: 'TBD', sort_order: 0 }),
      makeItem({ id: 'i2', title: 'Real Item', sort_order: 1 }),
    ]
    const result = buildPlaylistPrompt(makeInput({ items, edges: [] }))

    const manualCount = result.text.split(/\s+/).filter(Boolean).length
    expect(result.wordCount).toBe(manualCount)
    expect(result.tbdCount).toBe(1)
  })
})
