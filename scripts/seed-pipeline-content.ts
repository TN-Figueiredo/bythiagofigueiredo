// scripts/seed-pipeline-content.ts
// Usage: npx tsx --env-file apps/web/.env.local scripts/seed-pipeline-content.ts
//
// Seeds content_pipeline with:
//   1. Articles from ~/Workspace/youtube/articles/ (format: blog_post)
//   2. Text pathways from text-pathways.md (format: blog_post, stage: idea)
//   3. Idea bank from script-idea-bank.md (format: video, stage: idea)
//   4. Text playlist collections (TA–TF)
//   5. Reference content from strategy docs
//
// Fully idempotent — safe to re-run. Depends on seed-pipeline.ts having run first
// (creates the video playlists A–G that some cross-refs depend on).

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { parse as parseYaml } from 'yaml'

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

const YOUTUBE_DIR = resolve(process.env.HOME!, 'Workspace/youtube')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArticleFrontmatter {
  id?: string
  title: string
  slug: string
  lang: string
  canal?: string
  status?: string
  structure?: string
  target_length?: string
  keywords_primary?: string[]
  keywords_secondary?: string[]
  category?: string
  date?: string
}

interface TextPathwayItem {
  code: string
  title: string
  lang: string
  playlist: string
  depth: string
  status: string
}

interface IdeaBankItem {
  code: string
  title: string
  canal: string
  playlist: string
  rawContent: string
  crossRefs: string[]
  formats: string[]
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

function parseFrontmatter(content: string): { meta: ArticleFrontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) throw new Error('No frontmatter found')
  const meta = parseYaml(match[1]) as ArticleFrontmatter
  return { meta, body: match[2] }
}

function langToLanguage(lang: string): 'pt-br' | 'en' | 'both' {
  if (lang === 'pt' || lang === 'pt-br') return 'pt-br'
  if (lang === 'en') return 'en'
  return 'both'
}

// ---------------------------------------------------------------------------
// Step 1: Parse articles from ~/Workspace/youtube/articles/
// ---------------------------------------------------------------------------

function parseArticles(): Array<{ meta: ArticleFrontmatter; body: string; folder: string }> {
  const articlesDir = join(YOUTUBE_DIR, 'articles')
  if (!existsSync(articlesDir)) return []

  const folders = readdirSync(articlesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)

  const articles: Array<{ meta: ArticleFrontmatter; body: string; folder: string }> = []

  for (const folder of folders) {
    const folderPath = join(articlesDir, folder)
    const files = readdirSync(folderPath).filter(f => f.endsWith('.md'))

    for (const file of files) {
      const content = readFileSync(join(folderPath, file), 'utf8')
      try {
        const { meta, body } = parseFrontmatter(content)
        articles.push({ meta, body, folder })
      } catch {
        console.warn(`  ⚠ Could not parse ${folder}/${file}, skipping`)
      }
    }
  }

  return articles
}

// ---------------------------------------------------------------------------
// Step 2: Parse text pathways
// ---------------------------------------------------------------------------

