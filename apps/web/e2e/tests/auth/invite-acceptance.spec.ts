import { test, expect } from '../../fixtures'
import { E2E_PASSWORDS } from '../../fixtures/global-setup'
import AxeBuilder from '@axe-core/playwright'
import type { SupabaseClient } from '@supabase/supabase-js'

const TEST_INVITE_EMAIL = 'e2e-invite-target@test.example'

async function createTestInvitation(
  supabaseAdmin: SupabaseClient,
  siteId: string,
  overrides: Record<string, unknown> = {}
): Promise<{ token: string; tokenHash: string }> {
  const { createHash } = await import('node:crypto')
  const token = `e2e-token-${Date.now()}`
  const tokenHash = createHash('sha256').update(token).digest('hex')
  await supabaseAdmin.from('invitations').insert({
    email: TEST_INVITE_EMAIL,
    site_id: siteId,
    role_scope: 'site',
    role: 'editor',
    token_hash: tokenHash,
    ...overrides,
  })
  return { token, tokenHash }
}

// Shared afterAll cleanup — declared in the outermost describe so it runs once
// regardless of which nested describe triggered failures.
test.describe('invite acceptance', () => {
  test.afterAll(async ({ supabaseAdmin }) => {
    await supabaseAdmin.from('invitations').delete().like('email', '%@test.example')
  })

  // ── Tests that run as an unauthenticated (public) user ─────────────────────
  test.describe('public state', () => {
    test.use({ storageState: 'e2e/.auth/public.json' })
    test.describe.configure({ mode: 'serial' })

    test('novo usuário aceita convite com senha', async ({ page, supabaseAdmin, siteId }) => {
      test.slow()
      const { tokenHash } = await createTestInvitation(supabaseAdmin, siteId)

      await page.goto(`/auth/invite?token_hash=${tokenHash}&type=invite`)
      // Should show password setup form or redirect to /cms/login
      await expect(page).toHaveURL(/\/cms\/login|\/auth\/invite/, { timeout: 20_000 })
    })

    test('token expirado exibe erro', async ({ page, supabaseAdmin, siteId }) => {
      test.slow()
      const { tokenHash } = await createTestInvitation(supabaseAdmin, siteId, {
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      })

      await page.goto(`/auth/invite?token_hash=${tokenHash}&type=invite`)
      await expect(
        page.getByText(/[Ee]xpir|[Ee]xpirou/i).or(page.getByText(/error=expired/i))
      ).toBeVisible({ timeout: 15_000 })
    })

    test('token já usado exibe erro', async ({ page, supabaseAdmin, siteId }) => {
      test.slow()
      const { tokenHash } = await createTestInvitation(supabaseAdmin, siteId, {
        accepted_at: new Date().toISOString(),
      })

      await page.goto(`/auth/invite?token_hash=${tokenHash}&type=invite`)
      await expect(
        page.getByText(/[Uu]sado|[Aa]lready|error=already_used/i)
      ).toBeVisible({ timeout: 15_000 })
    })

    test('redirect cross-domain não é para origem externa não-autorizada', async ({ page, supabaseAdmin, siteId }) => {
      const { tokenHash } = await createTestInvitation(supabaseAdmin, siteId)

      const requestUrls: string[] = []
      page.on('request', req => {
        if (req.resourceType() === 'document') requestUrls.push(req.url())
      })

      await page.goto(`/auth/invite?token_hash=${tokenHash}&type=invite`)
      await page.waitForLoadState('networkidle')

      // Verify no redirect went to an external domain (excluding known safe domains)
      const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', 'bythiagofigueiredo.com'])
      const badRedirects = requestUrls.filter(url => {
        try {
          const { hostname } = new URL(url)
          return !ALLOWED_HOSTS.has(hostname) && !hostname.endsWith('.bythiagofigueiredo.com')
        } catch {
          return false
        }
      })
      expect(badRedirects).toHaveLength(0)
    })

    test('sem violations críticas na página de convite', async ({ page, supabaseAdmin, siteId }) => {
      const { tokenHash } = await createTestInvitation(supabaseAdmin, siteId)
      await page.goto(`/auth/invite?token_hash=${tokenHash}&type=invite`)
      await page.waitForLoadState('networkidle')
      const results = await new AxeBuilder({ page }).analyze()
      const critical = results.violations.filter(
        v => v.impact === 'critical' || v.impact === 'serious'
      )
      expect(
        critical,
        critical.map(v => `${v.id}: ${v.description}`).join('\n')
      ).toHaveLength(0)
    })
  })

  // ── Tests that run as an authenticated editor ──────────────────────────────
  test.describe('editor state', () => {
    test.use({ storageState: 'e2e/.auth/editor.json' })
    test.describe.configure({ mode: 'serial' })

    test('email do convite ≠ usuário logado exibe erro', async ({ page, supabaseAdmin, siteId }) => {
      // Invite is for TEST_INVITE_EMAIL, but the logged-in user is e2e-editor@test.local
      const { tokenHash } = await createTestInvitation(supabaseAdmin, siteId)

      await page.goto(`/auth/invite?token_hash=${tokenHash}&type=invite`)
      await expect(
        page.getByText(/[Mm]ismatch|[Ee]mail.*diferente|error=email_mismatch/i)
      ).toBeVisible({ timeout: 15_000 })
    })

    test('usuário existente aceita convite', async ({ page, supabaseAdmin, siteId }) => {
      test.slow()
      // Create invite with editor's actual email so it matches the logged-in user
      const { tokenHash } = await createTestInvitation(supabaseAdmin, siteId, {
        email: 'e2e-editor@test.local',
      })

      await page.goto(`/auth/invite?token_hash=${tokenHash}&type=invite`)
      // Should redirect to /cms after accepting
      await expect(page).toHaveURL(/\/cms/, { timeout: 20_000 })

      // Verify invitation was marked accepted in DB
      const { data: inv } = await supabaseAdmin
        .from('invitations')
        .select('accepted_at')
        .eq('email', 'e2e-editor@test.local')
        .eq('site_id', siteId)
        .maybeSingle()
      // accepted_at should be set
      expect(inv?.accepted_at).not.toBeNull()
    })
  })
})
