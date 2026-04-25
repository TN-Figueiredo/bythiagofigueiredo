import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

vi.mock('@/app/cms/(authed)/settings/actions', () => ({
  updateBranding: vi.fn().mockResolvedValue({ ok: true }),
  updateIdentity: vi.fn().mockResolvedValue({ ok: true }),
  updateSeoDefaults: vi.fn().mockResolvedValue({ ok: true }),
  updateNewsletterType: vi.fn().mockResolvedValue({ ok: true }),
  createNewsletterType: vi.fn().mockResolvedValue({ ok: true }),
  deleteNewsletterType: vi.fn().mockResolvedValue({ ok: true }),
  reorderNewsletterTypes: vi.fn().mockResolvedValue({ ok: true }),
  updateBlogCadence: vi.fn().mockResolvedValue({ ok: true }),
  updateSiteLocales: vi.fn().mockResolvedValue({ ok: true }),
  disableCms: vi.fn().mockResolvedValue({ ok: true }),
  deleteSite: vi.fn().mockResolvedValue({ ok: true }),
}))

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

const mockSite = {
  id: 'site-1',
  logo_url: 'https://example.com/logo.png',
  primary_color: '#000000',
  identity_type: 'person',
  twitter_handle: 'tnFigueiredo',
  seo_default_og_image: null,
  supported_locales: ['pt-BR', 'en'],
  default_locale: 'pt-BR',
  cms_enabled: true,
  slug: 'test-site',
}

const mockNewsletterTypes = [
  {
    id: 'nt-1',
    name: 'Weekly Digest',
    cadence_days: 7,
    preferred_send_time: '08:00',
    cadence_paused: false,
    sort_order: 0,
    sender_name: 'Thiago',
    sender_email: 'news@example.com',
    reply_to: null,
    color: '#6366f1',
  },
]

const mockBlogCadence = [
  {
    locale: 'pt-BR',
    cadence_days: 7,
    preferred_send_time: '09:00',
    cadence_start_date: null,
  },
]

