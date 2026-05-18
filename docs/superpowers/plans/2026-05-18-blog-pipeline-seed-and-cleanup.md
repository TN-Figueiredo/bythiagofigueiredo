# Blog Pipeline Seed & Board Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the blog editorial board's IDEA/DRAFT/READY lanes with pipeline items from text-pathways.md and clean up stale stashes.

**Architecture:** The blog board (UnifiedBoard) shows pipeline items from `content_pipeline` table in the IDEA/DRAFT/READY lanes, and blog posts in EDITING/SCHEDULED/PUBLISHED lanes. The code is correct — the table is simply empty. Running the existing seed scripts populates it. Stash@{0} contains outdated intermediate refactoring already superseded by HEAD.

**Tech Stack:** Supabase (prod), tsx scripts, Next.js App Router

---

## Root Cause Analysis

| Symptom | Cause |
|---------|-------|
| IDEA column shows "No ideas yet" | `content_pipeline` table has 0 rows with `format='blog_post'` for this site |
| "In Pipeline 0" in KPI bar | Same — query returns empty array |
| tg-01 not found | No pipeline item with that code exists; text-pathway codes are TA-01..TF-05 |

The code pipeline: `page.tsx` → `fetchPipelineData(siteId)` → `EditorialTab` → `UnifiedBoard` → `KanbanLane[idea]` is correct and tested. The `content_pipeline` table is empty because the seed scripts were never run against prod.

## Stash Assessment

| Stash | Contents | Verdict |
|-------|----------|---------|
| stash@{0} | Blog board useCallback wrapping, PipelineRow type, i18n fallback strings, removed reorderPipelineItem | **Outdated** — current HEAD already has these changes + more (ConfirmDialog, AutoShareDialog) |
| stash@{1} | package.json, publish-scheduled cron, audio-library API, social types | Separate feature WIP |

**stash@{0} can be safely dropped.** All its improvements already exist in the current code.

---

### Task 1: Run base seed (video collections)

`seed-pipeline-content.ts` depends on video playlist collections existing in the DB. `seed-pipeline.ts` creates them from `~/Workspace/Youtube/dashboard.html`.

**Files:**
- Execute: `scripts/seed-pipeline.ts`

- [ ] **Step 1: Run the base seed script**

```bash
npx tsx --env-file apps/web/.env.local scripts/seed-pipeline.ts
```

Expected output: List of playlist collections created/updated (playlist-a through playlist-g). Script is idempotent — safe to re-run.

- [ ] **Step 2: Verify collections were created**

Check the output shows `✓` markers for collections. If any fail, the error message will indicate why (missing dashboard.html data, DB permissions, etc).

---

### Task 2: Run content seed (blog_post pipeline items)

This creates 37 text pathway items (TA-01 through TF-05) as `format: 'blog_post'`, `stage: 'idea'` in `content_pipeline`. Also processes articles and idea bank entries.

**Files:**
- Execute: `scripts/seed-pipeline-content.ts`
- Source data: `~/Workspace/youtube/content-strategy/text-pathways.md` (37 items)
- Source data: `~/Workspace/youtube/articles/` (currently empty — 0 items expected)

- [ ] **Step 1: Run the content seed script**

```bash
npx tsx --env-file apps/web/.env.local scripts/seed-pipeline-content.ts
```

Expected output:
```
Using site: <uuid> (domain: bythiagofigueiredo.com)

--- Step 1: Resolve video playlist collections ---
  ✓ TA → playlist-e (...)
  ✓ TB → playlist-c (...)
  ...

--- Step 2: Articles from ~/Workspace/youtube/articles/ ---
  Found 0 article files

--- Step 3: Text pathways (planned articles) ---
  Found 37 planned articles
  ✓ ta-01 [idea] — Aprendi Inglês Porque Não Conseguia Passar de Fase
  ✓ ta-02 [idea] — ...
  ...

--- Step 4: Idea bank entries ---
  ...
```

- [ ] **Step 2: Verify item count**

The script should report ~37 text pathway items created with `[idea]` stage. These are the items that will appear in the blog board's IDEA lane.

---

### Task 3: Verify blog board in browser

**Files:**
- Verify: `localhost:3001/cms/blog` (dev server must be running)

- [ ] **Step 1: Reload the blog page**

Navigate to `localhost:3001/cms/blog` and hard-refresh (Cmd+Shift+R). The `fetchPipelineData` query has a 60-second cache, so a hard refresh ensures fresh data.

- [ ] **Step 2: Verify IDEA lane populated**

Expected:
- IDEA column shows pipeline cards (TA-01, TA-02, etc.)
- "In Pipeline" KPI shows a non-zero count
- Cards display title, priority badge, and stage
- Each card has a "Promote to Blog" action in its menu

- [ ] **Step 3: Verify DRAFT and READY lanes**

The text pathway items are all `stage: 'idea'`, so DRAFT and READY should be empty (unless idea bank entries with `format: 'blog_post'` were created). This is expected.

- [ ] **Step 4: Test drag between pipeline lanes**

Drag a card from IDEA to DRAFT. Should move successfully and show toast. Dragging from pipeline to blog lanes should show error toast ("Use Promote to create a post").

---

### Task 4: Clean up outdated stash

**stash@{0}** is an intermediate refactoring from a previous terminal session. Every change it contains has been superseded by subsequent commits (ConfirmDialog, AutoShareDialog, i18n system). Keeping it just adds confusion.

- [ ] **Step 1: Verify stash is outdated**

```bash
git stash show stash@{0} --stat
```

Confirm the files match: `hub-queries.ts`, `editorial-tab.tsx`, `unified-board.tsx`, `kanban-lane.tsx`, `post-card.tsx`, `pipeline-card.tsx`, `promotion-modal.tsx`, `schedule-modal.tsx`, `bulk-action-bar.tsx`, `media-*` files.

- [ ] **Step 2: Drop the stash**

```bash
git stash drop stash@{0}
```

This is irreversible but safe — the changes are either already in HEAD (blog board improvements) or in the working tree (media-library-page.tsx).

---

## Summary

| Task | Action | Time |
|------|--------|------|
| 1 | Run seed-pipeline.ts (create collections) | 1 min |
| 2 | Run seed-pipeline-content.ts (create 37 blog_post items) | 1 min |
| 3 | Verify blog board shows pipeline items | 2 min |
| 4 | Drop outdated stash@{0} | 1 min |

**Total: ~5 minutes.** No code changes needed — the implementation is correct, the data was missing.
