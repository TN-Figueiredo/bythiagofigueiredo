# YouTube Cowork MCP Integration — Implementation Plan

**Generated:** 2026-06-03
**Goal:** Expor dados do YouTube via MCP/Pipeline para o Cowork ler, analisar, e escrever diagnósticos

---

## Estado Atual

O MCP já tem **17 tools + 11 resources + 8 prompts**. Para YouTube, já existem:
- `manage_ab_test` tool (list/get/upsert/delete variants + intelligence claim/submit)
- `youtube-intelligence` resource (channel snapshot)
- `youtube-ab-performance` resource (winning patterns)
- `ab-ideate/write/review` prompts
- Pipeline docs: `cowork-docs-youtube.md` (13KB)

**O que falta (identificado pelos 14 agentes):**

---

## Fase 1 — Leitura de Dados (Resources) ~16h

### 1A. Competitor Observatory Resources (4 novos endpoints)

| Resource | Endpoint | Dados |
|----------|----------|-------|
| `competitors/channels` | GET | Lista 15 canais com stats, engagement, crescimento |
| `competitors/changes` | GET `?type=&bookmarked=` | Mudanças de thumbnail/título/descrição detectadas |
| `competitors/outliers` | GET `?tier=` | Vídeos outlier com multiplier, filtráveis por tier |
| `competitors/insights` | GET | Play-of-week, cadence, fórmulas, heatmap, tags, gaps, engagement |

**Implementação:** Adicionar ao `pipeline/services/youtube.ts` + criar rotas em `api/pipeline/youtube/competitors/`. Reutilizar as queries de `competitors/page.tsx`.

### 1B. Performance Resources (5 novos endpoints)

| Resource | Endpoint | Dados |
|----------|----------|-------|
| `analytics/overview` | GET `?channelId=&days=28` | Health score 6-eixos, KPIs, baseline |
| `analytics/grades` | GET `?channelId=` | Todos os vídeos com score/grade/trend + top5/bottom5 |
| `analytics/demographics` | GET `?channelId=&days=28` | Idade, gênero, países, dispositivos |
| `analytics/search-terms` | GET `?channelId=&days=28` | Top 25 termos de busca |
| `analytics/notes` | GET `?channelId=` | Notas humanas + bot do canal |

### 1C. Video & Channel Resources (3 novos endpoints)

| Resource | Endpoint | Dados |
|----------|----------|-------|
| `videos` | GET `?channelId=&category=&limit=50` | Lista de vídeos com métricas |
| `videos/{id}` | GET | Detalhe completo: 6-eixos, retention curve, traffic sources, optimization cycle |
| `categories` | GET | Categorias com match_keywords e video counts |

### 1D. AB Lab Resources (5 novos endpoints)

| Resource | Endpoint | Dados |
|----------|----------|-------|
| `ab-tests/learnings` | GET | Tag win rates, channel-level insights |
| `ab-tests/suggestions` | GET | Vídeos underperforming com sugestão de teste |
| `ab-tests/fatigue-alerts` | GET | Alertas de fadiga de thumbnail pendentes |
| `ab-tests/dashboard` | GET | Stats: testes ativos, avg confidence, win rate, avg lift |
| `ab-tests/{id}/history` | GET | Histórico de testes de um vídeo específico |

### 1E. Thumbnail Library (2 novos endpoints)

| Resource | Endpoint | Dados |
|----------|----------|-------|
| `thumbnails/library` | GET | Biblioteca com lift/tags/longevity |
| `thumbnails/fatigue` | GET | Alertas de fadiga pendentes + longevity trends |

**Total Fase 1: ~19 novos endpoints read-only**

---

## Fase 2 — Escrita de Dados (Tools) ~12h

### 2A. Notes Tool
- `youtube_create_note(channelId, text)` — cria nota bot (is_bot=true, source='cowork')
- Usa `getSupabaseServiceClient()` direto (não passa pelo auth de user)

### 2B. Health Coach Tool (já existe parcialmente)
O pipeline para coaching JÁ FUNCIONA:
1. `claim_task` → pega tarefa pendente
2. `get_intelligence` → lê snapshot do canal
3. `submit_intelligence` com `coaching.priorities[]` → escreve diagnóstico por eixo

**O que falta:** O frontend ler o coaching salvo e exibir `source: 'cowork'` ao invés de `source: 'fallback'`. Isso é uma mudança em `yt-analytics-tabs.tsx` (~20 linhas).

