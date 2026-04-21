import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Sprint 5b PR-C C.5: campaign page now reads headers() + site context +
// SEO config to build Article + Breadcrumb JSON-LD. Stub the out-of-scope
// dependencies so the unit test keeps asserting rendering behavior only.
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Map([['host', 'example.com']])),
}))
vi.mock('../../lib/cms/site-context', () => ({
  tryGetSiteContext: () => Promise.resolve(null),
}))

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  id: 'c1',
                  status: 'published',
                  pdf_storage_path: null,

                  interest: 'creator',
                  form_fields: [],
                  campaign_translations: [
                    {
                      locale: 'pt-BR',
                      slug: 'oferta',
                      main_hook_md: '# Hello',
                      supporting_argument_md: null,
                      introductory_block_md: null,
                      body_content_md: null,
                      form_intro_md: null,
                      form_button_label: 'Enviar',
                      form_button_loading_label: 'Enviando...',
                      context_tag: 'Tag',
                      success_headline: 'OK',
                      success_headline_duplicate: 'Again',
                      success_subheadline: 'Sub',
                      success_subheadline_duplicate: 'SubDup',
                      check_mail_text: 'Check',
                      download_button_label: 'Download',
                      extras: null,
                      meta_title: 'T',
                      meta_description: 'D',
                      og_image_url: null,
                    },
                  ],
                },
                error: null,
              }),
          }),
        }),
      }),
    }),
  }),
}))

import Page from '../../src/app/campaigns/[locale]/[slug]/page'

describe('Campaign page', () => {
  it('renders main hook markdown as an <h1> element (via react-markdown)', async () => {
    const jsx = await Page({ params: Promise.resolve({ locale: 'pt-BR', slug: 'oferta' }) })
    render(jsx as never)
    const heading = screen.getByRole('heading', { level: 1, name: /Hello/ })
    expect(heading).toBeTruthy()
    expect(heading.textContent).toBe('Hello')
  })
})
