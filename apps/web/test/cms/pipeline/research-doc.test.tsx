import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import type { ResearchItemFull, ResearchDecision } from '@/lib/pipeline/research-types'
import { STATUS_META, THEME_META, SOURCE_META } from '@/lib/pipeline/research-types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRefresh = vi.fn()
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: mockPush,
    replace: vi.fn(),
  }),
  usePathname: () => '/cms/pipeline/research',
}))

const mockSaveResearchItem = vi.fn().mockResolvedValue({ ok: true })
const mockUpdateResearchStatus = vi.fn().mockResolvedValue({ ok: true })
vi.mock('@/app/cms/(authed)/pipeline/research/actions', () => ({
  saveResearchItem: (...args: unknown[]) => mockSaveResearchItem(...args),
  updateResearchStatus: (...args: unknown[]) => mockUpdateResearchStatus(...args),
}))

const mockSanitize = vi.fn((html: string) => html)
vi.mock('@/lib/pipeline/sanitize-html', () => ({
  sanitizeContentHtml: (html: string) => mockSanitize(html),
}))

// Import after mocks
import { ResearchDoc } from '@/app/cms/(authed)/pipeline/research/_components/research-doc'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<ResearchItemFull> = {}): ResearchItemFull {
  return {
    id: 'item-1',
    title: 'Test Research',
    topic_id: null,
    theme_id: 'ia',
    source: 'cowork',
    summary: 'A summary',
    content_json: null,
    content_md: null,
    content_html: '<p>Content</p>',
    status: 'fresca',
    word_count: 150,
    read_min: 2,
    pinned: false,
    takeaways: ['Takeaway 1', 'Takeaway 2'],
    sources: [],
    version: 1,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    linked_items: [],
    ...overrides,
  }
}

function makeDecision(overrides: Partial<ResearchDecision> = {}): ResearchDecision {
  return {
    id: 'dec-1',
    site_id: 's',
    title: 'Decision Alpha',
    rationale: null,
    horizon: 'agora',
    status: 'decidido',
    theme_id: null,
    date_label: null,
    drives: [],
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...overrides,
  }
}

