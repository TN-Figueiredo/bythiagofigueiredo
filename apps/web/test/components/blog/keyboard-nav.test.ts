import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useKeyboardNav } from '../../../src/app/(public)/blog/keyboard-nav'

function pressKey(key: string, target?: HTMLElement) {
  const init: KeyboardEventInit = { key, bubbles: true }
  const event = new KeyboardEvent('keydown', init)
  if (target) {
    Object.defineProperty(event, 'target', { value: target })
  }
  window.dispatchEvent(event)
}

describe('useKeyboardNav', () => {
  beforeEach(() => {
    // Clean up any leftover DOM from previous tests
    document.body.innerHTML = ''
  })

  it('starts with activeIndex = -1', () => {
    const { result } = renderHook(() => useKeyboardNav(5))
    expect(result.current.activeIndex).toBe(-1)
  })

  it('j key increments activeIndex', () => {
    const { result } = renderHook(() => useKeyboardNav(5))
    act(() => pressKey('j'))
    expect(result.current.activeIndex).toBe(0)
    act(() => pressKey('j'))
    expect(result.current.activeIndex).toBe(1)
  })

  it('k key decrements activeIndex', () => {
    const { result } = renderHook(() => useKeyboardNav(5))
    // Move forward first
    act(() => pressKey('j'))
    act(() => pressKey('j'))
    expect(result.current.activeIndex).toBe(1)
    act(() => pressKey('k'))
    expect(result.current.activeIndex).toBe(0)
  })

  it('does not go below -1', () => {
    const { result } = renderHook(() => useKeyboardNav(5))
    // activeIndex starts at -1
    act(() => pressKey('k'))
    expect(result.current.activeIndex).toBe(-1)
    act(() => pressKey('k'))
    expect(result.current.activeIndex).toBe(-1)
  })

  it('does not exceed totalCards - 1', () => {
    const { result } = renderHook(() => useKeyboardNav(3))
    act(() => pressKey('j'))
    act(() => pressKey('j'))
    act(() => pressKey('j'))
    expect(result.current.activeIndex).toBe(2) // 3 - 1
    act(() => pressKey('j'))
    expect(result.current.activeIndex).toBe(2) // still capped
  })

  it('ignores keys when target is INPUT', () => {
    const { result } = renderHook(() => useKeyboardNav(5))
    const input = document.createElement('input')
    document.body.appendChild(input)
    act(() => pressKey('j', input))
    expect(result.current.activeIndex).toBe(-1)
  })

  it('ignores keys when target is TEXTAREA', () => {
    const { result } = renderHook(() => useKeyboardNav(5))
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    act(() => pressKey('j', textarea))
    expect(result.current.activeIndex).toBe(-1)
  })

  it('ignores keys when target is contentEditable', () => {
    const { result } = renderHook(() => useKeyboardNav(5))
    const div = document.createElement('div')
    div.contentEditable = 'true'
    document.body.appendChild(div)
    act(() => pressKey('j', div))
    expect(result.current.activeIndex).toBe(-1)
  })

  it('Escape resets activeIndex to -1', () => {
    const { result } = renderHook(() => useKeyboardNav(5))
    act(() => pressKey('j'))
    act(() => pressKey('j'))
    expect(result.current.activeIndex).toBe(1)
    act(() => pressKey('Escape'))
    expect(result.current.activeIndex).toBe(-1)
  })

  it('setActiveIndex allows programmatic control', () => {
    const { result } = renderHook(() => useKeyboardNav(10))
    act(() => result.current.setActiveIndex(7))
    expect(result.current.activeIndex).toBe(7)
  })

  it('handles totalCards = 0 gracefully (j does not advance)', () => {
    const { result } = renderHook(() => useKeyboardNav(0))
    act(() => pressKey('j'))
    // Math.min(-1 + 1, 0 - 1) = Math.min(0, -1) = -1
    expect(result.current.activeIndex).toBe(-1)
  })
})
