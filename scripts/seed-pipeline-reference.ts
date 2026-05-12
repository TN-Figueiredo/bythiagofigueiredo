// scripts/seed-pipeline-reference.ts
// Usage: npx tsx --env-file apps/web/.env.local scripts/seed-pipeline-reference.ts
//
// Seeds docs/cowork-pipeline-reference.md into the reference_content table
// so the Cowork AI can fetch it via GET /api/pipeline/context/cowork-section-schemas.
// Idempotent — safe to re-run (upserts on site_id + key).

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

const REFERENCE_KEY = 'cowork-section-schemas'
const REFERENCE_TITLE = 'Pipeline Section Schemas — Cowork AI'

async function seed(): Promise<void> {
  const mdPath = resolve(__dirname, '../docs/cowork-pipeline-reference.md')
  console.log(`Reading ${mdPath}...`)
  const contentMd = readFileSync(mdPath, 'utf8')
  console.log(`  ${contentMd.length} chars, ${contentMd.split('\n').length} lines`)

  const targetDomain = process.env.NEXT_PUBLIC_DEV_SITE_HOSTNAME || 'bythiagofigueiredo.com'
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id')
    .contains('domains', [targetDomain])
    .single()
  if (siteError || !site) throw new Error(`Could not resolve site for domain "${targetDomain}": ${siteError?.message}`)
  console.log(`Site: ${site.id} (${targetDomain})`)

  const { data, error } = await supabase
    .from('reference_content')
    .upsert(
      {
        site_id: site.id,
        key: REFERENCE_KEY,
        title: REFERENCE_TITLE,
        content_md: contentMd,
        content_compact: {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'site_id,key' },
    )
    .select('id, key, version, updated_at')
    .single()

  if (error) throw new Error(`Upsert failed: ${error.message}`)
  console.log(`\n✓ Seeded reference_content:`)
  console.log(`  key: ${data.key}`)
  console.log(`  version: ${data.version}`)
  console.log(`  updated_at: ${data.updated_at}`)
  console.log(`\nCowork can now fetch: GET /api/pipeline/context/${REFERENCE_KEY}`)
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
