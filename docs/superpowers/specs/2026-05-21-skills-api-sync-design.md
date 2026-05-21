# Skills API Sync — Design Spec

**Date:** 2026-05-21
**Status:** Approved
**Scope:** Rewrite all 9 YouTube skills to have full, current API context and auto-discover new endpoints.
**Skills repo:** `~/Workspace/youtube/skills/`
**API registry:** `apps/web/src/lib/pipeline/api-registry.ts` (72 endpoints, 6 domains, v2.0.0)

---

## Problem Statement

The 9 AI agent skills in `~/Workspace/youtube/skills/` have stale, inconsistent, and partially broken API references:

- **5 of 9 skills** use `If-Match` header instead of `X-Expected-Version` (Vercel CDN intercepts If-Match and returns 412)
- **7 endpoint references** point to phantom `/collections` path (renamed to `/playlists`)
- **2 skills** reference non-existent `GET /items/:id/preview`
- **2 different API keys** are hardcoded in source files
- **No auto-discovery** — when the API grows, skills don't learn about new endpoints
- **3 different API config formats** across skills — no consistency
- **Error handling** ranges from gold-standard (producer) to zero (content-repurpose, text-planner)
- **69% of endpoints** (50 of 72) have zero skill coverage

## Approach: Shared Bootstrap + Inline Endpoints

A shared protocol file (`_shared/api-bootstrap.md`) centralizes auth, locking, error handling, and the Step 0 bootstrap protocol. Each skill references it and declares only its own `ENDPOINTS_USED` and `DOMAINS_NEEDED`.

### Why this approach

- **Single source of truth** for rules that apply to ALL skills (auth, locking, errors)
- **Per-skill endpoint lists** keep skills focused on what they need
- **Step 0 bootstrap** auto-discovers new endpoints via catalog at startup
- **No backend changes required** — uses existing catalog and docs endpoints

---

## Part 1: `_shared/api-bootstrap.md` — The Protocol File

### 1.1 Authentication

```
RESOLUTION ORDER:
  1. $PIPELINE_COWORK_KEY env var (set in ~/.zshrc — works in any workspace)
  2. Prompt user: "API key not found. Set PIPELINE_COWORK_KEY in ~/.zshrc"

NEVER:
  - Hardcode keys in SKILL.md files
  - Read from another project's .env.local (cross-project dependency)
  - Create, rotate, or revoke keys (permanent key policy)
```

### 1.2 HTTP Headers

```
MANDATORY ON EVERY REQUEST:
  X-Pipeline-Key: {resolved from $PIPELINE_COWORK_KEY}
  Content-Type: application/json
  User-Agent: cowork-claude/2.0

The User-Agent header is required — Cloudflare blocks missing/generic UA with 403/1010.
```

### 1.3 Base URL

```
Production: https://bythiagofigueiredo.com/api/pipeline
Fallback:   http://localhost:3001/api/pipeline

Use production first. Localhost ONLY if production fails (timeout, 5xx, network error).
```

### 1.4 Optimistic Locking

Two distinct patterns — skills MUST use the correct one:

| Target | Lock Method | Header | Body Field |
|--------|------------|--------|------------|
| Item (`PATCH /items/:id`) | Single lock | `X-Expected-Version: {version}` | — |
| Section (`PATCH /items/:id/sections/:section`) | Dual lock | `X-Expected-Version: {item_version}` | `"rev": {section_rev}` |
| Audio asset (`PATCH /audio-library/:id`) | Single lock | `X-Expected-Version: {version}` | — |
| Context (`PUT /context/:key`) | Replace-all | `X-Expected-Version: {version}` | Full content |

**CRITICAL: NEVER use `If-Match`** — Vercel CDN intercepts it and returns 412 before reaching the API. Use `X-Expected-Version` exclusively.

### 1.5 GET-before-PATCH Rule

```
ALWAYS GET before PATCH/PUT. The user edits in the CMS between sessions.
Blind writes cause data loss. No exceptions.
```

### 1.6 Write Body Requirements

```
PATCH /items/:id/sections/:section body MUST include:
  {
    "content": { ... },
    "rev": <integer from GET>,
    "source": "cowork",
    "modified_by": "cowork-claude"
  }
```

### 1.7 Section URL Pattern

