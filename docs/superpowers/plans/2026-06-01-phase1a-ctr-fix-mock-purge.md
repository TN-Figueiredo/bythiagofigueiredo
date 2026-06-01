# Phase 1a: Fix CTR Zero Bug + Purge Mock Data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the CTR/Impressions zero bug in analytics-client.ts (Performance page shows all zeros) and remove all hardcoded fake data from AB Lab UI components.

**Architecture:** The CTR fix adds `impressions,impressionClickThroughRate` to the existing metrics query string and reads the values from the correct array indices. The mock purge replaces hardcoded values with computed props or `--` placeholders when no data exists. No new dependencies.

**Tech Stack:** Next.js 15, YouTube Analytics API v2, Vitest

**Spec:** `docs/superpowers/specs/2026-06-01-youtube-ecosystem-uplift-design.md` — Fase 1a

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/lib/youtube/analytics-client.ts` | Modify | Add impressions/CTR to metrics query |
| `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/hero-band.tsx` | Modify | Remove hardcoded 5.2% CTR, 93%/54% chance, "Hero" text |
| `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/live-monitor.tsx` | Modify | Remove hardcoded "12 dias", "5.2%" |
| `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/suggested-card.tsx` | Modify | Remove 85% confidence fallback |
| `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-config.tsx` | Modify | Remove "11k impressões/4,9% CTR" |
| `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard.tsx` | Modify | Remove fake sparkline + magic 74 multiplier |
| `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/playoff-banner.tsx` | Modify | Remove fake probability formula |
| `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/mock-dashboard.ts` | Delete | Entire file is unused mock data |

---

### Task 1: Fix CTR/Impressions zero bug in analytics-client.ts

**Files:**
- Modify: `apps/web/src/lib/youtube/analytics-client.ts:168-192`

- [ ] **Step 1: Fix the metrics query string**

In `apps/web/src/lib/youtube/analytics-client.ts`, change line 168:

```typescript
// FROM:
const coreMetrics = 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,comments,shares'

// TO:
const coreMetrics = 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,comments,shares,impressions,impressionClickThroughRate'
```

- [ ] **Step 2: Remove false comment**

Delete line 170:
```typescript
// DELETE THIS LINE:
// impressions/impressionClickThroughRate are NOT available in YouTube Analytics API v2
```

- [ ] **Step 3: Update array index reading**

Change lines 180-192 to read the 2 new metrics from indices 9 and 10:

```typescript
  return {
    views: Number(row[0]),
    estimatedMinutesWatched: Number(row[1]),
    averageViewDuration: Number(row[2]),
    averageViewPercentage: Number(row[3]),
    subscribersGained: Number(row[4]),
    subscribersLost: Number(row[5]),
    likes: Number(row[6]),
    comments: Number(row[7]),
    shares: Number(row[8]),
    impressions: Number(row[9]) || 0,
    impressionClickThroughRate: Number(row[10]) || 0,
  }
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/analytics-client.ts
git commit -m "fix: add impressions + CTR to YouTube Analytics query (was hardcoded to 0)"
```

---

### Task 2: Remove hardcoded data from HeroBand

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/hero-band.tsx:48-99`

The HeroBand has these hardcoded values:
- Line 54: `const originalCtr = leader.label === 'A' ? 0 : 5.2` — fake CTR
- Line 78: `Math.round(leader.label === 'B' ? 93 : 54)` — fake probability
- Line 81: `Hero` — should use leader.label
- Line 93: `${Math.round(confidence / 10)}/14 ciclos · estável 2/3` — fake cycle count

- [ ] **Step 1: Fix line 54 — remove fake CTR**

Replace lines 53-55:

```typescript
// FROM:
const estimatedDays = confidence > 0 ? Math.max(1, Math.ceil((confidenceTarget - confidence) / 2.5)) : '—'
const originalCtr = leader.label === 'A' ? 0 : 5.2
const leaderCtr = originalCtr > 0 ? originalCtr * (1 + lift / 100) : 0

// TO:
const estimatedDays = confidence > 0 ? Math.max(1, Math.ceil((confidenceTarget - confidence) / 2.5)) : '—'
```

- [ ] **Step 2: Fix line 78 — remove fake probability**

Replace line 78:
```typescript
// FROM:
<StatCell eyebrow="Líder atual" subtitle={`${Math.round(leader.label === 'B' ? 93 : 54)}% de chance de ser o melhor`}>

// TO:
<StatCell eyebrow="Líder atual" subtitle={`${Math.round(confidence)}% de confiança`}>
```

- [ ] **Step 3: Fix line 81 — use leader label instead of "Hero"**

Replace line 81:
```typescript
// FROM:
          Hero

// TO:
          {leader.label === 'A' ? 'Original' : `Variante ${leader.label}`}
```

- [ ] **Step 4: Fix lines 86-89 — remove fake CTR display**

Replace lines 86-89:
```typescript
// FROM:
<StatCell eyebrow="CTR lift vs original" subtitle={originalCtr > 0 ? `${originalCtr.toFixed(1)}% → ${leaderCtr.toFixed(1)}%` : '—'}>

// TO:
<StatCell eyebrow="CTR lift vs original" subtitle={lift !== 0 ? 'vs variante original' : '—'}>
```

- [ ] **Step 5: Fix line 93 — remove fake cycle count**

