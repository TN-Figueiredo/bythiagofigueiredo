import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import * as itemsService from './services/items'
import * as sectionsService from './services/sections'
import * as playlistsService from './services/playlists'
import * as edgesService from './services/edges'
import * as audioService from './services/audio'
import * as brollService from './services/broll'
import * as researchService from './services/research'
import * as decisionsService from './services/research-decisions'
import * as focosService from './services/research-focos'
import * as linksService from './services/links'
import * as recordingService from './services/recording'
import * as abTestService from './services/ab-tests'
import * as observatoryService from './services/youtube-observatory'
import * as analyticsService from './services/youtube-analytics'
import * as videosService from './services/youtube-videos'
import * as searchService from './services/search'
import * as upNextService from './services/up-next'

// ---------------------------------------------------------------------------
// Zod input schemas
//
// McpServer.tool() accepts a ZodRawShape (the object passed to z.object()).
// For polymorphic tools, we use a flat shape with an `action` enum and
// document per-action field requirements in descriptions.
// ---------------------------------------------------------------------------

// ---- 1. create_item ----
const CreateItemShape = {
  format: z.enum(['video', 'blog_post', 'newsletter', 'course', 'campaign'])
    .describe('video: YouTube video. blog_post: written article. newsletter: email edition. course: educational product. campaign: marketing campaign.'),
  title_pt: z.string().max(500).optional()
    .describe('Portuguese title (at least one title required)'),
  title_en: z.string().max(500).optional()
    .describe('English title (at least one title required)'),
  code: z.string().max(100).optional()
    .describe('Short slug code (auto-generated if omitted)'),
  language: z.enum(['pt-br', 'en', 'both']).default('pt-br')
    .describe('pt-br: Brazilian Portuguese. en: English. both: bilingual.'),
  priority: z.number().int().min(0).max(5).default(0)
    .describe('Priority 0 (lowest) to 5 (highest)'),
  hook: z.string().max(300).optional()
    .describe('One-line hook or premise'),
  synopsis: z.string().max(2000).optional()
    .describe('Longer description'),
  parent_id: z.string().uuid().optional()
    .describe('Parent item UUID for hierarchical items'),
  tags: z.array(z.string().max(50)).max(20).default([])
    .describe('Categorization tags'),
  format_metadata: z.record(z.unknown()).default({})
    .describe('Format-specific fields (playlist_letter, seo_keyword, etc.)'),
  assigned_to: z.string().uuid().optional()
    .describe('User UUID to assign the item to'),
  dry_run: z.boolean().default(false)
    .describe('Preview the item without persisting'),
}

// ---- 2. update_item ----
const UpdateItemShape = {
  id: z.string().uuid()
    .describe('Pipeline item UUID'),
  title_pt: z.string().max(500).optional(),
  title_en: z.string().max(500).optional(),
  stage: z.string().optional()
    .describe('Workflow stage (use advance_item for normal progression)'),
  language: z.enum(['pt-br', 'en', 'both']).optional()
    .describe('pt-br: Brazilian Portuguese. en: English. both: bilingual.'),
  priority: z.number().int().min(0).max(5).optional(),
  hook: z.string().max(300).optional(),
  synopsis: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  format_metadata: z.record(z.unknown()).optional()
    .describe('Format-specific fields to merge'),
  assigned_to: z.string().uuid().nullable().optional()
    .describe('Reassign or unassign (null)'),
  category: z.enum(['stories', 'building', 'money', 'bts']).nullable().optional()
    .describe('stories: personal narratives. building: building in public. money: monetization. bts: behind the scenes.'),
  cover_image_url: z.string().url().nullable().optional()
    .describe('Cover image URL or null to remove'),
  dry_run: z.boolean().default(false)
    .describe('Preview changes without persisting'),
}

// ---- 3. advance_item ----
const AdvanceItemShape = {
  id: z.string().uuid()
    .describe('Pipeline item UUID'),
  direction: z.enum(['forward', 'backward']).default('forward')
    .describe('forward: advance to next stage. backward: retreat to previous stage.'),
  dry_run: z.boolean().default(false)
    .describe('Preview the transition without executing'),
}

// ---- 4. manage_sections ----
const ManageSectionsShape = {
  action: z.enum(['get', 'update'])
    .describe('get: read section content. update: write new content (creates revision).'),
  item_id: z.string().uuid().optional()
    .describe('Pipeline item UUID (required for single get/update)'),
  section: z.string().optional()
    .describe('Section key: ideia, roteiro, postprod, draft, seo, images, publish, curriculum, lessons, material, launch, content, layout, audience, send, briefing, assets, metrics'),
  lang: z.enum(['pt', 'en']).default('en')
    .describe('pt: Portuguese variant. en: English variant. Ignored for shared sections (ideia, images, curriculum, launch).'),
  content: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]).optional()
    .describe('Section content (markdown string, JSON object, or array). Required for update.'),
  source: z.string().default('cowork')
    .describe('Author identifier (e.g. "cowork", "user")'),
  modified_by: z.string().optional()
    .describe('Display name of who made the change'),
  batch: z.array(z.object({
    item_id: z.string().uuid(),
    section: z.string(),
    lang: z.string().default('en'),
    content: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]),
    source: z.string().default('cowork'),
    modified_by: z.string().optional(),
  })).max(50).optional()
    .describe('Batch update multiple sections (max 50). Overrides single-section fields when provided.'),
  dry_run: z.boolean().default(false)
    .describe('Preview changes without persisting'),
}

// ---- 5. delete_item ----
const DeleteItemShape = {
  id: z.string().uuid()
    .describe('Pipeline item UUID to archive'),
  confirm: z.boolean().optional()
    .describe('Must be true to execute deletion'),
  confirmation_token: z.string().optional()
    .describe('Token returned from a prior dry_run call'),
  dry_run: z.boolean().default(false)
    .describe('Preview what would be archived without executing'),
}

// ---- 6. graduate_item ----
const GraduateItemShape = {
  id: z.string().uuid()
    .describe('Pipeline item UUID to graduate'),
  target: z.enum(['blog_post', 'newsletter', 'campaign', 'course'])
    .describe('blog_post: create CMS blog post. newsletter: create edition. campaign: create campaign. course: graduate to playlist with module edges.'),
  data: z.record(z.unknown()).optional()
    .describe('Target-specific data (slug, edition_number, etc.)'),
  confirm: z.boolean().optional()
    .describe('Must be true to execute graduation'),
  confirmation_token: z.string().optional()
    .describe('Token returned from a prior dry_run call'),
  dry_run: z.boolean().default(false)
    .describe('Preview graduation result without executing'),
}

