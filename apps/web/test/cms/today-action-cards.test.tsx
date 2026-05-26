// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('@/lib/pipeline/colors', () => ({
  FORMAT_COLORS: {
    video: { accent: '#ef4444', bg: '#450a0a', text: '#fca5a5', border: '#7f1d1d' },
    blog_post: { accent: '#f59e0b', bg: '#451a03', text: '#fcd34d', border: '#78350f' },
    newsletter: { accent: '#6366f1', bg: '#1e1b4b', text: '#a5b4fc', border: '#312e81' },
  },
  getFormatColor: vi.fn(() => ({ accent: '#888', bg: '#111', text: '#fff', border: '#333' })),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('lucide-react', () => ({
  Clock: (props: Record<string, unknown>) => <svg data-testid="icon-clock" {...props} />,
  Zap: (props: Record<string, unknown>) => <svg data-testid="icon-zap" {...props} />,
  ChevronRight: (props: Record<string, unknown>) => <svg data-testid="icon-chevron" {...props} />,
}))

import { TodayActionCards } from '../../src/app/cms/(authed)/pipeline/_components/today-action-cards'
import type { TodayAction } from '../../src/lib/pipeline/up-next-types'

function makeAction(overrides: Partial<TodayAction> = {}): TodayAction {
  return {
    id: 'v1',
    itemTitle: 'Test Video',
    actionLabel: 'Finalizar roteiro',
    format: 'video',
    language: 'pt-br',
    effort: 'deep',
    effortEstimate: '~3h',
    effortMinutes: 180,
    urgency: 'today',
    priority: 3,
    stage: 'roteiro',
    deadline: { label: 'ate seg', date: '2026-06-01' },
    playlistContext: null,
    channelLabel: 'Canal PT',
    pubDate: '2026-06-05',
    ...overrides,
  }
}

describe('TodayActionCards', () => {
  it('renders nothing when actions is empty and overflow is 0', () => {
    const { container } = render(<TodayActionCards actions={[]} overflow={0} />)
    expect(container.querySelector('section')).toBeTruthy()
  })

  it('renders action card with title and effort', () => {
    render(<TodayActionCards actions={[makeAction()]} overflow={0} />)
    expect(screen.getByText('Test Video')).toBeTruthy()
    expect(screen.getByText('~3h')).toBeTruthy()
  })

  it('links card to pipeline item URL', () => {
    render(<TodayActionCards actions={[makeAction({ id: 'abc-123' })]} overflow={0} />)
    const link = screen.getByText('Test Video').closest('a')
    expect(link?.getAttribute('href')).toBe('/cms/pipeline/items/abc-123')
  })

  it('shows urgency badge', () => {
    render(<TodayActionCards actions={[makeAction({ urgency: 'overdue' })]} overflow={0} />)
    expect(screen.getByText('overdue')).toBeTruthy()
  })

  it('shows effort badge with deep/quick label', () => {
    render(<TodayActionCards actions={[makeAction({ effort: 'deep' })]} overflow={0} />)
    expect(screen.getByText('deep')).toBeTruthy()
  })

  it('shows playlist context when provided', () => {
    render(<TodayActionCards actions={[makeAction({
      playlistContext: { name: 'AI Empire', position: 8, total: 144 },
    })]} overflow={0} />)
    expect(screen.getByText(/AI Empire 8\/144/)).toBeTruthy()
  })

  it('shows channel label when provided', () => {
    render(<TodayActionCards actions={[makeAction({ channelLabel: 'Canal PT' })]} overflow={0} />)
    expect(screen.getByText('Canal PT')).toBeTruthy()
  })

  it('shows overflow count when > 0', () => {
    render(<TodayActionCards actions={[makeAction()]} overflow={3} />)
    expect(screen.getByText(/3 acoes adicionais/)).toBeTruthy()
  })

  it('renders batch card differently when batchItems exist', () => {
    render(<TodayActionCards actions={[makeAction({
      itemTitle: 'Gravar 2 videos',
      batchItems: ['v2'],
    })]} overflow={0} />)
    expect(screen.getByText('Gravar 2 videos')).toBeTruthy()
  })

  it('shows empty state message when no actions', () => {
    render(<TodayActionCards actions={[]} overflow={0} />)
    expect(screen.getByText(/Nada urgente/)).toBeTruthy()
  })

  it('batch card links to pipeline filter URL', () => {
    render(<TodayActionCards actions={[makeAction({
      id: 'batch-1',
      stage: 'roteiro',
      format: 'video',
      batchItems: ['v2'],
    })]} overflow={0} />)
    const link = screen.getByText(/Finalizar roteiro/).closest('a')
    expect(link?.getAttribute('href')).toContain('stage=')
  })
})
