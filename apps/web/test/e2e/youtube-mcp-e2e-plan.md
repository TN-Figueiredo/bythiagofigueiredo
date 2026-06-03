# YouTube MCP Integration -- E2E Test Plan

31 YouTube pipeline endpoints, 3 MCP tools, 2 MCP prompts, 3 user journeys.

---

## Section 1: Pipeline API Smoke Tests

All endpoints use `X-Pipeline-Key` header. Base: `http://localhost:3000` (dev) or prod.

```bash
KEY="$PIPELINE_COWORK_KEY"
BASE="http://localhost:3000"
```

### 1.1 Competitors (4 endpoints)

```bash
# 1. List tracked competitor channels
curl -s -H "X-Pipeline-Key: $KEY" \
  "$BASE/api/pipeline/youtube/competitors/channels" | jq '.data'

# 2. List competitor changes (optional: ?type=title&bookmarked=true&limit=10)
curl -s -H "X-Pipeline-Key: $KEY" \
  "$BASE/api/pipeline/youtube/competitors/changes?limit=10" | jq '.data'

# 3. List competitor outlier videos (optional: ?tier=top&limit=5)
curl -s -H "X-Pipeline-Key: $KEY" \
  "$BASE/api/pipeline/youtube/competitors/outliers" | jq '.data'

# 4. Aggregated competitor insights
curl -s -H "X-Pipeline-Key: $KEY" \
  "$BASE/api/pipeline/youtube/competitors/insights" | jq '.data'
```

### 1.2 Analytics (5 endpoints)

```bash
# 5. Channel health overview (requires channel_id)
curl -s -H "X-Pipeline-Key: $KEY" \
  "$BASE/api/pipeline/youtube/analytics/overview?channel_id=<CHANNEL_UUID>&days=28" | jq '.data'

# 6. Per-video grades with 6-axis scoring (requires channel_id)
curl -s -H "X-Pipeline-Key: $KEY" \
  "$BASE/api/pipeline/youtube/analytics/grades?channel_id=<CHANNEL_UUID>&sort=score&limit=20" | jq '.data'

# 7. Audience demographics (requires channel_id)
curl -s -H "X-Pipeline-Key: $KEY" \
  "$BASE/api/pipeline/youtube/analytics/demographics?channel_id=<CHANNEL_UUID>&days=28" | jq '.data'

# 8. Top search terms (requires channel_id)
curl -s -H "X-Pipeline-Key: $KEY" \
  "$BASE/api/pipeline/youtube/analytics/search-terms?channel_id=<CHANNEL_UUID>&days=28" | jq '.data'

# 9. List analytics notes (GET) / Create bot note (POST)
curl -s -H "X-Pipeline-Key: $KEY" \
  "$BASE/api/pipeline/youtube/analytics/notes?channel_id=<CHANNEL_UUID>" | jq '.data'

curl -s -X POST -H "X-Pipeline-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"channel_id":"<CHANNEL_UUID>","text":"Test note","source":"smoke-test"}' \
  "$BASE/api/pipeline/youtube/analytics/notes" | jq '.data'
```

### 1.3 Videos (3 endpoints)

```bash
# 10. List videos with pagination (requires channel_id)
curl -s -H "X-Pipeline-Key: $KEY" \
  "$BASE/api/pipeline/youtube/videos?channel_id=<CHANNEL_UUID>&limit=5" | jq '.data'

# 11. Get single video detail with grade
curl -s -H "X-Pipeline-Key: $KEY" \
  "$BASE/api/pipeline/youtube/videos/<VIDEO_UUID>" | jq '.data'

# 12. List categories (GET) / Update category keywords (PATCH)
curl -s -H "X-Pipeline-Key: $KEY" \
  "$BASE/api/pipeline/youtube/categories" | jq '.data'
```

### 1.4 Intelligence (2 endpoints)

