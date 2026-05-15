/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Types for the mock Supabase channel callback
// ---------------------------------------------------------------------------
type RealtimeCallback = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Record<string, unknown> | undefined
  old: Record<string, unknown> | undefined
}) => void

// ---------------------------------------------------------------------------
// Mock Supabase browser client
// ---------------------------------------------------------------------------
let channelCallbacks: Map<string, RealtimeCallback>
let mockSelectReturn: {
  eq: ReturnType<typeof vi.fn>
}
let mockFromReturn: {
  select: ReturnType<typeof vi.fn>
}

const mockUnsubscribe = vi.fn().mockResolvedValue('ok')
const mockRemoveChannel = vi.fn()

function createMockChannel() {
  let capturedCallback: RealtimeCallback | null = null
  const channel = {
    on: vi.fn().mockImplementation(
      (_event: string, _filter: Record<string, unknown>, cb: RealtimeCallback) => {
        capturedCallback = cb
        return channel
      },
    ),
    subscribe: vi.fn().mockImplementation(() => {
      return channel
    }),
    unsubscribe: mockUnsubscribe,
    _getCallback: () => capturedCallback,
  }
  return channel
}

const mockChannel = vi.fn().mockImplementation((name: string) => {
  const ch = createMockChannel()
  // Store reference to fire events later
  channelCallbacks.set(name, (payload) => {
    const cb = ch._getCallback()
    if (cb) cb(payload)
  })
  return ch
})

const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockSingle = vi.fn()
const mockSelect = vi.fn()

const mockSupabase = {
  from: vi.fn().mockImplementation(() => mockFromReturn),
  channel: mockChannel,
  removeChannel: mockRemoveChannel,
}

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: () => mockSupabase,
}))

