// scripts/seed-pipeline.ts
// Usage: npx tsx --env-file apps/web/.env.local scripts/seed-pipeline.ts
//
// Reads ~/Workspace/Youtube/dashboard.html, extracts PLAYLISTS + WRITTEN_SCRIPTS,
// and seeds content_collections + content_pipeline + content_pipeline_memberships.
// Fully idempotent — safe to re-run.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

// ---------------------------------------------------------------------------
// Types (mirror actual dashboard.html structure)
// ---------------------------------------------------------------------------

interface DashboardVideo {
  code: string
  en: string | null
  pt: string | null
  channel: string
  duration: string
  priority: string
  cross: string | null
  status: string
  arc?: number        // 1 | 2 | 3  (G playlist only)
  arcRole?: string
  scriptKey?: string
  freeVsPremium?: string
  ta?: string[]
}

interface DashboardArc {
  num: number
  name: string
  project: string
  episodes: string
  status: string
}

interface DashboardPlaylist {
  code: string
  name: string
  thesis: string
  channel: string
  videos: DashboardVideo[]
  arcs?: DashboardArc[]  // array (only on G)
}

interface WrittenScript {
  code: string
  title_pt: string
  title_en: string
  playlist: string
  playlistKey: string | null
  channel: string
  duration: string
  status: 'written' | 'recorded'
  folder: string
  recorded_at?: string
  has_pt?: boolean
  has_en?: boolean
  has_longform?: boolean
}

