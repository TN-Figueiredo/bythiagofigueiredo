import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'

/* ─── Mocks (must be before imports) ─── */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
  }),
  headers: vi.fn().mockReturnValue(new Map()),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'test-site', orgId: 'test-org', defaultLocale: 'en' }),
}))

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaff: vi.fn().mockResolvedValue({ userId: 'test-user', role: 'admin' }),
  requireSiteAdmin: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/newsletter/format', () => ({
  deriveCadenceLabel: vi.fn().mockReturnValue('Weekly, Fridays'),
}))

const mockCreate = vi.fn().mockResolvedValue({ ok: true })
const mockUpdate = vi.fn().mockResolvedValue({ ok: true })
const mockDelete = vi.fn().mockResolvedValue({ ok: false, error: 'requires_confirmation', subscriberCount: 0, editionCount: 0 })
const mockGetForEdit = vi.fn().mockResolvedValue({
  ok: true,
  type: {
    id: 'test-1', name: 'Test Type', tagline: 'A tagline', locale: 'en', slug: 'test-type',
    badge: 'NEW', description: 'Some desc', color: '#ea580c', colorDark: '#FF8240',
    ogImageUrl: 'https://example.com/og.png', landingPromise: ['Item 1', 'Item 2'],
    cadenceDays: 7, cadenceStartDate: '2026-05-01', cadencePaused: false,
    subscriberCount: 42, editionCount: 5,
  },
})

const mockUploadImage = vi.fn().mockResolvedValue({ ok: true, url: 'https://cdn.example.com/img.png' })
const mockGetUnlinkedTags = vi.fn().mockResolvedValue([])

vi.mock('../../src/app/cms/(authed)/newsletters/actions', () => ({
  createNewsletterType: (...args: unknown[]) => mockCreate(...args),
  updateNewsletterType: (...args: unknown[]) => mockUpdate(...args),
  deleteNewsletterType: (...args: unknown[]) => mockDelete(...args),
  getNewsletterTypeForEdit: (...args: unknown[]) => mockGetForEdit(...args),
  uploadNewsletterTypeImage: (...args: unknown[]) => mockUploadImage(...args),
  getUnlinkedTags: (...args: unknown[]) => mockGetUnlinkedTags(...args),
}))

/* ─── Import after mocks ─── */

import { TypeDrawer } from '../../src/app/cms/(authed)/newsletters/_components/type-drawer'
import { toast } from 'sonner'

const toastSuccess = toast.success as ReturnType<typeof vi.fn>
const toastError = toast.error as ReturnType<typeof vi.fn>

const strings = {
  createTitle: 'New Newsletter Type',
  editTitle: 'Edit Newsletter Type',
  sectionEssentials: 'Essentials',
  sectionLanding: 'Landing Page Content',
  sectionAppearance: 'Appearance',
  sectionSchedule: 'Schedule',
  nameLabel: 'Name',
  namePlaceholder: 'e.g. Weekly Digest',
  taglineLabel: 'Tagline',
  taglinePlaceholder: 'A short italic subtitle',
  localeLabel: 'Language',
  slugLabel: 'Slug',
  slugPreview: 'bythiagofigueiredo.com/newsletters/',
  slugWarning: 'Changing the slug will break existing links',
  badgeLabel: 'Badge',
  badgePlaceholder: 'e.g. MAIN, NEW',
  badgeHint: 'Shown as a tag above the title on the landing page',
  descriptionLabel: 'Description',
  descriptionPlaceholder: 'Describe what subscribers will receive',
  promiseLabel: 'What you get',
  promiseAdd: 'Add item',
  promiseMax: 'Maximum 10 items',
  promiseItemPlaceholder: 'Promise item...',
  colorLabel: 'Accent Color (Light)',
  colorDarkLabel: 'Accent Color (Dark)',
  colorDarkHint: 'Falls back to light color if empty',
  ogImageLabel: 'OG Image URL',
  ogImagePlaceholder: 'https://...',
  uploadImage: 'Upload image',
  uploadDragDrop: 'or drag & drop',
  uploadFormats: 'JPEG, PNG, GIF, WebP · Max 2 MB',
  uploadUploading: 'Uploading…',
  uploadOr: 'or',
  uploadMaxError: 'Max 2 MB',
  uploadFormatError: 'Use JPEG, PNG, GIF, or WebP',
  clearColor: 'Clear',
  removeImage: 'Remove image',
  statusActive: 'Active',
  statusPaused: 'Paused',
  moveUp: 'Move up',
  moveDown: 'Move down',
  removeItem: 'Remove item',
  close: 'Close',
  valRequired: 'Required',
  valMinChars: 'Min 3 characters',
  valMaxChars: 'Max 80 characters',
  valInvalidFormat: 'Invalid format',
  valReservedSlug: 'Reserved slug',
  valInvalidHex: 'Invalid hex color',
  valHttpsRequired: 'Must start with https://',
  valSlugInUse: 'Slug already in use',
  typeNotFound: 'Type not found',
  unknownError: 'Unknown error',
  typeNameToConfirm: 'Type name to confirm',
  scheduleLink: 'Edit in Schedule tab',
  dangerZone: 'Danger Zone',
  deleteButton: 'Delete Newsletter Type',
  deleteConfirmEmpty: 'Delete "{name}"? This cannot be undone.',
  deleteConfirmDeps: 'This has {subscribers} subscribers and {editions} editions. Type the name to confirm:',
  deleteNameMismatch: 'Name does not match',
  createButton: 'Create',
  saveButton: 'Save Changes',
  creating: 'Creating...',
  saving: 'Saving...',
  cancel: 'Cancel',
  toastCreated: '"{name}" created',
  toastSaved: 'Changes saved',
  toastDeleted: '"{name}" deleted',
  sectionLinkTag: 'Link to Tag',
  linkTagLabel: 'Blog Tag',
  linkTagPlaceholder: 'Select tag...',
  linkTagNone: 'No link',
  linkTagSyncHint: 'Colors sync automatically',
  linkTagUnlink: 'Unlink',
  linkTagLoading: 'Loading tags...',
}