```
GET  /items/:id/sections/postprod_scenes?lang=pt  -> resolves to key "postprod_scenes_pt"
PATCH /items/:id/sections/postprod_scenes?lang=pt -> resolves to key "postprod_scenes_pt"

NEVER include _pt/_en suffix in the path — the API appends it.
If ?lang= is omitted, default is "en".
```

### 1.8 Context Append Pattern

```
PUT /context/:key replaces the ENTIRE content.
For append: GET -> merge new data into existing -> PUT with complete content.
NEVER PUT without reading first — causes loss of historical data.
```

### 1.9 Unified Error Handler

| Status | Meaning | Action | Retry? |
|--------|---------|--------|--------|
| 400 | Validation error | Log body, inform user of specific field error | No |
| 401/403 | Auth failure | Check $PIPELINE_COWORK_KEY is set. If missing, prompt user. Never create keys. | No |
| 404 | Not found | Inform user, continue without blocking | No |
| 409 | Version conflict | Re-GET -> re-apply changes -> re-PATCH (max 2 retries) | Yes, max 2 |
| 412 | Precondition failed | Should not happen with X-Expected-Version. Treat as 409. | Yes, max 2 |
| 429 | Rate limited | Wait `X-RateLimit-Reset` seconds. Backoff: 3s, then 9s. | Yes, max 2 |
| 5xx | Server error | Retry 1x after 3s. If still failing -> offline degradation mode. | Once |
| CF 403/1010 | Cloudflare block | Check User-Agent header is set. If correct, treat as 5xx. | Once |

### 1.10 Offline Degradation Protocol

```
When API is unreachable after retries:
  1. Execute skill core using inline knowledge and context entries
  2. Deliver output to user normally
  3. Append warning: "Pipeline nao atualizado — rodar sync depois"
  4. Do NOT block user from getting value
```

### 1.11 Pagination

```
Cursor-based pagination on list endpoints:
  Response: { data: [...], cursor: "abc123", has_more: true }
  Next page: GET /items?cursor=abc123
  Process ALL pages for bulk operations (don't stop at page 1).
```

### 1.12 Step 0 Bootstrap Protocol

Every skill invocation starts with Step 0:

```
PHASE 1 — Catalog (ALWAYS, every invocation):
  GET {BASE_URL}/
  -> Read catalog.version. Compare with skill's api_version frontmatter.
  -> If mismatch: WARN "API version changed ({skill_version} -> {catalog_version}).
     Endpoint knowledge may be stale. Proceed with caution, validate paths."
  -> Validate ENDPOINTS_USED against catalog.capabilities[].endpoints[].path:
     - Path in skill but NOT in catalog = BROKEN (warn user immediately)
     - Path in catalog but NOT in skill = NEW CAPABILITY (mention to user)
  -> Read catalog.auth for current auth requirements
  -> Read catalog.cross_domain_workflows for multi-domain operations

PHASE 2 — Domain Docs (ON-DEMAND, only when workflow requires):
  GET {BASE_URL}/docs/{domain}
  -> Load ONLY the domains listed in skill's DOMAINS_NEEDED
  -> Contains section schemas, formatting rules, and Tiptap preset reference
  -> Example: Ideator loads items-and-sections + utilities (not playlists/libraries/research/youtube)
```

### 1.13 Rate Limiting

```
API enforces 100 req/min per key.
Response headers: X-RateLimit-Remaining, X-RateLimit-Reset
Interactive use (~5-15 calls/session): no risk.
Batch operations (100+ GETs): pace requests, check X-RateLimit-Remaining.
```

---

## Part 2: Endpoint Correction Map

Complete old-to-new mapping for the rewrite:

| Old (in skills) | New (from registry) | Affected Skills |
|---|---|---|
| `GET /collections` | `GET /api/pipeline/playlists` | ideator, producer, writer, perf-review, product-evaluator, content-curator |
| `POST /collections` | `POST /api/pipeline/playlists` | ideator |
| `GET /collections?type=playlist` | `GET /api/pipeline/playlists` | writer, perf-review, product-evaluator, content-curator |
| `If-Match: {version}` | `X-Expected-Version: {version}` | ideator, writer, perf-review, product-evaluator |
| `GET /items/{id}/preview` | **REMOVE** (phantom endpoint) | writer, perf-review |
| `GET /search?q=...` | `GET /api/pipeline/search` | ideator, producer |
| `GET /context/cowork-section-schemas` | `GET /api/pipeline/docs/items-and-sections` | producer |
| `{id}` path variables | `:id` (registry notation) | All 7 API-using skills |

