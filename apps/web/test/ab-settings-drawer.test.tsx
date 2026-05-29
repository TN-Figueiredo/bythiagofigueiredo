// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Image: icon('Image'), Type: icon('Type'), FileText: icon('FileText'), Layers: icon('Layers'), TrendingUp: icon('TrendingUp'), TrendingDown: icon('TrendingDown'), ChevronDown: icon('ChevronDown') }
})

import { SettingsDrawer } from '@/app/cms/(authed)/youtube/ab-lab/_components/settings-drawer'
import { AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'
import type { AbTestSiteSettings } from '@/lib/youtube/ab-types'

const defaultSettings: AbTestSiteSettings = { ...AB_SITE_SETTINGS_DEFAULTS }

afterEach(() => cleanup())

describe('SettingsDrawer', () => {
  it('renders with role=dialog and aria-modal=true', () => {
    render(<SettingsDrawer settings={defaultSettings} onSave={vi.fn()} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<SettingsDrawer settings={defaultSettings} onSave={vi.fn()} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<SettingsDrawer settings={defaultSettings} onSave={vi.fn()} onClose={onClose} />)
    const backdrop = container.querySelector('[data-backdrop]')
    expect(backdrop).toBeTruthy()
    fireEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('auto-saves with debounce when toggle is changed', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<SettingsDrawer settings={defaultSettings} onSave={onSave} onClose={vi.fn()} />)

    // Find the auto-apply toggle (it's a switch role)
    const switches = screen.getAllByRole('switch')
    const autoApplyToggle = switches[0]!
    fireEvent.click(autoApplyToggle)

    // Should not have called save immediately
    expect(onSave).not.toHaveBeenCalled()

    // Advance past the 500ms debounce
    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('renders 3 sections: Automation, Defaults, Notifications', () => {
    const { container } = render(<SettingsDrawer settings={defaultSettings} onSave={vi.fn()} onClose={vi.fn()} />)
    const sections = container.querySelectorAll('[data-section]')
    expect(sections.length).toBe(3)

    const sectionNames = Array.from(sections).map(s => s.getAttribute('data-section'))
    expect(sectionNames).toEqual(['automation', 'defaults', 'notifications'])
  })

  it('shows skeleton when settings is null', () => {
    const { container } = render(<SettingsDrawer settings={null} onSave={vi.fn()} onClose={vi.fn()} />)
    const skeleton = container.querySelector('[data-skeleton]')
    expect(skeleton).toBeTruthy()
    // Should not render any sections
    const sections = container.querySelectorAll('[data-section]')
    expect(sections.length).toBe(0)
  })

  it('renders footer with role=status and aria-live=polite', () => {
    render(<SettingsDrawer settings={defaultSettings} onSave={vi.fn()} onClose={vi.fn()} />)
    const status = screen.getByRole('status')
    expect(status).toBeTruthy()
    expect(status.getAttribute('aria-live')).toBe('polite')
  })

  it('toggle click triggers auto-save', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<SettingsDrawer settings={defaultSettings} onSave={onSave} onClose={vi.fn()} />)

    const switches = screen.getAllByRole('switch')
    fireEvent.click(switches[0]!)

    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    expect(onSave).toHaveBeenCalled()
    const calledWith = onSave.mock.calls[0]![0] as AbTestSiteSettings
    // The default is true, so toggling should make it false
    expect(calledWith.default_auto_apply).toBe(false)
    vi.useRealTimers()
  })

  it('shows error state with Retry button when save fails', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn().mockRejectedValue(new Error('network error'))
    render(<SettingsDrawer settings={defaultSettings} onSave={onSave} onClose={vi.fn()} />)

    const switches = screen.getAllByRole('switch')
    fireEvent.click(switches[0]!)

    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    // Wait for the async rejection to settle
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText('Failed to save')).toBeTruthy()
    expect(screen.getByText('Retry')).toBeTruthy()
    vi.useRealTimers()
  })

  it('renders 4 notification checkboxes', () => {
    render(<SettingsDrawer settings={defaultSettings} onSave={vi.fn()} onClose={vi.fn()} />)
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBe(4)
  })
})
