# A/B Lab Redesign -- Layer 4: Detail Views (~10h)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the monolithic `ab-test-detail.tsx` (569L) with a discriminated-union router dispatching to three state-specific detail views (Active, Winner, Playoff), each composed from shared section components.

**Depends on:** Layers 1-3 completed (ab-constants.ts, chart-utils.ts, ab-primitives.tsx, all 10 chart components, dashboard components). If Layer 1 files do not exist yet, create them as stubs with the types/exports this layer needs.

**Spec:** `docs/superpowers/specs/2026-05-29-ab-lab-redesign.md` sections 5.1-5.5 and 8.4

**Key paths:**
- Types: `apps/web/src/lib/youtube/ab-types.ts`
- Pure logic: `apps/web/src/lib/youtube/ab-gates.ts` (NEW)
- Components: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/` (8 new, 1 evolved)
- Page: `apps/web/src/app/cms/(authed)/youtube/ab-lab/[testId]/page.tsx`
- Tests: `apps/web/test/youtube/` (6 new test files)

---

### Task 1: Discriminated union types in ab-types.ts + test (~1h)

**Test file:** `apps/web/test/youtube/ab-detail-types.test.ts` (~12 scenarios)

- [ ] **Step 1: Write tests first**

```typescript
// apps/web/test/youtube/ab-detail-types.test.ts
import { describe, it, expect } from 'vitest'
import type { AbTestDetailView, AbTestActiveView, AbTestWinnerView, AbTestPlayoffView, GateResult, LiveMonitor } from '@/lib/youtube/ab-types'

describe('AbTestDetailView discriminated union', () => {
  it('narrows to ActiveView when status is active', () => {
    const view = { status: 'active' } as AbTestDetailView
    if (view.status === 'active') {
      // TS should see confirmedData, liveData, outcome?: never
      expect(view.status).toBe('active')
    }
  })
  it('narrows to WinnerView when status is completed and outcome is winner', () => { /* ... */ })
  it('narrows to PlayoffView when status is completed and outcome is playoff', () => { /* ... */ })
  it('ActiveView has outcome?: never to force first-branch narrowing', () => { /* type-level */ })
  it('GateResult has name, passed, value, hint?', () => { /* structural */ })
  it('LiveMonitor is optional on WinnerView', () => { /* structural */ })
  // + 6 more: field mapping tests (confidenceTarget, durationDays, hasPlayoff, totalRounds, daily shape, variantThumbs shape)
})
```

- [ ] **Step 2: Add types to ab-types.ts**

Add after existing types: `AbTestBaseView` (id, videoTitle, flag: TestType, status, variants: FullChartVariant[], variantThumbs, confTrend, daily, abbaSeq, cycles, durationDays, confidenceTarget, totalRounds, hasPlayoff). Then `AbTestActiveView extends AbTestBaseView` with `status: 'active'`, `outcome?: never`, `confirmedData`, `liveData`. Then `AbTestWinnerView extends AbTestBaseView` with `status: 'completed'`, `outcome: 'winner'`, `winnerLabel`, `lift`, `confidence`, `resultMeta`, `monitor?: LiveMonitor`, `learning?: string`. Then `AbTestPlayoffView extends AbTestBaseView` with `status: 'completed'`, `outcome: 'playoff'`, `playoffTestId`, `startsIn`, `finalists`, `confidenceReached`. Union: `AbTestDetailView = AbTestActiveView | AbTestWinnerView | AbTestPlayoffView`. Also add `GateResult` type and `LiveMonitor` interface.

- [ ] **Step 3: Verify tests pass** -- `npm run test:web -- --reporter=verbose ab-detail-types`

---

### Task 2: computeGates() pure function + test (~45min)

**Test file:** `apps/web/test/youtube/ab-gates.test.ts` (~15 scenarios)

- [ ] **Step 1: Write tests first**

```typescript
// apps/web/test/youtube/ab-gates.test.ts
import { describe, it, expect } from 'vitest'
import { computeGates } from '@/lib/youtube/ab-gates'
import type { GateInput } from '@/lib/youtube/ab-gates'

function makeInput(overrides?: Partial<GateInput>): GateInput {
  return { confidence: 0.97, threshold: 0.95, minImpressions: [1200, 1500],
    daysSinceStart: 10, confirmedCycles: 16, burnInDays: 2, variantCount: 2,
    eligibleCycles: 14, consecutiveConfident: 3, stabilityThreshold: 3, ...overrides }
}

