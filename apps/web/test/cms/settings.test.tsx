import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ getAll: () => [] })),
  headers: vi.fn(() => new Map()),
}))

vi.mock('@tn-figueiredo/cms-ui/client', () => ({
  CmsTopbar: ({ title }: { title: string }) => <div data-testid="cms-topbar">{title}</div>,
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({
    siteId: 'site-1',
    orgId: 'org-1',
    defaultLocale: 'pt-BR',
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data:
          table === 'newsletter_types'
            ? [{ id: 'nt-1', name: 'Weekly', cadence_days: 7, sort_order: 0 }]
            : table === 'blog_cadence'
              ? [{ locale: 'pt-BR', cadence_days: 7 }]
              : [],
        error: null,
      }),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'site-1',
          logo_url: 'https://example.com/logo.png',
          primary_color: '#000000',
          identity_type: 'person',
          twitter_handle: 'tnFigueiredo',
          seo_default_og_image: null,
          supported_locales: ['pt-BR', 'en'],
          default_locale: 'pt-BR',
          cms_enabled: true,
        },
        error: null,
      }),
    })),
  })),
}))

vi.mock('@/app/cms/(authed)/settings/settings-connected', () => ({
  SettingsConnected: (props: Record<string, unknown>) => (
    <div
      data-testid="settings-connected"
      data-site-id={(props.site as { id: string })?.id}
      data-section={props.initialSection as string}
    />
  ),
}))

describe('Settings page', () => {
  it('renders SettingsConnected with site data', async () => {
    const { default: SettingsPage } = await import(
      '@/app/cms/(authed)/settings/page'
    )
    const jsx = await SettingsPage({ searchParams: Promise.resolve({}) })
    render(jsx)
    expect(screen.getByTestId('settings-connected')).toBeDefined()
    expect(
      screen.getByTestId('settings-connected').getAttribute('data-site-id'),
    ).toBe('site-1')
  })

  it('passes section from searchParams', async () => {
    const { default: SettingsPage } = await import(
      '@/app/cms/(authed)/settings/page'
    )
    const jsx = await SettingsPage({
      searchParams: Promise.resolve({ section: 'seo' }),
    })
    render(jsx)
    expect(
      screen.getByTestId('settings-connected').getAttribute('data-section'),
    ).toBe('seo')
  })

  it('defaults section to branding', async () => {
    const { default: SettingsPage } = await import(
      '@/app/cms/(authed)/settings/page'
    )
    const jsx = await SettingsPage({ searchParams: Promise.resolve({}) })
    render(jsx)
    expect(
      screen.getByTestId('settings-connected').getAttribute('data-section'),
    ).toBe('branding')
  })

  it('renders CmsTopbar with Settings title', async () => {
    const { default: SettingsPage } = await import(
      '@/app/cms/(authed)/settings/page'
    )
    const jsx = await SettingsPage({ searchParams: Promise.resolve({}) })
    render(jsx)
    expect(screen.getByTestId('cms-topbar').textContent).toBe('Settings')
  })
})
