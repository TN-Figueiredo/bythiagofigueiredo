import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

// next/headers: minimal stub for cookies + headers. Track F3 extended the
// layout to read `x-site-id`/`host` from headers() via getSiteContext; default
// to an empty bag so `getSiteContext()` throws and the layout falls back to
// admin's defaultBranding (branding=undefined).
vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
  headers: async () => ({ get: () => null }),
}))

// Stub the admin shim. The real wrapper lives in
// `src/components/cms/site-switcher-provider.tsx` and pulls in admin root +
// cms root; neither is needed for these render-smoke tests.
vi.mock('../src/components/cms/site-switcher-provider', () => ({
  AdminShellWithSwitcher: ({
    userEmail,
    config,
    children,
  }: {
    userEmail: string
    config: { logoutPath?: string }
    children: React.ReactNode
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'admin-shell', 'data-email': userEmail },
      React.createElement(
        'form',
        { action: config.logoutPath, method: 'post' },
        React.createElement('button', { type: 'submit' }, 'Sair'),
      ),
      children,
    ),
  AdminSiteSwitcherSlot: () => null,
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