const defaultProps = () => ({
  item: makeItem(),
  onBack: vi.fn(),
  onItemUpdated: vi.fn(),
  onMakeDecision: vi.fn(),
  onOpenDecision: vi.fn(),
  linkedDecisions: [] as ResearchDecision[],
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// 1. Render tests
// ---------------------------------------------------------------------------

describe('ResearchDoc — render', () => {
  it('renders the title', () => {
    const props = defaultProps()
    render(<ResearchDoc {...props} />)
    expect(screen.getByText('Test Research')).toBeDefined()
  })

  it('renders the summary', () => {
    const props = defaultProps()
    render(<ResearchDoc {...props} />)
    expect(screen.getByText('A summary')).toBeDefined()
  })

  it('renders StatusBadge with correct status label', () => {
    const props = defaultProps()
    const { container } = render(<ResearchDoc {...props} />)
    const badge = container.querySelector('.badge')
    expect(badge).not.toBeNull()
    expect(badge!.textContent).toContain(STATUS_META.fresca.label)
  })

  it('renders SourceTag with correct source label', () => {
    const props = defaultProps()
    render(<ResearchDoc {...props} />)
    const expected = SOURCE_META.cowork.label
    expect(screen.getByText(expected)).toBeDefined()
  })

  it('renders read time "X min de leitura"', () => {
    const props = defaultProps()
    const { container } = render(<ResearchDoc {...props} />)
    expect(container.textContent).toContain('2 min de leitura')
  })

  it('renders date via formatRelativeDate', () => {
    const props = defaultProps()
    const { container } = render(<ResearchDoc {...props} />)
    // pt-BR date for 2026-06-01 → "01 de jun. de 2026" (locale-dependent format)
    const formatted = new Date('2026-06-01T00:00:00Z').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    expect(container.textContent).toContain(formatted)
  })

  it('renders theme badge/dot when theme_id is set', () => {
    const props = defaultProps()
    const { container } = render(<ResearchDoc {...props} />)
    // Theme label appears in doc-bar-crumb
    const meta = THEME_META.ia
    expect(container.textContent).toContain(meta.label)
    // Colored dot present
    const dot = container.querySelector('.tdot')
    expect(dot).not.toBeNull()
    expect(dot!.getAttribute('style')).toContain(meta.color)
  })

  it('does NOT render theme badge when theme_id is null', () => {
    const props = defaultProps()
    props.item = makeItem({ theme_id: null as unknown as string })
    const { container } = render(<ResearchDoc {...props} />)
    // No crumb with theme label
    const crumb = container.querySelector('.doc-bar-crumb')
    expect(crumb).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 2. Content rendering
// ---------------------------------------------------------------------------

describe('ResearchDoc — content', () => {
  it('renders HTML content in the TipTap editor', () => {
    const props = defaultProps()
    const { container } = render(<ResearchDoc {...props} />)
    // Content is rendered by the TipTap editor (ProseMirror), not raw HTML
    expect(container.querySelector('.tt-wrap')).not.toBeNull()
    expect(screen.getByText('Content')).toBeDefined()
  })

  it('renders markdown fallback when content_html is null but content_md exists', () => {
    const props = defaultProps()
    props.item = makeItem({ content_html: null, content_md: '# Markdown content' })
    const { container } = render(<ResearchDoc {...props} />)
    const pre = container.querySelector('pre')
    expect(pre).not.toBeNull()
    expect(pre!.textContent).toBe('# Markdown content')
  })

  it('mounts an empty TipTap editor when both content_html and content_md are null', () => {
    const props = defaultProps()
    props.item = makeItem({ content_html: null, content_md: null })
    const { container } = render(<ResearchDoc {...props} />)
    // No crash; the editor still mounts (empty), no legacy "Sem conteudo." message
    expect(container.querySelector('.tt-wrap')).not.toBeNull()
    expect(screen.queryByText('Sem conteudo.')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 3. Takeaways
// ---------------------------------------------------------------------------

describe('ResearchDoc — takeaways', () => {
  it('renders takeaway list with correct count', () => {
    const props = defaultProps()
    const { container } = render(<ResearchDoc {...props} />)
    const takeaways = container.querySelectorAll('.takeaway')
    expect(takeaways).toHaveLength(2)
  })

  it('renders takeaway text content', () => {
    const props = defaultProps()
    render(<ResearchDoc {...props} />)
    expect(screen.getByText('Takeaway 1')).toBeDefined()
    expect(screen.getByText('Takeaway 2')).toBeDefined()
  })

  it('each takeaway has an arrow button for "make decision"', () => {
    const props = defaultProps()
    const { container } = render(<ResearchDoc {...props} />)
    const actionBtns = container.querySelectorAll('.tk-act')
    expect(actionBtns).toHaveLength(2)
    // Each button has a title indicating its purpose
    actionBtns.forEach((btn) => {
      expect(btn.getAttribute('title')).toBe('Criar decisao a partir deste takeaway')
    })
  })

  it('clicking arrow calls onMakeDecision with takeaway text and themeId', () => {
    const props = defaultProps()
    const { container } = render(<ResearchDoc {...props} />)
    const actionBtns = container.querySelectorAll('.tk-act')
    fireEvent.click(actionBtns[0])
    // Now also carries the source research id (provenance for the decision)
    expect(props.onMakeDecision).toHaveBeenCalledWith('Takeaway 1', 'ia', 'item-1')

    fireEvent.click(actionBtns[1])
    expect(props.onMakeDecision).toHaveBeenCalledWith('Takeaway 2', 'ia', 'item-1')
  })

  it('shows empty state "Nenhum takeaway ainda." when takeaways is empty', () => {
    const props = defaultProps()
    props.item = makeItem({ takeaways: [] })
    render(<ResearchDoc {...props} />)
    expect(screen.getByText('Nenhum takeaway ainda.')).toBeDefined()
  })

  it('does not render arrow buttons when onMakeDecision is not provided', () => {
    const props = defaultProps()
    props.onMakeDecision = undefined
    const { container } = render(<ResearchDoc {...props} />)
    const actionBtns = container.querySelectorAll('.tk-act')
    expect(actionBtns).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 4. Status dropdown
// ---------------------------------------------------------------------------

describe('ResearchDoc — status dropdown', () => {
  it('renders all status options', () => {
    const props = defaultProps()
    const { container } = render(<ResearchDoc {...props} />)
    const select = container.querySelector('select')
    expect(select).not.toBeNull()
    const options = select!.querySelectorAll('option')
    const expectedKeys = Object.keys(STATUS_META)
    expect(options).toHaveLength(expectedKeys.length)
    expectedKeys.forEach((key, i) => {
      expect(options[i].value).toBe(key)
      expect(options[i].textContent).toBe(STATUS_META[key as keyof typeof STATUS_META].label)
    })
  })

  it('shows current status as selected', () => {
    const props = defaultProps()
    const { container } = render(<ResearchDoc {...props} />)
    const select = container.querySelector('select') as HTMLSelectElement
    expect(select.value).toBe('fresca')
  })

  it('calls updateResearchStatus when status changes', async () => {
    const props = defaultProps()
    const { container } = render(<ResearchDoc {...props} />)
    const select = container.querySelector('select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'analise' } })

    await waitFor(() => {
      expect(mockUpdateResearchStatus).toHaveBeenCalledWith('item-1', 'analise', 1)
    })
  })
})

// ---------------------------------------------------------------------------
// 5. Mode toggle
// ---------------------------------------------------------------------------

describe('ResearchDoc — mode toggle', () => {
  it('default mode is "read" — Ler button has class "on"', () => {
    const props = defaultProps()
    const { container } = render(<ResearchDoc {...props} />)
    const segBtns = container.querySelectorAll('.seg button')
    // First button = Ler, Second = Editar
    expect(segBtns[0].className).toContain('on')
    expect(segBtns[1].className).not.toContain('on')
  })

  it('clicking "Editar" switches to edit mode', () => {
    const props = defaultProps()
    const { container } = render(<ResearchDoc {...props} />)
    const editarBtn = screen.getByText('Editar').closest('button')!
    fireEvent.click(editarBtn)

    const segBtns = container.querySelectorAll('.seg button')
    expect(segBtns[0].className).not.toContain('on')
    expect(segBtns[1].className).toContain('on')
  })

  it('clicking "Ler" switches back to read mode', () => {
    const props = defaultProps()
    const { container } = render(<ResearchDoc {...props} />)
    // Switch to edit first
    fireEvent.click(screen.getByText('Editar').closest('button')!)
    // Switch back to read
    fireEvent.click(screen.getByText('Ler').closest('button')!)

    const segBtns = container.querySelectorAll('.seg button')
    expect(segBtns[0].className).toContain('on')
    expect(segBtns[1].className).not.toContain('on')
  })

  it('edit mode shows the TipTap toolbar', () => {
    const props = defaultProps()
    const { container } = render(<ResearchDoc {...props} />)
    fireEvent.click(screen.getByText('Editar').closest('button')!)
    // The sticky formatting toolbar renders only in edit mode
    expect(container.querySelector('.tt-toolbar')).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 6. Navigation
// ---------------------------------------------------------------------------

describe('ResearchDoc — navigation', () => {
  it('back button calls onBack', () => {
    const props = defaultProps()
    render(<ResearchDoc {...props} />)
    const backBtn = screen.getByText('Pesquisas').closest('button')!
    fireEvent.click(backBtn)
    expect(props.onBack).toHaveBeenCalledTimes(1)
  })

  it('back button text is "Pesquisas"', () => {
    const props = defaultProps()
    render(<ResearchDoc {...props} />)
    expect(screen.getByText('Pesquisas')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 7. Authorship footer
// ---------------------------------------------------------------------------

describe('ResearchDoc — authorship footer', () => {
  it('shows "Escrito pelo Claude Cowork" for source="cowork"', () => {
    const props = defaultProps()
    const { container } = render(<ResearchDoc {...props} />)
    const footer = container.querySelector('.insp-foot')
    expect(footer).not.toBeNull()
    expect(footer!.textContent).toContain('Escrito pelo Claude Cowork')
  })

  it('shows "Voce editou" for source="thiago"', () => {
    const props = defaultProps()
    props.item = makeItem({ source: 'thiago' })
    const { container } = render(<ResearchDoc {...props} />)
    const footer = container.querySelector('.insp-foot')
    expect(footer!.textContent).toContain('Voce editou')
  })

  it('shows "Cowork + voce" for source="dupla"', () => {
    const props = defaultProps()
    props.item = makeItem({ source: 'dupla' })
    const { container } = render(<ResearchDoc {...props} />)
    const footer = container.querySelector('.insp-foot')
    expect(footer!.textContent).toContain('Cowork + voce')
  })
})

// ---------------------------------------------------------------------------
// 8. Linked decisions
// ---------------------------------------------------------------------------

describe('ResearchDoc — linked decisions', () => {
  it('shows empty state when no linkedDecisions', () => {
    const props = defaultProps()
    render(<ResearchDoc {...props} />)
    expect(screen.getByText('Nenhuma ainda. Transforme um takeaway em decisao.')).toBeDefined()
  })

  it('renders decision cards when linkedDecisions provided', () => {
    const props = defaultProps()
    props.linkedDecisions = [
      makeDecision({ id: 'dec-1', title: 'Decision Alpha' }),
      makeDecision({ id: 'dec-2', title: 'Decision Beta' }),
    ]
    render(<ResearchDoc {...props} />)
    expect(screen.getByText('Decision Alpha')).toBeDefined()
    expect(screen.getByText('Decision Beta')).toBeDefined()
  })

  it('clicking a decision card calls onOpenDecision with decision id', () => {
    const props = defaultProps()
    props.linkedDecisions = [makeDecision({ id: 'dec-42', title: 'Open me' })]
    render(<ResearchDoc {...props} />)
    const btn = screen.getByText('Open me').closest('button')!
    fireEvent.click(btn)
    expect(props.onOpenDecision).toHaveBeenCalledWith('dec-42')
  })
})
