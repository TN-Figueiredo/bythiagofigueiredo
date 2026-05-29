# Social Studio — UI Rewrite Spec

**Date:** 2026-05-29
**Status:** Draft
**Scope:** Rewrite completo da UI `/cms/social` seguindo handoff `design/social/`

---

## 1. Contexto

O Social Studio é a seção de gerenciamento de posts sociais do CMS. O handoff em `design/` (protótipo HTML/React) define o redesenho completo com alta fidelidade. Este spec descreve a implementação como **rewrite in-place**: UI nova sobre o backend existente (actions, providers, DB schema, pipeline).

### Decisões do produto (imutáveis)

- **YouTube** = somente aba Comunidade (texto/imagem/enquete). Vídeo nunca entra aqui.
- **Instagram** = Story é o padrão (1080×1920). Feed é raro (só lançamentos).
- **Facebook** = post na Fanpage (imagem/vídeo + texto, link gera card preview).
- **Canvas é o coração** — reaproveitável por outras seções do CMS.
- **Bilíngue PT/EN** em toda legenda.
- **Blog → social automático**: CMS preenche arte + legendas + destinos sugeridos.

### Destinos fixos (4)

| ID | Plataforma | Superfície | Ratio | Recomendado | Cap Limit |
|----|-----------|-----------|-------|-------------|-----------|
| `ig_story` | Instagram | Story | 9:16 (1080×1920) | Padrão da casa | 0 (texto na arte) |
| `yt_community` | YouTube | Comunidade | 1:1 (1080×1080) | — | 1500 |
| `fb_page` | Facebook | Fanpage | 4:5 (1080×1350) | — | 2200 |
| `ig_feed` | Instagram | Feed | 4:5 (1080×1350) | Raro | 2200 |

Bluesky fica no backend mas não aparece na UI neste rewrite.

---

## 2. Arquitetura

### Princípio: UI nova, backend existente

| Camada | Abordagem |
|--------|-----------|
| **Routes/Pages** | Reescrever `apps/web/src/app/cms/(authed)/social/` |
| **Components** | Novos componentes seguindo handoff como fonte de verdade visual |
| **Server Actions** | Reutilizar `lib/social/actions/` + 9 novas actions |
| **Types/Schemas** | Reutilizar `lib/social/types.ts`, `schemas.ts` + extensões |
| **Providers** | Reutilizar `packages/social/` (Meta, YouTube, Bluesky) |
| **DB Schema** | Reutilizar + 3 migrations incrementais |
| **Pipeline** | Reutilizar `pipeline.ts`, `platform-prepare.ts` |
| **Canvas** | Evoluir react-konva existente (não DOM-based) |

### Component Tree

