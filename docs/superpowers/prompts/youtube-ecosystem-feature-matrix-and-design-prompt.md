# YouTube Ecosystem — Feature Matrix & Design Prompt

## Feature Matrix: Estado Atual vs Pos-Spec

### Legenda
- **Funcional** = funcionando corretamente
- **Parcial** = construido mas incompleto/mock/UI quebrada
- **Backend only** = action existe, sem trigger na UI
- **Mock data** = mostra valores fake
- **Quebrado** = bugado
- **Nao existe** = precisa ser construido

---

### BUGS CRITICOS (Fase 0)

| Feature | Atual | Pos-Spec | Fase |
|---------|-------|----------|------|
| Drift detection (watchdog) | **QUEBRADO** — compara Blob URL vs YouTube CDN, sempre falso positivo | Funcional — compara YouTube vs YouTube via applied_metadata | 0.1 |
| Auto-pause completo | **QUEBRADO** — nao fecha ciclo, nao reverte thumbnail | Funcional — fecha ciclo + tenta reverter | 0.2 |
| Original thumbnail preservada | **QUEBRADO** — URL mutavel do YouTube CDN, original perdida apos rotacao | Funcional — download + Vercel Blob imutavel | 0.3 |
| Resume com verificacao de drift | **QUEBRADO** — sem acknowledgement, resume cego | Funcional — requer acknowledgement antes de retomar | 0.4 |

### DASHBOARD (`/cms/youtube`)

| Feature | Atual | Pos-Spec | Fase |
|---------|-------|----------|------|
| Channel cards (avatar, stats) | Funcional | Funcional (PT-BR) | 4.2 |
| Sync button/status | Funcional | Funcional (PT-BR) | 4.2 |
| Weekly Pick (pin/unpin/extend) | Funcional | Funcional (PT-BR) | 4.2 |
| Schedule config editor | Funcional | Funcional (PT-BR) | 4.2 |
| Token expiry banner | Funcional | Funcional (com botao inline) | Feito |
| Reconectar Token per-channel | **Parcial** — OAuth generico | Funcional — OAuth com channelId + login_hint | 1.4 |
| Strings EN→PT (~30+) | Parcial | Todas em PT-BR | 4.2 |
| Error boundary | Nao existe | Funcional | 4.3 |

### VIDEOS (`/cms/youtube/videos`)

| Feature | Atual | Pos-Spec | Fase |
|---------|-------|----------|------|
| Video list + search/filter | Funcional | Funcional | -- |
| Video optimizer drawer | Funcional | Funcional | -- |
| Category/Feature/Hide toggles | Funcional | Funcional | -- |
| "Start A/B" link | **Parcial** — vai sem pre-selecionar video | Funcional — pre-seleciona video | 3.2 |
| CMS notes editor | Funcional | Funcional | -- |

### A/B LAB (`/cms/youtube/ab-lab`)

| Feature | Atual | Pos-Spec | Fase |
|---------|-------|----------|------|
| KPI strip | Funcional | Funcional (sem mocks) | 1.2 |
| Active test cards | Funcional | Funcional | -- |
| Paused test cards | Funcional | Funcional + botao **Retomar** | 1.3 |
| Learnings panel | Funcional | + alimenta IA | 3.4 |
| Suggested videos | Funcional (formula crua) | grade-based 6 eixos | 3.3 |
| **Botao Pausar** | Disabled "Em breve" | Funcional (AbPauseDialog) | 1.3 |
| **Botao Encerrar** | Nao existe | Funcional (AbEndTestDialog) | 1.3 |
| **Botao Arquivar** | Disabled "Em breve" | Funcional | 1.3 |
| **Resume button** | **NAO EXISTE** (dead end) | Funcional (com drift ack) | 0.4+1.3 |
| Hero band | **Mock** — CTR 5.2%, chance 93% | Dados reais | 1.2 |
| Live monitor | **Mock** — "12 dias", "5.2%" | Dados reais | 1.2 |
| FeedView (YouTube preview) | **Backend only** | Funcional | 1.3 |
| BayesCurves | **Backend only** | Funcional | 1.3 |
| Pipeline thumb import | **Backend only** | Funcional | 1.3 |
| Cowork briefing | **Backend only** | Funcional | 1.3 |
| endAbTest → Library | **Quebrado** | Funcional | 1.3 |

### LIBRARY (`/cms/youtube/ab-lab/library`)

| Feature | Atual | Pos-Spec | Fase |
|---------|-------|----------|------|
| Grid + upload + tags | Funcional | Funcional | Feito |
| **Library picker no wizard** | Nao existe | LibraryPickerDialog | 3.5 |