function parseTextPathways(): TextPathwayItem[] {
  const filePath = join(YOUTUBE_DIR, 'content-strategy/text-pathways.md')
  if (!existsSync(filePath)) return []

  const content = readFileSync(filePath, 'utf8')
  const items: TextPathwayItem[] = []

  // Parse table rows from each playlist section
  // Format: | # | Title | Angle | Lang | Prof. | Status |
  const tableRowRegex = /^\|\s*(\d+)\s*\|\s*\*\*(.+?)\*\*\s*\|.*?\|\s*(PT|EN)\s*\|\s*(🟢|🟡|🔴)\s*\|\s*(\w+)\s*\|/gm

  // Extract playlist context
  const sections = content.split(/^## Playlist (T[A-F])/m)

  for (let i = 1; i < sections.length; i += 2) {
    const playlistCode = sections[i] // e.g. "TA"
    const sectionContent = sections[i + 1] || ''

    const rows = sectionContent.matchAll(tableRowRegex)
    for (const row of rows) {
      const num = row[1]
      const title = row[2]
      const lang = row[3]
      const depth = row[4]
      const status = row[5]

      items.push({
        code: `${playlistCode.toLowerCase()}-${num.padStart(2, '0')}`,
        title,
        lang: lang.toLowerCase(),
        playlist: playlistCode,
        depth,
        status,
      })
    }
  }

  return items
}

// ---------------------------------------------------------------------------
// Step 3: Parse idea bank
// ---------------------------------------------------------------------------

function parseIdeaBank(): IdeaBankItem[] {
  const filePath = join(YOUTUBE_DIR, 'ideias-roteiros/script-idea-bank.md')
  if (!existsSync(filePath)) return []

  const content = readFileSync(filePath, 'utf8')
  const items: IdeaBankItem[] = []

  // Match idea entries: ### iXN — [date] Title
  const ideaRegex = /^### (i[A-Z]\d+)\s*—\s*\[[\d-]+\]\s*(.+?)$/gm
  const matches = [...content.matchAll(ideaRegex)]

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const code = match[1].toLowerCase()
    const title = match[2]

    // Extract section content until next heading
    const start = match.index! + match[0].length
    const end = i + 1 < matches.length ? matches[i + 1].index! : content.length
    const section = content.slice(start, end)

    // Extract canal
    const canalMatch = section.match(/\*\*Canal:\*\*\s*(.+?)(?:\n|$)/)
    const canal = canalMatch ? canalMatch[1].trim() : 'bilateral'

    // Extract cross-refs
    const crossMatch = section.match(/\*\*Cross-refs:\*\*\s*(.+?)(?:\n|$)/)
    const crossRefs = crossMatch
      ? crossMatch[1].split(',').map(s => s.trim())
      : []

    // Extract formats — strip parenthetical details before splitting
    const formatsMatch = section.match(/\*\*Formatos?:\*\*\s*(.+?)(?:\n|$)/)
    const formats = formatsMatch
      ? formatsMatch[1].replace(/\([^)]*\)/g, '').toLowerCase().split(/[+,&]/).map(s => s.trim()).filter(Boolean)
      : ['video']

    // Derive playlist from code prefix (e.g., iA1 → A, iE1 → E)
    const playlistLetter = code.charAt(1).toUpperCase()

    items.push({
      code,
      title,
      canal,
      playlist: playlistLetter,
      rawContent: section.trim().slice(0, 2000),
      crossRefs,
      formats,
    })
  }

  return items
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  // Resolve site by domain (matches middleware's NEXT_PUBLIC_DEV_SITE_HOSTNAME)
  const targetDomain = process.env.NEXT_PUBLIC_DEV_SITE_HOSTNAME || 'bythiagofigueiredo.com'
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id')
    .contains('domains', [targetDomain])
    .single()
  if (siteError || !site) throw new Error(`Could not resolve site for domain "${targetDomain}": ${siteError?.message}`)
  const siteId: string = site.id
  console.log(`Using site: ${siteId} (domain: ${targetDomain})\n`)

  // -------------------------------------------------------------------------
  // Step 1: Resolve video playlist collections (text maps into them)
  // -------------------------------------------------------------------------
  console.log('--- Step 1: Resolve video playlist collections ---')

  // Text playlists map to video playlists by theme:
  // TA (Línguas) → E, TB (Dev/Career) → C, TC (Anti-Default) → A,
  // TD (AI) → G, TE (YouTube/Creator) → C, TF (Gaming) → B
  const TEXT_TO_VIDEO_COLLECTION: Record<string, string> = {
    TA: 'playlist-e',
    TB: 'playlist-c',
    TC: 'playlist-a',
    TD: 'playlist-g',
    TE: 'playlist-c',
    TF: 'playlist-b',
  }

  const textCollectionMap: Record<string, string> = {} // TA -> collection UUID

  for (const [textKey, videoCode] of Object.entries(TEXT_TO_VIDEO_COLLECTION)) {
    const { data } = await supabase
      .from('content_collections')
      .select('id')
      .eq('site_id', siteId)
      .eq('code', videoCode)
      .single()

    if (data) {
      textCollectionMap[textKey] = data.id
      console.log(`  ✓ ${textKey} → ${videoCode} (${data.id.slice(0, 8)})`)
    } else {
      console.warn(`  ⚠ ${textKey}: collection ${videoCode} not found (run seed-pipeline.ts first)`)
    }
  }

  // -------------------------------------------------------------------------
  // Step 2: Articles (blog_post, stage: draft)
  // -------------------------------------------------------------------------
  console.log('\n--- Step 2: Articles from ~/Workspace/youtube/articles/ ---')
  const articles = parseArticles()
  console.log(`  Found ${articles.length} article files`)

  let articleCount = 0
  for (const { meta, body } of articles) {
    const code = meta.id
      ? meta.id.toLowerCase().replace(/[^a-z0-9-]/g, '-')
      : slugify(meta.slug || meta.title)

    const language = langToLanguage(meta.lang)
    const titlePt = meta.lang === 'pt' ? meta.title : null
    const titleEn = meta.lang === 'en' ? meta.title : null

    const tags: string[] = [
      ...(meta.keywords_primary || []).slice(0, 3).map(k => slugify(k)),
      meta.category || 'article',
    ].filter(Boolean)

    const { data: item, error } = await supabase
      .from('content_pipeline')
      .upsert(
        {
          site_id: siteId,
          code,
          title_pt: titlePt,
          title_en: titleEn,
          format: 'blog_post',
          stage: meta.status === 'published' ? 'publicado' : 'draft',
          language,
          priority: 3,
          body_content: body.slice(0, 50000),
          format_metadata: {
            slug: meta.slug || null,
            structure: meta.structure || null,
            target_length: meta.target_length || null,
            keywords_primary: meta.keywords_primary || [],
            keywords_secondary: meta.keywords_secondary || [],
          },
          production_checklist: [
            { label: 'Rascunho escrito', done: true },
            { label: 'Revisão de conteúdo', done: false },
            { label: 'SEO keywords aplicadas', done: true },
            { label: 'Imagem de capa', done: false },
            { label: 'Publicar no site', done: false },
          ],
          tags,
        },
        { onConflict: 'site_id,code' }
      )
      .select('id')
      .single()

    if (error || !item) {
      console.error(`  ✗ ${code}: ${error?.message}`)
      continue
    }

    // Add to video playlist collection (text content lives alongside video)
    let assigned = false
    if (meta.id) {
      const playlistKey = meta.id.replace(/-\d+$/, '') // TA-01 → TA
      const collectionId = textCollectionMap[playlistKey]
      if (collectionId) {
        const pos = 500 + (parseInt(meta.id.replace(/^[A-Z]+-/, '')) || 0)
        await supabase
          .from('content_pipeline_memberships')
          .upsert(
            { pipeline_id: item.id, collection_id: collectionId, position: pos, role: 'text' },
            { onConflict: 'pipeline_id,collection_id' }
          )
        assigned = true
      }
    }
    // Fallback: infer collection from category/keywords for orphan articles
    if (!assigned) {
      const categoryMap: Record<string, string> = {
        'behind-the-scenes': 'playlist-g',
        'ai': 'playlist-g',
        'languages': 'playlist-e',
        'gaming': 'playlist-b',
        'career': 'playlist-c',
        'personal': 'playlist-a',
        'fitness': 'playlist-f',
      }
      const targetCode = categoryMap[meta.category || '']
      if (targetCode) {
        const { data: col } = await supabase
          .from('content_collections').select('id').eq('site_id', siteId).eq('code', targetCode).single()
        if (col) {
          await supabase
            .from('content_pipeline_memberships')
            .upsert(
              { pipeline_id: item.id, collection_id: col.id, position: 600 + articleCount, role: 'text' },
              { onConflict: 'pipeline_id,collection_id' }
            )
        }
      }
    }

    articleCount++
    console.log(`  ✓ ${code} [draft] — ${meta.title.slice(0, 60)}`)
  }

  // -------------------------------------------------------------------------
  // Step 3: Text pathways (blog_post, stage: idea)
  // -------------------------------------------------------------------------
  console.log('\n--- Step 3: Text pathways (planned articles) ---')
  const pathways = parseTextPathways()
  console.log(`  Found ${pathways.length} planned articles`)

  let pathwayCount = 0
  for (const item of pathways) {
    const language = langToLanguage(item.lang)
    const titlePt = item.lang === 'pt' ? item.title : null
    const titleEn = item.lang === 'en' ? item.title : null

    const priorityMap: Record<string, number> = { '🟢': 1, '🟡': 2, '🔴': 3 }
    const priority = priorityMap[item.depth] ?? 1

    const tags: string[] = [
      item.playlist.toLowerCase(),
      item.depth === '🟢' ? 'intro' : item.depth === '🟡' ? 'medium' : 'deep',
      'article',
    ]

    const { data, error } = await supabase
      .from('content_pipeline')
      .upsert(
        {
          site_id: siteId,
          code: item.code,
          title_pt: titlePt,
          title_en: titleEn,
          format: 'blog_post',
          stage: 'idea',
          language,
          priority,
          format_metadata: {
            slug: slugify(item.title),
            text_playlist: item.playlist,
            depth: item.depth,
          },
          production_checklist: [
            { label: 'Outline/estrutura definida', done: false },
            { label: 'Rascunho escrito', done: false },
            { label: 'Revisão de conteúdo', done: false },
            { label: 'SEO keywords', done: false },
            { label: 'Imagem de capa', done: false },
            { label: 'Publicar no site', done: false },
          ],
          tags,
        },
        { onConflict: 'site_id,code' }
      )
      .select('id')
      .single()

    if (error || !data) {
      // Skip if already exists from articles step (TA-01, TA-03 etc)
      if (error?.code === '23505') continue
      console.error(`  ✗ ${item.code}: ${error?.message}`)
      continue
    }

    // Add to video playlist collection (text alongside video)
    const collectionId = textCollectionMap[item.playlist]
    if (collectionId) {
      const pos = 500 + (parseInt(item.code.replace(/^t[a-f]-/, '')) || 0)
      await supabase
        .from('content_pipeline_memberships')
        .upsert(
          { pipeline_id: data.id, collection_id: collectionId, position: pos, role: 'text' },
          { onConflict: 'pipeline_id,collection_id' }
        )
    }

    pathwayCount++
    console.log(`  ✓ ${item.code} [idea] — ${item.title.slice(0, 50)}`)
  }

  // -------------------------------------------------------------------------
  // Step 4: Idea bank (video format, stage: idea)
  // -------------------------------------------------------------------------
  console.log('\n--- Step 4: Idea bank entries ---')
  const ideas = parseIdeaBank()
  console.log(`  Found ${ideas.length} idea bank entries`)

  // Delete idea bank entries that may have wrong format (trigger prevents update)
  const ideaCodes = ideas.map(i => i.code)
  if (ideaCodes.length > 0) {
    await supabase
      .from('content_pipeline')
      .delete()
      .eq('site_id', siteId)
      .in('code', ideaCodes)
  }

  function mapFormat(raw: string): string {
    const f = raw.trim().replace(/\s*\(.*\)$/, '').toLowerCase()
    if (f === 'article' || f === 'ensaio') return 'blog_post'
    if (f === 'newsletter' || f === 'newsletter snippet') return 'newsletter'
    if (f === 'social post') return 'campaign'
    return 'video'
  }

  let ideaCount = 0
  for (const idea of ideas) {
    const language = idea.canal.toLowerCase().includes('en') ? 'en' as const
      : idea.canal.toLowerCase().includes('pt') ? 'pt-br' as const
      : 'both' as const

    const titlePt = language === 'pt-br' || language === 'both' ? idea.title : null
    const titleEn = language === 'en' || language === 'both' ? idea.title : null

    // Pick primary format: prefer article/video over short/social
    const primaryFormat = idea.formats.reduce((best, f) => {
      const mapped = mapFormat(f)
      if (mapped === 'blog_post' && best !== 'blog_post') return 'blog_post'
      if (mapped === 'newsletter' && best === 'video') return 'newsletter'
      return best
    }, 'video')

    const tags: string[] = [
      idea.playlist.toLowerCase(),
      'idea-bank',
      ...(idea.crossRefs.length > 0 ? ['has-cross-refs'] : []),
      ...(idea.formats.length > 1 ? ['multi-format'] : []),
    ]

    const { data, error } = await supabase
      .from('content_pipeline')
      .upsert(
        {
          site_id: siteId,
          code: idea.code,
          title_pt: titlePt,
          title_en: titleEn,
          format: primaryFormat,
          stage: 'idea',
          language,
          priority: 0,
          synopsis: idea.rawContent.slice(0, 2000),
          format_metadata: {
            source: 'idea-bank',
            canal: idea.canal,
            cross_refs: idea.crossRefs,
            declared_formats: idea.formats,
          },
          production_checklist: [
            { label: 'Ideia refinada', done: false },
            { label: 'Promovida pro pathways', done: false },
            { label: 'Rascunho/roteiro escrito', done: false },
            { label: 'Produção concluída', done: false },
            { label: 'Publicar', done: false },
          ],
          tags,
        },
        { onConflict: 'site_id,code' }
      )
      .select('id')
      .single()

    if (error || !data) {
      console.error(`  ✗ ${idea.code}: ${error?.message}`)
      continue
    }

    // Add to video playlist collection with idea-bank role
    const videoCollectionCode = `playlist-${idea.playlist.toLowerCase()}`
    const { data: collection } = await supabase
      .from('content_collections')
      .select('id')
      .eq('site_id', siteId)
      .eq('code', videoCollectionCode)
      .single()

    if (collection) {
      await supabase
        .from('content_pipeline_memberships')
        .upsert(
          { pipeline_id: data.id, collection_id: collection.id, position: 900 + ideaCount, role: 'idea-bank' },
          { onConflict: 'pipeline_id,collection_id' }
        )
    }

    ideaCount++
    console.log(`  ✓ ${idea.code} [idea] — ${idea.title.slice(0, 50)}`)
  }

  // -------------------------------------------------------------------------
  // Step 5: Reference content (strategy docs)
  // -------------------------------------------------------------------------
  console.log('\n--- Step 5: Reference content ---')
  const strategyDocs: Array<{ title: string; file: string; ref_group: string }> = [
    { title: 'Personal Profile', file: 'skills/_shared/personal-profile.md', ref_group: 'pessoal' },
    { title: 'Channel Profiles', file: 'skills/brainstorm/references/channel-profiles.md', ref_group: 'estrategia' },
    { title: 'Playlist Pathways v2', file: 'content-strategy/playlist-pathways-v2.md', ref_group: 'estrategia' },
    { title: 'Text Pathways', file: 'content-strategy/text-pathways.md', ref_group: 'craft' },
    { title: 'Banco de Tags', file: 'content-strategy/banco-tags.md', ref_group: 'estrategia' },
    { title: 'Banco de Frases-Âncora', file: 'content-strategy/banco-frases-ancora.md', ref_group: 'craft' },
    { title: 'Script Idea Bank', file: 'ideias-roteiros/script-idea-bank.md', ref_group: 'estrategia' },
  ]

  let refCount = 0
  for (const doc of strategyDocs) {
    const filePath = join(YOUTUBE_DIR, doc.file)
    if (!existsSync(filePath)) continue

    const content = readFileSync(filePath, 'utf8')
    const key = slugify(doc.title)

    const { error } = await supabase
      .from('reference_content')
      .upsert(
        {
          site_id: siteId,
          key,
          title: doc.title,
          ref_group: doc.ref_group,
          content_md: content.slice(0, 100000),
          content_compact: { source_file: doc.file },
        },
        { onConflict: 'site_id,key' }
      )

    if (error) {
      console.error(`  ✗ ${doc.title}: ${error.message}`)
      continue
    }

    refCount++
    console.log(`  ✓ ${doc.title}`)
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n--- Done ---')
  console.log(`Collection mappings resolved: ${Object.keys(textCollectionMap).length}`)
  console.log(`Articles seeded: ${articleCount}`)
  console.log(`Text pathways seeded: ${pathwayCount}`)
  console.log(`Idea bank entries seeded: ${ideaCount}`)
  console.log(`Reference docs seeded: ${refCount}`)
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
