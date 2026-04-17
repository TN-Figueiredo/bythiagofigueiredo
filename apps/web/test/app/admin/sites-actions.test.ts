import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Sprint 5b PR-C Task C.9 — admin sites actions tests.
 *
 * Validates the three branding/identity/seo-defaults actions do the right
 * thing across three axes: happy path (DB updated + `seo-config` tag flushed),
 * Zod validation rejection, and `requireArea('admin')` denial (rethrown as a
 * redirect).
 */

// ── Mocks (hoisted) ───────────────────────────────────────────────────────
// `vi.mock` is hoisted to the top of the file, so the factory cannot close
// over locals declared later. `vi.hoisted` co-hoists the captures + fakes so
// the factories can reference them safely.

const {
  revalidateSiteBrandingMock,
  updateCapture,
  updateChain,
  supabaseMock,
  requireAreaMock,
  sentryCaptureMock,
} = vi.hoisted(() => {
  const revalidateSiteBrandingMock = vi.fn()

  // Fluent update-chain: `.from(...).update(patch).eq('id', siteId)`.
  // We capture the patch and the eq args so individual tests can assert the
  // column names we wrote (snake_case) and the site scoping.
  const updateCapture: {
    table: string | null
    patch: unknown
    eqArgs: [string, unknown] | null
  } = { table: null, patch: null, eqArgs: null }

  const updateChain = {
    eq: vi.fn((col: string, val: unknown) => {
      updateCapture.eqArgs = [col, val]
      return Promise.resolve({ data: null, error: null })
    }),
  }

  const supabaseMock = {
    from: vi.fn((table: string) => {
      updateCapture.table = table
      return {
        update: vi.fn((patch: unknown) => {
          updateCapture.patch = patch
          return updateChain
        }),
      }
    }),
  }

  const requireAreaMock = vi.fn(async (_area: 'admin' | 'cms') => undefined)
  const sentryCaptureMock = vi.fn()

  return {
    revalidateSiteBrandingMock,
    updateCapture,
    updateChain,
    supabaseMock,
    requireAreaMock,
    sentryCaptureMock,
  }
})

vi.mock('@/lib/seo/cache-invalidation', () => ({
  revalidateSiteBranding: revalidateSiteBrandingMock,
  revalidateBlogPostSeo: vi.fn(),
  revalidateCampaignSeo: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => supabaseMock,
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireArea: requireAreaMock,
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: sentryCaptureMock,
}))

// ── Subject under test ────────────────────────────────────────────────────

import {
  updateSiteBranding,
  updateSiteIdentity,
  updateSiteSeoDefaults,
} from '../../../src/app/admin/(authed)/sites/actions'

// A syntactically valid UUID — Zod `.uuid()` accepts it.
const SITE_ID = '00000000-0000-4000-8000-000000000001'

