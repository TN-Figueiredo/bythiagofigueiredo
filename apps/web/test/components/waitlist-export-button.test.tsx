import { describe, it, expect, vi, afterEach } from 'vitest'

// Degrau "administrar o site": por padrão estes testes rodam como quem administra (o dono).
const siteAdmin = vi.hoisted(() => ({ value: true }))
vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => siteAdmin.value,
}))
import { render, screen, fireEvent, within, cleanup, waitFor } from '@testing-library/react'
import { WaitlistExportButton } from '../../src/app/cms/(authed)/waitlists/_components/export-button'

afterEach(cleanup)

describe('<WaitlistExportButton>', () => {
  it('opens the dialog and calls exportAction(waitlistId, opts), then closes on success', async () => {
    const exportAction = vi.fn(async () => ({ ok: true as const, filename: 'waitlist-a-2026-06-17.csv', csv: 'email\r\n' }))
    render(<WaitlistExportButton slug="a" waitlistId="wl-1" exportAction={exportAction} />)

    fireEvent.click(screen.getByRole('button', { name: /export csv/i })) // trigger
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /export csv/i })) // dialog submit

    await waitFor(() => expect(exportAction).toHaveBeenCalledTimes(1))
    expect(exportAction.mock.calls[0][0]).toBe('wl-1')
    expect(exportAction.mock.calls[0][1]).toMatchObject({ excludeSuppressed: true })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('surfaces an inline error and keeps the dialog open on failure', async () => {
    const exportAction = vi.fn(async () => ({ ok: false as const, error: 'db_error' as const, message: 'x' }))
    render(<WaitlistExportButton slug="a" waitlistId="wl-1" exportAction={exportAction} />)
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /export csv/i }))
    await waitFor(() => expect(screen.getByText(/export failed/i)).toBeTruthy())
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('editora (não administra o site): sem botão, com o motivo escrito na tela', () => {
    siteAdmin.value = false
    try {
      const exportAction = vi.fn()
      render(<WaitlistExportButton slug="a" waitlistId="wl-1" exportAction={exportAction} />)
      expect(screen.queryByRole('button', { name: /export csv/i })).toBeNull()
      expect(screen.getByTestId('admin-only-note').textContent).toBe('Só quem administra o site pode exportar os inscritos.')
    } finally {
      siteAdmin.value = true
    }
  })

  it('mostra a recusa do servidor quando ela vem (o servidor é a verdade)', async () => {
    const exportAction = vi.fn(async () => ({ ok: false as const, error: 'forbidden' as const, message: 'Só quem administra o site pode exportar os inscritos da waitlist.' }))
    render(<WaitlistExportButton slug="a" waitlistId="wl-1" exportAction={exportAction} />)
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /export csv/i }))
    await waitFor(() => expect(screen.getByText(/Só quem administra o site pode exportar/)).toBeTruthy())
  })
})
