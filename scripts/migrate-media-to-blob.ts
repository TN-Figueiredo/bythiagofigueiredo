// scripts/migrate-media-to-blob.ts
// Usage: npx tsx scripts/migrate-media-to-blob.ts [--dry-run] [--table authors] [--batch-size 50]
import { put } from '@vercel/blob'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { writeFileSync, existsSync, readFileSync } from 'node:fs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN!
const SUPABASE_PROJECT_REF = 'novkqtvcnsiwhkxihurk'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const TABLE_FILTER = args.find((_a, i) => args[i - 1] === '--table') ?? null
const BATCH_SIZE = parseInt(args.find((_a, i) => args[i - 1] === '--batch-size') ?? '50', 10)
const JOURNAL_PATH = `scripts/migration-journal-${new Date().toISOString().slice(0, 10)}.json`

interface JournalEntry {
  table: string
  column: string
  rowId: string
  oldUrl: string
  newUrl: string
  deduplicated: boolean
  timestamp: string
}

const journal: JournalEntry[] = existsSync(JOURNAL_PATH)
  ? JSON.parse(readFileSync(JOURNAL_PATH, 'utf-8'))
  : []

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const hashCache = new Map<string, { blobUrl: string; assetId: string }>()

const MIGRATION_ORDER: Array<{
  table: string
  column: string
  folder: string
}> = [
  { table: 'authors', column: 'avatar_url', folder: 'authors' },
  { table: 'authors', column: 'about_photo_url', folder: 'authors' },
  { table: 'sites', column: 'logo_url', folder: 'branding' },
  { table: 'sites', column: 'seo_default_og_image', folder: 'og' },
  { table: 'newsletter_types', column: 'og_image_url', folder: 'newsletters' },
  { table: 'blog_translations', column: 'cover_image_url', folder: 'blog' },
  { table: 'blog_translations', column: 'og_image_url', folder: 'og' },
  { table: 'campaign_translations', column: 'og_image_url', folder: 'og' },
  { table: 'ad_media', column: 'public_url', folder: 'ads' },
  { table: 'ad_campaigns', column: 'logo_url', folder: 'ads' },
  { table: 'ad_placeholders', column: 'image_url', folder: 'ads' },
  { table: 'ad_placeholders', column: 'logo_url', folder: 'ads' },
  { table: 'ad_slot_creatives', column: 'image_url', folder: 'ads' },
  { table: 'tracked_links', column: 'qr_storage_path', folder: 'links' },
]

function isSupabaseUrl(url: string): boolean {
  return url.includes(`${SUPABASE_PROJECT_REF}.supabase.co`)
}

function isBlobUrl(url: string): boolean {
  return url.includes('blob.vercel-storage.com')
}

function detectMime(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png'
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return 'image/webp'
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif'
  if (buffer.toString('utf-8', 0, 5).includes('<svg')) return 'image/svg+xml'
  return 'application/octet-stream'
}

async function downloadFromSupabase(url: string): Promise<Buffer> {
  const pathMatch = url.match(/\/storage\/v1\/object\/(?:sign|public)\/([^?]+)/)
  if (!pathMatch) throw new Error(`Cannot parse Supabase URL: ${url}`)

  const fullPath = pathMatch[1]
  const bucketSep = fullPath.indexOf('/')
  const bucket = fullPath.slice(0, bucketSep)
  const path = fullPath.slice(bucketSep + 1)

  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error) throw new Error(`Download failed: ${error.message}`)
  return Buffer.from(await data.arrayBuffer())
}

