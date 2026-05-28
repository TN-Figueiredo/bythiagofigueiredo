# MCP Server for Content Pipeline — Design Spec

**Date:** 2026-05-28
**Status:** Ready for implementation
**Target Score:** 100+/110

## Problem

Today the Cowork workflow requires manual copy-paste of a 9-step system prompt to bootstrap context. Every new conversation starts from zero. The pipeline API (79 endpoints, 7 domains) is mature but only accessible via REST. An MCP server eliminates this friction — any LLM client connects once and has native access to all pipeline capabilities.

## Architecture: Extract-First

```
MCP Client (Claude/GPT/Cursor)
    │
    ▼
app/api/mcp/route.ts          ← Streamable HTTP, stateless
    │
    ├── 17 Tools (write ops)
    ├── 11 Resources (read-only context)
    └── 7 Prompts (workflow templates)
    │
    ▼
lib/pipeline/services/         ← NEW: transport-agnostic business logic
    ├── items.ts               (18 endpoints → service functions)
    ├── playlists.ts           (13 endpoints)
    ├── youtube.ts             (10 endpoints)
    ├── research.ts            (12 endpoints)
    ├── audio.ts               (9 endpoints)
    ├── broll.ts               (6 endpoints)
    └── utilities.ts           (11 endpoints)
    │
    ▼
app/api/pipeline/*/route.ts   ← REFACTORED: thin HTTP adapters calling services
    │
    ▼
Supabase (RLS)
```

### Why Extract-First

1. Site evolves constantly (A/B system, new features) — services insulate MCP from route changes
2. Single source of truth — routes and MCP both consume same logic
3. Industry standard — Stripe, GitHub, Notion all have service layer under MCP
4. Enables dry-run — services can return planned changes without executing

## Service Layer Contract

Each service file exports functions with this signature pattern:

```typescript
// lib/pipeline/services/items.ts
interface ServiceContext {
  siteId: string
  permissions: Permission[]
  keyHash?: string
}

interface ServiceResult<T> {
  data: T
  meta?: { total?: number; has_next?: boolean; next_cursor?: string }
}

interface ServiceError {
  code: string
  message: string
  status: number
  details?: Record<string, unknown>
}

// Example functions:
export async function listItems(ctx: ServiceContext, filters: ItemFilters): Promise<ServiceResult<PipelineItem[]>>
export async function createItem(ctx: ServiceContext, data: ItemCreateInput): Promise<ServiceResult<PipelineItem>>
export async function advanceItem(ctx: ServiceContext, id: string, options?: { dryRun?: boolean }): Promise<ServiceResult<AdvanceResult>>
```

Routes become thin adapters:
```typescript
// app/api/pipeline/items/route.ts (refactored)
export async function GET(req: NextRequest) {
  const auth = await authenticateRead(req)
  if (auth instanceof Response) return auth
  const filters = parseItemFilters(req.nextUrl.searchParams)
  const result = await listItems(auth, filters)
  return pipelineSuccess(result.data, 200, auth, result.meta)
}
```

## MCP Tools (17)

| # | Tool | Action | Domain | Destructive | Annotations |
|---|------|--------|--------|-------------|-------------|
| 1 | `create_item` | Create pipeline item | Items | No | `idempotentHint: false` |
| 2 | `update_item` | Update item fields | Items | No | Version auto-managed |
| 3 | `advance_item` | Move to next stage | Items | Caution | `destructiveHint: false` but irreversible stages marked |
| 4 | `manage_sections` | Read/write content sections | Items | No | Accepts markdown, converts server-side |
| 5 | `delete_item` | Archive item | Items | Yes | `destructiveHint: true`, requires `confirm: true` |
| 6 | `graduate_item` | Promote to blog/newsletter/course | Items | Yes | Creates external records, requires confirm |
| 7 | `publish_item` | Make content live | Items | Yes | Public-facing, requires confirm |
| 8 | `bulk_items` | Batch operations (max 50) | Items | Yes | Requires confirm, returns plan first |
| 9 | `manage_playlist` | CRUD + reorder playlists | Playlists | Mixed | Delete requires confirm (cascade) |
| 10 | `manage_edges` | DAG edge operations | Playlists | No | Cycle-safe server-side |
| 11 | `manage_audio` | CRUD audio assets | Libraries | Mixed | Delete = retire (soft) |
| 12 | `match_audio` | Smart audio matching | Libraries | No | `readOnlyHint: true` |
| 13 | `manage_broll` | CRUD b-roll assets | Libraries | Mixed | Delete = retire (soft) |
| 14 | `manage_research` | CRUD research items + topics | Research | Mixed | Topic delete orphans children |
| 15 | `manage_ab_test` | Upsert A/B test variants | YouTube | No | `idempotentHint: true` |
| 16 | `search_content` | Cross-entity search | Utilities | No | `readOnlyHint: true` |
| 17 | `manage_upnext` | Assign/swap week slots | Utilities | No | |

## MCP Resources (11)

