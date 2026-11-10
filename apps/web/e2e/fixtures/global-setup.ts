import path from 'node:path'
import dotenv from 'dotenv'
import type { FullConfig } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') })

export const E2E_PASSWORDS = {
  admin:    process.env.E2E_ADMIN_PASSWORD    ?? 'E2e@Admin2026!',
  editor:   process.env.E2E_EDITOR_PASSWORD   ?? 'E2e@Editor2026!',
  reporter: process.env.E2E_REPORTER_PASSWORD ?? 'E2e@Reporter2026!',
  /** A2: `reporter` COM a concessão do desempenho privado (site_private_viewers). A `e2e-reporter` segue sem concessão. */
  leitora:  process.env.E2E_LEITORA_PASSWORD  ?? 'E2e@Leitora2026!',
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

  const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const existingEmails = new Set(existing?.users.map(u => u.email) ?? [])

  const users = [
    { email: 'e2e-admin@test.local',    password: E2E_PASSWORDS.admin },
    { email: 'e2e-editor@test.local',   password: E2E_PASSWORDS.editor },
    { email: 'e2e-reporter@test.local', password: E2E_PASSWORDS.reporter },
    { email: 'e2e-leitora@test.local',  password: E2E_PASSWORDS.leitora },
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

  const { data: allUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
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
  const leitoraId  = userMap.get('e2e-leitora@test.local')

  if (!adminId || !editorId || !reporterId || !leitoraId) {
    throw new Error(`Test users not found in DB after creation — admin:${adminId} editor:${editorId} reporter:${reporterId} leitora:${leitoraId}`)
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

  // A2: a leitora é `reporter` + concessão ativa; a e2e-reporter NÃO tem concessão (proprio-a4-seguranca.spec.ts depende disso).
  const { error: leitoraErr } = await supabase.from('site_memberships').upsert(
    { site_id: site.id, user_id: leitoraId, role: 'reporter' },
    { onConflict: 'site_id,user_id' },
  )
  if (leitoraErr) throw new Error(`Failed to assign leitora role: ${leitoraErr.message}`)
  const { error: grantErr } = await supabase.from('site_private_viewers').upsert(
    { site_id: site.id, user_id: leitoraId, granted_by: adminId, revoked_at: null, revoked_by: null },
    { onConflict: 'site_id,user_id' },
  )
  if (grantErr) throw new Error(`Failed to grant private viewer to leitora: ${grantErr.message}`)
  const { error: semErr } = await supabase.from('site_private_viewers').delete().eq('site_id', site.id).eq('user_id', reporterId)
  if (semErr) throw new Error(`Failed to keep e2e-reporter without grant: ${semErr.message}`)
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