### 2C. Category/Tag Management Tool
- `youtube_set_category(videoId, categoryId)` — atribui categoria a um vídeo
- `youtube_update_keywords(categoryId, keywords[])` — atualiza match_keywords de uma categoria
- `youtube_bulk_recategorize()` — re-roda auto-categorize nos vídeos sem categoria

### 2D. Competitor Management Tool
- `competitor_add_channel(youtubeChannelId)` — track novo competidor
- `competitor_sync(channelId)` — trigger sync imediato
- `competitor_toggle_bookmark(changeId)` — marcar mudança como importante

### 2E. Notification Tool
- `youtube_notify(type, title, message, videoId?, actionHref?)` — cria notificação via `fanOutToSiteAdmins`

---

## Fase 3 — Instruções para o Cowork ~4h

### 3A. Atualizar `cowork-docs-youtube.md`

Adicionar seções documentando:
1. **Competitor Observatory** — como ler canais, mudanças, outliers, insights
2. **Performance Analysis** — como ler health score, grades, demographics, search terms
3. **Health Coach Workflow** — claim → read → diagnose → submit coaching
4. **Notes System** — como criar bot notes com análises
5. **Category Management** — como categorizar vídeos e melhorar keywords
6. **Thumbnail Analysis** — como ler biblioteca e alertas de fadiga

### 3B. Criar novo prompt MCP: `youtube-analyst`

Prompt que recebe `channelId` e gera uma análise completa:
- Lê overview + grades + demographics + search terms + competitor insights
- Produz: diagnóstico Health Coach + notas + sugestões de testes A/B + gaps de conteúdo
- Formato: structured JSON que pode ser patchado via `submit_intelligence`

### 3C. Criar novo prompt MCP: `competitor-report`

Prompt que gera relatório de competidores:
- Lê todos os dados do observatory
- Produz: play-of-week analysis, title formula recommendations, gaps prioritizados, timing recommendations

---

## Fase 4 — Wiring Frontend ~4h

### 4A. Health Coach lê coaching do DB

Em `yt-analytics-tabs.tsx`, antes de usar `COACHING_DIAGNOSTICS` estático:
1. Query `youtube_intelligence` para coaching data do canal
2. Se `source: 'cowork'` existe e é recente (< 7 dias), usar em vez do fallback
3. Mostrar timestamp "Atualizado pelo Cowork há X"

### 4B. Insights "Montar roteiro" habilita com Cowork

Os 2 botões disabled ("Montar roteiro", "Roteirizar lacunas") ficam enabled quando Cowork está disponível via MCP. O click cria um pipeline item + chama o prompt `youtube-analyst` com o contexto.

---

## Resumo de Esforço

| Fase | Horas | Items |
|------|-------|-------|
| 1 — Resources (read) | ~16h | 19 endpoints |
| 2 — Tools (write) | ~12h | 8 tools |
| 3 — Instructions + Prompts | ~4h | 2 docs + 2 prompts |
| 4 — Frontend wiring | ~4h | Health Coach + Insights |
| **Total** | **~36h** | |

## Prioridade de Implementação

```
1. Health Coach pipeline (Fase 2B + 4A) — impacto imediato, 80% já funciona
   ↓
2. Competitor Resources (Fase 1A) — dados mais ricos e únicos
   ↓
3. Performance Resources (Fase 1B) — análise do próprio canal
   ↓
4. Video/Channel Resources (Fase 1C) — detalhe individual
   ↓
5. AB Lab Resources (Fase 1D) — learnings e sugestões
   ↓
6. Write Tools (Fase 2A-E) — ações que Cowork pode executar
   ↓
7. Instructions + Prompts (Fase 3) — orquestração completa
   ↓
8. Frontend wiring (Fase 4B) — botões habilitados
```

## Arquitetura

Todos os novos endpoints seguem o padrão existente:
- Route: `apps/web/src/app/api/pipeline/youtube/{domain}/route.ts`
- Service: `apps/web/src/lib/pipeline/services/youtube.ts` (adicionar funções)
- Registry: `apps/web/src/lib/pipeline/api-registry.ts` (adicionar entries)
- Docs: `apps/web/data/pipeline-docs/cowork-docs-youtube.md` (atualizar)
- Auth: `X-Pipeline-Key` header (chave permanente, já configurada)