interface DashboardData {
  playlists: Record<string, DashboardPlaylist>
  writtenScripts: Record<string, WrittenScript>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function parseDashboard(html: string): DashboardData {
  // PLAYLISTS block ends at the line with just `};`
  const playlistsMatch = html.match(/(?:const|let|var)\s+PLAYLISTS\s*=\s*(\{[\s\S]*?\n\};)/)
  if (!playlistsMatch) throw new Error('Could not find PLAYLISTS block in dashboard.html')

  // WRITTEN_SCRIPTS block — same pattern
  const scriptsMatch = html.match(/(?:const|let|var)\s+WRITTEN_SCRIPTS\s*=\s*(\{[\s\S]*?\n\};)/)

  // eslint-disable-next-line no-new-func
  const playlists = new Function(`return ${playlistsMatch[1]}`)() as Record<string, DashboardPlaylist>
  const writtenScripts = scriptsMatch
    ? (new Function(`return ${scriptsMatch[1]}`)() as Record<string, WrittenScript>)
    : {}

  return { playlists, writtenScripts }
}

function deriveStage(videoCode: string, writtenScripts: Record<string, WrittenScript>): string {
  const script = writtenScripts[videoCode]
  if (!script) return 'idea'
  if (script.status === 'recorded') return 'gravacao'
  if (script.status === 'written') return 'roteiro'
  return 'idea'
}

function buildChecklist(stage: string): Array<{ label: string; done: boolean }> {
  const isWritten = stage === 'roteiro' || stage === 'gravacao'
  const isRecorded = stage === 'gravacao'
  return [
    { label: 'Roteiro finalizado', done: isWritten },
    { label: 'Thumbnail conceituada', done: false },
    { label: 'B-roll listado', done: false },
    { label: 'Equipamento verificado', done: false },
    { label: 'Gravação concluída', done: isRecorded },
    { label: 'Edição concluída', done: false },
    { label: 'Título + descrição SEO', done: false },
    { label: 'Cards e end screen', done: false },
  ]
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  const dashboardPath = resolve(process.env.HOME!, 'Workspace/Youtube/dashboard.html')
  console.log(`Reading ${dashboardPath}...`)
  const html = readFileSync(dashboardPath, 'utf8')
  const { playlists, writtenScripts } = parseDashboard(html)

  const playlistLetters = Object.keys(playlists)
  const totalVideos = playlistLetters.reduce((sum, l) => sum + playlists[l].videos.length, 0)
  console.log(`Found ${playlistLetters.length} playlists, ${totalVideos} videos total`)
  console.log(`Found ${Object.keys(writtenScripts).length} written scripts`)

  // -------------------------------------------------------------------------
  // Resolve site
  // -------------------------------------------------------------------------
  const targetDomain = process.env.NEXT_PUBLIC_DEV_SITE_HOSTNAME || 'bythiagofigueiredo.com'
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id')
    .contains('domains', [targetDomain])
    .single()
  if (siteError || !site) throw new Error(`Could not resolve site for domain "${targetDomain}": ${siteError?.message}`)
  const siteId: string = site.id
  console.log(`\nUsing site: ${siteId} (domain: ${targetDomain})\n`)

  // -------------------------------------------------------------------------
  // Step 1: Create playlist collections
  // -------------------------------------------------------------------------
  console.log('--- Step 1: Playlist collections ---')
  const playlistCollectionMap: Record<string, string> = {} // letter -> UUID

  for (let i = 0; i < playlistLetters.length; i++) {
    const letter = playlistLetters[i]
    const playlist = playlists[letter]
    const code = `playlist-${letter.toLowerCase()}`
    const name = playlist.name

    const { data, error } = await supabase
      .from('content_collections')
      .upsert(
        { site_id: siteId, code, name, title_pt: name, title_en: name, type: 'playlist', position: i },
        { onConflict: 'site_id,code' }
      )
      .select('id')
      .single()

    if (error || !data) {
      console.error(`  ✗ ${letter} "${name}": ${error?.message}`)
      continue
    }

    playlistCollectionMap[letter] = data.id
    console.log(`  ✓ ${letter} — "${name}" (${playlist.videos.length} videos)`)
  }

  // -------------------------------------------------------------------------
  // Step 2: Clean up legacy arc/category sub-collections (now use role on membership)
  // -------------------------------------------------------------------------
  console.log('\n--- Step 2: Cleanup legacy sub-collections ---')
  const { data: legacyCollections } = await supabase
    .from('content_collections')
    .select('id, code')
    .eq('site_id', siteId)
    .or('type.eq.arc,type.eq.category')
  if (legacyCollections && legacyCollections.length > 0) {
    for (const lc of legacyCollections) {
      await supabase.from('content_pipeline_memberships').delete().eq('collection_id', lc.id)
      await supabase.from('content_collections').delete().eq('id', lc.id)
      console.log(`  ✗ Removed: ${lc.code}`)
    }
  } else {
    console.log('  (none to remove)')
  }

  // -------------------------------------------------------------------------
  // Step 3: Create pipeline items + memberships
  // -------------------------------------------------------------------------
  console.log('\n--- Step 3: Pipeline items ---')
  let created = 0
  let skipped = 0

  for (const letter of playlistLetters) {
    const playlist = playlists[letter]
    const videos = playlist.videos
    const collectionId = playlistCollectionMap[letter]

    console.log(`\n  Playlist ${letter} — ${playlist.name} (${videos.length} videos)`)

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i]
      const videoCode = video.code // e.g. "A1", "G15"

      // Use the video's own code as the pipeline item code (already unique per playlist)
      const itemCode = videoCode.toLowerCase()

      // Title: prefer EN, fall back to PT, then synthetic
      const titlePt = video.pt ?? video.en ?? `${videoCode} (sem título)`
      const titleEn = video.en ?? null

      const stage = deriveStage(videoCode, writtenScripts)

      const tags: string[] = [
        letter.toLowerCase(),
        slugify(playlist.name),
        video.channel,
        video.priority,
      ].filter(Boolean)

      const { data: item, error: itemError } = await supabase
        .from('content_pipeline')
        .upsert(
          {
            site_id: siteId,
            code: itemCode,
            title_pt: titlePt,
            title_en: titleEn,
            format: 'video',
            stage,
            language: 'pt-br',
            priority: 0,
            format_metadata: {
              playlist_letter: letter,
              video_code: videoCode,
              channel: video.channel,
              duration: video.duration,
              priority: video.priority,
              cross: video.cross ?? null,
              arc: video.arc ?? null,
              arc_role: video.arcRole ?? null,
            },
            production_checklist: buildChecklist(stage),
            tags,
          },
          { onConflict: 'site_id,code' }
        )
        .select('id')
        .single()

      if (itemError || !item) {
        console.error(`    ✗ ${videoCode}: ${itemError?.message}`)
        skipped++
        continue
      }

      created++

      // Membership: playlist (use role for arc designation within G)
      if (collectionId) {
        const role = letter === 'G' && video.arc !== undefined
          ? `arc-${video.arc}`
          : null
        const { error: memError } = await supabase
          .from('content_pipeline_memberships')
          .upsert(
            { pipeline_id: item.id, collection_id: collectionId, position: i, role },
            { onConflict: 'pipeline_id,collection_id' }
          )
        if (memError) {
          console.error(`    ✗ Membership ${videoCode} → playlist ${letter}: ${memError.message}`)
        }
      }

      console.log(`    ✓ ${videoCode} [${stage}] — ${titlePt.slice(0, 60)}`)
    }
  }

  console.log(`\n--- Done ---`)
  console.log(`Created/updated: ${created} pipeline items`)
  if (skipped > 0) console.log(`Skipped (errors): ${skipped}`)
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