Replace line 93:
```typescript
// FROM:
<StatCell eyebrow="Tendência" subtitle={`${Math.round(confidence / 10)}/14 ciclos · estável 2/3`}>

// TO:
<StatCell eyebrow="Tendência" subtitle={trend === 'flat' ? 'estável' : trend === 'up' ? 'melhorando' : 'piorando'}>
```

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: No errors (removed originalCtr/leaderCtr variables that were only used internally)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/hero-band.tsx
git commit -m "fix: remove hardcoded CTR/probability from HeroBand — use real data"
```

---

### Task 3: Remove hardcoded data from LiveMonitor, SuggestedCard, StepConfig, PlayoffBanner

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/live-monitor.tsx:59-79`
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/suggested-card.tsx:128`
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-config.tsx:137`
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/playoff-banner.tsx:70`
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard.tsx:202,216`

- [ ] **Step 1: Fix LiveMonitor hardcoded strings**

In `live-monitor.tsx`, replace line 59-60:
```typescript
// FROM:
<Badge tone="green" dot>
  ao vivo · últ. checagem há 2h
</Badge>

// TO:
<Badge tone="green" dot>
  ao vivo
</Badge>
```

Replace line 79:
```typescript
// FROM:
vs 5.2% da original · segurando há 12 dias

// TO:
vs original · monitorando
```

- [ ] **Step 2: Fix SuggestedCard fallback**

In `suggested-card.tsx`, replace line 128:
```typescript
// FROM:
{video.confidence ?? 85}% conf.

// TO:
{video.confidence ? `${video.confidence}% conf.` : ''}
```

- [ ] **Step 3: Fix StepConfig hardcoded estimate**

In `step-config.tsx`, replace line 137:
```typescript
// FROM:
Com ~11k impressões/variante e CTR atual de 4,9%:

// TO:
Estimativa baseada na configuração:
```

- [ ] **Step 4: Fix PlayoffBanner fake probability**

In `playoff-banner.tsx`, replace line 70:
```typescript
// FROM:
P{finalist ? Math.round(finalist.ctr * 1000 + 10) : Math.round((v.label.charCodeAt(0) % 20) + 10)}%

// TO:
{finalist ? `${(finalist.ctr * 100).toFixed(1)}%` : '—'}
```

- [ ] **Step 5: Fix Dashboard fake sparkline + magic multiplier**

In `ab-lab-dashboard.tsx`, replace line 202:
```typescript
// FROM:
spark={stats.avgConfidence > 0 ? [40, 52, 58, 63, 68, 72, 75, 78, 80, Math.round(stats.avgConfidence)] : undefined}

// TO:
spark={undefined}
```

Replace line 216:
```typescript
// FROM:
trend={stats.avgLift > 0 ? `~${Math.round(stats.avgLift * 74)} cliques/mês extra` : undefined}

// TO:
trend={stats.avgLift > 0 ? `média dos testes concluídos` : undefined}
```

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/live-monitor.tsx \
  apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/suggested-card.tsx \
  apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-config.tsx \
  apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/playoff-banner.tsx \
  apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard.tsx
git commit -m "fix: purge hardcoded mock data from LiveMonitor, SuggestedCard, StepConfig, PlayoffBanner, KPI"
```

---

### Task 4: Delete mock-dashboard.ts

**Files:**
- Delete: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/mock-dashboard.ts`

- [ ] **Step 1: Verify file is not imported in production code**

Run: `grep -rn 'mock-dashboard' apps/web/src/`
Expected: No results (file is only imported in test files or not at all)

If there ARE imports in `src/`, do NOT delete — wrap in `process.env.NODE_ENV === 'development'` instead.

- [ ] **Step 2: Delete the file**

```bash
rm apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/mock-dashboard.ts
```

- [ ] **Step 3: Fix any broken imports**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
If any imports break, update them. If test files import it, update tests to not depend on mock-dashboard.

- [ ] **Step 4: Run full Phase 1a test suite**

Run: `npm run test:web`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete mock-dashboard.ts — unused mock data file"
```

---

### Task 5: Browser verification

- [ ] **Step 1: Open Performance page**

Navigate to `/cms/youtube/analytics`. Verify:
- CTR shows a real value (not 0.0%)
- Impressions shows a real number (not 0)
- Saúde do Canal score > 0
- Radar chart has a non-zero CTR axis

Note: This will only show real data AFTER the analytics sync cron runs with the new code. In dev, the YouTube Analytics API needs a valid OAuth token. If data is still 0, verify the token is valid and trigger a manual sync.

- [ ] **Step 2: Open AB Lab test detail**

Navigate to `/cms/youtube/ab-lab/{testId}`. Verify:
- HeroBand shows "Variante B" or "Original" (not "Hero")
- No "5.2%" hardcoded CTR
- No "93% de chance" hardcoded probability

- [ ] **Step 3: Final commit**

```bash
git commit --allow-empty -m "chore: Phase 1a complete — CTR fix + mock purge verified in browser"
```

---

## Phase 1a Gate Checklist

Before proceeding to Phase 1b/2a:
- [ ] analytics-client.ts queries `impressions,impressionClickThroughRate`
- [ ] Return object reads from indices 9 and 10 (not hardcoded 0)
- [ ] HeroBand, LiveMonitor, SuggestedCard, StepConfig, PlayoffBanner, KPI — zero hardcoded values
- [ ] mock-dashboard.ts deleted (or gated behind dev-only)
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run test:web` passes
