import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks must be defined before any imports ──────────────────────────────────

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 'site-1', orgId: 'org-1', defaultLocale: 'pt-BR' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: () => Promise.resolve({ ok: true }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

vi.mock('@/lib/youtube/api-client', () => ({
  lookupChannelByHandle: vi.fn(),
}))

// ── Supabase mock helpers ─────────────────────────────────────────────────────

const upsertMock = vi.fn().mockResolvedValue({ error: null })
const updateMock = vi.fn()
const eqMock = vi.fn()

function buildChain() {
  const chain = {
    upsert: upsertMock,
    update: vi.fn(() => chain),
    eq: vi.fn().mockResolvedValue({ error: null }),
  }
  return chain
}

const fromMock = vi.fn(() => buildChain())

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: fromMock }),
}))

// ── Import after mocks ────────────────────────────────────────────────────────

import {
  updateContactHeroText,
  updateContactHeroDisplay,
  updateContactSocial,
  updateContactFormSettings,
  updateContactFormText,
  updateContactFaq,
  updateContactVisibility,
} from '../../src/app/cms/(authed)/settings/actions'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('updateContactHeroText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fromMock.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })
  })

  it('returns ok:false when hero_title is empty', async () => {
    const result = await updateContactHeroText({
      locale: 'pt-BR',
      hero_title: '',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBeTruthy()
  })

  it('returns ok:false when hero_title exceeds 80 chars', async () => {
    const result = await updateContactHeroText({
      locale: 'pt-BR',
      hero_title: 'a'.repeat(81),
    })
    expect(result.ok).toBe(false)
  })

  it('returns ok:true for valid hero text input and calls upsert', async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null })
    fromMock.mockReturnValue({ upsert: upsertFn })

    const result = await updateContactHeroText({
      locale: 'pt-BR',
      hero_title: 'Entre em contato',
      hero_subtitle: 'Estou aqui para ajudar',
      response_time_text: 'Respondo em 24h',
    })

    expect(result.ok).toBe(true)
    expect(fromMock).toHaveBeenCalledWith('contact_page_settings')
    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        site_id: 'site-1',
        locale: 'pt-BR',
        hero_title: 'Entre em contato',
      }),
      { onConflict: 'site_id,locale' },
    )
  })

  it('returns ok:false when DB returns an error', async () => {
    fromMock.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: { message: 'db error' } }),
    })
    const result = await updateContactHeroText({ locale: 'en', hero_title: 'Contact' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('db error')
  })
})

describe('updateContactHeroDisplay', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok:true for valid display toggles and calls upsert on contact_page_visibility', async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null })
    fromMock.mockReturnValue({ upsert: upsertFn })

    const result = await updateContactHeroDisplay({
      show_avatar: true,
      show_bio: false,
      show_response_badge: true,
    })

    expect(result.ok).toBe(true)
    expect(fromMock).toHaveBeenCalledWith('contact_page_visibility')
    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ site_id: 'site-1', show_avatar: true, show_bio: false }),
      { onConflict: 'site_id' },
    )
  })

  it('returns ok:false when DB returns an error', async () => {
    fromMock.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: { message: 'constraint violation' } }),
    })
    const result = await updateContactHeroDisplay({
      show_avatar: false,
      show_bio: false,
      show_response_badge: false,
    })
    expect(result.ok).toBe(false)
  })
})

describe('updateContactSocial', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok:true for valid social settings', async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null })
    fromMock.mockReturnValue({ upsert: upsertFn })

    const result = await updateContactSocial({
      social_order: ['email', 'instagram', 'github'],
      social_visible: { email: true, instagram: false, github: true },
      email_highlight: true,
      handwritten_note: false,
    })

    expect(result.ok).toBe(true)
    expect(fromMock).toHaveBeenCalledWith('contact_page_visibility')
    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        site_id: 'site-1',
        social_order: ['email', 'instagram', 'github'],
        email_highlight: true,
      }),
      { onConflict: 'site_id' },
    )
  })
})