```bash
# 13. Get channel intelligence snapshot (requires channel_id)
curl -s -H "X-Pipeline-Key: $KEY" \
  "$BASE/api/pipeline/youtube/intelligence?channel_id=<CHANNEL_UUID>" | jq '.data'

# 14. Claim next pending intelligence task
curl -s -H "X-Pipeline-Key: $KEY" \
  "$BASE/api/pipeline/youtube/intelligence/task" | jq '.'
```

### 1.5 A/B Tests (12 endpoints)

```bash
# 15-19. Read endpoints (GET)
curl -s -H "X-Pipeline-Key: $KEY" "$BASE/api/pipeline/youtube/ab-tests" | jq '.data'
curl -s -H "X-Pipeline-Key: $KEY" "$BASE/api/pipeline/youtube/ab-tests/<TEST_UUID>" | jq '.data'
curl -s -H "X-Pipeline-Key: $KEY" "$BASE/api/pipeline/youtube/ab-tests/<TEST_UUID>/funnel" | jq '.data'
curl -s -H "X-Pipeline-Key: $KEY" "$BASE/api/pipeline/youtube/ab-tests/<YT_VIDEO_ID>/history" | jq '.data'
curl -s -H "X-Pipeline-Key: $KEY" "$BASE/api/pipeline/youtube/ab-tests/<TEST_UUID>/variants" | jq '.data'

# 20. Upsert variants (POST, write permission)
curl -s -X POST -H "X-Pipeline-Key: $KEY" -H "Content-Type: application/json" \
  -d '[{"label":"B","title_text":"Alt title"}]' \
  "$BASE/api/pipeline/youtube/ab-tests/<TEST_UUID>/variants" | jq '.data'

# 21. Delete variant (DELETE, requires ?label=B)
curl -s -X DELETE -H "X-Pipeline-Key: $KEY" \
  "$BASE/api/pipeline/youtube/ab-tests/<TEST_UUID>/variants?label=B" | jq '.data'

# 22-26. Aggregate read endpoints
curl -s -H "X-Pipeline-Key: $KEY" "$BASE/api/pipeline/youtube/ab-performance" | jq '.data'
curl -s -H "X-Pipeline-Key: $KEY" "$BASE/api/pipeline/youtube/ab-tests/learnings" | jq '.data'
curl -s -H "X-Pipeline-Key: $KEY" "$BASE/api/pipeline/youtube/ab-tests/suggestions" | jq '.data'
curl -s -H "X-Pipeline-Key: $KEY" "$BASE/api/pipeline/youtube/ab-tests/fatigue-alerts" | jq '.data'
curl -s -H "X-Pipeline-Key: $KEY" "$BASE/api/pipeline/youtube/ab-tests/dashboard" | jq '.data'
```

### 1.6 Thumbnails (2) + Write methods (2) + Negative tests

```bash
# 27-28. Thumbnails
curl -s -H "X-Pipeline-Key: $KEY" "$BASE/api/pipeline/youtube/thumbnails/fatigue" | jq '.data'
curl -s -H "X-Pipeline-Key: $KEY" "$BASE/api/pipeline/youtube/thumbnails/library" | jq '.data'

# 29. Submit intelligence (PATCH, write permission)
curl -s -X PATCH -H "X-Pipeline-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"task_id":"<TASK_UUID>","video_recommendations":[],"coaching":{"summary":"test","priorities":[]}}' \
  "$BASE/api/pipeline/youtube/intelligence" | jq '.data'

# 30. Update category keywords (PATCH, write permission)
curl -s -X PATCH -H "X-Pipeline-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"id":"<CATEGORY_UUID>","match_keywords":["test","keyword"]}' \
  "$BASE/api/pipeline/youtube/categories" | jq '.data'

# 31-32. Negative: missing/invalid key returns 401
curl -s "$BASE/api/pipeline/youtube/competitors/channels" | jq '.error'
curl -s -H "X-Pipeline-Key: invalid" "$BASE/api/pipeline/youtube/competitors/channels" | jq '.error'
```

---

## Section 2: MCP Tool Verification