```
/cms/(authed)/social/
  page.tsx                          — Hub (Server Component)
  error.tsx                         — Error boundary + Sentry
  loading.tsx                       — Skeleton (tabs + accounts + feed)
  @drawer/(.)social/[id]/           — Intercepting route (NEW)
    page.tsx                        — PostDetail drawer (Server, 440px)
      DrawerShell                   — overlay + focus trap + Escape + slide-in
      NativePostRender              — render nativo grande do destino
      MetricsGrid                   — grade 2col métricas
      DeliveryCard                  — status por destino (KEEP)
      DrawerFooterActions           — ações por status
  _components/
    accounts-strip.tsx              — grid auto-fit, tint icons, health dots (NEW)
    posts-feed.tsx                  — filter chips + grid + media cards 200px (FIX)
    feed-card.tsx                   — dest chip, status badge, Story mini 113×200 (NEW)
    posts-calendar.tsx              — SEMANAL 7col, tint por destino (FIX)
    posts-queue.tsx                 — DnD pointer events, queue_position (FIX)
    posts-drafts.tsx                — AI drafts, confidence %, trigger (FIX)
    bulk-actions-bar.tsx            — (KEEP)
    platform-previews/              — renders nativos por destino (NEW)
      ig-story-preview.tsx          — phone mockup, progress bars, reply bar
      yt-community-card.tsx         — card YT dark, poll bars, actions
      ig-feed-post.tsx              — post IG, avatar ring, actions
      fb-page-post.tsx              — post FB dark, link card
      dest-preview.tsx              — dispatcher: destId → componente
    canvas-editor/                  — reaproveitável (EVOLVE)
      index.tsx                     — fullscreen overlay (FIX: "Usar no post")
      social-canvas.tsx             — Konva Stage (KEEP)
      social-left-panel.tsx         — 6 ratios, 7 element types, Video bg (FIX)
      social-right-panel.tsx        — inspectors: +GIF, +Sticker, +QR (FIX)
      social-toolbar.tsx            — + "Usar no post" button (FIX)
      story-frames-strip.tsx        — multi-frame sequência (NEW)
      konva-exporter.tsx            — export PNG/WebP (NEW wrapper)
    shared/
      social-breadcrumb.tsx         — dinâmico, último = dest focado (NEW)
      social-page-header.tsx        — Fraunces title, subtitle, dual actions (NEW)
      social-toast.tsx              — wrapper sonner com eventos mapeados (NEW)
  /new/
    page.tsx                        — Compositor (Server Component)
    error.tsx + loading.tsx
    _components/
      composer-shell.tsx            — shell puro, estado no hook (FIX)
      use-composer.ts               — 22 states + handlers extraídos (NEW)
      use-composer-persistence.ts   — sessionStorage + beforeunload (NEW)
      dest-card.tsx                 — tint, badge, truth text, toggle/focus (NEW)
      canvas-embed.tsx              — mini preview + "Abrir editor" (NEW)
      caption-editor.tsx            — per-dest behavior (FIX)
      ai-caption-block.tsx          — 2 variações, hashtags, best time (NEW)
      translate-button.tsx          — PT↔EN via Cowork (NEW)
      live-preview.tsx              — sticky, render nativo do dest focado (NEW)
      schedule-panel.tsx            — day chips + time chips + best times (NEW)
      publish-flow.tsx              — modal pipeline 4 steps (NEW)
      content-picker.tsx            — CMS picker + Cowork banner (FIX)
      template-picker.tsx           — modal grid (FIX)
```

---

## 3. Telas

### 3.1 Hub — `/cms/social`

**Layout:** PageHeader (breadcrumb Social › Posts, Fraunces title, subtitle, "Do CMS" ghost + "Novo post" primary) + tabs (Feed · Calendar · Queue · Drafts, sublinhado coral).

**Tabs como URL state:** `?tab=feed|calendar|queue|drafts`. Suspense boundary por tab content.

#### 3.1.1 AccountsStrip (topo do Feed)

Grid `repeat(auto-fit, minmax(252px, 1fr))`. Cada card: ícone plataforma (quadrado 36px tint), handle, followers (de `metadata` JSONB), green dot (ok) ou amber "Reconectar" (warn). Facebook em estado de alerta (token expira em X dias).

**Data source:** `checkConnectionHealth()` — nova action que valida tokens e retorna `{status: 'ok'|'warn'|'error', followersCount, tokenExpiresIn}`.

#### 3.1.2 Feed

Filter chips (Tudo/No ar/Agendados/Falhas) como URL state `?status=all|published|scheduled|failed`.

Grade `repeat(auto-fill, minmax(248px, 1fr))` de FeedCards. Cada card:
- Media com **altura fixa 200px** (Story renderiza mini 113×200; Comunidade/Fanpage preenchem; enquete vira barras)
- Chip do destino sobreposto (canto sup-esq) com PlatGlyph + label
- Badge de status (canto sup-dir)
- Rodapé: origem (ícone + nome), métricas ou ação de erro

**Data source:** `listFeedPostsWithDeliveries()` — nova action que resolve o N+1 (JOIN posts + deliveries em 1 query).

Empty state por filtro com ícone + texto contextual.

#### 3.1.3 PostDetail Drawer

**Pattern:** Intercepting route `@drawer/(.)social/[id]` — Server Component, 440px, slide-in animation, focus trap, Escape close. Fallback: hard nav para `/social/[id]`.

Header: breadcrumb Feed › destino, status badge. Corpo: render nativo grande (usa `platform-previews/`), bloco de erro, origem, grade de métricas 2col (views, curtidas, respostas, votos, toques no link, saídas).

