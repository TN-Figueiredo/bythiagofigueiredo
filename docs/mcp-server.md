# Pipeline MCP Server

Streamable HTTP MCP server that exposes the Content Pipeline API to Claude Desktop and other MCP clients.

## Quick Start

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "pipeline": {
      "url": "https://bythiagofigueiredo.com/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_PIPELINE_KEY"
      }
    }
  }
}
```

## Onboarding

After connecting, read `pipeline://catalog` first. It contains the full API registry with all capability domains, endpoints, and cross-domain workflows. This gives the LLM a map of everything available before invoking any tools.

## Tools (17)

| Tool | Description |
|------|-------------|
| `create_item` | Create a new pipeline item (video, article, course) |
| `update_item` | Update item fields (checklist, restore, link/unlink) |
| `advance_item` | Advance or retreat item through workflow stages |
| `manage_sections` | Read/write content sections (ideia, roteiro, postprod, etc.) |
| `delete_item` | Archive (soft delete) a pipeline item |
| `graduate_item` | Graduate item to blog post, newsletter, or campaign |
| `publish_item` | Publish or schedule a graduated blog post (VVS gate) |
| `bulk_items` | Batch operations (advance, archive, tag, update, batch-sections) |
| `manage_playlist` | CRUD playlists, add/remove/reorder items, auto-layout |
| `manage_edges` | Create/delete directed edges between playlist items |
| `manage_audio` | CRUD audio assets, import/export library, stats |
| `match_audio` | Smart audio matching by context and filters |
| `manage_broll` | CRUD B-roll video clips, batch import |
| `manage_research` | CRUD research items and topics, link to pipeline items |
| `manage_ab_test` | YouTube A/B test management (variants, funnel, performance) |
| `search_content` | Cross-entity search, context docs, stats, intelligence |
| `manage_upnext` | Assign or swap pipeline items in weekly schedule slots |

## Resources (11)

| URI | Description |
|-----|-------------|
| `pipeline://catalog` | API catalog with all capability domains, endpoints, and cross-domain workflows |
| `pipeline://docs/{domain}` | Tier-2 documentation guide for a capability domain (items-and-sections, playlists, libraries, research, youtube, utilities, course) |
| `pipeline://context/{skill}` | Skill-specific reference content (ideator, writer, producer, product_eval, perf_review, curator, architect) |
| `pipeline://stats` | Pipeline statistics: item counts by format, stage, and priority |
| `pipeline://workflows` | Workflow stage definitions and default production checklists for all content formats |
| `pipeline://up-next` | Today's actions, week grid, production streak, and suggestions from the Command Center |
| `pipeline://youtube/intelligence` | YouTube channel intelligence snapshot: health score, grade distribution, top/bottom videos |
| `pipeline://youtube/ab-performance` | Aggregate A/B test winning patterns from completed tests: win rates by type, top strategies |
| `pipeline://audio/stats` | Audio library statistics: counts by category, mood, energy level, most used tracks |
| `pipeline://research/topics` | Hierarchical research topic tree with item counts per topic |
| `pipeline://items/{id}` | Single pipeline item skeleton: metadata, section names, and word counts (not full content) |

## Prompts (7)

| Prompt | Arguments | Description |
|--------|-----------|-------------|
| `ideator` | `topic_seed?`, `format?`, `count?` | Generate content ideas based on topic seed, format, and pipeline context |
| `writer` | `item_id`, `section_key`, `instructions?`, `lang?` | Write or rewrite a specific section of a pipeline item |
| `producer` | `item_id` | Review production readiness of a pipeline item: checklist, assets, timeline |
| `ab-ideate` | `test_type`, `video_context?` | Brainstorm A/B test variants for a YouTube video (thumbnail, title, description, or combo) |
| `ab-write` | `test_id`, `variant_count?`, `slot_notes?` | Write A/B test variants for an existing test with API workflow instructions |
| `playlist-architect` | `playlist_id`, `mode?`, `instructions?` | Architect or reorganize a playlist: build, connect, fill gaps, reorg, campaign, or course mode |
| `translate` | `item_id`, `target_locale` | Translate a pipeline item to a target locale with cultural adaptation |

## Permissions

API keys carry permission levels: `read`, `write`, or `admin`.

- **Read** — browse resources, read sections, search, list items
- **Write** — all read operations plus create, update, delete, advance, graduate, publish, bulk operations
- **Admin** — all write operations plus key management

Write tools enforce permission checks at the adapter level. A key with only `read` permission will receive a `FORBIDDEN` error when calling any mutation tool.

## Safety

- `dry_run: true` previews changes without executing
- Destructive operations (delete, bulk archive) require `confirm: true`
- Rate limits: 30 single writes/min, 5 bulk operations/min, 2 destructive ops/5min
- Confirmation tokens expire after 5 minutes (HMAC-SHA256 signed)

## Errors

Every error response includes:

```json
{
  "severity": "fatal" | "recoverable" | "transient",
  "retryable": true | false,
  "recovery_action": "Human-readable suggestion for recovery"
}
```

Severity levels:
- `recoverable` — caller can fix the input and retry (VERSION_CONFLICT, VALIDATION_ERROR, FORBIDDEN)
- `transient` — temporary failure, retry after delay (RATE_LIMITED, SERVICE_UNAVAILABLE, TIMEOUT)
- `fatal` — no automatic recovery possible (NOT_FOUND, UNAUTHORIZED, INTERNAL_ERROR)

Common error codes:
- `VERSION_CONFLICT` — stale version, re-fetch and retry
- `RATE_LIMITED` — too many writes, back off and retry
- `VALIDATION_ERROR` — fix input parameters and retry
- `FORBIDDEN` — API key lacks required permission level
- `CONFIRMATION_REQUIRED` — destructive op needs `confirm: true`
- `NOT_FOUND` — resource does not exist
- `UNAUTHORIZED` — invalid or revoked API key
- `INTERNAL_ERROR` — unexpected server error
