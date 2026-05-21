# Skills API Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite all 9 YouTube skills to have full, current API context via a shared bootstrap protocol, fix all broken endpoints, and enable auto-discovery of new endpoints.

**Architecture:** A shared protocol file (`_shared/api-bootstrap.md`) centralizes auth, locking, error handling, and Step 0 bootstrap. Each skill references it and declares only its own ENDPOINTS_USED and DOMAINS_NEEDED. Migration follows 5 phases: prerequisites, canary, already-correct, header-fix, highest-complexity.

**Tech Stack:** Markdown skill files, Content Pipeline API (72 endpoints, 6 domains, v2.0.0), `$PIPELINE_COWORK_KEY` env var.

**Spec:** `docs/superpowers/specs/2026-05-21-skills-api-sync-design.md`

**Target repo:** `~/Workspace/youtube/skills/`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `_shared/api-bootstrap.md` | Fix (already drafted) | Shared API protocol — auth, locking, errors, Step 0 |
| `.gitignore` | Create | Exclude env files and OS files |
| `ideator/SKILL.md` | Modify | Fix key, If-Match, /collections, add bootstrap ref |
| `producer/SKILL.md` | Modify | Remove hardcoded keys, fix /collections, cowork-section-schemas |
| `writer/SKILL.md` | Modify | Fix If-Match, remove /preview, fix /collections |
| `performance-review/SKILL.md` | Modify | Fix If-Match, fix /collections |
| `product-evaluator/SKILL.md` | Modify | Fix If-Match, fix /collections |
| `content-curator/SKILL.md` | Modify | Remove hardcoded key, fix /collections |
| `playlist-architect/SKILL.md` | Modify | Remove hardcoded key |
| `content-repurpose/SKILL.md` | Modify | Add Step 0 bootstrap reference |
| `text-planner/SKILL.md` | Modify | Add Step 0 bootstrap reference |

---

### Task 1: Fix `_shared/api-bootstrap.md`

The file was auto-drafted and needs corrections to match the API registry.

**Files:**
- Fix: `~/Workspace/youtube/skills/_shared/api-bootstrap.md`

- [ ] **Step 1: Fix the catalog JSON example (line 72-81)**

The example shows incorrect domain names. Replace the entire JSON block:

```markdown
OLD (lines 70-81):
```json
{
  "version": "1.4.0",
  "endpoints": [
    { "path": "/items", "methods": ["GET", "POST"] },
    { "path": "/items/:id", "methods": ["GET", "PATCH", "DELETE"] },
    { "path": "/items/:id/sections/:section", "methods": ["GET", "PATCH"] },
    ...
  ],
  "domains": ["items", "sections", "context", "collections", "audio-library", "stats"]
}
```

NEW:
```json
{
  "name": "Content Pipeline API",
  "version": "2.0.0",
  "auth": { "header": "X-Pipeline-Key", "version_header": "X-Expected-Version" },
  "capabilities": [
    { "domain": "items-and-sections", "endpoint_count": 17 },
    { "domain": "playlists", "endpoint_count": 13 },
    { "domain": "libraries", "endpoint_count": 15 },
    { "domain": "research", "endpoint_count": 12 },
    { "domain": "youtube", "endpoint_count": 7 },
    { "domain": "utilities", "endpoint_count": 8 }
  ]
}
```

- [ ] **Step 2: Fix path variable notation in locking table (lines 109-112)**

Replace `{id}` and `{section}` with `:id` and `:section` to match registry:

```
OLD: | Item | `PATCH /items/{id}` | Header: `X-Expected-Version: {item.version}` |
NEW: | Item | `PATCH /items/:id` | Header: `X-Expected-Version: {item.version}` |

OLD: | Section | `PATCH /items/{id}/sections/{section}` | Header: `X-Expected-Version: {item.version}` AND body field: `"rev": {section.rev}` |
NEW: | Section | `PATCH /items/:id/sections/:section` | Header: `X-Expected-Version: {item.version}` AND body field: `"rev": {section.rev}` |

OLD: | Audio asset | `PATCH /audio-library/{id}` | Header: `X-Expected-Version: {asset.version}` |
NEW: | Audio asset | `PATCH /audio-library/:id` | Header: `X-Expected-Version: {asset.version}` |

