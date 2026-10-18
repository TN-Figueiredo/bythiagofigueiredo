// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@tn-figueiredo/cms/login', () => ({ CmsResetPassword: () => <div>cms-form</div> }))
vi.mock('@tn-figueiredo/admin/login', () => ({ AdminResetPassword: () => <div>admin-form</div> }))
vi.mock('../../src/app/cms/reset/actions', () => ({ resetPassword: vi.fn() }))
vi.mock('../../src/app/admin/reset/actions', () => ({ resetPassword: vi.fn() }))

describe('reset sem sessão (Logan A2)', () => {
  it('CMS: link vencido com ação de pedir novo e voltar', async () => {
    const { ResetForm } = await import('../../src/app/cms/reset/reset-form')
    render(<ResetForm canReset={false} />)
    expect(screen.getByText('Este link não vale mais')).toBeTruthy()
    expect(screen.getByText('Pedir novo link').getAttribute('href')).toBe('/cms/forgot')
    expect(screen.getByText('Voltar para o login').getAttribute('href')).toBe('/cms/login')
  })
  it('admin: idem, apontando para o admin', async () => {
    const { ResetForm } = await import('../../src/app/admin/reset/reset-form')
    render(<ResetForm canReset={false} />)
    expect(screen.getByText('Pedir novo link').getAttribute('href')).toBe('/admin/forgot')
    expect(screen.getByText('Voltar para o login').getAttribute('href')).toBe('/admin/login')
  })
  it('com sessão mostra o formulário', async () => {
    const { ResetForm } = await import('../../src/app/cms/reset/reset-form')
    render(<ResetForm canReset />)
    expect(screen.getByText('cms-form')).toBeTruthy()
  })
})
