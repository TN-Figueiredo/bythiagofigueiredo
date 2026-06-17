import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { BroadcastDialog } from '../../src/app/cms/(authed)/waitlists/_components/broadcast-dialog'

afterEach(cleanup)

const confirmBtn = () => screen.getByRole('button', { name: /send|broadcast|launch/i })

describe('<BroadcastDialog>', () => {
  it('disables confirm at 0 recipients (even with the slug typed)', () => {
    render(<BroadcastDialog slug="launch-a" recipientCount={0} onConfirm={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByTestId('broadcast-confirm-slug'), { target: { value: 'launch-a' } })
    expect(confirmBtn()).toBeDisabled()
  })

  it('requires typing the exact slug to enable confirm (live recipient count shown)', () => {
    render(<BroadcastDialog slug="launch-a" recipientCount={42} onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(/42/)).toBeTruthy()
    expect(confirmBtn()).toBeDisabled() // nothing typed yet
    fireEvent.change(screen.getByTestId('broadcast-confirm-slug'), { target: { value: 'wrong' } })
    expect(confirmBtn()).toBeDisabled()
    fireEvent.change(screen.getByTestId('broadcast-confirm-slug'), { target: { value: 'launch-a' } })
    expect(confirmBtn()).not.toBeDisabled()
  })

  it('shows the not_implemented notice after a stubbed confirm', async () => {
    const onConfirm = vi.fn(async () => ({ ok: false as const, error: 'not_implemented' as const }))
    render(<BroadcastDialog slug="launch-a" recipientCount={5} onConfirm={onConfirm} onClose={vi.fn()} />)
    fireEvent.change(screen.getByTestId('broadcast-confirm-slug'), { target: { value: 'launch-a' } })
    fireEvent.click(confirmBtn())
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    expect(screen.getByText(/next phase|not implemented/i)).toBeTruthy()
  })

  it('Esc closes the dialog', () => {
    const onClose = vi.fn()
    render(<BroadcastDialog slug="launch-a" recipientCount={5} onConfirm={vi.fn()} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