OLD: | Context | `PUT /context/{key}` | Header: `X-Expected-Version: {context.version}` |
NEW: | Context | `PUT /context/:key` | Header: `X-Expected-Version: {context.version}` |
```

- [ ] **Step 3: Fix path notation in section URL examples (lines 171-172)**

```
OLD: CORRECT:   GET /items/{id}/sections/postprod_scenes?lang=pt
NEW: CORRECT:   GET /items/:id/sections/postprod_scenes?lang=pt

OLD: INCORRECT: GET /items/{id}/sections/postprod_scenes_pt
NEW: INCORRECT: GET /items/:id/sections/postprod_scenes_pt
```

- [ ] **Step 4: Add frontmatter version tag at the top of the file**

Insert after line 1:

```markdown
> **API version:** 2.0.0
```

- [ ] **Step 5: Verify the file**

```bash
cd ~/Workspace/youtube/skills
grep -c "collections" _shared/api-bootstrap.md    # should be 0
grep -c "If-Match" _shared/api-bootstrap.md        # should be 1 (the warning not to use it)
grep -c "X-Expected-Version" _shared/api-bootstrap.md  # should be >= 5
grep -c "{id}" _shared/api-bootstrap.md             # should be 0 (all :id now)
```

---

### Task 2: Create `.gitignore`

**Files:**
- Create: `~/Workspace/youtube/skills/.gitignore`

- [ ] **Step 1: Write the file**

```
*.env*
.DS_Store
```

- [ ] **Step 2: Verify**

```bash
cat ~/Workspace/youtube/skills/.gitignore
```

---

### Task 3: Phase 0 — Remove hardcoded keys from ideator

**Files:**
- Modify: `~/Workspace/youtube/skills/ideator/SKILL.md:5,44`

- [ ] **Step 1: Update frontmatter api_version (line 5)**

```
OLD: api_version: pipeline-v1
NEW: api_version: 2.0.0
```

- [ ] **Step 2: Replace hardcoded key with env var reference (line 44)**

```
OLD: AUTH_HEADER: "X-Pipeline-Key: pk_prod_dd13dc703eef9e32f40b8f8982f9aa2e0af92f211bbc34ce857c054af2a8925c"
NEW: AUTH_HEADER: "X-Pipeline-Key: {from $PIPELINE_COWORK_KEY — see _shared/api-bootstrap.md}"
```

- [ ] **Step 3: Verify no keys remain**

```bash
grep -c "pk_prod_" ~/Workspace/youtube/skills/ideator/SKILL.md  # should be 0
```

---

### Task 4: Phase 0 — Remove hardcoded keys from producer

**Files:**
- Modify: `~/Workspace/youtube/skills/producer/SKILL.md:5,44-46,264,807`

- [ ] **Step 1: Update frontmatter api_version (line 5)**

```
OLD: api_version: pipeline-v1
NEW: api_version: 2.0.0
```

- [ ] **Step 2: Replace auth header block (lines 44-46)**

```
OLD:
AUTH_HEADER: "X-Pipeline-Key: <from PIPELINE_COWORK_KEY in .env.local>"
# Current key: pk_prod_91a4b68ad89b4ca708d128ca580a6edf34df0fcad20d5f14
# NEVER create new keys or revoke. If UNAUTHORIZED → read apps/web/.env.local

