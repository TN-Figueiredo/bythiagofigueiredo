// scripts/warm-up-compiled-mdx.ts
// Usage: npx tsx scripts/warm-up-compiled-mdx.ts [--dry-run] [--batch-size 10] [--delay 500]
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const BATCH_SIZE = parseInt(args.find((_a, i) => args[i - 1] === '--batch-size') ?? '10', 10)
const DELAY_MS = parseInt(args.find((_a, i) => args[i - 1] === '--delay') ?? '500', 10)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface UncompiledPost {
  id: string
  slug: string
  locale: string
  site_id: string
}

async function fetchUncompiledPosts(): Promise<UncompiledPost[]> {
  const { data, error } = await supabase
    .from('blog_translations')
    .select('id, slug, locale, blog_posts!inner(site_id)')
    .is('content_compiled', null)
    .not('content_mdx', 'is', null)
    .eq('blog_posts.status', 'published')

  if (error) throw new Error(`Query failed: ${error.message}`)

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    slug: row.slug as string,
    locale: row.locale as string,
    site_id: ((row as Record<string, Record<string, unknown>>).blog_posts as Record<string, unknown>).site_id as string,
  }))
}

async function warmUpPost(post: UncompiledPost): Promise<boolean> {
  const url = `${APP_URL}/blog/${post.locale}/${post.slug}`
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'mdx-warmup-script/1.0' },
      redirect: 'follow',
    })
    return res.ok
  } catch {
    return false
  }
}

async function main() {
  console.log(`MDX warm-up ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}`)
  console.log(`  App URL: ${APP_URL}`)
  console.log(`  Batch size: ${BATCH_SIZE}`)
  console.log(`  Delay: ${DELAY_MS}ms`)

  const posts = await fetchUncompiledPosts()
  console.log(`\nFound ${posts.length} posts with content_compiled IS NULL`)

  if (posts.length === 0) {
    console.log('Nothing to warm up.')
    return
  }

  let success = 0
  let failed = 0

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE)

    for (const post of batch) {
      if (DRY_RUN) {
        console.log(`  [dry-run] Would warm /blog/${post.locale}/${post.slug}`)
        success++
        continue
      }

      const ok = await warmUpPost(post)
      if (ok) {
        console.log(`  ✓ /blog/${post.locale}/${post.slug}`)
        success++
      } else {
        console.error(`  ✗ /blog/${post.locale}/${post.slug}`)
        failed++
      }

      await new Promise(r => setTimeout(r, DELAY_MS))
    }

    if (i + BATCH_SIZE < posts.length) {
      console.log(`  --- batch ${Math.floor(i / BATCH_SIZE) + 1} done ---`)
    }
  }

  console.log(`\nWarm-up complete: ${success} ok, ${failed} failed out of ${posts.length}`)
}

main().catch(err => {
  console.error('Warm-up failed:', err)
  process.exit(1)
})