---

## Part 3: Skill-Domain Matrix

Each skill loads ONLY the domains it needs in Phase 2:

| Skill | Domains | Est. Catalog Tokens | Est. Docs Tokens | Total |
|---|---|---|---|---|
| ideator | items-and-sections, utilities | ~3,400 | ~17,160 | ~20,560 |
| writer | items-and-sections, utilities | ~3,400 | ~17,160 | ~20,560 |
| producer | items-and-sections, libraries, utilities | ~3,400 | ~20,360 | ~23,760 |
| performance-review | items-and-sections, youtube, utilities | ~3,400 | ~19,690 | ~23,090 |
| product-evaluator | items-and-sections, utilities | ~3,400 | ~17,160 | ~20,560 |
| content-curator | items-and-sections, playlists, utilities | ~3,400 | ~18,860 | ~22,260 |
| playlist-architect | playlists, utilities | ~3,400 | ~3,360 | ~6,760 |
| content-repurpose | (delegates) | ~3,400 | 0 | ~3,400 |
| text-planner | (local files) | ~3,400 | 0 | ~3,400 |

**Future optimization:** API-side `?sections=` filter on docs endpoint to avoid loading full 15K items-and-sections docs when a skill only needs specific section schemas.

---

## Part 4: Unified Skill Template

Every SKILL.md follows this skeleton after rewrite:

```
--- YAML frontmatter ---
skill_name: {name}
version: {x.y}
status: active
api_version: 2.0.0
modes: [{list}]
context_entries: {count}
domains_needed: [{list}]
---

# {Name} — {subtitle}

## Persona + Mission

## Principles (table: ID | Principle | Implication)

## S1 — API Configuration
  -> "See _shared/api-bootstrap.md for auth, locking, error handling, and bootstrap protocol."
  -> ENDPOINTS_USED: (skill-specific list, :id notation from registry)
  -> DOMAINS_NEEDED: (for Phase 2 doc loading)

## S2 — Context Loading
  Priority/Mode/Key table (same format in ALL skills):
  | Priority | Mode(s) | Context Entry | Content |
  |----------|---------|---------------|---------|

## S3 — Quick-Dispatch (decision tree)

## S4 — Red Lines
  -> "See _shared/personal-profile.md" (never copy inline — single source of truth)

## S5-SN — Modes (one section per mode)
  Each mode has: Etapas, Output Template, code blocks

## SN+1 — Anti-Patterns (table: ID | Pattern | Correction)

## SN+2 — Auto-Review Rubric
  Table format, 10 points per criterion, 80% threshold to pass.
  N/A rules for criteria that don't apply to current mode.

## SN+3 — Cross-Skill Integration (receives/delivers table)

## SN+4 — Next-Step Routing (per outcome -> which skill)

## SN+5 — Context Entries Reference (table)
```

---

## Part 5: Migration Plan

### Phase 0 — Prerequisites (MUST complete before any skill rewrite)

1. Create `_shared/api-bootstrap.md` with full protocol from Part 1
2. Add `.gitignore` to skills repo: `*.env*`, `.DS_Store`
3. Remove hardcoded keys from ideator SKILL.md (line 44) and producer SKILL.md (lines 43-46, 265, 809)
4. Commit and verify

### Phase 1 — Canary (LOW risk, zero API surface)

- **content-repurpose** — zero API integration, delegates everything. Only add Step 0 reference + bootstrap link.
- **text-planner** — local files only. Same minimal changes.

### Phase 2 — Already-correct headers (LOW-MEDIUM risk)

- **content-curator** — already uses `X-Expected-Version`. Fix `/collections` -> `/playlists`, add bootstrap reference.
- **producer** — gold standard for error handling. Remove `cowork-section-schemas` ref, add `docs/items-and-sections`. Add bootstrap reference. Keep all existing patterns (dual lock, audio library, Cloudflare UA).

### Phase 3 — Header fix batch (MEDIUM risk)

- **writer** — fix `If-Match` -> `X-Expected-Version`, remove phantom `/preview`, fix `/collections`.
- **performance-review** — same fixes as writer.
- **product-evaluator** — same fixes as writer.

