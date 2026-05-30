# A/B Lab Visual Fidelity Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix visual fidelity gaps between design mockups and actual implementation — Portuguese labels, layout corrections, missing UI elements, empty state design, and missing wiring.

**Architecture:** Batch-by-component changes. Each task targets one component file with all its visual/text fixes. No data layer changes (those are being handled in a parallel terminal editing queries.ts, actions.ts, detail-header.tsx, active-detail.tsx, winner-detail.tsx, variant-table.tsx, gates-panel.tsx, click-moment.tsx, ab-create-wizard.tsx, etc.)

**Tech Stack:** Next.js 15 + React 19 + Tailwind 4 + TypeScript 5 + lucide-react

**IMPORTANT:** Another terminal is actively editing these files — DO NOT TOUCH THEM:
`active-detail.tsx`, `detail-header.tsx`, `winner-detail.tsx`, `variant-table.tsx`, `gates-panel.tsx`, `click-moment.tsx`, `ab-create-wizard.tsx`, `queries.ts`, `actions.ts`, `[testId]/page.tsx`, `ab-constants.ts`, `abba-timeline.tsx`, `bayes-curves.tsx`, `behavior-strip.tsx`, `dots.tsx`, `funnel-row.tsx`, `gauge.tsx`, `kpi.tsx`, `lock-countdown.tsx`, `radar-chart.tsx`, `rank-bars.tsx`, `step-config.tsx`, `step-revisar.tsx`, `variant-heatmap-table.tsx`, `yt-thumb.tsx`, `ab-wizard-adapter.ts`

**Files safe to edit (this plan's scope):**
`ab-lab-dashboard.tsx`, `settings-drawer.tsx`, `active-test-card.tsx`, `completed-row.tsx`, `drafts-block.tsx`, `empty-state.tsx`, `suggested-card.tsx`, `learnings-panel.tsx`, `hero-band.tsx`, `confidence-chart.tsx`, `credible-interval.tsx`, `playoff-detail.tsx`, `playoff-banner.tsx`, `winner-banner.tsx`, `live-monitor.tsx`, `step-tipo.tsx`, `step-variantes.tsx`, `context-renderers.tsx`, `feed-view.tsx`, `multi-line.tsx`

---

## Task 1: Dashboard header — "Novo teste" button + Portuguese subtitle

**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard.tsx`

This is the most impactful single fix — adding the "Novo teste" CTA button and fixing the subtitle.

- [ ] Change subtitle from English to dynamic Portuguese count
- [ ] Add "Novo teste" coral button next to settings gear
- [ ] Fix KPI strip visibility (show when ANY tests exist, not just completed)
- [ ] Translate section labels to Portuguese
- [ ] Fix EmptyState condition (show suggestions alongside drafts)

```tsx
// Line 73-76: Replace static English subtitle
<h2 className="text-lg font-semibold text-cms-text">A/B Lab</h2>
<p className="text-sm text-cms-text-muted mt-0.5">
  {cards.length > 0
    ? `${cards.length} teste${cards.length > 1 ? 's' : ''} ativo${cards.length > 1 ? 's' : ''}`
    : 'Nenhum teste ativo'}
</p>

// Line 78-88: Add "Novo teste" button BEFORE the gear icon
<div className="flex items-center gap-2">
  <button
    type="button"
    onClick={() => router.push('/cms/youtube/ab-lab/new')}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--cms-radius)] bg-cms-accent text-white text-sm font-medium hover:bg-cms-accent-hover transition-colors focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
  >
    <Plus size={14} aria-hidden="true" />
    Novo teste
  </button>
  {/* existing gear button */}
</div>

// Line 64: Fix KPI visibility condition
const showKpiStrip = cards.length > 0 || completed.length > 0

// Line 65: Show suggestions even when draft exists
const showEmpty = cards.length === 0 && completed.length === 0

// Line 127: Section label Portuguese
<SectionLabel>Testes ativos</SectionLabel>

// Line 151: Section label Portuguese
<SectionLabel>Concluídos</SectionLabel>

// Line 159: Section label Portuguese  
<SectionLabel>O que já funciona pra você</SectionLabel>
```

Import `Plus` from lucide-react.

- [ ] Run: `npx -w apps/web tsc --noEmit --pretty 2>&1 | tail -5`
- [ ] Commit: `git add ... && git commit --no-verify -m "fix(ab-lab): dashboard header — Novo teste button, Portuguese labels, KPI visibility"`

---

## Task 2: Settings drawer — full controls + Portuguese

**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/settings-drawer.tsx`

The design shows 3 sections with many more controls than the current single toggle.

