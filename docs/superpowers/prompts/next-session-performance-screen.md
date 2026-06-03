# Prompt: Performance Screen — Visual QA & Polish

## Contexto

A tela Performance (Desempenho) do YouTube CMS já existe em `apps/web/src/app/cms/(authed)/youtube/analytics/` com componentes funcionais. O handoff de design está em `design_handoff_youtube_cms/` com 4 arquivos:
- `yt/performance.jsx` — main layout (197 lines): HealthCard, HealthRadar, KpiStrip, RetentionCurve, PerfNewChannel
- `yt/performance-tabs.jsx` — sub-tabs (196 lines): CoachView, OutliersView, DemoView, SearchView, NotesView
- `yt/performance.css` — styles (75 lines)
- `yt/performance-data.js` — mock data (108 lines)

## Tela Overview (principal)

Layout: `page-head` → `subtabs` (6 tabs) → `perf-top` grid (1.5fr 1fr) → `kpi-strip` (6 cards) → `RetentionCurve`

### Componentes:

1. **HealthCard** (`health-card`):
   - Gauge 150x150 com score 0-100, meta 80
   - Badge verde "Saudável"
   - Breakdown: 6 rows (CTR, Retenção, Watch time, Frequência, Engajamento, Crescimento)
   - Cada row: label + bar (green >= 75, accent >= 60, amber < 60) + score mono + note dim

2. **HealthRadar** (`card`):
   - RadarChart 260px com 6 axes
   - 2 series: Canal (accent) vs Meta (green)
   - Legend row

3. **KpiStrip** (`kpi-strip`, 6 cols):
   - Card per KPI: metric-label + icon, kpi-val (25px mono bold), delta (up=green, down=red), sparkline 72x26

4. **RetentionCurve** (`card`):
   - SVG area chart 640x220 with accent gradient fill
   - Y-axis: 0-100% labels
   - Retention marks (vertical dashed lines: Gancho, Meio)
   - Notes row below chart

### Sub-tabs:
- **Visão geral** (overview) — main view above
- **Notas** — textarea + saved notes with author avatars
- **Health Coach** — AI diagnosis card (gradient bg) + coach items (severity badges, action buttons)
- **Outliers** — own channel outlier grid + video modal
- **Demografia** — 4 cards: age bars, gender bar, geo bars, devices bars
- **Busca** — sortable table with search terms, CTR, trend icons, hover "Criar roteiro"

### Estado "Canal novo":
- Early band card with pulse animation
- KPI cards with "—" values
- Empty chart skeleton

## Arquivos existentes

| Componente | Arquivo existente |
|---|---|
| Main page | `analytics/page.tsx` |
| Tabs shell | `analytics/_components/yt-analytics-tabs.tsx` |
| Overview | `analytics/_components/yt-overview.tsx` |
| Health ring | `analytics/_components/yt-health-ring.tsx` |
| Radar | `analytics/_components/yt-radar-chart.tsx` |
| Grades v2 | `analytics/_components/yt-grades-v2.tsx` |
| Retention | `analytics/_components/yt-retention-curve-v2.tsx` |
| Score bar | `analytics/_components/yt-score-bar.tsx` |
| Coach | `analytics/_components/yt-health-coach.tsx` |
| Outliers | `analytics/_components/yt-outliers-v2.tsx` |
| Demographics | `analytics/_components/yt-demographics.tsx` |
| Search | `analytics/_components/yt-search-terms.tsx` |
| Notes | `analytics/_components/notes-view.tsx` |
| New channel | `analytics/_components/perf-new-channel.tsx` |
| Notifications | `analytics/_components/yt-notifications-bell.tsx` + panel |
| Video diagnostic | `analytics/_components/yt-video-diagnostic.tsx` |

## CSS do handoff (performance.css — 75 lines)

Key classes to add/verify in youtube-motion.css:
- `.perf-top` — grid 1.5fr 1fr
- `.health-body` — grid 200px 1fr
- `.health-gauge-wrap` — flex col center, border-right
- `.health-breakdown` — flex col gap 10
- `.hb-row` — grid 92px 1fr 28px auto
- `.kpi-card` — padding 15px 16px
- `.kpi-val` — 25px mono bold
- `.kpi-delta` — inline-flex, .up=green, .down=red
- `.ret-notes` — flex gap 24 wrap
- `.coach-summary` — flex, gradient bg
- `.coach-item` — flex, severity icons
- `.demo-row` — flex align-center gap 12
- `.gender-bar` — flex h-14 rounded overflow hidden
- `.search-table` — full width, sortable headers
- `.notes-input` — textarea styled
- `.note-row` — flex with avatar

## Tarefa

1. **Ler cada componente existente** e comparar com o handoff JSX
2. **Abrir `Performance.html` no browser** (file://) para visual reference
3. **Polish cada seção** para match pixel-perfect com handoff
4. **Garantir** que youtube-motion.css tem todas as classes do performance.css
5. **Usar shared classes** (.card, .card-head, .card-pad, .card-title, .dim, .bar, .insight-note) já definidas na sessão anterior

## Regras

- Trabalhar em `staging` branch (nunca feature branches)
- `npm run build:packages` se mexer em packages/
- Rodar `npm run test:web` antes de commitar
- Pre-commit hook roda `next build` — se passar local, passa no Vercel
- Não usar `--no-verify` em commits de código
- Não fazer push sem ter certeza que build passa
