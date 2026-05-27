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

  it('suggests newsletter without scheduled_at for draft status', () => {
    const editions = [{ id: 'nl-1', subject: 'News', status: 'draft' as const, scheduled_at: null }]
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

  it('respects priority order: wip > orphan > batch > newsletter > playlist > buffer', () => {
    // items have youtube_channel_id: null (orphaned) AND same stage (batch opportunity)
    // with new order: orphan wins over batch
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
    // orphan now wins over batch in the new priority order
    expect(result!.text).toContain('sem canal configurado')
  })

  it('ignores playlist with total_items: 0', () => {
    const playlists: PlaylistSummary[] = [{
      id: 'p1', name: 'Empty', total_items: 0, done_items: 0,
      in_progress_items: 0, next_item_title: null, next_item_stage: null,
    }]
    const result = selectSuggestion({ pipelineItems: [], playlists, newsletterEditions: [] })
    expect(result).toBeNull()
  })

  it('selects ready over pos_producao as most-progressed stage (distinct STAGE_ORDER values)', () => {
    // pos_producao: 6, ready: 7 — both have 2+ items
    // findBatchOpportunity sorts stages by STAGE_ORDER descending: ready(7) wins
    const items = [
      makePipelineItem({ id: 'pp-1', stage: 'pos_producao' }),
      makePipelineItem({ id: 'pp-2', stage: 'pos_producao' }),
      makePipelineItem({ id: 'r-1', stage: 'ready' }),
      makePipelineItem({ id: 'r-2', stage: 'ready' }),
    ]
    const result = selectSuggestion({ pipelineItems: items, playlists: [], newsletterEditions: [] })
    expect(result).not.toBeNull()
    // ready (7) > pos_producao (6) → ready wins
    expect(result!.href).toBe('/cms/pipeline?stage=ready')
  })

  it('does not suggest already-completed playlist', () => {
    const playlists = [
      makePlaylist({ id: 'pl-done', name: 'Finished', total_items: 5, done_items: 5 }),
    ]
    const result = selectSuggestion({
      pipelineItems: [],
      playlists,
      newsletterEditions: [],
    })
    expect(result).toBeNull()
  })

  it('does not suggest playlist when remaining > 20%', () => {
    const playlists = [
      makePlaylist({ id: 'pl-1', name: 'Far Away', total_items: 10, done_items: 7 }),
    ]
    const result = selectSuggestion({
      pipelineItems: [],
      playlists,
      newsletterEditions: [],
    })
    expect(result).toBeNull()
  })

  it('suggests at exactly 20% remaining boundary', () => {
    const playlists = [
      makePlaylist({ id: 'pl-1', name: 'Almost Done', total_items: 10, done_items: 8 }),
    ]
    const result = selectSuggestion({
      pipelineItems: [],
      playlists,
      newsletterEditions: [],
    })
    expect(result).not.toBeNull()
    expect(result!.text).toContain('Almost Done')
    expect(result!.text).toContain('2 item(s)')
    expect(result!.href).toBe('/cms/playlists/pl-1')
  })

  it('excludes newsletter format from orphaned items', () => {
    const items = [
      makePipelineItem({ id: 'nl-1', format: 'newsletter', youtube_channel_id: null, stage: 'draft' }),
    ]
    const result = selectSuggestion({
      pipelineItems: items,
      playlists: [],
      newsletterEditions: [],
    })
    expect(result).toBeNull()
  })

  it('does not flag published videos as orphaned', () => {
    const items = [
      makePipelineItem({ id: 'v1', format: 'video', stage: 'published', youtube_channel_id: null }),
    ]
    const result = selectSuggestion({ pipelineItems: items, playlists: [], newsletterEditions: [] })
    expect(result).toBeNull()
  })
})

