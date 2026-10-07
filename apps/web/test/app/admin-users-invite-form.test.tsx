// @vitest-environment jsdom
// Formulário de convite (/admin/users): `reporter` saiu das opções em 2026-10-07 — o código não
// implementa a regra dele, então o papel só lia. O banco e a action continuam aceitando o valor
// (convites antigos); aqui se prova só o que a TELA oferece e o que ela manda.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InviteForm } from '@/app/admin/(authed)/users/invite-form'

const sites = [{ id: 'site-1', name: 'Site Um', primary_domain: 'um.example.test' }]

describe('InviteForm — papel de site', () => {
  it('convite de site: não existe seletor de papel nem a palavra "reporter"; o papel mostrado é editor', () => {
    const { container } = render(<InviteForm sites={sites} action={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Site específico'))
    expect(container.querySelector('select')).toBeNull()
    expect(container.textContent).not.toMatch(/reporter/i)
    const role = screen.getByTestId('invite-site-role')
    expect(role.textContent).toContain('editor')
    expect(role.textContent).toContain('Não administra o site')
  })

  it('convite de site manda sempre role=editor', async () => {
    const action = vi.fn(async () => {})
    render(<InviteForm sites={sites} action={action} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'irma@example.test' } })
    fireEvent.click(screen.getByLabelText('Site específico'))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(action).toHaveBeenCalledWith({ email: 'irma@example.test', scope: 'site', role: 'editor', site_ids: ['site-1'] })
  })

  it('convite de organização continua mandando role=org_admin', async () => {
    const action = vi.fn(async () => {})
    render(<InviteForm sites={sites} action={action} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'socio@example.test' } })
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(action).toHaveBeenCalledWith({ email: 'socio@example.test', scope: 'org', role: 'org_admin', site_ids: [] })
  })
})