Nenhuma migration necessária — todos os dados já existem nas tabelas.

---

## Apendice A — MCP Tool Schemas (Fase 2)

Exact `inputSchema` for each new tool, following the existing flat-shape pattern with `action` enum.

### A1. `youtube_observatory` tool

```json
{
  "name": "youtube_observatory",
  "description": "Read competitor observatory data: tracked channels, title/thumbnail changes, outlier videos, and strategic insights.",
  "annotations": { "readOnlyHint": true, "destructiveHint": false, "idempotentHint": true }
}
```

Zod shape:

```ts
const YoutubeObservatoryShape = {
  action: z.enum(['list_channels', 'get_changes', 'get_outliers', 'get_insights'])
    .describe('list_channels: all tracked competitors with stats. get_changes: detected title/thumb/desc changes. get_outliers: videos performing above baseline. get_insights: play-of-week, cadence, formulas, gaps.'),
  channel_id: z.string().uuid().optional()
    .describe('Filter to a specific competitor channel (optional for get_changes, get_outliers)'),
  type: z.enum(['thumbnail', 'title', 'description', 'all']).default('all')
    .describe('Change type filter (for get_changes)'),
  bookmarked: z.boolean().optional()
    .describe('Only bookmarked changes (for get_changes)'),
  tier: z.enum(['S', 'A', 'B', 'all']).default('all')
    .describe('Outlier tier filter (for get_outliers): S = 10x+, A = 5-10x, B = 2-5x'),
  limit: z.number().int().min(1).max(100).default(25)
    .describe('Max results per page'),
  cursor: z.string().optional()
    .describe('Pagination cursor from previous response'),
}
```

### A2. `youtube_analytics` tool

```json
{
  "name": "youtube_analytics",
  "description": "Read channel performance data: health score, video grades, demographics, search terms, and notes.",
  "annotations": { "readOnlyHint": true, "destructiveHint": false, "idempotentHint": true }
}
```

Zod shape:

```ts
const YoutubeAnalyticsShape = {
  action: z.enum(['get_overview', 'get_grades', 'get_demographics', 'get_search_terms', 'get_notes'])
    .describe('get_overview: 6-axis health score + KPIs. get_grades: all videos with score/grade/trend. get_demographics: age/gender/country/device. get_search_terms: top 25 search terms. get_notes: human + bot notes.'),
  channel_id: z.string().uuid()
    .describe('YouTube channel UUID'),
  days: z.number().int().min(7).max(90).default(28)
    .describe('Lookback window in days (for overview, demographics, search_terms)'),
  limit: z.number().int().min(1).max(200).default(50)
    .describe('Max results (for get_grades)'),
  sort: z.enum(['score', 'published_at', 'views']).default('published_at')
    .describe('Sort order for get_grades'),
}
```

### A3. `youtube_videos` tool

```json
{
  "name": "youtube_videos",
  "description": "Read video and category data: list videos, get video detail with 6-axis scores, manage categories.",
  "annotations": { "readOnlyHint": true, "destructiveHint": false, "idempotentHint": true }
}
```

Zod shape:

```ts
const YoutubeVideosShape = {
  action: z.enum(['list', 'get', 'list_categories'])
    .describe('list: videos with metrics. get: single video detail (6-axis, retention, traffic). list_categories: categories with match_keywords and counts.'),
  channel_id: z.string().uuid().optional()
    .describe('YouTube channel UUID (required for list, list_categories)'),
  video_id: z.string().uuid().optional()
    .describe('YouTube video UUID (required for get)'),
  category_id: z.string().uuid().optional()
    .describe('Filter by category (for list)'),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
}
```

### A4. `youtube_ab_extended` tool

Extends existing `manage_ab_test` with new read-only actions. Could be added as new actions to `manage_ab_test` instead of a new tool.

```ts
// New actions added to ManageAbTestShape.action enum:
z.enum([
  // ... existing actions ...
  'get_learnings',     // tag win rates, channel-level insights
  'get_suggestions',   // underperforming videos with test suggestions
  'get_fatigue_alerts', // thumbnail fatigue alerts
  'get_dashboard',     // active tests, avg confidence, win rate, lift
  'get_test_history',  // history of tests for a specific video
])

// Additional fields:
video_id: z.string().uuid().optional()
  .describe('YouTube video UUID (required for get_test_history)'),
```

