// @vitest-environment jsdom
// jsdom (not happy-dom): this test redefines the window.parent getter and stubs
// ResizeObserver/getBoundingClientRect — jsdom's window accessors are spy-able.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { WaitlistEmbedFrame } from '../../src/components/waitlists/embed-frame'

// ResizeObserver stub — captures the callback so tests can fire "height changed".
let roCallback: ResizeObserverCallback | null = null
const roObserve = vi.fn()
const roDisconnect = vi.fn()
class ResizeObserverStub {
  constructor(cb: ResizeObserverCallback) {
    roCallback = cb
  }
  observe = roObserve
  unobserve = vi.fn()
  disconnect = roDisconnect
}

let mockedHeight = 0
function mockHeight(h: number) {
  mockedHeight = h
}

describe('WaitlistEmbedFrame', () => {
  beforeEach(() => {
    roCallback = null
    mockedHeight = 120
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          height: mockedHeight,
          width: 480,
          top: 0,
          left: 0,
          right: 480,
          bottom: mockedHeight,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function framed() {
    const postMessage = vi.fn()
    vi.spyOn(window, 'parent', 'get').mockReturnValue({
      postMessage,
    } as unknown as Window)
    return postMessage
  }

  it("posts { type: 'waitlist:resize', height } to window.parent on mount", () => {
    const postMessage = framed()
    render(<WaitlistEmbedFrame>card</WaitlistEmbedFrame>)
    expect(postMessage).toHaveBeenCalledWith({ type: 'waitlist:resize', height: 120 }, '*')
  })

  it('ceils fractional heights (an iframe sized 1px short shows a scrollbar)', () => {
    const postMessage = framed()
    mockHeight(240.4)
    render(<WaitlistEmbedFrame>card</WaitlistEmbedFrame>)
    expect(postMessage).toHaveBeenCalledWith({ type: 'waitlist:resize', height: 241 }, '*')
  })

  it('re-posts the new height when the ResizeObserver fires (e.g. form → success block)', () => {
    const postMessage = framed()
    render(<WaitlistEmbedFrame>card</WaitlistEmbedFrame>)
    expect(roObserve).toHaveBeenCalled()
    postMessage.mockClear()

    mockHeight(320)
    act(() => {
      roCallback?.([], {} as ResizeObserver)
    })
    expect(postMessage).toHaveBeenCalledWith({ type: 'waitlist:resize', height: 320 }, '*')
  })

  it('does NOT post when opened standalone (window.parent === window)', () => {
    // no framed() here — jsdom's default is parent === window
    const postSpy = vi.spyOn(window, 'postMessage')
    render(<WaitlistEmbedFrame>card</WaitlistEmbedFrame>)
    expect(postSpy).not.toHaveBeenCalled()
  })

  it('disconnects the ResizeObserver on unmount', () => {
    framed()
    const { unmount } = render(<WaitlistEmbedFrame>card</WaitlistEmbedFrame>)
    unmount()
    expect(roDisconnect).toHaveBeenCalled()
  })

  it('renders its children inside the observed wrapper', () => {
    framed()
    const { container, getByText } = render(
      <WaitlistEmbedFrame>
        <p>the card</p>
      </WaitlistEmbedFrame>,
    )
    expect(getByText('the card')).not.toBeNull()
    expect(container.querySelector('[data-waitlist-embed-frame]')).not.toBeNull()
  })
})