async function processAndUpload(
  buffer: Buffer,
  filename: string,
  folder: string,
  siteId: string,
): Promise<{ blobUrl: string; assetId: string; deduplicated: boolean }> {
  let processed = buffer
  const mime = detectMime(buffer)
  if (['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    const sharp = (await import('sharp')).default
    processed = await sharp(buffer).rotate().toBuffer()
  }

  const hash = createHash('sha256').update(processed).digest('hex')

  if (hashCache.has(hash)) {
    const cached = hashCache.get(hash)!
    return { blobUrl: cached.blobUrl, assetId: cached.assetId, deduplicated: true }
  }

  const { data: existing } = await supabase
    .from('media_assets')
    .select('id, blob_url')
    .eq('content_hash', hash)
    .eq('site_id', siteId)
    .single()

  if (existing) {
    hashCache.set(hash, { blobUrl: existing.blob_url, assetId: existing.id })
    return { blobUrl: existing.blob_url, assetId: existing.id, deduplicated: true }
  }

  const pathname = `media/${siteId}/${folder}/${hash.slice(0, 8)}-${filename}`
  const blob = await put(pathname, processed, {
    access: 'public',
    token: BLOB_TOKEN,
    addRandomSuffix: false,
  })

  let width: number | null = null
  let height: number | null = null
  if (['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    const sharp = (await import('sharp')).default
    const meta = await sharp(processed).metadata()
    width = meta.width ?? null
    height = meta.height ?? null
  }

  const { data: asset, error } = await supabase
    .from('media_assets')
    .insert({
      site_id: siteId,
      blob_url: blob.url,
      blob_pathname: blob.pathname,
      filename,
      mime_type: mime,
      file_size: processed.length,
      content_hash: hash,
      folder,
      width,
      height,
      tags: ['migrated'],
    })
    .select('id, blob_url')
    .single()

  if (error) throw new Error(`DB insert failed: ${error.message}`)

  hashCache.set(hash, { blobUrl: asset.blob_url, assetId: asset.id })
  return { blobUrl: asset.blob_url, assetId: asset.id, deduplicated: false }
}

async function migrateTable(config: typeof MIGRATION_ORDER[0]) {
  console.log(`\n=> Migrating ${config.table}.${config.column}...`)

  const { data: rows, error } = await supabase
    .from(config.table)
    .select(`id, ${config.column}, site_id`)
    .not(config.column, 'is', null)

  if (error) { console.error(`  x Query error: ${error.message}`); return }
  if (!rows?.length) { console.log('  - No rows'); return }

  let migrated = 0
  let skipped = 0
  let errors = 0

  for (const row of rows) {
    const url = row[config.column]
    if (!url || isBlobUrl(url)) { skipped++; continue }
    if (!isSupabaseUrl(url)) { skipped++; continue }

    const filename = url.split('/').pop()?.split('?')[0] ?? 'unknown'
    const siteId = row.site_id

    if (DRY_RUN) {
      console.log(`  [dry-run] Would migrate row ${row.id}: ${url.slice(0, 80)}...`)
      migrated++
      continue
    }

    try {
      const buffer = await downloadFromSupabase(url)
      const result = await processAndUpload(buffer, filename, config.folder, siteId)

      await supabase
        .from(config.table)
        .update({ [config.column]: result.blobUrl })
        .eq('id', row.id)

      journal.push({
        table: config.table,
        column: config.column,
        rowId: row.id,
        oldUrl: url,
        newUrl: result.blobUrl,
        deduplicated: result.deduplicated,
        timestamp: new Date().toISOString(),
      })
      migrated++

      await new Promise(r => setTimeout(r, 100))
    } catch (err) {
      console.error(`  x row ${row.id}: ${(err as Error).message}`)
      errors++
    }
  }

  console.log(`  -> ${migrated} migrated, ${skipped} skipped, ${errors} errors`)
}

async function main() {
  console.log(`Media migration ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}`)
  console.log(`   Table filter: ${TABLE_FILTER ?? 'all'}`)
  console.log(`   Batch size: ${BATCH_SIZE}`)
  console.log(`   Journal: ${JOURNAL_PATH}`)

  const tables = TABLE_FILTER
    ? MIGRATION_ORDER.filter(t => t.table === TABLE_FILTER)
    : MIGRATION_ORDER

  for (const config of tables) {
    await migrateTable(config)
  }

  if (!DRY_RUN && journal.length > 0) {
    writeFileSync(JOURNAL_PATH, JSON.stringify(journal, null, 2))
    console.log(`\nJournal saved: ${JOURNAL_PATH} (${journal.length} entries)`)
  }

  console.log('\nMigration complete')
}

main().catch(err => {
  console.error('Migration failed:', err)
  if (journal.length > 0) {
    writeFileSync(JOURNAL_PATH, JSON.stringify(journal, null, 2))
    console.log(`Partial journal saved: ${JOURNAL_PATH}`)
  }
  process.exit(1)
})
