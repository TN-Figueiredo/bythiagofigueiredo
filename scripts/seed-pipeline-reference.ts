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
  filePath: string | null
  inlineCompact?: Record<string, unknown>
}

const ENTRIES: ReferenceEntry[] = [
  // System directives (_system/* entries in grupo 'sistema')
  {
    key: '_system/groups',
    title: 'System — Reference Groups',
    ref_group: 'sistema',
    sort_order: 0,
    filePath: null,
    inlineCompact: {
      groups: [
        { id: 'pessoal', label: 'Pessoal', color: '#34d399', scope: 'Quem é o Thiago — biografia, valores, experiências pessoais que informam conteúdo' },
        { id: 'estrategia', label: 'Estratégia', color: '#a78bfa', scope: 'Taxonomia, calendário, ângulos de conteúdo, scoring, monetização, research' },
        { id: 'craft', label: 'Craft', color: '#fbbf24', scope: 'Voz, estilo, convenções de formato, avaliação de produto' },
        { id: 'producao', label: 'Produção', color: '#22d3ee', scope: 'SEO, launch strategy, benchmarks, checklists' },
        { id: 'memoria', label: 'Memória', color: '#38bdf8', scope: 'Logs de aprendizado por skill' },
        { id: 'sistema', label: 'Sistema', color: '#94a3b8', scope: 'Directives do sistema — regras, mapeamentos, protocolo. APIs descobertas via GET /api/pipeline/' },
      ],
    },
  },
  {
    key: '_system/skill-mappings',
    title: 'System — Skill Reference Mappings',
    ref_group: 'sistema',
    sort_order: 1,
    filePath: null,
    inlineCompact: {
      ideator: ['personal-profile', 'content-calendar-taxonomy', 'ideator-channel-profiles', 'ideator-content-angles', 'ideator-formats-frameworks', 'ideator-monetization-research', 'ideator-scoring-rubrics', 'ideator-memory'],
      writer: ['personal-profile', 'writer-voice-guide', 'writer-blog-craft', 'writer-article-craft', 'writer-newsletter-craft', 'writer-social-craft', 'writer-memory'],
      producer: ['personal-profile', 'producer-editing-patterns', 'producer-sound-design', 'producer-visual-style', 'producer-seo-metadata', 'producer-launch-strategy', 'producer-memory'],
      product_eval: ['personal-profile', 'product-eval-scoring', 'product-eval-catalog', 'product-eval-experience', 'product-eval-reference', 'product-eval-memory'],
      perf_review: ['personal-profile', 'perf-review-benchmarks', 'perf-review-feedback-templates', 'perf-review-analytics-guide', 'perf-review-memory'],
      curator: ['content-curator-skill', 'curator-rules', 'curator-memory'],
      architect: ['playlist-architect-skill', 'architect-templates', 'architect-memory'],
    },
  },
  {
    key: '_system/onboarding',
    title: 'System — Cowork Session Protocol',
    ref_group: 'sistema',
    sort_order: 2,
    filePath: null,
    inlineCompact: {
      system_prompt_template: 'Base: {base_url}/api/pipeline\nAuth header: X-Pipeline-Key\n\n1. GET /api/pipeline/ — capabilities + directives\n2. GET /api/pipeline/context?skill={skill} — load references\n3. GET /api/pipeline/docs/{domain} — detailed docs if needed\n4. Execute task\n5. PUT /api/pipeline/context/{skill}-memory — update memory',
      rules: [
        'Discutir mudanças de directives com o operador ANTES de aplicar',
        'Nunca deletar references sem aprovação explícita',
        'Ao criar nova categoria, justificar por que as existentes não servem',
      ],
      error_recovery: { '409': 'Re-fetch, retry com nova versão', '429': 'Aguardar X-RateLimit-Reset', '500': 'Retry 1x após 2s, depois reportar' },
    },
  },
  {
    key: '_system/memory-policy',
    title: 'System — Memory Management Policy',
    ref_group: 'sistema',
    sort_order: 3,
    filePath: null,
    inlineCompact: {
      max_size_kb: 100,
      rotation: 'Ao atingir 80% do limite, resumir entradas antigas antes de adicionar novas',
      format: 'Append-only com timestamps. Cada entrada: data + contexto + decisão + resultado',
    },
  },
  // NOTE: cowork-section-schemas and playlist-graph-api removed — their content
  // is now served via GET /api/pipeline/docs/ (Tier 2 domain docs)
  {
    key: 'writer-blog-craft',
    title: 'Blog Post Craft Guide',
    ref_group: 'craft',
    sort_order: 40,
    filePath: null,
    inlineCompact: {
      structure: {
        hook: '1-2 sentences that grab attention',
        intro: 'Expand the hook, set context (2-3 paragraphs)',
        body: 'Clear H2 sections, each with a single idea',
        keyPoints: '3-5 actionable takeaways',
        pullQuote: 'The most shareable sentence',
        conclusion: 'Tie back to the hook, call to action',
      },
      toneAndVoice: {
        perspective: 'First person singular (I, not we)',
        style: 'Conversational but precise',
        paragraphs: 'Short paragraphs (3-4 sentences max)',
        formatting: 'Use subheadings every 200-300 words',
      },
      seo: {
        title: 'Include primary keyword, under 60 chars',
        metaDescription: 'Summarize value proposition, 155 chars',
        slug: '3-5 words max, no stop words',
        headings: 'H1 for title only, H2 for main sections, H3 for subsections',
      },
    },
  },
  {
    key: 'content-curator-skill',
    title: 'Content Curator — Skill Reference (REVIEW, MERGE, PROMOTE, CLEAN)',
    ref_group: 'craft',
    sort_order: 50,
    filePath: '../docs/cowork-content-curator-skill.md',
  },
  {
    key: 'curator-rules',
    title: 'Curator Rules — Critérios de Curadoria',
    ref_group: 'estrategia',
    sort_order: 51,
    filePath: '../docs/cowork-curator-rules.md',
  },
  {
    key: 'curator-memory',
    title: 'Curator Memory — Histórico de Curadorias',
    ref_group: 'memoria',
    sort_order: 52,
    filePath: '../docs/cowork-curator-memory.md',
  },
  {
    key: 'playlist-architect-skill',
    title: 'Playlist Architect — Skill Reference (BUILD, CONNECT, GAP, REORG, CAMPAIGN, COURSE)',
    ref_group: 'craft',
    sort_order: 60,
    filePath: '../docs/cowork-playlist-architect-skill.md',
  },
  {
    key: 'architect-templates',
    title: 'Playlist Templates — Padrões por Tipo de Playlist',
    ref_group: 'estrategia',
    sort_order: 61,
    filePath: '../docs/cowork-architect-templates.md',
  },
  {
    key: 'architect-memory',
    title: 'Architect Memory — Histórico de Playlists',
    ref_group: 'memoria',
    sort_order: 62,
    filePath: '../docs/cowork-architect-memory.md',
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
    let contentMd = ''
    if (entry.filePath) {
      const fullPath = resolve(__dirname, entry.filePath)
      console.log(`Reading ${fullPath}...`)
      contentMd = readFileSync(fullPath, 'utf8')
      console.log(`  ${contentMd.length} chars, ${contentMd.split('\n').length} lines`)
    } else {
      console.log(`Inline entry: ${entry.key}`)
    }

    const { data, error } = await supabase
      .from('reference_content')
      .upsert(
        {
          site_id: site.id,
          key: entry.key,
          title: entry.title,
          ref_group: entry.ref_group,
          sort_order: entry.sort_order,
          content_md: contentMd || null,
          content_compact: entry.inlineCompact ?? null,
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
