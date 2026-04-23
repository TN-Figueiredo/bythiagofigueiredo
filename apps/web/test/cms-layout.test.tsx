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
  CmsSiteSwitcherSlot: () => null,
}))

vi.mock('../src/components/cms/cms-shell', () => ({
  CmsShell: ({
    siteName,
    userDisplayName,
    children,
  }: {
    siteName: string
    userDisplayName: string
    children: React.ReactNode
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'cms-shell', 'data-site': siteName, 'data-user': userDisplayName },
      children,
    ),
}))

vi.mock('@tn-figueiredo/admin/site-switcher', () => ({
  SiteSwitcherProvider: ({ children }: { children: React.ReactNode }) => children,
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
  it('renders children wrapped in CmsShell', async () => {
    const el = await Layout({ children: <div>hello-cms</div> })
    const { getByText, getByTestId } = render(el)
    expect(getByText('hello-cms')).toBeTruthy()
    expect(getByTestId('cms-shell')).toBeTruthy()
  })

  it('passes user email as display name when no metadata', async () => {
    const el = await Layout({ children: <div>hello-cms</div> })
    const { getByTestId } = render(el)
    expect(getByTestId('cms-shell').getAttribute('data-user')).toBe('thiago@example.com')
  })
})
