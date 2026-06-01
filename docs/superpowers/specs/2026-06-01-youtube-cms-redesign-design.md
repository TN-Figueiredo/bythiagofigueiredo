# YouTube CMS Visual Redesign — Design Spec

> **Data:** 2026-06-01
> **Escopo:** Redesign pixel-perfect de 5 telas + motor compartilhado da secao YouTube do CMS
> **Abordagem:** Refactor incremental — preservar data layer, substituir apresentacao
> **Fidelidade:** ALTA (pixel-perfect ao design handoff em `design_handoff_youtube_cms/`)
> **Dependencia externa:** Phase 0 bugs (drift, auto-pause, original thumbnail, resume) — ciclo separado

---

## Indice

1. [Fundacao: Tokens + Tipografia](#1-fundacao-tokens--tipografia)
2. [Sistema de Motion](#2-sistema-de-motion)
3. [Componentes Interativos](#3-componentes-interativos)
4. [Telas](#4-telas)
   - 4.1 [Competitor Observatory](#41-competitor-observatory)
   - 4.2 [A/B Lab Detail](#42-ab-lab-detail)
   - 4.3 [Performance](#43-performance)
   - 4.4 [Library + Wizard + Mobile Tab Bar](#44-library--wizard--mobile-tab-bar)
5. [Preocupacoes Transversais](#5-preocupacoes-transversais)
6. [Migracoes, Testes e Definicao de Pronto](#6-migracoes-testes-e-definicao-de-pronto)

---

## 1. Fundacao: Tokens + Tipografia

### 1.1 Tokens Globais (novos em `globals.css` `@theme`)

Beneficiam todo o CMS, sem conflito com valores existentes.

**Motion:**

| Token | Valor | Proposito |
|---|---|---|
| `--t-fast` | `.12s` | Hover, cor, micro-feedback |
| `--t-med` | `.2s` | Toggles, estados maiores |
| `--t-enter` | `.34s` | Entrada de secao/card |
| `--ease-out` | `cubic-bezier(.2,.7,.2,1)` | Curva "settle" |
| `--ease-spring` | `cubic-bezier(.34,1.3,.5,1)` | Elastico para knobs, thumbs |
| `--lift` | `-2px` | translateY de cards clicaveis no hover |
| `--shadow-lift` | `0 1px 0 rgba(255,255,255,0.03) inset, 0 16px 34px -18px rgba(0,0,0,0.78)` | Sombra ao levantar card |
| `--shadow-pop` | `0 24px 60px -20px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)` | Modais/drawers |

**Cores novas (sem equivalente existente):**

| Token | Valor |
|---|---|
| `--color-cms-text-faint` | `#5C5345` |
| `--color-cms-border-strong` | `#40382D` |
| `--color-cms-accent-deep` | `#D24E22` |
| `--color-cms-accent-press` | `#E0651E` |
| `--color-cms-accent-soft-2` | `rgba(255,130,64,0.18)` |
| `--color-cms-accent-line` | `rgba(255,130,64,0.30)` |
| `--color-cms-on-accent` | `#1A120A` |

**Breakpoints YouTube (Tailwind @theme):**

| Token | Valor | Uso |
|---|---|---|
| `--breakpoint-yt-xs` | `560px` | kpi-strip 3->2 |
| `--breakpoint-yt-sm` | `680px` | obs-grid 2->1 |
| `--breakpoint-yt-md` | `760px` | chrome collapse |
| `--breakpoint-yt-lg` | `920px` | outlier-grid 3->2, insights-grid 2->1 |
| `--breakpoint-yt-xl` | `1080px` | lib-grid 4->3 |
| `--breakpoint-yt-kpi` | `1100px` | kpi-strip 6->3 |
| `--breakpoint-yt-2xl` | `1180px` | obs-grid 3->2, outlier-grid 4->3 |

### 1.2 Tokens Escopados (`[data-cms-section="youtube"]`)

Conflitam com valores existentes — ficam escopados ao YouTube via `data-cms-section="youtube"` no `youtube/layout.tsx`.

| Token | Valor Atual | Valor Handoff |
|---|---|---|
| `--color-cms-radius-sm` | 2px | 9px |
| `--color-cms-radius` | (varia) | 14px |
| `--color-cms-radius-lg` | 8px | 18px |
| `--color-cms-shadow` | (diferente) | handoff value |
| `--color-cms-text-muted` | #958A75 | #A89B86 |
| `--color-cms-text-dim` | #928871 | #7C7060 |
| `--color-cms-surface-3` | #262219 | #2E281F |
| `--color-cms-accent-hover` | #FF9A60 | #FF9559 |
| `--color-cms-purple` | #8b5cf6 | #A78BFA |

### 1.3 Cores Feature-scoped

**Variantes A/B** (escopo A/B Lab):
`--v-a: #8A8F98` | `--v-b: #E8823C` | `--v-c: #3FA9C0` | `--v-d: #A77CE8`

**Tiers de outlier** (Observatory + Performance):
`--tier-mid: #60A5FA` (2-5x) | `--tier-high: #A78BFA` (5-10x) | `--tier-top: #D9614A` (>10x)

### 1.4 Tipografia

**Fraunces** via `next/font/google` no `youtube/layout.tsx`: subset `latin`, axes `opsz`, weights 300-700, variable `--font-display`, display `swap`. ~18KB woff2.

**Classes utilitarias** (em `youtube-motion.css`):
- `.mono` -> JetBrains Mono + `tabular-nums`
- `.tnum` -> so `tabular-nums`
- `.display` -> Fraunces
- `.eyebrow` -> mono, 10px, tracking .14em, uppercase, dim

### 1.5 Reduced-Motion Guard (global)

Bloco unico em `globals.css` substituindo fragmentos existentes:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .001ms !important;
    animation-delay: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 2. Sistema de Motion

> Arquivo: `apps/web/src/app/cms/(authed)/youtube/youtube-motion.css` (NOVO)
> Importado no `youtube/layout.tsx`
> **Regra absoluta:** NUNCA `transition: all` — sempre propriedades explicitas.

### 2.1 Keyframes

**8 keyframes totais:**

| Nome | CSS | Duracao | Easing | Uso |
|---|---|---|---|---|
| `fade` | `from { transform: translateY(8px) } to { transform: none }` | `--t-enter` (340ms) | `--ease-out` | Entrada de secao (transform-only, SEM opacity) |
| `rise` | `from { transform: translateY(5px) } to { transform: none }` | `--t-enter` | `--ease-out` | Stagger de filhos (transform-only) |
| `spin` | `from { transform: rotate(0deg) } to { transform: rotate(360deg) }` | 0.8s | linear | Icone de sync girando |
| `pulse` | `0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.5) } 50% { box-shadow: 0 0 0 6px rgba(34,197,94,0) }` | 1.8s | ease | Ponto de status ao vivo |
| `earlyPulse` | `0%,100% { bg: var(--accent-soft) } 50% { bg: var(--accent-soft-2) }` | 2s | ease-in-out | Icone "coletando dados" |
| `earlyGrow` | `0%,100% { opacity: .6 } 50% { opacity: 1 }` | 2.4s | ease-in-out | Barra de early state |
| `earlyDot` | `0%,100% { translateY(0); opacity: .4 } 50% { translateY(-3px); opacity: 1 }` | 1.4s | ease-in-out | 3 pontos pulsando (stagger .2s/.4s) |
| `skelBar` | `0%,100% { opacity: .4 } 50% { opacity: .9 }` | 1.8s | ease-in-out | Skeleton de grafico (stagger 0/.2/.4/.6s) |

### 2.2 Entry Animation (`.fade-in`)

```css
.fade-in { animation: fade var(--t-enter) var(--ease-out) both; }
```

**Onde aplicar:** raiz de cada sub-aba/estado ao montar. Usar `key={activeSubTab}` para forcar remontagem. NAO animar trocas de aba de topo (sao rotas).

### 2.3 Stagger System (`.stagger`)

```css
.stagger > * { animation: rise var(--t-enter) var(--ease-out) both; }
.stagger > *:nth-child(1) { animation-delay: 0ms; }
.stagger > *:nth-child(2) { animation-delay: 35ms; }
.stagger > *:nth-child(3) { animation-delay: 65ms; }
.stagger > *:nth-child(4) { animation-delay: 90ms; }
.stagger > *:nth-child(5) { animation-delay: 110ms; }
.stagger > *:nth-child(6) { animation-delay: 125ms; }
.stagger > *:nth-child(n+7) { animation-delay: 140ms; }
```

**5 conteineres que recebem `.stagger` (lista fechada):**
`obs-grid` | `outlier-grid` | `kpi-strip` | `lib-grid` | `insights-grid`

**NAO aplicar** em linhas de tabela (`search-table`, `vtable`).

### 2.4 Grids Responsivos

```css
.obs-grid     { grid: repeat(3,1fr); gap:16px }  /* 3->2@1180 ->1@680 */
.outlier-grid { grid: repeat(4,1fr); gap:14px }  /* 4->3@1180 ->2@920 */
.kpi-strip    { grid: repeat(6,1fr); gap:12px }  /* 6->3@1100 ->2@560 */
.lib-grid     { grid: repeat(4,1fr); gap:14px }  /* 4->3@1080 ->2@760 */
.insights-grid{ grid: 1.15fr 1fr;   gap:18px }  /* 2->1@920 */
```

---

## 3. Componentes Interativos — Full CSS

> Arquivo destino: `youtube-motion.css`, escopo `[data-cms-section="youtube"]`.
> Regra absoluta: NUNCA `transition: all` — sempre propriedades explicitas.
> Todo `:hover` tem par `:active` e `:focus-visible`.
> Tokens referenciados: `--t-fast` (.12s), `--t-med` (.2s), `--ease-out` (cubic-bezier(.2,.7,.2,1)), `--ease-spring` (cubic-bezier(.34,1.3,.5,1)), `--lift` (-2px), `--shadow-lift`.

### 3.1 Botao `.btn`

```css
/* --- Base --- */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1;
  color: var(--text);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 9px;
  cursor: pointer;
  transition:
    background var(--t-fast) var(--ease-out),
    border-color var(--t-fast) var(--ease-out),
    transform var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.btn:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
}

.btn:active:not(:disabled) {
  transform: translateY(1px);
}

.btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* --- Variant: primary --- */
.btn.primary {
  background: var(--accent);
  color: var(--on-accent);
  border-color: transparent;
}

.btn.primary:hover {
  background: var(--accent-hover);
  border-color: transparent;
}

/* --- Variant: ghost --- */
.btn.ghost {
  background: none;
  border-color: transparent;
  color: var(--text-muted);
}

.btn.ghost:hover {
  background: var(--surface-hover);
  border-color: transparent;
  color: var(--text);
}

/* --- Variant: cowork --- */
.btn.cowork {
  background: var(--cowork-soft);
  color: var(--cowork);
  border-color: transparent;
}

.btn.cowork:hover {
  background: var(--cowork-soft);
  color: var(--cowork);
  border-color: var(--cowork);
}

/* --- Variant: danger --- */
.btn.danger {
  background: var(--red-soft);
  color: var(--red);
  border-color: transparent;
}

.btn.danger:hover {
  background: var(--red-soft);
  color: var(--red);
  border-color: var(--red);
}

/* --- Size: sm --- */
.btn.sm {
  padding: 6px 11px;
  font-size: 12.5px;
  border-radius: 8px;
}

/* --- Size: icon (square) --- */
.btn.icon {
  padding: 0;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
}
```

### 3.2 Chip `.chip`

```css
/* --- Base --- */
.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  color: var(--text-muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 9px;
  cursor: pointer;
  transition:
    color var(--t-fast) var(--ease-out),
    border-color var(--t-fast) var(--ease-out),
    background var(--t-fast) var(--ease-out),
    transform var(--t-fast) var(--ease-out);
}

.chip:hover {
  color: var(--text);
  border-color: var(--border-strong);
}

.chip:active {
  transform: translateY(1px);
}

.chip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* --- Active state --- */
.chip.on {
  background: var(--accent-soft-2);
  color: var(--accent);
  border-color: transparent;
}
```

### 3.3 Segmented Pill `.seg-pills` + `.seg-pill`

```css
/* --- Container --- */
.seg-pills {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 9px;
}

/* --- Individual pill --- */
.seg-pill {
  padding: 5px 11px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  color: var(--text-muted);
  background: none;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  transition:
    color var(--t-fast) var(--ease-out),
    background var(--t-fast) var(--ease-out),
    transform var(--t-fast) var(--ease-out);
}

.seg-pill:hover {
  color: var(--text);
}

.seg-pill:active {
  transform: translateY(1px);
}

.seg-pill:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* --- Active pill --- */
.seg-pill.on {
  background: var(--accent-soft-2);
  color: var(--accent);
}

/* --- Demo switch variant (dashed border signals "demo control") --- */
.seg-pills.demo-switch {
  border-style: dashed;
}
```

### 3.4 Icon Button `.ic-btn`

```css
/* --- Base --- */
.ic-btn {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  padding: 0;
  color: var(--text-muted);
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  cursor: pointer;
  transition:
    color var(--t-fast) var(--ease-out),
    background var(--t-fast) var(--ease-out),
    border-color var(--t-fast) var(--ease-out),
    transform var(--t-fast) var(--ease-out);
}

.ic-btn:hover {
  color: var(--text);
  background: var(--surface-hover);
  border-color: var(--border-strong);
}

.ic-btn:active {
  transform: translateY(1px);
}

.ic-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* --- Danger variant --- */
.ic-btn.danger:hover {
  color: var(--red);
  background: var(--red-soft);
  border-color: transparent;
}

/* --- Syncing state (spinning icon) --- */
.ic-btn.syncing {
  color: var(--accent);
}

.ic-btn.syncing svg {
  animation: spin 0.8s linear infinite;
}
```

### 3.5 Toggle `.yt-toggle`

```css
/* --- Rail (trilho) --- */
.yt-toggle {
  position: relative;
  width: 42px;
  height: 24px;
  background: var(--surface-3);
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  cursor: pointer;
  transition:
    background var(--t-med) var(--ease-out),
    border-color var(--t-med) var(--ease-out);
}

/* --- Rail: on state --- */
.yt-toggle.on {
  background: var(--accent);
  border-color: transparent;
}

/* --- Knob --- */
.yt-toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  transition:
    left var(--t-med) var(--ease-spring),
    width var(--t-fast) var(--ease-out);
}

/* --- Knob: on state (slide right) --- */
.yt-toggle.on::after {
  left: 20px;
}

/* --- Squish: active feedback (knob stretches while pressed) --- */
.yt-toggle:active::after {
  width: 21px;
}

/* --- Squish: on + active (knob recedes slightly) --- */
.yt-toggle.on:active::after {
  left: 17px;
  width: 21px;
}

/* --- Focus ring --- */
.yt-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

### 3.6 Slider `.yt-slider`

```css
/* --- Track --- */
.yt-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 5px;
  background: var(--surface-3);
  border-radius: 999px;
  outline: none;
  cursor: pointer;
}

/* --- Thumb: WebKit (Chrome, Safari, Edge) --- */
.yt-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: var(--accent);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition:
    transform var(--t-fast) var(--ease-spring),
    box-shadow var(--t-fast) var(--ease-spring);
}

/* --- Thumb: Firefox --- */
.yt-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: var(--accent);
  border: none;
  border-radius: 50%;
  cursor: pointer;
}

/* --- Hover: halo around thumb --- */
.yt-slider:hover::-webkit-slider-thumb {
  box-shadow: 0 0 0 5px var(--accent-soft);
}

.yt-slider:hover::-moz-range-thumb {
  box-shadow: 0 0 0 5px var(--accent-soft);
}

/* --- Active: scale up + wider halo --- */
.yt-slider:active::-webkit-slider-thumb {
  transform: scale(1.18);
  box-shadow: 0 0 0 6px var(--accent-soft-2);
}

.yt-slider:active::-moz-range-thumb {
  transform: scale(1.18);
  box-shadow: 0 0 0 6px var(--accent-soft-2);
}

/* --- Focus ring --- */
.yt-slider:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* --- Wizard variant (adds base shadow to thumb) --- */
.wz-slider::-webkit-slider-thumb {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

.wz-slider:hover::-webkit-slider-thumb {
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.4),
    0 0 0 5px var(--accent-soft);
}

.wz-slider:active::-webkit-slider-thumb {
  transform: scale(1.18);
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.4),
    0 0 0 6px var(--accent-soft-2);
}
```

### 3.7 Tabs `.yt-tab` + `.subtab` + `.subtab-count`

```css
/* --- Top-level tab --- */
.yt-tab {
  padding: 11px 14px;
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1;
  color: var(--text-muted);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition:
    color var(--t-fast) var(--ease-out),
    border-color var(--t-fast) var(--ease-out);
}

.yt-tab:hover {
  color: var(--text);
}

.yt-tab:active {
  color: var(--text);
}

.yt-tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.yt-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

/* --- Sub-tab --- */
.subtab {
  padding: 10px 14px 12px;
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1;
  color: var(--text-muted);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition:
    color var(--t-fast) var(--ease-out),
    border-color var(--t-fast) var(--ease-out);
}

.subtab:hover {
  color: var(--text);
}

.subtab:active {
  color: var(--text);
}

.subtab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.subtab.active {
  color: var(--text);
  border-bottom-color: var(--accent);
}

/* --- Sub-tab count pill --- */
.subtab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  color: var(--text-dim);
  background: var(--surface-2);
  border-radius: 6px;
  margin-left: 4px;
}

/* --- Count pill in active sub-tab --- */
.subtab.active .subtab-count {
  background: var(--accent-soft-2);
  color: var(--accent);
}
```

### 3.8 Card Lift

Cards que **levantam** (interativos/clicaveis) compartilham o mesmo gesto.
Cards de dado (KPI, stat) ficam estaticos — sem transform no hover.

```css
/* --- Shared lift transition (applied to all liftable cards) --- */
.chan-card.clickable,
.outlier-card.clickable,
.lib-card {
  transition:
    border-color var(--t-fast) var(--ease-out),
    transform var(--t-fast) var(--ease-out),
    box-shadow var(--t-fast) var(--ease-out);
}

/* --- Channel card lift --- */
.chan-card.clickable:hover {
  transform: translateY(var(--lift));
  box-shadow: var(--shadow-lift);
  border-color: var(--border-strong);
}

.chan-card.clickable:active {
  transform: translateY(0);
  box-shadow: none;
}

.chan-card.clickable:focus-visible {
  transform: translateY(var(--lift));
  box-shadow: var(--shadow-lift);
  border-color: var(--border-strong);
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* --- Outlier card lift --- */
.outlier-card.clickable:hover {
  transform: translateY(var(--lift));
  box-shadow: var(--shadow-lift);
  border-color: var(--accent-line);
}

.outlier-card.clickable:active {
  transform: translateY(0);
  box-shadow: none;
}

.outlier-card.clickable:focus-visible {
  transform: translateY(var(--lift));
  box-shadow: var(--shadow-lift);
  border-color: var(--accent-line);
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* --- Library card lift --- */
.lib-card:hover {
  transform: translateY(var(--lift));
  box-shadow: var(--shadow-lift);
  border-color: var(--border-strong);
}

.lib-card:active {
  transform: translateY(0);
  box-shadow: none;
}

.lib-card:focus-visible {
  transform: translateY(var(--lift));
  box-shadow: var(--shadow-lift);
  border-color: var(--border-strong);
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* --- Minor lifts (own magnitude) --- */
.shelf-vid {
  transition:
    transform var(--t-fast) var(--ease-out);
}

.shelf-vid:hover {
  transform: translateY(-2px);
}

.shelf-vid:hover .thumb {
  border-color: var(--accent-line);
}

.take:hover .thumb {
  transform: translateY(-2px);
  border-color: var(--accent-line);
}

.gap-chip.clickable {
  transition:
    background var(--t-fast) var(--ease-out),
    transform var(--t-fast) var(--ease-out);
}

.gap-chip.clickable:hover {
  background: var(--accent-soft-2);
  transform: translateY(-1px);
}

.gap-chip.clickable:active {
  transform: translateY(0);
}

.gap-chip.clickable:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* --- Cards that do NOT lift (static data cards) --- */
/* .kpi-card, .cd-stat, .vd-stat, .checkpoint, .bracket-seed
   — no transform on hover, no box-shadow change, purely informational */
```

### 3.9 Affordance Reveals

Start invisible (`opacity: 0`). Reveal on parent `:hover` AND `:focus-visible` for keyboard accessibility.

```css
/* --- 1. Channel open hint (inside .chan-card.clickable) --- */
.chan-open-hint {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  opacity: 0;
  color: var(--text-muted);
  transition:
    opacity var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out),
    gap var(--t-fast) var(--ease-out);
}

.chan-card.clickable:hover .chan-open-hint,
.chan-card.clickable:focus-visible .chan-open-hint {
  opacity: 1;
  color: var(--accent);
  gap: 5px;
}

/* --- 2. Outlier CTA (inside .outlier-card.clickable) --- */
.outlier-cta {
  opacity: 0;
  color: var(--text-muted);
  transition:
    opacity var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.outlier-card.clickable:hover .outlier-cta,
.outlier-card.clickable:focus-visible .outlier-cta {
  opacity: 1;
  color: var(--accent);
}

/* --- 3. Search CTA "Criar roteiro ->" (inside .search-row) --- */
.search-cta {
  opacity: 0;
  transform: translateX(-4px);
  color: var(--accent);
  transition:
    opacity var(--t-fast) var(--ease-out),
    transform var(--t-fast) var(--ease-out);
}

.search-row:hover .search-cta,
.search-row:focus-visible .search-cta {
  opacity: 1;
  transform: none;
}

/* --- 4. Library hover overlay (inside .lib-thumb-wrap) --- */
.lib-hover {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: 0;
  background: rgba(0, 0, 0, 0.6);
  border-radius: inherit;
  transition:
    opacity var(--t-fast) var(--ease-out);
}

.lib-thumb-wrap:hover .lib-hover,
.lib-thumb-wrap:focus-visible .lib-hover,
.lib-card:hover .lib-hover,
.lib-card:focus-visible .lib-hover {
  opacity: 1;
}
```

### 3.10 Table Row Hovers

Rows have background hover only (no lift). Transitions always explicit.

```css
/* --- Search table rows --- */
.search-table tbody tr {
  transition:
    background var(--t-fast) var(--ease-out);
}

.search-table tbody tr:hover {
  background: var(--surface-hover);
}

.search-row {
  cursor: pointer;
}

.search-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* --- Channel drawer rows --- */
.cd-row {
  transition:
    background var(--t-fast) var(--ease-out),
    border-color var(--t-fast) var(--ease-out);
}

.cd-row:hover {
  background: var(--surface);
  border-color: var(--border);
}

.cd-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* --- Mudancas event badge rows --- */
.md-ev-ba {
  transition:
    background var(--t-fast) var(--ease-out);
}

.md-ev-ba:hover {
  background: var(--surface-hover);
}

.md-ev-ba:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* --- Mudancas bookmark mark --- */
.md-mark {
  transition:
    color var(--t-fast) var(--ease-out),
    border-color var(--t-fast) var(--ease-out),
    background var(--t-fast) var(--ease-out);
}

.md-mark:hover {
  color: var(--accent);
  border-color: var(--accent-line);
}

.md-mark:active {
  transform: translateY(1px);
}

.md-mark:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* --- Bookmark active state --- */
.md-mark.on {
  color: var(--accent);
  background: var(--accent-soft-2);
  border-color: transparent;
}

.md-mark.on svg {
  fill: var(--accent);
}
```

### 3.11 Ghost Action Buttons

All share the same dashed-to-accent hover pattern. Explicit transition properties.

```css
/* --- Shared ghost action base --- */
.load-more,
.cd-more,
.chan-seeall,
.add-variant {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  background: none;
  border: 1px dashed var(--border-strong);
  border-radius: 9px;
  cursor: pointer;
  transition:
    border-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out),
    background var(--t-fast) var(--ease-out),
    transform var(--t-fast) var(--ease-out);
}

.load-more:hover,
.cd-more:hover,
.chan-seeall:hover,
.add-variant:hover {
  border-color: var(--accent-line);
  color: var(--accent);
  background: var(--accent-soft);
}

.load-more:active,
.cd-more:active,
.chan-seeall:active,
.add-variant:active {
  transform: translateY(1px);
}

.load-more:focus-visible,
.cd-more:focus-visible,
.chan-seeall:focus-visible,
.add-variant:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* --- chan-seeall inside shelf (inherits, no override needed) --- */
.chan-shelf .chan-seeall {
  /* Same styles — listed for selector completeness */
}
```

### 3.12 Icon System

44 icones via `lucide-react` (imports individuais). Tamanhos: 11-13px (badges), 13-15px (botoes), 18-20px (destaque).

### 3.13 Toast System — Sonner

`<Toaster>` no layout YouTube. Theme dark warm. Position bottom-center. Duration 2800ms. Pill shape com `--shadow-pop`. Contrato: **todo controle da feedback** (estado, dialog OU toast).

### 3.14 Formatting Helpers

`apps/web/src/lib/youtube/format.ts`:
- `fmtBR(n)` -> `1.234,56`
- `fmtC(n)` -> `184 mil`, `2,8 mi`
- `brDec(n,d)` -> `6,2`
- `fmtRelative(date)` -> `agora`, `ha 2h`, `ha 3 dias`

---

## 4. Telas

### 4.1 Competitor Observatory

**Rota:** `/cms/youtube/competitors`
**Sub-abas:** Canais (12) | Mudancas (6) | Outliers (6) | Insights

#### 4.1.1 Aba Canais

**Topo:** search (min 320, max 440px) + counter pill ("12/15 canais") + btn primary "Adicionar".

**obs-grid stagger** (3->2->1 col): cards `.chan-card.clickable` com:
- Header: avatar 40x40, nome, meta ("{subs} inscritos . {n} videos"), change-flag roxo, ic-btn sync/delete
- Metricas: engaj. medio + crescimento com sparkline (72x26, niceLine)
- vs-you: comparacao com seu canal (positivo verde, negativo ambar)
- Shelf: 3 videos recentes + "Ver todos"
- Open hint (revelado no hover)
- Click -> Channel Drawer

**Channel Drawer (NOVO):** portal, max 780px, da direita. cd-head + cd-versus (4 pills) + cd-stats (5 grid) + cd-controls (segment pills) + cd-body (lista/grade de videos) + cd-more.

**Video Modal (NOVO):** portal, max 520px. Thumb + titulo + stats (3 col) + compare + trend + flag A/B + acoes.

#### 4.1.2 Aba Mudancas

Filter bar (search + selects + chip "So marcados"). Context band ambar quando filtrado. Timeline por dia: md-card com md-mark, type badge, before/after thumbs, history-toggle expandindo timeline. Zoom modal para comparacao grande.

#### 4.1.3 Aba Outliers

Filter bar (chips por tier) + legend row. outlier-grid stagger (4->3->2). Cards com thumb, mult-badge (cor por tier), outlier-cta revelado no hover. Click -> video modal.

#### 4.1.4 Aba Insights

insights-grid stagger (2->1). 4 cards: **Heatmap** 7x24 (melhor horario), **Tags** (barras horizontais), **Engajamento** comparativo (us-tag destacado), **Gaps/Lacunas** (3 col: deles/divisor/nossos, gap-chip clicavel -> cria ideia via toast).

#### 4.1.5 Novos Componentes (Observatory)

| Componente | Arquivo |
|---|---|
| ChannelDrawer | `competitors/_components/channel-drawer.tsx` |
| VideoModal | `competitors/_components/video-modal.tsx` |
| CompetitorHeatmap | `competitors/_components/competitor-heatmap.tsx` |
| GapsCard | `competitors/_components/gaps-card.tsx` |
| ZoomModal | `competitors/_components/zoom-modal.tsx` |
| ChangeTimeline | `competitors/_components/change-timeline.tsx` |
| SparklineChart | `competitors/_components/sparkline-chart.tsx` |
| MudancasFilterBar | `competitors/_components/mudancas-filter-bar.tsx` |

#### 4.1.6 Refatorar (Observatory)

- `CompetitorDashboard` -> quebrar em sub-componentes por aba
- `CompetitorTabs` -> adicionar contadores
- Cards de canal/mudanca/outlier -> extrair, adicionar motion/affordances
- `page.tsx` -> expandir queries (sparklines, historico, heatmap, gaps)

---

### 4.2 A/B Lab Detail

**Rota:** `/cms/youtube/ab-lab/[testId]`
**5 estados:** Inicio | Ativo | Pausado | Vencedor | Playoff

#### 4.2.1 Estado Inicio (PRINCIPAL GAP)

**EarlyDetail** (novo): tela dedicada para testes recem-criados.

- **EarlyBand:** card com icone `.early-pulse` (2s) + barra `.early-bar` (earlyGrow 2.4s) + "Dia 0 de {total}"
- **EarlyHero:** grid 2-cel. Esquerda: `.early-dots` (3 pontos pulsando, stagger .2s/.4s) + "Coletando dados" (22px display) + explicacao + btn cowork. Direita: 3 checkpoints com ETA (~6h/~48h/~7 dias), `.soon` em accent
- **EarlyVariantTable:** tabela com CTR "--" e pilula "coletando"
- **4x EmptyChart:** skeleton com 4 barras (skelBar 1.8s, stagger 0/.2/.4/.6s) + mensagem + ETA

Dispatch: `view.isEarly = view.cycles.done < 1 && view.confirmedData.confidence < 5`

#### 4.2.2 Estado Ativo (refatorar existente)

PRESERVAR: todos os 18 componentes (DetailHeader, HeroBand, VariantTable, ConfidenceChart, RadarChart, CredibleInterval, RankBars, MultiLine, ABBATimeline, FunnelRow, ClickMoment, FeedView, BayesCurves, GatesPanel, SignalCard, AbPauseDialog, AbEndTestDialog, usePollStats).

RESTILAR: HeroBand (gauge 108px nao 160px), VariantTable (grid columns exatas, .lead inset shadow), GatesPanel (.gates-grid 2-col, .gate.pass verde), Feed (.feed-item.hl), signal/computed (.grid-2).

#### 4.2.3 Estado Pausado

DriftBanner ambar: icone AlertTriangle + titulo + descricao + drift-diff (esperado vs encontrado) + botoes "Reconhecer e retomar" / "Ver detalhes". Conteudo congelado. **Dep Phase 0:** botao "Retomar" disabled ate fixes.

#### 4.2.4 Estado Vencedor

WinnerBanner: gradiente green-soft->surface, 3 regioes (VChip + "venceu", metricas 24px, botao "Aplicar"). ComoEstaAgora (NOVO): CTR ao vivo + sparkline + checkpoints 7d/14d/30d. LearnCard: aprendizado + tags.

#### 4.2.5 Estado Playoff

Bracket 1fr/auto/1fr. bracket-seed.elim (riscado, opacity 0.5). bracket-final (VChip + P(top2)). bracket-note ambar. Banner inconclusivo com botoes "Round 2" / "Encerrar".

#### 4.2.6 Acoes

Demo switch (.seg-pills.demo-switch, dev only). Dialogs (.ab-dialog portal, scrim + blur). Settings drawer (toggles ease-spring + squish, slider halo). Toast via Sonner.

#### 4.2.7 Novos vs Refatorar (AB Lab)

**Novos:** EarlyDetail, EarlyBand, EarlyHero, EarlyVariantTable, EmptyChart, ComoEstaAgora
**Refatorar:** HeroBand, GatesPanel, VariantTable, WinnerBanner, PlayoffBanner, SettingsDrawer, AbPauseDialog, AbEndTestDialog, Gauge (+size/color/reached), page.tsx (+isEarly branch)

---

### 4.3 Performance

**Rota:** `/cms/youtube/analytics`
**Sub-abas:** Visao geral | Notas | Health Coach | Outliers | Demografia | Busca

#### 4.3.1 Controles

page-head com demo-switch "Estabelecido / Canal novo" + btn cowork "Pedir diagnostico". Demo-switch controla qual view da Visao geral renderiza.

#### 4.3.2 Visao Geral — Estabelecido

perf-top grid (1.5fr/1fr): HealthCard (gauge 150px, 6-axis breakdown com barras coloridas) + HealthRadar (radar canal x meta, 6 eixos). kpi-strip stagger (6 KPIs com sparkline 72x26, delta, icone — NAO levantam no hover). RetentionCurve (SVG area, gradiente accent, marcas verticais, benchmark 70%).

#### 4.3.3 Visao Geral — Canal Novo

PerfNewChannel (NOVO): early-band + kpi-strip com "--" + skeleton chart (skelBar).

#### 4.3.4 Health Coach

coach-summary (gradiente accent, sparkles, projecao "+N pts"). Lista de coach-item (severidade por score: <3 vermelha, <5 ambar, >=5 verde). coach-action com impact badge + botao.

#### 4.3.5 Outliers

outlier-grid stagger. Cards de SEUS videos acima da mediana. Hover -> "Criar teste A/B" affordance.

#### 4.3.6 Demografia

insights-grid stagger (2->1). 4 cards: Faixa etaria (BarList), Genero (barra segmentada), Paises (BarList), Dispositivos (BarList). Cada demo-row: label 96px + barra + valor 44px.

#### 4.3.7 Busca (IMPLEMENTACAO DE REFERENCIA)

search-table dentro de card. Colunas: Termo | Views | CTR | Tendencia.

**Sort headers (Views, CTR):** role="button", tabIndex={0}, aria-sort, onKeyDown (Enter/Space). Chevron rotaciona 180deg no asc. Header ativo em accent. **FUNCAO INLINE, nao componente** (evita remontagem).

**Linhas:** role="button", hover bg, focus-visible outline. Click -> toast "Roteiro pro termo '{termo}' enviado ao pipeline." Affordance search-cta (opacity 0, translateX -4px -> visible no hover/focus).

#### 4.3.8 Notas (NOVO)

NotesView (max 720px): textarea + "Salvar nota" (disabled se vazio -> toast). Lista de note-row: avatar (.bot cyan para Cowork), autor, timestamp, texto.

#### 4.3.9 Novos Componentes (Performance)

BarList, NotesView, PerfNewChannel, demo-switch, sort headers (funcao inline), sparklines nos KPIs.

#### 4.3.10 Refatorar (Performance)

YtHealthRing (120->150px), YtOverview (9->6 KPIs + sparklines), YtHealthCoach (remover ring/radar, add summary), YtOutliersV2 (lista->grid cards + affordance), YtDemographicsView (inline->BarList), YtSearchTermsView (reescrever completo), yt-analytics-tabs (add page-head, demo-switch, key no tabpanel).

---

### 4.4 Library + Wizard + Mobile Tab Bar

#### 4.4.1 Toggle Principal

Unificar `/ab-lab/library` e `/ab-lab/new` em uma unica rota com toggle `.seg-pills` (Biblioteca / Wizard). Estado local, sem navegacao entre rotas. Troca aplica `.fade-in`.

#### 4.4.2 Biblioteca — Com Acervo

lib-grid stagger (4->3->2). lib-card (lift no hover): thumb com lib-hover overlay (opacity 0->1, botoes "Usar no teste" + "Excluir"), lib-lift badge (verde/vermelho), titulo, tags, Longevity dots + "usada Nx". Busca + longevity legend + btn "Enviar".

#### 4.4.3 Biblioteca — Vazia

lib-empty: icone Library 64px, titulo 19px "Sua biblioteca de thumbs esta vazia", subtitulo, 2 CTAs.

#### 4.4.4 Wizard (5 Steps)

Step rail (.done verde, .cur accent). Steps:
1. **Tipo:** grid 2-col, 4 tipos (Combo c/ RECOMENDADO, Thumbnail, Titulo, Descricao)
2. **Ideias:** mcp-callout Cowork + hipotese textarea
3. **Variantes:** cards A/B/C/D (cores --v-*), thumb 280px + upload-slot com "Escolher da Biblioteca" + "Importar do Pipeline" (NOVO), title-input + char-count, brief-box
4. **Config:** grid 1fr/280px, campos com toggles/sliders, estimate sticky
5. **Revisar:** grid 340px/1fr, sumario + preview 3 thumbs

wizard-foot: Voltar / Indicador / Continuar|Ativar.

#### 4.4.5 Pipeline Picker Dialog (NOVO)

Modal portal, max 560px. Grid 2-col de frames do Pipeline. Selecao single (.picker-item.sel). "Importar pra {letra}".

#### 4.4.6 Mobile Tab Bar

Refatorar YouTubeShell: scroll-snap, edge-fades com JS (.scrolled/.at-end), auto-scroll aba ativa, pseudo-elements gradiente 34px. 8 tabs PT-BR. Hit targets >=44px. Chrome breakpoint 760px.

#### 4.4.7 Novos Componentes (Library)

PipelinePickerDialog, LibEmpty, LongevityLegend. Refatorar: routing toggle -> estado, lib-hover overlay, wizard step 3 + pipeline btn.

---

## 5. Preocupacoes Transversais

### 5.1 Acessibilidade

**Keyboard:** todo `onClick` em nao-button -> `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter click, Space preventDefault+click).

**Focus ring:** `.yt-focus-ring:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }`

**aria-sort:** em TODA `<th>` ordenavel (search-table, vtable, videos table, comments table).

**aria-expanded:** em todo controle expansivel (history-toggle, vt-detail, cd-more).

**aria-hidden="true":** em icones decorativos. Icones solitarios em botoes -> `aria-label` no botao.

**tabular-nums (.tnum):** em TODO numero que pode mudar/alinhar (KPIs, CTR, views, multiplicadores, timestamps, contadores).

**Modais/drawers:** role="dialog", aria-modal="true", focus trap (use-modal-focus-trap hook), retorno de foco, Esc fecha.

### 5.2 Portais

**Regra:** TODO modal/drawer usa `createPortal(node, document.body)`.

**Migrar:** SettingsDrawer, AbPauseDialog, AbEndTestDialog, LibraryPickerDialog, VideoPickerDialog, confirmacoes de delete.
**Construir com portal:** ChannelDrawer, VideoModal, ZoomModal, PipelinePickerDialog.

Wrapper reutilizavel `<YtPortal>` em `youtube/_components/yt-portal.tsx`.

### 5.3 Toast Unificado

Sonner com `<Toaster>` no layout YouTube. Migrar: useState+setTimeout artesanal, window.confirm. Manter: toast() do Sonner ja usado em Pipeline.

### 5.4 Chrome/Shell

Refatorar YouTubeShell: Fraunces no titulo, tokens de motion nas tabs, edge-fades com JS, yt-content-inner max 1340px, token banner ambar, labels PT-BR.

---

## 6. Migracoes, Testes e Definicao de Pronto

### 6.1 Fases de Implementacao

**Fase 1 (Motor, sequencial, ~3-4h):**
1.1 Tokens CSS | 1.2 youtube-motion.css | 1.3 Reduced-motion guard | 1.4 Fraunces | 1.5 Sonner | 1.6 Breakpoints | 1.7 Classes base de componentes

**Fase 2 (Telas, paralelo, ~4-5h):**
Observatory | AB Lab Detail | Performance | Library | Mobile Tab Bar

**Fase 3 (Polish, ~1-2h):**
Testes DoD | Audit a11y | Visual QA

### 6.2 Feature Flag

`YT_REDESIGN_SCREENS` (env var): comma-separated screen names. Ausente = todas novas ativas. Vazio = todas antigas. Permite rollback por tela sem redeploy.

### 6.3 Chart Adjustments

| Chart | Acao |
|---|---|
| Gauge | +size (default 132), +color, +reached |
| RadarChart | +size (default 280), +max (default 100) |
| ConfidenceChart | +height, +accent, +final |
| MultiLine | +height, suffix->unit |
| PSparkline | CONSOLIDAR 3 copias -> _shared/, +niceLine(), 72x26 |
| BarList | CRIAR {items, keyf, valf, color} |
| Longevity | EXTRAIR de inline -> {n, size=6} |

### 6.4 Empty States

| Estado | Componente | Animacoes |
|---|---|---|
| Canal novo (Performance) | PerfNewChannel | skelBar (4 barras) |
| Inicio (AB Lab) | EarlyState | earlyPulse, earlyDot (3 pontos), skelBar |
| Biblioteca vazia | LibEmpty | Nenhuma (estatico, entra com .fade-in) |
| Filtro sem resultado | EmptyFilter | Nenhuma |

### 6.5 Fixtures de Desenvolvimento

`apps/web/src/lib/youtube/fixtures/`:
- `observatory-fixtures.ts` — 12 canais, 6 mudancas, 6 outliers, insights (heatmap 7x24, tags, engagement, gaps)
- `performance-fixtures.ts` — health breakdown 6 eixos, 7 search terms, demographics
- `ab-fixtures.ts` — early state checkpoints + ETA

Gated por `NODE_ENV === 'development'`. Tipados com `as const satisfies`.

### 6.6 Definition of Done (12 criterios)

| # | Criterio | Tipo |
|---|----------|------|
| 1 | Card clicavel sobe 2px no hover | Unit |
| 2 | Card KPI NAO se move | Unit |
| 3 | Tab -> affordance focus aparece | Integration |
| 4 | Sort header -> reordena + chevron + aria-sort | Integration |
| 5 | Toggle squish no active | Unit |
| 6 | Slider thumb halo | Unit |
| 7 | Sub-aba -> conteudo anima | Integration |
| 8 | Botao afunda 1px, disabled inert | Unit |
| 9 | Reduced-motion zera animacoes | Unit |
| 10 | Keyboard-only navigation completa | Integration |
| 11 | Nenhum botao morto | Audit |
| 12 | Laranja <=10% + pt-BR | Manual |

### 6.7 Inventario Final

| Categoria | Criar | Refatorar | Preservar | Descartar |
|---|---|---|---|---|
| Motor | 3 | 2 | 0 | 0 |
| Componentes base | 8 | 0 | 0 | 0 |
| Charts | 1 | 3 | 10 | 0 |
| Observatory | 8 | 6 | 1 | 0 |
| AB Lab | 6 | 11 | 52 | 0 |
| Performance | 6 | 7 | 2 | 1 |
| Library + Wizard | 4 | 5 | 25 | 0 |
| Mobile Tab Bar | 0 | 1 | 0 | 0 |
| **Totais** | **36** | **35** | **90** | **1** |

Bundle: ~67KB raw / ~31KB gzip incremental.

### 6.8 Dependencias

**Phase 0 (ciclo separado, bloqueante para AB Lab Pausado):**
- 0.1 Drift detection false positive
- 0.2 Auto-pause incompleto
- 0.3 Original thumbnail mutavel
- 0.4 Resume sem verificacao

**Mitigacao:** botao "Retomar" disabled com tooltip ate Phase 0 em producao.

**YouTube Analytics API:** CTR retorna 0 em alguns casos (fix na Phase 0). Demographics requer >500 views. Search Terms requer Search Console habilitado.

---

## Appendix A: Data Shapes

> All `View` suffixed interfaces are frontend-only (serialized from server to client).
> `Row` suffixed interfaces are DB shapes (existing in `types.ts` / `ab-types.ts`).
> Existing types are referenced via `import from` comments — not redefined.

### A.1 Observatory (Competitor Dashboard)

```typescript
// ── from ab-types.ts (existing, referenced — NOT redefined) ──
// CompetitorChannel, CompetitorVideo, CompetitorChange

// ── New frontend view types ──

/** Competitor channel card — enriched for the redesigned obs-grid. */
export interface CompetitorChannelView {
  id: string
  channelId: string
  channelName: string
  thumbnailUrl: string | null
  subscriberCount: number | null
  videoCount: number
  addedAt: string
  lastSyncedAt: string | null
  /** Average engagement rate across last 10 videos (likes+comments / views). */
  avgEngagement: number | null
  /** Subscriber delta over last 30 days. Positive = growth. */
  growthDelta: number | null
  /** 30-point sparkline for subscriber growth (daily). */
  growthSparkline: number[]
  /** 3 most recent videos for the shelf preview. */
  recentVideos: CompetitorVideoView[]
  /** vs-you comparison — null if our channel has no data yet. */
  vsYou: VsYouComparison | null
  /** Unread change flags since last visit. */
  changeFlags: ChangeFlag[]
}

/** Competitor video as rendered in shelf, drawer, and modal. */
export interface CompetitorVideoView {
  id: string
  videoId: string
  title: string | null
  thumbnailUrl: string | null
  viewCount: number
  publishedAt: string | null
  /** View count delta since first tracked (growth indicator). */
  viewDelta: number | null
  /** Outlier multiplier vs channel median — null if not an outlier. */
  outlierMultiplier: number | null
  /** Tier derived from outlierMultiplier: mid (2-5x), high (5-10x), top (>10x). */
  outlierTier: 'mid' | 'high' | 'top' | null
}

/** A detected change (title/thumbnail/description) on a competitor video. */
export interface CompetitorChangeView {
  id: string
  videoId: string
  videoTitle: string | null
  channelName: string
  channelThumbnailUrl: string | null
  changeType: 'title' | 'description' | 'thumbnail'
  oldTitle: string | null
  newTitle: string | null
  oldThumbnailUrl: string | null
  newThumbnailUrl: string | null
  viewCountAtChange: number | null
  detectedAt: string
  bookmarked: boolean
  /** Full change history for this video (expanded via history-toggle). */
  history: CompetitorChangeView[]
}

/** Outlier card for the Outliers sub-tab grid. */
export interface CompetitorOutlierView {
  id: string
  videoId: string
  title: string | null
  thumbnailUrl: string | null
  channelName: string
  viewCount: number
  publishedAt: string | null
  /** How many times above the channel median view count. */
  multiplier: number
  /** Visual tier: mid=#60A5FA (2-5x), high=#A78BFA (5-10x), top=#D9614A (>10x). */
  tier: 'mid' | 'high' | 'top'
}

/** Insights tab — aggregated intelligence across all tracked competitors. */
export interface CompetitorInsights {
  /** 7x24 matrix: rows = days (mon-sun), cols = hours (0-23). Values = avg views. */
  heatmap: number[][]
  /** Top-performing tags across competitor videos, sorted by frequency. */
  tags: CompetitorTagStat[]
  /** Engagement comparison: their channels vs ours. */
  engagement: CompetitorEngagementStat[]
  /** Content gaps: topics competitors cover that we don't. */
  gaps: CompetitorGap[]
}

export interface CompetitorTagStat {
  tag: string
  /** Number of competitor videos using this tag. */
  count: number
  /** Average view count of videos with this tag. */
  avgViews: number
}

export interface CompetitorEngagementStat {
  channelName: string
  channelThumbnailUrl: string | null
  /** Engagement rate = (likes + comments) / views. */
  engagementRate: number
  /** True when this entry represents our own channel (highlighted in UI). */
  isUs: boolean
}

export interface CompetitorGap {
  /** Topic or keyword cluster they cover that we don't. */
  topic: string
  /** Number of competitor channels covering this topic. */
  competitorCount: number
  /** Average views for this topic across competitors. */
  avgViews: number
  /** Whether we have any video matching this topic. */
  weCover: boolean
}

/** Side-by-side comparison pill between a competitor and our channel. */
export interface VsYouComparison {
  /** Subscriber difference (positive = they have more). */
  subsDelta: number
  /** Engagement rate difference (positive = they outperform us). */
  engagementDelta: number
  /** Average views difference (positive = they outperform us). */
  avgViewsDelta: number
  /** Upload frequency difference in videos/month (positive = they post more). */
  frequencyDelta: number
}

/** Badge indicating recent activity on a competitor channel. */
export interface ChangeFlag {
  type: 'title' | 'description' | 'thumbnail'
  /** Number of changes of this type since last visit. */
  count: number
  /** Most recent change timestamp. */
  latestAt: string
}

/** Stats displayed in the Channel Drawer (cd-stats grid). */
export interface ChannelStats {
  totalViews: number
  avgViewsPerVideo: number
  uploadFrequency: number
  /** Average engagement rate across all tracked videos. */
  engagementRate: number
  /** Days since last upload. */
  daysSinceLastUpload: number
}

/** Our channel's stats for vs-you comparisons. */
export interface OurChannelStats {
  subscriberCount: number
  avgViews: number
  engagementRate: number
  /** Videos per month. */
  uploadFrequency: number
}

/** Props for the top-level CompetitorDashboard component. */
export interface CompetitorDashboardProps {
  channels: CompetitorChannelView[]
  changes: CompetitorChangeView[]
  outliers: CompetitorOutlierView[]
  insights: CompetitorInsights
  ourStats: OurChannelStats
  /** Max channels allowed by plan (for counter pill "12/15 canais"). */
  maxChannels: number
}
```

### A.2 Performance

```typescript
// ── from analytics-types.ts (existing, referenced — NOT redefined) ──
// YtHealthScore, YtChannelMetrics, YtDemographics, YtSearchTerm, YtDailyMetric
// ── from scoring-types.ts (existing, referenced — NOT redefined) ──
// Axis, Grade, AxisScore

/** KPI card with sparkline data for the kpi-strip. */
export interface KpiCardView {
  /** Machine key for the metric (e.g. 'views', 'ctr', 'watchTime'). */
  key: string
  label: string
  /** Formatted display value (e.g. "184 mil", "6,2%"). */
  displayValue: string
  /** Raw numeric value for calculations. */
  rawValue: number
  /** Percentage delta vs previous period. Positive = improvement. */
  delta: number
  /** 30-point sparkline (daily values). */
  sparkline: number[]
  /** Lucide icon name. */
  icon: string
}

/** Health card with 6-axis breakdown for the HealthCard gauge. */
export interface HealthBreakdownView {
  overall: number
  axes: HealthAxisView[]
}

export interface HealthAxisView {
  /** One of the 6 scoring axes from scoring-types.ts. */
  axis: Axis
  label: string
  /** Raw metric value (e.g. CTR percentage, retention percentage). */
  value: number
  /** Normalized score 0-100. */
  score: number
  grade: Grade
  /** Color derived from grade: A=#22C55E, B=#60A5FA, C=#FBBF24, D=#EF4444. */
  color: string
}

/** Retention curve data for the SVG area chart. */
export interface RetentionCurveView {
  /** Normalized retention points (0-100), typically 10-12 data points. */
  points: number[]
  /** Benchmark retention line (e.g. 70% for the channel's niche). */
  benchmark: number
  /** Vertical markers for notable moments (e.g. intro end, hook, CTA). */
  markers: RetentionMarker[]
}

export interface RetentionMarker {
  /** Position index in the points array. */
  index: number
  label: string
  /** Drop percentage at this marker vs previous point. */
  dropPercent: number | null
}

/** Props for the Performance Overview section (Visao Geral tab). */
export interface PerformanceOverviewProps {
  health: HealthBreakdownView
  kpis: KpiCardView[]
  retention: RetentionCurveView
  /** Radar chart data: our channel vs benchmark across 6 axes. */
  radar: {
    channel: Record<Axis, number>
    benchmark: Record<Axis, number>
  }
}

/** Health Coach coaching card with severity-based styling. */
export interface CoachingCardView {
  id: string
  /** Rank in priority order (1 = most important). */
  rank: number
  action: string
  reasoning: string
  impact: 'high' | 'medium' | 'low'
  effort: 'high' | 'medium' | 'low'
  estimatedLift: string
  timeline: string
  /**
   * Severity derived from the health score of the relevant axis.
   * Controls card border color: <3 red, <5 amber, >=5 green.
   */
  severity: 'critical' | 'warning' | 'healthy'
  /** Impact badge text (e.g. "+2.500 views/mes"). */
  impactBadge: string
}

/** Outlier video card for your own channel's outlier grid. */
export interface OutlierVideoView {
  id: string
  youtubeVideoId: string
  title: string
  thumbnailUrl: string | null
  viewCount: number
  publishedAt: string
  /** Multiplier vs channel median views. */
  multiplier: number
  /** Visual tier based on multiplier range. */
  tier: 'mid' | 'high' | 'top'
  /** Whether this video already has an active A/B test. */
  hasActiveTest: boolean
  grade: Grade
}

/** Demographics breakdown for the Demographics sub-tab. */
export interface DemographicsView {
  ageGender: Array<{ ageGroup: string; male: number; female: number }>
  /** Top countries sorted by view percentage. */
  countries: Array<{ country: string; views: number; percentage: number }>
  /** Device breakdown sorted by view percentage. */
  devices: Array<{ deviceType: string; views: number; percentage: number }>
  /** Gender totals for the segmented bar. */
  genderTotals: { male: number; female: number; other: number }
}

/** Search term row for the sortable search-table. */
export interface SearchTermView {
  term: string
  views: number
  /** Click-through rate for this search term. */
  ctr: number
  /**
   * Trend indicator: 'up' if views increased WoW, 'down' if decreased,
   * 'flat' if within +/-5%.
   */
  trend: 'up' | 'down' | 'flat'
  /** Estimated watch time in minutes for this term. */
  estimatedMinutesWatched: number
}

/** A note entry (manual or bot-generated) in the Notes sub-tab. */
export interface NoteView {
  id: string
  /** Display name of the note author. */
  author: string
  /** Avatar URL — null uses default initial avatar. */
  avatarUrl: string | null
  text: string
  timestamp: string
  /** True when the note was generated by Cowork (Claude) — shows cyan bot badge. */
  isBot: boolean
}

/** Props for the Performance tabs container. */
export interface PerformanceTabsProps {
  overview: PerformanceOverviewProps
  coaching: CoachingCardView[]
  /** Coach summary text and projection (e.g. "+12 pts em 30 dias"). */
  coachSummary: { text: string; projection: string }
  outliers: OutlierVideoView[]
  demographics: DemographicsView | null
  searchTerms: SearchTermView[]
  notes: NoteView[]
  /** Whether this is a new channel (triggers PerfNewChannel skeleton view). */
  isNewChannel: boolean
}
```

### A.3 AB Lab Detail (Early State + Active Refactor)

```typescript
// ── from ab-types.ts (existing, referenced — NOT redefined) ──
// AbTestActiveView, AbTestBaseView, DisplayLabel, FullChartVariant, GateResult,
// VariantThumb, VariantDbEntry, LiveMonitor, AbTestConfig, TestType

/** Checkpoint in the early state progress tracker. */
export interface EarlyCheckpoint {
  /** Display label (e.g. "Primeiro ciclo", "Burn-in completo", "Confianca minima"). */
  label: string
  /** Whether this checkpoint has been reached. */
  reached: boolean
  /** Estimated time to reach this checkpoint (e.g. "~6h", "~48h"). Null hides ETA. */
  eta: string | null
  /**
   * Actual date when reached. Null if not yet reached.
   * Format: ISO 8601 string.
   */
  reachedAt: string | null
  /** True when this is the next upcoming checkpoint (styled with --accent). */
  isSoon: boolean
}

/** Early state view — dedicated screen for tests with insufficient data. */
export interface AbEarlyStateView {
  testId: string
  videoTitle: string
  /** Test type flag displayed in the EarlyBand. */
  flag: TestType
  /** Current day of the test (for "Dia 0 de {totalDays}"). */
  dayOf: number
  totalDays: number
  /** Progress milestones for the EarlyHero right column. */
  checkpoints: EarlyCheckpoint[]
  /** Variant table rows with placeholder CTR values. */
  variants: Array<{
    label: DisplayLabel
    color: string
    thumbUrl: string | null
    titleText: string | null
    /** Always null during early state (displayed as "--"). */
    ctr: null
    isOriginal: boolean
  }>
  /** Test configuration for display (duration, confidence target, etc.). */
  config: AbTestConfig
  /** Pipeline source ID — enables "Ver no Pipeline" button when present. */
  sourcePipelineId: string | null
}

/**
 * Dispatch condition: the test is in early state when cycles.done < 1
 * AND confirmedData.confidence < 5. Usage:
 *
 *   import type { AbTestActiveView } from './ab-types'
 *   const isEarly = (v: AbTestActiveView) =>
 *     v.cycles.done < 1 && v.confirmedData.confidence < 5
 */

/**
 * What's preserved in the Active state refactor (all 18 existing components).
 * This interface documents the restyling contract, not new data.
 */
export interface AbActiveRefactorProps {
  /**
   * The full AbTestActiveView from ab-types.ts — no structural changes.
   * Only visual restyling: HeroBand gauge 108px, VariantTable grid,
   * GatesPanel 2-col, Feed highlight, signal/computed 2-col grid.
   */
  view: AbTestActiveView
  /** Restyled variant table column widths (px). */
  tableColumns: {
    thumb: number
    label: number
    ctr: number
    impressions: number
    clicks: number
    pBest: number
  }
  /**
   * Gates panel layout: 2-column grid with pass/fail coloring.
   * Green (.pass) for passed gates, dim for pending.
   */
  gatesLayout: '2-col'
}

/** Empty chart placeholder shown during early state and loading. */
export interface EmptyChartProps {
  /** Lucide icon name rendered at 24px above the title. */
  icon: string
  /** Short title (e.g. "Grafico de confianca"). */
  title: string
  /** Explanatory message (e.g. "Dados insuficientes para exibir"). */
  message: string
  /** Estimated time until data is available (e.g. "~48h"). Null hides the ETA. */
  eta: string | null
}
```

### A.4 Library + Wizard

```typescript
// ── from ab-types.ts (existing, referenced — NOT redefined) ──
// ThumbnailLibraryEntry, ThumbnailLongevity, LongevityStatus, DisplayLabel,
// TestType, VariantMetadata

/** Library card view — enriched ThumbnailLibraryEntry for the lib-grid. */
export interface LibraryEntryView {
  id: string
  blobUrl: string
  /** Display title — falls back to videoTitle if title is null. */
  title: string
  tags: string[]
  /** CTR lift at the time of winning the A/B test. Null for manual uploads. */
  lift: number | null
  /** Current longevity status based on most recent checkpoint. */
  longevity: LongevityStatus | null
  /**
   * Tone/style classification derived from VariantMetadata.classification.
   * Null when metadata is unavailable.
   */
  tone: 'hero' | 'challenger' | 'safety' | null
  /** Number of times this thumbnail has been used in A/B tests. */
  usedCount: number
  /** Source of the library entry. */
  sourceType: 'test_winner' | 'manual_upload' | 'competitor_bookmark'
  /** Original video title for context. */
  videoTitle: string | null
  /** CTR at last longevity checkpoint — null if no checkpoints yet. */
  currentCtr: number | null
  /** All longevity checkpoint data for the dots indicator. */
  longevityCheckpoints: Array<{
    days: 7 | 30 | 60 | 90
    status: LongevityStatus
    changePercent: number | null
  }>
  createdAt: string
}

/** Variant card in the Wizard step 3 (variant editor). */
export interface WizardVariantView {
  /** Variant letter: A, B, C, or D. */
  letter: DisplayLabel
  /** CSS color variable value (e.g. "#E8823C" for B). */
  color: string
  /** Thumbnail blob URL — null when no image uploaded yet. */
  thumbUrl: string | null
  /** Title text input value. */
  title: string
  /** Creative brief / description text. */
  brief: string
  /** Whether this is the original/control variant (A). */
  isOriginal: boolean
  /** Source of the thumbnail: upload, library pick, or pipeline import. */
  thumbSource: 'upload' | 'library' | 'pipeline' | null
  /** Character count for the title (displayed as char-count badge). */
  titleCharCount: number
  /** Variant metadata for AI-enriched fields. */
  metadata: Partial<VariantMetadata>
}

/** Item in the Pipeline Picker dialog grid. */
export interface PipelinePickerItem {
  /** Pipeline frame/thumbnail ID. */
  id: string
  /** Blob URL of the pipeline-generated thumbnail. */
  blobUrl: string
  /** AI-generated title suggestion associated with this frame. */
  titleSuggestion: string | null
  /** Creative direction description from the pipeline. */
  creativeDirection: string | null
  /** Pipeline source ID for traceability. */
  sourcePipelineId: string
  /** Whether this item is currently selected in the picker. */
  selected: boolean
}
```