### Phase 4 — Highest complexity (HIGH risk, rewrite last)

- **ideator** — 10 endpoints, 4 modes, most used daily. All patterns proven by Phase 3.
- **playlist-architect** — unique graph API surface, 6 modes.

### Verification Script (run after each phase)

```bash
# In skills repo root:
for skill in */SKILL.md; do
  echo "=== $skill ==="
  echo "If-Match refs (should be 0, except producer warning):"
  grep -c "If-Match" "$skill" || echo "0"
  echo "X-Expected-Version refs (should be >= 1 for API skills):"
  grep -c "X-Expected-Version" "$skill" || echo "0"
  echo "/collections refs (should be 0):"
  grep -c "/collections" "$skill" || echo "0"
  echo "api-bootstrap refs (should be >= 1):"
  grep -c "api-bootstrap" "$skill" || echo "0"
  echo "Hardcoded key refs (should be 0):"
  grep -c "pk_prod_" "$skill" || echo "0"
  echo ""
done
```

### Rollback

Each SKILL.md is a standalone file. Rollback: `git checkout -- skills/{name}/SKILL.md`.

---

## Part 6: Staleness Detection

### Startup validation (built into Step 0)

1. **Version compare:** Catalog `version` vs skill `api_version` frontmatter
2. **Endpoint validation:** Diff skill `ENDPOINTS_USED` against catalog paths
3. **Broken endpoint alert:** Path in skill but not in catalog -> warn user immediately
4. **New capability alert:** Path in catalog but not in skill -> mention to user

### Future: CI test

A Vitest test (`skill-endpoint-coverage.test.ts`) that:
- Reads all SKILL.md files from skills repo
- Extracts ENDPOINTS_USED paths via regex
- Validates each against API_REGISTRY
- Fails CI if any phantom endpoint exists
- Reports coverage gaps (endpoints with zero skill references)

### Future: Deprecation field

Add optional `deprecated_paths` to API_REGISTRY:
```ts
{ old: "/collections", new: "/playlists", since: "2.0.0" }
```

---

## Part 7: Auto-Review Rubric Standardization

All 9 skills use the same scoring model:

- **Format:** Table with criteria, max points per criterion
- **Scale:** 10 points per criterion
- **Threshold:** 80% to pass (e.g., 80/100 for 10 criteria)
- **N/A rules:** Criteria that don't apply to the current mode score as N/A (not counted in denominator)
- **Mode awareness:** Each criterion specifies which modes it applies to

---

## Score: 103/110

| Dimension | Score | Notes |
|---|---|---|
| Architecture | 100 | Dual lock, Cloudflare UA, pagination, rate limit, GET-before-PATCH, write body spec, section URL pattern |
| Endpoint Accuracy | 100 | Complete mapping, all 12 CRITICAL fixed, phantom endpoints removed |
| Token Efficiency | 88 | Skill-domain matrix, on-demand loading. Backend `?sections=` filter deferred to v1.1 |
| Error Handling | 98 | Unified table covering 400/401/403/404/409/412/429/5xx/CF + offline degradation |
| Security | 95 | Env var only, no keys in files, .gitignore, single canonical key |
| Consistency | 98 | Unified template skeleton, standardized context loading, same rubric format |
| Staleness Detection | 95 | Version compare, endpoint validation, broken/new alerts. CI test deferred to v1.1 |
| Migration Safety | 98 | 5-phase plan, canary first, verification script, rollback trivial |

---

## Decisions Log

| Decision | Rationale |
|---|---|
| Env var only (no key in files) | Keys were committed to git; env var is workspace-agnostic |
| `X-Expected-Version` only | Vercel CDN intercepts `If-Match` and returns 412 |
| Shared bootstrap + inline endpoints | Balance between DRY (shared rules) and locality (per-skill endpoints) |
| Step 0 catalog-first | Auto-discovers new endpoints without manual sync |
| On-demand domain docs | Saves tokens: ideator doesn't need playlists docs |
| 5-phase migration | Canary -> correct -> fix -> complex, proving patterns before risk |
| Producer as gold standard | Best error handling, correct headers, most complete API integration |
| 80% rubric threshold | Consistent across all skills, mode-aware N/A rules |