**Decision:** extend `manage_ab_test` rather than create a new tool. Fewer tools = less LLM confusion.

### A5. `youtube_create_note` tool

```json
{
  "name": "youtube_create_note",
  "description": "Create a bot note on a YouTube channel with analysis or observations. Source is always 'cowork'.",
  "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": false }
}
```

Zod shape:

```ts
const YoutubeCreateNoteShape = {
  channel_id: z.string().uuid()
    .describe('YouTube channel UUID'),
  text: z.string().min(1).max(10_000)
    .describe('Note content (markdown supported)'),
  category: z.enum(['analysis', 'coaching', 'observation', 'recommendation']).default('analysis')
    .describe('Note category for filtering'),
}
```

### A6. `youtube_manage_categories` tool

```json
{
  "name": "youtube_manage_categories",
  "description": "Set video categories, update category keywords, or trigger bulk recategorization.",
  "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true }
}
```

Zod shape:

```ts
const YoutubeManageCategoriesShape = {
  action: z.enum(['set_category', 'update_keywords', 'bulk_recategorize'])
    .describe('set_category: assign category to video. update_keywords: change match_keywords. bulk_recategorize: re-run auto-categorize on uncategorized videos.'),
  video_id: z.string().uuid().optional()
    .describe('Video UUID (for set_category)'),
  category_id: z.string().uuid().optional()
    .describe('Category UUID (for set_category, update_keywords)'),
  keywords: z.array(z.string().max(100)).max(50).optional()
    .describe('New match_keywords list (for update_keywords)'),
  dry_run: z.boolean().default(false),
}
```

### A7. `youtube_manage_competitors` tool

```json
{
  "name": "youtube_manage_competitors",
  "description": "Add tracked competitor channels, trigger sync, or bookmark changes.",
  "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": true }
}
```

Zod shape:

```ts
const YoutubeManageCompetitorsShape = {
  action: z.enum(['add_channel', 'sync', 'toggle_bookmark'])
    .describe('add_channel: start tracking a competitor. sync: trigger immediate data sync. toggle_bookmark: mark/unmark a change as important.'),
  youtube_channel_id: z.string().max(50).optional()
    .describe('YouTube external channel ID, e.g. UCxxxx (for add_channel)'),
  channel_id: z.string().uuid().optional()
    .describe('Internal channel UUID (for sync)'),
  change_id: z.string().uuid().optional()
    .describe('Change UUID (for toggle_bookmark)'),
}
```

### A8. `youtube_notify` tool

```json
{
  "name": "youtube_notify",
  "description": "Create a notification via fanOutToSiteAdmins. Use sparingly for actionable insights only.",
  "annotations": { "readOnlyHint": false, "destructiveHint": false, "idempotentHint": false }
}
```

Zod shape:

```ts
const YoutubeNotifyShape = {
  type: z.enum(['info', 'warning', 'success', 'action_required'])
    .describe('Notification severity'),
  title: z.string().max(200)
    .describe('Notification title'),
  message: z.string().max(2000)
    .describe('Notification body (markdown)'),
  video_id: z.string().uuid().optional()
    .describe('Related video UUID for deep-linking'),
  action_href: z.string().max(500).optional()
    .describe('CMS link for the user to take action'),
}
```

---

## Apendice B — MCP Resource URI Patterns (Fase 1)

New resources following the existing `pipeline://` URI scheme and `registerResources()` pattern.

### B1. Competitor Observatory Resources

| URI | Type | Response shape |
|-----|------|---------------|
| `pipeline://youtube/competitors/channels` | static | `{ channels: [{ id, youtube_id, name, subscribers, views, engagement_rate, growth_30d, tracked_since }], count }` |
| `pipeline://youtube/competitors/changes` | static | `{ changes: [{ id, channel_id, channel_name, type, old_value, new_value, detected_at, bookmarked }], count }` |
| `pipeline://youtube/competitors/outliers` | static | `{ outliers: [{ video_id, channel_name, title, views, multiplier, tier, published_at, thumbnail_url }], count }` |
| `pipeline://youtube/competitors/insights` | static | `{ play_of_week, cadence_analysis, title_formulas, content_gaps, engagement_heatmap, tag_analysis }` |

### B2. Performance Resources

