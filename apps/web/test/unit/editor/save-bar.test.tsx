import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SaveBar } from '@/app/cms/(authed)/_shared/editor/save-bar'

describe('SaveBar', () => {
  const defaults = {
    state: 'unsaved' as const,
    hasUnsavedChanges: true,
    mode: 'manual' as const,
    status: 'ready',
    onSave: vi.fn(),
    onRetry: vi.fn(),
  }

  it('renders when manual mode and has unsaved changes', () => {
    render(<SaveBar {...defaults} />)
    expect(screen.getByText('Unsaved changes')).toBeDefined()
    expect(screen.getByRole('button', { name: /save/i })).toBeDefined()
  })

  it('does not render bar content in auto mode', () => {
    render(<SaveBar {...defaults} mode="auto" />)
    expect(screen.queryByText('Unsaved changes')).toBeNull()
    expect(screen.getByRole('status')).toBeDefined()
  })

  it('does not render bar content when no unsaved changes and not saving', () => {
    render(<SaveBar {...defaults} hasUnsavedChanges={false} state="saved" />)
    expect(screen.queryByText('Unsaved changes')).toBeNull()
    expect(screen.getByRole('status')).toBeDefined()
  })

  it('shows "Update live post" for published status', () => {
    render(<SaveBar {...defaults} status="published" mode="guarded" />)
    expect(screen.getByRole('button', { name: /update live post/i })).toBeDefined()
  })

  it('disables save button while saving', () => {
    render(<SaveBar {...defaults} state="saving" />)
    const btn = screen.getByRole('button', { name: /save/i })
    expect(btn.hasAttribute('disabled')).toBe(true)
    expect(btn.textContent).toBe('Saving...')
  })

  it('calls onSave when save button clicked', () => {
    const onSave = vi.fn()
    render(<SaveBar {...defaults} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('shows error state with retry', () => {
    const onRetry = vi.fn()
    render(<SaveBar {...defaults} state="error" onRetry={onRetry} />)
    expect(screen.getByText(/save failed/i)).toBeDefined()
    const retryBtn = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('has accessible role', () => {
    render(<SaveBar {...defaults} />)
    expect(screen.getByRole('status')).toBeDefined()
  })

  it('Cmd+S triggers onSave in manual mode', () => {
    const onSave = vi.fn()
    render(<SaveBar {...defaults} onSave={onSave} />)
    fireEvent.keyDown(window, { key: 's', metaKey: true })
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+S triggers onSave in manual mode', () => {
    const onSave = vi.fn()
    render(<SaveBar {...defaults} onSave={onSave} />)
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('Cmd+S triggers onRetry in error state', () => {
    const onRetry = vi.fn()
    render(<SaveBar {...defaults} state="error" onRetry={onRetry} />)
    fireEvent.keyDown(window, { key: 's', metaKey: true })
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('Cmd+S does not fire while saving', () => {
    const onSave = vi.fn()
    render(<SaveBar {...defaults} state="saving" onSave={onSave} />)
    fireEvent.keyDown(window, { key: 's', metaKey: true })
    expect(onSave).not.toHaveBeenCalled()
  })

  it('does not register keyboard shortcut in auto mode', () => {
    const onSave = vi.fn()
    render(<SaveBar {...defaults} mode="auto" onSave={onSave} />)
    fireEvent.keyDown(window, { key: 's', metaKey: true })
    expect(onSave).not.toHaveBeenCalled()
  })
})