// ---- 7. publish_item ----
const PublishItemShape = {
  id: z.string().uuid()
    .describe('Pipeline item UUID (must be graduated first)'),
  scheduled_at: z.string().datetime().optional()
    .describe('ISO datetime to schedule publication (omit for immediate)'),
  confirm: z.boolean().optional()
    .describe('Must be true to execute publish'),
  confirmation_token: z.string().optional()
    .describe('Token returned from a prior dry_run call'),
  dry_run: z.boolean().default(false)
    .describe('Preview publish plan without executing'),
}

// ---- 8. bulk_items ----
const BulkItemsShape = {
  operations: z.array(z.object({
    op: z.enum(['advance', 'retreat', 'archive', 'restore', 'update', 'tag'])
      .describe('advance: next stage. retreat: previous stage. archive: soft-delete. restore: unarchive. update: patch fields. tag: add/remove tags.'),
    id: z.string().uuid()
      .describe('Pipeline item UUID'),
    data: z.record(z.unknown()).optional()
      .describe('For update: item fields. For tag: { add: string[], remove: string[] }'),
    version: z.number().int().optional()
      .describe('Required for update op (optimistic concurrency)'),
  })).min(1).max(50)
    .describe('Array of operations (max 50)'),
  confirm: z.boolean().optional()
    .describe('Must be true to execute bulk operations'),
  confirmation_token: z.string().optional()
    .describe('Token returned from a prior dry_run call'),
  dry_run: z.boolean().default(false)
    .describe('Preview all operations without executing'),
}