| URI | Type | Response shape |
|-----|------|---------------|
| `pipeline://youtube/analytics/overview` | static | `{ health: { ctr, retention, reach, engagement, consistency, growth }, kpis: { views_30d, subs_30d, avg_ctr, avg_retention }, baseline }` |
| `pipeline://youtube/analytics/grades` | static | `{ videos: [{ id, title, score, grade, trend, ctr, retention, reach, engagement }], top5, bottom5 }` |
| `pipeline://youtube/analytics/demographics` | static | `{ age_groups: [...], gender: { male, female, other }, countries: [...], devices: [...] }` |
| `pipeline://youtube/analytics/search-terms` | static | `{ terms: [{ query, impressions, clicks, ctr, position }] }` |
| `pipeline://youtube/analytics/notes` | static | `{ notes: [{ id, text, source, category, created_at }] }` |

### B3. Video & Channel Resources

| URI | Type | Response shape |
|-----|------|---------------|
| `pipeline://youtube/videos` | static | `{ videos: [{ id, video_id, title, views, ctr, retention, published_at, category }], count }` |
| `pipeline://youtube/videos/{id}` | template | `{ id, title, axes: { ctr, retention, reach, engagement, consistency, growth }, retention_curve, traffic_sources, optimization_cycles }` |
| `pipeline://youtube/categories` | static | `{ categories: [{ id, name, match_keywords, video_count }] }` |

### B4. AB Lab Extended Resources

| URI | Type | Response shape |
|-----|------|---------------|
| `pipeline://youtube/ab-tests/learnings` | static | `{ tag_win_rates: [...], channel_insights: [...], total_tests }` |
| `pipeline://youtube/ab-tests/suggestions` | static | `{ suggestions: [{ video_id, title, reason, suggested_test_type, priority }] }` |
| `pipeline://youtube/ab-tests/fatigue-alerts` | static | `{ alerts: [{ video_id, title, current_ctr, baseline_ctr, days_since_change, longevity_score }] }` |
| `pipeline://youtube/ab-tests/dashboard` | static | `{ active_tests, avg_confidence, overall_win_rate, avg_lift, tests_by_status }` |
| `pipeline://youtube/ab-tests/{id}/history` | template | `{ video_id, tests: [{ id, type, status, winner, lift, started_at, ended_at }] }` |

### B5. Thumbnail Library Resources

| URI | Type | Response shape |
|-----|------|---------------|
| `pipeline://youtube/thumbnails/library` | static | `{ thumbnails: [{ id, video_id, image_url, lift, tags, longevity_score }] }` |
| `pipeline://youtube/thumbnails/fatigue` | static | `{ alerts: [{ video_id, title, ctr_trend, days_active, recommended_action }] }` |

---

## Apendice C — Pipeline API Route File Structure

Exact files to create, mapped to the registry. All under `apps/web/src/app/api/pipeline/youtube/`.

### C1. Competitor routes (4 files)

```
youtube/competitors/channels/route.ts     → GET  list tracked channels
youtube/competitors/changes/route.ts      → GET  detected changes (?type=&bookmarked=)
youtube/competitors/outliers/route.ts     → GET  outlier videos (?tier=)
youtube/competitors/insights/route.ts     → GET  strategic insights aggregate
```

### C2. Analytics routes (5 files)

```
youtube/analytics/overview/route.ts       → GET  health score + KPIs (?channel_id=&days=28)
youtube/analytics/grades/route.ts         → GET  video grades (?channel_id=&sort=&limit=)
youtube/analytics/demographics/route.ts   → GET  audience demographics (?channel_id=&days=28)
youtube/analytics/search-terms/route.ts   → GET  top search terms (?channel_id=&days=28)
youtube/analytics/notes/route.ts          → GET + POST  notes CRUD (?channel_id=)
```

### C3. Video & Category routes (3 files)

```
youtube/videos/route.ts                   → GET  video list (?channel_id=&category=&limit=)
youtube/videos/[id]/route.ts              → GET  video detail (6-axis, retention, traffic)
youtube/categories/route.ts               → GET + PATCH  categories with keywords
```

### C4. AB Lab extended routes (5 files)

```
youtube/ab-tests/learnings/route.ts       → GET  tag win rates + channel insights
youtube/ab-tests/suggestions/route.ts     → GET  underperforming video suggestions
youtube/ab-tests/fatigue-alerts/route.ts  → GET  thumbnail fatigue alerts
youtube/ab-tests/dashboard/route.ts       → GET  aggregate dashboard stats
youtube/ab-tests/[id]/history/route.ts    → GET  test history per video
```