Footer sticky por status:
- **published:** "Ver no app" (external link) + "Duplicar" (cria draft)
- **scheduled:** "Cancelar" + "Editar/reagendar"
- **failed:** "Reconectar" (→ OAuth) + "Reenviar" (retry delivery)

#### 3.1.4 Calendar

Grade **semanal** 7 colunas (Seg–Dom). Cada dia: header + eventos como chips coloridos pelo tint do destino (border-left 2px) com horário e título. Dias vazios: "+ slot livre". Dia atual destacado.

Navegação semana anterior/próxima com `?week=2026-W22` URL state.

**Data source:** `listCalendarEvents(siteId, from, to)` — nova action que JOIN posts + deliveries e retorna por plataforma.

#### 3.1.5 Queue

Lista reordenável via **pointer events** (não HTML5 Drag API — não funciona em mobile). Handle de arraste, posição, ícone destino, legenda, destino+idioma, horário.

**Data model:** Nova coluna `queue_position INTEGER` em `social_posts`. Action `reorderQueue(postId, newPosition)` com swap transacional.

Keyboard: ↑↓ para mover item, Enter para confirmar. `useOptimistic` (React 19) para reorder instantâneo.

#### 3.1.6 Drafts

Lista de sugestões da IA: ícone Cowork roxo, título, descrição, badge de confiança (%), chip destino+idioma, trigger ("Vídeo publicado há 1 dia"), ações "Descartar" / "Revisar".

Botão "Automações" no topo → link para `/cms/social/accounts?tab=automations`.

**Data source:** Posts com `origin: 'auto'` e `status: 'draft'`. Confidence e trigger em `pipeline_steps` JSONB.

---

### 3.2 Compositor — `/cms/social/new`

**PageHeader:** Breadcrumb dinâmico (último segmento = destino focado, ex: "Instagram · Story"). Segmented control "Do CMS" | "Em branco".

#### 3.2.1 Modo "Do CMS" — CMSPicker

Banner Cowork roxo "automático". Tabs (Todos/Blog/Newsletter/Vídeo). Lista de conteúdos com thumb, badges (BLOG/NEWSLETTER/VÍDEO + idioma PT/EN), MiniDots dos destinos sugeridos.

Selecionar → faixa "Montado automático" + auto-preenche: idioma, destinos ligados, legendas por destino, título do canvas.

**Data source:** `searchSourceContent()` (existente) + `extractContentMetadata()` para og data.

#### 3.2.2 Seletor de Destinos — DestCard ×4

Cada card: ícone tint, label+sub, badge ("padrão"/"raro"), checkbox toggle, "verdade" da plataforma (texto explicativo). Clicar card = focar. Checkbox = ligar/desligar publicação. Cards desligados: opacity 0.62.

#### 3.2.3 Coluna Esquerda (Build)

Header do destino focado (ícone + nome + formato) com botão "Traduzir" (IA) + toggle PT/EN.

**CanvasEmbed:** Mini preview da arte atual + "Abrir editor". Aparece para destinos visuais (Story/Feed/Fanpage).

**CaptionEditor** específico por destino:
- **Story:** nota "texto/link moram na arte" + input curto opcional
- **YT Community / FB / IG Feed:** textarea com contador (limites: YT 1500, FB/Feed 2200) + nota da plataforma
- **YT Community extra:** botão "Adicionar enquete"

**AICaptionBlock:** "Gerar com IA" → Cowork Pipeline → retorna:
- Tom por plataforma (YT direto/CTA, FB descritivo, IG casual, Story curtíssimo)
- 2 variações clicáveis (aplicar ao caption)
- Hashtags (IG/FB) com botão "Adicionar"
- Melhor horário → clica → muda para "Agendar" + seta horário

**Data source:** `generateAICaption(destId, lang, source)` — nova action via Cowork Pipeline.

#### 3.2.4 Coluna Direita (Preview)

**LivePreview:** Render nativo sticky do destino focado. Usa `platform-previews/`:
- Story = phone mockup com arte do canvas dentro
- Comunidade = card YouTube dark
- Feed = post IG com avatar ring
- Fanpage = post FB dark

