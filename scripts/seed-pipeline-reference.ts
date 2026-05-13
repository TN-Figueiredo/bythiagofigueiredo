// scripts/seed-pipeline-reference.ts
// Usage: npx tsx --env-file apps/web/.env.local scripts/seed-pipeline-reference.ts
//
// Seeds reference_content entries for the Cowork AI pipeline.
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

interface ReferenceEntry {
  key: string
  title: string
  ref_group: string
  sort_order: number
  filePath: string
}

const ENTRIES: ReferenceEntry[] = [
  {
    key: 'cowork-section-schemas',
    title: 'Pipeline Section Schemas — Cowork AI',
    ref_group: 'api',
    sort_order: 10,
    filePath: '../docs/cowork-pipeline-reference.md',
  },
  {
    key: 'playlist-graph-api',
    title: 'Playlist Graph — CRUD, Edges, Auto-Layout & Workflows [API Completa]',
    ref_group: 'api',
    sort_order: 40,
    filePath: '../docs/cowork-playlist-reference.md',
  },
]

async function seed(): Promise<void> {
  const targetDomain = process.env.NEXT_PUBLIC_DEV_SITE_HOSTNAME || 'bythiagofigueiredo.com'
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id')
    .contains('domains', [targetDomain])
    .single()
  if (siteError || !site) throw new Error(`Could not resolve site for domain "${targetDomain}": ${siteError?.message}`)
  console.log(`Site: ${site.id} (${targetDomain})\n`)

  for (const entry of ENTRIES) {
    const fullPath = resolve(__dirname, entry.filePath)
    console.log(`Reading ${fullPath}...`)
    const contentMd = readFileSync(fullPath, 'utf8')
    console.log(`  ${contentMd.length} chars, ${contentMd.split('\n').length} lines`)

    const { data, error } = await supabase
      .from('reference_content')
      .upsert(
        {
          site_id: site.id,
          key: entry.key,
          title: entry.title,
          ref_group: entry.ref_group,
          sort_order: entry.sort_order,
          content_md: contentMd,
          content_compact: {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'site_id,key' },
      )
      .select('id, key, version, updated_at')
      .single()

    if (error) throw new Error(`Upsert failed for ${entry.key}: ${error.message}`)
    console.log(`✓ ${data.key} (v${data.version}) updated_at: ${data.updated_at}\n`)
  }

  console.log('Done! All reference entries seeded.')
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