function getInputValue(testId: string): string {
  return (screen.getByTestId(testId) as HTMLInputElement).value
}

describe('TypeDrawer', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({ ok: true })
    mockUpdate.mockResolvedValue({ ok: true })
    mockDelete.mockResolvedValue({ ok: false, error: 'requires_confirmation', subscriberCount: 0, editionCount: 0 })
  })

  it('renders in create mode with empty fields', () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    expect(screen.getByText('New Newsletter Type')).toBeTruthy()
    expect(getInputValue('drawer-name')).toBe('')
    expect(getInputValue('drawer-slug')).toBe('')
    expect(screen.getByText('Create')).toBeTruthy()
  })

  it('renders in edit mode with pre-populated fields', async () => {
    render(<TypeDrawer open mode="edit" typeId="test-1" onClose={onClose} locale="en" strings={strings} />)
    await vi.waitFor(() => {
      expect(getInputValue('drawer-name')).toBe('Test Type')
    })
    expect(getInputValue('drawer-slug')).toBe('test-type')
    expect(getInputValue('drawer-badge')).toBe('NEW')
    expect(screen.getByText('Save Changes')).toBeTruthy()
  })

  it('auto-generates slug from name on blur in create mode', () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    const nameInput = screen.getByTestId('drawer-name')
    fireEvent.change(nameInput, { target: { value: 'Weekly Digest' } })
    fireEvent.blur(nameInput)
    expect(getInputValue('drawer-slug')).toBe('weekly-digest')
  })

  it('stops auto-generation when slug is manually edited', () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    const slugInput = screen.getByTestId('drawer-slug')
    fireEvent.change(slugInput, { target: { value: 'my-custom-slug' } })
    const nameInput = screen.getByTestId('drawer-name')
    fireEvent.change(nameInput, { target: { value: 'Something Else' } })
    fireEvent.blur(nameInput)
    expect(getInputValue('drawer-slug')).toBe('my-custom-slug')
  })

  it('adds a promise item', () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    const addBtn = screen.getByTestId('drawer-promise-add')
    fireEvent.click(addBtn)
    const list = screen.getByTestId('drawer-promise-list')
    expect(within(list).getAllByRole('textbox')).toHaveLength(1)
  })

  it('removes a promise item', () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    fireEvent.click(screen.getByTestId('drawer-promise-add'))
    fireEvent.click(screen.getByTestId('drawer-promise-add'))
    const list = screen.getByTestId('drawer-promise-list')
    expect(within(list).getAllByRole('textbox')).toHaveLength(2)
    const removeButtons = within(list).getAllByLabelText('Remove item')
    fireEvent.click(removeButtons[0])
    expect(within(list).getAllByRole('textbox')).toHaveLength(1)
  })

  it('reorders promise items up/down', () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    fireEvent.click(screen.getByTestId('drawer-promise-add'))
    fireEvent.click(screen.getByTestId('drawer-promise-add'))
    const list = screen.getByTestId('drawer-promise-list')
    const inputs = within(list).getAllByRole('textbox') as HTMLInputElement[]
    fireEvent.change(inputs[0], { target: { value: 'First' } })
    fireEvent.change(inputs[1], { target: { value: 'Second' } })
    const moveDownButtons = within(list).getAllByLabelText('Move down')
    fireEvent.click(moveDownButtons[0])
    const reordered = within(list).getAllByRole('textbox') as HTMLInputElement[]
    expect(reordered[0].value).toBe('Second')
    expect(reordered[1].value).toBe('First')
  })

  it('disables add at 10 items', () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    const addBtn = screen.getByTestId('drawer-promise-add')
    for (let i = 0; i < 10; i++) fireEvent.click(addBtn)
    expect((addBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('closes on Escape key', () => {
    vi.useFakeTimers()
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    act(() => { vi.advanceTimersByTime(200) })
    expect(onClose).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('closes on backdrop click', () => {
    vi.useFakeTimers()
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    const backdrop = screen.getByTestId('type-drawer-backdrop')
    const overlay = backdrop.querySelector('.bg-black\\/40')!
    fireEvent.click(overlay)
    act(() => { vi.advanceTimersByTime(200) })
    expect(onClose).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('submit button disabled when name is empty', () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    const submit = screen.getByTestId('drawer-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
  })

  it('shows validation error for reserved slug', () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    fireEvent.change(screen.getByTestId('drawer-name'), { target: { value: 'Test' } })
    fireEvent.change(screen.getByTestId('drawer-slug'), { target: { value: 'admin' } })
    fireEvent.submit(screen.getByTestId('drawer-submit').closest('form')!)
    expect(screen.getByText('Reserved slug')).toBeTruthy()
  })

  it('shows validation error for non-https OG image URL', () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    fireEvent.change(screen.getByTestId('drawer-name'), { target: { value: 'Test' } })
    fireEvent.blur(screen.getByTestId('drawer-name'))
    fireEvent.change(screen.getByTestId('drawer-og-image'), { target: { value: 'http://example.com/img.png' } })
    fireEvent.submit(screen.getByTestId('drawer-submit').closest('form')!)
    expect(screen.getByText('Must start with https://')).toBeTruthy()
  })

  it('shows schedule section in edit mode', async () => {
    render(<TypeDrawer open mode="edit" typeId="test-1" onClose={onClose} locale="en" strings={strings} />)
    await vi.waitFor(() => {
      expect(screen.getByTestId('drawer-schedule-section')).toBeTruthy()
    })
    expect(screen.getByText('Weekly, Fridays')).toBeTruthy()
  })

  it('hides schedule section in create mode', () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    expect(screen.queryByTestId('drawer-schedule-section')).toBeNull()
  })

  it('hides danger zone in create mode', () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    expect(screen.queryByText('Danger Zone')).toBeNull()
  })

  it('shows danger zone in edit mode', async () => {
    render(<TypeDrawer open mode="edit" typeId="test-1" onClose={onClose} locale="en" strings={strings} />)
    await vi.waitFor(() => {
      expect(screen.getByText('Danger Zone')).toBeTruthy()
    })
    expect(screen.getByTestId('drawer-delete')).toBeTruthy()
  })

  it('selects color from presets', () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    const preset = screen.getByLabelText('Orange')
    fireEvent.click(preset)
    expect(getInputValue('drawer-color')).toBe('#ea580c')
  })

  it('links labels to inputs via htmlFor/id', () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    const nameLabel = screen.getByText('Name')
    const nameInput = screen.getByTestId('drawer-name')
    expect(nameLabel.getAttribute('for')).toBe(nameInput.id)
    const slugLabel = screen.getByText('Slug')
    const slugInput = screen.getByTestId('drawer-slug')
    expect(slugLabel.getAttribute('for')).toBe(slugInput.id)
  })

  it('locks body scroll when open', () => {
    const { unmount } = render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  /* ─── Create submit ─── */

  it('calls createNewsletterType on submit in create mode', async () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    fireEvent.change(screen.getByTestId('drawer-name'), { target: { value: 'My Newsletter' } })
    fireEvent.blur(screen.getByTestId('drawer-name'))
    fireEvent.submit(screen.getByTestId('drawer-submit').closest('form')!)
    await vi.waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(1)
    })
    const payload = mockCreate.mock.calls[0][0]
    expect(payload.name).toBe('My Newsletter')
    expect(payload.slug).toBe('my-newsletter')
    expect(payload.locale).toBe('en')
  })

  it('shows toast on successful create', async () => {
    render(<TypeDrawer open mode="create" onClose={onClose} locale="en" strings={strings} />)
    fireEvent.change(screen.getByTestId('drawer-name'), { target: { value: 'My NL' } })
    fireEvent.blur(screen.getByTestId('drawer-name'))
    fireEvent.submit(screen.getByTestId('drawer-submit').closest('form')!)
    await vi.waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('"My NL" created')
    })
  })

  /* ─── Update with locale ─── */

  it('sends locale in update payload', async () => {
    render(<TypeDrawer open mode="edit" typeId="test-1" onClose={onClose} locale="en" strings={strings} />)
    await vi.waitFor(() => {
      expect(getInputValue('drawer-name')).toBe('Test Type')
    })
    fireEvent.change(screen.getByTestId('drawer-locale'), { target: { value: 'pt-BR' } })
    fireEvent.submit(screen.getByTestId('drawer-submit').closest('form')!)
    await vi.waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(1)
    })
    const patch = mockUpdate.mock.calls[0][1]
    expect(patch.locale).toBe('pt-BR')
  })

  /* ─── Delete flow ─── */

  it('shows inline confirmation on delete click (no deps)', async () => {
    render(<TypeDrawer open mode="edit" typeId="test-1" onClose={onClose} locale="en" strings={strings} />)
    await vi.waitFor(() => {
      expect(screen.getByTestId('drawer-delete')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('drawer-delete'))
    await vi.waitFor(() => {
      expect(screen.getByTestId('drawer-delete-confirm')).toBeTruthy()
    })
    expect(screen.getByText(/Delete "Test Type"\? This cannot be undone\./)).toBeTruthy()
  })

  it('shows name-check on delete with deps', async () => {
    mockDelete.mockResolvedValueOnce({ ok: false, error: 'requires_confirmation', subscriberCount: 10, editionCount: 3 })
    render(<TypeDrawer open mode="edit" typeId="test-1" onClose={onClose} locale="en" strings={strings} />)
    await vi.waitFor(() => {
      expect(screen.getByTestId('drawer-delete')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('drawer-delete'))
    await vi.waitFor(() => {
      expect(screen.getByTestId('drawer-delete-name-input')).toBeTruthy()
    })
    expect(screen.getByText(/10 subscribers/)).toBeTruthy()
    expect(screen.getByText(/3 editions/)).toBeTruthy()
  })

  it('confirms delete when name matches', async () => {
    mockDelete
      .mockResolvedValueOnce({ ok: false, error: 'requires_confirmation', subscriberCount: 10, editionCount: 3 })
      .mockResolvedValueOnce({ ok: true })
    render(<TypeDrawer open mode="edit" typeId="test-1" onClose={onClose} locale="en" strings={strings} />)
    await vi.waitFor(() => {
      expect(screen.getByTestId('drawer-delete')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('drawer-delete'))
    await vi.waitFor(() => {
      expect(screen.getByTestId('drawer-delete-name-input')).toBeTruthy()
    })
    fireEvent.change(screen.getByTestId('drawer-delete-name-input'), { target: { value: 'Test Type' } })
    fireEvent.click(screen.getByTestId('drawer-delete-confirm-btn'))
    await vi.waitFor(() => {
      expect(mockDelete).toHaveBeenCalledTimes(2)
      expect(mockDelete.mock.calls[1]).toEqual(['test-1', { confirmed: true, confirmText: 'Test Type' }])
    })
  })

  it('rejects delete when name does not match', async () => {
    mockDelete.mockResolvedValueOnce({ ok: false, error: 'requires_confirmation', subscriberCount: 10, editionCount: 3 })
    render(<TypeDrawer open mode="edit" typeId="test-1" onClose={onClose} locale="en" strings={strings} />)
    await vi.waitFor(() => {
      expect(screen.getByTestId('drawer-delete')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('drawer-delete'))
    await vi.waitFor(() => {
      expect(screen.getByTestId('drawer-delete-name-input')).toBeTruthy()
    })
    fireEvent.change(screen.getByTestId('drawer-delete-name-input'), { target: { value: 'Wrong' } })
    const confirmBtn = screen.getByTestId('drawer-delete-confirm-btn') as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)
  })
})
