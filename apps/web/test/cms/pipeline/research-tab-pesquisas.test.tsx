import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { ResearchItemSummary } from '@/lib/pipeline/research-types'
import { THEMES } from '@/lib/pipeline/research-types'

// ---------------------------------------------------------------------------
// Mocks — lucide-react icons (avoid rendering SVGs in happy-dom)
// ---------------------------------------------------------------------------

vi.mock('lucide-react', () => ({
  Search: (props: Record<string, unknown>) => <span data-testid="icon-search" />,
  Zap: (props: Record<string, unknown>) => <span data-testid="icon-zap" />,
  Pin: (props: Record<string, unknown>) => <span data-testid="icon-pin" />,
  Plus: (props: Record<string, unknown>) => <span data-testid="icon-plus" />,
  Target: (props: Record<string, unknown>) => <span data-testid="icon-target" />,
  ArrowRight: (props: Record<string, unknown>) => <span data-testid="icon-arrow" />,
  FlaskConical: (props: Record<string, unknown>) => <span data-testid="icon-flask" />,
  CheckCircle2: (props: Record<string, unknown>) => <span data-testid="icon-check" />,
  RefreshCw: (props: Record<string, unknown>) => <span data-testid="icon-refresh" />,
  Archive: (props: Record<string, unknown>) => <span data-testid="icon-archive" />,
  Sparkles: (props: Record<string, unknown>) => <span data-testid="icon-sparkles" />,
  Pen: (props: Record<string, unknown>) => <span data-testid="icon-pen" />,
  Users: (props: Record<string, unknown>) => <span data-testid="icon-users" />,
}))

// Import after mocks
import { TabPesquisas } from '@/app/cms/(authed)/pipeline/research/_components/tab-pesquisas'

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

let itemCounter = 0

