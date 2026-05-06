import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClickStream } from './use-click-stream'

// Mock EventSource
class MockEventSource {
  url: string
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  onopen: (() => void) | null = null
  readyState = 0

  static instances: MockEventSource[] = []

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
    setTimeout(() => {
      this.readyState = 1
      this.onopen?.()
    }, 0)
  }

  close() {
    this.readyState = 2
  }

  simulateMessage(data: string) {
    this.onmessage?.(new MessageEvent('message', { data }))
  }

  simulateError() {
    this.readyState = 2
    this.onerror?.(new Event('error'))
  }
}

beforeEach(() => {
  MockEventSource.instances = []
  vi.stubGlobal('EventSource', MockEventSource)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useClickStream', () => {
  it('initializes with zero clicks and disconnected', () => {
    const { result } = renderHook(() => useClickStream('link-1', '/api/links/stream'))
    expect(result.current.clicks).toBe(0)
    expect(result.current.rate).toBe(0)
    expect(result.current.isConnected).toBe(false)
  })

  it('connects to EventSource with correct URL', () => {
    renderHook(() => useClickStream('link-1', '/api/links/stream'))
    expect(MockEventSource.instances.length).toBe(1)
    expect(MockEventSource.instances[0].url).toBe('/api/links/stream?linkId=link-1')
  })

  it('sets isConnected to true on open', async () => {
    const { result } = renderHook(() => useClickStream('link-1', '/api/links/stream'))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(result.current.isConnected).toBe(true)
  })

  it('increments clicks on message', async () => {
    const { result } = renderHook(() => useClickStream('link-1', '/api/links/stream'))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    act(() => {
      MockEventSource.instances[0].simulateMessage(
        JSON.stringify({ type: 'click', linkId: 'link-1' }),
      )
    })
    expect(result.current.clicks).toBe(1)
  })

  it('accumulates multiple clicks', async () => {
    const { result } = renderHook(() => useClickStream('link-1', '/api/links/stream'))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    act(() => {
      const es = MockEventSource.instances[0]
      es.simulateMessage(JSON.stringify({ type: 'click', linkId: 'link-1' }))
      es.simulateMessage(JSON.stringify({ type: 'click', linkId: 'link-1' }))
      es.simulateMessage(JSON.stringify({ type: 'click', linkId: 'link-1' }))
    })
    expect(result.current.clicks).toBe(3)
  })

  it('sets isConnected to false on error', async () => {
    const { result } = renderHook(() => useClickStream('link-1', '/api/links/stream'))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(result.current.isConnected).toBe(true)
    act(() => {
      MockEventSource.instances[0].simulateError()
    })
    expect(result.current.isConnected).toBe(false)
  })

  it('closes EventSource on unmount', async () => {
    const { unmount } = renderHook(() => useClickStream('link-1', '/api/links/stream'))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    const es = MockEventSource.instances[0]
    unmount()
    expect(es.readyState).toBe(2)
  })
})