NEW:
AUTH_HEADER: "X-Pipeline-Key: {from $PIPELINE_COWORK_KEY — see _shared/api-bootstrap.md}"
```

- [ ] **Step 3: Remove hardcoded key in Python code block (line 264)**

```
OLD: KEY = "pk_prod_91a4b68ad89b4ca708d128ca580a6edf34df0fcad20d5f14"
NEW: KEY = os.environ["PIPELINE_COWORK_KEY"]
```

- [ ] **Step 4: Remove hardcoded key in second Python code block (line 807)**

```
OLD: KEY = "pk_prod_91a4b68ad89b4ca708d128ca580a6edf34df0fcad20d5f14"
NEW: KEY = os.environ["PIPELINE_COWORK_KEY"]
```

- [ ] **Step 5: Verify no keys remain**

```bash
grep -c "pk_prod_" ~/Workspace/youtube/skills/producer/SKILL.md  # should be 0
```

---

### Task 5: Phase 0 — Remove hardcoded keys from content-curator and playlist-architect

**Files:**
- Modify: `~/Workspace/youtube/skills/content-curator/SKILL.md:5,48`
- Modify: `~/Workspace/youtube/skills/playlist-architect/SKILL.md:5,50`

- [ ] **Step 1: content-curator — Update frontmatter (line 5)**

```
OLD: api_version: pipeline-v1
NEW: api_version: 2.0.0
```

- [ ] **Step 2: content-curator — Replace hardcoded key (line 48)**

```
OLD: AUTH_HEADER: "X-Pipeline-Key: pk_prod_dd13dc703eef9e32f40b8f8982f9aa2e0af92f211bbc34ce857c054af2a8925c"
NEW: AUTH_HEADER: "X-Pipeline-Key: {from $PIPELINE_COWORK_KEY — see _shared/api-bootstrap.md}"
```

- [ ] **Step 3: playlist-architect — Update frontmatter (line 5)**

```
OLD: api_version: pipeline-v1
NEW: api_version: 2.0.0
```

- [ ] **Step 4: playlist-architect — Replace hardcoded key (line 50)**

```
OLD: AUTH_HEADER: "X-Pipeline-Key: pk_prod_dd13dc703eef9e32f40b8f8982f9aa2e0af92f211bbc34ce857c054af2a8925c"
NEW: AUTH_HEADER: "X-Pipeline-Key: {from $PIPELINE_COWORK_KEY — see _shared/api-bootstrap.md}"
```

- [ ] **Step 5: Verify no keys remain in any skill**

```bash
cd ~/Workspace/youtube/skills
grep -rn "pk_prod_" */SKILL.md  # should return NOTHING
```

---

### Task 6: Phase 0 — Commit prerequisites

- [ ] **Step 1: Commit all Phase 0 changes**

```bash
cd ~/Workspace/youtube/skills
git add _shared/api-bootstrap.md .gitignore ideator/SKILL.md producer/SKILL.md content-curator/SKILL.md playlist-architect/SKILL.md
git commit -m "fix: remove hardcoded API keys, add bootstrap protocol and .gitignore

Phase 0 of Skills API Sync migration:
- Create _shared/api-bootstrap.md with unified API protocol
- Create .gitignore (*.env*, .DS_Store)
- Remove pk_prod_ keys from 4 skills (ideator, producer, curator, architect)
- Update api_version frontmatter to 2.0.0

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Phase 1 — Canary: content-repurpose

**Files:**
- Modify: `~/Workspace/youtube/skills/content-repurpose/SKILL.md`

- [ ] **Step 1: Add api_version to frontmatter**

After `status: active` line, add:

```
api_version: 2.0.0
```

- [ ] **Step 2: Add Step 0 reference section after the principles section**

Insert a new section before the format DNA section:

```markdown
---

## API Bootstrap

This skill delegates API operations to other skills but still participates in Step 0 for version awareness.

See `_shared/api-bootstrap.md` for the full API protocol.

**Step 0:** At session start, `GET {BASE_URL}/` to verify catalog version matches `api_version: 2.0.0`.
If version mismatch, warn user before delegating to any skill.

ENDPOINTS_USED: (none — this skill delegates to writer, newsletter-writer, social skills)
DOMAINS_NEEDED: []
```

---

### Task 8: Phase 1 — Canary: text-planner

**Files:**
- Modify: `~/Workspace/youtube/skills/text-planner/SKILL.md`

- [ ] **Step 1: Add api_version to frontmatter**

After `status: active` line, add:

```
api_version: 2.0.0
```

- [ ] **Step 2: Add Step 0 reference section**

Insert a new section before the Filosofia section:

```markdown
---

## API Bootstrap

This skill primarily uses local files but participates in Step 0 for version awareness.

See `_shared/api-bootstrap.md` for the full API protocol.

**Step 0:** At session start, `GET {BASE_URL}/` to verify catalog version matches `api_version: 2.0.0`.

ENDPOINTS_USED:
  - GET /api/pipeline/context/:key     # load personal-profile, text-pathways, memory
  - PUT /api/pipeline/context/:key     # update text-pathways + memory (GET→merge→PUT)

DOMAINS_NEEDED: [utilities]
```