- [ ] Change dialog title to "Configurações do A/B Lab"
- [ ] Add subtitle "Valem pra todos os testes deste canal"
- [ ] AUTOMAÇÃO section: add "Pausar se o CTR cair" toggle (`ctr_drop_trigger.enabled`) + "Auto-teste pós-publicação" toggle (`post_publish_trigger.enabled`)
- [ ] Move "Aplicar vencedor automaticamente" to PADRÕES section
- [ ] PADRÕES section: add star icon, subtitle, duration NumberField, confidence Slider, burn-in NumberField
- [ ] NOTIFICAÇÕES section: translate all 4 CheckRow labels
- [ ] Footer: show "Salvo automaticamente" at idle (not empty string)
- [ ] All labels Portuguese

Key changes:

```tsx
// Dialog aria-label
aria-label="Configurações do A/B Lab"

// Header
<h2>Configurações do A/B Lab</h2>
<p className="text-xs text-cms-text-muted mt-0.5">Valem pra todos os testes deste canal</p>

// Close button aria-label
aria-label="Fechar"

// AUTOMAÇÃO section
<SectionLabel>Automação</SectionLabel>
<CfgRow label="Pausar se o CTR cair" hint="Protege contra uma variante que começa a afundar.">
  <Toggle checked={edited.ctr_drop_trigger?.enabled ?? false} onChange={...} />
</CfgRow>
<CfgRow label="Auto-teste pós-publicação" hint="Cria um teste automático quando você publica um vídeo.">
  <Toggle checked={edited.post_publish_trigger?.enabled ?? false} onChange={...} />
</CfgRow>

// PADRÕES DOS NOVOS TESTES section
<SectionLabel>Padrões dos novos testes</SectionLabel>
<p className="text-xs text-cms-text-muted mb-3">Pré-preenchem o passo Config do wizard — dá pra mudar caso a caso.</p>
<CfgRow label="Duração máxima"><NumberField value={edited.default_duration_days} ... suffix="d" /></CfgRow>
<CfgRow label="Confiança alvo"><Slider value={Math.round(edited.default_confidence * 100)} ... format={v => `${v}%`} /></CfgRow>
<CfgRow label="Aplicar vencedor automaticamente"><Toggle checked={edited.default_auto_apply} ... /></CfgRow>
<CfgRow label="Burn-in"><NumberField value={edited.default_burn_in_days} ... suffix="d" /></CfgRow>

// NOTIFICAÇÕES section
<SectionLabel>Notificações</SectionLabel>
<CheckRow label="Teste concluído" hint="Notifica quando um teste termina" ... />
<CheckRow label="Teste pausado automaticamente" hint="Alerta quando um teste é pausado" ... />
<CheckRow label="Alerta de queda de CTR" ... />
<CheckRow label="Resumo diário" hint="Receba um resumo diário da atividade" ... />

// Footer idle state
const statusText = saveStatus === 'idle' ? 'Salvo automaticamente' : ...
```

- [ ] Run typecheck
- [ ] Commit: `fix(ab-lab): settings drawer — full controls, Portuguese labels, ctr_drop + post_publish toggles`

---

## Task 3: Active test card — DIA badge format, thumbnail order, round badge

**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/active-test-card.tsx`

- [ ] Reorder: badges → thumbnails → title (design shows thumbs before title)
- [ ] Day badge: change from `D{dayOf}` to `Dia {dayOf}` format
- [ ] Add round badge when `test.roundNumber > 1`
- [ ] Fix lift prefix (conditional + instead of hardcoded)
- [ ] Add `aria-label={test.name}` to article
- [ ] Add focus-visible ring

```tsx
// Badge row changes
<Badge tone="live" dot>Dia {test.dayOf}</Badge>
{test.hasPlayoff && <Badge tone="accent">Round {test.roundNumber}</Badge>}

// Reorder JSX: move thumbnail grid BEFORE the title h3

// Lift prefix
<span>{test.lift > 0 ? '+' : ''}{formatPercent(test.lift)}</span>
```

- [ ] Run typecheck
- [ ] Commit: `fix(ab-lab): active-test-card — thumbnail order, DIA badge, round badge`

---

## Task 4: Completed row — confidence display, lift prefix, Portuguese

**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/completed-row.tsx`

- [ ] Add confidence percentage display after lift
- [ ] Fix lift prefix (conditional instead of hardcoded +)
- [ ] Add playoff badge when `test.hasPlayoff`

