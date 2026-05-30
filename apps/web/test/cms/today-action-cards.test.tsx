// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('@/lib/pipeline/gem-design', () => ({
  gemMix: (cssVar: string, opacity: number) => `color-mix(in srgb, var(${cssVar}) ${opacity}%, transparent)`,
}))

vi.mock('@/lib/pipeline/colors', () => ({
  FORMAT_COLORS: {
    video: { accent: 'var(--gem-danger)', bg: 'color-mix(in srgb, var(--gem-danger) 8%, transparent)', text: 'var(--gem-danger)', border: 'color-mix(in srgb, var(--gem-danger) 25%, transparent)' },
    blog_post: { accent: 'var(--gem-warn)', bg: 'color-mix(in srgb, var(--gem-warn) 8%, transparent)', text: 'var(--gem-warn)', border: 'color-mix(in srgb, var(--gem-warn) 25%, transparent)' },
    newsletter: { accent: 'var(--gem-accent)', bg: 'color-mix(in srgb, var(--gem-accent) 8%, transparent)', text: 'var(--gem-muted)', border: 'color-mix(in srgb, var(--gem-accent) 25%, transparent)' },
  },
  getFormatColor: vi.fn(() => ({ accent: 'var(--gem-accent)', bg: 'color-mix(in srgb, var(--gem-accent) 8%, transparent)', text: 'var(--gem-muted)', border: 'color-mix(in srgb, var(--gem-accent) 25%, transparent)' })),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('lucide-react', () => ({
  Clock: (props: Record<string, unknown>) => <svg data-testid="icon-clock" {...props} />,
  Flame: (props: Record<string, unknown>) => <svg data-testid="icon-flame" {...props} />,
  Calendar: (props: Record<string, unknown>) => <svg data-testid="icon-calendar" {...props} />,
  CalendarDays: (props: Record<string, unknown>) => <svg data-testid="icon-calendar-days" {...props} />,
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
    expect(container.querySelector('section')).not.toBeNull()
  })

  it('renders action card with title and effort', () => {
    render(<TodayActionCards actions={[makeAction()]} overflow={0} />)
    expect(screen.getByText('Test Video')).toBeDefined()
    expect(screen.getByText('~3h')).toBeDefined()
  })

  it('links card to pipeline item URL', () => {
    render(<TodayActionCards actions={[makeAction({ id: 'abc-123' })]} overflow={0} />)
    const link = screen.getByText('Test Video').closest('a')
    expect(link?.getAttribute('href')).toBe('/cms/pipeline/items/abc-123')
  })

  it('shows urgency badge', () => {
    render(<TodayActionCards actions={[makeAction({ urgency: 'overdue' })]} overflow={0} />)
    expect(screen.getByText('Atrasado')).toBeDefined()
  })

  it('shows effort badge with deep/quick label', () => {
    render(<TodayActionCards actions={[makeAction({ effort: 'deep' })]} overflow={0} />)
    expect(screen.getByText('deep')).toBeDefined()
  })

  it('shows playlist context when provided', () => {
    render(<TodayActionCards actions={[makeAction({
      playlistContext: { name: 'AI Empire', position: 8, total: 144 },
    })]} overflow={0} />)
    expect(screen.getByText(/AI Empire 8\/144/)).toBeDefined()
  })

  it('shows channel label when provided', () => {
    render(<TodayActionCards actions={[makeAction({ channelLabel: 'Canal PT' })]} overflow={0} />)
    expect(screen.getByText('Canal PT')).toBeDefined()
  })

  it('shows overflow count when > 0', () => {
    render(<TodayActionCards actions={[makeAction()]} overflow={3} />)
    expect(screen.getByText(/3 ações adicionais/)).toBeDefined()
  })

  it('renders batch card differently when batchItems exist', () => {
    render(<TodayActionCards actions={[makeAction({
      itemTitle: 'Gravar 2 videos',
      batchItems: ['v2'],
    })]} overflow={0} />)
    expect(screen.getByText('Gravar 2 videos')).toBeDefined()
  })

  it('shows empty state message when no actions', () => {
    render(<TodayActionCards actions={[]} overflow={0} />)
    expect(screen.getByText(/Nada urgente/)).toBeDefined()
  })

  it('renders deadline label text when present', () => {
    render(<TodayActionCards actions={[makeAction({ deadline: { label: 'Amanha', date: '2026-06-02' } })]} overflow={0} />)
    expect(screen.getByText(/Amanha/)).toBeDefined()
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

  it('urgency "today" renders "Hoje"', () => {
    render(<TodayActionCards actions={[makeAction({ urgency: 'today' })]} overflow={0} />)
    expect(screen.getByText('Hoje')).toBeDefined()
  })

  it('urgency "tomorrow" renders "Amanha"', () => {
    render(<TodayActionCards actions={[makeAction({ urgency: 'tomorrow' })]} overflow={0} />)
    expect(screen.getByText('Amanhã')).toBeDefined()
  })

  it('urgency "this_week" renders "Esta semana"', () => {
    render(<TodayActionCards actions={[makeAction({ urgency: 'this_week' })]} overflow={0} />)
    expect(screen.getByText('Esta semana')).toBeDefined()
  })

  it('shows idle message when actions=[] and overflow=0', () => {
    render(<TodayActionCards actions={[]} overflow={0} />)
    expect(screen.getByText(/Nada urgente — bom dia para novas ideias/)).toBeDefined()
    expect(screen.queryByText(/acoes adicionais/)).toBeNull()
  })

  it('renders multiple action cards in order', () => {
    const actions = [
      makeAction({ id: 'a1', itemTitle: 'Primeiro Video' }),
      makeAction({ id: 'a2', itemTitle: 'Segundo Blog', format: 'blog_post' }),
      makeAction({ id: 'a3', itemTitle: 'Terceira Newsletter', format: 'newsletter' }),
    ]
    render(<TodayActionCards actions={actions} overflow={0} />)
    const items = screen.getAllByRole('listitem')
    const titles = items.map(li => {
      const titleEl = li.querySelector('p')
      return titleEl?.textContent
    })
    expect(titles[0]).toBe('Primeiro Video')
    expect(titles[1]).toBe('Segundo Blog')
    expect(titles[2]).toBe('Terceira Newsletter')
  })

  describe('urgency grouping', () => {
    it('renders section headers for each urgency group', () => {
      const actions = [
        makeAction({ id: 'a1', urgency: 'overdue', itemTitle: 'Overdue Item' }),
        makeAction({ id: 'a2', urgency: 'today', itemTitle: 'Today Item' }),
        makeAction({ id: 'a3', urgency: 'this_week', itemTitle: 'Week Item' }),
      ]
      render(<TodayActionCards actions={actions} overflow={0} />)

      expect(screen.getByText('Atrasado')).toBeDefined()
      expect(screen.getByText('Hoje')).toBeDefined()
      expect(screen.getByText('Esta semana')).toBeDefined()
    })

    it('does not render empty urgency groups', () => {
      const actions = [
        makeAction({ id: 'a1', urgency: 'today', itemTitle: 'Today Item' }),
      ]
      render(<TodayActionCards actions={actions} overflow={0} />)

      expect(screen.getByText('Hoje')).toBeDefined()
      expect(screen.queryByText('Atrasado')).toBeNull()
      expect(screen.queryByText('Amanhã')).toBeNull()
    })

    it('groups multiple actions under same urgency header', () => {
      const actions = [
        makeAction({ id: 'a1', urgency: 'today', itemTitle: 'Item 1' }),
        makeAction({ id: 'a2', urgency: 'today', itemTitle: 'Item 2' }),
      ]
      render(<TodayActionCards actions={actions} overflow={0} />)

      const headers = screen.getAllByText('Hoje')
      const groupHeaders = headers.filter(el => el.tagName === 'H3')
      expect(groupHeaders).toHaveLength(1)
    })

    it('renders phantom actions with create link instead of detail link', () => {
      const actions = [
        makeAction({
          id: 'blog-cadence-2026-05-25',
          urgency: 'today',
          isPhantom: true,
          format: 'blog_post',
          itemTitle: 'Post do Blog',
        }),
      ]
      render(<TodayActionCards actions={actions} overflow={0} />)

      const link = screen.getByRole('link', { name: /Post do Blog/i })
      expect(link?.getAttribute('href')).toBe('/cms/pipeline/items/new?format=blog_post')
    })
  })
})
