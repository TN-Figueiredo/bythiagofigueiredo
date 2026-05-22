# Blog-Pipeline UX Polish — Design Spec

**Goal:** Fix all remaining UX issues from the Pipeline-Blog Unification to reach 98+ quality score.

**Architecture:** Targeted fixes across 8 existing files, no new features. Extract shared logic to reduce duplication.

---

## Issues & Fixes

### T1. ActiveTabObserver overrides manual sidebar toggle (HIGH)
**File:** `pipeline-item-detail.tsx`
**Problem:** `ActiveTabObserver` fires `onCollapse(activeTab === 'draft')` on every tab change, overriding user's manual `«`/`»` toggle.
**Fix:** Add `manualOverrideRef = useRef(false)`. Set `true` when user clicks `«`/`»`. In `onCollapse` callback, skip if `manualOverrideRef.current` is `true`. Reset ref on initial mount only.

### T2. Extract shared route data-fetching (HIGH)
**Files:** `blog/pipeline/[id]/page.tsx`, `pipeline/items/[id]/page.tsx`
**Problem:** ~60 lines of identical data-fetching logic duplicated. Typo drift already happened (`titulo` vs `título`).
**Fix:** Extract `loadPipelineItemDetail(id, siteId)` to `lib/pipeline/load-pipeline-detail.ts`. Both routes call this shared function.

### T3. Cache invalidation missing for pipeline-blog tag (MEDIUM)
**File:** `blog/_hub/hub-actions.ts` or wherever `revalidateBlogHub()` lives
**Problem:** `revalidateBlogHub()` invalidates `blog-hub` but NOT `pipeline-blog`. Publishing a post leaves the kanban stale.
**Fix:** Add `revalidateTag('pipeline-blog')` to `revalidateBlogHub()`.

### T4. syncPipelineOnPostStatusChange doesn't handle 'scheduled' (MEDIUM)
**File:** `lib/pipeline/blog-sync.ts` or equivalent
**Problem:** When a post moves to `'scheduled'`, the pipeline item stays at `'ready'`. Only `'published'` is handled.
**Fix:** Add `scheduled` branch: when `newStatus === 'scheduled'`, update pipeline `stage` to `'scheduled'`.

### T5. Empty lane messages show blank (LOW)
**File:** `kanban-lane.tsx`
**Problem:** `emptyMessage` is `undefined` when i18n strings are missing — renders blank `<p>`.
**Fix:** Add fallback Portuguese strings per lane: `{ idea: 'Sem ideias ainda', draft: 'Sem rascunhos', ready: 'Sem itens prontos', scheduled: 'Nenhum post agendado', published: 'Nenhum post publicado' }`.

### T6. VVS score display improvements (LOW)
**File:** `pipeline-card.tsx`
**Problem:** VVS 0% is indistinguishable from scored items. No color coding.
**Fix:** When `validation_score === 0`, show `VVS —`. Add color: `<50` red, `50-79` amber, `≥80` green.

### T7. Published lane count uses paginated length (LOW)
**File:** `unified-board.tsx`
**Problem:** Lane badge shows paginated count (e.g., 30) not total (e.g., 120).
**Fix:** For `published` lane, use `totalPublished` instead of `items.length` for the badge count.

### T8. Alt+6 keyboard hint references non-existent lane (COSMETIC)
**File:** `unified-board.tsx`
**Problem:** `aria-description` says "Alt+1 through Alt+6" but only 5 lanes exist.
**Fix:** Change to "Alt+1 through Alt+5". Fix the handler `num <= 6` guard to `num <= 5`.