const mockSeoFlags = {
  jsonLd: true,
  dynamicOg: true,
  extendedSchemas: true,
  aiCrawlersBlocked: false,
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

async function renderSettings(overrides: Record<string, unknown> = {}) {
  const { SettingsConnected } = await import(
    '@/app/cms/(authed)/settings/settings-connected'
  )
  return render(
    <SettingsConnected
      site={mockSite}
      newsletterTypes={mockNewsletterTypes}
      blogCadence={mockBlogCadence}
      initialSection="branding"
      seoFlags={mockSeoFlags}
      readOnly={false}
      {...overrides}
    />,
  )
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('SettingsConnected', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /* ---- Tab rendering ---- */

  it('renders 6 tab buttons', async () => {
    await renderSettings()
    expect(screen.getByRole('button', { name: /branding/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /seo/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /newsletters/i })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /blog cadence/i }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /localization/i }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /danger zone/i }),
    ).toBeTruthy()
  })

  /* ---- Default section ---- */

  it('shows branding section by default', async () => {
    await renderSettings()
    expect(screen.getByLabelText(/logo url/i)).toBeTruthy()
    expect(screen.getByLabelText(/primary color/i)).toBeTruthy()
  })

  /* ---- Tab switching ---- */

  it('switches section on tab click', async () => {
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /seo/i }))
    expect(screen.getByLabelText(/default og image/i)).toBeTruthy()
  })

  it('switches to newsletters section', async () => {
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /newsletters/i }))
    expect(screen.getByText(/Weekly Digest/)).toBeTruthy()
  })

  it('switches to blog cadence section', async () => {
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /blog cadence/i }))
    expect(screen.getAllByText('pt-BR').length).toBeGreaterThan(0)
  })

  it('switches to localization section', async () => {
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /localization/i }))
    expect(screen.getByLabelText(/default locale/i)).toBeTruthy()
  })

  it('switches to danger zone section', async () => {
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /danger zone/i }))
    expect(screen.getAllByText(/danger zone/i).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('button', { name: /delete site/i })).toBeTruthy()
  })

  /* ---- Branding validation ---- */

  it('shows error on invalid logo URL', async () => {
    await renderSettings()
    const input = screen.getByLabelText(/logo url/i)
    fireEvent.change(input, { target: { value: 'http://bad.com' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/must start with https/i)).toBeTruthy()
  })

  it('shows error on invalid hex color', async () => {
    await renderSettings()
    const input = screen.getByLabelText(/primary color/i)
    fireEvent.change(input, { target: { value: 'red' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/valid hex/i)).toBeTruthy()
  })

  it('accepts valid branding inputs without error', async () => {
    await renderSettings()
    const logoInput = screen.getByLabelText(/logo url/i)
    const colorInput = screen.getByLabelText(/primary color/i)
    fireEvent.change(logoInput, {
      target: { value: 'https://valid.com/logo.png' },
    })
    fireEvent.change(colorInput, { target: { value: '#ff5500' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(screen.queryByText(/must start with https/i)).toBeNull()
    expect(screen.queryByText(/valid hex/i)).toBeNull()
  })

  /* ---- SEO section ---- */

  it('renders SEO feature flags with actual values', async () => {
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /seo/i }))
    expect(screen.getByText('JSON-LD')).toBeTruthy()
    expect(screen.getByText('Dynamic OG')).toBeTruthy()
    expect(screen.getByText('Extended Schemas')).toBeTruthy()
    expect(screen.getByText('AI Crawlers Blocked')).toBeTruthy()
    const onBadges = screen.getAllByText('On')
    expect(onBadges.length).toBe(3)
    expect(screen.getByText('Off')).toBeTruthy()
  })

  it('renders OG precedence chain info', async () => {
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /seo/i }))
    expect(screen.getByText(/og image precedence/i)).toBeTruthy()
  })

  /* ---- Newsletters section ---- */

  it('shows newsletter type cards with status badges', async () => {
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /newsletters/i }))
    expect(screen.getByText('Weekly Digest')).toBeTruthy()
    expect(screen.getByText('Active')).toBeTruthy()
  })

  it('shows New Type button', async () => {
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /newsletters/i }))
    expect(screen.getByRole('button', { name: /new type/i })).toBeTruthy()
  })

  it('shows create form when New Type is clicked', async () => {
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /newsletters/i }))
    fireEvent.click(screen.getByRole('button', { name: /new type/i }))
    expect(screen.getByLabelText(/new type name/i)).toBeTruthy()
  })

  it('renders empty state when no newsletter types exist', async () => {
    await renderSettings({ newsletterTypes: [] })
    fireEvent.click(screen.getByRole('button', { name: /newsletters/i }))
    expect(screen.getByText(/no newsletter types configured/i)).toBeTruthy()
  })

  /* ---- Localization section ---- */

  it('renders supported locales as tags', async () => {
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /localization/i }))
    expect(screen.getAllByText('pt-BR').length).toBeGreaterThan(0)
    expect(screen.getAllByText('en').length).toBeGreaterThan(0)
  })

  it('prevents removing default locale', async () => {
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /localization/i }))
    expect(screen.queryByLabelText(/remove pt-br/i)).toBeNull()
    expect(screen.getByLabelText(/remove en/i)).toBeTruthy()
  })

  /* ---- Danger zone section ---- */

  it('disables delete button until slug matches', async () => {
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /danger zone/i }))
    const deleteBtn = screen.getByRole('button', { name: /delete site/i })
    expect(deleteBtn.hasAttribute('disabled')).toBe(true)
  })

  it('enables delete button when slug confirmation matches', async () => {
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /danger zone/i }))
    const input = screen.getByPlaceholderText('test-site')
    fireEvent.change(input, { target: { value: 'test-site' } })
    const deleteBtn = screen.getByRole('button', { name: /delete site/i })
    expect(deleteBtn.hasAttribute('disabled')).toBe(false)
  })

  /* ---- Identity type ---- */

  it('renders identity type radio buttons', async () => {
    await renderSettings()
    const personRadio = screen.getByRole('radio', {
      name: /person/i,
    }) as HTMLInputElement
    const orgRadio = screen.getByRole('radio', {
      name: /organization/i,
    }) as HTMLInputElement
    expect(personRadio.checked).toBe(true)
    expect(orgRadio.checked).toBe(false)
  })

  /* ---- Color swatch preview ---- */

  it('renders color swatch with current value', async () => {
    await renderSettings()
    const swatch = screen.getByLabelText(/color preview/i)
    expect(swatch).toBeTruthy()
    expect(swatch.style.backgroundColor).toBeTruthy()
  })

  /* ---- Initial section from props ---- */

  it('renders SEO section when initialSection=seo', async () => {
    const { SettingsConnected } = await import(
      '@/app/cms/(authed)/settings/settings-connected'
    )
    render(
      <SettingsConnected
        site={mockSite}
        newsletterTypes={[]}
        blogCadence={[]}
        initialSection="seo"
        seoFlags={mockSeoFlags}
      />,
    )
    expect(screen.getByLabelText(/default og image/i)).toBeTruthy()
  })

  /* ---- Read-only mode ---- */

  it('shows read-only banner when readOnly=true', async () => {
    await renderSettings({ readOnly: true })
    expect(screen.getByText(/read-only access/i)).toBeTruthy()
  })

  it('hides save button in read-only mode', async () => {
    await renderSettings({ readOnly: true })
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
  })

  it('disables inputs in read-only mode', async () => {
    await renderSettings({ readOnly: true })
    const input = screen.getByLabelText(/logo url/i) as HTMLInputElement
    expect(input.disabled).toBe(true)
  })

  it('hides danger zone tab in read-only mode', async () => {
    await renderSettings({ readOnly: true })
    expect(
      screen.queryByRole('button', { name: /danger zone/i }),
    ).toBeNull()
  })

  /* ---- Mobile sidebar ---- */

  it('renders mobile sidebar toggle button', async () => {
    await renderSettings()
    expect(
      screen.getByRole('button', { name: /toggle settings menu/i }),
    ).toBeTruthy()
  })

  /* ---- Accessibility ---- */

  it('has aria-label on settings nav', async () => {
    await renderSettings()
    expect(
      screen.getByRole('navigation', { name: /settings sections/i }),
    ).toBeTruthy()
  })
})
