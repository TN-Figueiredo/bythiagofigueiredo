# Performance Screen Visual QA & Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the Performance (Desempenho) screen to pixel-perfect match with the design handoff in `design_handoff_youtube_cms/yt/performance*.{jsx,css}`.

**Architecture:** Components exist and are functional. The CSS (`youtube-motion.css`) already contains all needed Performance classes (lines 1488-1837). Work is purely visual: swap Tailwind-heavy card/header patterns for the shared `.card`/`.card-head`/`.card-pad` CSS classes (scoped under `[data-cms-section="youtube"]` which the layout provides), rewrite the RetentionCurve to use the shared `niceLine()` Catmull-Rom spline from `chart-utils.ts`, and align bars/colors/spacing with the handoff spec.

**Tech Stack:** React 19, TypeScript, `youtube-motion.css` (scoped via `[data-cms-section="youtube"]`), inline SVG, shared `chart-utils.ts`

**Key CSS class semantics (already defined):**
- `.card` → `background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden;`
- `.card-head` → `display: flex; align-items: center; gap: 8px; padding: 14px 18px 0;`
- `.card-title` → `font-size: 13.5px; font-weight: 600; color: var(--text);`
- `.card-pad` → `padding: 12px 18px 14px;`
- `.bar` → `height: 6px; border-radius: 3px; background: var(--surface-2); overflow: hidden;`
- `.bar > span` → `display: block; height: 100%; border-radius: 3px;`
- `.dim` → `color: var(--text-dim);`
- `.metric-label` → `font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-dim);`

**Classes that DON'T exist (handoff-only → use Tailwind):**
- `.col` → `flex flex-col`
- `.row` → `flex items-center`
- `.grow` → `flex-1`
- `.fw5`/`.fw6` → `font-medium`/`font-semibold` or inline style
- `.badge.green` → inline styled span
- `.truncate` → Tailwind `truncate`

---

## File Map

| File | Action | Why |
|------|--------|-----|
| `analytics/_components/yt-retention-curve.tsx` | **Rewrite** | Upgrade from basic 400×80 linear path to full handoff SVG: 640×220, Catmull-Rom via `niceLine()`, grid lines, marks, ret-notes |
| `analytics/_components/yt-overview.tsx` | **Modify** (render section only, lines 173-282) | HealthCard → `.card` + `.card-head` + `.bar` bars; Radar → `.card` + `.card-head` + `.card-pad`; Retention → `.card-head`; KPI sparkline colors → CSS vars |
| `analytics/_components/yt-demographics.tsx` | **Modify** (return block, lines 68-157) | Cards → `.card` + `.card-head` + `.card-pad`; gender bar color → `var(--accent)` |
| `_components/bar-list.tsx` | **Modify** | Use `.bar > span` pattern (6px height from CSS) instead of Tailwind `h-4` |
| `analytics/_components/yt-retention-curve-v2.tsx` | **Delete** | Unused after rewrite |

All paths relative to `apps/web/src/app/cms/(authed)/youtube/`.

---

### Task 1: Rewrite RetentionCurve with `niceLine()` and full handoff SVG

**Files:**
- Rewrite: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-retention-curve.tsx`

**Context:** The handoff shows `window.niceLine(pts)` for smooth curves. Our codebase has the identical Catmull-Rom implementation at `_shared/charts/chart-utils.ts:35-54`. The handoff SVG uses viewBox 640×220 with padT=16, padB=28, padL=38, padR=14, accent gradient fill (0.26→0 opacity), 2.6px stroke, grid lines at 0/25/50/75/100%, Y-axis percentage labels, vertical dashed marks, and X-axis duration labels.

- [ ] **Step 1: Write the new component**

Replace entire file with:

```tsx
'use client'

import { useId } from 'react'
import { niceLine } from '@/app/cms/(authed)/_shared/charts/chart-utils'

interface RetentionMark {
  at: number
  label: string
  note: string
}

interface Props {
  avgViewPercentage: number
  retentionCurve?: number[] | null
  marks?: RetentionMark[]
}

const DEFAULT_MARKS: RetentionMark[] = [
  { at: 0.04, label: 'Gancho', note: 'Retencao nos primeiros segundos' },
  { at: 0.5, label: 'Meio', note: 'Metade do video' },
]

