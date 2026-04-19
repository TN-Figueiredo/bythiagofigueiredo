import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// Mock PinboardHome and all its transitive deps (resend, supabase, etc.)
vi.mock('../src/app/(public)/components/PinboardHome', () => ({
  PinboardHome: () => null,
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) }),
  headers: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(null) }),
}))

vi.mock('@/lib/cms/site-context', () => ({
  tryGetSiteContext: vi.fn().mockResolvedValue(null),
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'test-site' }),
}))

vi.mock('@/lib/seo/config', () => ({
  getSiteSeoConfig: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/seo/page-metadata', () => ({
  generateRootMetadata: vi.fn().mockReturnValue({ title: 'Test' }),
}))

import Home from '../src/app/(public)/page'

describe('homepage', () => {
  it('renders without error when no search params', async () => {
    const el = await Home({ searchParams: Promise.resolve({}) })
    const { container } = render(el)
    expect(container).toBeTruthy()
  })

  it('does NOT render the insufficient_access banner when no error param', async () => {
    const el = await Home({ searchParams: Promise.resolve({}) })
    const { queryByTestId } = render(el)
    expect(queryByTestId('insufficient-access-banner')).toBeNull()
  })

  it('does NOT render banner when error param is something else', async () => {
    const el = await Home({ searchParams: Promise.resolve({ error: 'other' }) })
    const { queryByTestId } = render(el)
    expect(queryByTestId('insufficient-access-banner')).toBeNull()
  })

  it('renders the insufficient_access banner when ?error=insufficient_access', async () => {
    const el = await Home({
      searchParams: Promise.resolve({ error: 'insufficient_access' }),
    })
    const { getByTestId, getByRole } = render(el)
    const banner = getByTestId('insufficient-access-banner')
    expect(banner).toBeTruthy()
    // role="alert" with aria-live makes it accessible to screen readers
    expect(getByRole('alert')).toBeTruthy()
    expect(banner.textContent).toMatch(/acesso/i)
  })
})
