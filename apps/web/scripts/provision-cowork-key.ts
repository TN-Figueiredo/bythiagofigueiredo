import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'
import { resolve } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { config } from 'dotenv'

config({ path: resolve(process.cwd(), '.env.local') })

const KEY_NAME = 'cowork-permanent'

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const s = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: site } = await s
    .from('sites')
    .select('id')
    .contains('domains', ['bythiagofigueiredo.com'])
    .single()

  if (!site) {
    console.error('Site bythiagofigueiredo.com not found')
    process.exit(1)
  }

  const { data: existing } = await s
    .from('pipeline_api_keys')
    .select('id, revoked_at')
    .eq('name', KEY_NAME)
    .eq('site_id', site.id)
    .is('revoked_at', null)
    .single()

  if (existing) {
    console.log(`Key "${KEY_NAME}" already exists and is active (id: ${existing.id}).`)
    console.log('Raw key is in PIPELINE_COWORK_KEY env var in .env.local')
    console.log('If you lost the raw key, revoke this one and re-run to create a new one.')
    return
  }

  const { data: revoked } = await s
    .from('pipeline_api_keys')
    .select('id')
    .eq('name', KEY_NAME)
    .eq('site_id', site.id)
    .not('revoked_at', 'is', null)

  if (revoked && revoked.length > 0) {
    console.log(`Found ${revoked.length} revoked "${KEY_NAME}" key(s). Creating fresh one...`)
  }

  const rawKey = 'pk_prod_' + randomBytes(24).toString('hex')
  const keyHash = createHash('sha256').update(rawKey).digest('hex')

  const { error } = await s.from('pipeline_api_keys').insert({
    site_id: site.id,
    name: KEY_NAME,
    key_hash: keyHash,
    permissions: ['read', 'write', 'admin'],
  })

  if (error) {
    console.error('Failed to insert key:', error.message)
    process.exit(1)
  }

  const envPath = resolve(process.cwd(), '.env.local')
  const envContent = readFileSync(envPath, 'utf-8')

  if (envContent.includes('PIPELINE_COWORK_KEY=')) {
    const updated = envContent.replace(/PIPELINE_COWORK_KEY=.*/, `PIPELINE_COWORK_KEY=${rawKey}`)
    writeFileSync(envPath, updated)
    console.log('Updated PIPELINE_COWORK_KEY in .env.local')
  } else {
    const section = `\n# Pipeline — Cowork permanent key (DO NOT REVOKE)\nPIPELINE_COWORK_KEY=${rawKey}\n`
    writeFileSync(envPath, envContent.trimEnd() + '\n' + section)
    console.log('Added PIPELINE_COWORK_KEY to .env.local')
  }

  console.log('\n=== COWORK KEY PROVISIONED ===')
  console.log(`Raw key: ${rawKey}`)
  console.log(`Hash:    ${keyHash}`)
  console.log(`Name:    ${KEY_NAME}`)
  console.log('\nUse as: X-Pipeline-Key: $PIPELINE_COWORK_KEY')
}

main().catch(e => { console.error(e); process.exit(1) })