### C5. Thumbnail routes (2 files)

```
youtube/thumbnails/library/route.ts       → GET  thumbnail library
youtube/thumbnails/fatigue/route.ts       → GET  fatigue alerts + longevity trends
```

### C6. Service layer additions

All new service functions go in `apps/web/src/lib/pipeline/services/youtube.ts` (single file, following existing pattern). MCP tool service files go in `apps/web/src/lib/pipeline/mcp/services/youtube-observatory.ts`, `youtube-analytics.ts`, etc.

### C7. Registry update

`api-registry.ts` YOUTUBE domain grows from `endpoint_count: 10` to `endpoint_count: 29` (19 new endpoints).

---

## Apendice D — Rate Limiting Strategy

### D1. Per-analysis cycle limits

| Operation | Max per cycle | Cooldown |
|-----------|---------------|----------|
| Read resources (observatory, analytics) | 10 calls | none |
| Write notes | 3 per channel per hour | 5min between notes |
| Submit intelligence (coaching) | 1 per channel per day | 24h |
| Create notifications | 5 per hour | 2min between notifications |
| Competitor sync trigger | 1 per channel per 6h | 6h |
| Bulk recategorize | 1 per day | 24h |

### D2. Implementation

Rate limiting is enforced at two layers:

1. **Pipeline API level:** existing `100/min` per API key applies to all endpoints. No change needed.
2. **Service level:** write operations check a `youtube_rate_limits` in-memory map (or a simple DB timestamp column on the relevant table) before executing. Example:

```ts
// In youtube service, before creating a note:
const lastNote = await supabase
  .from('youtube_channel_notes')
  .select('created_at')
  .eq('channel_id', channelId)
  .eq('source', 'cowork')
  .order('created_at', { ascending: false })
  .limit(1)
  .single()

if (lastNote.data) {
  const elapsed = Date.now() - new Date(lastNote.data.created_at).getTime()
  if (elapsed < 5 * 60 * 1000) {
    return err('RATE_LIMITED', 'Wait 5 minutes between bot notes')
  }
}
```

### D3. Intelligence submission guard

The intelligence pipeline already has built-in concurrency control via `claim_task` + `status` transitions. A channel can only have one active intelligence task at a time. No additional rate limiting needed beyond the existing CAS mechanism.

---

## Apendice E — Discovery Mechanism

### E1. How Cowork discovers new tools

1. **MCP `tools/list` request** — the MCP SDK automatically returns all tools registered via `server.tool()` in `tools.ts`. Adding a new tool to `registerTools()` makes it instantly visible to any MCP client.
2. **Tool descriptions** — the `describe()` strings on each Zod field serve as inline documentation. Cowork reads these to understand how to call tools.
3. **No manual catalog needed** — the `API_REGISTRY` in `api-registry.ts` is the source of truth for Pipeline REST endpoints. The `auto-register.ts` mapping validates that every REST endpoint is covered by an MCP tool. Adding a new REST endpoint without mapping it to an MCP tool will fail the test.

### E2. How Cowork discovers new resources

1. **MCP `resources/list` request** — returns all resources registered via `server.resource()` in `resources.ts`. New resources are auto-discovered.
2. **URI conventions** — resources follow the `pipeline://youtube/{domain}/{sub}` pattern. Template resources (with `{id}`) use `ResourceTemplate` and appear with their variable patterns.
3. **The `pipeline://catalog` resource** — always available, returns the full `API_REGISTRY` including endpoint summaries. This is the "bootstrap" resource Cowork reads first to understand what is available.

### E3. How Cowork discovers new prompts

1. **MCP `prompts/list` request** — returns all prompts registered via `server.prompt()` in `prompts.ts`.
2. **Prompt arguments** — each prompt declares its arguments as a Zod schema with descriptions.

### E4. Self-documentation flow

```
Cowork session starts
  → reads pipeline://catalog (API overview)
  → reads pipeline://docs/youtube (tier-2 docs)
  → calls tools/list (discovers new tools with schemas)
  → calls resources/list (discovers new resources)
  → calls prompts/list (discovers new prompts)
  → ready to analyze
```

No manual sync step. The registry test suite (`auto-register.ts` mapping + test) ensures parity between REST endpoints and MCP tools.

---

