# Prompt: Rewrite Insights Tab to Match Handoff v2

## Contexto

A aba Insights do Observatory (`apps/web/src/app/cms/(authed)/youtube/competitors/_components/insights-tab.tsx`) precisa ser reescrita para match com o handoff atualizado. O handoff agora inclui 3 componentes novos alem dos 4 existentes.

## Componentes do Handoff (ordem no grid)

### 1. Jogada da Semana (NOVO — `play-card`, span `ins-full`)
Card full-width no topo com:
- `.play-eyebrow`: Zap icon 12px (stroke: var(--accent)) + "Jogada da semana" (section-label style)
- `.play-text`: Rich text — "Poste sobre **custo de vida** com a formula **Passaporte BR · solo** (11,4x nos outliers) e publique na janela vazia de **Qua 9h-11h** — onde nascem os hits e o volume e fraco."
- `.btn.cowork.play-cta`: Sparkles icon 14px + "Montar roteiro"
- Derivado de: top gap (lacuna) + top formula + melhor janela vazia do heatmap
- **Dados**: Needs `topGap`, `topFormula`, `bestEmptyWindow` computed server-side

### 2. Cadencia por Canal (NOVO — `cad-card`, span `ins-full`)
Card full-width com swimlane timeline:
- `.card-head`: Activity icon + "Cadencia por canal" + dim subtitle ("quem posta, com que frequencia e o que — ultimos N dias")
- `.cad-axis`: Section labels "Canal · ritmo · janela" (left) + axis ticks (ha 21d, 14d, 7d, hoje) + "ultimo" (right)
- `.cad-row` per channel (clickable):
  - `.cad-id`: avatar circle (2-letter initials, background = channel color) + channel name + freq mono (`X,X/sem`) + window (`Dia Xh`)
  - `.cad-lane`: horizontal track with `.cad-tick` marks (vertical lines at publish positions) + `.cad-dot` circles (sized by views, clickable with title tooltip)
  - `.cad-last.mono`: "ha Xd" (green `.fresh` if < 3 days)
- `.insight-note` at bottom: Zap icon + rich text summary about peak volume vs peak hits
- **Dados**: Needs per-channel publish timeline (video dates + views), channel colors, freq calculation, window detection
- **New type needed**: `CadenceChannel { channelName, color, freq, window, videos: {publishedAt, viewCount, title}[], lastUploadDays }`

### 3. Formulas de Titulo (NOVO — card normal)
- `.card-head`: Zap icon + "Formulas de titulo que furam" + dim "padroes nos N outliers · mult. medio"
- `.formula-row` per formula (clickable):
  - `.formula-top`: `.formula-label` (pattern name) + `.formula-mult.mono` (Nx, accent for top, --text for others)
  - `.formula-bar`: horizontal bar (width = proportional to multiplier, accent for top, surface-3+border for others)
  - `.formula-eg`: `.formula-hint` (why it works) + `.formula-count.mono` (Nx) + example title in quotes
- **Dados**: Needs title pattern analysis — regex-based detection on outlier titles
- **New type needed**: `TitleFormula { label, multiplier, hint, count, exampleTitle }`
- **Backend**: `rankFormulas()` function that analyzes outlier video titles for patterns

### 4. Horarios do Nicho (EXISTENTE — melhorado)
- `.card-head`: Calendar icon + "Horarios do nicho" + `.seg-pills` toggle (Volume | Hits)
- `.dim` subtitle: "quando os concorrentes publicam — todos os uploads (horario de SP)"
- `.heatmap` grid: 7 rows (Seg-Dom) x 24 cols (0h-23h), color scale green→yellow→red
- Heat scale legend: "menos" [5 cells] "mais"
- `.insight-note`: "Pico de publicacao: **Sex 18h-20h** (lotado). Veja a aba **Hits** pra onde a performance realmente aparece."
- **Volume mode**: all uploads (current behavior)
- **Hits mode**: only videos with multiplier > threshold (needs `outlierMultiplier` on videos)
- **Dados**: Current heatmap data works for Volume. Hits needs separate heatmap filtered to high-performers.
- **New data needed**: `hitsHeatmap: number[][]` (same shape, filtered to outliers only)

### 5. Tags Mais Usadas (EXISTENTE — melhorado)
- `.card-head`: BarChart3 icon + "Tags mais usadas" + dim "em N canais"
- `.tag-row` per tag (clickable):
  - `.tag-name.truncate`: tag text
  - `.bar`: horizontal bar (width proportional, accent for top 3, blue for rest)
  - `.mono.dim.tag-count`: count number
  - `.tag-go` ArrowRight icon (12px, var(--text-dim))
