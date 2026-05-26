import { describe, it, expect } from 'vitest'
import { selectSuggestion } from '../../src/lib/pipeline/select-suggestion'
import type { PipelineItemWithSlot, PlaylistSummary, NewsletterEditionRow } from '../../src/lib/pipeline/up-next-types'

function makePipelineItem(overrides: Partial<PipelineItemWithSlot>): PipelineItemWithSlot {
  return {
    id: 'item-1',
    title: 'Test Item',
    stage: 'idea',
    priority: 1,
    format: 'video',
    language: 'pt-br',
    duration_target: null,
    scheduled_at: null,
    youtube_channel_id: 'ch1',
    playlist_id: null,
    playlist_name: null,
    playlist_position: null,
    playlist_total: null,
    channel_label: 'Channel',
    ...overrides,
  }
}

function makePlaylist(overrides: Partial<PlaylistSummary>): PlaylistSummary {
  return {
    id: 'pl-1',
    name: 'My Playlist',
    total_items: 10,
    done_items: 8,
    in_progress_items: 1,
    next_item_title: null,
    next_item_stage: null,
    ...overrides,
  }
}

function makeNewsletter(overrides: Partial<NewsletterEditionRow>): NewsletterEditionRow {
  return {
    id: 'nl-1',
    subject: 'Test Newsletter',
    status: 'draft',
    scheduled_at: null,
    ...overrides,
  }
}

describe('selectSuggestion', () => {
  it('returns null when no conditions match', () => {
    const result = selectSuggestion({
      pipelineItems: [],
      playlists: [],
      newsletterEditions: [],
    })
    expect(result).toBeNull()
  })

  it('suggests batch opportunity when 2+ active items at same stage', () => {
    const items = [
      makePipelineItem({ id: 'item-1', stage: 'idea' }),
      makePipelineItem({ id: 'item-2', stage: 'idea' }),
      makePipelineItem({ id: 'item-3', stage: 'idea' }),
    ]
    const result = selectSuggestion({
      pipelineItems: items,
      playlists: [],
      newsletterEditions: [],
    })
    expect(result).not.toBeNull()
    expect(result!.text).toContain('Bloco de idea')
    expect(result!.text).toContain('3 itens')
    expect(result!.href).toBe('/cms/pipeline?stage=idea')
  })

  it('suggests orphaned items for video format without channel', () => {
    const items = [
      makePipelineItem({ id: 'item-1', format: 'video', youtube_channel_id: null, stage: 'idea' }),
      makePipelineItem({ id: 'item-2', format: 'video', youtube_channel_id: null, stage: 'draft' }),
    ]
    const result = selectSuggestion({
      pipelineItems: items,
      playlists: [],
      newsletterEditions: [],
    })
    expect(result).not.toBeNull()
    expect(result!.text).toContain('2 item(s) sem canal configurado')
    expect(result!.href).toBe('/cms/pipeline?filter=orphaned')
  })

  it('does NOT suggest orphaned for blog_post format', () => {
    const items = [
      makePipelineItem({ id: 'item-1', format: 'blog_post', youtube_channel_id: null, stage: 'idea' }),
    ]
    const result = selectSuggestion({
      pipelineItems: items,
      playlists: [],
      newsletterEditions: [],
    })
    expect(result).toBeNull()
  })

  it('suggests newsletter without scheduled_at', () => {
    const editions = [
      makeNewsletter({ status: 'ready', scheduled_at: null }),
    ]
    const result = selectSuggestion({
      pipelineItems: [],
      playlists: [],
      newsletterEditions: editions,
    })
    expect(result).not.toBeNull()
    expect(result!.text).toBe('Newsletter sem data de envio.')
    expect(result!.href).toBe('/cms/newsletters')
  })

  it('suggests playlist near completion', () => {
    const playlists = [
      makePlaylist({ id: 'pl-1', name: 'My Playlist', total_items: 10, done_items: 9 }),
    ]
    const result = selectSuggestion({
      pipelineItems: [],
      playlists,
      newsletterEditions: [],
    })
    expect(result).not.toBeNull()
    expect(result!.text).toContain('My Playlist')
    expect(result!.text).toContain('1 item(s)')
    expect(result!.href).toBe('/cms/playlists/pl-1')
  })

  it('respects priority order: batch > orphan > newsletter > playlist', () => {
    const items = [
      makePipelineItem({ id: 'item-1', stage: 'idea', format: 'video', youtube_channel_id: null }),
      makePipelineItem({ id: 'item-2', stage: 'idea', format: 'video', youtube_channel_id: null }),
    ]
    const editions = [makeNewsletter({ status: 'draft', scheduled_at: null })]
    const playlists = [makePlaylist({ total_items: 10, done_items: 9 })]

    const result = selectSuggestion({
      pipelineItems: items,
      playlists,
      newsletterEditions: editions,
    })
    expect(result).not.toBeNull()
    expect(result!.text).toContain('Bloco de idea')
  })

  it('ignores playlist with total_items: 0', () => {
    const playlists: PlaylistSummary[] = [{
      id: 'p1', name: 'Empty', total_items: 0, done_items: 0,
      in_progress_items: 0, next_item_title: null, next_item_stage: null,
    }]
    const result = selectSuggestion({ pipelineItems: [], playlists, newsletterEditions: [] })
    expect(result).toBeNull()
  })

  it('does not flag published videos as orphaned', () => {
    const items = [
      makePipelineItem({ id: 'v1', format: 'video', stage: 'published', youtube_channel_id: null }),
    ]
    const result = selectSuggestion({ pipelineItems: items, playlists: [], newsletterEditions: [] })
    expect(result?.text ?? '').not.toContain('sem canal')
  })
})
