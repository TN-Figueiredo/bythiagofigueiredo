import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { LivePulseIndicator } from './live-pulse-indicator'

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
}

beforeEach(() => {
  MockEventSource.instances = []
  vi.stubGlobal('EventSource', MockEventSource)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// Deterministically flush the MockEventSource open timer (setTimeout 0) plus
// any React state updates it triggers. Replaces the flaky `setTimeout(r, 10)`
// wall-clock sleep that raced the open callback under CPU load.
async function flushOpen() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe('LivePulseIndicator', () => {
  it('renders pulse dot', () => {
    render(<LivePulseIndicator linkId="link-1" streamUrl="/api/stream" />)
    expect(screen.getByTestId('pulse-dot')).toBeInTheDocument()
  })

  it('shows disconnected state initially', () => {
    render(<LivePulseIndicator linkId="link-1" streamUrl="/api/stream" />)
    expect(screen.getByText(/connecting/i)).toBeInTheDocument()
  })

  it('shows connected state after EventSource opens', async () => {
    render(<LivePulseIndicator linkId="link-1" streamUrl="/api/stream" />)
    await flushOpen()
    expect(screen.getByText(/live/i)).toBeInTheDocument()
  })

  it('shows click count after receiving messages', async () => {
    render(<LivePulseIndicator linkId="link-1" streamUrl="/api/stream" />)
    await flushOpen()
    act(() => {
      MockEventSource.instances[0].simulateMessage(
        JSON.stringify({ type: 'click', linkId: 'link-1' }),
      )
      MockEventSource.instances[0].simulateMessage(
        JSON.stringify({ type: 'click', linkId: 'link-1' }),
      )
    })
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('displays clicks/min rate label', async () => {
    render(<LivePulseIndicator linkId="link-1" streamUrl="/api/stream" />)
    await flushOpen()
    expect(screen.getByText(/clicks\/min/i)).toBeInTheDocument()
  })
})
