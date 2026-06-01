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

vi.mock('@tn-figueiredo/cms-ui', () => ({
  DEFAULT_SECTIONS: [
    { label: 'Content', items: [{ icon: '📝', label: 'Posts', href: '/cms/blog', minRole: 'editor' }] },
  ],
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

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@tn-figueiredo/auth-nextjs', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'u1', email: 'thiago@example.com', user_metadata: {} } },
        error: null,
      })),
    },
    rpc: vi.fn(async (name: string) => {
      if (name === 'is_member_staff') return { data: true, error: null }
      if (name === 'user_accessible_sites') return { data: [], error: null }
      return { data: null, error: null }
    }),
  })),
}))

vi.mock('@/lib/cms/layout-counts', () => ({
  fetchLayoutCounts: vi.fn(async () => ({
    pendingContacts: 0,
    ytPending: 0,
    researchUnread: 0,
  })),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn(async () => ({
    siteId: 'site-1',
    orgId: 'org-1',
    defaultLocale: 'pt-BR',
    timezone: 'America/Sao_Paulo',
  })),
}))

vi.mock('@/lib/supabase/service', () => {
  const result = { count: 0, data: null, error: null }
  const chainable: Record<string, unknown> = {}
  chainable.eq = vi.fn(() => chainable)
  chainable.is = vi.fn(() => chainable)
  chainable.in = vi.fn(() => chainable)
  chainable.not = vi.fn(() => chainable)
  chainable.order = vi.fn(() => chainable)
  chainable.limit = vi.fn(() => chainable)
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
