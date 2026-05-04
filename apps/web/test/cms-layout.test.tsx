import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

// See apps/web/test/admin-layout.test.tsx — mirror setup for the CMS
// (authed) layout which also went through the Track F3/F4 refactor.
vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
  headers: async () => ({ get: () => null }),
}))

vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/components/cms/site-switcher-provider', () => ({
  CmsSiteSwitcherSlot: () => null,
  SiteSwitcherProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/lib/cms/sidebar-badges', () => ({
  fetchSidebarBadges: vi.fn(async () => ({
    posts: { wip: 0 },
    newsletters: { wip: 0, wipDraft: 0, wipReady: 0, urgency: null },
  })),
}))

vi.mock('@/components/cms/sidebar-badges', () => ({
  SidebarBadges: () => null,
}))

vi.mock('@tn-figueiredo/cms-admin/client', () => ({
  CmsAdminProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@tn-figueiredo/cms-ui/client', () => ({
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

vi.mock('@tn-figueiredo/auth-nextjs', () => ({
  createServerClient: vi.fn(() => ({
    rpc: vi.fn(async () => ({ data: [], error: null })),
  })),
  requireUser: vi.fn(async () => ({ id: 'u1', email: 'thiago@example.com' })),
  requireArea: vi.fn(async () => undefined),
}))

vi.mock('@/lib/supabase/service', () => {
  const result = { count: 0, data: null, error: null }
  const chainable: Record<string, unknown> = {}
  chainable.eq = vi.fn(() => chainable)
  chainable.is = vi.fn(() => chainable)
  chainable.then = (resolve: (v: unknown) => void) => resolve(result)
  return {
    getSupabaseServiceClient: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(() => chainable),
      })),
    })),
  }
})

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