## Apendice F — Dependency-Aware Implementation Order

Rewritten from the original priority list to respect dependency chains.

### Phase 0 — Health Coach wiring (no new endpoints) ~2h

**Why first:** 80% of the pipeline already works. Only frontend change needed.

1. In `yt-analytics-tabs.tsx`, query `youtube_intelligence` for coaching data
2. If `source: 'cowork'` exists and is < 7 days old, use instead of static fallback
3. Show "Atualizado pelo Cowork ha X" timestamp

**Dependencies:** none
**Validates:** existing `claim_task` / `submit_intelligence` pipeline end-to-end

### Phase 1 — Read-only resources (competitors) ~4h

**Why second:** richest unique data, validates the new resource registration pattern.

1. Add 4 service functions to `youtube.ts` for competitor data
2. Register 4 new resources in `resources.ts`
3. Create 4 pipeline route files under `youtube/competitors/`
4. Update `api-registry.ts` endpoint count (10 → 14)
5. Update `cowork-docs-youtube.md` with competitor section

**Dependencies:** none (data already in DB from competitor sync cron)

### Phase 2 — Read-only resources (analytics + videos) ~6h

**Why third:** enables full channel analysis when combined with Phase 1.

1. Add 8 service functions for analytics/videos/categories
2. Register 8 new resources in `resources.ts`
3. Create 8 pipeline route files
4. Update registry (14 → 22)

**Dependencies:** Phase 1 (for the shared `buildResourceCtx` pattern)

### Phase 3 — Read-only resources (AB Lab extended) ~4h

**Why fourth:** extends the existing `manage_ab_test` tool with new read actions.

1. Add 5 service functions (learnings, suggestions, fatigue, dashboard, history)
2. Add 5 new actions to `ManageAbTestShape` in `tools.ts`
3. Register 5 new resources in `resources.ts`
4. Create 5 pipeline route files
5. Update registry (22 → 27)

**Dependencies:** Phase 2 (uses video grades for suggestion scoring)

### Phase 4 — Thumbnail library resources ~2h

1. Add 2 service functions
2. Register 2 resources
3. Create 2 route files
4. Update registry (27 → 29)

**Dependencies:** Phase 3 (fatigue alerts share logic with AB fatigue)

### Phase 5 — Write tools ~8h

Now that all reads work, add write capabilities in order of risk:

1. `youtube_create_note` — lowest risk, append-only
2. `youtube_manage_categories` — idempotent set/update
3. `youtube_manage_competitors` — add channel + trigger sync
4. `youtube_notify` — uses existing `fanOutToSiteAdmins`
5. Add rate limiting guards per Apendice D
6. Register all 4 new tools in `tools.ts`

**Dependencies:** Phase 1-4 (write tools reference data from read resources)

### Phase 6 — MCP prompts + docs ~4h

1. Create `youtube-analyst` prompt (reads overview + grades + demographics + competitors → produces coaching + notes)
2. Create `competitor-report` prompt (reads all observatory data → produces analysis)
3. Update `cowork-docs-youtube.md` with complete documentation of all new endpoints
4. Add YouTube analysis workflow to `CROSS_DOMAIN_WORKFLOWS` in registry

**Dependencies:** Phase 5 (prompts call tools and read resources)

### Phase 7 — Frontend integration ~2h

1. Enable "Montar roteiro" and "Roteirizar lacunas" buttons when Cowork MCP is available
2. Button click creates pipeline item + triggers `youtube-analyst` prompt

**Dependencies:** Phase 6 (uses prompts)

### Summary table

| Phase | Hours | Items | Depends on |
|-------|-------|-------|------------|
| 0 — Health Coach wiring | 2h | 1 frontend change | nothing |
| 1 — Competitor resources | 4h | 4 endpoints + 4 resources | nothing |
| 2 — Analytics/video resources | 6h | 8 endpoints + 8 resources | Phase 1 |
| 3 — AB Lab extended | 4h | 5 endpoints + 5 resources | Phase 2 |
| 4 — Thumbnail library | 2h | 2 endpoints + 2 resources | Phase 3 |
| 5 — Write tools | 8h | 4 tools + rate limits | Phase 1-4 |
| 6 — Prompts + docs | 4h | 2 prompts + docs | Phase 5 |
| 7 — Frontend integration | 2h | 2 buttons | Phase 6 |
| **Total** | **32h** | | |
