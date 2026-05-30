// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Settings: icon('Settings'), X: icon('X'), Zap: icon('Zap'), FlaskConical: icon('FlaskConical'), Mail: icon('Mail'), Check: icon('Check'), Image: icon('Image'), Type: icon('Type'), FileText: icon('FileText'), Layers: icon('Layers') }
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
    const backdrop = container.querySelector('[aria-hidden="true"]')
    expect(backdrop).toBeTruthy()
    fireEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('auto-saves with debounce when toggle is changed', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<SettingsDrawer settings={defaultSettings} onSave={onSave} onClose={vi.fn()} />)

    const switches = screen.getAllByRole('switch')
    const firstToggle = switches[0]!
    fireEvent.click(firstToggle)

    expect(onSave).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('renders 3 section headers: Automação, Padrões, Notificações', () => {
    render(<SettingsDrawer settings={defaultSettings} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Automação')).toBeTruthy()
    expect(screen.getByText('Padrões dos novos testes')).toBeTruthy()
    expect(screen.getByText('Notificações')).toBeTruthy()
  })

  it('shows skeleton when settings is null', () => {
    const { container } = render(<SettingsDrawer settings={null} onSave={vi.fn()} onClose={vi.fn()} />)
    const skeleton = container.querySelector('.animate-pulse')
    expect(skeleton).toBeTruthy()
  })

  it('renders footer with save status', () => {
    render(<SettingsDrawer settings={defaultSettings} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Salvo automaticamente')).toBeTruthy()
  })

  it('toggle click triggers auto-save', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<SettingsDrawer settings={defaultSettings} onSave={onSave} onClose={vi.fn()} />)

    // Third switch is auto-apply toggle
    const switches = screen.getAllByRole('switch')
    fireEvent.click(switches[2]!)

    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    expect(onSave).toHaveBeenCalled()
    const calledWith = onSave.mock.calls[0]![0] as AbTestSiteSettings
    expect(calledWith.default_auto_apply).toBe(false)
    vi.useRealTimers()
  })

  it('shows error state when save fails', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn().mockRejectedValue(new Error('network error'))
    render(<SettingsDrawer settings={defaultSettings} onSave={onSave} onClose={vi.fn()} />)

    const switches = screen.getAllByRole('switch')
    fireEvent.click(switches[0]!)

    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText('Erro ao salvar')).toBeTruthy()
    vi.useRealTimers()
  })

  it('renders 4 notification options', () => {
    render(<SettingsDrawer settings={defaultSettings} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Teste concluído')).toBeTruthy()
    expect(screen.getByText('Teste pausado automaticamente')).toBeTruthy()
    expect(screen.getByText('Alerta de queda de CTR')).toBeTruthy()
    expect(screen.getByText('Resumo diário')).toBeTruthy()
  })
})
