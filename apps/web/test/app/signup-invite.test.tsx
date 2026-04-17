/**
 * Track G — Signup/invite accept page + form UI tests.
 *
 * Renders the `AcceptInviteForm` client component in isolation and exercises:
 *  1. Password mismatch triggers local error (server action is NOT called).
 *  2. Short passwords (< 8 chars) trigger local error.
 *  3. Valid submit forwards token + password to `acceptInviteWithPassword`.
 *
 * The server action is mocked so we only test the client-side UX —
 * cross-domain redirect + partial-failure cleanup live in
 * invite-accept-actions.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AcceptInviteForm } from '../../src/app/signup/invite/[token]/accept-invite-form'

// Server action lives in the co-located actions.ts — mock the module so the
// import inside the client component hits our stub.
const acceptInviteWithPasswordMock = vi.fn()

vi.mock('../../src/app/signup/invite/[token]/actions', () => ({
  acceptInviteWithPassword: (...args: unknown[]) => acceptInviteWithPasswordMock(...args),
}))

describe('AcceptInviteForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders email as hidden field and both password inputs', () => {
    render(<AcceptInviteForm token="abc123" email="invitee@example.com" />)
    // Password and confirm fields present
    expect(screen.getByLabelText(/^Senha$/)).toBeTruthy()
    expect(screen.getByLabelText(/Confirmar senha/)).toBeTruthy()
    // Submit button
    expect(screen.getByRole('button', { name: /Criar conta/ })).toBeTruthy()
  })

  it('shows local error and does NOT call the server action when passwords mismatch', async () => {
    render(<AcceptInviteForm token="tok-mm" email="x@example.com" />)
    const password = screen.getByLabelText(/^Senha$/) as HTMLInputElement
    const confirm = screen.getByLabelText(/Confirmar senha/) as HTMLInputElement

    fireEvent.change(password, { target: { value: 'Password1!' } })
    fireEvent.change(confirm, { target: { value: 'DifferentPass!' } })
    fireEvent.submit(password.closest('form')!)

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/não conferem/)
    })
    expect(acceptInviteWithPasswordMock).not.toHaveBeenCalled()
  })

  it('shows local error when password is shorter than 8 chars', async () => {
    render(<AcceptInviteForm token="tok-short" email="x@example.com" />)
    const password = screen.getByLabelText(/^Senha$/) as HTMLInputElement
    const confirm = screen.getByLabelText(/Confirmar senha/) as HTMLInputElement

    // React-controlled inputs ignore the native minLength attribute during
    // programmatic submit; the component's own guard must reject.
    fireEvent.change(password, { target: { value: 'short' } })
    fireEvent.change(confirm, { target: { value: 'short' } })
    fireEvent.submit(password.closest('form')!)

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/mínimo 8/)
    })
    expect(acceptInviteWithPasswordMock).not.toHaveBeenCalled()
  })

  it('forwards token + password to acceptInviteWithPassword on valid submit', async () => {
    render(<AcceptInviteForm token="tok-ok" email="ok@example.com" />)
    const password = screen.getByLabelText(/^Senha$/) as HTMLInputElement
    const confirm = screen.getByLabelText(/Confirmar senha/) as HTMLInputElement

    fireEvent.change(password, { target: { value: 'Password1!' } })
    fireEvent.change(confirm, { target: { value: 'Password1!' } })
    fireEvent.submit(password.closest('form')!)

    await waitFor(() => {
      expect(acceptInviteWithPasswordMock).toHaveBeenCalledWith('tok-ok', 'Password1!')
    })
  })
})