---

### Task 9: Phase 1 — Commit canary

- [ ] **Step 1: Commit**

```bash
cd ~/Workspace/youtube/skills
git add content-repurpose/SKILL.md text-planner/SKILL.md
git commit -m "feat: add Step 0 bootstrap to canary skills (content-repurpose, text-planner)

Phase 1 of Skills API Sync migration:
- Add api_version: 2.0.0 frontmatter
- Add bootstrap reference and Step 0 protocol
- Zero API surface skills — lowest risk

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Phase 2 — Fix content-curator

Content-curator already uses `X-Expected-Version` (correct). Only needs `/collections` fix and bootstrap reference.

**Files:**
- Modify: `~/Workspace/youtube/skills/content-curator/SKILL.md:44,56`

- [ ] **Step 1: Add bootstrap reference at start of API config (after line 44, before the yaml block)**

Insert before the yaml code block opening:

```markdown
> See `_shared/api-bootstrap.md` for auth, locking, error handling, and Step 0 bootstrap protocol.
```

- [ ] **Step 2: Fix /collections endpoint (line 56)**

```
OLD:   - GET /collections?type=playlist         # playlists existentes
NEW:   - GET /playlists                          # playlists existentes
```

- [ ] **Step 3: Verify**

```bash
grep -c "/collections" ~/Workspace/youtube/skills/content-curator/SKILL.md  # should be 0
grep -c "api-bootstrap" ~/Workspace/youtube/skills/content-curator/SKILL.md  # should be >= 1
```

---

### Task 11: Phase 2 — Fix producer

Producer already uses `X-Expected-Version` (correct). Needs: `/collections` fix, `cowork-section-schemas` fix, and bootstrap reference.

**Files:**
- Modify: `~/Workspace/youtube/skills/producer/SKILL.md:40,55,104,117,408,1044,1070`

- [ ] **Step 1: Add bootstrap reference at start of API config section (before line 42)**

Insert after the `## §1 — API Configuration` heading:

```markdown
> See `_shared/api-bootstrap.md` for auth, locking, error handling, and Step 0 bootstrap protocol.
```

- [ ] **Step 2: Fix /collections endpoint (line 55)**

```
OLD:   - GET /collections                 # playlists/séries
NEW:   - GET /playlists                   # playlists/séries
```

- [ ] **Step 3: Fix cowork-section-schemas reference (line 104)**

```
OLD: GET /context/cowork-section-schemas
NEW: GET {BASE_URL}/docs/items-and-sections
```

- [ ] **Step 4: Fix cowork-section-schemas in context loading table (line 117)**

```
OLD: | 0 | PRODUCE / Import | `cowork-section-schemas` (§Audio Library) | Schema do resolver, formatos, import |
NEW: | 0 | PRODUCE / Import | `docs/items-and-sections` (via Step 0 Phase 2) | Schema do resolver, formatos, import |
```

- [ ] **Step 5: Fix cowork-section-schemas deep reference (line 408)**

```
OLD: `GET /context/cowork-section-schemas` (seção "postprod_scenes")
NEW: `GET {BASE_URL}/docs/items-and-sections` (seção "postprod_scenes")
```

- [ ] **Step 6: Fix cowork-section-schemas in context entries table (line 1044)**

```
OLD: | `cowork-section-schemas` (§Audio Library) | API da Audio Library: resolver, import, schemas, scoring | ~3000 |
NEW: | `docs/items-and-sections` (via Step 0 Phase 2) | API da Audio Library: resolver, import, schemas, scoring | ~3000 |
```

- [ ] **Step 7: Fix /collections deep reference (line 1070)**

```
OLD: Via API: `GET /collections` retorna playlists ativas. Mapear vídeo à playlist correta no PUBLISH.
NEW: Via API: `GET /playlists` retorna playlists ativas. Mapear vídeo à playlist correta no PUBLISH.
```

- [ ] **Step 8: Verify**

```bash
grep -c "/collections" ~/Workspace/youtube/skills/producer/SKILL.md       # should be 0
grep -c "cowork-section-schemas" ~/Workspace/youtube/skills/producer/SKILL.md  # should be 0
grep -c "api-bootstrap" ~/Workspace/youtube/skills/producer/SKILL.md      # should be >= 1
```