describe('computeGates', () => {
  it('returns 6 gates', () => { expect(computeGates(makeInput())).toHaveLength(6) })
  it('all pass when all criteria met', () => { expect(computeGates(makeInput()).every(g => g.passed)).toBe(true) })
  it('confidence gate fails below threshold', () => { const g = computeGates(makeInput({ confidence: 0.80 })); expect(g[0].passed).toBe(false) })
  it('impressions gate fails when any variant < 1000', () => { /* minImpressions: [500, 1500] */ })
  it('duration gate fails before 7 days', () => { /* daysSinceStart: 3 */ })
  it('cycles gate fails below 14', () => { /* confirmedCycles: 8 */ })
  it('burn-in gate passes when burnInDays is 0', () => { /* edge case */ })
  it('burn-in gate fails when no eligible cycles after burn-in', () => { /* eligibleCycles: 0, burnInDays: 2 */ })
  it('stability gate fails when consecutive < threshold', () => { /* consecutiveConfident: 1 */ })
  it('each gate has name, passed, value, hint', () => { /* structural check on all 6 */ })
  // + 5 edge cases: boundary values, single variant, zero impressions
})
```

- [ ] **Step 2: Create ab-gates.ts**

`apps/web/src/lib/youtube/ab-gates.ts` -- export `GateInput` interface and `computeGates(input: GateInput): GateResult[]` pure function. Logic mirrors the 6 gates from `ab-evaluate/route.ts` lines 107-113 but as a pure function with no DB access. Gate names: `confidence`, `min_impressions`, `min_duration`, `min_cycles`, `burn_in`, `stability`.

- [ ] **Step 3: Refactor ab-evaluate cron** to import `computeGates()` instead of inline gate array. Verify existing `ab-cron-evaluate.test.ts` still passes.

- [ ] **Step 4: Verify** -- `npm run test:web -- --reporter=verbose ab-gates`

---

### Task 3: Shared detail components + tests (~2.5h)

**Test file:** `apps/web/test/youtube/ab-detail-shared.test.tsx` (~18 scenarios)

- [ ] **Step 1: Write tests for all 4 shared components**

Test `DetailHeader`: renders breadcrumb link to `/cms/youtube/ab-lab`, shows title, shows TypeBadge, shows signal toggle only for active status, shows Duplicate/Archive/Download for completed. Test `LockCountdown`: renders progress bar with correct width%, shows "X days remaining", handles edge case of 0 days. Test `HeroBand`: renders 4-cell grid, shows Gauge, shows leader VChip, shows lift text, shows trend indicator. Test `GatesPanel`: renders 2x3 grid, shows "{n}/6 passed" header, shows green check for passed gates, shows clock for pending, uses `role="list"` semantics.

- [ ] **Step 2: Create detail-header.tsx**

Props: `title: string`, `flag: TestType`, `status: AbTestStatus`, `roundNumber: number`, `totalRounds: number`, `hasPlayoff: boolean`, `signalToggle?: { mode: 'confirmed' | 'live'; onToggle: () => void }`, `actions?: ReactNode`. Breadcrumb uses `Link` to `/cms/youtube/ab-lab`. Badge row: TypeBadge from ab-primitives, round counter (`"Round {n}/{total}"`) if totalRounds > 1, status badge (color-coded). Right side: signal toggle (Seg component with confirmed/live options + InfoTip) for active, or action buttons slot.

- [ ] **Step 3: Create lock-countdown.tsx**

Props: `dayOf: number`, `durationDays: number`, `confidence: number`, `confidenceTarget: number`, `cyclesCompleted: number`. Lock icon + "Test locked" text. Progress bar div with `width: ${(dayOf/durationDays)*100}%`. Countdown: `Math.ceil((confidenceTarget - confidence) / 0.025)` estimated days. Cycles remaining text.

- [ ] **Step 4: Create hero-band.tsx**

Props: `confidence: number`, `confidenceTarget: number`, `leader: { label: DisplayLabel; color: string }`, `lift: number`, `trend: 'up' | 'flat' | 'down'`. 4-cell CSS grid (`grid-cols-4`, responsive `grid-cols-2` at 1024px, `grid-cols-1` at 760px). Cell 1: Gauge chart. Cell 2: VChip of leader. Cell 3: lift percentage (green text). Cell 4: trend arrow icon.

- [ ] **Step 5: Create variant-table.tsx**

Props: `variants: FullChartVariant[]`, `metric: 'pBest' | 'pTop2'`, `winnerId?: string`. 6-column table with `role="table"`. Columns: thumb, variant label, CTR, vs A (lift), chance to win (bar), expand chevron. Leader row tinted. Expandable rows (one-at-a-time via local state) show impressions, clicks, link CTR, retention, AI briefing. Rows: `tabIndex={0}`, Enter/Space toggles `aria-expanded`.

- [ ] **Step 6: Create gates-panel.tsx**

Props: `gates: GateResult[]`. 2x3 CSS grid. Header: `"{n}/6 passed"` with green text when all pass. Each cell: icon (check or clock), gate name, value string, optional hint. Uses `role="list"` + `role="listitem"`.

- [ ] **Step 7: Verify** -- `npm run test:web -- --reporter=verbose ab-detail-shared`

---

### Task 4: ActiveDetail component + test (~1.5h)

**Test file:** `apps/web/test/youtube/ab-detail-active.test.tsx` (~10 scenarios)

- [ ] **Step 1: Write tests**

Test 10-section layout renders all section headings. Test signal toggle swaps between confirmed/live data (mock two dataset objects, toggle state, verify chart props change). Test LockCountdown appears with correct progress. Test VariantTable uses `metric="pBest"`. Test GatesPanel renders with computed gates. Test responsive: section order preserved.

- [ ] **Step 2: Create active-detail.tsx**

Props: `view: AbTestActiveView`. Local state: `signal: 'confirmed' | 'live'`. Derives `data = signal === 'confirmed' ? view.confirmedData : view.liveData`. 10 sections in order: DetailHeader (with signal toggle), LockCountdown, HeroBand, H + VariantTable, ConfidenceChart + RadarChart grid, CredibleInterval + RankBars card, MultiLine daily CTR, ABBATimeline + FunnelRow grid, GatesPanel (gates from `computeGates()`), ClickMoment placeholder div.

- [ ] **Step 3: Verify** -- `npm run test:web -- --reporter=verbose ab-detail-active`

---

### Task 5: Winner + Playoff components + tests (~2h)

**Test file:** `apps/web/test/youtube/ab-detail-winner.test.tsx` (~10 scenarios)
**Test file:** `apps/web/test/youtube/ab-detail-playoff.test.tsx` (~10 scenarios)

- [ ] **Step 1: Write winner tests**

Test WinnerBanner renders trophy icon, winner VChip, lift %, confidence, 3 HeroStats. Test LiveMonitor conditionally hidden when `monitor` undefined. Test WinnerDetail 8-section layout. Test "Why X won" section renders CredibleInterval + RankBars. Test Final Scoreboard shows winner badge.

- [ ] **Step 2: Create winner-banner.tsx**

Props: `winnerLabel: DisplayLabel`, `winnerColor: string`, `lift: number`, `confidence: number`, `stats: { ctrBefore: number; ctrAfter: number; totalImpressions: number; abbaCycles: number; monthlyExtraClicks: number }`. Green-bordered card. Left: Trophy + VChip + lift (JetBrains Mono 38px) + confidence. Right: 3 stat cells.

- [ ] **Step 3: Create live-monitor.tsx**

Props: `monitor: LiveMonitor` (liveCtr, sparkline, liftVsOriginal, checkpoints D+7/14/30). Conditionally rendered. Left: big CTR number, sparkline, lift badge. Right: 3 checkpoint cells with check/clock icons.

- [ ] **Step 4: Create winner-detail.tsx**

Props: `view: AbTestWinnerView`. 8 sections: DetailHeader (no toggle, action buttons), WinnerBanner, "Why X won" (CredibleInterval + RankBars), LiveMonitor (conditional), ConfidenceChart + Learning card, Final Scoreboard (VariantTable with winnerId), ClickMoment placeholder.

- [ ] **Step 5: Write playoff tests**

Test PlayoffBanner renders bracket visualization with 3-column grid, finalists highlighted, dimmed non-finalists, center arrow, Round 2 thumbnails. Test `role="img"` and `aria-label`. Test PlayoffDetail 5-section layout. Test VariantTable uses `metric="pTop2"`. Test inconclusive banner shows amber background with correct confidence text.

- [ ] **Step 6: Create playoff-banner.tsx**

Props: `finalists: { label: DisplayLabel; color: string; ctr: number; thumbnailUrl: string | null }[]`, `allVariants: { label: DisplayLabel; isFinalist: boolean; thumbnailUrl: string | null }[]`, `startsIn: string`, `reason: string`. Purple-bordered card. Header: Swords icon + "Playoff created automatically" + countdown + scheduled badge. 3-column bracket: Round 1 variants (finalists full opacity, others dimmed) | center arrow | Round 2 finalists with thumbnails + CTR. Footer: Target icon + reason. `role="img"` + descriptive `aria-label`.

- [ ] **Step 7: Create playoff-detail.tsx**

Props: `view: AbTestPlayoffView`. 5 sections: DetailHeader (Inconclusive badge amber, no toggle), Inconclusive Banner (amber, Info icon, confidence reached vs 95%), PlayoffBanner, "Why inconclusive" (CredibleInterval + RankBars pTop2), VariantTable with `metric="pTop2"`.

- [ ] **Step 8: Verify** -- `npm run test:web -- --reporter=verbose ab-detail-winner ab-detail-playoff`

---

### Task 6: toDetailView() mapper + router page + test (~2h)

**Test file:** `apps/web/test/youtube/ab-detail-mapper.test.ts` (~15 scenarios, add to ab-gates.test.ts or separate)

- [ ] **Step 1: Write mapper tests**

Test `toDetailView()` returns `AbTestActiveView` for active test with correct field mappings. Test it returns `AbTestWinnerView` for completed test with winner. Test it returns `AbTestPlayoffView` for completed/inconclusive test with playoff_test_id. Test `confirmedData` uses only confirmed cycles, `liveData` includes estimated. Test `daily` maps to `Record<DisplayLabel, number[]>`. Test `variantThumbs` built correctly. Test `confTrend` computed from progressive cycle aggregation. Test field mappings: `confidenceTarget` from `confidence_threshold`, `durationDays` from `max_duration_days`, `hasPlayoff` from `!!playoff_test_id`, `totalRounds` from round_number. Test Bayesian probabilities (pBest, pTop2) populated on variants. Test edge: single variant returns early. Test edge: no confirmed cycles returns empty trends.

- [ ] **Step 2: Add toDetailView() to actions.ts**

New function `toDetailView(results: AbTestResults): AbTestDetailView`. Discriminates: if `test.status === 'active'` or `'paused'` return ActiveView; if `completed_reason === 'inconclusive' && playoff_test_id` return PlayoffView; else return WinnerView. Maps all fields from `AbTestResults` flat shape to the view-model shape. Computes `confirmedData` / `liveData` for active tests (confirmed uses backfill_status=confirmed cycles only, live adds estimated). Uses `toDisplayLabel()` from ab-constants. Calls `calculateBayesianConfidence()` for probabilities.

- [ ] **Step 3: Update [testId]/page.tsx**

Replace `<AbTestDetail results={results} />` with: call `toDetailView(results)` to get the view, then dispatch: `view.status === 'active'` renders `<ActiveDetail>`, `view.outcome === 'winner'` renders `<WinnerDetail>`, default renders `<PlayoffDetail>`. Import all three. Keep `dynamic = 'force-dynamic'`.

- [ ] **Step 4: Delete ab-variant-card.tsx** (153L, replaced by variant-table.tsx)

- [ ] **Step 5: Full verification**

```bash
npm run test:web -- --reporter=verbose ab-detail ab-gates
npm run build:packages
npx next build  # or rely on pre-commit
```

---

### Task 7: Final verification gate (~15min)

- [ ] All 6 test files pass (~75 scenarios total)
- [ ] `npm run build:packages` succeeds
- [ ] TypeScript strict: discriminated union narrows without `as` casts in page.tsx
- [ ] No `any` types introduced
- [ ] All new components have `aria-*` attributes per spec
- [ ] `ab-variant-card.tsx` deleted, no remaining imports
- [ ] Existing `ab-cron-evaluate.test.ts` still passes after `computeGates` refactor