// Import after mocks are set up
import { useSocialDeliveries, useSocialPostStatus } from '@/lib/social/realtime'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sampleDelivery = (overrides: Record<string, unknown> = {}) => ({
  id: 'del-1',
  post_id: 'post-1',
  connection_id: 'conn-1',
  provider: 'youtube',
  status: 'pending',
  platform_post_id: null,
  platform_url: null,
  content_override: null,
  attempt: 1,
  max_attempts: 3,
  last_error: null,
  error_type: null,
  published_at: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

// ---------------------------------------------------------------------------
// Tests: useSocialDeliveries
// ---------------------------------------------------------------------------
describe('useSocialDeliveries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    channelCallbacks = new Map()

    // Reset mock chain for deliveries: .from().select().eq().order()
    mockOrder.mockResolvedValue({ data: [] })
    mockEq.mockReturnValue({ order: mockOrder })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFromReturn = { select: mockSelect }
  })

  it('returns empty array initially', () => {
    const { result } = renderHook(() => useSocialDeliveries('post-1'))
    expect(result.current).toEqual([])
  })

  it('fetches deliveries on mount', async () => {
    const deliveries = [sampleDelivery(), sampleDelivery({ id: 'del-2' })]
    mockOrder.mockResolvedValue({ data: deliveries })

    const { result } = renderHook(() => useSocialDeliveries('post-1'))

    await waitFor(() => {
      expect(result.current).toHaveLength(2)
    })

    expect(mockSupabase.from).toHaveBeenCalledWith('social_deliveries')
    expect(mockSelect).toHaveBeenCalledWith('id, post_id, connection_id, provider, status, platform_post_id, platform_url, content_override, attempt, max_attempts, published_at, created_at')
    expect(mockEq).toHaveBeenCalledWith('post_id', 'post-1')
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true })
  })

  it('updates on INSERT event', async () => {
    mockOrder.mockResolvedValue({ data: [sampleDelivery()] })

    const { result } = renderHook(() => useSocialDeliveries('post-1'))

    await waitFor(() => {
      expect(result.current).toHaveLength(1)
    })

    const newDelivery = sampleDelivery({ id: 'del-new', provider: 'bluesky' })

    act(() => {
      const fire = channelCallbacks.get('social-deliveries-post-1')
      fire?.({
        eventType: 'INSERT',
        new: newDelivery,
        old: undefined,
      })
    })

    expect(result.current).toHaveLength(2)
    expect(result.current[1]).toMatchObject({ id: 'del-new', provider: 'bluesky' })
  })

  it('updates on UPDATE event', async () => {
    mockOrder.mockResolvedValue({ data: [sampleDelivery()] })

    const { result } = renderHook(() => useSocialDeliveries('post-1'))

    await waitFor(() => {
      expect(result.current).toHaveLength(1)
    })

    const updatedDelivery = sampleDelivery({ id: 'del-1', status: 'delivered' })

    act(() => {
      const fire = channelCallbacks.get('social-deliveries-post-1')
      fire?.({
        eventType: 'UPDATE',
        new: updatedDelivery,
        old: sampleDelivery(),
      })
    })

    expect(result.current).toHaveLength(1)
    expect(result.current[0]).toMatchObject({ id: 'del-1', status: 'delivered' })
  })

  it('handles DELETE event', async () => {
    const deliveries = [sampleDelivery(), sampleDelivery({ id: 'del-2' })]
    mockOrder.mockResolvedValue({ data: deliveries })

    const { result } = renderHook(() => useSocialDeliveries('post-1'))

    await waitFor(() => {
      expect(result.current).toHaveLength(2)
    })

    act(() => {
      const fire = channelCallbacks.get('social-deliveries-post-1')
      fire?.({
        eventType: 'DELETE',
        new: undefined,
        old: { id: 'del-1' },
      })
    })

    expect(result.current).toHaveLength(1)
    expect(result.current[0]).toMatchObject({ id: 'del-2' })
  })

  it('no-op when postId is empty', () => {
    const { result } = renderHook(() => useSocialDeliveries(''))

    expect(result.current).toEqual([])
    expect(mockSupabase.from).not.toHaveBeenCalled()
    expect(mockChannel).not.toHaveBeenCalled()
  })

  it('cleans up subscription on unmount', async () => {
    mockOrder.mockResolvedValue({ data: [] })

    const { unmount } = renderHook(() => useSocialDeliveries('post-1'))

    // Wait for the effect to run
    await waitFor(() => {
      expect(mockChannel).toHaveBeenCalled()
    })

    unmount()

    expect(mockRemoveChannel).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Tests: useSocialPostStatus
// ---------------------------------------------------------------------------
describe('useSocialPostStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    channelCallbacks = new Map()

    // Reset mock chain for status: .from().select().eq().single()
    mockSingle.mockResolvedValue({ data: { status: 'draft' } })
    mockEq.mockReturnValue({ single: mockSingle, order: mockOrder })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFromReturn = { select: mockSelect }
  })

  it('returns "draft" initially', () => {
    const { result } = renderHook(() => useSocialPostStatus('post-1'))
    expect(result.current).toBe('draft')
  })

  it('fetches status on mount', async () => {
    mockSingle.mockResolvedValue({ data: { status: 'scheduled' } })

    const { result } = renderHook(() => useSocialPostStatus('post-1'))

    await waitFor(() => {
      expect(result.current).toBe('scheduled')
    })

    expect(mockSupabase.from).toHaveBeenCalledWith('social_posts')
    expect(mockSelect).toHaveBeenCalledWith('status')
    expect(mockEq).toHaveBeenCalledWith('id', 'post-1')
    expect(mockSingle).toHaveBeenCalled()
  })

  it('updates on status change event', async () => {
    mockSingle.mockResolvedValue({ data: { status: 'scheduled' } })

    const { result } = renderHook(() => useSocialPostStatus('post-1'))

    await waitFor(() => {
      expect(result.current).toBe('scheduled')
    })

    act(() => {
      const fire = channelCallbacks.get('social-post-post-1')
      fire?.({
        eventType: 'UPDATE',
        new: { status: 'completed' },
        old: { status: 'scheduled' },
      })
    })

    expect(result.current).toBe('completed')
  })

  it('no-op when postId is empty', () => {
    const { result } = renderHook(() => useSocialPostStatus(''))

    expect(result.current).toBe('draft')
    expect(mockSupabase.from).not.toHaveBeenCalled()
    expect(mockChannel).not.toHaveBeenCalled()
  })
})