---

### Task 12: Phase 2 — Commit

- [ ] **Step 1: Commit**

```bash
cd ~/Workspace/youtube/skills
git add content-curator/SKILL.md producer/SKILL.md
git commit -m "fix: update content-curator and producer API refs, add bootstrap

Phase 2 of Skills API Sync migration:
- content-curator: /collections → /playlists, add bootstrap ref
- producer: /collections → /playlists, cowork-section-schemas → docs/items-and-sections
- producer: remove all cowork-section-schemas refs (4 occurrences)
- Both skills already use correct X-Expected-Version header

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 13: Phase 3 — Fix writer

Writer needs: `If-Match` → `X-Expected-Version`, remove `/preview`, fix `/collections`, add bootstrap.

**Files:**
- Modify: `~/Workspace/youtube/skills/writer/SKILL.md:5,32,55,56,62,340,779`

- [ ] **Step 1: Update frontmatter api_version (line 5)**

```
OLD: api_version: 1.0
NEW: api_version: 2.0.0
```

- [ ] **Step 2: Add bootstrap reference before the API config block (around line 32)**

Insert after `## API Configuration` heading:

```markdown
> See `_shared/api-bootstrap.md` for auth, locking, error handling, and Step 0 bootstrap protocol.
```

- [ ] **Step 3: Fix If-Match in endpoint table (line 55)**

```
OLD: | Atualizar item | `PATCH /items/{id}` + `If-Match: {version}` | Adicionar tags ao item |
NEW: | Atualizar item | `PATCH /items/:id` + `X-Expected-Version: {version}` | Adicionar tags ao item |
```

- [ ] **Step 4: Remove phantom /preview endpoint (line 56)**

```
OLD: | Preview HTML | `GET /items/{id}/preview` | Etapa 4b — obter HTML renderizado do draft (se disponível) |
NEW: (DELETE this entire line — endpoint does not exist in the API registry)
```

- [ ] **Step 5: Fix If-Match in security rules (line 62)**

```
OLD: **PATCH /items/{id} requer `If-Match: {version}`** obtido do GET prévio. Se versão divergir, API retorna 409 Conflict — refazer GET e reaplicar.
NEW: **PATCH /items/:id requer `X-Expected-Version: {version}`** obtido do GET prévio. Se versão divergir, API retorna 409 Conflict — refazer GET e reaplicar.
```

- [ ] **Step 6: Fix /preview in CMS preview section (line 340)**

```
OLD: 1. **CMS preview (se disponível):** `GET /items/{id}/preview` retorna HTML renderizado — usar diretamente
NEW: 1. **CMS preview (se disponível):** `GET /items/:id` retorna conteúdo completo — renderizar markdown do campo content
```

- [ ] **Step 7: Fix /collections deep reference (line 779)**

```
OLD: Fonte canônica: `GET /collections?type=playlist`
NEW: Fonte canônica: `GET /playlists`
```

- [ ] **Step 8: Verify**

```bash
cd ~/Workspace/youtube/skills
grep -c "If-Match" writer/SKILL.md          # should be 0
grep -c "/collections" writer/SKILL.md      # should be 0
grep -c "/preview" writer/SKILL.md          # should be 0
grep -c "X-Expected-Version" writer/SKILL.md # should be >= 1
grep -c "api-bootstrap" writer/SKILL.md     # should be >= 1
```

---

### Task 14: Phase 3 — Fix performance-review

**Files:**
- Modify: `~/Workspace/youtube/skills/performance-review/SKILL.md:5,30,55,61,73,264,517`

- [ ] **Step 1: Update frontmatter api_version (line 5)**

```
OLD: api_version: 1.0
NEW: api_version: 2.0.0
```

- [ ] **Step 2: Add bootstrap reference after API Configuration heading (around line 30)**

```markdown
> See `_shared/api-bootstrap.md` for auth, locking, error handling, and Step 0 bootstrap protocol.
```

- [ ] **Step 3: Fix If-Match in endpoint table (line 55)**