// ---- 9. manage_playlist ----
const ManagePlaylistShape = {
  action: z.enum(['create', 'update', 'delete', 'reorder', 'auto_layout', 'add_item', 'remove_item', 'bulk_add_items'])
    .describe('create: new playlist. update: modify metadata/status. delete: remove playlist (cascades items+edges, requires confirm). reorder: set item order. auto_layout: compute DAG positions. add_item: add single content item. remove_item: remove item (requires confirm). bulk_add_items: batch add up to 50 items.'),
  id: z.string().uuid().optional()
    .describe('Playlist UUID (required for all actions except create)'),
  name_en: z.string().max(200).optional()
    .describe('English name (required for create)'),
  name_pt: z.string().max(200).optional()
    .describe('Portuguese name'),
  description_en: z.string().max(1000).nullable().optional(),
  description_pt: z.string().max(1000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional()
    .describe('draft: work in progress. published: visible to public. archived: hidden.'),
  cover_image_url: z.string().url().nullable().optional(),
  item_ids: z.array(z.string().uuid()).optional()
    .describe('Ordered list of playlist-item UUIDs (for reorder action)'),
  item_id: z.string().uuid().optional()
    .describe('Playlist-item UUID (for remove_item action)'),
  blog_post_id: z.string().uuid().optional()
    .describe('Blog post UUID to add (for add_item — exactly one content ref required)'),
  newsletter_edition_id: z.string().uuid().optional()
    .describe('Newsletter edition UUID to add (for add_item — exactly one content ref required)'),
  pipeline_id: z.string().uuid().optional()
    .describe('Pipeline item UUID to add (for add_item — exactly one content ref required)'),
  sort_order: z.number().int().min(0).optional()
    .describe('Sort order for add_item (auto-assigned if omitted)'),
  position_x: z.number().optional()
    .describe('Canvas X position for add_item (default 0)'),
  position_y: z.number().optional()
    .describe('Canvas Y position for add_item (default 0)'),
  items: z.array(z.object({
    blog_post_id: z.string().uuid().optional(),
    newsletter_edition_id: z.string().uuid().optional(),
    pipeline_id: z.string().uuid().optional(),
    sort_order: z.number().int().min(0).optional(),
    position_x: z.number().optional(),
    position_y: z.number().optional(),
  })).max(50).optional()
    .describe('Array of items for bulk_add_items (max 50, each needs exactly one content ref)'),
  confirm: z.boolean().optional()
    .describe('Required for delete/remove_item actions'),
  confirmation_token: z.string().optional()
    .describe('Token from dry_run for destructive ops'),
  dry_run: z.boolean().default(false)
    .describe('Preview changes without executing'),
}

// ---- 10. manage_edges ----
const ManageEdgesShape = {
  action: z.enum(['create', 'delete', 'bulk_create'])
    .describe('create: single directed edge. delete: remove edge by ID. bulk_create: up to 100 edges at once. All are cycle-safe.'),
  playlist_id: z.string().uuid()
    .describe('Playlist UUID containing the items'),
  source_item_id: z.string().uuid().optional()
    .describe('Source playlist-item UUID (for create)'),
  target_item_id: z.string().uuid().optional()
    .describe('Target playlist-item UUID (for create)'),
  edge_type: z.enum(['sequence', 'related', 'prerequisite', 'continuation']).optional()
    .describe('sequence: watch/read order. related: thematic link. prerequisite: must consume first. continuation: follows on.'),
  label: z.string().max(100).optional()
    .describe('Optional display label for the edge'),
  edge_id: z.string().uuid().optional()
    .describe('Edge UUID to delete (for delete action)'),
  edges: z.array(z.object({
    source_item_id: z.string().uuid(),
    target_item_id: z.string().uuid(),
    edge_type: z.enum(['sequence', 'related', 'prerequisite', 'continuation']),
    label: z.string().max(100).optional(),
  })).max(100).optional()
    .describe('Array of edges for bulk_create (max 100)'),
  confirm: z.boolean().optional()
    .describe('Required for delete action'),
  confirmation_token: z.string().optional()
    .describe('Token from dry_run for delete'),
  dry_run: z.boolean().default(false)
    .describe('Preview changes without executing'),
}

// ---- 11. manage_audio ----
const ManageAudioShape = {
  action: z.enum(['create', 'update', 'retire', 'import', 'resolve', 'list', 'get', 'export', 'stats'])
    .describe('create: register new audio asset. update: patch metadata (requires version). retire: soft-delete. import: batch import. resolve: smart search (read-only). list: browse assets with filters. get: fetch single asset by id. export: full library export. stats: aggregate statistics.'),
  id: z.string().uuid().optional()
    .describe('Audio asset UUID (for update/retire)'),
  asset_id: z.string().max(100).optional()
    .describe('External asset identifier (e.g. Artlist ID) (for create)'),
  original_filename: z.string().max(500).optional(),
  type: z.enum(['music', 'sfx']).optional()
    .describe('music: background/feature track. sfx: sound effect.'),
  source: z.string().max(200).optional()
    .describe('Asset source (e.g. artlist, freesound)'),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  genre: z.string().max(100).optional(),
  artist: z.string().max(200).optional(),
  track_name: z.string().max(300).optional(),
  duration_seconds: z.number().positive().optional(),
  bpm: z.number().int().positive().optional(),
  energy: z.number().int().min(1).max(5).optional()
    .describe('Energy level 1 (calm) to 5 (intense)'),
  tags: z.array(z.string().max(50)).max(50).optional(),
  mood: z.array(z.string().max(50)).max(30).optional(),
  instruments: z.array(z.string().max(50)).max(30).optional(),
  use_cases: z.array(z.string().max(100)).max(30).optional(),
  reusable: z.boolean().optional(),
  status: z.enum(['downloaded', 'pending', 'retired']).optional()
    .describe('downloaded: ready to use. pending: not yet acquired. retired: no longer available.'),
  priority: z.enum(['essential', 'nice_to_have', 'optional']).optional()
    .describe('essential: must-have. nice_to_have: preferred. optional: backup choice.'),
  version: z.number().int().positive().optional()
    .describe('Current version for optimistic concurrency (required for update)'),
  bpm_range: z.object({ min: z.number(), max: z.number() }).optional()
    .describe('BPM range filter for resolve'),
  duration_range: z.object({ min: z.number(), max: z.number() }).optional()
    .describe('Duration range in seconds for resolve'),
  reuse_scenarios: z.array(z.string().max(100)).max(20).optional()
    .describe('Matching reuse scenarios for resolve'),
  description: z.string().max(500).optional()
    .describe('Free-text description for resolve matching'),
  limit: z.number().int().min(1).max(20).default(5)
    .describe('Max results for resolve'),
  import_data: z.object({
    schema_version: z.string(),
    music: z.array(z.record(z.unknown())).max(500).default([]),
    sfx: z.array(z.record(z.unknown())).max(500).default([]),
  }).optional()
    .describe('Full import manifest for import action'),
  dry_run: z.boolean().default(false)
    .describe('Preview changes without executing'),
}

// ---- 12. match_audio ----
const MatchAudioShape = {
  type: z.enum(['music', 'sfx'])
    .describe('music: background/feature track. sfx: sound effect.'),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  mood: z.array(z.string().max(50)).max(20).optional()
    .describe('Mood descriptors (e.g. uplifting, dark, mysterious)'),
  energy: z.number().int().min(1).max(5).optional()
    .describe('Energy level 1 (calm) to 5 (intense)'),
  bpm_range: z.object({ min: z.number(), max: z.number() }).optional()
    .describe('Beats per minute range'),
  duration_range: z.object({ min: z.number(), max: z.number() }).optional()
    .describe('Duration in seconds range'),
  instruments: z.array(z.string().max(50)).max(20).optional(),
  reuse_scenarios: z.array(z.string().max(100)).max(20).optional()
    .describe('Context where audio will be reused (e.g. "intro sequence", "montage")'),
  description: z.string().max(500).optional()
    .describe('Free-text description of desired audio'),
  limit: z.number().int().min(1).max(20).default(5),
}

// ---- 13. manage_broll ----
const ManageBrollShape = {
  action: z.enum(['create', 'update', 'retire', 'import', 'list', 'get'])
    .describe('create: register new B-roll clip. update: patch metadata (requires version). retire: soft-delete. import: batch import. list: browse assets with filters. get: fetch single asset by id.'),
  id: z.string().uuid().optional()
    .describe('B-roll asset UUID (for update/retire)'),
  asset_id: z.string().max(100).optional()
    .describe('External asset identifier (for create)'),
  original_filename: z.string().max(500).optional(),
  type: z.enum(['footage', 'photo', 'screen_recording', 'stock', 'graphic', 'animation']).optional()
    .describe('footage: camera footage. photo: still image. screen_recording: screencast. stock: licensed stock. graphic: designed graphic. animation: motion graphic.'),
  source_type: z.enum(['pessoal', 'generico']).optional()
    .describe('pessoal: original/personal footage. generico: stock/generic.'),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  location: z.string().max(300).optional()
    .describe('Where the footage was captured'),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(50).optional(),
  resolution: z.string().max(20).optional()
    .describe('Video resolution (e.g. 1080p, 4k)'),
  fps: z.number().int().min(1).max(240).optional(),
  duration_seconds: z.number().nonnegative().optional(),
  has_audio: z.boolean().optional(),
  reusable: z.boolean().optional(),
  status: z.enum(['available', 'pending', 'retired']).optional()
    .describe('available: ready to use. pending: not yet ingested. retired: no longer available.'),
  version: z.number().int().positive().optional()
    .describe('Current version for optimistic concurrency (required for update)'),
  import_data: z.object({
    schema_version: z.string(),
    items: z.array(z.record(z.unknown())).max(500).default([]),
  }).optional()
    .describe('Full import manifest for import action'),
  dry_run: z.boolean().default(false)
    .describe('Preview changes without executing'),
}

// ---- 14. manage_research ----
const ManageResearchShape = {
  action: z.enum([
    'create', 'update', 'delete', 'import', 'link', 'unlink',
    'create_topic', 'update_topic', 'delete_topic',
  ]).describe('create: new item. update: patch item. delete: remove (requires confirm). import: batch create (max 50). link: connect to pipeline item. unlink: disconnect. create_topic: new topic. update_topic: patch topic. delete_topic: remove topic (requires confirm).'),
  id: z.string().uuid().optional()
    .describe('Research item UUID (for update/delete/link/unlink)'),
  title: z.string().max(500).optional(),
  topic_slug: z.string().max(200).optional()
    .describe('Hierarchical slug (lowercase kebab-case, e.g. "marketing/seo")'),
  content_md: z.string().max(500_000).optional()
    .describe('Markdown content'),
  content_json: z.record(z.unknown()).optional()
    .describe('Structured JSON content (mutually exclusive with content_md)'),
  summary: z.string().max(2000).nullable().optional(),
  sources: z.array(z.object({
    url: z.string().url(),
    title: z.string().max(200),
    accessed_at: z.string().datetime().optional(),
  })).max(50).optional(),
  status: z.enum(['fresca', 'analise', 'aplicada', 'arquivada']).optional()
    .describe('fresca: just added. analise: under review. aplicada: applied to content. arquivada: hidden.'),
  theme_id: z.enum(['asia', 'ia', 'dev', 'games', 'grana', 'canal']).optional()
    .describe('Tema estratégico do item (asia, ia, dev, games, grana, canal)'),
  pinned: z.boolean().optional()
    .describe('Fixa o item no topo da pesquisa'),
  takeaways: z.array(z.string().max(500)).max(10).optional()
    .describe('Conclusões/aprendizados curtos extraídos do item (até 10)'),
  pipeline_item_id: z.string().uuid().optional()
    .describe('Pipeline item UUID (for link/unlink)'),
  link_id: z.string().uuid().optional()
    .describe('Link UUID (for unlink action)'),
  note: z.string().max(500).optional()
    .describe('Note on the research-pipeline link'),
  items: z.array(z.object({
    title: z.string().max(500),
    topic_slug: z.string().max(200),
    content_md: z.string().max(500_000),
    summary: z.string().max(2000).optional(),
    sources: z.array(z.object({
      url: z.string().url(),
      title: z.string().max(200),
      accessed_at: z.string().datetime().optional(),
    })).max(50).default([]),
  })).max(50).optional()
    .describe('Array of research items for import (max 50)'),
  topic_id: z.string().uuid().optional()
    .describe('Topic UUID (for update_topic/delete_topic)'),
  name: z.string().max(100).optional()
    .describe('Topic display name'),
  slug: z.string().max(100).optional()
    .describe('Topic URL slug (lowercase kebab-case)'),
  parent_id: z.string().uuid().optional()
    .describe('Parent topic UUID (max depth 3)'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
    .describe('Hex color (e.g. #a78bfa)'),
  icon: z.string().max(10).optional()
    .describe('Emoji icon'),
  sort_order: z.number().int().optional()
    .describe('Display order among siblings'),
  confirm: z.boolean().optional()
    .describe('Required for delete and delete_topic'),
  confirmation_token: z.string().optional()
    .describe('Token from dry_run for delete actions'),
  dry_run: z.boolean().default(false)
    .describe('Preview changes without executing'),
}

// ---- 21. manage_decisions ----
//
// Decisões estratégicas: "você decide, o Cowork registra/atualiza". O Cowork
// nunca decide sozinho — ele documenta a decisão do dono e a conecta às
// pesquisas (research items) que a embasaram.
const ManageDecisionsShape = {
  action: z.enum(['list', 'get', 'create', 'update', 'archive', 'link_research', 'unlink_research'])
    .describe('list: decisões com filtros (horizon/status/theme). get: uma decisão com suas fontes. create: registra uma decisão tomada pelo dono. update: ajusta campos de uma decisão. archive: marca como arquivada (status:arquivado). link_research: conecta uma pesquisa como fonte. unlink_research: remove a fonte.'),
  id: z.string().uuid().optional()
    .describe('UUID da decisão (obrigatório para get/update/archive/link_research/unlink_research)'),
  // ── filters (list) ──
  horizon: z.enum(['agora', 'proximo', 'explorar']).optional()
    .describe('Horizonte estratégico — agora: foco imediato (próximos meses). proximo: a seguir. explorar: apostas e backlog. No create/update define o horizonte da decisão; no list filtra por ele.'),
  // 'arquivado' is intentionally NOT a value here: archiving goes through the
  // dedicated `archive` action (dry_run + confirmation_token gate). Allowing
  // status:'arquivado' via plain create/update would bypass that gate.
  status: z.enum(['decidido', 'testando', 'revisar']).optional()
    .describe('Status — decidido: decisão firmada. testando: em teste. revisar: precisa revisar. No create/update define o status; no list filtra por ele. Para arquivar use a ação archive.'),
  theme_id: z.enum(['asia', 'ia', 'dev', 'games', 'grana', 'canal']).optional()
    .describe('Tema estratégico (asia, ia, dev, games, grana, canal). No create/update marca o tema da decisão; no list filtra por ele.'),
  limit: z.number().int().min(1).max(100).default(50)
    .describe('Máximo de resultados (list)'),
  offset: z.number().int().min(0).optional()
    .describe('Deslocamento para paginação (list)'),
  // ── create / update fields (mirror ResearchDecisionCreate/UpdateSchema) ──
  title: z.string().min(1).max(500).optional()
    .describe('Título curto da decisão (obrigatório no create)'),
  rationale: z.string().max(5000).nullable().optional()
    .describe('Racional: por que essa decisão foi tomada'),
  date_label: z.string().max(50).nullable().optional()
    .describe('Rótulo de data legível (ex.: "Q2 2026", "jun/26")'),
  drives: z.array(z.string().max(100)).max(10).optional()
    .describe('O que essa decisão impulsiona/habilita (lista curta de drivers)'),
  // ── decision fullscreen detail fields (mirror ResearchDecisionCreate/UpdateSchema) ──
  context: z.string().max(5000).nullable().optional()
    .describe('Contexto: o cenário/pano de fundo que levou à decisão'),
  consequences: z.array(z.string().max(500)).max(20).optional()
    .describe('Consequências/trade-offs assumidos com a decisão (até 20)'),
  metric: z.string().max(500).nullable().optional()
    .describe('Métrica de sucesso — como saberemos que a decisão deu certo'),
  revisit: z.string().max(100).nullable().optional()
    .describe('Quando revisitar a decisão (ex.: "Q3 2026")'),
  history: z.array(z.object({
    label: z.string().max(100),
    date: z.string().max(50),
    note: z.string().max(1000).nullable().optional(),
  })).max(50).optional()
    .describe('Histórico de mudanças de status da decisão (até 50 entradas)'),
  source_research_ids: z.array(z.string().uuid()).max(20).optional()
    .describe('UUIDs de research items que embasaram a decisão (sincronizados na junção)'),
  source_notes: z.record(z.string().uuid(), z.string().max(500)).optional()
    .describe('Notas opcionais por research_id explicando como cada fonte pesou'),
  // ── link / unlink research ──
  research_id: z.string().uuid().optional()
    .describe('UUID do research item (para link_research/unlink_research)'),
  note: z.string().max(500).optional()
    .describe('Nota opcional sobre a conexão decisão↔pesquisa (para link_research)'),
  // ── safety ──
  dry_run: z.boolean().default(false)
    .describe('Pré-visualiza a mudança sem executar'),
  confirmation_token: z.string().optional()
    .describe('Token retornado por um dry_run anterior (para confirmar archive)'),
}

// ---- 22. manage_focos ----
//
// Foco estratégico do momento: "você decide, o Cowork propõe". O Cowork pode
// PROPOR um foco (state:proposto), mas só o dono ATIVA. Há no máximo um foco
// ativo por site — a ativação é atômica via RPC activate_research_foco, que
// rebaixa o foco ativo anterior. O Cowork nunca ativa sem confirmação.
const ManageFocosShape = {
  action: z.enum(['list', 'get', 'get_active', 'create', 'update', 'save_full', 'propose', 'activate', 'archive', 'link_research', 'unlink_research'])
    .describe('list: focos com filtro de estado. get: um foco com temas/pesquisas. get_active: o foco ativo atual (único). create: cria foco (inativo). update: ajusta campos. save_full: upsert atômico + diff-sync de temas e pesquisas. propose: o Cowork propõe um foco (state:proposto) para o dono avaliar. activate: promove a único foco ativo, rebaixando o anterior (alto impacto — exige confirmação). archive: arquiva e desativa. link_research/unlink_research: fixa/remove uma pesquisa.'),
  id: z.string().uuid().optional()
    .describe('UUID do foco (obrigatório para get/update/activate/archive/link_research/unlink_research)'),
  // ── filter (list) ──
  state: z.enum(['ativo', 'proposto', 'rascunho', 'arquivado']).optional()
    .describe('Estado — ativo: foco vigente. proposto: sugerido pelo Cowork, aguardando o dono. rascunho: em elaboração. arquivado: encerrado. No create/update define o estado; no list filtra por ele.'),
  limit: z.number().int().min(1).max(100).default(50)
    .describe('Máximo de resultados (list)'),
  offset: z.number().int().min(0).optional()
    .describe('Deslocamento para paginação (list)'),
  // ── create / update fields (mirror ResearchFocoCreate/UpdateSchema) ──
  title: z.string().min(1).max(300).optional()
    .describe('Título do foco (obrigatório no create/save_full/propose)'),
  description: z.string().max(3000).nullable().optional()
    .describe('Descrição do foco (markdown)'),
  rationale: z.string().max(3000).nullable().optional()
    .describe('Racional: por que esse é o foco do momento'),
  metric: z.string().max(500).nullable().optional()
    .describe('Métrica de sucesso — como saberemos que o foco avançou'),
  window_label: z.string().max(100).nullable().optional()
    .describe('Janela temporal legível (ex.: "junho/2026")'),
  horizon: z.enum(['agora', 'proximo', 'explorar']).optional()
    .describe('Horizonte — agora: imediato. proximo: a seguir. explorar: apostas/exploração.'),
  theme_ids: z.array(z.enum(['asia', 'ia', 'dev', 'games', 'grana', 'canal'])).max(6).optional()
    .describe('Temas estratégicos do foco (até 6: asia, ia, dev, games, grana, canal)'),
  pinned_research_ids: z.array(z.string().uuid()).max(30).optional()
    .describe('UUIDs de research items fixados neste foco (sincronizados na junção)'),
  pinned_notes: z.record(z.string().uuid(), z.string().max(500)).optional()
    .describe('Notas opcionais por research_id explicando por que cada pesquisa foi fixada'),
  // ── link / unlink research ──
  research_id: z.string().uuid().optional()
    .describe('UUID do research item (para link_research/unlink_research)'),
  note: z.string().max(500).optional()
    .describe('Nota opcional sobre a conexão foco↔pesquisa (para link_research)'),
  // ── safety ──
  dry_run: z.boolean().default(false)
    .describe('Pré-visualiza a mudança sem executar'),
  confirmation_token: z.string().optional()
    .describe('Token retornado por um dry_run anterior (obrigatório para confirmar activate)'),
}

// ---- 23. manage_links ----
//
// Links engine: cria e gerencia short links rastreáveis (go-links). Cada link
// resolve em /go/{code} (ou no domínio curto configurado). O Cowork pode criar
// links autonomamente para campanhas, com UTMs, e arquivá-los (soft, active=false).
const ManageLinksShape = {
  action: z.enum(['list', 'get', 'create', 'update', 'archive'])
    .describe('list: links com filtros (utm_campaign/active/search). get: um link por UUID. create: cria short link rastreável (code auto-gerado se omitido). update: ajusta campos. archive: desativa (active=false, soft — o link para de resolver mas é retido).'),
  id: z.string().uuid().optional()
    .describe('UUID do link (obrigatório para get/update/archive)'),
  // ── filter (list) ──
  search: z.string().max(255).optional()
    .describe('Busca por título ou code (list)'),
  active: z.boolean().optional()
    .describe('Filtra por status ativo (list); no update define o status'),
  limit: z.number().int().min(1).max(200).default(50)
    .describe('Máximo de resultados (list)'),
  offset: z.number().int().min(0).optional()
    .describe('Deslocamento para paginação (list)'),
  // ── create / update fields (mirror tracked_links / CreateLinkSchema) ──
  destination_url: z.string().url().optional()
    .describe('URL de destino para onde o link redireciona (obrigatório no create)'),
  title: z.string().max(500).nullable().optional()
    .describe('Título legível do link'),
  code: z.string().max(64).optional()
    .describe('Code curto desejado (único por site; auto-gerado se omitido). O link resolve em /go/{code}'),
  slug: z.string().max(255).nullable().optional()
    .describe('Slug opcional alternativo ao code'),
  redirect_type: z.enum(['301', '302', '307', '308']).optional()
    .describe('Tipo de redirect HTTP (default 307)'),
  utm_source: z.string().max(255).optional()
    .describe('UTM source (normalizado)'),
  utm_medium: z.string().max(255).optional()
    .describe('UTM medium (normalizado)'),
  utm_campaign: z.string().max(255).optional()
    .describe('UTM campaign (normalizado); também usado como filtro no list'),
  utm_term: z.string().max(255).optional()
    .describe('UTM term (normalizado)'),
  utm_content: z.string().max(255).optional()
    .describe('UTM content (normalizado)'),
  utm_id: z.string().max(255).optional()
    .describe('UTM id (normalizado)'),
  tags: z.array(z.string()).optional()
    .describe('Tags livres para organização'),
  expires_at: z.string().datetime().nullable().optional()
    .describe('ISO datetime de expiração (opcional)'),
  activates_at: z.string().datetime().nullable().optional()
    .describe('ISO datetime de ativação agendada (opcional)'),
  pass_click_ids: z.boolean().optional()
    .describe('Repassar click IDs (gclid/fbclid) ao destino (default true)'),
  // ── safety ──
  dry_run: z.boolean().default(false)
    .describe('Pré-visualiza a mudança sem executar'),
}

// ---- 24. manage_recording ----
//
// Recording status (gravação por beat): rastreia o que já está "na lata" por beat
// (unidade durável) e por idioma. 3 estados: pendente | gravada | refazer (+ nota
// de retake). Cada GET reconcilia os beats `fala` atuais do roteiro contra o
// ledger durável (pipeline_id, lang, beat_id) e sinaliza `stale` quando o roteiro
// mudou desde a gravação ("roteiro mudou desde a gravação"). NÃO altera a versão
// do item (não passa pelo published-freeze do roteiro). O Cowork pode marcar/reler
// status e purgar órfãos, mas a decisão editorial é do dono.
const ManageRecordingShape = {
  action: z.enum(['read', 'set', 'batch', 'purge-orphans']).default('read')
    .describe('read: beats reconciliados + órfãos para (item, lang). set: define o status de um beat. batch: upsert de vários beats. purge-orphans: remove linhas cujo beat_id sumiu do roteiro atual (recomputado no servidor).'),
  item_id: z.string().uuid()
    .describe('UUID do pipeline item (vídeo). Obrigatório.'),
  lang: z.enum(['pt', 'en']).default('pt')
    .describe('Idioma do roteiro a reconciliar (pt | en).'),
  beat_id: z.string().min(1).optional()
    .describe('ID estável do beat (para set). Obtido no read.'),
  status: z.enum(['pendente', 'gravada', 'refazer']).optional()
    .describe('pendente: ainda não gravado. gravada: na lata. refazer: gravado mas precisa de retake. (para set)'),
  retake_note: z.string().max(500).optional()
    .describe('Nota livre de retake (apenas quando status=refazer; ≤500 chars).'),
  beat_name: z.string().max(500).optional()
    .describe('Nome de exibição do beat (ajuda na reconciliação/leitura).'),
  content_hash: z.string().max(64).optional()
    .describe('Hash do texto performático do beat no momento da gravação (detecta "mudou desde a gravação"). Pegue o content_hash do read.'),
  if_unmodified_since: z.string().datetime().optional()
    .describe('ISO datetime — concorrência por linha: se a linha existente for mais nova, retorna 412 com a linha atual (para set).'),
  updates: z.array(z.object({
    beat_id: z.string().min(1),
    status: z.enum(['pendente', 'gravada', 'refazer']),
    retake_note: z.string().max(500).optional(),
    beat_name: z.string().max(500).optional(),
    content_hash: z.string().max(64).optional(),
  })).max(100).optional()
    .describe('Lista de updates para batch (máx 100).'),
  dry_run: z.boolean().default(false)
    .describe('Pré-visualiza a mudança sem executar (para set/batch/purge-orphans).'),
}

// ---- 15. manage_ab_test ----
const ManageAbTestShape = {
  action: z.enum(['list_tests', 'get_test', 'get_funnel', 'get_performance', 'get_intelligence', 'list_variants', 'upsert_variants', 'delete_variant', 'submit_intelligence', 'claim_task', 'get_learnings', 'get_suggestions', 'get_fatigue_alerts', 'get_dashboard', 'get_history'])
    .describe('list_tests: all A/B tests with optional status filter. get_test: single test details with variants+cycles. get_funnel: funnel metrics per variant. get_performance: winning patterns from completed tests. get_intelligence: channel intelligence snapshot. list_variants: variants for a test. upsert_variants: create/update variants. delete_variant: remove non-original variant. submit_intelligence: submit Cowork recommendations for a running task. claim_task: claim the next pending intelligence task. get_learnings: tag win rates and channel insights from completed tests. get_suggestions: suggested videos for testing. get_fatigue_alerts: pending CTR fatigue alerts. get_dashboard: aggregate dashboard stats. get_history: test history for a video.'),
  test_id: z.string().uuid().optional()
    .describe('A/B test UUID (required for get_test, get_funnel, list_variants, upsert_variants, delete_variant)'),
  channel_id: z.string().uuid().optional()
    .describe('YouTube channel UUID (required for get_intelligence)'),
  video_id: z.string().optional()
    .describe('YouTube video ID string (required for get_history)'),
  status: z.string().optional()
    .describe('Filter for list_tests (e.g. "active", "draft", "completed")'),
  variants: z.array(z.object({
    label: z.enum(['B', 'C', 'D'])
      .describe('B: first alternative. C: second alternative. D: third alternative.'),
    title_text: z.string().max(200).nullable().optional(),
    description_text: z.string().max(5000).nullable().optional(),
    metadata: z.object({
      thumbnail_tags: z.array(z.string().max(50)).max(10).optional(),
      title_pattern: z.string().max(200).optional(),
      emotional_triggers: z.array(z.string().max(50)).max(10).optional(),
      visual_description: z.string().max(2000).optional(),
      ai_image_prompt: z.string().max(1000).optional(),
      creative_direction: z.string().max(2000).optional(),
      rationale: z.string().max(1000).optional(),
    }).nullable().optional(),
  })).min(1).max(3).optional()
    .describe('Variants to upsert (for upsert_variants action, max 3)'),
  variant_label: z.enum(['B', 'C', 'D']).optional()
    .describe('Variant label to delete (cannot delete original A)'),
  intel_payload: z.record(z.unknown()).optional()
    .describe('Intelligence recommendations payload (for submit_intelligence action). Must include task_id and optional video_recommendations, coaching, notifications, channel_insights.'),
  confirm: z.boolean().optional()
    .describe('Required for delete_variant'),
  dry_run: z.boolean().default(false)
    .describe('Preview changes without executing'),
}

// ---- 16. search_content ----
const SearchContentShape = {
  q: z.string().max(500)
    .describe('Search query text'),
  entity: z.enum(['items', 'posts', 'newsletters', 'research', 'audio', 'broll', 'all']).default('all')
    .describe('items: pipeline items. posts: blog posts. newsletters: editions. research: research items. audio: audio library. broll: B-roll library. all: search everything.'),
  format: z.enum(['video', 'blog_post', 'newsletter', 'course', 'campaign']).optional()
    .describe('Filter by item format (applies when entity is "items" or "all")'),
  stage: z.string().optional()
    .describe('Filter by workflow stage'),
  tags: z.array(z.string()).optional()
    .describe('Filter by tags (AND logic)'),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional()
    .describe('Pagination cursor from previous response'),
}

// ---- 17. youtube_observatory ----
const YoutubeObservatoryShape = {
  action: z.enum(['list_channels', 'get_changes', 'get_outliers', 'get_insights'])
    .describe('list_channels: tracked competitor channels. get_changes: recent title/thumbnail/description changes. get_outliers: bookmarked notable changes. get_insights: aggregated competitor intelligence.'),
  channel_id: z.string().uuid().optional()
    .describe('Competitor channel UUID (filters get_changes and get_outliers)'),
  limit: z.number().int().min(1).max(100).default(50)
    .describe('Max results for get_changes'),
}

// ---- 18. youtube_analytics ----
const YoutubeAnalyticsShape = {
  action: z.enum(['get_overview', 'get_grades', 'get_demographics', 'get_search_terms', 'get_notes'])
    .describe('get_overview: channel summary + recent videos. get_grades: 6-axis performance grades per video. get_demographics: audience demographics. get_search_terms: top search terms. get_notes: channel notes/annotations.'),
  channel_id: z.string().uuid().optional()
    .describe('YouTube channel UUID (required for get_grades, get_demographics, get_search_terms, get_notes)'),
}

// ---- 19. youtube_videos ----
const YoutubeVideosShape = {
  action: z.enum(['list', 'get', 'list_categories'])
    .describe('list: browse videos with pagination. get: single video with full details + grade. list_categories: all video categories.'),
  video_id: z.string().uuid().optional()
    .describe('YouTube video UUID (required for get action)'),
  channel_id: z.string().uuid().optional()
    .describe('Filter by channel (for list action)'),
  category_id: z.string().uuid().optional()
    .describe('Filter by category (for list action)'),
  limit: z.number().int().min(1).max(100).default(50)
    .describe('Max results for list'),
  cursor: z.string().optional()
    .describe('Pagination cursor (published_at of last item)'),
}

// ---- 20. manage_upnext ----
const ManageUpNextShape = {
  action: z.enum(['get', 'assign'])
    .describe('get: retrieve command center data (today actions, week grid, streak, suggestions). assign: place a pipeline item into a week slot.'),
  day: z.string().optional()
    .describe('ISO date (YYYY-MM-DD) of the slot to assign (for assign action)'),
  slot_index: z.number().int().min(0).optional()
    .describe('Index of the slot within the day (for assign action)'),
  item_id: z.string().uuid().nullable().optional()
    .describe('Pipeline item UUID to assign (null to clear slot)'),
  dry_run: z.boolean().default(false)
    .describe('Preview assignment without executing'),
}

// ---------------------------------------------------------------------------
// Tool annotations — hints for LLM tool-use planning
// ---------------------------------------------------------------------------

const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false } as const
const WRITE_IDEMPOTENT = { readOnlyHint: false, destructiveHint: false, idempotentHint: true } as const
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: false } as const
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true } as const

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerTools(server: McpServer): void {
  // 1. create_item
  server.tool(
    'create_item',
    'Get-or-create a pipeline item (video, blog_post, newsletter, course, campaign). IDEMPOTENT by story identity: if a NON-archived item with the same title (case-insensitive, scoped to the same site + format) already exists, this RETURNS THAT EXISTING item instead of creating a duplicate — one story = one id. To change an existing story use update_item / manage_sections on its id; do NOT call create_item again expecting a fresh id or a "variant"/"version". Search first with search_content if unsure whether the story exists. The result meta marks resolved vs created.',
    CreateItemShape,
    WRITE,
    async (params) => itemsService.createItem(params),
  )

  // 2. update_item
  server.tool(
    'update_item',
    'Update fields on an existing pipeline item. Version is managed automatically by the server.',
    UpdateItemShape,
    WRITE_IDEMPOTENT,
    async (params) => itemsService.updateItem(params),
  )

  // 3. advance_item
  server.tool(
    'advance_item',
    'Move a pipeline item forward or backward through its workflow stages. Supports dry_run to preview.',
    AdvanceItemShape,
    WRITE,
    async (params) => itemsService.advanceItem(params),
  )

  // 4. manage_sections
  server.tool(
    'manage_sections',
    'Read/write content sections on pipeline items. action:get reads; action:update writes ' +
      '(optimistic concurrency is handled automatically — NEVER send a `rev`). Most sections accept ' +
      'free markdown/JSON. Typed VIDEO sections require an EXACT strict JSON shape (no extra keys); ' +
      'derive them from the `roteiro` section (read it with action:get first):\n' +
      '• postprod (Pós brief): {"kind":"brief","deliverables":{"editor","deadline","turnaround","drive","energy","notes"(free-text delivery scope),"references":[]},"style":[{"k","v"}],"ctas":{"note","rows":[{"k","pt","en"}],"display"}}\n' +
      '• publish (A/B, from-scratch): {"firstOnAir":"A","variants":[{"id":"A","role":"challenger","title","brief"}, …exactly 4: A,B,C,D]} — each variant = a testable title + a thumbnail brief (text only)\n' +
      '• ideia (shared): {"title","direction","logline","angles","framework","siblings":[]}',
    ManageSectionsShape,
    WRITE,
    async (params) => sectionsService.manageSections(params),
  )

  // 5. delete_item
  server.tool(
    'delete_item',
    'Archive a pipeline item (soft delete). Requires confirm:true or a confirmation_token from a prior dry_run.',
    DeleteItemShape,
    DESTRUCTIVE,
    async (params) => itemsService.deleteItem(params),
  )

  // 6. graduate_item
  server.tool(
    'graduate_item',
    'Promote a pipeline item to a concrete entity (blog post, newsletter edition, campaign, or course playlist).',
    GraduateItemShape,
    DESTRUCTIVE,
    async (params) => itemsService.graduateItem(params),
  )

  // 7. publish_item
  server.tool(
    'publish_item',
    'Make a graduated content item live or schedule it for future publication. Enforces VVS gate.',
    PublishItemShape,
    DESTRUCTIVE,
    async (params) => itemsService.publishItem(params),
  )

  // 8. bulk_items
  server.tool(
    'bulk_items',
    'Execute batch operations (advance, retreat, archive, restore, update, tag) on up to 50 pipeline items.',
    BulkItemsShape,
    DESTRUCTIVE,
    async (params) => itemsService.bulkItems(params),
  )

  // 9. manage_playlist
  server.tool(
    'manage_playlist',
    'Create, update, delete, reorder, or auto-layout a playlist. Delete cascades items and edges.',
    ManagePlaylistShape,
    WRITE,
    async (params) => playlistsService.managePlaylist(params),
  )

  // 10. manage_edges
  server.tool(
    'manage_edges',
    'Create, delete, or bulk-create directed edges between playlist items. Cycle-safe DAG validation.',
    ManageEdgesShape,
    WRITE,
    async (params) => edgesService.manageEdges(params),
  )

  // 11. manage_audio
  server.tool(
    'manage_audio',
    'Create, update, retire, import, or resolve audio assets (music and SFX) in the production library.',
    ManageAudioShape,
    WRITE,
    async (params) => audioService.manageAudio(params),
  )

  // 12. match_audio
  server.tool(
    'match_audio',
    'Find audio assets matching mood, tempo, energy, and context criteria. Returns ranked results.',
    MatchAudioShape,
    READ_ONLY,
    async (params) => audioService.matchAudio(params),
  )

  // 13. manage_broll
  server.tool(
    'manage_broll',
    'Create, update, retire, or import B-roll video clips and assets in the production library.',
    ManageBrollShape,
    WRITE,
    async (params) => brollService.manageBroll(params),
  )

  // 14. manage_research
  server.tool(
    'manage_research',
    'Manage research items and hierarchical topics. Link research to pipeline items for traceability.',
    ManageResearchShape,
    WRITE,
    async (params) => researchService.manageResearch(params),
  )

  // 21. manage_decisions
  server.tool(
    'manage_decisions',
    'Registra e mantém as decisões estratégicas do dono (você decide, o Cowork documenta): list/get/create/update/archive e conecta cada decisão às pesquisas que a embasaram (link_research/unlink_research).',
    ManageDecisionsShape,
    DESTRUCTIVE,
    async (params) => decisionsService.manageDecisions(params),
  )

  // 22. manage_focos
  server.tool(
    'manage_focos',
    'Gerencia o foco estratégico do momento (você decide, o Cowork propõe): list/get/get_active/create/update/save_full e propose (Cowork sugere). activate promove a único foco ativo, rebaixando o anterior via RPC activate_research_foco e exigindo confirmação. archive encerra. link_research/unlink_research fixam pesquisas.',
    ManageFocosShape,
    DESTRUCTIVE,
    async (params) => focosService.manageFocos(params),
  )

  // 23. manage_links
  server.tool(
    'manage_links',
    'Gerencia o Links engine (short links rastreáveis / go-links): list/get/create/update/archive. create gera um link que resolve em /go/{code} (code auto-gerado se omitido), com UTMs opcionais. archive desativa (soft, active=false). O Cowork pode criar links autonomamente para campanhas.',
    ManageLinksShape,
    WRITE_IDEMPOTENT,
    async (params) => linksService.manageLinks(params),
  )

  // 24. manage_recording
  server.tool(
    'manage_recording',
    'Rastreia o status de gravação por beat (gravação por beat): read reconcilia os beats fala atuais do roteiro contra o ledger durável e sinaliza beats com "roteiro mudou desde a gravação"; set/batch marcam pendente|gravada|refazer (+ nota de retake); purge-orphans remove linhas órfãs. Nunca altera a versão do item.',
    ManageRecordingShape,
    WRITE_IDEMPOTENT,
    async (params) => recordingService.manageRecording(params),
  )

  // 15. manage_ab_test
  server.tool(
    'manage_ab_test',
    'Manage A/B tests: list tests, get details, upsert/delete variants, view learnings, suggestions, fatigue alerts, dashboard stats, and video test history.',
    ManageAbTestShape,
    WRITE_IDEMPOTENT,
    async (params) => abTestService.manageAbTest(params),
  )

  // 16. search_content
  server.tool(
    'search_content',
    'Full-text search across pipeline items, blog posts, newsletters, research, audio, and B-roll.',
    SearchContentShape,
    READ_ONLY,
    async (params) => searchService.searchContent(params),
  )

  // 17. youtube_observatory
  server.tool(
    'youtube_observatory',
    'Track competitor YouTube channels: list tracked channels, view title/thumbnail changes, get outliers, and aggregate intelligence.',
    YoutubeObservatoryShape,
    READ_ONLY,
    async (params) => observatoryService.youtubeObservatory(params),
  )

  // 18. youtube_analytics
  server.tool(
    'youtube_analytics',
    'YouTube channel analytics: overview, 6-axis video grades, demographics, search terms, and channel notes.',
    YoutubeAnalyticsShape,
    READ_ONLY,
    async (params) => analyticsService.youtubeAnalytics(params),
  )

  // 19. youtube_videos
  server.tool(
    'youtube_videos',
    'Browse and inspect YouTube videos: paginated list, single video detail with grades, and video categories.',
    YoutubeVideosShape,
    READ_ONLY,
    async (params) => videosService.youtubeVideos(params),
  )

  // 20. manage_upnext
  server.tool(
    'manage_upnext',
    'Get the command center (today actions, week grid, streak) or assign a pipeline item to a week slot.',
    ManageUpNextShape,
    WRITE,
    async (params) => upNextService.manageUpNext(params),
  )
}
