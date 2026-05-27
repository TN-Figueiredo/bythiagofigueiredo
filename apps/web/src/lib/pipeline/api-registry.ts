export type DomainId = 'items-and-sections' | 'playlists' | 'libraries' | 'research' | 'youtube' | 'utilities' | 'course'

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
  endpoint_count: 18,
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
  description: 'Manage research items with hierarchical topics and many-to-many pipeline links.',
  suggest_when: 'Research management, topic organization, linking research to pipeline items, knowledge base',
  docs: '/api/pipeline/docs/research',
  endpoint_count: 12,
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
  ],
}

const YOUTUBE: CapabilityDomain = {
  domain: 'youtube',
  name: 'YouTube Analytics & A/B Testing',
  description: 'Channel intelligence, video performance analysis, and title/description A/B testing.',
  suggest_when: 'YouTube analytics, performance review, A/B test management, video optimization',
  docs: '/api/pipeline/docs/youtube',
  endpoint_count: 7,
  endpoints: [
    { method: 'GET', path: '/api/pipeline/youtube/intelligence', summary: 'Get channel intelligence snapshot', auth: 'read' },
    { method: 'PATCH', path: '/api/pipeline/youtube/intelligence', summary: 'Submit AI analysis recommendations', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/youtube/intelligence/task', summary: 'Claim next pending intelligence task', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/ab-tests', summary: 'List A/B tests with variants', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/ab-tests/:id', summary: 'Get A/B test details with variants and cycles', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/ab-tests/:id/funnel', summary: 'Get funnel metrics per variant', auth: 'read' },
    { method: 'GET', path: '/api/pipeline/youtube/ab-performance', summary: 'Aggregate winning patterns from completed tests', auth: 'read' },
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
]

export const DOMAIN_LABELS: Record<DomainId, string> = {
  'items-and-sections': 'Items',
  playlists: 'Playlists',
  libraries: 'Libraries',
  research: 'Research',
  youtube: 'YouTube',
  utilities: 'Utilities',
  course: 'Courses',
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
  capabilities: [ITEMS_AND_SECTIONS, PLAYLISTS, LIBRARIES, RESEARCH, YOUTUBE, UTILITIES, COURSE],
  cross_domain_workflows: CROSS_DOMAIN_WORKFLOWS,
}
