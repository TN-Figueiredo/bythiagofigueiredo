import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock the package component — test only that the consumer wires it correctly
const mockCmsLogin = vi.fn((_props: unknown) => (
  <div data-testid="cms-login-component">CmsLogin mounted</div>
))
vi.mock('@tn-figueiredo/cms/login', () => ({
  CmsLogin: (props: unknown) => mockCmsLogin(props),
  CmsForgotPassword: (_props: unknown) => <div data-testid="cms-forgot-component">CmsForgotPassword mounted</div>,
  CmsResetPassword: (_props: unknown) => <div data-testid="cms-reset-component">CmsResetPassword mounted</div>,
}))

// Track F4 made /cms/login a server component that reads `x-site-id` and
// calls `get_site_branding` via the supabase-js anon client. Stub both:
// headers() returns a bag with no site id (branding resolves to null) and
// createClient returns a client whose rpc always returns null.
vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => null }),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: vi.fn(async () => ({ data: null, error: null })),
  })),
}))

// Mock the actions re-exports (these are 'use server' — cannot run in vitest)
vi.mock('../../src/app/cms/login/actions', () => ({
  signInWithPassword: vi.fn(),
  signInWithGoogle: vi.fn(),
}))
vi.mock('../../src/app/cms/forgot/actions', () => ({
  forgotPassword: vi.fn(),
}))
vi.mock('../../src/app/cms/reset/actions', () => ({
  resetPassword: vi.fn(),
}))

import CmsLoginPage from '../../src/app/cms/login/page'
import CmsForgotPage from '../../src/app/cms/forgot/page'
import CmsResetPage from '../../src/app/cms/reset/page'

describe('cms login pages', () => {
  it('mounts <CmsLogin> with actions and optional turnstile prop', async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-key'
    const el = await CmsLoginPage()
    render(el)
    expect(screen.getByTestId('cms-login-component')).toBeTruthy()
    const callProps = mockCmsLogin.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callProps).toHaveProperty('actions')
    expect(callProps).toHaveProperty('turnstile')
    expect((callProps.turnstile as { siteKey: string }).siteKey).toBe('test-key')
  })

  it('passes undefined turnstile when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset', async () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    mockCmsLogin.mockClear()
    const el = await CmsLoginPage()
    render(el)
    const callProps = mockCmsLogin.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callProps.turnstile).toBeUndefined()
  })

  it('mounts <CmsForgotPassword>', () => {
    render(<CmsForgotPage />)
    expect(screen.getByTestId('cms-forgot-component')).toBeTruthy()
  })

  it('mounts <CmsResetPassword>', () => {
    render(<CmsResetPage />)
    expect(screen.getByTestId('cms-reset-component')).toBeTruthy()
  })
})