function generateSyntheticCurve(avg: number): number[] {
  const n = 21
  const curve: number[] = [100]
  for (let i = 1; i < n; i++) {
    const t = i / (n - 1)
    // Exponential decay shaped to converge near avg at t=1
    // Hook: steep drop in first 5%
    const hookFactor = t < 0.05 ? 1 + (0.05 - t) * 8 : 1
    const base = avg + (100 - avg) * Math.exp(-3.5 * t * hookFactor)
    // Clamp to realistic range
    curve.push(Math.round(Math.max(Math.min(base, 100), avg * 0.6)))
  }
  return curve
}

export function YtRetentionCurve({ avgViewPercentage, retentionCurve, marks }: Props) {
  const uid = useId()
  const data = retentionCurve && retentionCurve.length >= 2
    ? retentionCurve
    : generateSyntheticCurve(avgViewPercentage)

  const retMarks = marks ?? DEFAULT_MARKS

  const W = 640, H = 220, padT = 16, padB = 28, padL = 38, padR = 14
  const n = data.length
  const xPos = (i: number) => padL + (i / (n - 1)) * (W - padL - padR)
  const yPos = (v: number) => padT + (1 - v / 100) * (H - padT - padB)

  const pts = data.map((v, i) => ({ x: xPos(i), y: yPos(v) }))
  const line = niceLine(pts)
  const area = `${line} L ${xPos(n - 1)},${yPos(0)} L ${xPos(0)},${yPos(0)} Z`

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img" aria-label="Curva de retencao">
        <defs>
          <linearGradient id={`retFill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.26" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines + Y-axis labels */}
        {[0, 25, 50, 75, 100].map(g => (
          <g key={g}>
            <line x1={padL} y1={yPos(g)} x2={W - padR} y2={yPos(g)} stroke="rgba(245,239,230,0.06)" />
            <text x={padL - 7} y={yPos(g) + 3} textAnchor="end" fontSize="9" fill="var(--text-faint)" style={{ fontFamily: 'var(--font-jetbrains, monospace)' }}>{g}%</text>
          </g>
        ))}
        {/* Retention marks (vertical dashed) */}
        {retMarks.map((m, i) => {
          const mx = padL + m.at * (W - padL - padR)
          return (
            <g key={i}>
              <line x1={mx} y1={padT} x2={mx} y2={H - padB} stroke="var(--text-faint)" strokeDasharray="3 3" opacity="0.5" />
              <text x={mx + 4} y={padT + 10} fontSize="9.5" fill="var(--text-dim)">{m.label}</text>
            </g>
          )
        })}
        {/* Area + line */}
        <path d={area} fill={`url(#retFill-${uid})`} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" />
        {/* X-axis duration labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <text key={i} x={padL + f * (W - padL - padR)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--text-faint)" style={{ fontFamily: 'var(--font-jetbrains, monospace)' }}>{Math.round(f * 100)}%</text>
        ))}
      </svg>
      {/* Retention notes below chart */}
      <div className="ret-notes">
        {retMarks.map((m, i) => (
          <div key={i} className="ret-note">
            <span style={{ fontSize: 12, fontWeight: 500 }}>{m.label}:</span>{' '}
            <span className="dim" style={{ fontSize: 12 }}>{m.note}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify import path resolves**

```bash
grep -r "from.*chart-utils" apps/web/src/app/cms/\(authed\)/youtube/ --include="*.tsx" | head -5
```

If no existing usages, verify the path alias works:
```bash
grep "chart-utils" apps/web/src/app/cms/\(authed\)/_shared/charts/chart-utils.ts
```

The import `@/app/cms/(authed)/_shared/charts/chart-utils` uses the `@/` alias mapped to `src/` in tsconfig.

- [ ] **Step 3: Quick typecheck**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -i "retention-curve\|chart-utils" | head -5
```

Expected: no errors (or fix if path alias is different).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/youtube/analytics/_components/yt-retention-curve.tsx
git commit -m "feat(yt-perf): RetentionCurve — full handoff SVG with niceLine(), grid, marks"
```

---

### Task 2: Polish Overview — HealthCard, Radar, Retention, KPI colors

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-overview.tsx` (lines 173-282, the render return)

**Changes:**
1. **HealthCard** → `.card.health-card` (no Tailwind border/bg), `.card-head` header with activity icon + `.card-title` + period dim span, badge "Saudavel" below gauge, `.bar` class for breakdown bars
2. **Radar** → `.card` wrapper (no Tailwind border/bg), `.card-head` + `.card-pad`, legend with 10×10 squares + 12px font
3. **Retention** → `.card` wrapper, `.card-head` with icon + title + subtitle, `.card-pad`
4. **KPI sparkline colors** → `'var(--green)'` / `'var(--red)'` instead of hex

- [ ] **Step 1: Replace the render return (lines 173-282)**

Replace from `return (` to the closing `)` with:

```tsx
  return (
    <div className="fade-in flex flex-col" style={{ gap: 16 }}>
      {/* perf-top: HealthCard + HealthRadar */}
      <div className="perf-top">
        {/* HealthCard */}
        <div className="card health-card">
          <div className="card-head">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <span className="card-title">Saude do canal</span>
            <span className="dim" style={{ fontSize: 11.5, marginLeft: 'auto' }}>ultimos 28 dias</span>
          </div>
          <div className="health-body">
            <div className="health-gauge-wrap">
              <YtHealthRing score={health.overall} size={150} />
              {health.overall >= 60 && (
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--green)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                  Saudavel
                </span>
              )}
              <span className="dim" style={{ fontSize: 11, marginTop: 6 }}>
                meta 80 &middot; faltam {Math.max(0, 80 - health.overall)} pts
              </span>
            </div>
            <div className="health-breakdown">
              {health.axes.map((axis) => {
                const barColor = axis.value >= 75 ? 'var(--green)' : axis.value >= 60 ? 'var(--accent)' : 'var(--amber)'
                return (
                  <div key={axis.label} className="hb-row">
                    <span className="hb-label">{axis.label}</span>
                    <div className="bar">
                      <span style={{ width: `${Math.max(axis.value, 2)}%`, background: barColor }} />
                    </div>
                    <span className="mono hb-score">{Math.round(axis.value)}</span>
                    <span className="hb-note dim">{axis.grade}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* HealthRadar */}
        <div className="card">
          <div className="card-head">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            <span className="card-title">Radar &middot; canal vs meta</span>
            <span className="dim" style={{ fontSize: 11.5, marginLeft: 'auto' }}>6 eixos</span>
          </div>
          <div className="card-pad">
            <YtRadarChart axes={health.axes} />
            <div className="flex items-center justify-center gap-4" style={{ marginTop: 6 }}>
              <span className="flex items-center gap-1.5" style={{ fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--accent)' }} />
                Canal
              </span>
              <span className="flex items-center gap-1.5" style={{ fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--green)', opacity: 0.5 }} />
                Meta
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpi-strip stagger">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card kpi-card">
            <div className="metric-label flex items-center gap-1.5">
              <KpiIcon name={kpi.icon} />
              {kpi.label}
            </div>
            <p className="kpi-val mono">
              {kpi.value}
            </p>
            <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
              <span className={`kpi-delta ${kpi.delta >= 0 ? 'up' : 'down'}`}>
                {kpi.delta >= 0 ? '+' : ''}
                {brDec(kpi.delta, 1)}%
              </span>
              {kpi.sparkline.length >= 2 && (
                <PSparkline
                  data={kpi.sparkline}
                  width={72}
                  height={26}
                  color={kpi.delta >= 0 ? 'var(--green)' : 'var(--red)'}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Retention Curve */}
      <div className="card">
        <div className="card-head">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <span className="card-title">Curva de retencao</span>
          <span className="dim" style={{ fontSize: 11.5, marginLeft: 'auto' }}>% da audiencia ao longo do video</span>
        </div>
        <div className="card-pad">
          <YtRetentionCurve avgViewPercentage={metrics.averageViewPercentage} />
        </div>
      </div>
    </div>
  )
```

- [ ] **Step 2: Update the import for YtRetentionCurve**

The import on line 14 currently says:
```tsx
import { YtRetentionCurve } from './yt-retention-curve'
```

The new component's prop is `avgViewPercentage` (not `avgPercentage`). The import stays the same; only the call site prop name changes (already done in Step 1).

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "yt-overview" | head -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/youtube/analytics/_components/yt-overview.tsx
git commit -m "fix(yt-perf): Overview uses card/card-head/bar/CSS vars per handoff"
```

---

### Task 3: Polish BarList to use `.bar > span` pattern

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/_components/bar-list.tsx`

**Handoff pattern:** `.demo-row` → `.demo-label.truncate` + `.bar.grow > span` (auto 6px height from CSS) + `.mono.demo-val`

The `.demo-row` class provides `display: flex; align-items: center; gap: 12px;`. The `.demo-label` provides `width: 96px; font-size: 12.5px; flex-shrink: 0;`. The `.demo-val` provides `width: 44px; text-align: right; font-size: 12.5px; font-weight: 600;`. The `.bar` provides the 6px track. All scoped under `[data-cms-section="youtube"]`.

- [ ] **Step 1: Rewrite the component**

Replace entire file content with:

```tsx
interface BarListProps<T> {
  items: T[]
  keyf: (item: T) => string
  valf: (item: T) => number
  color?: string
  fmtVal?: (val: number) => string
}

export function BarList<T>({
  items,
  keyf,
  valf,
  color = 'var(--accent)',
  fmtVal,
}: BarListProps<T>) {
  const maxVal = items.reduce((m, item) => Math.max(m, valf(item)), 0)

  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      {items.map((item) => {
        const label = keyf(item)
        const val = valf(item)
        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0

        return (
          <div key={label} className="demo-row">
            <span className="demo-label truncate">{label}</span>
            <div className="bar" style={{ flex: 1 }}>
              <span style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="mono demo-val">{fmtVal ? fmtVal(val) : String(val)}</span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "bar-list" | head -5
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/youtube/_components/bar-list.tsx
git commit -m "fix(yt-perf): BarList uses .demo-row/.bar CSS classes per handoff"
```

---

### Task 4: Polish Demographics cards — `.card`/`.card-head`/`.card-pad` + gender bar color

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-demographics.tsx` (lines 68-157)

**Changes:**
1. Card wrappers: `.card` class (provides border/bg/radius) instead of Tailwind `rounded-lg border border-cms-border bg-cms-surface p-4`
2. Headers: `.card-head` with icon SVG + `.card-title` instead of Tailwind h3
3. Content: `.card-pad` for padding instead of parent p-4
4. Gender bar feminine color: `var(--accent)` (handoff) instead of `#F472B6`
5. Legend labels: "Masc X%" / "Fem X%" per handoff (not "Masculino"/"Feminino")

- [ ] **Step 1: Replace the return block (from line 68)**

```tsx
  return (
    <div className="fade-in insights-grid stagger">
      {demographics.ageGender.length > 0 && (
        <div className="card">
          <div className="card-head">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span className="card-title">Faixa etaria</span>
          </div>
          <div className="card-pad">
            <BarList items={ageItems} keyf={(item) => item.label} valf={(item) => item.value} color="var(--blue)" fmtVal={(v) => `${v}%`} />
          </div>
        </div>
      )}

      {demographics.ageGender.length > 0 && (
        <div className="card">
          <div className="card-head">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span className="card-title">Genero</span>
          </div>
          <div className="card-pad">
            <div className="gender-bar">
              <span
                style={{ width: `${malePct}%`, background: 'var(--blue)' }}
                role="progressbar"
                aria-valuenow={Math.round(malePct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Masculino: ${Math.round(malePct)}%`}
              />
              <span
                style={{ width: `${femalePct}%`, background: 'var(--accent)' }}
                role="progressbar"
                aria-valuenow={Math.round(femalePct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Feminino: ${Math.round(femalePct)}%`}
              />
            </div>
            <div className="flex items-center gap-4" style={{ marginTop: 12 }}>
              <span className="flex items-center gap-1.5" style={{ fontSize: 12 }}>
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'var(--blue)' }} />
                Masc {Math.round(malePct)}%
              </span>
              <span className="flex items-center gap-1.5" style={{ fontSize: 12 }}>
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'var(--accent)' }} />
                Fem {Math.round(femalePct)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {demographics.countries.length > 0 && (
        <div className="card">
          <div className="card-head">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            <span className="card-title">Paises</span>
          </div>
          <div className="card-pad">
            <BarList items={demographics.countries} keyf={(c) => c.country} valf={(c) => c.percentage} color="var(--green)" fmtVal={(v) => `${v}%`} />
          </div>
        </div>
      )}

      {demographics.devices.length > 0 && (
        <div className="card">
          <div className="card-head">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
            <span className="card-title">Dispositivos</span>
          </div>
          <div className="card-pad">
            <BarList items={demographics.devices} keyf={(d) => d.deviceType} valf={(d) => d.percentage} color="var(--purple)" fmtVal={(v) => `${v}%`} />
          </div>
        </div>
      )}
    </div>
  )
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "yt-demographics" | head -5
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/youtube/analytics/_components/yt-demographics.tsx
git commit -m "fix(yt-perf): Demographics uses card-head/card-pad + var(--accent) gender bar"
```

---

### Task 5: Polish Coach — use `.card.coach-item` + `.coach-item-ico`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-health-coach.tsx` (lines 162-215, the coaching cards section)

**Handoff structure for each coach item:**
```jsx
<div className="card coach-item">
  <div className="coach-item-ico" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}><Icon /></div>
  <div className="grow">
    <div className="row" style={{ gap: 9, marginBottom: 5 }}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
      <span style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)`, borderColor: 'transparent', padding, borderRadius, fontSize: 11 }}>{severityLabel}</span>
    </div>
    <p style={{ fontSize: 13, lineHeight: 1.5 }}>{body}</p>
  </div>
  <div className="coach-action">
    <button className="btn sm">{action}</button>
    <span className="mono coach-impact">{impact}</span>
  </div>
</div>
```

Key differences vs current:
1. Card uses `className="card coach-item"` — NOT Tailwind `rounded-lg border` + inline borderColor/leftWidth
2. NO colored left-border (handoff doesn't have it)
3. Icon uses `.coach-item-ico` (36×36, rounded-10, grid place-items) with `color-mix()` bg
4. Severity badge is inline-styled (no `.badge` class)
5. Coach-action layout is simpler: just button + impact span

- [ ] **Step 1: Replace the coaching cards loop (lines 162-215)**

Replace the `{sortedCards.map((card, i) => { ... })}` block with:

```tsx
        {sortedCards.map((card, i) => {
          const severity = getSeverity(card.score)
          const color = SEVERITY_STYLES[severity].icon

          return (
            <div key={card.axis} className="card coach-item">
              <div className="coach-item-ico" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
                <SeverityIcon severity={severity} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2" style={{ marginBottom: 5 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    #{i + 1} {AXIS_LABELS[card.axis]}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color,
                      background: `color-mix(in srgb, ${color} 14%, transparent)`,
                    }}
                  >
                    {card.score < 3 ? 'Alta' : card.score < 5 ? 'Media' : 'Baixa'}
                  </span>
                  <span className="tnum text-[10px] text-cms-text-muted" style={{ marginLeft: 'auto' }}>
                    {brDec(card.score, 1)}/10
                  </span>
                </div>
                <p className="text-cms-text-muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
                  {card.diagnosis}
                </p>
              </div>
              {card.action && (
                <div className="coach-action">
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => toast.success(`Acao "${AXIS_LABELS[card.axis]}" enviada ao pipeline.`)}
                  >
                    Aplicar
                  </button>
                  <span className="mono coach-impact">
                    {card.score < 3 ? 'alto' : card.score < 5 ? 'medio' : 'baixo'}
                  </span>
                </div>
              )}
            </div>
          )
        })}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "yt-health-coach" | head -5
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/youtube/analytics/_components/yt-health-coach.tsx
git commit -m "fix(yt-perf): Coach items use card/coach-item/coach-item-ico per handoff"
```

---

### Task 6: Remove unused `yt-retention-curve-v2.tsx`

(Note: task numbers shifted after Coach task insertion)

**Files:**
- Delete: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-retention-curve-v2.tsx`

- [ ] **Step 1: Verify no imports reference it**

```bash
grep -r "yt-retention-curve-v2\|YtRetentionCurveV2" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v "yt-retention-curve-v2.tsx"
```

Expected: no results.

- [ ] **Step 2: Delete**

```bash
rm apps/web/src/app/cms/\(authed\)/youtube/analytics/_components/yt-retention-curve-v2.tsx
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(yt-perf): remove unused yt-retention-curve-v2"
```

---

### Task 6: Run tests + full build verification

- [ ] **Step 1: Run web tests**

```bash
npm run test:web 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 2: Full next build (identical to Vercel)**

```bash
npm run build:packages && cd apps/web && npx next build 2>&1 | tail -30
```

Expected: build succeeds.

- [ ] **Step 3: Fix any issues**

Common fixes:
- If `@/app/cms/(authed)/_shared/charts/chart-utils` doesn't resolve: check tsconfig paths, try relative import `../../_shared/charts/chart-utils`
- If `.card` doesn't render styling: verify the analytics page is inside the `[data-cms-section="youtube"]` wrapper (it is — `youtube/layout.tsx:28`)
- If `.bar` inner span doesn't fill: the CSS expects `<span>` not `<div>` inside `.bar`
