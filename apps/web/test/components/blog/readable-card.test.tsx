import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

const mockStorage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mockStorage.get(k) ?? null,
  setItem: (k: string, v: string) => mockStorage.set(k, v),
  removeItem: (k: string) => mockStorage.delete(k),
})

describe('ReadableCard', () => {
  beforeEach(() => mockStorage.clear())

  it('renders children without indicator when not read', async () => {
    const { ReadableCard } = await import('../../../src/components/blog/readable-card')
    render(
      <ReadableCard postId="p1">
        <div data-testid="child">content</div>
      </ReadableCard>,
    )
    expect(screen.getByTestId('child')).toBeDefined()
    expect(screen.queryByTestId('read-bar')).toBeNull()
  })

  it('renders red bar when partially read', async () => {
    mockStorage.set('btf_read_progress', JSON.stringify({ 'p2': { d: 50, t: Date.now() / 1000 } }))
    const { ReadableCard } = await import('../../../src/components/blog/readable-card')
    render(
      <ReadableCard postId="p2">
        <div>content</div>
      </ReadableCard>,
    )
    const bar = screen.getByTestId('read-bar')
    expect(bar).toBeDefined()
    expect(bar.style.width).toBe('50%')
  })

  it('renders full bar + badge when fully read', async () => {
    mockStorage.set('btf_read_progress', JSON.stringify({ 'p3': { d: 100, t: Date.now() / 1000 } }))
    const { ReadableCard } = await import('../../../src/components/blog/readable-card')
    render(
      <ReadableCard postId="p3">
        <div>content</div>
      </ReadableCard>,
    )
    const bar = screen.getByTestId('read-bar')
    expect(bar.style.width).toBe('100%')
    expect(screen.getByTestId('read-badge')).toBeDefined()
  })
})
