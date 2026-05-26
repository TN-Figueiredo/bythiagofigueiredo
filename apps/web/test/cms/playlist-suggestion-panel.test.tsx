// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { SlotCandidate, WeekSlot } from '../../src/lib/pipeline/up-next-types'

vi.mock('@/lib/pipeline/gem-design', () => ({
  gemMix: vi.fn((color: string, pct: number) => `rgba(0,0,0,${pct / 100})`),
}))

vi.mock('@/lib/pipeline/up-next-constants', () => ({
  STAGE_ORDER: {
    idea: 0, outline: 1, draft: 2, roteiro: 3,
    gravacao: 4, edicao: 5, pos_producao: 6, ready: 7, scheduled: 8, published: 9,
  },
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
        playlistSummaries={[]}
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
        playlistSummaries={[]}
        onSelectItem={vi.fn()}
        selectedItem={null}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    )
    expect(screen.getByText('Sugestões por Playlist')).toBeTruthy()
    expect(screen.getByText('3 em progresso')).toBeTruthy()
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
        playlistSummaries={[]}
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
        playlistSummaries={[]}
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
        playlistSummaries={[]}
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
        playlistSummaries={[]}
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
        playlistSummaries={[]}
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
    // 9 of 10 done → 1 remaining, 10% → nearCompletion = true
    const candidate = makeCandidate({
      id: 'c-1',
      playlist_id: 'pl-1',
      playlist_name: 'Almost Done',
      playlist_position: 9,
      playlist_total: 10,
    })
    const summaries = [
      { id: 'pl-1', name: 'Almost Done', total_items: 10, done_items: 9, in_progress_items: 1, next_item_title: null, next_item_stage: null },
    ]
    render(
      <PlaylistSuggestionPanel
        candidates={[candidate]}
        weekSlots={[makeWeekSlot()]}
        playlistSummaries={summaries}
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
        playlistSummaries={[]}
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
        playlistSummaries={[]}
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

  it('shows badge as "no backlog" when all candidates are ideas', async () => {
    const { PlaylistSuggestionPanel } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel'
    )
    const candidates = [
      makeCandidate({ id: 'c-1', stage: 'idea' }),
      makeCandidate({ id: 'c-2', stage: 'idea' }),
    ]
    render(
      <PlaylistSuggestionPanel
        candidates={candidates}
        weekSlots={[makeWeekSlot()]}
        playlistSummaries={[]}
        onSelectItem={vi.fn()}
        selectedItem={null}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    )
    expect(screen.getByText('2 no backlog')).toBeTruthy()
  })

  it('shows only 5 items initially when group has more', async () => {
    const { PlaylistSuggestionPanel } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel'
    )
    const candidates = Array.from({ length: 8 }, (_, i) =>
      makeCandidate({
        id: `c-${i}`,
        title: `Video ${i}`,
        playlist_id: 'pl-1',
        playlist_name: 'Big Playlist',
        stage: 'roteiro',
      }),
    )
    render(
      <PlaylistSuggestionPanel
        candidates={candidates}
        weekSlots={[makeWeekSlot()]}
        playlistSummaries={[]}
        onSelectItem={vi.fn()}
        selectedItem={null}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    )
    // Only 5 chips rendered initially
    const chips = screen.getAllByRole('button', { name: /Video \d/ })
    expect(chips).toHaveLength(5)
    // Items 5, 6, 7 not visible
    expect(screen.queryByText('Video 5')).toBeNull()
    expect(screen.queryByText('Video 6')).toBeNull()
    expect(screen.queryByText('Video 7')).toBeNull()
  })

  it('shows "ver mais" button with remaining count', async () => {
    const { PlaylistSuggestionPanel } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel'
    )
    const candidates = Array.from({ length: 8 }, (_, i) =>
      makeCandidate({
        id: `c-${i}`,
        title: `Video ${i}`,
        playlist_id: 'pl-1',
        playlist_name: 'Big Playlist',
        stage: 'roteiro',
      }),
    )
    render(
      <PlaylistSuggestionPanel
        candidates={candidates}
        weekSlots={[makeWeekSlot()]}
        playlistSummaries={[]}
        onSelectItem={vi.fn()}
        selectedItem={null}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    )
    expect(screen.getByText('+ 3 mais')).toBeTruthy()
  })

  it('shows progressed items before ideas within a group', async () => {
    const { PlaylistSuggestionPanel } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel'
    )
    // Create items with mixed stages: 3 ideas, then 2 progressed
    // After sorting, progressed items (edicao, roteiro) should come before ideas
    const candidates = [
      makeCandidate({ id: 'c-1', title: 'Idea One', stage: 'idea', playlist_id: 'pl-1', playlist_name: 'Mixed' }),
      makeCandidate({ id: 'c-2', title: 'Idea Two', stage: 'idea', playlist_id: 'pl-1', playlist_name: 'Mixed' }),
      makeCandidate({ id: 'c-3', title: 'Idea Three', stage: 'idea', playlist_id: 'pl-1', playlist_name: 'Mixed' }),
      makeCandidate({ id: 'c-4', title: 'Editing Video', stage: 'edicao', playlist_id: 'pl-1', playlist_name: 'Mixed' }),
      makeCandidate({ id: 'c-5', title: 'Scripted Video', stage: 'roteiro', playlist_id: 'pl-1', playlist_name: 'Mixed' }),
    ]
    render(
      <PlaylistSuggestionPanel
        candidates={candidates}
        weekSlots={[makeWeekSlot()]}
        playlistSummaries={[]}
        onSelectItem={vi.fn()}
        selectedItem={null}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    )
    // Only 5 visible (GROUP_MAX_VISIBLE), sorted by stage desc
    const chips = screen.getAllByRole('button', { name: /Video|Idea|Editing|Scripted/ })
    expect(chips).toHaveLength(5)
    // First chip should be edicao (stage 5), second roteiro (stage 3), then ideas
    expect(chips[0]!.textContent).toContain('Editing Video')
    expect(chips[1]!.textContent).toContain('Scripted Video')
    // Last 3 should be ideas
    expect(chips[2]!.textContent).toContain('Idea')
    expect(chips[3]!.textContent).toContain('Idea')
    expect(chips[4]!.textContent).toContain('Idea')
  })

  it('sorts groups by actionable item count (more actionable first)', async () => {
    const { PlaylistSuggestionPanel } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel'
    )
    // Group A: all ideas (0 actionable)
    // Group B: 2 progressed items (2 actionable)
    const candidates = [
      makeCandidate({ id: 'c-1', title: 'Idea A1', stage: 'idea', playlist_id: 'pl-a', playlist_name: 'All Ideas' }),
      makeCandidate({ id: 'c-2', title: 'Idea A2', stage: 'idea', playlist_id: 'pl-a', playlist_name: 'All Ideas' }),
      makeCandidate({ id: 'c-3', title: 'Draft B1', stage: 'draft', playlist_id: 'pl-b', playlist_name: 'Has Progress' }),
      makeCandidate({ id: 'c-4', title: 'Ready B2', stage: 'ready', playlist_id: 'pl-b', playlist_name: 'Has Progress' }),
    ]
    render(
      <PlaylistSuggestionPanel
        candidates={candidates}
        weekSlots={[makeWeekSlot()]}
        playlistSummaries={[]}
        onSelectItem={vi.fn()}
        selectedItem={null}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    )
    // Groups should appear: "Has Progress" first, then "All Ideas"
    const groupNames = screen.getAllByText(/All Ideas|Has Progress/)
    expect(groupNames[0]!.textContent).toBe('Has Progress')
    expect(groupNames[1]!.textContent).toBe('All Ideas')
  })

  it('expands to show all items when "ver mais" clicked', async () => {
    const { PlaylistSuggestionPanel } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel'
    )
    const candidates = Array.from({ length: 8 }, (_, i) =>
      makeCandidate({
        id: `c-${i}`,
        title: `Video ${i}`,
        playlist_id: 'pl-1',
        playlist_name: 'Big Playlist',
        stage: 'roteiro',
      }),
    )
    render(
      <PlaylistSuggestionPanel
        candidates={candidates}
        weekSlots={[makeWeekSlot()]}
        playlistSummaries={[]}
        onSelectItem={vi.fn()}
        selectedItem={null}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    )
    const moreBtn = screen.getByText('+ 3 mais')
    fireEvent.click(moreBtn)
    // All 8 items now visible
    const chips = screen.getAllByRole('button', { name: /Video \d/ })
    expect(chips).toHaveLength(8)
    // "ver mais" button gone
    expect(screen.queryByText('+ 3 mais')).toBeNull()
  })
})
