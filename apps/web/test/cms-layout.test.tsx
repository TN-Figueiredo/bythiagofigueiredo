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
}))

import Layout from '../src/app/cms/layout'

describe('cms/layout', () => {
  it('renders children wrapped in admin shell', async () => {
    const el = await Layout({ children: <div>hello-cms</div> })
    const { getByText } = render(el)
    expect(getByText('hello-cms')).toBeTruthy()
  })
})
