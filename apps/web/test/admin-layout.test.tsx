import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
  headers: async () => ({ get: () => null }),
}))

vi.mock('../src/components/admin/admin-shell', () => ({
  AdminShell: ({
    userEmail,
    children,
  }: {
    userEmail: string
    children: React.ReactNode
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'admin-shell', 'data-email': userEmail },
      children,
    ),
}))

vi.mock('@tn-figueiredo/auth-nextjs', () => ({
  createServerClient: vi.fn(() => ({
    rpc: vi.fn(async () => ({ data: [], error: null })),
  })),
  requireUser: vi.fn(async () => ({ id: 'u1', email: 'thiago@example.com' })),
  requireArea: vi.fn(async () => undefined),
}))

import Layout from '../src/app/admin/(authed)/layout'

describe('admin/layout', () => {
  it('renders admin shell with children', async () => {
    const el = await Layout({ children: <div>hello-admin</div> })
    const { getByText, getByTestId } = render(el)
    expect(getByText('hello-admin')).toBeTruthy()
    expect(getByTestId('admin-shell')).toBeTruthy()
  })

  it('passes user email to AdminShell', async () => {
    const el = await Layout({ children: <div>hello-admin</div> })
    const { getByTestId } = render(el)
    expect(getByTestId('admin-shell').getAttribute('data-email')).toBe('thiago@example.com')
  })
})