describe('updateContactFormSettings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok:false for invalid email', async () => {
    const result = await updateContactFormSettings({
      notification_email: 'not-an-email',
      show_subject_selector: true,
      show_marketing_consent: false,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBeTruthy()
  })

  it('returns ok:true for empty email (clears notification email)', async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null })
    const eqFn = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn })

    fromMock.mockImplementation((table: string) => {
      if (table === 'sites') return { update: updateFn }
      return { upsert: upsertFn }
    })

    const result = await updateContactFormSettings({
      notification_email: '',
      show_subject_selector: false,
      show_marketing_consent: true,
    })

    expect(result.ok).toBe(true)
  })

  it('returns ok:true with valid email and calls both sites update and visibility upsert', async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null })
    const eqFn = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn })

    fromMock.mockImplementation((table: string) => {
      if (table === 'sites') return { update: updateFn }
      return { upsert: upsertFn }
    })

    const result = await updateContactFormSettings({
      notification_email: 'admin@example.com',
      show_subject_selector: true,
      show_marketing_consent: true,
    })

    expect(result.ok).toBe(true)
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ contact_notification_email: 'admin@example.com' }),
    )
    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        site_id: 'site-1',
        show_subject_selector: true,
        show_marketing_consent: true,
      }),
      { onConflict: 'site_id' },
    )
  })

  it('returns ok:false when sites update fails', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: { message: 'update failed' } })
    fromMock.mockImplementation((table: string) => {
      if (table === 'sites') return { update: vi.fn().mockReturnValue({ eq: eqFn }) }
      return { upsert: vi.fn().mockResolvedValue({ error: null }) }
    })

    const result = await updateContactFormSettings({
      notification_email: 'admin@example.com',
      show_subject_selector: false,
      show_marketing_consent: false,
    })
    expect(result.ok).toBe(false)
  })
})

describe('updateContactFormText', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok:true and filters empty subject_options', async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null })
    fromMock.mockReturnValue({ upsert: upsertFn })

    const result = await updateContactFormText({
      locale: 'pt-BR',
      form_title: 'Fale Comigo',
      auto_reply_text: 'Obrigado pelo contato!',
      subject_options: ['Trabalho', '', '  ', 'Parceria'],
    })

    expect(result.ok).toBe(true)
    const upsertArg = upsertFn.mock.calls[0]![0] as { subject_options: string[] }
    expect(upsertArg.subject_options).toEqual(['Trabalho', 'Parceria'])
  })

  it('returns ok:false when form_title exceeds max length', async () => {
    const result = await updateContactFormText({
      locale: 'en',
      form_title: 'x'.repeat(101),
      subject_options: [],
    })
    expect(result.ok).toBe(false)
  })
})

describe('updateContactFaq', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok:true and saves FAQ items, filtering empty ones', async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null })
    fromMock.mockReturnValue({ upsert: upsertFn })

    const result = await updateContactFaq({
      locale: 'pt-BR',
      faq_items: [
        { q: 'Qual o prazo?', a: 'Até 5 dias úteis.' },
        { q: '', a: '' },
        { q: 'Como funciona?', a: 'De forma simples.' },
      ],
    })

    expect(result.ok).toBe(true)
    expect(fromMock).toHaveBeenCalledWith('contact_page_settings')
    const upsertArg = upsertFn.mock.calls[0]![0] as { faq_items: { q: string; a: string }[] }
    expect(upsertArg.faq_items).toHaveLength(2)
    expect(upsertArg.faq_items[0]!.q).toBe('Qual o prazo?')
  })

  it('returns ok:false when a question exceeds 300 chars', async () => {
    const result = await updateContactFaq({
      locale: 'en',
      faq_items: [{ q: 'q'.repeat(301), a: 'answer' }],
    })
    expect(result.ok).toBe(false)
  })

  it('returns ok:false when an answer exceeds 2000 chars', async () => {
    const result = await updateContactFaq({
      locale: 'en',
      faq_items: [{ q: 'Question?', a: 'a'.repeat(2001) }],
    })
    expect(result.ok).toBe(false)
  })
})

describe('updateContactVisibility', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok:true and saves visibility toggles', async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null })
    fromMock.mockReturnValue({ upsert: upsertFn })

    const result = await updateContactVisibility({
      show_hero: true,
      show_social_links: false,
      show_contact_form: true,
      show_faq: true,
    })

    expect(result.ok).toBe(true)
    expect(fromMock).toHaveBeenCalledWith('contact_page_visibility')
    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        site_id: 'site-1',
        show_hero: true,
        show_social_links: false,
        show_contact_form: true,
        show_faq: true,
      }),
      { onConflict: 'site_id' },
    )
  })

  it('returns ok:false when DB returns an error', async () => {
    fromMock.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: { message: 'upsert failed' } }),
    })
    const result = await updateContactVisibility({
      show_hero: false,
      show_social_links: false,
      show_contact_form: false,
      show_faq: false,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('upsert failed')
  })
})
