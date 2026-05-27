// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

vi.mock('@/lib/pipeline/gem-design', () => ({
  gemMix: vi.fn((color: string, pct: number) => `rgba(0,0,0,${pct / 100})`),
}))

vi.mock('lucide-react', () => ({
  ListChecks: (props: Record<string, unknown>) => <svg data-testid="icon-list-checks" {...props} />,
  CalendarDays: (props: Record<string, unknown>) => <svg data-testid="icon-calendar-days" {...props} />,
  Activity: (props: Record<string, unknown>) => <svg data-testid="icon-activity" {...props} />,
}))

import { PipelineTabs, type TabId } from
  '../../src/app/cms/(authed)/pipeline/_components/pipeline-tabs'

describe('PipelineTabs', () => {
  const children = {
    queue: <div data-testid="queue-content">Queue</div>,
    grid: <div data-testid="grid-content">Grid</div>,
    health: <div data-testid="health-content">Health</div>,
  }

  it('renders three tab buttons', () => {
    render(<PipelineTabs activeTab="queue" onTabChange={vi.fn()}>{children}</PipelineTabs>)
    expect(screen.getByRole('tab', { name: /fila/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /grade/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /saúde/i })).toBeTruthy()
  })

  it('shows queue content when queue tab is active', () => {
    render(<PipelineTabs activeTab="queue" onTabChange={vi.fn()}>{children}</PipelineTabs>)
    expect(screen.getByTestId('queue-content')).toBeTruthy()
    expect(screen.queryByTestId('grid-content')).toBeNull()
  })

  it('shows grid content when grid tab is active', () => {
    render(<PipelineTabs activeTab="grid" onTabChange={vi.fn()}>{children}</PipelineTabs>)
    expect(screen.getByTestId('grid-content')).toBeTruthy()
    expect(screen.queryByTestId('queue-content')).toBeNull()
  })

  it('calls onTabChange when clicking a tab', () => {
    const onTabChange = vi.fn()
    render(<PipelineTabs activeTab="queue" onTabChange={onTabChange}>{children}</PipelineTabs>)
    fireEvent.click(screen.getByRole('tab', { name: /grade/i }))
    expect(onTabChange).toHaveBeenCalledWith('grid')
  })

  it('marks active tab with aria-selected', () => {
    render(<PipelineTabs activeTab="grid" onTabChange={vi.fn()}>{children}</PipelineTabs>)
    const gridTab = screen.getByRole('tab', { name: /grade/i })
    expect(gridTab.getAttribute('aria-selected')).toBe('true')
    const queueTab = screen.getByRole('tab', { name: /fila/i })
    expect(queueTab.getAttribute('aria-selected')).toBe('false')
  })

  it('has correct tabpanel role on content area', () => {
    render(<PipelineTabs activeTab="queue" onTabChange={vi.fn()}>{children}</PipelineTabs>)
    expect(screen.getByRole('tabpanel')).toBeTruthy()
  })
})
