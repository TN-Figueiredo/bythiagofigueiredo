import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/cms/blog',
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
  }) => React.createElement('a', { href, ...rest }, children),
}))

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  verticalListSortingStrategy: {},
}))

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Translate: { toString: () => undefined } },
}))

vi.mock('lucide-react', () => ({
  Loader2: () => React.createElement('span', { 'data-testid': 'loader' }),
  Pencil: () => React.createElement('span', null, 'Pencil'),
  MoreVertical: () => React.createElement('span', null, 'More'),
  Trash2: () => React.createElement('span', null, 'Trash'),
  ArrowRight: () => React.createElement('span', null, 'Arrow'),
  Tag: () => React.createElement('span', null, 'TagIcon'),
  Globe: () => React.createElement('span', null, 'Globe'),
  Copy: () => React.createElement('span', null, 'Copy'),
}))

/* ------------------------------------------------------------------ */
/*  Imports under test                                                 */
/* ------------------------------------------------------------------ */

import { KanbanCard } from '../../src/app/cms/(authed)/blog/_tabs/editorial/kanban-card'
import { KanbanColumn } from '../../src/app/cms/(authed)/blog/_tabs/editorial/kanban-column'
import { VelocityStrip } from '../../src/app/cms/(authed)/blog/_tabs/editorial/velocity-strip'
import { HealthStrip } from '../../src/app/cms/(authed)/blog/_shared/health-strip'
import { EmptyState } from '../../src/app/cms/(authed)/blog/_shared/empty-state'
import { LocaleFilterChips } from '../../src/app/cms/(authed)/blog/_shared/locale-filter-chips'
import { TagFilterChips } from '../../src/app/cms/(authed)/blog/_shared/tag-filter-chips'
import type { PostCard, BlogTag } from '../../src/app/cms/(authed)/blog/_hub/hub-types'

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

function makeCard(overrides: Partial<PostCard> = {}): PostCard {
  return {
    id: 'post-1',
    displayId: '#BP-001',
    title: 'Test Post Title',
    status: 'draft',
    tagId: 'tag-1',
    tagName: 'Tech',
    tagColor: '#3b82f6',
    locales: ['pt-BR', 'en'],
    readingTimeMin: 5,
    createdAt: '2026-04-01T10:00:00Z',
    updatedAt: '2026-04-02T10:00:00Z',
    publishedAt: null,
    scheduledFor: null,
    slotDate: null,
    snippet: null,
    ...overrides,
  }
}

function makeTags(): BlogTag[] {
  return [
    { id: 'tag-1', name: 'Tech', slug: 'tech', color: '#3b82f6', colorDark: null, badge: null, sortOrder: 0, postCount: 5 },
    { id: 'tag-2', name: 'Design', slug: 'design', color: '#ec4899', colorDark: null, badge: null, sortOrder: 1, postCount: 3 },
  ]
}

/* ------------------------------------------------------------------ */
/*  Tests: KanbanCard                                                 */
/* ------------------------------------------------------------------ */