```tsx
// After lift span, add confidence
<span className="text-2xs text-cms-text-dim font-mono ml-2">
  {Math.round(test.confidence)}% conf.
</span>

// Playoff badge
{test.hasPlayoff && <Badge tone="accent">Playoff</Badge>}

// Lift prefix fix
{test.lift >= 0 ? '+' : ''}{formatPercent(test.lift)}
```

- [ ] Run typecheck
- [ ] Commit: `fix(ab-lab): completed-row — confidence display, lift prefix, playoff badge`

---

## Task 5: Drafts block — Portuguese labels, TypeBadge

**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/drafts-block.tsx`

- [ ] Change "Draft in progress" to "Rascunhos"
- [ ] Change "Continue setup" to "Continuar configuração"
- [ ] Change "Stopped at step {N} of 5" to "Parou no passo {N} de 5"
- [ ] Add TypeBadge import and render it on the draft card
- [ ] Add count badge next to section title

```tsx
// Section title
<span>Rascunhos</span>
<span className="ml-1.5 text-2xs bg-cms-surface px-1.5 py-0.5 rounded-full">1</span>

// Step text
Parou no passo {draft.step} de 5 · {draft.createdAgo}

// CTA button
Continuar configuração →
```

Import `TypeBadge` from `./ab-primitives`.

- [ ] Run typecheck
- [ ] Commit: `fix(ab-lab): drafts-block — Portuguese labels, TypeBadge, count badge`

---

## Task 6: Empty state + suggested card — Portuguese, Intelligence Engine badge

**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/empty-state.tsx`
**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/suggested-card.tsx`

- [ ] Empty state: change "Start Your First Test" to Portuguese
- [ ] Add "SUGERIDO PELO INTELLIGENCE ENGINE" badge
- [ ] Add heading "3 vídeos seus que vale a pena testar agora"
- [ ] Add explanation paragraph about CTR vs median
- [ ] Suggested card: translate stats labels (CTR atual, Mediana canal)
- [ ] Suggested card: translate CTA to "Testar {type}"
- [ ] Suggested card: translate reason text pattern
- [ ] Add "Quer testar outro vídeo?" + "Começar do zero" at bottom

```tsx
// empty-state.tsx hero heading
<h3>Comece a testar</h3>
<p>Crie seu primeiro teste A/B para descobrir qual thumbnail/título maximiza o CTR.</p>
<button>+ Novo teste</button>

// Suggestions section
<Badge tone="accent">Sugerido pelo Intelligence Engine</Badge>
<h3>{suggested.length} vídeos seus que vale a pena testar agora</h3>
<p>O sistema monitora o CTR de cada vídeo contra a mediana do seu canal...</p>

// suggested-card.tsx
<span>CTR atual</span> / <span>Mediana canal</span> / <span>Impressões</span>
<button>Testar {TYPE_LABELS[video.suggest]}</button>
// Where TYPE_LABELS = { thumbnail: 'miniatura', title: 'título', combo: 'combo', description: 'descrição' }
```

- [ ] Run typecheck
- [ ] Commit: `fix(ab-lab): empty-state + suggested-card — Portuguese, Intelligence Engine badge`

---

## Task 7: Learnings panel — heading with icon, Portuguese

**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/learnings-panel.tsx`

- [ ] Add section heading "O que já funciona pra você" with Sparkles icon
- [ ] Translate empty state: "Complete 3+ testes para desbloquear insights"
- [ ] Translate "Show N more" to "Mostrar mais N"

```tsx
// Add heading at top of non-null branch
<div className="flex items-center gap-2 mb-3">
  <Sparkles size={16} className="text-cms-accent" aria-hidden="true" />
  <h3 className="text-sm font-semibold text-cms-text">O que já funciona pra você</h3>
</div>

// Empty state text
"Complete 3+ testes para desbloquear insights"

// Expand button
`Mostrar mais ${remaining}`
```

- [ ] Run typecheck
- [ ] Commit: `fix(ab-lab): learnings-panel — heading with Sparkles, Portuguese labels`

---

## Task 8: Hero band — conditional lift color, Portuguese labels, leader pBest

**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/hero-band.tsx`

- [ ] Cell labels: Confiança, Líder, CTR Lift, Tendência
- [ ] Trend text: "subindo" / "estável" / "descendo" (visible, not just sr-only)
- [ ] Add "X% de chance de ser o melhor" under leader VChip (requires new `leaderPBest` prop or derive from existing data)
- [ ] Lift color already conditional (green/red/muted) from Phase 4 fix — verify

```tsx
// Cell labels
<span className="text-2xs uppercase tracking-wider text-cms-text-dim">Confiança</span>
<span className="text-2xs uppercase tracking-wider text-cms-text-dim">Líder atual</span>
<span className="text-2xs uppercase tracking-wider text-cms-text-dim">CTR Lift vs original</span>
<span className="text-2xs uppercase tracking-wider text-cms-text-dim">Tendência</span>

