// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { SlotCandidate, WeekSlot } from '../../src/lib/pipeline/up-next-types'

vi.mock('@/lib/pipeline/gem-design', () => ({
  gemMix: vi.fn((color: string, pct: number) => `rgba(0,0,0,${pct / 100})`),
}))

vi.mock('@/lib/pipeline/colors', () => ({
  FORMAT_COLORS: {
    video: { accent: 'var(--gem-accent)', bg: 'rgba(0,0,0,0.08)', text: 'var(--gem-accent)', border: 'rgba(0,0,0,0.25)' },
    blog_post: { accent: 'var(--gem-done)', bg: 'rgba(0,0,0,0.08)', text: 'var(--gem-done)', border: 'rgba(0,0,0,0.25)' },
    newsletter: { accent: 'var(--gem-warn)', bg: 'rgba(0,0,0,0.08)', text: 'var(--gem-warn)', border: 'rgba(0,0,0,0.25)' },
  },
}))

function makeCandidate(overrides: Partial<SlotCandidate> = {}): SlotCandidate {
  return {
    id: 'c-1',
    title: 'Test Video',
    stage: 'roteiro',
    format: 'video',
    language: 'pt-br',
    playlist_id: 'pl-1',
    playlist_name: 'JS Basics',
    playlist_position: 3,
    playlist_total: 10,
    ...overrides,
  }
}

function makeWeekSlot(overrides: Partial<WeekSlot> = {}): WeekSlot {
  return {
    day: 'monday',
    dayLabel: 'Seg',
    hour: '10:00',
    format: 'video',
    channelLocale: 'pt',
    channelId: 'ch-1',
    isRestDay: false,
    assignedItem: null,
    effortMinutes: 120,
    ...overrides,
  }
}

