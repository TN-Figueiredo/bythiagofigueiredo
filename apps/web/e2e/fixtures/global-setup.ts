import path from 'node:path'
import dotenv from 'dotenv'
import type { FullConfig } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') })

export const E2E_PASSWORDS = {
  admin:    process.env.E2E_ADMIN_PASSWORD    ?? 'E2e@Admin2026!',
  editor:   process.env.E2E_EDITOR_PASSWORD   ?? 'E2e@Editor2026!',
  reporter: process.env.E2E_REPORTER_PASSWORD ?? 'E2e@Reporter2026!',
} as const

async function waitForSupabase(url: string, serviceKey: string, maxAttempts = 20): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${url}/rest/v1/`, {
        headers: { apikey: serviceKey },
      })
      if (res.ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 2000))
  }
  throw new Error(`Supabase did not become ready at ${url} after ${maxAttempts} attempts`)
}

async function clearInbucket(inbucketUrl: string): Promise<void> {
  const mailboxes = ['e2e-newsletter', 'e2e-newsletter-test', 'e2e-invite', 'e2e-admin', 'e2e-editor', 'e2e-reporter']
  await Promise.allSettled(
    mailboxes.map(mb =>
      fetch(`${inbucketUrl}/api/v1/mailbox/${mb}`, { method: 'DELETE' })
    )
  )
}

async function createTestUsers(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, serviceKey)

  const { data: existing } = await supabase.auth.admin.listUsers()
  const existingEmails = new Set(existing?.users.map(u => u.email) ?? [])

  const users = [
    { email: 'e2e-admin@test.local',    password: E2E_PASSWORDS.admin },
    { email: 'e2e-editor@test.local',   password: E2E_PASSWORDS.editor },
    { email: 'e2e-reporter@test.local', password: E2E_PASSWORDS.reporter },
    { email: 'e2e-invite@test.local',   password: 'E2e@Invite2026!' },
  ]

  for (const user of users) {
    if (!existingEmails.has(user.email)) {
      const { error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      })
      if (error) throw new Error(`Failed to create user ${user.email}: ${error.message}`)
    }
  }

  const { data: allUsers } = await supabase.auth.admin.listUsers()
  const userMap = new Map(allUsers?.users.map(u => [u.email, u.id]) ?? [])

  const { data: masterOrg, error: orgError } = await supabase
    .from('organizations')
    .select('id')
    .is('parent_org_id', null)
    .single()
  if (orgError || !masterOrg) throw new Error(`Master organization not found — run migrations first: ${orgError?.message}`)

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id')
    .eq('slug', 'bythiagofigueiredo')
    .single()
  if (siteError || !site) throw new Error(`Site 'bythiagofigueiredo' not found — run migrations first: ${siteError?.message}`)

  const adminId    = userMap.get('e2e-admin@test.local')
  const editorId   = userMap.get('e2e-editor@test.local')
  const reporterId = userMap.get('e2e-reporter@test.local')

  if (!adminId || !editorId || !reporterId) {
    throw new Error(`Test users not found in DB after creation — admin:${adminId} editor:${editorId} reporter:${reporterId}`)
  }

  const { error: adminErr } = await supabase.from('organization_members').upsert(
    { org_id: masterOrg.id, user_id: adminId, role: 'org_admin' },
    { onConflict: 'org_id,user_id' },
  )
  if (adminErr) throw new Error(`Failed to assign admin role: ${adminErr.message}`)

  const { error: editorErr } = await supabase.from('site_memberships').upsert(
    { site_id: site.id, user_id: editorId, role: 'editor' },
    { onConflict: 'site_id,user_id' },
  )
  if (editorErr) throw new Error(`Failed to assign editor role: ${editorErr.message}`)

  const { error: reporterErr } = await supabase.from('site_memberships').upsert(
    { site_id: site.id, user_id: reporterId, role: 'reporter' },
    { onConflict: 'site_id,user_id' },
  )
  if (reporterErr) throw new Error(`Failed to assign reporter role: ${reporterErr.message}`)
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const inbucketUrl = process.env.INBUCKET_URL ?? 'http://127.0.0.1:54324'

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — copy .env.test.example to .env.test')
  }

  await waitForSupabase(supabaseUrl, serviceKey)
  await clearInbucket(inbucketUrl)
  await createTestUsers()
}