### Tool 17: `youtube_observatory`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Connect Claude Desktop to MCP server at `/api/mcp` | Connection established, tool list includes `youtube_observatory` |
| 2 | Call `youtube_observatory` with `{ "action": "list_channels" }` | JSON with `channels` array; each entry has `id`, `channel_name`, `subscriber_count` |
| 3 | Call with `{ "action": "get_changes", "limit": 5 }` | JSON with `changes` array; each has `channelName`, `field`, `oldValue`, `newValue` |
| 4 | Call with `{ "action": "get_outliers" }` | JSON with `outliers` array (bookmarked changes only) |
| 5 | Call with `{ "action": "get_insights" }` | JSON with `totalChannels`, `recentChanges7d`, `changesByField`, `mostActiveCompetitor` |
| 6 | Call with `{ "action": "invalid_action" }` | Error response with `VALIDATION_ERROR` code listing supported actions |

### Tool 18: `youtube_analytics`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Call `youtube_analytics` with `{ "action": "get_overview" }` | JSON with `channels` and `recentVideos` arrays |
| 2 | Call with `{ "action": "get_grades", "channel_id": "<UUID>" }` | JSON with `videos` array; each has `grade` (A/B/C/D), `score`, and `axes` (6 items) |
| 3 | Call with `{ "action": "get_demographics", "channel_id": "<UUID>" }` | JSON with `demographics` (age/gender/country data or null) |
| 4 | Call with `{ "action": "get_search_terms", "channel_id": "<UUID>" }` | JSON with `searchTerms` data or null |
| 5 | Call with `{ "action": "get_notes", "channel_id": "<UUID>" }` | JSON with `notes` array; each has `author`, `text`, `isBot` |
| 6 | Call with `{ "action": "get_grades" }` (missing channel_id) | Error: `VALIDATION_ERROR`, `"channel_id is required"` |

### Tool 19: `youtube_videos`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Call `youtube_videos` with `{ "action": "list", "limit": 3 }` | JSON with `videos` array, `hasNext` boolean, `nextCursor` |
| 2 | Call with `{ "action": "get", "video_id": "<UUID>" }` | JSON with `video` object (full detail) and `grade` (or null) |
| 3 | Call with `{ "action": "list_categories" }` | JSON with `categories` array; each has `slug`, `namePt`, `matchKeywords` |
| 4 | Verify pagination: call `list` with returned `nextCursor` | Second page of results, no overlap with first page |

### Tool 15: `manage_ab_test` (YouTube-relevant actions only)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Call with `{ "action": "list_tests" }` | JSON with tests array |
| 2 | Call with `{ "action": "get_intelligence", "channel_id": "<UUID>" }` | Full intelligence snapshot |
| 3 | Call with `{ "action": "claim_task" }` | Next pending task or empty |
| 4 | Call with `{ "action": "upsert_variants", "test_id": "<UUID>", "variants": [...], "dry_run": true }` | Dry-run preview with `proposed_variants` |
| 5 | Call with `{ "action": "get_learnings" }` | Tag win rates from completed tests |
| 6 | Call with `{ "action": "get_dashboard" }` | Aggregate stats |
| 7 | Call `submit_intelligence` without `write` permission | Error: `FORBIDDEN` |

---

## Section 3: MCP Prompt Verification

### Prompt 9: `youtube-analyst`

| Step | Action | Expected |
|------|--------|----------|
| 1 | In Claude Desktop, invoke prompt `youtube-analyst` with `channel_id: "<UUID>"` | Returns structured user message |
| 2 | Verify header includes channel name, subscriber count, tier | Auto-injected from `fetchChannelInfo()` |
| 3 | Verify "Step 1: Collect Channel Health" references `manage_ab_test` with `get_intelligence` | Correct tool name and action |
| 4 | Verify "Step 2: Evaluate Video Performance" includes 6-axis scoring formula | CTR, Retention, Reach, Engagement, Growth, Sub Impact with weights |
| 5 | Verify "Step 5: Submit Coaching Data" includes JSON schema for `intel_payload` | Has `task_id`, `video_recommendations`, `coaching`, `notifications` |
| 6 | Verify YouTube Intelligence Reference is appended (truncated if > 8000 chars) | Domain docs from `cowork-docs-youtube.md` |