#### 3.2.5 Footer Sticky

Segmented: Agora | Agendar | Fila.

**Agendar → SchedulePanel** (expande acima do footer): chips de dia + chips de horário. Bolinha laranja nos melhores horários das contas ligadas.

**Data source:** `getBestTimes(connectionIds)` — nova action (computed de post_metrics ou social_defaults JSONB).

Ações: "Salvar rascunho" (ghost) + "Publicar"/"Agendar"/"Adicionar à fila" (verde quando "Agora").

- "Agora" → abre PublishFlow modal
- "Agendar" → salva + toast + navega pro Calendar
- "Fila" → salva + toast + navega pra Queue

#### 3.2.6 PublishFlow (Modal Pipeline)

Modal overlay. Sequência animada de 4 steps: Post → Short Link → Preparar destino → Entregar.

Progresso real via Supabase Realtime em `social_deliveries` status changes. Depois dos 4 steps: resultados por destino (no ar / erro). Facebook em estado de erro honesto ("token da página expirou") com "Reconectar".

Footer: "Fechar" / "Ver no feed".

---

### 3.3 Canvas Editor (Fullscreen Overlay)

Overlay sobre a cena atual (não é rota, é componente renderizado condicionalmente).

**Toolbar:** Voltar + breadcrumb `Posts › Story › <título>`, zoom (−/%/+/reset), "Templates", "Exportar" (PNG), "Usar no post" (primary, retorna ao compositor com design).

**Left Rail (248px):**
- **Formato:** grade 6 ratios (Story, Quadrado, Feed, Paisagem, Wide/OG, Custom)
- **Adicionar:** Texto, Imagem, GIF, Sticker, QR, Carimbo, Enquete
- **Fundo:** Sólido (swatches) / Imagem / Vídeo / Degradê
- **Camadas:** lista reversa, clicável

**Centro:** Artboard Konva escalado (letterboxed em checkerboard). Drag + resize via react-konva (mantém implementação existente, superior a DOM). Story: rail de frames embaixo (multi-frame).

**Right Rail (248px):** Propriedades do elemento selecionado:
- **Text:** conteúdo, fonte (Fraunces/Inter/JetBrains), tamanho, cor (swatches), alinhamento
- **Image:** slot de troca (file picker + drag-drop)
- **GIF:** seletor emoji + slider tamanho
- **Sticker:** texto do botão + nota link rastreado
- **Logo/Frame:** info de marca

**Evoluções sobre o canvas existente:**
- 6 ratios (atualmente 3)
- Element types: +GIF, +Sticker, +Logo, +Frame (atualmente só Text + Image)
- Video background: frame capture para export
- Template load preserva undo history
- Story frames strip com add/remove/reorder
- "Usar no post" button no toolbar
- Custom font registration no server Konva renderer

---

## 4. State Management

### URL State (bookmarkable/shareable)

| Param | Valores | Componente |
|-------|---------|-----------|
| `tab` | feed, calendar, queue, drafts | Hub |
| `status` | all, published, scheduled, failed | Feed filter |
| `week` | ISO week (2026-W22) | Calendar |
| `mode` | cms, blank | Compositor |
| `lang` | pt, en | Compositor |

### Local State — `useComposer()` hook

Extrai 22+ states do ComposerShell em custom hook:

```typescript
interface ComposerState {
  mode: 'cms' | 'blank'
  lang: 'pt' | 'en'
  destsOn: Record<DestId, boolean>     // 4 destinos
  focused: DestId
  captions: Record<string, string>     // key: `${destId}_${lang}`
  poll: PollConfig | null              // YT only
  sched: 'now' | 'schedule' | 'queue'
  schedDate: string
  schedTime: string
  publishing: boolean
  cmsPicked: CMSContent | null
  aiData: AISuggestion | null
  aiLoading: boolean
  design: CardComposition              // shared com canvas
}
```

### Persistence — `useComposerPersistence()` hook