describe('PlaylistSuggestionPanel', () => {
  it('returns null when candidates empty', async () => {
    const { PlaylistSuggestionPanel } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel'
    )
    const { container } = render(
      <PlaylistSuggestionPanel
        candidates={[]}
        weekSlots={[makeWeekSlot()]}
        onSelectItem={vi.fn()}
        selectedItem={null}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders panel header with item count badge', async () => {
    const { PlaylistSuggestionPanel } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel'
    )
    const candidates = [
      makeCandidate({ id: 'c-1' }),
      makeCandidate({ id: 'c-2', title: 'Another Video' }),
      makeCandidate({ id: 'c-3', title: 'Third Video', playlist_id: null, playlist_name: null }),
    ]
    render(
      <PlaylistSuggestionPanel
        candidates={candidates}
        weekSlots={[makeWeekSlot()]}
        onSelectItem={vi.fn()}
        selectedItem={null}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    )
    expect(screen.getByText('Sugestões por Playlist')).toBeTruthy()
    expect(screen.getByText('3 disponíveis')).toBeTruthy()
  })

  it('renders playlist groups by name', async () => {
    const { PlaylistSuggestionPanel } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel'
    )
    const candidates = [
      makeCandidate({ id: 'c-1', playlist_id: 'pl-1', playlist_name: 'JS Basics' }),
      makeCandidate({ id: 'c-2', playlist_id: 'pl-2', playlist_name: 'React Pro' }),
      makeCandidate({ id: 'c-3', playlist_id: null, playlist_name: null }),
    ]
    render(
      <PlaylistSuggestionPanel
        candidates={candidates}
        weekSlots={[makeWeekSlot()]}
        onSelectItem={vi.fn()}
        selectedItem={null}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    )
    expect(screen.getByText('JS Basics')).toBeTruthy()
    expect(screen.getByText('React Pro')).toBeTruthy()
    expect(screen.getByText('Avulsos')).toBeTruthy()
  })

  it('calls onSelectItem when chip clicked', async () => {
    const { PlaylistSuggestionPanel } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel'
    )
    const onSelect = vi.fn()
    const candidate = makeCandidate({ id: 'c-1', title: 'Test Video' })
    render(
      <PlaylistSuggestionPanel
        candidates={[candidate]}
        weekSlots={[makeWeekSlot()]}
        onSelectItem={onSelect}
        selectedItem={null}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    )
    const chip = screen.getByRole('button', { name: /Test Video/ })
    fireEvent.click(chip)
    expect(onSelect).toHaveBeenCalledWith(candidate)
  })

  it('selected item has aria-pressed="true"', async () => {
    const { PlaylistSuggestionPanel } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel'
    )
    const candidate = makeCandidate({ id: 'c-1', title: 'Test Video' })
    render(
      <PlaylistSuggestionPanel
        candidates={[candidate]}
        weekSlots={[makeWeekSlot()]}
        onSelectItem={vi.fn()}
        selectedItem={candidate}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    )
    const chip = screen.getByRole('button', { name: /Test Video/ })
    expect(chip.getAttribute('aria-pressed')).toBe('true')
  })

  it('collapsed state hides groups, shows only header', async () => {
    const { PlaylistSuggestionPanel } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel'
    )
    const candidate = makeCandidate({ id: 'c-1', playlist_id: 'pl-1', playlist_name: 'JS Basics' })
    render(
      <PlaylistSuggestionPanel
        candidates={[candidate]}
        weekSlots={[makeWeekSlot()]}
        onSelectItem={vi.fn()}
        selectedItem={null}
        collapsed={true}
        onToggleCollapse={vi.fn()}
      />,
    )
    expect(screen.getByText('Sugestões por Playlist')).toBeTruthy()
    expect(screen.queryByText('JS Basics')).toBeNull()
  })

  it('toggle button calls onToggleCollapse', async () => {
    const { PlaylistSuggestionPanel } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel'
    )
    const onToggle = vi.fn()
    render(
      <PlaylistSuggestionPanel
        candidates={[makeCandidate()]}
        weekSlots={[makeWeekSlot()]}
        onSelectItem={vi.fn()}
        selectedItem={null}
        collapsed={false}
        onToggleCollapse={onToggle}
      />,
    )
    const toggle = screen.getByTestId('panel-toggle')
    fireEvent.click(toggle)
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('shows near-completion badge', async () => {
    const { PlaylistSuggestionPanel } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel'
    )
    // position 9 of 10 total → 1 remaining, 10% → nearCompletion = true
    const candidate = makeCandidate({
      id: 'c-1',
      playlist_id: 'pl-1',
      playlist_name: 'Almost Done',
      playlist_position: 9,
      playlist_total: 10,
    })
    render(
      <PlaylistSuggestionPanel
        candidates={[candidate]}
        weekSlots={[makeWeekSlot()]}
        onSelectItem={vi.fn()}
        selectedItem={null}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    )
    expect(screen.getByText('quase!')).toBeTruthy()
  })

  it('has accessible region landmark', async () => {
    const { PlaylistSuggestionPanel } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel'
    )
    render(
      <PlaylistSuggestionPanel
        candidates={[makeCandidate()]}
        weekSlots={[makeWeekSlot()]}
        onSelectItem={vi.fn()}
        selectedItem={null}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    )
    const region = screen.getByRole('region', { name: 'Sugestões de conteúdo por playlist' })
    expect(region).toBeTruthy()
  })

  it('deselects when clicking selected item again', async () => {
    const { PlaylistSuggestionPanel } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel'
    )
    const onSelect = vi.fn()
    const candidate = makeCandidate({ id: 'c-1', title: 'Test Video' })
    render(
      <PlaylistSuggestionPanel
        candidates={[candidate]}
        weekSlots={[makeWeekSlot()]}
        onSelectItem={onSelect}
        selectedItem={candidate}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    )
    const chip = screen.getByRole('button', { name: /Test Video/ })
    fireEvent.click(chip)
    expect(onSelect).toHaveBeenCalledWith(null)
  })
})