### Prompt 10: `competitor-report`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Invoke `competitor-report` (no required args) | Returns structured user message |
| 2 | Verify header includes channel name and tier | Auto-injected from `fetchChannelInfo()` |
| 3 | Verify Step 1 references correct API paths: `competitors/channels`, `competitors/outliers`, `competitors/insights` | Matches actual route paths |
| 4 | Verify Step 2 includes all analysis sections: Play of the Week, Gap Analysis, Timing, Title Patterns, Engagement, Cadence, Tags | 7 subsections present |
| 5 | Verify Step 3 asks for 3-5 prioritized actions with data references | Actionable output instructions |
| 6 | Verify YouTube Observatory Reference appended at the end | Domain docs present |

---

## Section 4: Critical User Journeys

### Journey 1: Health Coach Analysis

| Step | Actor | Action | Verify |
|------|-------|--------|--------|
| 1 | Cowork | Call `manage_ab_test` with `action: "claim_task"` | Returns task with `task_id`, `channel_id`, status changes to `claimed` |
| 2 | Cowork | Call `youtube-analyst` prompt with the `channel_id` | Prompt returned with correct channel context |
| 3 | Cowork | Call `youtube_analytics` with `action: "get_overview"` | Channel summary + recent videos returned |
| 4 | Cowork | Call `youtube_analytics` with `action: "get_grades"` | 6-axis scores for all videos |
| 5 | Cowork | Call `manage_ab_test` with `action: "get_intelligence"` | Full snapshot including existing recommendations |
| 6 | Cowork | Call `manage_ab_test` with `action: "submit_intelligence"` and `intel_payload` containing video_recommendations + coaching + notifications | Returns success with recommendation count |
| 7 | CMS UI | Navigate to YouTube > Performance in CMS | Coaching priorities visible, Cowork badge shown on task card |
| 8 | CMS UI | Verify notifications appear in CMS notification panel | optimization_available / grade_drop notifications present |

### Journey 2: Competitor Monitoring

| Step | Actor | Action | Verify |
|------|-------|--------|--------|
| 1 | Cowork | Call `youtube_observatory` with `action: "list_channels"` | All tracked competitors returned |
| 2 | Cowork | Call `youtube_observatory` with `action: "get_changes"` | Recent title/thumbnail/description changes listed |
| 3 | Cowork | Call `youtube_observatory` with `action: "get_outliers"` | Bookmarked viral videos returned |
| 4 | Cowork | Call `youtube_observatory` with `action: "get_insights"` | Aggregated intelligence with `mostActiveCompetitor`, `changesByField` |
| 5 | Cowork | Invoke `competitor-report` prompt | Full analysis template generated |
| 6 | Cowork | Identify content gap from insights | Gap has `weCover: false` and high competitor coverage |
| 7 | Cowork | Call `create_item` with format `video`, title from gap topic | Pipeline item created with tags from competitor analysis |
| 8 | CMS UI | Verify new pipeline item appears in Pipeline > Items | Item visible with correct tags and priority |

### Journey 3: Video Optimization

| Step | Actor | Action | Verify |
|------|-------|--------|--------|
| 1 | Cowork | Call `youtube_analytics` with `action: "get_grades"` | Videos sorted by score; identify grade C/D videos |
| 2 | Cowork | Call `youtube_videos` with `action: "get"` for a low-grade video | Full detail with CTR, retention, traffic sources |
| 3 | Cowork | Call `manage_ab_test` with `action: "get_suggestions"` | Video appears in suggestions list |
| 4 | Cowork | Call `manage_ab_test` with `action: "get_fatigue_alerts"` | Check if video has declining CTR alert |
| 5 | Cowork | Invoke `ab-ideate` prompt with `test_type: "thumbnail"` | Briefing prompt with channel context and test history |
| 6 | Cowork | Call `manage_ab_test` with `action: "upsert_variants"`, `test_id`, `variants: [...]`, `dry_run: true` | Dry-run preview: shows current variant count + proposed |
| 7 | Cowork | Resend with `dry_run: false` | Variants persisted, confirmation returned |
| 8 | Cowork | Invoke `ab-review` prompt with `test_id` | Review prompt evaluates variant quality and differentiation |
| 9 | CMS UI | Navigate to YouTube > A/B Lab | Test visible with variants, status = draft |