- `beforeunload` handler quando há mudanças não salvas
- Auto-save para `sessionStorage` a cada 5 segundos
- "Salvar rascunho" cria `social_post` com `status: 'draft'`
- Restaura estado ao reabrir `/cms/social/new?draft={id}`

### Realtime

- Feed: `revalidatePath('/cms/social')` after publish
- PostDetail drawer: Supabase Realtime em deliveries (mantém existente)
- PublishFlow modal: Realtime em `social_deliveries` para progresso dos steps
- Connection lost: banner + auto-reconnect

---

## 5. Backend — Novas Actions

| # | Action | Input | Output | Consumidor |
|---|--------|-------|--------|-----------|
| 1 | `checkConnectionHealth()` | `siteId` | `{status, followers, expiresIn}[]` | AccountsStrip |
| 2 | `listFeedPostsWithDeliveries()` | `siteId, filters` | Posts + deliveries em 1 query | FeedView |
| 3 | `listCalendarEvents()` | `siteId, from, to` | Events agrupados por plataforma | CalendarView |
| 4 | `reorderQueue()` | `postId, newPosition` | void (swap transacional) | QueueView |
| 5 | `generateAICaption()` | `destId, lang, source?` | `{variations, hashtags, tone, bestTime}` | AICaptionBlock |
| 6 | `translateCaption()` | `text, from, to` | `string` | TranslateButton |
| 7 | `getBestTimes()` | `connectionIds` | `Record<platform, string[]>` | SchedulePanel |
| 8 | `duplicatePost()` | `postId` | `newPostId` | PostDetail drawer |
| 9 | `createAutoDraft()` | `contentId, platforms` | `postId` (status=draft, origin=auto) | Cron |

Actions 5 e 6 usam o Cowork Pipeline existente (`PIPELINE_COWORK_KEY` + API routes).

---

## 6. Migrations (3)

### Migration 1: Queue Position

```sql
ALTER TABLE social_posts ADD COLUMN queue_position INTEGER;
CREATE INDEX idx_social_posts_queue ON social_posts (site_id, queue_position)
  WHERE status IN ('scheduled', 'queued') AND queue_position IS NOT NULL;
```

### Migration 2: Poll + Manual Type

```sql
ALTER TABLE social_posts DROP CONSTRAINT social_posts_type_check;
ALTER TABLE social_posts ADD CONSTRAINT social_posts_type_check
  CHECK (type IN ('link', 'video', 'image', 'text', 'poll', 'manual'));
```

Poll config armazenado em `content` JSONB: `{poll: {options: string[], duration_hours: number}}`.

### Migration 3: Fix Fair Batch RPC

Atualizar `social_publish_fair_batch` para usar `sp.*` em vez de lista fixa de colunas. A migration `20260519000005` já fez essa correção — validar no plano de implementação se a RPC atual retorna `story_slides`, `source_locale`, `caption_template`, `caption_overrides`, `link_in_bio_updated`. Se algum estiver faltando, criar migration corretiva.

---

## 7. Honestidade Técnica

### YouTube Community Posts — Sem API

A YouTube Data API v3 **não tem endpoint** para criar community posts (texto/imagem/enquete). O compositor monta o post e abre uma tela "Ready to Post" com conteúdo pronto para copy-paste manual no YouTube Studio. Post salvo como `type: 'manual'` com deep link pro YouTube Studio.

### Story Metrics (taps/exits) — API Limitada

Instagram Insights API não retorna `taps_forward`, `taps_back`, ou `exits` por story frame. Drawer mostra métricas disponíveis (impressions, reach, replies). Campos indisponíveis marcados como "—". JSONB `raw` preserva dados brutos se API expandir.

### GIF Animado no Canvas

react-konva renderiza GIFs como frame estático. Export via Konva produz imagem estática do GIF. Isto é documentado no tooltip do element type GIF no left rail.

---

## 8. Design Tokens

Usar tokens existentes do CMS (CSS custom properties em `globals.css`). Mapeamento handoff → codebase:

