import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ── Mock next/navigation ────────────────────────────────────────────────────
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/cms/blog',
}))

import { useAutoRefresh } from '@/app/cms/(authed)/blog/_hub/use-auto-refresh'
import { useHubShortcuts } from '@/app/cms/(authed)/blog/_hub/use-hub-shortcuts'

// ─────────────────────────────────────────────────────────────────────────────
// useAutoRefresh
// ─────────────────────────────────────────────────────────────────────────────
describe('useAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockRefresh.mockClear()
    // document.hidden defaults to false in happy-dom
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls router.refresh() after interval elapses', () => {
    renderHook(() => useAutoRefresh(5000))
    expect(mockRefresh).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(5000) })
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('calls router.refresh() multiple times over multiple intervals', () => {
    renderHook(() => useAutoRefresh(3000))
    act(() => { vi.advanceTimersByTime(9000) })
    expect(mockRefresh).toHaveBeenCalledTimes(3)
  })

  it('does NOT refresh when document is hidden', () => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    renderHook(() => useAutoRefresh(5000))
    act(() => { vi.advanceTimersByTime(5000) })
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('uses default interval of 60000ms when no argument', () => {
    renderHook(() => useAutoRefresh())
    act(() => { vi.advanceTimersByTime(59999) })
    expect(mockRefresh).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('clears interval on unmount', () => {
    const { unmount } = renderHook(() => useAutoRefresh(5000))
    unmount()
    act(() => { vi.advanceTimersByTime(15000) })
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('refreshNow() calls router.refresh() immediately', () => {
    const { result } = renderHook(() => useAutoRefresh(60000))
    act(() => { result.current.refreshNow() })
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('refreshNow() updates lastRefresh ref', () => {
    const { result } = renderHook(() => useAutoRefresh(60000))
    const before = result.current.lastRefresh.current
    act(() => { vi.advanceTimersByTime(100) })
    act(() => { result.current.refreshNow() })
    expect(result.current.lastRefresh.current).toBeGreaterThan(before)
  })

  it('respects custom interval value', () => {
    renderHook(() => useAutoRefresh(2000))
    act(() => { vi.advanceTimersByTime(2000) })
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(mockRefresh).toHaveBeenCalledTimes(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// useHubShortcuts
// ─────────────────────────────────────────────────────────────────────────────
describe('useHubShortcuts', () => {
  const onNewPost = vi.fn()
  const onSwitchTab = vi.fn()
  const onFocusSearch = vi.fn()
  const onExportCsv = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setup() {
    return renderHook(() =>
      useHubShortcuts({ onNewPost, onSwitchTab, onFocusSearch, onExportCsv }),
    )
  }

  function pressKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, ...opts })
    document.dispatchEvent(event)
  }

  it('pressing "n" calls onNewPost', () => {
    setup()
    pressKey('n')
    expect(onNewPost).toHaveBeenCalledTimes(1)
  })

  it('pressing "1" switches to overview tab', () => {
    setup()
    pressKey('1')
    expect(onSwitchTab).toHaveBeenCalledWith('overview')
  })

  it('pressing "2" switches to editorial tab', () => {
    setup()
    pressKey('2')
    expect(onSwitchTab).toHaveBeenCalledWith('editorial')
  })

  it('pressing "3" switches to schedule tab', () => {
    setup()
    pressKey('3')
    expect(onSwitchTab).toHaveBeenCalledWith('schedule')
  })

  it('pressing "4" switches to analytics tab', () => {
    setup()
    pressKey('4')
    expect(onSwitchTab).toHaveBeenCalledWith('analytics')
  })

  it('pressing "/" calls onFocusSearch', () => {
    setup()
    pressKey('/')
    expect(onFocusSearch).toHaveBeenCalledTimes(1)
  })

  it('pressing "f" calls onFocusSearch', () => {
    setup()
    pressKey('f')
    expect(onFocusSearch).toHaveBeenCalledTimes(1)
  })

  it('pressing "e" calls onExportCsv', () => {
    setup()
    pressKey('e')
    expect(onExportCsv).toHaveBeenCalledTimes(1)
  })

  it('ignores keydowns when meta key is held', () => {
    setup()
    pressKey('n', { metaKey: true })
    expect(onNewPost).not.toHaveBeenCalled()
  })

  it('ignores keydowns when ctrl key is held', () => {
    setup()
    pressKey('n', { ctrlKey: true })
    expect(onNewPost).not.toHaveBeenCalled()
  })

  it('ignores keydowns when alt key is held', () => {
    setup()
    pressKey('n', { altKey: true })
    expect(onNewPost).not.toHaveBeenCalled()
  })

  it('ignores keys when target is an input element', () => {
    setup()
    const input = document.createElement('input')
    document.body.appendChild(input)
    const event = new KeyboardEvent('keydown', { key: 'n', bubbles: true })
    Object.defineProperty(event, 'target', { value: input })
    document.dispatchEvent(event)
    expect(onNewPost).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('ignores keys when target is a textarea element', () => {
    setup()
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    const event = new KeyboardEvent('keydown', { key: 'n', bubbles: true })
    Object.defineProperty(event, 'target', { value: textarea })
    document.dispatchEvent(event)
    expect(onNewPost).not.toHaveBeenCalled()
    document.body.removeChild(textarea)
  })

  it('removes event listener on unmount', () => {
    const { unmount } = setup()
    unmount()
    pressKey('n')
    expect(onNewPost).not.toHaveBeenCalled()
  })

  it('does nothing for unrecognized keys', () => {
    setup()
    pressKey('x')
    expect(onNewPost).not.toHaveBeenCalled()
    expect(onSwitchTab).not.toHaveBeenCalled()
    expect(onFocusSearch).not.toHaveBeenCalled()
    expect(onExportCsv).not.toHaveBeenCalled()
  })

  it('works without optional handlers (onFocusSearch/onExportCsv)', () => {
    renderHook(() => useHubShortcuts({ onNewPost, onSwitchTab }))
    // Should not throw
    pressKey('/')
    pressKey('e')
    expect(onFocusSearch).not.toHaveBeenCalled()
    expect(onExportCsv).not.toHaveBeenCalled()
  })
})
