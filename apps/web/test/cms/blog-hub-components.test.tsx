/**
 * @vitest-environment happy-dom
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

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
    attributes: { role: 'button', tabIndex: 0 },
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  verticalListSortingStrategy: {},
  sortableKeyboardCoordinates: vi.fn(),
  arrayMove: vi.fn(),
}))

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
  DndContext: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  DragOverlay: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  closestCorners: vi.fn(),
  PointerSensor: vi.fn(),
  KeyboardSensor: vi.fn(),
  TouchSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
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
  Sparkles: () => React.createElement('span', null, 'Sparkles'),
  Minus: () => React.createElement('span', null, 'Minus'),
  Kanban: () => React.createElement('span', null, 'Kanban'),
  Plus: () => React.createElement('span', null, 'Plus'),
}))

vi.mock('../../src/app/cms/(authed)/blog/actions', () => ({
  movePost: vi.fn().mockResolvedValue({ ok: true }),
  deleteHubPost: vi.fn().mockResolvedValue({ ok: true }),
  reassignTag: vi.fn().mockResolvedValue({ ok: true }),
  addLocale: vi.fn().mockResolvedValue({ ok: true }),
  removeTranslationLocale: vi.fn().mockResolvedValue({ ok: true }),
  duplicatePost: vi.fn().mockResolvedValue({ ok: true }),
  createPostFromPipeline: vi.fn().mockResolvedValue({ ok: true, postId: 'new-post' }),
  returnToPipeline: vi.fn().mockResolvedValue({ ok: true }),
  bulkPublish: vi.fn().mockResolvedValue({ ok: true, count: 0 }),
  bulkArchive: vi.fn().mockResolvedValue({ ok: true, count: 0 }),
  bulkDelete: vi.fn().mockResolvedValue({ ok: true, count: 0 }),
}))

vi.mock('../../src/app/cms/(authed)/pipeline/actions', () => ({
  movePipelineItemToStage: vi.fn().mockResolvedValue({ ok: true }),
  reorderPipelineItem: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('../../src/app/cms/(authed)/blog/tag-actions', () => ({
  createTag: vi.fn().mockResolvedValue({ ok: true, tagId: 'new-tag' }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

/* ------------------------------------------------------------------ */
/*  Imports under test                                                 */
/* ------------------------------------------------------------------ */

import { EditorialTab } from '../../src/app/cms/(authed)/blog/_tabs/editorial/editorial-tab'
import { HealthStrip } from '../../src/app/cms/(authed)/blog/_shared/health-strip'
import { EmptyState } from '../../src/app/cms/(authed)/blog/_shared/empty-state'
import { LocaleFilterChips } from '../../src/app/cms/(authed)/blog/_shared/locale-filter-chips'
import { TagFilterChips } from '../../src/app/cms/(authed)/blog/_shared/tag-filter-chips'
import type { PostCard, BlogTag, EditorialTabData } from '../../src/app/cms/(authed)/blog/_hub/hub-types'

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
    tagNameTranslations: null,
    locales: ['pt-BR', 'en'],
    readingTimeMin: 5,
    createdAt: '2026-04-01T10:00:00Z',
    updatedAt: '2026-04-02T10:00:00Z',
    publishedAt: null,
    scheduledFor: null,
    slotDate: null,
    snippet: null,
    coverImageUrl: null,
    excerpt: null,
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

/* ------------------------------------------------------------------ */
/*  Tests: EditorialTab KPI bar                                        */
/* ------------------------------------------------------------------ */

describe('EditorialTab KPI bar', () => {
  const mockData: EditorialTabData = {
    velocity: {
      throughput: 4,
      avgIdeaToPublished: 12,
      movedThisWeek: 2,
      bottleneck: null,
      totalPosts: 12,
      publishedCount: 8,
    },
    posts: [
      makeCard({ id: 'p1', displayId: '#BP-001', title: 'Post 1', status: 'draft' }),
    ],
  }

  it('renders KPI metrics inline', () => {
    render(<EditorialTab data={mockData} pipelineData={[]} siteId="site-1" />)
    expect(screen.getByText('12')).toBeTruthy() // totalPosts (0 pipeline + 12 posts = 12 total)
    expect(screen.getByText('8')).toBeTruthy() // publishedCount
    expect(screen.getByText('4/mo')).toBeTruthy() // throughput
    expect(screen.getByText('12d')).toBeTruthy() // avgIdeaToPublished
  })

  it('renders "None" for bottleneck when null', () => {
    render(<EditorialTab data={mockData} pipelineData={[]} siteId="site-1" />)
    expect(screen.getByText('None')).toBeTruthy()
  })

  it('renders dash for avgIdeaToPublished when zero', () => {
    const dataWithZeroAvg: EditorialTabData = {
      ...mockData,
      velocity: { ...mockData.velocity, avgIdeaToPublished: 0 },
    }
    render(<EditorialTab data={dataWithZeroAvg} pipelineData={[]} siteId="site-1" />)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('renders bottleneck column name when present', () => {
    const dataWithBottleneck: EditorialTabData = {
      ...mockData,
      velocity: { ...mockData.velocity, bottleneck: { column: 'Review', avgDays: 5 } },
    }
    render(<EditorialTab data={dataWithBottleneck} pipelineData={[]} siteId="site-1" />)
    expect(screen.getByText('Review')).toBeTruthy()
  })
})