### COMPETITORS (`/cms/youtube/competitors`)

| Feature | Atual | Pos-Spec | Fase |
|---------|-------|----------|------|
| Search + add + remove | Funcional | Funcional | Feito |
| Channel cards (basico) | Funcional | Rich cards (growth, engagement) | 2b |
| Expand videos (5) | Funcional | 12 videos, lazy load | 2b |
| Change feed (20 items) | Funcional | Tabs, filtros, paginacao | 2b |
| **Aba Outliers** | Nao existe | Multiplicador badge, sort, periodo | 2b |
| **Aba Insights** | Nao existe | Heatmap, tags, engagement, gaps | 2b |
| **4 abas navegaveis** | Nao existe | Canais/Mudancas/Outliers/Insights | 2b |
| **AB test detection** | Nao existe | Badge "Provavel A/B test" | 2a+2b |
| **"Testar esta abordagem"** | Nao existe | Link pro wizard | 3.6 |
| **Notificacoes mudancas** | Nao existe | Notificacao no sync | 2a |
| **Channel growth snapshots** | Nao existe | Daily snapshots | 2a |
| **Dados enriquecidos** | Nao existe | likes, comments, duration, tags | 2a |
| maxResults 50 (era 10) | Parcial | 5x mais dados, mesma quota | 2a |

### PERFORMANCE (`/cms/youtube/analytics`)

| Feature | Atual | Pos-Spec | Fase |
|---------|-------|----------|------|
| Overview (views, watch time) | Funcional | Funcional | -- |
| **CTR / Impressions** | **QUEBRADO — retorna 0** | Dados reais | 1.1 |
| **Saude do Canal** | Quebrado (CTR=0) | Funcional | 1.1 |
| **Radar 6 eixos** | Parcial (CTR=0) | Funcional | 1.1 |
| **"Criar A/B Test" de video** | Backend only (prop nao passada) | Funcional | 3.1 |

### RESUMO

| Metrica | Qtd |
|---------|-----|
| Features catalogadas | ~120 |
| Funcional | ~60 (50%) |
| Parcial/Mock/Backend only | ~33 (28%) |
| Quebrado | ~10 (8%) |
| Nao existe (novo) | ~20 (17%) |

---

## Prompt para claude.ai/design

Cole o prompt abaixo no claude.ai/design para gerar mockups visuais.

---

```
# YouTube CMS Design System — Visual Redesign

## Contexto
Estou redesenhando a secao YouTube do meu CMS pessoal (Next.js 15, dark theme, Tailwind 4). O backend e sofisticado (motor Bayesiano, scoring 6 eixos, competitor monitoring), mas o frontend tem gaps serios: dados fake na UI, features desconectadas, design inconsistente, PT/EN misturado.

Preciso de mockups para TODAS as telas listadas abaixo, seguindo o design system existente.

## Design System (obrigatorio)

### Cores (CSS custom properties — dark theme)
- Background principal: `#1A1714` (warm dark)
- Surface (cards): `#221E19`
- Surface hover: `#2A2520`
- Border: `#332D25`
- Text: `#E8DFD5` (warm off-white)
- Text muted: `#A89B8C`
- Text dim: `#6B5F52`
- Accent: `#FF8240` (orange)
- Accent subtle: `rgba(255, 130, 64, 0.08)`
- Green: `#4ADE80` / subtle `rgba(74, 222, 128, 0.08)`
- Red: `#EF4444`
- Amber: `#FBBF24`
- Purple: `#A78BFA`
- Blue: `#60A5FA`

### Tipografia
- Font: system-ui (Apple system font stack)
- H1: 22px, bold, -0.01em tracking
- H2: 19px, semibold
- Body: 13-14px
- Small: 11-12px
- Micro: 9-10px, uppercase, 0.08em tracking (labels)
- Mono: font-mono (numeros, porcentagens, badges)

### Componentes base
- Cards: border-radius 14px, 1px border
- Buttons: border-radius 9px, 13.5px font, semibold
- Badges: rounded-full, 10.5px, uppercase, tracking 0.06em
- Inputs: rounded-lg, border, bg surface
- Tab bar: text-sm, border-bottom 2px on active (accent color)

### Layout
- Sidebar esquerda (160px) com navigation
- Content area com padding 24px
- Tab bar abaixo do header "YouTube"
- Max 8 tabs no tab bar (com overflow-x-auto em mobile)

---

## Telas a desenhar (prioridade alta → baixa)

### 1. COMPETITOR OBSERVATORY — 4 abas