| Handoff Token | Codebase Equivalent |
|--------------|-------------------|
| `--bg #0C0B09` | `--cms-bg` ou usar pinboard dark tokens |
| `--surface #161410` | `--cms-surface` |
| `--accent #F2683C` | `--pb-accent` (já é `#FF8240`, próximo) |
| `--cowork #6E63F2` | `--cms-cowork` (já definido) |
| `--green #46B17E` | `--color-green` |
| `--amber #E0A23C` | `--color-amber` |
| `--red #D9614A` | `--color-red` |

Tipografia: Fraunces (títulos), Inter (UI), JetBrains Mono (eyebrows/counters). Eyebrow pattern: mono 10px, letter-spacing 0.18em, uppercase, ink-faint.

Platform tints: Instagram `#E8823C` (Feed `#C964A8`), YouTube `#E0574E`, Facebook `#5B7FD6`.

Regra de marca: laranja em ≤10% da área.

---

## 9. Performance & UX

### Animations

- `fade-up`: AI suggestions, CMS picker, schedule panel (CSS `@keyframes ab-fade-up` já existe)
- Drawer: `animate-slide-in` (300ms ease-out)
- Pipeline steps: CSS `transition-delay` sequencial
- Toast: sonner (já configurado)
- Card hover: `hover:-translate-y-0.5` + `border-color` transition

### Images

- Migrar para `next/image` em feed cards, content picker, OG previews
- Blur placeholders via `blurDataURL`
- Feed card media: 200px height, `object-cover`
- Story mini: 113×200px within card

### Code Splitting

- Konva: `next/dynamic` SSR=false com loading skeleton (não `null`)
- Canvas editor: lazy load quando overlay abre
- Compositor sub-components: lazy per mode (CMS picker vs blank)

### Responsive

| Breakpoint | Behavior |
|-----------|----------|
| ≥1080px | Compositor 2 colunas (build + preview 380px) |
| <1080px | Compositor 1 coluna, preview acima do caption |
| <960px | Canvas editor: "Desktop Required" message |
| <760px | CMS sidebar hidden |

### Accessibility

- Tabs: `role="tablist"` / `role="tab"` / `role="tabpanel"`
- Drawer: focus trap, Escape close, `aria-modal="true"`
- Queue DnD: keyboard ↑↓ + Enter
- Filter chips: `aria-pressed`
- All icon buttons: `aria-label`
- Canvas: `role="application"` com `aria-label` descritivo

### Touch

- Queue: pointer events (universal, não HTML5 Drag)
- Touch targets: mínimo 44px em filter chips, calendar pills, queue handles
- Canvas: desktop-only (≥960px)

---

## 10. Cron Jobs

### `/api/cron/social-auto-draft`

Detecta novos conteúdos (blog/newsletter/vídeo publicado nas últimas 24h) sem post social associado. Gera draft via Cowork Pipeline com `origin: 'auto'`, confidence score, trigger metadata em `pipeline_steps` JSONB.

**Schedule:** A cada 30 minutos.

---

## 11. Fora de Escopo

- Bluesky como destino na UI (backend pronto, UI depois)
- Twitter/X (removido por custo $0.20/post)
- Smart Schedule heatmap (v2)
- Canvas mobile editing (desktop-only é decisão final)
- Fan leaderboard / advanced analytics
- Link in Bio visual editor

---

## 12. Estimativa

| Bloco | Componentes | Estimativa |
|-------|-------------|-----------|
| Hub (Feed + Calendar + Queue + Drafts + Accounts) | 8 componentes | ~20h |
| PostDetail Drawer (intercepting route) | 5 componentes | ~8h |
| Compositor (DestCards + CaptionEditor + SchedulePanel) | 12 componentes | ~24h |
| Platform Previews (4 destinos + dispatcher) | 5 componentes | ~10h |
| Canvas Editor evoluções (types + ratios + frames) | 6 componentes | ~16h |
| AI/Cowork Integration (captions + translate) | 3 actions | ~8h |
| PublishFlow (pipeline modal + realtime) | 2 componentes | ~6h |
| Shared (breadcrumb + header + toast) | 3 componentes | ~4h |
| Migrations + new actions | 3 migrations + 9 actions | ~12h |
| Tests | Vitest unit + integration | ~14h |
| Visual review per screen | 8+ telas | ~6h |
| **Total** | | **~128h** |