---

## Section 5: Risk Matrix

Rating: LOW / MED / HIGH. Auth = is it properly gated? Data = cross-site leak risk? Perf = timeout risk?

| # | Endpoint | Auth | Data | Perf | Notes |
|---|----------|------|------|------|-------|
| 1 | `GET competitors/channels` | LOW | LOW | LOW | |
| 2 | `GET competitors/changes` | LOW | LOW | MED | No default limit in service layer |
| 3 | `GET competitors/outliers` | LOW | LOW | LOW | |
| 4 | `GET competitors/insights` | LOW | LOW | MED | Aggregates all channels + 7d window |
| 5 | `GET analytics/overview` | LOW | LOW | LOW | |
| 6 | `GET analytics/grades` | LOW | LOW | MED | 50 videos x 90d daily data, in-memory scoring |
| 7 | `GET analytics/demographics` | LOW | LOW | LOW | Cached JSON column |
| 8 | `GET analytics/search-terms` | LOW | LOW | LOW | Cached JSON column |
| 9 | `GET/POST analytics/notes` | MED | LOW | LOW | POST requires write auth |
| 10 | `GET videos` | LOW | LOW | LOW | Cursor pagination, max 100 |
| 11 | `GET videos/:id` | LOW | LOW | LOW | |
| 12 | `GET/PATCH categories` | MED | LOW | LOW | PATCH requires write auth |
| 13 | `GET intelligence` | LOW | MED | MED | Full snapshot: 50+ videos with analytics |
| 14 | `GET intelligence/task` | LOW | LOW | LOW | |
| 15 | `PATCH intelligence` | HIGH | LOW | MED | Accepts complex nested intel_payload |
| 16-19 | `GET ab-tests[/:id][/funnel/history]` | LOW | LOW | LOW | |
| 20 | `GET ab-tests/:id/variants` | LOW | LOW | LOW | Max 4 variants |
| 21 | `POST ab-tests/:id/variants` | MED | LOW | LOW | Write auth + max 3 per upsert |
| 22 | `DELETE ab-tests/:id/variants` | HIGH | LOW | LOW | Destructive; write + confirm required |
| 23 | `GET ab-performance` | LOW | LOW | MED | Scans all completed tests, no cursor |
| 24 | `GET ab-tests/learnings` | LOW | LOW | MED | Aggregates all completed tests |
| 25 | `GET ab-tests/suggestions` | LOW | LOW | MED | Cross-refs videos with test history |
| 26-27 | `GET fatigue-alerts / dashboard` | LOW | LOW | LOW | |
| 28-29 | `GET thumbnails/fatigue,library` | LOW | LOW | LOW | |
| 30 | MCP `youtube_observatory` | LOW | LOW | LOW | Mirrors REST, inherits key auth |
| 31 | MCP `youtube_analytics` | LOW | MED | MED | `get_grades` CPU-bound scoring |
| 32 | MCP `youtube_videos` | LOW | LOW | LOW | |
| 33 | MCP `manage_ab_test` | MED | LOW | MED | Write actions gated; read actions skip permission check |

### Key Findings

- **Auth:** `PATCH intelligence` and `submit_intelligence` accept nested payloads validated only at service layer. `DELETE variants` properly gated (write + confirm).
- **Data:** No cross-site leaks found -- all queries filter by `site_id` from authenticated key context. MCP uses `getMcpContext().siteId`.
- **Perf:** `analytics/grades`, `competitors/insights`, `ab-performance`, `ab-tests/learnings` aggregate without pagination -- monitor with large datasets.
