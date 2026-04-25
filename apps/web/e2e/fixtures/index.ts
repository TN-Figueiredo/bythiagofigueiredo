import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { test as base } from '@playwright/test'
import dotenv from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') })

// Supabase site constants resolved at import time
export const SITE_SLUG = 'bythiagofigueiredo'

// Site ID will be resolved lazily on first use
let _siteId: string | null = null
async function getSiteId(client: SupabaseClient): Promise<string> {
  if (_siteId) return _siteId
  const { data, error } = await client
    .from('sites')
    .select('id')
    .eq('slug', SITE_SLUG)
    .single()
  if (error || !data) throw new Error(`Site '${SITE_SLUG}' not found: ${error?.message}`)
  _siteId = data.id as string
  return _siteId
}

type TestFixtures = {
  acceptedCookies: void
}

type WorkerFixtures = {
  supabaseAdmin: SupabaseClient
  testId: string
  siteId: string
  editorUserId: string
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Test-scoped: depends on `page` which is test-scoped
  acceptedCookies: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'lgpd_consent',
        JSON.stringify({
          functional: true,
          analytics: true,
          marketing: true,
          version: '2.0',
        }),
      )
    })
    await use()
  },

  // Worker-scoped: no per-request dependencies, safe in beforeAll/afterAll
  supabaseAdmin: [async ({}, use) => {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    await use(client)
  }, { scope: 'worker' }],

  testId: [async ({}, use) => {
    await use(randomUUID().slice(0, 8))
  }, { scope: 'worker' }],

  siteId: [async ({ supabaseAdmin }, use) => {
    const id = await getSiteId(supabaseAdmin)
    await use(id)
  }, { scope: 'worker' }],

  editorUserId: [async ({ supabaseAdmin }, use) => {
    const { data } = await supabaseAdmin.auth.admin.listUsers()
    const editor = data?.users.find(u => u.email === 'e2e-editor@test.local')
    if (!editor) throw new Error('Editor test user not found — run global-setup first')
    await use(editor.id)
  }, { scope: 'worker' }],
})

export { expect } from '@playwright/test'
