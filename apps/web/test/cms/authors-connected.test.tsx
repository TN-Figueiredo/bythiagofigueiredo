import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

vi.mock('@/app/cms/(authed)/authors/actions', () => ({
  createAuthor: vi.fn().mockResolvedValue({ ok: true }),
  updateAuthor: vi.fn().mockResolvedValue({ ok: true }),
  deleteAuthor: vi.fn().mockResolvedValue({ ok: true }),
  setDefaultAuthor: vi.fn().mockResolvedValue({ ok: true }),
  reorderAuthors: vi.fn().mockResolvedValue({ ok: true }),
}))

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

const mockAuthors = [
  {
    id: 'a1',
    displayName: 'John Doe',
    slug: 'john-doe',
    bio: 'A prolific writer',
    avatarUrl: null,
    avatarColor: '#6366f1',
    initials: 'JD',
    userId: 'u1',
    socialLinks: { twitter: 'https://twitter.com/johndoe' },
    sortOrder: 0,
    isDefault: true,
    postsCount: 5,
  },
  {
    id: 'a2',
    displayName: 'Jane Smith',
    slug: 'jane-smith',
    bio: null,
    avatarUrl: 'https://example.com/avatar.jpg',
    avatarColor: null,
    initials: 'JS',
    userId: null,
    socialLinks: {},
    sortOrder: 1,
    isDefault: false,
    postsCount: 0,
  },
  {
    id: 'a3',
    displayName: 'Bot Author',
    slug: 'bot-author',
    bio: 'Virtual author for automated content',
    avatarUrl: null,
    avatarColor: '#ec4899',
    initials: 'BA',
    userId: null,
    socialLinks: {},
    sortOrder: 2,
    isDefault: false,
    postsCount: 2,
  },
]

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

