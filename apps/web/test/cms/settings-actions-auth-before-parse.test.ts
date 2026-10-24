// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

// GHSA-mrhx-c7xc-m3w5: server action é endpoint público por ID. A autorização
// tem de rodar ANTES de o zod olhar o payload, e o erro devolvido é limitado.
vi.mock('@/lib/cms/auth-guards', () => ({
  denyUnlessSiteAdmin: async () => null,
}))
vi.mock('next/cache', () => ({
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => {
    throw new Error('service client must not be reached')
  }),
}))
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1', orgId: 'org-1', defaultLocale: 'pt-BR' }),
}))

const { requireSiteScope } = vi.hoisted(() => ({ requireSiteScope: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn(),
  requireSiteScope,
}))

import * as actions from '@/app/cms/(authed)/settings/actions'

type Fn = (...a: unknown[]) => Promise<unknown>
const bad = {}
const CASES: Array<[string, unknown[]]> = [
  ['updateBranding', [bad]],
  ['updateIdentity', [bad]],
  ['updateSeoDefaults', [bad]],
  ['updateNewsletterType', ['id', bad]],
  ['createNewsletterType', [bad]],
  ['updateBlogCadence', ['pt-BR', bad]],
  ['updateSiteLocales', [bad]],
  ['updateYouTubeChannelSettings', [bad]],
  ['updateSiteTimezone', [bad]],
  ['addInstagramAccount', [{ handle: '', locale: '' }]],
  ['removeInstagramAccount', [bad]],
  ['updateInstagramSettings', [bad]],
  ['setInstagramToken', [bad]],
  ['triggerInstagramSync', [bad]],
  ['updateInstagramSlots', [bad]],
  ['disconnectInstagramAccount', [bad]],
  ['authorizeInstagramRebind', [bad]],
  ['updateContactHeroText', [bad]],
  ['updateContactHeroDisplay', [bad]],
  ['updateContactSocial', [bad]],
  ['updateContactFormSettings', [bad]],
  ['updateContactFormText', [bad]],
  ['updateContactFaq', [bad]],
  ['updateContactVisibility', [bad]],
]

describe('settings actions: autorização antes do parse', () => {
  it.each(CASES)('%s rejeita sem sessão mesmo com payload inválido', async (name, args) => {
    requireSiteScope.mockResolvedValue({ ok: false, reason: 'unauthenticated' })
    const fn = (actions as unknown as Record<string, Fn>)[name]
    expect(fn).toBeTypeOf('function')
    await expect(fn(...args)).rejects.toThrow('unauthenticated')
  })

  function counted(n: number): { arr: string[]; reads: () => number } {
    let reads = 0
    const arr = new Proxy(new Array<string>(n).fill(''), {
      get(t, p, r) {
        if (typeof p === 'string' && /^\d+$/.test(p)) reads++
        return Reflect.get(t, p, r)
      },
    })
    return { arr, reads: () => reads }
  }

  it('autenticado, array gigante não é percorrido pelo zod (guarda de tamanho)', async () => {
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    const { arr, reads } = counted(100_000)
    const r1 = await actions.updateContactFaq({ locale: 'en', faq_items: arr as never })
    const r2 = await actions.updateSiteLocales({ default_locale: 'en', supported_locales: arr })
    const r3 = await actions.updateContactFormText({ locale: 'en', form_title: '', auto_reply_text: '', subject_options: arr })
    const r4 = await actions.updateInstagramSlots({ accountId: '00000000-0000-4000-8000-000000000000', slots: arr as never })
    expect([r1.ok, r2.ok, r3.ok, r4.ok]).toEqual([false, false, false, false])
    expect(reads()).toBeLessThan(20)
  })

  it('autenticado, record e lista de social gigantes são barrados', async () => {
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    const { arr, reads } = counted(100_000)
    const r = await actions.updateContactSocial({
      social_order: arr as never,
      social_visible: {} as never,
      email_highlight: true,
      handwritten_note: true,
    })
    expect(r.ok).toBe(false)
    expect(reads()).toBeLessThan(20)
  })

  it('erro devolvido ao cliente tem no máximo 5 mensagens', async () => {
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    // 50 itens dentro do teto, todos inválidos: sem teto no zodError seriam 100 issues.
    const items = Array.from({ length: 50 }, () => ({ q: 'x'.repeat(301), a: 'y'.repeat(2001) }))
    const r = await actions.updateContactFaq({ locale: 'en', faq_items: items })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.length).toBeLessThanOrEqual(5 * 60 + 8)
  })
})