describe('findWipViolation', () => {
  it('triggers when a group exceeds its WIP limit', () => {
    // escrever default limit is 6, so 7 items exceeds it
    const result = selectSuggestion({
      pipelineItems: [],
      playlists: [],
      newsletterEditions: [],
      stageCounts: { escrever: 7 },
    })
    expect(result).not.toBeNull()
    expect(result!.text).toContain('escrever acima do limite: 7/6')
    expect(result!.href).toBe('/cms/pipeline?group=escrever')
  })

  it('has highest priority — wins over orphaned items and batch opportunities', () => {
    const items = [
      makePipelineItem({ id: 'item-1', stage: 'idea', format: 'video', youtube_channel_id: null }),
      makePipelineItem({ id: 'item-2', stage: 'idea', format: 'video', youtube_channel_id: null }),
    ]
    const result = selectSuggestion({
      pipelineItems: items,
      playlists: [],
      newsletterEditions: [],
      stageCounts: { escrever: 7 },
    })
    expect(result).not.toBeNull()
    expect(result!.text).toContain('acima do limite')
  })

  it('does not trigger when stageCounts is not provided (backward compatible)', () => {
    const result = selectSuggestion({
      pipelineItems: [],
      playlists: [],
      newsletterEditions: [],
    })
    expect(result).toBeNull()
  })

  it('reports the group with the highest excess when multiple groups are violated', () => {
    const result = selectSuggestion({
      pipelineItems: [],
      playlists: [],
      newsletterEditions: [],
      stageCounts: { escrever: 7, gravar: 6 },
    })
    expect(result).not.toBeNull()
    expect(result!.text).toContain('gravar acima do limite: 6/3')
    expect(result!.href).toBe('/cms/pipeline?group=gravar')
  })
})

describe('findBufferGap', () => {
  it('triggers when gravar has 0 items', () => {
    const result = selectSuggestion({
      pipelineItems: [],
      playlists: [],
      newsletterEditions: [],
      stageCounts: { gravar: 0, 'pos-prod': 2 },
    })
    expect(result).not.toBeNull()
    expect(result!.text).toContain('Nenhum item em gravar')
    expect(result!.href).toBe('/cms/pipeline?group=gravar')
  })

  it('triggers when pos-prod has 0 items (and gravar has items)', () => {
    const result = selectSuggestion({
      pipelineItems: [],
      playlists: [],
      newsletterEditions: [],
      stageCounts: { gravar: 2, 'pos-prod': 0 },
    })
    expect(result).not.toBeNull()
    expect(result!.text).toContain('Nenhum item em pos-prod')
    expect(result!.href).toBe('/cms/pipeline?group=pos-prod')
  })

  it('does not trigger when all buffer groups have items', () => {
    const result = selectSuggestion({
      pipelineItems: [],
      playlists: [],
      newsletterEditions: [],
      stageCounts: { gravar: 1, 'pos-prod': 1 },
    })
    expect(result).toBeNull()
  })

  it('has lowest priority — playlist suggestion wins over buffer gap', () => {
    const playlists = [makePlaylist({ id: 'pl-1', name: 'Almost Done', total_items: 10, done_items: 9 })]
    const result = selectSuggestion({
      pipelineItems: [],
      playlists,
      newsletterEditions: [],
      stageCounts: { gravar: 0, 'pos-prod': 0 },
    })
    expect(result).not.toBeNull()
    expect(result!.text).toContain('Almost Done')
  })

  it('does not trigger for prontos gap (prontos=0 is fine)', () => {
    const result = selectSuggestion({
      pipelineItems: [],
      playlists: [],
      newsletterEditions: [],
      stageCounts: { gravar: 1, 'pos-prod': 1, prontos: 0 },
    })
    expect(result).toBeNull()
  })

  it('does not trigger when stageCounts is not provided (backward compatible)', () => {
    const result = selectSuggestion({
      pipelineItems: [],
      playlists: [],
      newsletterEditions: [],
    })
    expect(result).toBeNull()
  })

  it('does not trigger when escrever has 0 items (only gravar and pos-prod are buffer groups)', () => {
    const result = selectSuggestion({
      pipelineItems: [],
      playlists: [],
      newsletterEditions: [],
      stageCounts: { escrever: 0, gravar: 1, 'pos-prod': 1 },
    })
    expect(result).toBeNull()
  })
})
