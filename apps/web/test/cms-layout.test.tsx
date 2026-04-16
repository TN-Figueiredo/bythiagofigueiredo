import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }))
vi.mock('@tn-figueiredo/admin', () => ({
  createAdminLayout: () =>
    function MockLayout({ children }: { userEmail: string; children: React.ReactNode }) {
      return <div data-testid="admin-shell">{children}</div>
    },
}))
vi.mock('@tn-figueiredo/auth-nextjs', () => ({
  createServerClient: vi.fn(() => ({} as unknown)),
  requireUser: vi.fn(async () => ({ id: 'u1', email: 'thiago@example.com' })),
  requireArea: vi.fn(async () => undefined),
}))

import Layout from '../src/app/cms/(authed)/layout'

describe('cms/layout', () => {
  it('renders children wrapped in admin shell', async () => {
    const el = await Layout({ children: <div>hello-cms</div> })
    const { getByText } = render(el)
    expect(getByText('hello-cms')).toBeTruthy()
  })

  it('includes POST logout form targeting /cms/logout', async () => {
    const el = await Layout({ children: <div>hello-cms</div> })
    const { container, getByRole } = render(el)
    const form = container.querySelector('form[action="/cms/logout"]')
    expect(form).toBeTruthy()
    expect(form?.getAttribute('method')?.toLowerCase()).toBe('post')
    const button = getByRole('button', { name: /sair/i })
    expect(button.getAttribute('type')).toBe('submit')
  })
})
