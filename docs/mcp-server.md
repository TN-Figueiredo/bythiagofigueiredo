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
| `pipeline://workflows` | All workflow definitions and checklists |
| `pipeline://stats` | Aggregate pipeline statistics |
| `pipeline://context` | All reference content docs |
| `pipeline://context/{key}` | Specific reference doc by key |
| `pipeline://docs/{domain}` | Tier 2 documentation for a capability domain |
| `pipeline://search?q={query}` | Cross-entity search results |
| `pipeline://topics/{code}` | Topic aggregation (items + posts by tag) |
| `pipeline://items/{id}` | Item detail with history and dependencies |
| `pipeline://playlists/{id}` | Playlist with items and edges graph |
| `pipeline://youtube/intelligence` | Channel intelligence snapshot |
| `pipeline://up-next` | Command center: today actions, week grid, streak |

## Prompts (7)

| Prompt | Description |
|--------|-------------|
| `create-video` | Guided video creation from premise to script |
| `create-course` | Course production from curriculum to launch plan |
| `weekly-review` | Analyze week performance and suggest next actions |
| `research-brief` | Compile research into actionable content brief |
| `ab-test-analysis` | Analyze A/B test results and recommend winners |
| `content-audit` | Audit pipeline items for completeness and quality |
| `production-checklist` | Walk through pre-publish production checklist |

## Safety

- `dry_run: true` previews changes without executing
- Destructive operations (delete, bulk archive) require `confirm: true`
- Rate limits: 30 writes/min, 5 bulk/min, 2 destructive/5min
- Confirmation tokens expire after 60 seconds

## Errors

Every error response includes:

```json
{
  "severity": "warning" | "error" | "fatal",
  "retryable": true | false,
  "recovery_action": "Human-readable suggestion for recovery"
}
```

Common error codes:
- `VERSION_CONFLICT` — stale `X-Expected-Version`, re-fetch and retry
- `RATE_LIMITED` — too many writes, back off and retry
- `CONFIRMATION_REQUIRED` — destructive op needs `confirm: true`
- `AUTH_FAILED` — invalid or missing pipeline key
- `NOT_FOUND` — resource does not exist
