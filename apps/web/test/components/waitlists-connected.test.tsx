import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { WaitlistsConnected } from '../../src/app/cms/(authed)/waitlists/_components/waitlists-connected'
import type { WaitlistListRow } from '../../src/app/cms/(authed)/waitlists/queries'
import type { WaitlistActionResult, WaitlistTransitionResult } from '../../src/app/cms/(authed)/waitlists/actions'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

afterEach(cleanup)

const rows: WaitlistListRow[] = [
  {
    id: 'wl-1',
    slug: 'launch-a',
    name: 'Launch A',
    status: 'open',
    campaignId: null,
    campaignTitle: null,
    updatedAt: '2026-06-17T00:00:00.000Z',
    signups: 3,
    suppressed: 0,
    description: 'A short pitch.',
    intro: '<p>Intro body</p>',
    senderName: 'Thiago',
    senderEmail: 'hi@x.test',
    replyTo: '',
  },
]

interface Overrides {
  create?: () => Promise<WaitlistActionResult>
  update?: () => Promise<WaitlistActionResult>
  transition?: () => Promise<WaitlistTransitionResult>
}

function setup(o: Overrides = {}) {
  const createAction = vi.fn(async (_fd: FormData) => (o.create ? o.create() : { ok: true as const, waitlistId: 'new-id' }))
  const updateAction = vi.fn(async (_id: string, _fd: FormData) =>
    o.update ? o.update() : { ok: true as const, waitlistId: 'wl-1' },
  )
  const transitionAction = vi.fn(async () => (o.transition ? o.transition() : { ok: true as const, status: 'closed' as const }))
  render(
    <WaitlistsConnected
      rows={rows}
      createAction={createAction}
      updateAction={updateAction}
      transitionAction={transitionAction}
    />,
  )
  return { createAction, updateAction, transitionAction }
}

describe('<WaitlistsConnected>', () => {
  it('opens the create drawer from the New waitlist button', () => {
    setup()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByTestId('new-waitlist-btn'))
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'New waitlist')
  })

  it('opens the edit drawer FULLY hydrated when a row is clicked (no data loss on save)', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Launch A/i }))
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Edit waitlist')
    expect(screen.getByTestId('wl-name')).toHaveValue('Launch A')
    // The previously-dropped fields are now seeded, so Save won't blank them.
    expect(screen.getByTestId('wl-description')).toHaveValue('A short pitch.')
    expect(screen.getByTestId('wl-sender-name')).toHaveValue('Thiago')
    expect(screen.getByTestId('wl-sender-email')).toHaveValue('hi@x.test')
    expect(screen.getByRole('button', { name: /close signups/i })).toBeTruthy()
  })

  it('submits a create through the createAction prop and closes on success', async () => {
    const { createAction } = setup()
    fireEvent.click(screen.getByTestId('new-waitlist-btn'))
    fireEvent.change(screen.getByTestId('wl-name'), { target: { value: 'New List' } })
    fireEvent.click(screen.getByRole('button', { name: /create waitlist/i }))

    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(1))
    const fd = createAction.mock.calls[0][0]
    expect(fd.get('name')).toBe('New List')
    expect(fd.get('slug')).toBe('new-list')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('keeps the drawer open and surfaces the slug error on validation_failed', async () => {
    setup({ create: async () => ({ ok: false, error: 'validation_failed', fields: { slug: 'This slug is already taken on this site.' } }) })
    fireEvent.click(screen.getByTestId('new-waitlist-btn'))
    fireEvent.change(screen.getByTestId('wl-name'), { target: { value: 'Dup' } })
    fireEvent.click(screen.getByRole('button', { name: /create waitlist/i }))

    await waitFor(() => expect(screen.getByText(/already taken on this site/i)).toBeTruthy())
    expect(screen.getByRole('dialog')).toBeTruthy() // stays open
  })

  it('fires the transition action from the status strip when editing', async () => {
    const { transitionAction } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Launch A/i }))
    fireEvent.click(screen.getByRole('button', { name: /close signups/i }))
    await waitFor(() => expect(transitionAction).toHaveBeenCalledWith('wl-1', 'open', 'closed'))
  })

  it('leaves the drawer + strip intact when a transition is rejected', async () => {
    const { transitionAction } = setup({ transition: async () => ({ ok: false, error: 'fase1_only_draft' }) })
    fireEvent.click(screen.getByRole('button', { name: /Launch A/i }))
    fireEvent.click(screen.getByRole('button', { name: /close signups/i }))
    await waitFor(() => expect(transitionAction).toHaveBeenCalled())
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('button', { name: /close signups/i })).toBeTruthy()
  })
})
