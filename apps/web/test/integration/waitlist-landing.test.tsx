import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { FORM_STRINGS } from '../../src/components/waitlists/form-strings'

// Hosted landing resolves the site via getSiteContext (x-site-id/x-default-locale),
// exactly like the Task 7 status route — so mock that, not resolveSiteByHost.
vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () =>
    Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'en', timezone: 'UTC' }),
  tryGetSiteContext: () =>
    Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'en', timezone: 'UTC' }),
}))

const h = vi.hoisted(() => ({ row: null as unknown }))
vi.mock('@/lib/supabase/service', () => {
  const chain: Record<string, unknown> = {}
  chain.eq = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data: h.row, error: null }))
  return {
    getSupabaseServiceClient: vi.fn(() => ({
      from: vi.fn(() => ({ select: vi.fn(() => chain) })),
    })),
  }
})

import WaitlistLandingPage from '../../src/app/(public)/waitlists/[slug]/page'

const en = FORM_STRINGS.en

function row(status: 'open' | 'closed' | 'launched') {
  return {
    id: 'w1',
    status,
    name: 'My Product',
    description: 'A thing worth waiting for',
    waitlist_translations: [
      {
        locale: 'en',
        headline: 'My Product',
        subheadline: 'Coming soon',
        consent_label: null,
        button_label: null,
        success_headline: null,
        success_body: null,
        duplicate_headline: null,
        duplicate_body: null,
        closed_message: null,
        launched_message: null,
      },
    ],
  }
}

async function renderPage(slug = 'my-product') {
  const jsx = await WaitlistLandingPage({ params: Promise.resolve({ slug }) })
  return render(jsx as never)
}

describe('WaitlistLandingPage', () => {
  beforeEach(() => {
    h.row = null
  })

  it('renders the signup form (email input) when status=open', async () => {
    h.row = row('open')
    const { queryByPlaceholderText, container } = await renderPage()
    expect(queryByPlaceholderText(en.emailPlaceholder)).not.toBeNull()
    // the resolved headline shows in the pitch column
    expect(container.textContent).toContain('My Product')
  })

  it('renders the closed message block and NO email field when status=closed', async () => {
    h.row = row('closed')
    const { queryByPlaceholderText, container } = await renderPage()
    expect(container.textContent).toContain(en.closed)
    expect(queryByPlaceholderText(en.emailPlaceholder)).toBeNull()
  })

  it('calls notFound (throws) for a non-existent slug', async () => {
    h.row = null
    await expect(
      WaitlistLandingPage({ params: Promise.resolve({ slug: 'missing' }) }),
    ).rejects.toThrow()
  })
})