```
OLD: | Atualizar item | `PATCH /items/{id}` + `If-Match: {version}` | Adicionar tags de review ao item |
NEW: | Atualizar item | `PATCH /items/:id` + `X-Expected-Version: {version}` | Adicionar tags de review ao item |
```

- [ ] **Step 4: Fix If-Match in security rules (line 61)**

```
OLD: **PATCH /items/{id} requer `If-Match: {version}`** obtido do GET prévio.
NEW: **PATCH /items/:id requer `X-Expected-Version: {version}`** obtido do GET prévio.
```

- [ ] **Step 5: Fix /collections reference (line 73)**

```
OLD: Fonte canônica: `GET /collections?type=playlist` — consultar se precisar IDs.
NEW: Fonte canônica: `GET /playlists` — consultar se precisar IDs.
```

- [ ] **Step 6: Fix If-Match in tagging workflow (line 264)**

```
OLD: `GET /items/{id}` (obter `version`) → `PATCH /items/{id}` com `If-Match: {version}`:
NEW: `GET /items/:id` (obter `version`) → `PATCH /items/:id` com `X-Expected-Version: {version}`:
```

- [ ] **Step 7: Fix If-Match in post-review step (line 517)**

```
OLD: 2. `GET /items/{id}` → merge tags → `PATCH /items/{id}` com `If-Match: {version}` (tags: `vps:{score}`, `vps-zone:{zona}`, `reviewed:{data}`)
NEW: 2. `GET /items/:id` → merge tags → `PATCH /items/:id` com `X-Expected-Version: {version}` (tags: `vps:{score}`, `vps-zone:{zona}`, `reviewed:{data}`)
```

- [ ] **Step 8: Verify**

```bash
grep -c "If-Match" ~/Workspace/youtube/skills/performance-review/SKILL.md   # should be 0
grep -c "/collections" ~/Workspace/youtube/skills/performance-review/SKILL.md  # should be 0
grep -c "X-Expected-Version" ~/Workspace/youtube/skills/performance-review/SKILL.md  # should be >= 3
```

---

### Task 15: Phase 3 — Fix product-evaluator

**Files:**
- Modify: `~/Workspace/youtube/skills/product-evaluator/SKILL.md:5,30,55,56,62,74,566`

- [ ] **Step 1: Update frontmatter api_version (line 5)**

```
OLD: api_version: 1.0
NEW: api_version: 2.0.0
```

- [ ] **Step 2: Add bootstrap reference after API Configuration heading (around line 30)**

```markdown
> See `_shared/api-bootstrap.md` for auth, locking, error handling, and Step 0 bootstrap protocol.
```

- [ ] **Step 3: Fix /collections in endpoint table (line 55)**

```
OLD: | Listar playlists | `GET /collections?type=playlist` | IDs e nomes das playlists |
NEW: | Listar playlists | `GET /playlists` | IDs e nomes das playlists |
```

- [ ] **Step 4: Fix If-Match in endpoint table (line 56)**

```
OLD: | Atualizar item | `PATCH /items/{id}` + `If-Match: {version}` | Tags de avaliação |
NEW: | Atualizar item | `PATCH /items/:id` + `X-Expected-Version: {version}` | Tags de avaliacao |
```

- [ ] **Step 5: Fix If-Match in security rules (line 62)**

```
OLD: **PATCH /items/{id} requer `If-Match: {version}`** obtido do GET prévio.
NEW: **PATCH /items/:id requer `X-Expected-Version: {version}`** obtido do GET prévio.
```

- [ ] **Step 6: Fix /collections in playlists reference (line 74)**

```
OLD: Fonte canônica: `GET /collections?type=playlist` — consultar se precisar IDs.
NEW: Fonte canônica: `GET /playlists` — consultar se precisar IDs.
```

- [ ] **Step 7: Fix If-Match in post-evaluate step (line 566)**

```
OLD: 2. **Tagear item (se existir no pipeline):** `GET /items/{id}` → merge tags → `PATCH /items/{id}` com `If-Match: {version}` — tags: `pvs:{score}`, `pvs-zone:{decisão}`, `evaluated:{data}`
NEW: 2. **Tagear item (se existir no pipeline):** `GET /items/:id` → merge tags → `PATCH /items/:id` com `X-Expected-Version: {version}` — tags: `pvs:{score}`, `pvs-zone:{decisao}`, `evaluated:{data}`
```

