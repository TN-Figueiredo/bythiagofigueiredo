import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAutoSnapshot } from '@/lib/playlists/canvas/use-auto-snapshot'

const baseItems = [
  { id: 'a', position_x: 100, position_y: 200, sort_order: 1000, playlist_id: 'pl', blog_post_id: 'bp1', newsletter_edition_id: null, pipeline_id: null, created_at: '', content_type: null as never, title: 'A', status: null, category: null, metadata: null, is_ghost: false, other_playlist_count: 0, language: null as never, tags: [], hook: null, synopsis: null },
]
const baseEdges = [
  { id: 'e1', playlist_id: 'pl', source_item_id: 'a', target_item_id: 'a', edge_type: 'sequence' as const, label: null, created_at: '' },
]

function makeProps(overrides: Partial<Parameters<typeof useAutoSnapshot>[0]> = {}) {
  return {
    playlistId: 'pl-1',
    siteId: 'site-1',
    items: baseItems,
    edges: baseEdges,
    saveState: 'saved' as const,
    enabled: true,
    onCreateSnapshot: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  }
}

describe('useAutoSnapshot', () => {
  it('does not fire on initial render', () => {
    const props = makeProps()
    renderHook(() => useAutoSnapshot(props))
    expect(props.onCreateSnapshot).not.toHaveBeenCalled()
  })

  it('accumulates time on saving→saved transitions', () => {
    const props = makeProps({ saveState: 'saving' })
    const { rerender } = renderHook(
      (p) => useAutoSnapshot(p),
      { initialProps: props },
    )

    // Simulate 10 save transitions (not enough to trigger — need 200)
    for (let i = 0; i < 10; i++) {
      rerender({ ...props, saveState: 'saving' })
      rerender({ ...props, saveState: 'saved' })
    }

    expect(props.onCreateSnapshot).not.toHaveBeenCalled()
  })

  it('fires snapshot after 200 save transitions (300s accumulated)', () => {
    const props = makeProps({ saveState: 'saving' })
    const { rerender } = renderHook(
      (p) => useAutoSnapshot(p),
      { initialProps: props },
    )

    // 300 / 1.5 = 200 transitions needed
    for (let i = 0; i < 200; i++) {
      rerender({ ...props, saveState: 'saving' })
      rerender({ ...props, saveState: 'saved' })
    }

    expect(props.onCreateSnapshot).toHaveBeenCalledTimes(1)
    expect(props.onCreateSnapshot).toHaveBeenCalledWith('site-1', 'pl-1', 'auto', expect.stringContaining('Auto-save'))
  })

  it('does not fire when disabled', () => {
    const props = makeProps({ saveState: 'saving', enabled: false })
    const { rerender } = renderHook(
      (p) => useAutoSnapshot(p),
      { initialProps: props },
    )

    for (let i = 0; i < 200; i++) {
      rerender({ ...props, saveState: 'saving', enabled: false })
      rerender({ ...props, saveState: 'saved', enabled: false })
    }

    expect(props.onCreateSnapshot).not.toHaveBeenCalled()
  })

  it('does not fire if graph hash has not changed', () => {
    const props = makeProps({ saveState: 'saving' })
    const { rerender } = renderHook(
      (p) => useAutoSnapshot(p),
      { initialProps: props },
    )

    // First round triggers snapshot
    for (let i = 0; i < 200; i++) {
      rerender({ ...props, saveState: 'saving' })
      rerender({ ...props, saveState: 'saved' })
    }
    expect(props.onCreateSnapshot).toHaveBeenCalledTimes(1)

    // Second round with same data should NOT trigger (hash unchanged)
    for (let i = 0; i < 200; i++) {
      rerender({ ...props, saveState: 'saving' })
      rerender({ ...props, saveState: 'saved' })
    }
    expect(props.onCreateSnapshot).toHaveBeenCalledTimes(1)
  })

  it('swallows onCreateSnapshot rejection without throwing', () => {
    const props = makeProps({
      saveState: 'saving',
      onCreateSnapshot: vi.fn().mockRejectedValue(new Error('network error')),
    })
    const { rerender } = renderHook(
      (p) => useAutoSnapshot(p),
      { initialProps: props },
    )

    // Should not throw
    for (let i = 0; i < 200; i++) {
      rerender({ ...props, saveState: 'saving' })
      rerender({ ...props, saveState: 'saved' })
    }
    expect(props.onCreateSnapshot).toHaveBeenCalledTimes(1)
  })
})