async function renderAuthors(
  overrides: Record<string, unknown> = {},
) {
  const { AuthorsConnected } = await import(
    '@/app/cms/(authed)/authors/authors-connected'
  )
  return render(
    <AuthorsConnected
      authors={mockAuthors}
      readOnly={false}
      {...overrides}
    />,
  )
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('AuthorsConnected', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /* ---- Rendering ---- */

  it('renders all author cards', async () => {
    await renderAuthors()
    expect(screen.getByText('John Doe')).toBeTruthy()
    expect(screen.getByText('Jane Smith')).toBeTruthy()
    expect(screen.getByText('Bot Author')).toBeTruthy()
  })

  it('renders filter pills with counts', async () => {
    await renderAuthors()
    expect(screen.getByRole('tab', { name: /all/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /linked/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /virtual/i })).toBeTruthy()
    expect(screen.getByText('(3)')).toBeTruthy() // all count
    expect(screen.getByText('(1)')).toBeTruthy() // linked count
    expect(screen.getByText('(2)')).toBeTruthy() // virtual count
  })

  it('renders Create Author button', async () => {
    await renderAuthors()
    expect(
      screen.getByTestId('create-author-btn'),
    ).toBeTruthy()
  })

  /* ---- Filtering ---- */

  it('filters to linked authors only', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByRole('tab', { name: /linked/i }))
    expect(screen.getByText('John Doe')).toBeTruthy()
    expect(screen.queryByText('Jane Smith')).toBeNull()
    expect(screen.queryByText('Bot Author')).toBeNull()
  })

  it('filters to virtual authors only', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByRole('tab', { name: /virtual/i }))
    expect(screen.queryByText('John Doe')).toBeNull()
    expect(screen.getByText('Jane Smith')).toBeTruthy()
    expect(screen.getByText('Bot Author')).toBeTruthy()
  })

  it('switches back to All filter', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByRole('tab', { name: /virtual/i }))
    fireEvent.click(screen.getByRole('tab', { name: /all/i }))
    expect(screen.getByText('John Doe')).toBeTruthy()
    expect(screen.getByText('Jane Smith')).toBeTruthy()
  })

  /* ---- Author card details ---- */

  it('shows type badge Linked for authors with userId', async () => {
    await renderAuthors()
    const linkedBadges = screen.getAllByText('Linked')
    expect(linkedBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows type badge Virtual for authors without userId', async () => {
    await renderAuthors()
    const virtualBadges = screen.getAllByText('Virtual')
    expect(virtualBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows Default badge for default author', async () => {
    await renderAuthors()
    expect(screen.getByText('Default')).toBeTruthy()
  })

  it('shows post count on cards', async () => {
    await renderAuthors()
    expect(screen.getByText('5 posts')).toBeTruthy()
    expect(screen.getByText('0 posts')).toBeTruthy()
    expect(screen.getByText('2 posts')).toBeTruthy()
  })

  it('shows bio text on card when present', async () => {
    await renderAuthors()
    expect(screen.getByText('A prolific writer')).toBeTruthy()
  })

  it('shows slug on card', async () => {
    await renderAuthors()
    expect(screen.getByText('@john-doe')).toBeTruthy()
  })

  it('renders initials when no avatar URL', async () => {
    await renderAuthors()
    expect(screen.getByText('JD')).toBeTruthy()
    expect(screen.getByText('BA')).toBeTruthy()
  })

  /* ---- Detail panel ---- */

  it('opens detail panel on card click', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('author-card-a1'))
    expect(screen.getByTestId('detail-panel')).toBeTruthy()
    expect(screen.getByText('Author Details')).toBeTruthy()
  })

  it('closes detail panel on close button click', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('author-card-a1'))
    expect(screen.getByTestId('detail-panel')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Close panel'))
    expect(screen.queryByTestId('detail-panel')).toBeNull()
  })

  it('closes detail panel on backdrop click', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('author-card-a1'))
    expect(screen.getByTestId('detail-panel')).toBeTruthy()
    fireEvent.click(screen.getByTestId('detail-backdrop'))
    expect(screen.queryByTestId('detail-panel')).toBeNull()
  })

  it('shows edit form in detail panel', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('author-card-a1'))
    expect(screen.getByLabelText('Display Name')).toBeTruthy()
    expect(screen.getByLabelText('Bio')).toBeTruthy()
    expect(screen.getByLabelText('Avatar Color')).toBeTruthy()
  })

  it('shows social links in detail panel', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('author-card-a1'))
    expect(screen.getByText('twitter:')).toBeTruthy()
    expect(
      screen.getByText('https://twitter.com/johndoe'),
    ).toBeTruthy()
  })

  it('shows post count in detail panel', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('author-card-a1'))
    expect(screen.getByText('5 posts assigned')).toBeTruthy()
  })

  it('shows delete button in detail panel', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('author-card-a2'))
    expect(screen.getByTestId('delete-author-btn')).toBeTruthy()
  })

  it('shows Set as Default Author button for non-default author', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('author-card-a2'))
    expect(screen.getByText('Set as Default Author')).toBeTruthy()
  })

  it('hides Set as Default Author button for default author', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('author-card-a1'))
    expect(screen.queryByText('Set as Default Author')).toBeNull()
  })

  it('shows confirm delete dialog on Delete Author click', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('author-card-a2'))
    fireEvent.click(screen.getByTestId('delete-author-btn'))
    expect(screen.getByTestId('confirm-delete-btn')).toBeTruthy()
  })

  it('disables confirm delete when author has posts', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('author-card-a1')) // has 5 posts
    fireEvent.click(screen.getByTestId('delete-author-btn'))
    const confirmBtn = screen.getByTestId(
      'confirm-delete-btn',
    ) as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)
    expect(
      screen.getByText(/reassign/i),
    ).toBeTruthy()
  })

  /* ---- Create form ---- */

  it('shows create form when Create Author button is clicked', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('create-author-btn'))
    expect(screen.getByTestId('create-author-form')).toBeTruthy()
  })

  it('hides Create Author button when form is open', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('create-author-btn'))
    expect(
      screen.queryByTestId('create-author-btn'),
    ).toBeNull()
  })

  it('shows name input in create form', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('create-author-btn'))
    expect(screen.getByLabelText('Name')).toBeTruthy()
  })

  it('shows cancel button in create form', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('create-author-btn'))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByTestId('create-author-form')).toBeNull()
  })

  it('shows validation error when submitting empty name', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('create-author-btn'))
    fireEvent.click(
      screen.getByRole('button', { name: /create author/i }),
    )
    expect(screen.getByText('Name is required')).toBeTruthy()
  })

  /* ---- Empty state ---- */

  it('shows empty state when no authors', async () => {
    await renderAuthors({ authors: [] })
    expect(screen.getByTestId('empty-state')).toBeTruthy()
    expect(
      screen.getByText(/no authors yet/i),
    ).toBeTruthy()
  })

  it('shows filtered empty state', async () => {
    const singleLinked = [mockAuthors[0]]
    await renderAuthors({ authors: singleLinked })
    fireEvent.click(screen.getByRole('tab', { name: /virtual/i }))
    expect(
      screen.getByText(/no virtual authors found/i),
    ).toBeTruthy()
  })

  /* ---- Read-only mode ---- */

  it('hides Create Author button in read-only mode', async () => {
    await renderAuthors({ readOnly: true })
    expect(
      screen.queryByTestId('create-author-btn'),
    ).toBeNull()
  })

  it('disables inputs in detail panel when read-only', async () => {
    await renderAuthors({ readOnly: true })
    fireEvent.click(screen.getByTestId('author-card-a1'))
    const nameInput = screen.getByLabelText(
      'Display Name',
    ) as HTMLInputElement
    expect(nameInput.disabled).toBe(true)
  })

  it('hides save button in detail panel when read-only', async () => {
    await renderAuthors({ readOnly: true })
    fireEvent.click(screen.getByTestId('author-card-a1'))
    expect(
      screen.queryByRole('button', { name: /save changes/i }),
    ).toBeNull()
  })

  it('hides danger zone in detail panel when read-only', async () => {
    await renderAuthors({ readOnly: true })
    fireEvent.click(screen.getByTestId('author-card-a1'))
    expect(screen.queryByText('Danger Zone')).toBeNull()
  })

  /* ---- Toggle selection ---- */

  it('toggles card selection on re-click', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('author-card-a1'))
    expect(screen.getByTestId('detail-panel')).toBeTruthy()
    fireEvent.click(screen.getByTestId('author-card-a1'))
    expect(screen.queryByTestId('detail-panel')).toBeNull()
  })

  /* ---- Accessibility ---- */

  it('has aria tablist on filter pills', async () => {
    await renderAuthors()
    expect(
      screen.getByRole('tablist', { name: /author filters/i }),
    ).toBeTruthy()
  })

  it('detail panel has dialog role', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('author-card-a1'))
    expect(
      screen.getByRole('dialog', { name: /author details/i }),
    ).toBeTruthy()
  })
})