- **Dados**: Current `tags` array works. Need to add color logic (top 3 = accent, rest = blue).

### 6. Engajamento Comparado (EXISTENTE — melhorado)
- `.card-head`: Activity icon + "Engajamento comparado" + dim "curtidas + comentarios / views"
- `.eng-row` per channel (clickable except "voce"):
  - `.eng-name.truncate`: channel name (+ `.us-tag` "voce" badge for our channel)
  - `.bar`: horizontal bar (accent for us, surface-3+border for competitors)
  - `.mono.eng-val`: percentage (accent color for us, --text for others)
- **Dados**: Current `engagement` array works. Layout refinement needed.

### 7. Analise de Lacunas (EXISTENTE — melhorado)
- `.card-head`: Target icon + "Analise de lacunas" + dim "temas deles que voce ainda nao cobre"
- `.card-pad.gap-cols`: Two-column layout
  - `.gap-col` left: "Tags deles" label + `.gap-chips` with:
    - `.gap-chip.gap.clickable`: Plus icon 11px + tag text (for gaps we don't cover)
    - `.gap-chip`: plain tag (for shared tags)
  - `.gap-divider`: vertical separator
  - `.gap-col` right: "Suas tags" label + `.gap-chips` with:
    - `.gap-chip.ours`: our tags (different color)
- `.insight-note`: Sparkles icon + "**N lacunas** com tracao comprovada e zero cobertura sua — candidatas a roteiro."
- CTAs: "Roteirizar as N lacunas no Cowork" (btn cowork sm) + "Testar o tema de maior tracao" (btn sm)
- **Dados**: Current `gaps` simplified. Need real `weCover` computation from our video tags.

## Layout Grid

`.insights-grid` uses CSS grid:
- `ins-full` class = spans full width (2 columns)
- Normal cards: 2 per row

Order: Jogada da Semana (full) → Cadencia (full) → Formulas | Horarios → Tags | Engajamento → Lacunas (full)

## CSS Classes Necessarias (adicionar ao youtube-motion.css)

### Play Card
```css
.play-card { position: relative; overflow: hidden; }
.play-main { padding: 18px 22px; display: flex; flex-direction: column; gap: 12px; }
.play-eyebrow { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
.play-text { font-size: 14px; line-height: 1.55; color: var(--text-muted); }
.play-text b { color: var(--text); font-weight: 600; }
.play-text .dim { color: var(--text-dim); }
.play-cta { position: absolute; right: 18px; top: 50%; transform: translateY(-50%); }
```

### Cadence Card
```css
.cad-card { }
.cad-lanes { display: flex; flex-direction: column; gap: 0; }
.cad-axis { display: flex; align-items: center; gap: 0; padding: 0 0 8px; }
.cad-axis-ticks { position: relative; flex: 1; height: 16px; }
.cad-axis-ticks > span { position: absolute; font-size: 10px; color: var(--text-dim); transform: translateX(-50%); }
.cad-row { display: flex; align-items: center; gap: 0; padding: 8px 0; border-top: 1px solid var(--border); cursor: pointer; }
.cad-row:hover { background: var(--surface-2); }
.cad-id { display: flex; align-items: center; gap: 10px; width: 200px; flex-shrink: 0; }
.cad-av { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-size: 10px; font-weight: 700; color: #16110b; flex-shrink: 0; }
.cad-meta { min-width: 0; }
.cad-name { font-size: 12.5px; font-weight: 600; color: var(--text); }
.cad-sub { display: flex; align-items: center; gap: 4px; font-size: 10.5px; color: var(--text-dim); }
.cad-freq { color: var(--text-muted); }
.cad-win { color: var(--text-dim); }
.cad-lane { position: relative; flex: 1; height: 28px; }
.cad-tick { position: absolute; top: 0; width: 1px; height: 100%; opacity: 0.25; }
.cad-dot { position: absolute; top: 50%; transform: translate(-50%, -50%); border-radius: 50%; cursor: pointer; transition: transform 0.15s; }
.cad-dot:hover { transform: translate(-50%, -50%) scale(1.4); z-index: 1; }
.cad-last { width: 48px; text-align: right; font-size: 11px; color: var(--text-dim); flex-shrink: 0; }
.cad-last.fresh { color: var(--green); }
```

### Formula Card
```css
.formula-row { padding: 8px 0; border-top: 1px solid var(--border); cursor: pointer; }
.formula-row:first-child { border-top: none; }
.formula-row:hover { background: var(--surface-2); border-radius: 8px; }
.formula-top { display: flex; align-items: center; justify-content: space-between; }
.formula-label { font-size: 13px; font-weight: 600; color: var(--text); }
.formula-mult { font-size: 13px; }
.formula-bar { height: 4px; border-radius: 2px; background: var(--surface-2); margin: 6px 0; }
.formula-bar > span { display: block; height: 100%; border-radius: 2px; }
.formula-eg { font-size: 11px; color: var(--text-dim); }
.formula-hint { color: var(--text-muted); font-style: italic; }
.formula-count { margin: 0 2px; }
```

### Insight Note
```css
.insight-note { display: flex; align-items: flex-start; gap: 8px; padding: 10px 14px; background: var(--surface-2); border-radius: 10px; font-size: 12px; line-height: 1.5; color: var(--text-muted); margin-top: 14px; }
.insight-note b { color: var(--text); font-weight: 600; }
```

### Gap improvements
```css
.gap-cols { display: flex; gap: 0; }
.gap-col { flex: 1; padding: 0 16px; }
.gap-divider { width: 1px; background: var(--border); flex-shrink: 0; }
.gap-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.gap-chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; font-size: 11.5px; background: var(--surface-2); color: var(--text-muted); }
.gap-chip.gap { border: 1px dashed var(--border); background: transparent; cursor: pointer; }
.gap-chip.gap:hover { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.gap-chip.ours { background: var(--accent-soft); color: var(--accent); }
```

## Dados Novos Necessarios

### Tipos novos em `observatory-types.ts`
```typescript
export interface CadenceChannel {
  channelName: string
  channelId: string
  color: string
  freq: number           // videos/semana
  window: string         // "Qua 9h" — dia+hora mais frequente
  videos: CadenceVideo[]
  lastUploadDays: number
}

export interface CadenceVideo {
  title: string
  viewCount: number
  publishedAt: string
}

export interface TitleFormula {
  label: string
  multiplier: number
  hint: string
  count: number
  exampleTitle: string
}

export interface PlayOfTheWeek {
  topicBold: string      // "custo de vida"
  formulaBold: string    // "Passaporte BR · solo"
  formulaMult: number    // 11.4
  windowBold: string     // "Qua 9h-11h"
  windowReason: string   // "onde nascem os hits e o volume e fraco"
}
```

### Expandir `CompetitorInsights`
```typescript
export interface CompetitorInsights {
  heatmap: number[][]
  hitsHeatmap: number[][]          // NEW: filtered to outliers
  tags: CompetitorTagStat[]
  engagement: CompetitorEngagementStat[]
  gaps: CompetitorGap[]
  cadence: CadenceChannel[]        // NEW
  formulas: TitleFormula[]         // NEW
  play: PlayOfTheWeek | null       // NEW
}
```

### Backend computation em `page.tsx`

1. **cadence**: Per-channel timeline from existing `channelVideos` data. Freq = count in 21 days / 3. Window = mode of (day, hour) pairs. Color from CHANNEL_COLORS palette.
2. **formulas**: `rankFormulas()` — regex patterns applied to outlier titles:
   - "Passaporte BR · solo" → titles with "passaporte" + "sozinho/solo"
   - "Em dolar" → titles with "dolar/dollar/R$"
   - "Nome do lugar" → titles with country/city names
   - "Primeira pessoa" → titles starting with "Eu/Fui/Larguei/Cheguei"
   - "Preco em R$" → titles with "R$" + number
   - "Numero/lista" → titles with numbers
3. **play**: Derive from top gap + top formula + best empty window in heatmap
4. **hitsHeatmap**: Same as heatmap but filtered to videos where `outlierMultiplier >= 2`

## Arquivo a reescrever

`apps/web/src/app/cms/(authed)/youtube/competitors/_components/insights-tab.tsx`

## Prioridade de implementacao

1. Layout grid + card shells (CSS)
2. Cadencia por canal (visual mais impactante, dados ja disponiveis)
3. Heatmap melhorado (Volume/Hits toggle)
4. Tags + Engajamento (refinamento visual)
5. Lacunas (gap-chips + CTAs)
6. Formulas de titulo (precisa regex engine)
7. Jogada da semana (derivada dos outros)
