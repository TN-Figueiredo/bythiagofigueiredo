export type DomainId = 'items-and-sections' | 'playlists' | 'libraries' | 'research' | 'youtube' | 'utilities' | 'course' | 'links'

export interface ApiEndpointMeta {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  path: string
  summary: string
  auth: 'read' | 'write'
}

export interface CapabilityDomain {
  domain: DomainId
  name: string
  description: string
  suggest_when: string
  docs: string
  endpoint_count: number
  endpoints: readonly ApiEndpointMeta[]
}

export interface CrossDomainWorkflow {
  name: string
  description: string
  domains: DomainId[]
  steps: string[]
}

export interface ApiCatalog {
  name: string
  version: string
  auth: {
    methods: string[]
    header: string
    rate_limit: string
    version_header: string
  }
  capabilities: CapabilityDomain[]
  cross_domain_workflows: CrossDomainWorkflow[]
}

const ITEMS_AND_SECTIONS: CapabilityDomain = {
  domain: 'items-and-sections',
  name: 'Pipeline Items & Content Sections',
  description: 'Create, manage, advance content through workflow stages. Update content sections (ideia, roteiro, postprod, etc.).',
  suggest_when: 'Creating, editing, advancing pipeline content, writing sections, managing item lifecycle',
  docs: '/api/pipeline/docs/items-and-sections',
  endpoint_count: 22,
  endpoints: [
    { method: 'GET', path: '/api/pipeline/items', summary: 'List items with cursor pagination and filtering', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/items', summary: 'Create single or batch items (max 50)', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/items/:id', summary: 'Get item detail with history and dependencies', auth: 'read' },
    { method: 'PATCH', path: '/api/pipeline/items/:id', summary: 'Update item fields (X-Expected-Version required)', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/items/:id', summary: 'Archive item (soft delete)', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/items/:id/advance', summary: 'Advance to next workflow stage', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/items/:id/retreat', summary: 'Retreat to previous stage', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/items/:id/checklist', summary: 'Toggle production checklist item', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/items/:id/graduate', summary: 'Graduate to blog post, newsletter, or campaign', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/items/:id/restore', summary: 'Unarchive a previously archived item', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/items/:id/history', summary: 'Get audit trail for item changes', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/items/:id/link', summary: 'Link a blog post to pipeline item', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/items/:id/unlink', summary: 'Unlink blog post from pipeline item', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/items/:id/sections/:section', summary: 'Get specific content section', auth: 'read' },
    { method: 'PATCH', path: '/api/pipeline/items/:id/sections/:section', summary: 'Update content section with revision tracking', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/items/bulk', summary: 'Batch operations (advance, archive, tag, update)', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/items/batch-sections', summary: 'Batch update sections across multiple items', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/items/:id/publish', summary: 'Publish or schedule a graduated blog post (VVS gate)', auth: 'write' },
    // ── Recording status (per-beat, per-lang durable ledger) ───────────
    { method: 'GET', path: '/api/pipeline/items/:id/recording', summary: 'Per-beat recording status for a lang (derive + reconcile against roteiro)', auth: 'read' },
    { method: 'PUT', path: '/api/pipeline/items/:id/recording', summary: 'Upsert one beat status (optional if_unmodified_since → 412); never bumps item version', auth: 'write' },
    { method: 'PATCH', path: '/api/pipeline/items/:id/recording/batch', summary: 'Batch upsert beat statuses (max 100)', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/items/:id/recording/orphans', summary: 'Purge orphan rows whose beat_id is gone from the current roteiro', auth: 'write' },
  ],
}

const PLAYLISTS: CapabilityDomain = {
  domain: 'playlists',
  name: 'Playlists & Graph',
  description: 'Organize items into playlists with directed edges for sequencing and dependencies.',
  suggest_when: 'Organizing content into series, courses, creating dependency graphs, managing content sequences',
  docs: '/api/pipeline/docs/playlists',
  endpoint_count: 13,
  endpoints: [
    { method: 'GET', path: '/api/pipeline/playlists', summary: 'List playlists with item counts', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/playlists', summary: 'Create new playlist', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/playlists/:id', summary: 'Get playlist with items and edges graph', auth: 'read' },
    { method: 'PATCH', path: '/api/pipeline/playlists/:id', summary: 'Update playlist metadata', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/playlists/:id', summary: 'Delete playlist', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/playlists/:id/items', summary: 'Add item to playlist', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/playlists/:id/items/:itemId', summary: 'Remove item from playlist', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/playlists/:id/items/bulk', summary: 'Batch add items to playlist', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/playlists/:id/edges', summary: 'Create directed edge between items', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/playlists/:id/edges/:edgeId', summary: 'Remove edge', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/playlists/:id/edges/bulk', summary: 'Batch create edges', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/playlists/:id/reorder', summary: 'Reorder items in playlist', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/playlists/:id/auto-layout', summary: 'Compute automatic layout positions', auth: 'write' },
  ],
}

const LIBRARIES: CapabilityDomain = {
  domain: 'libraries',
  name: 'Audio & B-Roll Libraries',
  description: 'Manage audio assets (music, SFX, ambience) and B-roll video clips for post-production.',
  suggest_when: 'Audio selection, music search, B-roll management, SFX, post-production asset workflow',
  docs: '/api/pipeline/docs/libraries',
  endpoint_count: 15,
  endpoints: [
    { method: 'GET', path: '/api/pipeline/audio-library', summary: 'Search/filter audio assets', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/audio-library', summary: 'Create new audio asset', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/audio-library/:id', summary: 'Get audio asset with usage history', auth: 'read' },
    { method: 'PATCH', path: '/api/pipeline/audio-library/:id', summary: 'Update audio asset (X-Expected-Version)', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/audio-library/:id', summary: 'Retire audio asset (soft delete)', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/audio-library/resolve', summary: 'Smart audio matching by context/filters', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/audio-library/import', summary: 'Batch import audio library', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/audio-library/export', summary: 'Export full library as JSON', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/audio-library/stats', summary: 'Library statistics (counts, most used)', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/broll-library', summary: 'List B-roll assets with filters', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/broll-library', summary: 'Create B-roll asset', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/broll-library/:id', summary: 'Get B-roll with usage info', auth: 'read' },
    { method: 'PATCH', path: '/api/pipeline/broll-library/:id', summary: 'Update B-roll asset', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/broll-library/:id', summary: 'Retire B-roll asset', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/broll-library/import', summary: 'Batch import B-roll library', auth: 'write' },
  ],
}

const RESEARCH: CapabilityDomain = {
  domain: 'research',
  name: 'Research Library',
  description: 'Manage research items with hierarchical topics and many-to-many pipeline links, plus the strategy layer on top: decisões (editorial decisions grounded in research) and focos (the single active strategic focus, with prioritization and theme grouping).',
  suggest_when: 'Research management, topic organization, linking research to pipeline items, knowledge base, plus the strategy layer: registering editorial decisões, proposing/activating the active foco, prioritization across themes',
  docs: '/api/pipeline/docs/research',
  endpoint_count: 26,
  endpoints: [
    { method: 'GET', path: '/api/pipeline/research', summary: 'List research items with cursor pagination', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/research', summary: 'Create research item (upsert by topic+title)', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/research/:id', summary: 'Get research item with linked pipeline items', auth: 'read' },
    { method: 'PATCH', path: '/api/pipeline/research/:id', summary: 'Update research content', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/research/:id', summary: 'Delete research item', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/research/:id/links', summary: 'Link research to pipeline item', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/research/:id/links/:linkId', summary: 'Remove research-pipeline link', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/research/import', summary: 'Batch import research items', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/research/topics', summary: 'List research topics (hierarchical)', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/research/topics', summary: 'Create research topic (max depth 3)', auth: 'write' },
    { method: 'PATCH', path: '/api/pipeline/research/topics/:id', summary: 'Update topic metadata', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/research/topics/:id', summary: 'Delete research topic', auth: 'write' },
    // ── Strategy layer: focos (single active strategic focus) ──────────
    { method: 'GET', path: '/api/pipeline/research/focos', summary: 'List strategic focos with optional state filter', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/research/focos', summary: 'Create a foco (always inactive) with themes + pinned research', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/research/focos/active', summary: 'Get the single active foco (or null)', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/research/focos/:id', summary: 'Get a foco with themes, pinned research, linked decisões', auth: 'read' },
    { method: 'PATCH', path: '/api/pipeline/research/focos/:id', summary: 'Update foco fields and diff-sync themes + pinned research', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/research/focos/:id', summary: 'Archive a foco (state arquivado, active false)', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/research/focos/:id/activate', summary: 'Activate a foco — demotes the prior active (requires { confirm: true })', auth: 'write' },
    // ── Strategy layer: decisões (editorial decisions) ─────────────────
    { method: 'GET', path: '/api/pipeline/research/decisoes', summary: 'List editorial decisões with horizon/status/theme filters', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/research/decisoes', summary: 'Create a decisão grounded in research sources', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/research/decisoes/:id', summary: 'Get a decisão with its linked research sources', auth: 'read' },
    { method: 'PATCH', path: '/api/pipeline/research/decisoes/:id', summary: 'Update a decisão and diff-sync research sources', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/research/decisoes/:id', summary: 'Archive a decisão (status arquivado)', auth: 'write' },
    { method: 'POST', path: '/api/pipeline/research/decisoes/:id/link', summary: 'Link a research item to a decisão', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/research/decisoes/:id/link', summary: 'Unlink a research item from a decisão (?research_id=)', auth: 'write' },
  ],
}

const YOUTUBE: CapabilityDomain = {
  domain: 'youtube',
  name: 'YouTube Analytics & A/B Testing',
  description: 'Channel intelligence, video performance analysis, and title/description A/B testing.',
  suggest_when: 'YouTube analytics, performance review, A/B test management, video optimization',
  docs: '/api/pipeline/docs/youtube',
  endpoint_count: 31,
  endpoints: [
    { method: 'GET', path: '/api/pipeline/youtube/intelligence', summary: 'Get channel intelligence snapshot', auth: 'read' },
    { method: 'PATCH', path: '/api/pipeline/youtube/intelligence', summary: 'Submit AI analysis recommendations', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/youtube/intelligence/task', summary: 'Claim next pending intelligence task', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/videos', summary: 'List videos with category join and cursor pagination', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/videos/:id', summary: 'Get video detail with 6-axis scoring and grade trend', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/categories', summary: 'List categories with match_keywords and video counts', auth: 'read' },
    { method: 'PATCH', path: '/api/pipeline/youtube/categories', summary: 'Update match_keywords for a category', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/youtube/analytics/overview', summary: 'Channel health overview with per-axis scores, KPIs, and baselines', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/analytics/grades', summary: 'Per-video scores with sort, top5, and bottom5', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/analytics/demographics', summary: 'Audience demographics: age/gender, countries, devices', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/analytics/search-terms', summary: 'Top search terms driving traffic to channel', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/analytics/notes', summary: 'List analytics notes for a channel', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/youtube/analytics/notes', summary: 'Create bot note (Cowork-authored) for a channel', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/youtube/ab-tests', summary: 'List A/B tests with variants', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/ab-tests/:id', summary: 'Get A/B test details with variants and cycles', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/ab-tests/:id/funnel', summary: 'Get funnel metrics per variant', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/ab-tests/:id/history', summary: 'Get test history for a video by youtube_video_id', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/ab-performance', summary: 'Aggregate winning patterns from completed tests', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/youtube/ab-tests/:id/variants', summary: 'Batch upsert variants (B, C, D) for a draft test', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/youtube/ab-tests/:id/variants', summary: 'List all variants for a test ordered by sort_order', auth: 'read' },
    { method: 'DELETE', path: '/api/pipeline/youtube/ab-tests/:id/variants', summary: 'Delete a non-original variant by label (B, C, or D)', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/youtube/ab-tests/learnings', summary: 'Tag win rates and channel insights from completed tests', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/ab-tests/suggestions', summary: 'Suggested videos for A/B testing based on underperformance', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/ab-tests/fatigue-alerts', summary: 'Pending fatigue alerts for videos with declining CTR', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/ab-tests/dashboard', summary: 'Aggregate dashboard stats for A/B tests', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/thumbnails/fatigue', summary: 'Get thumbnail fatigue alerts for videos with declining CTR', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/thumbnails/library', summary: 'Get thumbnail library with reusable assets', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/competitors/channels', summary: 'List competitor channels with engagement stats', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/competitors/changes', summary: 'List competitor changes with type/bookmarked filters', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/competitors/outliers', summary: 'List competitor outlier videos by tier', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/competitors/insights', summary: 'Aggregate competitor insights (play, cadence, formulas, gaps, heatmap)', auth: 'read' },
  ],
}

const UTILITIES: CapabilityDomain = {
  domain: 'utilities',
  name: 'Search, Context & Utilities',
  description: 'Cross-entity search, reference content management, pipeline statistics, and workflow definitions.',
  suggest_when: 'Searching across entities, reading/updating references, checking stats, listing workflows',
  docs: '/api/pipeline/docs/utilities',
  endpoint_count: 11,
  endpoints: [
    { method: 'GET', path: '/api/pipeline/context', summary: 'Get all reference content (supports ?group= ?skill= ?format=md)', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/context/:key', summary: 'Get specific reference doc', auth: 'read' },
    { method: 'PUT', path: '/api/pipeline/context/:key', summary: 'Upsert reference doc (X-Expected-Version)', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/context/:key', summary: 'Delete reference doc', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/search', summary: 'Cross-entity search (items, posts, newsletters)', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/stats', summary: 'Aggregate pipeline statistics', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/topics/:code', summary: 'Topic aggregation (items + posts by tag)', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/workflows', summary: 'Get all workflow definitions and checklists', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/docs/:domain', summary: 'Get Tier 2 documentation guide for a capability domain', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/up-next', summary: 'Command center: today actions, week grid, streak, suggestions', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/up-next', summary: 'Assign or swap pipeline item in a week slot', auth: 'write' },
  ],
}

const COURSE: CapabilityDomain = {
  domain: 'course',
  name: 'Course Production (Schema Docs)',
  description: 'Course-specific section schemas (curriculum, lessons, material, launch, publish), graduation workflow, and Product Launch Formula. Uses Items & Sections endpoints — this domain provides schema documentation only, no unique API routes.',
  suggest_when: 'Creating courses, managing curriculum, lesson scripts, materials, launch planning, course graduation to playlist',
  docs: '/api/pipeline/docs/course',
  endpoint_count: 0,
  endpoints: [],
}

const LINKS: CapabilityDomain = {
  domain: 'links',
  name: 'Links Engine (tracked short links)',
  description: 'Create and manage tracked short links (go-links) with UTM parameters. Each link resolves at /go/{code} (or the configured short domain) and tracks clicks. Codes are auto-generated when omitted and are unique per site.',
  suggest_when: 'Creating campaign short links, building tracked URLs with UTMs, shortening destination URLs, managing/archiving go-links',
  docs: '/api/pipeline/docs/links',
  endpoint_count: 5,
  endpoints: [
    { method: 'GET', path: '/api/pipeline/links', summary: 'List tracked links with utm_campaign/active/search filters', auth: 'read' },
    { method: 'POST', path: '/api/pipeline/links', summary: 'Create a tracked short link (code auto-generated, UTMs optional)', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/links/:id', summary: 'Get a tracked link with its short_url', auth: 'read' },
    { method: 'PATCH', path: '/api/pipeline/links/:id', summary: 'Update tracked link fields (destination, UTMs, redirect_type, active)', auth: 'write' },
    { method: 'DELETE', path: '/api/pipeline/links/:id', summary: 'Archive a tracked link (active false, soft)', auth: 'write' },
  ],
}

const CROSS_DOMAIN_WORKFLOWS: CrossDomainWorkflow[] = [
  {
    name: 'Video production pipeline',
    description: 'Full lifecycle from idea to published video',
    domains: ['items-and-sections', 'libraries', 'playlists'],
    steps: [
      'POST /api/pipeline/items — create video item',
      'PATCH /api/pipeline/items/:id/sections/ideia — write premise and angle',
      'PATCH /api/pipeline/items/:id/sections/draft — write draft',
      'PATCH /api/pipeline/items/:id/sections/roteiro — write script with beats',
      'POST /api/pipeline/audio-library/resolve — find music and SFX',
      'PATCH /api/pipeline/items/:id/sections/postprod_scenes — fill timeline',
      'POST /api/pipeline/items/:id/advance — move through stages',
      'POST /api/pipeline/playlists/:id/items — add to playlist',
    ],
  },
  {
    name: 'Research to content pipeline',
    description: 'Turn research into pipeline items and link them',
    domains: ['research', 'items-and-sections'],
    steps: [
      'POST /api/pipeline/research — create research item',
      'POST /api/pipeline/items — create pipeline item from research',
      'POST /api/pipeline/research/:id/links — link research to item',
    ],
  },
  {
    name: 'Course production pipeline',
    description: 'Full lifecycle from course idea to published course with graduation to playlist',
    domains: ['items-and-sections', 'course', 'playlists'],
    steps: [
      'POST /api/pipeline/items — create item with format: "course"',
      'PATCH /api/pipeline/items/:id/sections/ideia — write premise, body, target audience',
      'PATCH /api/pipeline/items/:id/sections/curriculum — create modules + lessons structure',
      'PATCH /api/pipeline/items/:id/sections/lessons — write per-lesson scripts and talking points',
      'PATCH /api/pipeline/items/:id/sections/material — add resources per lesson',
      'PATCH /api/pipeline/items/:id/sections/launch — plan Product Launch Formula sequence',
      'PATCH /api/pipeline/items/:id/sections/publish — write sales copy (headline, bullets, FAQ, testimonials)',
      'POST /api/pipeline/items/:id/graduate — graduate course to playlist with module→edge sequence',
    ],
  },
  {
    name: 'Research → strategy loop',
    description: 'Turn accumulated research into editorial direction: capture takeaways, register a decisão, and promote the active strategic foco',
    domains: ['research'],
    steps: [
      'POST /api/pipeline/research — capture a research item / takeaway',
      'POST /api/pipeline/research/decisoes — register a decisão grounded in those research sources',
      'POST /api/pipeline/research/focos — propose a foco pinning the relevant research + themes',
      'POST /api/pipeline/research/focos/:id/activate — activate it (confirm:true) as the single active foco',
    ],
  },
  {
    name: 'Publish with tracked distribution',
    description: 'Publish a content item and create a tracked short link to distribute it with UTM attribution',
    domains: ['items-and-sections', 'links'],
    steps: [
      'POST /api/pipeline/items/:id/publish — publish the graduated blog post',
      'POST /api/pipeline/links — create a tracked short link to the published URL with utm_campaign + utm_source',
      'GET /api/pipeline/links?utm_campaign=... — review the link and its short_url (/go/{code})',
    ],
  },
]

export const DOMAIN_LABELS: Record<DomainId, string> = {
  'items-and-sections': 'Items',
  playlists: 'Playlists',
  libraries: 'Libraries',
  research: 'Research',
  youtube: 'YouTube',
  utilities: 'Utilities',
  course: 'Courses',
  links: 'Links',
}

export const API_REGISTRY: ApiCatalog = {
  name: 'Content Pipeline API',
  version: '2.0.0',
  auth: {
    methods: ['api_key', 'session_cookie'],
    header: 'X-Pipeline-Key',
    rate_limit: '100/min (api_key only)',
    version_header: 'X-Expected-Version',
  },
  capabilities: [ITEMS_AND_SECTIONS, PLAYLISTS, LIBRARIES, RESEARCH, YOUTUBE, UTILITIES, COURSE, LINKS],
  cross_domain_workflows: CROSS_DOMAIN_WORKFLOWS,
}