describe('admin sites actions (Sprint 5b PR-C Task C.9)', () => {
  beforeEach(() => {
    revalidateSiteBrandingMock.mockClear()
    requireAreaMock.mockReset()
    requireAreaMock.mockImplementation(async () => undefined)
    sentryCaptureMock.mockClear()
    supabaseMock.from.mockClear()
    updateChain.eq.mockClear()
    updateCapture.table = null
    updateCapture.patch = null
    updateCapture.eqArgs = null
  })

  // ── updateSiteBranding ──────────────────────────────────────────────────

  describe('updateSiteBranding', () => {
    it('writes primary_color + logo_url and invalidates seo-config', async () => {
      const result = await updateSiteBranding({
        siteId: SITE_ID,
        primaryColor: '#FF00AA',
        logoUrl: 'https://cdn.example.com/logo.png',
      })
      expect(result).toEqual({ ok: true })
      expect(updateCapture.table).toBe('sites')
      expect(updateCapture.patch).toEqual({
        primary_color: '#FF00AA',
        logo_url: 'https://cdn.example.com/logo.png',
      })
      expect(updateCapture.eqArgs).toEqual(['id', SITE_ID])
      expect(revalidateSiteBrandingMock).toHaveBeenCalledTimes(1)
    })

    it('returns validation_failed for a non-hex primary_color', async () => {
      const result = await updateSiteBranding({
        siteId: SITE_ID,
        primaryColor: 'not-a-hex',
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toBe('validation_failed')
      expect(supabaseMock.from).not.toHaveBeenCalled()
      expect(revalidateSiteBrandingMock).not.toHaveBeenCalled()
    })

    it('propagates requireArea redirects (does not swallow the redirect)', async () => {
      // `requireArea` redirects via Next internals, which throws a
      // NEXT_REDIRECT sentinel. We mimic that with a plain Error the action
      // must re-raise rather than convert to `{ ok: false }`.
      const redirectSignal = new Error('NEXT_REDIRECT:/?error=insufficient_access')
      requireAreaMock.mockRejectedValueOnce(redirectSignal)
      await expect(
        updateSiteBranding({ siteId: SITE_ID, primaryColor: '#FF00AA' }),
      ).rejects.toBe(redirectSignal)
      expect(supabaseMock.from).not.toHaveBeenCalled()
      expect(revalidateSiteBrandingMock).not.toHaveBeenCalled()
    })

    it('rejects unknown keys via .strict()', async () => {
      const result = await updateSiteBranding(
        // @ts-expect-error — intentionally passing an unknown key.
        { siteId: SITE_ID, primaryColor: '#FF00AA', bogus: 'yes' },
      )
      expect(result.ok).toBe(false)
    })
  })

  // ── updateSiteIdentity ──────────────────────────────────────────────────

  describe('updateSiteIdentity', () => {
    it('writes identity_type + twitter_handle and invalidates seo-config', async () => {
      const result = await updateSiteIdentity({
        siteId: SITE_ID,
        identityType: 'organization',
        twitterHandle: 'tnf_org',
      })
      expect(result).toEqual({ ok: true })
      expect(updateCapture.patch).toEqual({
        identity_type: 'organization',
        twitter_handle: 'tnf_org',
      })
      expect(revalidateSiteBrandingMock).toHaveBeenCalledTimes(1)
    })

    it('clears twitter_handle when null is passed', async () => {
      const result = await updateSiteIdentity({
        siteId: SITE_ID,
        identityType: 'person',
        twitterHandle: null,
      })
      expect(result).toEqual({ ok: true })
      expect(updateCapture.patch).toEqual({
        identity_type: 'person',
        twitter_handle: null,
      })
      expect(revalidateSiteBrandingMock).toHaveBeenCalledTimes(1)
    })

    it('returns validation_failed for a twitter_handle with @ prefix', async () => {
      const result = await updateSiteIdentity({
        siteId: SITE_ID,
        identityType: 'person',
        twitterHandle: '@invalid',
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toBe('validation_failed')
      expect(supabaseMock.from).not.toHaveBeenCalled()
    })

    it('propagates requireArea redirects', async () => {
      const redirectSignal = new Error('NEXT_REDIRECT:/?error=insufficient_access')
      requireAreaMock.mockRejectedValueOnce(redirectSignal)
      await expect(
        updateSiteIdentity({
          siteId: SITE_ID,
          identityType: 'person',
          twitterHandle: 'tnFigueiredo',
        }),
      ).rejects.toBe(redirectSignal)
    })
  })

  // ── updateSiteSeoDefaults ───────────────────────────────────────────────

  describe('updateSiteSeoDefaults', () => {
    it('writes seo_default_og_image and invalidates seo-config', async () => {
      const result = await updateSiteSeoDefaults({
        siteId: SITE_ID,
        defaultOgImage: 'https://example.com/og.png',
      })
      expect(result).toEqual({ ok: true })
      expect(updateCapture.patch).toEqual({
        seo_default_og_image: 'https://example.com/og.png',
      })
      expect(revalidateSiteBrandingMock).toHaveBeenCalledTimes(1)
    })

    it('returns validation_failed for a non-https og image URL', async () => {
      const result = await updateSiteSeoDefaults({
        siteId: SITE_ID,
        defaultOgImage: 'http://insecure.example.com/og.png',
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toBe('validation_failed')
      expect(supabaseMock.from).not.toHaveBeenCalled()
    })

    it('propagates requireArea redirects', async () => {
      const redirectSignal = new Error('NEXT_REDIRECT:/?error=insufficient_access')
      requireAreaMock.mockRejectedValueOnce(redirectSignal)
      await expect(
        updateSiteSeoDefaults({
          siteId: SITE_ID,
          defaultOgImage: 'https://example.com/og.png',
        }),
      ).rejects.toBe(redirectSignal)
    })
  })
})