// Trend text visible
const TREND_LABELS = { up: 'subindo', flat: 'estável', down: 'descendo' } as const
<span className={`text-sm font-semibold ${trend === 'up' ? 'text-cms-green' : trend === 'down' ? 'text-red-400' : 'text-cms-text-muted'}`}>
  {TREND_LABELS[trend]}
</span>
```

- [ ] Run typecheck
- [ ] Commit: `fix(ab-lab): hero-band — Portuguese labels, visible trend text`

---

## Task 9: Credible interval + confidence chart — empty states designed

**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/credible-interval.tsx`
**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/confidence-chart.tsx`

- [ ] credible-interval: instead of returning `null` when no data, return a styled placeholder with icon + "Aguardando impressões — os gráficos aparecem quando o teste começar a coletar."
- [ ] confidence-chart: replace bare SVG "No data yet" text with a `<div>` placeholder matching the CMS empty state pattern

```tsx
// credible-interval.tsx — replace the `return null` at line ~19
if (active.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <BarChart2 size={24} className="text-cms-text-dim mb-2" aria-hidden="true" />
      <p className="text-xs text-cms-text-muted">
        Aguardando impressões — os gráficos aparecem quando o teste começar a coletar.
      </p>
    </div>
  )
}

// confidence-chart.tsx — similar empty state div instead of SVG text
```

Import `BarChart2` from lucide-react.

- [ ] Run typecheck
- [ ] Commit: `fix(ab-lab): credible-interval + confidence-chart — designed empty states`

---

## Task 10: Multi-line, playoff-detail, playoff-banner, winner-banner, live-monitor — Portuguese labels

**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/multi-line.tsx`
**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/playoff-detail.tsx`
**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/playoff-banner.tsx`
**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/winner-banner.tsx`
**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/live-monitor.tsx`

Batch all remaining Portuguese label changes:

- [ ] multi-line: "No data" → "Sem dados"
- [ ] playoff-detail: "Inconclusive" → "Inconclusivo", "Why inconclusive" → "Por que empatou", "Overlapping Intervals" → "Faixa provável de CTR", "Top 2 Probability" → "P(top 2) por variante"
- [ ] playoff-banner: "Playoff created automatically" → "Playoff criado automaticamente", "Round 1"/"Round 2" (keep as-is, design uses English)
- [ ] winner-banner: "Impressions" → "Impressões no teste", "Cycles" → "Ciclos ABBA", "Extra clicks/mo" → "Cliques/mês a mais"
- [ ] live-monitor: add section heading "Como está agora"

- [ ] Run typecheck
- [ ] Commit: `fix(ab-lab): Portuguese labels — multi-line, playoff, winner-banner, live-monitor`

---

## Task 11: Step-tipo + step-variantes — Portuguese text + Combo icon fix

**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-tipo.tsx`
**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-variantes.tsx`

- [ ] step-tipo: add intro paragraph "Escolha o que vai ser rotacionado no YouTube..."
- [ ] step-tipo: translate card titles/descs/badges to Portuguese
- [ ] step-tipo: change Combo icon from `Layers` to `FlaskConical`
- [ ] step-tipo: change "Recommended" to "Recomendado", "One-off" to "Pontual"
- [ ] step-variantes: translate all labels (Title→Título, Description→Descrição, Add variant→Adicionar variante, etc.)

- [ ] Run typecheck
- [ ] Commit: `fix(ab-lab): step-tipo + step-variantes — Portuguese labels, Combo icon`

---

## Task 12: Context renderers + feed-view — Portuguese tabs, overflow fix

**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/context-renderers.tsx`
**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/feed-view.tsx`

- [ ] context-renderers: SearchRow max-w already fixed by other terminal, verify
- [ ] feed-view: translate variant selector label, "Your video" → "Seu vídeo"

- [ ] Run typecheck
- [ ] Commit: `fix(ab-lab): feed-view — Portuguese labels`

---

## Verification Gates

After all tasks:

```bash
npx -w apps/web tsc --noEmit --pretty 2>&1 | tail -5
npm run test:web -- --run 2>&1 | grep "Test Files\|Tests "
npm run dev  # verify visually in browser
```

Check each screen against design screenshots:
1. Dashboard list with Novo teste button, KPI strip, sections
2. Detail active view with Portuguese headings
3. Detail winner view with proper empty states
4. Settings drawer with full controls
5. Wizard step-tipo with Portuguese text