- [ ] **Step 8: Verify**

```bash
grep -c "If-Match" ~/Workspace/youtube/skills/product-evaluator/SKILL.md   # should be 0
grep -c "/collections" ~/Workspace/youtube/skills/product-evaluator/SKILL.md  # should be 0
```

---

### Task 16: Phase 3 — Commit

- [ ] **Step 1: Commit**

```bash
cd ~/Workspace/youtube/skills
git add writer/SKILL.md performance-review/SKILL.md product-evaluator/SKILL.md
git commit -m "fix: If-Match → X-Expected-Version in writer, perf-review, product-evaluator

Phase 3 of Skills API Sync migration:
- writer: fix If-Match (2 places), remove phantom /preview (2 places), /collections → /playlists
- performance-review: fix If-Match (4 places), /collections → /playlists
- product-evaluator: fix If-Match (3 places), /collections → /playlists (2 places)
- All 3 skills: add bootstrap reference, update api_version to 2.0.0

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 17: Phase 4 — Fix ideator

Ideator is the most complex skill (10 endpoints, 4 modes). Needs: `If-Match` fix, `/collections` fix, and bootstrap reference.

**Files:**
- Modify: `~/Workspace/youtube/skills/ideator/SKILL.md:40,51,54,58,669`

- [ ] **Step 1: Add bootstrap reference after §1 heading (before line 42)**

Insert after `## §1 — API Configuration`:

```markdown
> See `_shared/api-bootstrap.md` for auth, locking, error handling, and Step 0 bootstrap protocol.
```

- [ ] **Step 2: Fix If-Match in ENDPOINTS_USED (line 51)**

```
OLD:   - PATCH /items/{id}                 # atualizar (If-Match: {version})
NEW:   - PATCH /items/:id                  # atualizar (X-Expected-Version: {version})
```

- [ ] **Step 3: Fix /collections in ENDPOINTS_USED (line 54)**

```
OLD:   - GET /collections                  # playlists/séries
NEW:   - GET /playlists                    # playlists/séries
```

- [ ] **Step 4: Fix OPTIMISTIC_LOCKING line (line 58)**

```
OLD: OPTIMISTIC_LOCKING: "PATCH /items/{id} requer header If-Match: {version}. GET antes de PATCH."
NEW: OPTIMISTIC_LOCKING: "PATCH /items/:id requer header X-Expected-Version: {version}. GET antes de PATCH."
```

- [ ] **Step 5: Fix POST /collections deep reference (line 669)**

```
OLD: **Séries:** Quando QUICK ou DEEP detecta série natural (3-7 partes encadeadas), criar collection no pipeline (POST /collections com type=series, items=[]).
NEW: **Séries:** Quando QUICK ou DEEP detecta série natural (3-7 partes encadeadas), criar playlist no pipeline (POST /playlists com type=series, items=[]).
```

- [ ] **Step 6: Verify**

```bash
grep -c "If-Match" ~/Workspace/youtube/skills/ideator/SKILL.md    # should be 0
grep -c "/collections" ~/Workspace/youtube/skills/ideator/SKILL.md # should be 0
grep -c "pk_prod_" ~/Workspace/youtube/skills/ideator/SKILL.md    # should be 0 (from Task 3)
```

---

### Task 18: Phase 4 — Verify playlist-architect

Playlist-architect already uses `/playlists` endpoints (correct) and key was removed in Task 5. Just verify and add bootstrap reference.

**Files:**
- Modify: `~/Workspace/youtube/skills/playlist-architect/SKILL.md:46`

- [ ] **Step 1: Add bootstrap reference after §1 heading (before line 49)**

Insert after `## §1 — API Configuration`:

```markdown
> See `_shared/api-bootstrap.md` for auth, locking, error handling, and Step 0 bootstrap protocol.
```

- [ ] **Step 2: Verify all endpoints are correct**

```bash
grep -c "/collections" ~/Workspace/youtube/skills/playlist-architect/SKILL.md  # should be 0
grep -c "If-Match" ~/Workspace/youtube/skills/playlist-architect/SKILL.md      # should be 0
grep -c "pk_prod_" ~/Workspace/youtube/skills/playlist-architect/SKILL.md      # should be 0
grep -c "api-bootstrap" ~/Workspace/youtube/skills/playlist-architect/SKILL.md # should be >= 1
```

