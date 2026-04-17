import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, screen, act, waitFor } from '@testing-library/react'
import { AccountDeleteWizard } from '../../../src/components/lgpd/account-delete-wizard'

describe('AccountDeleteWizard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('renders step 1 (password re-auth) by default', () => {
    render(<AccountDeleteWizard userEmail="u@example.com" />)
    expect(screen.getByRole('heading', { name: /confirmar identidade/i })).toBeTruthy()
    expect(screen.getByLabelText(/senha/i)).toBeTruthy()
  })

  it('calls /api/auth/verify-password and advances on success', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<AccountDeleteWizard userEmail="u@example.com" />)
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'pw1-longer-than-eight' } })
    fireEvent.click(screen.getByRole('button', { name: /verificar/i }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/verify-password',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(screen.getByRole('heading', { name: /revisar impacto/i })).toBeTruthy()
    })
  })

  it('shows error on verify-password failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: 'invalid_credentials' }), { status: 401 }))),
    )
    render(<AccountDeleteWizard userEmail="u@example.com" />)
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'bad-password-long' } })
    fireEvent.click(screen.getByRole('button', { name: /verificar/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent?.toLowerCase()).toMatch(/inv[aá]lid|senha|credencia/)
    })
  })

  it('step 2 → step 3 POSTs /api/lgpd/request-deletion + shows email-sent screen', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/auth/verify-password') {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      }
      if (url === '/api/lgpd/request-deletion') {
        return Promise.resolve(
          new Response(JSON.stringify({ requestId: 'req-1' }), { status: 201 }),
        )
      }
      return Promise.resolve(new Response('{}', { status: 200 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<AccountDeleteWizard userEmail="u@example.com" />)
    // Step 1
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'pw1-longer-than-eight' } })
    fireEvent.click(screen.getByRole('button', { name: /verificar/i }))
    // Step 2
    await screen.findByRole('heading', { name: /revisar impacto/i })
    fireEvent.click(screen.getByRole('button', { name: /solicitar exclus[ãa]o/i }))
    // Step 3 — reads `requestId` from response body and renders it.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /verifique seu email/i })).toBeTruthy()
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/lgpd/request-deletion',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(screen.getByText(/req-1/)).toBeTruthy()
    })
  })

  it('renders disabled stub when NEXT_PUBLIC_ACCOUNT_DELETE_ENABLED is not true', () => {
    render(<AccountDeleteWizard userEmail="u@example.com" enabled={false} />)
    expect(screen.getByText(/temporariamente desabilitad/i)).toBeTruthy()
  })
})