**Aba "Canais" (default):**
- Grid responsivo de channel cards (3 col desktop, 2 tablet, 1 mobile)
- Cada card: avatar 40px, nome, subscriber count, video count, engagement rate medio
- Indicador de crescimento: sparkline ou "+1.2K/sem" com seta verde/vermelha
- Botoes: olho (expand videos), sync (refresh), lixeira (remove com confirm)
- Expand: grid de 12 videos com thumbnails 16:9, titulo truncado, views, data
- Search bar no topo para adicionar canais
- "2/15 canais" counter no canto

**Aba "Mudancas":**
- Timeline agrupada por dia (header de data entre grupos)
- Cada item: badge de tipo (thumbnail=roxo, title=azul, description=amber), canal, data
- Before/after thumbnails side-by-side
- Badge "Provavel A/B test" (amber, icone flask) quando 2+ mudancas em 14 dias
- Botoes: bookmark (estrela), "Testar esta abordagem" (accent)
- Filtros horizontal: canal dropdown, tipo, bookmarked toggle, periodo (7d/30d/90d)

**Aba "Outliers":**
- Grid de video cards com badge de multiplicador grande no canto (ex: "4.2x")
- Tiers visuais: 2-5x azul, 5-10x roxo, >10x vermelho
- Cada card: thumbnail 16:9, titulo, canal, views, data
- Sort: multiplicador (default), views, data
- Periodo: 7d/30d/90d/todos

**Aba "Insights":**
4 secoes:
1. Upload frequency heatmap (7x24 grid, cores verde→laranja→vermelho)
2. Top tags (horizontal bars, max 15)
3. Engagement comparison (bar chart: nosso canal vs cada competidor)
4. Gap analysis (2 colunas: "Tags deles" vs "Suas tags", gaps highlighted)

### 2. A/B LAB — Test Detail (Active)

Toolbar com botoes FUNCIONAIS (nao disabled):
- Signal toggle: [Confirmado] [Live]
- Botao "Pausar" (com icone pause)
- Botao "Encerrar" (com icone square)
- Botao "Configuracoes" (gear)
- Botao "Forcar Rotacao" (refresh)

Hero band com dados REAIS (nao hardcoded):
- Gauge de confianca (0-100%)
- Lider atual (label + chip colorido)
- CTR lift vs original (ex: "+12.3%")
- Tendencia (seta up/down/flat)

Secoes:
- Signal card (live poll: delta views, likes)
- Computed metrics (outlier, receita, dias restantes)
- Lock countdown progress bar
- Variant table com thumbnails, CTR, pBest
- 2-col: Confianca chart + Radar 6 eixos
- Credible intervals + Rank bars
- CTR diario multi-line
- ABBA timeline + Funil por variante
- Gates panel (checklist)
- Click Moment (preview YouTube)

### 3. A/B LAB — Paused Test (Drift Banner)

Banner contextual:
- Fundo amber/10, borda amber/30
- Icone warning, texto explicativo
- Botoes: "Reconhecer e Retomar" (accent) + "Ver detalhes"

### 4. PERFORMANCE — Saude do Canal (com CTR REAL)

- Gauge circular: score 0-100 (mostrar ~72, NAO zero)
- Radar 6 eixos com dados REAIS
- KPI strip: Visualizacoes, Tempo, Subs, Impressoes, CTR (ex: 4.8%), Duracao
- Curva de Retencao (area chart)
- Sub-tabs: Visao Geral, Notas, Health Coach, Outliers, Demografia, Busca

### 5. LIBRARY (melhorada)

- Grid 4-col
- Card: thumbnail, titulo, tags editaveis, lift badge (+12.3%), longevity dots COM legenda
- Hover: delete + "Usar no teste"
- **NOVO: LibraryPickerDialog** modal pra selecionar no wizard

### 6. WIZARD Step Variantes (melhorado)

- Drag & drop upload
- **NOVO: "Escolher da Biblioteca"** botao
- **NOVO: "Importar do Pipeline"** botao
- Preview da variante com chip A/B/C

### 7. TAB BAR Mobile

- 8 tabs em PT-BR: Painel, Videos, A/B Lab, Categorias, Comentarios, Conteudo, Competidores, Desempenho
- Scroll horizontal com snap
- Gradiente fade nas bordas indicando scroll

## Notas visuais
- TODOS os numeros devem parecer REAIS (nunca zeros, nunca "---")
- Formatacao pt-BR: 1.234,56
- Datas: "3 jun 2026", "ha 2h"
- Warm palette — NUNCA cinza frio (zinc/slate/gray). Tons quentes sempre.
- Icones: Lucide React
- Inspiracao visual: ViewStats (outlier badges com multiplicador), mas no nosso dark warm theme
```