| URI | Source | Size Hint | TTL |
|-----|--------|-----------|-----|
| `pipeline://catalog` | GET /api/pipeline/ | ~8KB | 86400s |
| `pipeline://docs/{domain}` | GET /api/pipeline/docs/:domain | 2-50KB | 86400s |
| `pipeline://context/{skill}` | GET /api/pipeline/context?skill= | 5-20KB | 3600s |
| `pipeline://stats` | GET /api/pipeline/stats | ~2KB | 60s |
| `pipeline://workflows` | GET /api/pipeline/workflows | ~3KB | 86400s |
| `pipeline://up-next` | GET /api/pipeline/up-next | ~4KB | 60s |
| `pipeline://youtube/intelligence` | GET /api/pipeline/youtube/intelligence | ~5KB | 300s |
| `pipeline://youtube/ab-performance` | GET /api/pipeline/youtube/ab-performance | ~3KB | 300s |
| `pipeline://audio/stats` | GET /api/pipeline/audio-library/stats | ~1KB | 3600s |
| `pipeline://research/topics` | GET /api/pipeline/research/topics | ~3KB | 3600s |
| `pipeline://items/{id}` | GET /api/pipeline/items/:id | ~2-8KB | 60s |

## MCP Prompts (7)

| Name | Source Builder | Auto-injects Resources |
|------|---------------|----------------------|
| `ideator` | buildPrompt (skill=ideator) | context/ideator, stats, up-next |
| `writer` | buildPrompt (skill=writer) | context/writer, docs/items-and-sections |
| `producer` | buildPrompt (skill=producer) | context/producer, workflows, stats |
| `ab-ideate` | buildAbBriefingPrompt | youtube/intelligence, youtube/ab-performance |
| `ab-write` | buildAbWritePrompt | youtube/intelligence, items/{id} |
| `playlist-architect` | buildPlaylistPrompt | docs/playlists, workflows |
| `translate` | generatePrompt | docs/items-and-sections, items/{id} |

## Safety Layer

### Dry-Run Protocol
Every write tool accepts `dry_run: boolean` (default: false). When true:
- Runs all validation
- Returns `{ planned_changes, side_effects, reversible }` diff
- Does NOT persist anything
- Tool description instructs LLM: "always dry-run first for destructive operations"

### Confirmation Tokens
Destructive tools (delete, graduate, publish, bulk) return a confirmation envelope:
```json
{
  "requires_confirmation": true,
  "summary": "Delete playlist 'Series Alpha' (12 items, 8 edges will cascade)",
  "confirmation_token": "hmac-sha256-...",
  "expires_in_seconds": 300
}
```
LLM must present this to user, then call again with `confirmation_token` to execute.

### Rate-of-Change Governor
Per-session sliding window:
- Single writes: 10/min
- Bulk operations: 2/min
- Destructive operations: 3/5min
Exceeding returns structured error with cooldown time.

### Audit Trail
Every MCP tool call logged to `audit_log`:
```json
{ "source": "mcp", "tool": "advance_item", "params": {...}, "dry_run": false, "user_confirmed": true }
```

## Error Handling

MCP error envelope (replaces raw HTTP status):
```json
{
  "isError": true,
  "content": [{
    "type": "text",
    "text": "{\"code\":\"VERSION_CONFLICT\",\"message\":\"Item was modified\",\"severity\":\"recoverable\",\"retryable\":true,\"recovery_action\":\"Re-fetch item to get version 5, then retry with updated content\"}"
  }]
}
```

Error severity levels: `fatal`, `recoverable`, `transient`
Every error includes `recovery_action` telling the LLM what to do next.

## Context Window Optimization

- Pagination default: 20 items (not 200)
- Skeleton-first: list tools return id + title + status, detail tools return full content
- Resource annotations with `sizeHint` so client can budget before loading
- Tool descriptions: max 200 tokens each, imperative single sentences
- Content sections: return markdown (40% more token-efficient than Tiptap JSON)

## Deployment

- Route: `app/api/mcp/route.ts`
- Package: `mcp-handler` (Streamable HTTP only, reject SSE)
- Auth: `X-Pipeline-Key` via Bearer token in MCP transport
- Region: `gru1` (São Paulo, same as Supabase)
- Config: `maxDuration: 60`, `dynamic: 'force-dynamic'`
- Bundle: isolated function, no unrelated pipeline imports

## Testing

- **Unit**: Zod → JSON Schema parity (20 tests)
- **Integration**: InMemoryTransport round-trips for all 17 tools (40 tests)
- **Contract**: Resource URI resolution, prompt template rendering (15 tests)
- **Snapshot**: `tools/list` registration snapshot prevents accidental removal
- **Safety**: Dry-run protocol, confirmation flow, rate governor (10 tests)

Total target: 85+ MCP-specific tests

## Documentation Sync

The `api-registry.ts` is the single source of truth for:
- MCP tool auto-registration (tool name, description, annotations)
- REST route documentation
- Cowork prompt generation
- Pipeline integrity tests

When the API evolves (e.g., new A/B test features), update the registry → MCP tools update automatically via auto-generation from registry metadata.

## Non-Goals (v1)

- OAuth / multi-tenant auth (future: platform mode)
- Smithery / marketplace listing (future: distribution)
- Stripe billing / feature gating (future: monetization)
- WebSocket / SSE transport (Streamable HTTP only)
- Next.js 16 built-in `/_next/mcp` (too opinionated, no auth control)
