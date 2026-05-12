import { describe, it, expect, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { ContentCiteSelector } from '@/app/cms/(authed)/pipeline/_components/detail/content-cite-selector'

const noop = vi.fn()

describe('ContentCiteSelector', () => {
  it('renders children when disabled', () => {
    const { container } = render(
      <ContentCiteSelector enabled={false} onCite={noop}>
        <p>Draft content here</p>
      </ContentCiteSelector>,
    )
    expect(screen.getByText('Draft content here')).toBeTruthy()
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.border).toBe('')
  })

  it('renders children with cite-mode border when enabled', () => {
    const { container } = render(
      <ContentCiteSelector enabled={true} onCite={noop}>
        <p>Some text</p>
      </ContentCiteSelector>,
    )
    expect(screen.getByText('Some text')).toBeTruthy()
    const wrapper = container.firstElementChild as HTMLElement
    // jsdom drops color-mix() values, so we verify the data attribute instead
    expect(wrapper.getAttribute('data-cite-enabled')).toBe('true')
  })

  it('shows hint text when enabled', () => {
    render(
      <ContentCiteSelector enabled={true} onCite={noop}>
        <p>Content</p>
      </ContentCiteSelector>,
    )
    expect(screen.getByText('Selecione para citar')).toBeTruthy()
  })

  it('does not show hint when disabled', () => {
    render(
      <ContentCiteSelector enabled={false} onCite={noop}>
        <p>Content</p>
      </ContentCiteSelector>,
    )
    expect(screen.queryByText('Selecione para citar')).toBeNull()
  })

  it('renders in enabled state ready for interaction (selectionchange not testable in jsdom)', () => {
    const onCite = vi.fn()
    render(
      <ContentCiteSelector enabled={true} onCite={onCite}>
        <p>Selectable draft content for testing</p>
      </ContentCiteSelector>,
    )
    expect(screen.getByText('Selecione para citar')).toBeTruthy()
    expect(screen.getByText(/Selectable draft content/)).toBeTruthy()
  })

  it('cleanup removes listeners on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const { unmount } = render(
      <ContentCiteSelector enabled={true} onCite={noop}>
        <p>Cleanup test</p>
      </ContentCiteSelector>,
    )
    unmount()
    const calls = removeSpy.mock.calls.map(c => c[0])
    expect(calls).toContain('selectionchange')
    removeSpy.mockRestore()
  })
})
