import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }))
vi.mock('@tn-figueiredo/admin', () => ({
  createAdminLayout: () => ({ userEmail, children }: { userEmail: string; children: React.ReactNode }) =>
    React.createElement('div', { 'data-email': userEmail }, children),
}))
vi.mock('@tn-figueiredo/auth-nextjs', () => ({
  createServerClient: vi.fn(() => ({} as unknown)),
  requireUser: vi.fn(async () => ({ id: 'u1', email: 'thiago@example.com' })),
  requireArea: vi.fn(async () => undefined),
}))

import Layout from '../src/app/admin/(authed)/layout'

describe('admin/layout', () => {
  it('renders admin shell', async () => {
    const el = await Layout({ children: <div>hello-admin</div> })
    const { getByText } = render(el)
    expect(getByText('hello-admin')).toBeTruthy()
  })

  it('includes POST logout form targeting /admin/logout', async () => {
    const el = await Layout({ children: <div>hello-admin</div> })
    const { container, getByRole } = render(el)
    const form = container.querySelector('form[action="/admin/logout"]')
    expect(form).toBeTruthy()
    expect(form?.getAttribute('method')?.toLowerCase()).toBe('post')
    const button = getByRole('button', { name: /sair/i })
    expect(button.getAttribute('type')).toBe('submit')
  })
})