function makeItem(overrides: Partial<ResearchItemSummary> = {}): ResearchItemSummary {
  itemCounter++
  return {
    id: `item-${itemCounter}`,
    title: 'Research about AI',
    topic_id: null,
    theme_id: 'ia',
    source: 'cowork',
    summary: 'Summary text',
    status: 'fresca',
    word_count: 500,
    read_min: 3,
    pinned: false,
    takeaways: ['tk1'],
    sources: [],
    version: 1,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Diverse item set for filtering tests
// ---------------------------------------------------------------------------

function makeDiverseItems(): ResearchItemSummary[] {
  return [
    makeItem({ id: 'ai-1', title: 'Tendencias de IA generativa', theme_id: 'ia', status: 'fresca' }),
    makeItem({ id: 'ai-2', title: 'LLMs para producao de conteudo', theme_id: 'ia', status: 'analise' }),
    makeItem({ id: 'asia-1', title: 'Nomadismo digital no Japao', theme_id: 'asia', status: 'fresca' }),
    makeItem({ id: 'dev-1', title: 'TypeScript 6 features', theme_id: 'dev', status: 'aplicada' }),
    makeItem({ id: 'games-1', title: 'Retro gaming market', theme_id: 'games', status: 'fresca' }),
    makeItem({ id: 'grana-1', title: 'Monetizacao via AdSense', theme_id: 'grana', status: 'analise' }),
    makeItem({ id: 'canal-1', title: 'Algoritmo do YouTube 2026', theme_id: 'canal', status: 'aplicada' }),
    makeItem({ id: 'arch-1', title: 'Pesquisa arquivada antiga', theme_id: 'ia', status: 'arquivada' }),
  ]
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  cleanup()
  itemCounter = 0
})

// ===========================================================================
// 1. Render tests
// ===========================================================================

describe('TabPesquisas — render', () => {
  it('renders theme rail with "Todas" + 6 theme buttons', () => {
    render(<TabPesquisas items={[]} onOpenItem={vi.fn()} />)

    // "Todas" button (appears in both theme rail and status chips)
    const todasButtons = screen.getAllByText('Todas')
    expect(todasButtons.length).toBeGreaterThanOrEqual(1)

    // All 6 theme labels
    for (const theme of THEMES) {
      expect(screen.getByText(theme.label)).toBeDefined()
    }
  })

  it('renders search input with placeholder', () => {
    render(<TabPesquisas items={[]} onOpenItem={vi.fn()} />)

    const input = screen.getByPlaceholderText('Buscar pesquisas...')
    expect(input).toBeDefined()
    expect(input.tagName).toBe('INPUT')
  })

  it('renders status filter chips', () => {
    render(<TabPesquisas items={[]} onOpenItem={vi.fn()} />)

    // "Todas" appears twice — one in theme rail, one in status chips
    const todasButtons = screen.getAllByText('Todas')
    expect(todasButtons.length).toBeGreaterThanOrEqual(2)

    expect(screen.getByText('Frescas')).toBeDefined()
    expect(screen.getByText('Em análise')).toBeDefined()
    expect(screen.getByText('Aplicadas')).toBeDefined()
    expect(screen.getByText('Arquivadas')).toBeDefined()
  })

  it('renders research cards showing title and summary', () => {
    const items = [
      makeItem({ title: 'My Research Title', summary: 'Detailed summary here' }),
    ]
    render(<TabPesquisas items={items} onOpenItem={vi.fn()} />)

    expect(screen.getByText('My Research Title')).toBeDefined()
    expect(screen.getByText('Detailed summary here')).toBeDefined()
  })

  it('each card shows takeaway count', () => {
    const items = [
      makeItem({ takeaways: ['a', 'b', 'c'] }),
    ]
    render(<TabPesquisas items={items} onOpenItem={vi.fn()} />)

    // Takeaway count is rendered next to Zap icon
    expect(screen.getByText('3')).toBeDefined()
  })
})

// ===========================================================================
// 2. Theme filtering
// ===========================================================================

describe('TabPesquisas — theme filtering', () => {
  it('"Todas" is selected by default and shows all items (archived included, per prototype)', () => {
    const items = makeDiverseItems()
    render(<TabPesquisas items={items} onOpenItem={vi.fn()} />)

    // "Todas" button should have the "on" class
    const todasButtons = screen.getAllByText('Todas')
    const themeRailTodas = todasButtons[0].closest('button')
    expect(themeRailTodas?.className).toContain('on')

    // All items should be visible
    expect(screen.getByText('Tendencias de IA generativa')).toBeDefined()
    expect(screen.getByText('Nomadismo digital no Japao')).toBeDefined()
    expect(screen.getByText('TypeScript 6 features')).toBeDefined()
    expect(screen.getByText('Retro gaming market')).toBeDefined()

    // The status chip is the sole archived gate — with no status filter active,
    // archived items appear in the grid so the rail count matches the grid.
    expect(screen.getByText('Pesquisa arquivada antiga')).toBeDefined()
  })

  it('clicking a theme filters to only items with that theme_id', () => {
    const items = makeDiverseItems()
    render(<TabPesquisas items={items} onOpenItem={vi.fn()} />)

    // Click "Ásia & Nomadismo" theme
    fireEvent.click(screen.getByText('Ásia & Nomadismo'))

    // Only asia item should be visible
    expect(screen.getByText('Nomadismo digital no Japao')).toBeDefined()

    // Other themes should not be visible
    expect(screen.queryByText('Tendencias de IA generativa')).toBeNull()
    expect(screen.queryByText('TypeScript 6 features')).toBeNull()
  })

  it('theme counts show correct numbers (include archived, per prototype)', () => {
    const items = makeDiverseItems()
    render(<TabPesquisas items={items} onOpenItem={vi.fn()} />)

    // IA has 3 items total (ai-1 fresca + ai-2 analise + arch-1 archived)
    // Per the prototype, counts include archived → IA count is 3
    const iaButton = screen.getByText('IA & Produção').closest('button')
    expect(iaButton?.textContent).toContain('3')

    // Asia has 1 non-archived item
    const asiaButton = screen.getByText('Ásia & Nomadismo').closest('button')
    expect(asiaButton?.textContent).toContain('1')

    // Dev has 1 non-archived item
    const devButton = screen.getByText('Programação').closest('button')
    expect(devButton?.textContent).toContain('1')
  })
})

// ===========================================================================
// 3. Search
// ===========================================================================

describe('TabPesquisas — search', () => {
  it('typing in search filters items by title', () => {
    const items = makeDiverseItems()
    render(<TabPesquisas items={items} onOpenItem={vi.fn()} />)

    const input = screen.getByPlaceholderText('Buscar pesquisas...')
    fireEvent.change(input, { target: { value: 'TypeScript' } })

    // Only TypeScript item should be visible
    expect(screen.getByText('TypeScript 6 features')).toBeDefined()

    // Other items should be hidden
    expect(screen.queryByText('Tendencias de IA generativa')).toBeNull()
    expect(screen.queryByText('Nomadismo digital no Japao')).toBeNull()
  })

  it('search is accent-insensitive (normalizes accents)', () => {
    const items = [
      makeItem({ title: 'Monetização via AdSense' }),
    ]
    render(<TabPesquisas items={items} onOpenItem={vi.fn()} />)

    const input = screen.getByPlaceholderText('Buscar pesquisas...')

    // Search without accent should still match accented title
    fireEvent.change(input, { target: { value: 'monetizacao' } })

    expect(screen.getByText('Monetização via AdSense')).toBeDefined()
  })

  it('search also matches summary text', () => {
    const items = [
      makeItem({ title: 'Some Research', summary: 'This is about quantum computing' }),
    ]
    render(<TabPesquisas items={items} onOpenItem={vi.fn()} />)

    const input = screen.getByPlaceholderText('Buscar pesquisas...')
    fireEvent.change(input, { target: { value: 'quantum' } })

    expect(screen.getByText('Some Research')).toBeDefined()
  })

  it('clearing search shows all items again', () => {
    const items = makeDiverseItems()
    render(<TabPesquisas items={items} onOpenItem={vi.fn()} />)

    const input = screen.getByPlaceholderText('Buscar pesquisas...')

    // Type to filter
    fireEvent.change(input, { target: { value: 'TypeScript' } })
    expect(screen.queryByText('Nomadismo digital no Japao')).toBeNull()

    // Clear search
    fireEvent.change(input, { target: { value: '' } })

    // All non-archived items should be visible again
    expect(screen.getByText('Nomadismo digital no Japao')).toBeDefined()
    expect(screen.getByText('TypeScript 6 features')).toBeDefined()
  })
})

// ===========================================================================
// 4. Status filter
// ===========================================================================

describe('TabPesquisas — status filter', () => {
  it('clicking "Frescas" chip shows only fresca items', () => {
    const items = makeDiverseItems()
    render(<TabPesquisas items={items} onOpenItem={vi.fn()} />)

    fireEvent.click(screen.getByText('Frescas'))

    // Fresca items visible
    expect(screen.getByText('Tendencias de IA generativa')).toBeDefined()
    expect(screen.getByText('Nomadismo digital no Japao')).toBeDefined()
    expect(screen.getByText('Retro gaming market')).toBeDefined()

    // Non-fresca items hidden
    expect(screen.queryByText('LLMs para producao de conteudo')).toBeNull() // analise
    expect(screen.queryByText('TypeScript 6 features')).toBeNull() // aplicada
  })

  it('clicking "Todas" status chip resets status filter', () => {
    const items = makeDiverseItems()
    render(<TabPesquisas items={items} onOpenItem={vi.fn()} />)

    // First filter to fresca
    fireEvent.click(screen.getByText('Frescas'))
    expect(screen.queryByText('TypeScript 6 features')).toBeNull()

    // Click "Todas" status chip (second "Todas" button — status filter area)
    const todasButtons = screen.getAllByText('Todas')
    // Status filter "Todas" is the second one (first is theme rail)
    fireEvent.click(todasButtons[1])

    // All non-archived items visible again
    expect(screen.getByText('TypeScript 6 features')).toBeDefined()
    expect(screen.getByText('LLMs para producao de conteudo')).toBeDefined()
  })

  it('clicking "Arquivadas" chip shows only archived items', () => {
    const items = makeDiverseItems()
    render(<TabPesquisas items={items} onOpenItem={vi.fn()} />)

    fireEvent.click(screen.getByText('Arquivadas'))

    // Archived item visible
    expect(screen.getByText('Pesquisa arquivada antiga')).toBeDefined()

    // Non-archived items hidden
    expect(screen.queryByText('Tendencias de IA generativa')).toBeNull()
    expect(screen.queryByText('TypeScript 6 features')).toBeNull()
  })
})

// ===========================================================================
// 5. Card interaction
// ===========================================================================

describe('TabPesquisas — card interaction', () => {
  it('clicking a card calls onOpenItem with the item id', () => {
    const onOpenItem = vi.fn()
    const items = [makeItem({ id: 'target-id', title: 'Clickable research' })]

    render(<TabPesquisas items={items} onOpenItem={onOpenItem} />)

    fireEvent.click(screen.getByText('Clickable research'))

    expect(onOpenItem).toHaveBeenCalledOnce()
    expect(onOpenItem).toHaveBeenCalledWith('target-id')
  })

  it('pinned item shows pin indicator', () => {
    const items = [makeItem({ pinned: true, title: 'Pinned research' })]
    render(<TabPesquisas items={items} onOpenItem={vi.fn()} />)

    // Pin indicator has title "No foco atual"
    expect(screen.getByTitle('No foco atual')).toBeDefined()
  })
})

// ===========================================================================
// 6. Empty state
// ===========================================================================

describe('TabPesquisas — empty state', () => {
  it('shows empty state message when items array is empty', () => {
    render(<TabPesquisas items={[]} onOpenItem={vi.fn()} />)

    expect(screen.getByText('Nenhuma pesquisa aqui')).toBeDefined()
    expect(screen.getByText(/Ajuste os filtros/)).toBeDefined()
  })

  it('shows empty state when no items match the active theme filter', () => {
    const items = [makeItem({ theme_id: 'ia', title: 'Only IA item' })]
    render(<TabPesquisas items={items} onOpenItem={vi.fn()} />)

    // Click a theme that has no items
    fireEvent.click(screen.getByText('Games & Pedigree'))

    expect(screen.getByText('Nenhuma pesquisa aqui')).toBeDefined()
  })

  it('shows empty state when search matches nothing', () => {
    const items = [makeItem({ title: 'Some real research' })]
    render(<TabPesquisas items={items} onOpenItem={vi.fn()} />)

    const input = screen.getByPlaceholderText('Buscar pesquisas...')
    fireEvent.change(input, { target: { value: 'xyznonexistent' } })

    expect(screen.getByText('Nenhuma pesquisa aqui')).toBeDefined()
  })
})

// ===========================================================================
// 7. Total count
// ===========================================================================

describe('TabPesquisas — total count', () => {
  it('shows total count on "Todas" theme button (includes archived, per prototype)', () => {
    const items = makeDiverseItems() // 7 non-archived + 1 archived = 8 total
    render(<TabPesquisas items={items} onOpenItem={vi.fn()} />)

    // "Todas" theme button shows count of ALL items (8)
    const todasButtons = screen.getAllByText('Todas')
    const themeRailTodas = todasButtons[0].closest('button')
    expect(themeRailTodas?.textContent).toContain('8')
  })

  it('shows count even when all items are archived (counts are not exclusive)', () => {
    const items = [makeItem({ status: 'arquivada' })]
    render(<TabPesquisas items={items} onOpenItem={vi.fn()} />)

    // "Todas" button shows the archived item in the total count (1)
    const todasButtons = screen.getAllByText('Todas')
    const themeRailTodas = todasButtons[0].closest('button')
    expect(themeRailTodas?.textContent).toContain('1')
  })
})

// ===========================================================================
// 8. Combined filters (theme + status + search)
// ===========================================================================

describe('TabPesquisas — combined filters', () => {
  it('theme + status filters combine correctly', () => {
    const items = makeDiverseItems()
    render(<TabPesquisas items={items} onOpenItem={vi.fn()} />)

    // Filter to IA theme
    fireEvent.click(screen.getByText('IA & Produção'))

    // Then filter to fresca status
    fireEvent.click(screen.getByText('Frescas'))

    // Only IA + fresca item should be visible (ai-1)
    expect(screen.getByText('Tendencias de IA generativa')).toBeDefined()

    // IA + analise should be hidden
    expect(screen.queryByText('LLMs para producao de conteudo')).toBeNull()

    // Other themes should be hidden
    expect(screen.queryByText('Nomadismo digital no Japao')).toBeNull()
  })

  it('items are sorted by updated_at descending', () => {
    const items = [
      makeItem({
        id: 'old',
        title: 'Old research',
        updated_at: '2026-01-01T00:00:00Z',
      }),
      makeItem({
        id: 'new',
        title: 'New research',
        updated_at: '2026-06-01T00:00:00Z',
      }),
      makeItem({
        id: 'mid',
        title: 'Mid research',
        updated_at: '2026-03-15T00:00:00Z',
      }),
    ]
    render(<TabPesquisas items={items} onOpenItem={vi.fn()} />)

    // All items rendered as buttons — find them
    const buttons = screen.getAllByRole('button').filter(btn =>
      btn.className.includes('rcard'),
    )

    // First card should be the newest
    expect(buttons[0].textContent).toContain('New research')
    // Second card should be mid
    expect(buttons[1].textContent).toContain('Mid research')
    // Third card should be oldest
    expect(buttons[2].textContent).toContain('Old research')
  })
})