describe('KanbanCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders displayId, title, tag badge, and locale badges', () => {
    const card = makeCard()
    render(<KanbanCard card={card} tags={makeTags()} />)

    expect(screen.getByText('#BP-001')).toBeTruthy()
    expect(screen.getByText('Test Post Title')).toBeTruthy()
    expect(screen.getByText('Tech')).toBeTruthy()
    expect(screen.getByText('pt-BR')).toBeTruthy()
    expect(screen.getByText('en')).toBeTruthy()
  })

  it('shows "Untitled" for empty title', () => {
    const card = makeCard({ title: '' })
    render(<KanbanCard card={card} />)

    expect(screen.getByText('Untitled')).toBeTruthy()
  })

  it('opens context menu on right-click', () => {
    const card = makeCard()
    render(<KanbanCard card={card} onDelete={vi.fn()} />)

    const el = screen.getByRole('button', { name: /#BP-001/ })
    fireEvent.contextMenu(el)

    expect(screen.getByText('Open')).toBeTruthy()
    expect(screen.getByText('Move to')).toBeTruthy()
  })

  it('context menu shows valid transition targets for draft status', () => {
    const card = makeCard({ status: 'draft' })
    render(<KanbanCard card={card} onMoveToStatus={vi.fn()} onDelete={vi.fn()} />)

    const el = screen.getByRole('button', { name: /#BP-001/ })
    fireEvent.contextMenu(el)

    // draft -> idea, ready, pending_review, archived
    expect(screen.getByText('idea')).toBeTruthy()
    expect(screen.getByText('ready')).toBeTruthy()
    expect(screen.getByText('pending_review')).toBeTruthy()
    expect(screen.getByText('archived')).toBeTruthy()
  })

  it('context menu shows valid transition targets for published status (only archived)', () => {
    const card = makeCard({ status: 'published' })
    render(<KanbanCard card={card} onMoveToStatus={vi.fn()} />)

    const el = screen.getByRole('button', { name: /#BP-001/ })
    fireEvent.contextMenu(el)

    expect(screen.getByText('archived')).toBeTruthy()
    expect(screen.queryByText('draft')).toBeNull()
  })

  it('delete option shows only for idea/draft/archived', () => {
    const onDelete = vi.fn()

    // draft => should show delete
    const { unmount } = render(<KanbanCard card={makeCard({ status: 'draft' })} onDelete={onDelete} />)
    fireEvent.contextMenu(screen.getByRole('button', { name: /#BP-001/ }))
    expect(screen.getByText('Delete')).toBeTruthy()
    unmount()

    // ready => should NOT show delete
    render(<KanbanCard card={makeCard({ status: 'ready' })} onDelete={onDelete} />)
    fireEvent.contextMenu(screen.getByRole('button', { name: /#BP-001/ }))
    expect(screen.queryByText('Delete')).toBeNull()
  })

  it('space key triggers navigation (a11y)', () => {
    const card = makeCard()
    render(<KanbanCard card={card} />)

    const el = screen.getByRole('button', { name: /#BP-001/ })
    fireEvent.keyDown(el, { key: ' ' })

    expect(mockPush).toHaveBeenCalledWith('/cms/blog/post-1/edit')
  })

  it('has correct aria-label with displayId and title', () => {
    const card = makeCard()
    render(<KanbanCard card={card} />)

    const el = screen.getByRole('button', { name: '#BP-001 Test Post Title' })
    expect(el).toBeTruthy()
  })
})

/* ------------------------------------------------------------------ */
/*  Tests: KanbanColumn                                               */
/* ------------------------------------------------------------------ */

describe('KanbanColumn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders column header with title and count', () => {
    const cards = [makeCard(), makeCard({ id: 'post-2', displayId: '#BP-002' })]
    render(<KanbanColumn id="draft" title="Draft" cards={cards} />)

    expect(screen.getByText('Draft')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('shows QuickAddInput only for idea column', () => {
    const onQuickAdd = vi.fn()

    // idea column => should have input
    const { unmount } = render(
      <KanbanColumn id="idea" title="Idea" cards={[]} onQuickAdd={onQuickAdd} />,
    )
    expect(screen.getByPlaceholderText('Quick idea…')).toBeTruthy()
    unmount()

    // draft column => no input
    render(<KanbanColumn id="draft" title="Draft" cards={[]} onQuickAdd={onQuickAdd} />)
    expect(screen.queryByPlaceholderText('Quick idea…')).toBeNull()
  })

  it('shows "View all published" link when published column has 15+ cards', () => {
    const cards = Array.from({ length: 16 }, (_, i) =>
      makeCard({ id: `p-${i}`, displayId: `#BP-${String(i).padStart(3, '0')}`, status: 'published' }),
    )
    render(<KanbanColumn id="published" title="Published" cards={cards} />)

    expect(screen.getByText(/View all published/)).toBeTruthy()
  })

  it('does NOT show "View all published" link when published column has fewer than 15 cards', () => {
    const cards = Array.from({ length: 5 }, (_, i) =>
      makeCard({ id: `p-${i}`, displayId: `#BP-${String(i).padStart(3, '0')}`, status: 'published' }),
    )
    render(<KanbanColumn id="published" title="Published" cards={cards} />)

    expect(screen.queryByText(/View all published/)).toBeNull()
  })

  it('renders aria-label with column name and count', () => {
    const cards = [makeCard()]
    render(<KanbanColumn id="draft" title="Draft" cards={cards} />)

    expect(screen.getByLabelText('Draft column, 1 items')).toBeTruthy()
  })
})

/* ------------------------------------------------------------------ */
/*  Tests: VelocityStrip                                              */
/* ------------------------------------------------------------------ */

describe('VelocityStrip', () => {
  it('renders throughput, avg days, moved count, and bottleneck', () => {
    const velocity = {
      throughput: 8,
      avgIdeaToPublished: 14,
      movedThisWeek: 3,
      bottleneck: { column: 'Review', avgDays: 5 },
    }
    render(<VelocityStrip velocity={velocity} />)

    expect(screen.getByText('8/mo')).toBeTruthy()
    expect(screen.getByText('14 d')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('Review')).toBeTruthy()
  })

  it('renders dash for avgIdeaToPublished when zero', () => {
    const velocity = {
      throughput: 0,
      avgIdeaToPublished: 0,
      movedThisWeek: 0,
      bottleneck: null,
    }
    render(<VelocityStrip velocity={velocity} />)

    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.getByText('None')).toBeTruthy()
  })
})

/* ------------------------------------------------------------------ */
/*  Tests: HealthStrip                                                */
/* ------------------------------------------------------------------ */

describe('HealthStrip', () => {
  it('renders metric cards', () => {
    const metrics = [
      { label: 'Posts', value: 42 },
      { label: 'Rate', value: '95%' },
    ]
    render(<HealthStrip metrics={metrics} />)

    expect(screen.getByText('Posts')).toBeTruthy()
    expect(screen.getByText('42')).toBeTruthy()
    expect(screen.getByText('Rate')).toBeTruthy()
    expect(screen.getByText('95%')).toBeTruthy()
  })

  it('has role="group" and aria-label', () => {
    render(<HealthStrip metrics={[{ label: 'X', value: 1 }]} />)

    const group = screen.getByRole('group', { name: 'Key metrics' })
    expect(group).toBeTruthy()
  })

  it('applies custom color to metric value', () => {
    const metrics = [{ label: 'Status', value: 'OK', color: '#22c55e' }]
    render(<HealthStrip metrics={metrics} />)

    const valueEl = screen.getByText('OK')
    expect(valueEl.style.color).toBe('#22c55e')
  })
})

/* ------------------------------------------------------------------ */
/*  Tests: EmptyState                                                 */
/* ------------------------------------------------------------------ */

describe('EmptyState', () => {
  it('renders heading, description, and action', () => {
    render(
      <EmptyState
        icon={<span>Icon</span>}
        heading="No posts yet"
        description="Create your first post"
        action={<button>Create</button>}
      />,
    )

    expect(screen.getByText('No posts yet')).toBeTruthy()
    expect(screen.getByText('Create your first post')).toBeTruthy()
    expect(screen.getByText('Create')).toBeTruthy()
  })

  it('has role="status"', () => {
    render(<EmptyState icon={<span>X</span>} heading="Empty" />)

    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('renders without description and action', () => {
    render(<EmptyState icon={<span>X</span>} heading="Empty" />)

    expect(screen.getByText('Empty')).toBeTruthy()
  })
})

/* ------------------------------------------------------------------ */
/*  Tests: LocaleFilterChips                                          */
/* ------------------------------------------------------------------ */

describe('LocaleFilterChips', () => {
  it('renders as a select dropdown with locale options', () => {
    const onSelect = vi.fn()
    render(
      <LocaleFilterChips
        locales={['pt-BR', 'en']}
        selectedLocale={null}
        onSelect={onSelect}
        allLabel="All"
      />,
    )

    const select = screen.getByLabelText('Locale filter') as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')
    expect(select.value).toBe('')
  })

  it('onChange calls onSelect with locale value', () => {
    const onSelect = vi.fn()
    render(
      <LocaleFilterChips
        locales={['pt-BR', 'en']}
        selectedLocale={null}
        onSelect={onSelect}
        allLabel="All"
      />,
    )

    const select = screen.getByLabelText('Locale filter')
    fireEvent.change(select, { target: { value: 'pt-BR' } })

    expect(onSelect).toHaveBeenCalledWith('pt-BR')
  })

  it('onChange calls onSelect with null when "All" is selected', () => {
    const onSelect = vi.fn()
    render(
      <LocaleFilterChips
        locales={['pt-BR', 'en']}
        selectedLocale="pt-BR"
        onSelect={onSelect}
        allLabel="All"
      />,
    )

    const select = screen.getByLabelText('Locale filter')
    fireEvent.change(select, { target: { value: '' } })

    expect(onSelect).toHaveBeenCalledWith(null)
  })
})

/* ------------------------------------------------------------------ */
/*  Tests: TagFilterChips                                             */
/* ------------------------------------------------------------------ */

describe('TagFilterChips', () => {
  const tags = makeTags()

  it('renders "All" chip plus tag chips with counts', () => {
    render(
      <TagFilterChips
        tags={tags}
        selectedTagId={null}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        allLabel="All"
      />,
    )

    expect(screen.getByText('All')).toBeTruthy()
    expect(screen.getByText('Tech')).toBeTruthy()
    expect(screen.getByText('Design')).toBeTruthy()
    // Post counts
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('clicking a tag calls onSelect with tagId', () => {
    const onSelect = vi.fn()
    render(
      <TagFilterChips
        tags={tags}
        selectedTagId={null}
        onSelect={onSelect}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        allLabel="All"
      />,
    )

    fireEvent.click(screen.getByText('Tech'))
    expect(onSelect).toHaveBeenCalledWith('tag-1')
  })

  it('clicking "All" calls onSelect with null', () => {
    const onSelect = vi.fn()
    render(
      <TagFilterChips
        tags={tags}
        selectedTagId="tag-1"
        onSelect={onSelect}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        allLabel="All"
      />,
    )

    fireEvent.click(screen.getByText('All'))
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('has radiogroup role and aria-checked attributes', () => {
    render(
      <TagFilterChips
        tags={tags}
        selectedTagId="tag-1"
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        allLabel="All"
      />,
    )

    const radioGroup = screen.getByRole('radiogroup', { name: 'Filter by tag' })
    expect(radioGroup).toBeTruthy()

    const allRadio = screen.getByRole('radio', { name: 'All' })
    expect(allRadio.getAttribute('aria-checked')).toBe('false')

    const techRadios = screen.getAllByRole('radio')
    const techRadio = techRadios.find((r) => r.textContent?.includes('Tech'))
    expect(techRadio?.getAttribute('aria-checked')).toBe('true')
  })

  it('renders add tag button', () => {
    const onAdd = vi.fn()
    render(
      <TagFilterChips
        tags={tags}
        selectedTagId={null}
        onSelect={vi.fn()}
        onAdd={onAdd}
        onEdit={vi.fn()}
        allLabel="All"
      />,
    )

    const addBtn = screen.getByTestId('add-tag-chip')
    fireEvent.click(addBtn)
    expect(onAdd).toHaveBeenCalled()
  })
})