---

### Task 19: Phase 4 — Commit and final verification

- [ ] **Step 1: Commit Phase 4**

```bash
cd ~/Workspace/youtube/skills
git add ideator/SKILL.md playlist-architect/SKILL.md
git commit -m "fix: ideator If-Match + /collections, add bootstrap to playlist-architect

Phase 4 of Skills API Sync migration:
- ideator: fix If-Match (2 places), /collections → /playlists (2 places), add bootstrap
- playlist-architect: add bootstrap reference (endpoints already correct)
- All 9 skills now reference _shared/api-bootstrap.md

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 2: Run full verification across ALL skills**

```bash
cd ~/Workspace/youtube/skills
echo "=== FULL VERIFICATION ==="
echo ""

echo "--- If-Match refs (should be 0 except producer warning) ---"
for skill in */SKILL.md; do
  count=$(grep -c "If-Match" "$skill" 2>/dev/null || echo "0")
  if [ "$count" -gt "0" ]; then
    echo "  $skill: $count"
  fi
done

echo ""
echo "--- /collections refs (should be 0 everywhere) ---"
for skill in */SKILL.md; do
  count=$(grep -c "/collections" "$skill" 2>/dev/null || echo "0")
  if [ "$count" -gt "0" ]; then
    echo "  FAIL $skill: $count"
  fi
done

echo ""
echo "--- Hardcoded keys (should be 0 everywhere) ---"
grep -rn "pk_prod_" */SKILL.md && echo "FAIL: keys found" || echo "  PASS: no keys"

echo ""
echo "--- api-bootstrap refs (should be >= 1 in each) ---"
for skill in */SKILL.md; do
  count=$(grep -c "api-bootstrap" "$skill" 2>/dev/null || echo "0")
  echo "  $skill: $count"
done

echo ""
echo "--- api_version: 2.0.0 (should be in all with frontmatter) ---"
for skill in */SKILL.md; do
  if grep -q "api_version: 2.0.0" "$skill" 2>/dev/null; then
    echo "  $skill: OK"
  else
    echo "  $skill: MISSING"
  fi
done

echo ""
echo "=== DONE ==="
```

Expected output: all checks pass, zero failures.

---

### Task 20: Update staging specs

The `_staging/` specs also have stale references that should be fixed.

**Files:**
- Modify: `~/Workspace/youtube/skills/_staging/content-curator-spec.md`
- Modify: `~/Workspace/youtube/skills/_staging/playlist-architect-spec.md`

- [ ] **Step 1: Fix content-curator-spec.md**

Search and replace:
- `/collections?type=playlist` → `/playlists`
- `If-Match: {version}` → `X-Expected-Version: {version}`

```bash
cd ~/Workspace/youtube/skills/_staging
grep -n "/collections\|If-Match" content-curator-spec.md
# Fix each occurrence
```

- [ ] **Step 2: Fix playlist-architect-spec.md**

Search and replace any stale references (playlist-architect spec may already be correct since it was written after the rename).

```bash
grep -n "/collections\|If-Match" playlist-architect-spec.md
```

- [ ] **Step 3: Commit staging fixes**

```bash
cd ~/Workspace/youtube/skills
git add _staging/
git commit -m "fix: update staging specs with correct API endpoints

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Summary

| Phase | Tasks | Skills | Changes |
|-------|-------|--------|---------|
| 0 — Prerequisites | 1-6 | bootstrap, .gitignore, 4 key removals | Create protocol file, remove hardcoded keys |
| 1 — Canary | 7-9 | content-repurpose, text-planner | Add Step 0 reference (zero API surface) |
| 2 — Already correct | 10-12 | content-curator, producer | Fix /collections, cowork-section-schemas |
| 3 — Header fix | 13-16 | writer, perf-review, product-evaluator | If-Match → X-Expected-Version, /collections, /preview |
| 4 — Complex | 17-19 | ideator, playlist-architect | If-Match, /collections, final verification |
| Staging | 20 | staging specs | Fix stale references |

**Total: 20 tasks, 6 commits, ~30 find-and-replace operations across 11 files.**
