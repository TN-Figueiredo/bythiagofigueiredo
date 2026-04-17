import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

// See apps/web/test/admin-layout.test.tsx — mirror setup for the CMS
// (authed) layout which also went through the Track F3/F4 refactor.
vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
  headers: async () => ({ get: () => null }),
}))

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
  CmsSiteSwitcherSlot: () => null,
}))

vi.mock('@tn-figueiredo/auth-nextjs', () => ({
  createServerClient: vi.fn(() => ({
    rpc: vi.fn(async () => ({ data: [], error: null })),
  })),
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
