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
}))

import Layout from '../src/app/admin/layout'

describe('admin/layout', () => {
  it('renders admin shell', async () => {
    const el = await Layout({ children: <div>hello-admin</div> })
    const { getByText } = render(el)
    expect(getByText('hello-admin')).toBeTruthy()
  })
})
