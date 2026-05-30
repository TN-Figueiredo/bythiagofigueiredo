# Design Spec: Links + Linktree CMS Redesign

**Data:** 2026-05-29
**Abordagem:** Rewrite in place -- evoluir `packages/links-admin` + `apps/web/src/app/cms/(authed)/links/`
**Handoff:** `design_handoff_links_linktree/` (referencia visual definitiva)
**Status:** Todos os 5 mockups aprovados (100+/110)

---

## 1. Visao Geral

### O que muda

O CMS atual sofre de dois problemas: (1) dois itens de menu confusos ("Links" e "Link in Bio") e (2) telas que parecem mortas (tudo zerado, pouca informacao). Este redesenho unifica e enriquece tudo.

**Antes:**
- Sidebar: "Links" (`/cms/links`) + "Link in Bio" (`/cms/link-in-bio` / `/cms/linktree`)
- Telas basicas com KPIs simples, sem graficos comparativos
- Analytics separado por link, sem visao agregada rica
- Linktree como secao isolada

**Depois:**
- Sidebar: **um unico "Links"** com 3 abas: **Linktree** | **Short links** | **Analytics**
- Analytics rico com 12+ visualizacoes (barras comparativas, donut, heatmap, HBars, paises, insights)
- Linktree absorvido como aba e editor fullscreen
- Editor de QR integrado via CanvasEditor compartilhado com Social
- Painel de Insights (pipeline Cowork) com narrativas geradas por IA
- 6 features de analytics avancado planejadas (Potencial)

### Decisoes de produto

| Decisao | Justificativa |
|---------|--------------|
| Item unico de nav | Reduz confusao; linktree e links sao faces do mesmo dominio |
| Rewrite in place | Evita duplicacao; evolui o que existe em `packages/links-admin` e `apps/web/.../links/` |
| SVG/CSS nativo para graficos | Sem dependencia externa; melhora o que ja existe em `packages/links-admin` |
| Canvas compartilhado com Social | Reaproveita `CanvasEditor` do Social Studio (mesmo que `social/canvas.jsx`) |
| 6 features Potencial incluidas | Implementar todas: Goals, UTM, New vs Returning, Geo Map, Bot Filter, QR Funnel |
| Insights via Cowork | Pipeline de IA gera narrativas automaticas a partir de metricas |

### Hierarquia de navegacao

```
Links (hub)  --tabs-->  Linktree . Short links . Analytics
   |  "Novo link" (modal) / "QR Card"
   +-- Linktree --> Editor da Linktree (fullscreen, preview ao vivo)
   +-- Short links --> Detalhe do link --> Editor de QR (canvas, fullscreen)
   +-- Analytics (rico)
```

Breadcrumb consistente: **`Social > Links > ...`**. Crumbs clicaveis.

---

## 2. Navegacao

### 2.1 Sidebar -- merge

**Arquivo:** `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts`

**Atual:**
```typescript
{ icon: icon(Link2), label: 'Links', href: '/cms/links', minRole: 'editor' },
{ icon: icon(ExternalLink), label: 'Link in Bio', href: '/cms/link-in-bio', minRole: 'editor' },
```

**Novo:**
```typescript
{ icon: icon(Link2), label: 'Links', href: '/cms/links', minRole: 'editor' },
// "Link in Bio" removido -- mergeado em Links
```

### 2.2 Rotas

| Rota | Descricao | Tipo |
|------|-----------|------|
| `/cms/links` | Hub com 3 abas (query param `?tab=tree\|links\|analytics`) | Page |
| `/cms/links/new` | Modal de criacao (renderizado como overlay sobre o hub) | Modal |
| `/cms/links/[id]` | Detalhe do link | Page |
| `/cms/links/[id]/edit` | Edicao do link | Page |
| `/cms/links/[id]/qr` | Editor de QR (canvas fullscreen) | Fullscreen |
| `/cms/links/[id]/analytics` | Analytics por link (dentro do detalhe como accordion) | Section |
| `/cms/links/linktree` | Editor fullscreen da Linktree | Fullscreen |
| `/cms/links/linktree/analytics` | Absorvido na aba Analytics do hub | Redirect |
| `/cms/links/settings` | Configuracoes do dominio go.* | Page |
| `/cms/links/alerts` | Alertas e monitoramento | Page |

### 2.3 Redirects

| De | Para | Tipo |
|----|------|------|
| `/cms/link-in-bio` | `/cms/links?tab=tree` | 308 permanent |
| `/cms/linktree` | `/cms/links?tab=tree` | 308 permanent |
| `/cms/linktree/analytics` | `/cms/links?tab=analytics` | 308 permanent |

Implementar via `next.config.ts` redirects ou middleware.

### 2.4 Tab state

A aba ativa e controlada por query param `tab` (default `tree`). Isso permite deep linking e back button funcional.

```
/cms/links              -> aba Linktree (default)
/cms/links?tab=tree     -> aba Linktree
/cms/links?tab=links    -> aba Short links
/cms/links?tab=analytics -> aba Analytics
```

---

## 3. Telas

### 3.1 Links Hub -- `/cms/links`

**Handoff:** `links/hub.jsx` (`LinksHub`)

**Layout:**
- `PageHeader`: breadcrumb `Social > Links`, titulo "Links" (Fraunces), subtitulo "Sua porta de entrada e os links rastreados -- agora num lugar so.", acoes `QR Card` (ghost) + `Novo link` (primary)
- Barra de tabs: Linktree / Short links / Analytics (sublinhado coral no ativo, 2px, `--accent`)
- Conteudo da aba ativa renderizado abaixo

**Componentes:**
- `PageHeader` (do design system CMS existente)
- `TabBar` (novo -- 3 tabs com underline animado)
- Cada aba e um componente separado

**Server component:** `page.tsx` carrega dados de todas as abas (metricas, links, linktree config). Client component recebe props e renderiza a aba ativa.

---

### 3.2 Aba Linktree (porta de entrada)

**Handoff:** `links/hub.jsx` (`TreeTab`) + `links/linktree.jsx` (`LinktreePreview`)

**Layout:**
1. **Banner de fusao** -- nota accent (`--accent-soft` bg, `--line` border, raio 11px): "Link in Bio agora vive aqui." com icone `info`. Exibir apenas enquanto util (flag de dismissed via localStorage).

2. **Grid 2-col** (340px + 1fr, gap 18px, colapsa <1080px):
   - **Esquerda -- Card de preview:**
     - Badge `amber` "porta de entrada" + URL mono `go.bythiagofigueiredo.com`
     - `LinktreePreview` (width 280px) -- preview compacto da arvore publica
     - Botoes `Editar` (primary, navega p/ editor fullscreen) + `Abrir` (ghost, abre URL publica)
   - **Direita:**
     - **4 StatCards** (grid auto-fit minmax 150px): Pageviews, Ultimos 30d (verde), Unicos (cyan), Engajamento % (amber)
     - **Painel "Desempenho por bloco"** -- CTR por bloco da arvore (clicks / views), barras relativas ao max, agrupado por secao. Titulo "Desempenho por bloco" + icone trophy. Botao quiet "Analytics" navega para a aba.

**Dados necessarios:**
- `linktree.pageviews`, `linktree.last30`, `linktree.unique`, `linktree.engagement`
- `linktree.blocks[]` com `{id, label, section, clicks, ctr}`
- `linktree.sharedLinks[]` para o preview
- `linktree.url` (dominio go.*)

**Fonte:** tabela `link_in_bio_config` + views de metricas de linktree (`linktree_block_metrics`).

---

### 3.3 Aba Short links

**Handoff:** `links/hub.jsx` (`ShortLinksTab`)

**Layout:**
1. **4 StatTiles** (grid auto-fit minmax 210px) com sparkline:
   - Total de links (icone links)
   - Cliques totais + sparkline verde
   - Links ativos (icone target, cyan)
   - Top performer (slug mono + sparkline amber)

2. **Painel Saude dos links** (condicional -- so aparece se `unhealthy.length > 0`):
   - Card com borda vermelha (`rgba(217,97,74,0.3)`), bg vermelho sutil
   - Icone warn + titulo "Saude dos links" + contagem
   - Chips clicaveis por link unhealthy: slug mono + estado (vermelho="destino quebrado", amber="a expirar")
   - Botao ghost "Revalidar" -- dispara toast e fire-and-forget health check

3. **Busca + Novo link:**
   - Input com icone search, bg `--surface-2`, raio 9px
   - Botao primary "Novo link" (abre modal `CreateLinkModal`)

4. **Filtros:**
   - `FilterGroup` "Origem": chips Tudo + 6 fontes (`SOURCES` do data.js)
   - `FilterGroup` "Status": chips Tudo / Ativos / Pausados
   - Separador vertical entre grupos

5. **Tabela:**
   - Header: Link | Destino | Tendencia | Cliques | Status | (acoes)
   - Grid template: `1.6fr 1.4fr 90px 90px 110px 70px`
   - Cada linha:
     - Link: titulo bold + slug mono + dot colorido da origem
     - Destino: mono truncado
     - Tendencia: mini `Spark` (14 pontos, cor da origem)
     - Cliques: mono bold
     - Status: `StatusDot` (dot + label: Ativo verde / Pausado amber / Expirado vermelho)
     - Acoes: botao QR (stopPropagation, abre canvas) + chevron right
   - Linha clicavel -> navega para detalhe
   - Hover: bg `--surface-2`
   - Empty state: "Nenhum link encontrado."

**Dados necessarios:**
- Lista de links com campos: `id, title, slug, source, badge, dest, status, clicks, last30, unique, scans, topCountry, ctr, created, health, redirect, clickIds, spark[14]`
- Contagens derivadas: totalLinks, totalClicks, active, topPerformer
- Lista de links unhealthy (health !== 'ok')

**Fonte:** tabela `tracked_links` + `link_daily_metrics` para spark/agregados.

---

### 3.4 Aba Analytics (rica)

**Handoff:** `links/analytics.jsx` (`AnalyticsView`)

**Layout vertical (gap 18px):**

1. **Controles:** Range tabs (7d / 30d / 90d / 1 ano) + nota "Comparando com periodo anterior" + botao export CSV

2. **4 StatTiles** com delta + sparkline:
   - Cliques: valor + `Delta` (% vs anterior) + sparkline coral
   - Visitantes unicos: cyan, delta
   - Engajamento (CTR): verde, sub "cliques / pageviews"
   - Via QR / impresso: amber, sub "do total de cliques", sparkline amber

3. **Grid 1.6fr 1fr:**
   - **Cliques por dia** (Panel): `BarChart` com barras do periodo atual (coral) e anterior (cinza, atras). Legenda: "atual" dot coral + "anterior" dot `--line-strong`
   - **Insights** (Panel): badge cowork "auto", 4 narrativas geradas. Cada insight: icone 26px em circulo colorido + texto. Tones: up=verde, accent=coral, amber=amber, red=vermelho

4. **Grid 1fr 1fr:**
   - **Por origem**: `SourceBars` -- barras horizontais coloridas por fonte, label + barra + contagem mono
   - **Dispositivo**: `Donut` (120px, 16px stroke) com legenda, centro "100% sessoes"

5. **Grid 1fr 1fr 1fr:**
   - **Navegador**: `HBars` (cor cyan)
   - **Sistema**: `HBars` (cor roxa)
   - **Referrer**: `HBars` (cor verde)

6. **Grid 1fr 1.4fr:**
   - **Paises**: `CountryList` com bandeira emoji + nome + % + barra + cidades
   - **Horarios de pico**: `Heatmap` 7x24 (Seg-Dom x 0h-23h), 5 tons de coral

7. **Top links - 30 dias**: `TopLinksTable` -- ranking com posicao, titulo, slug, barra relativa, contagem. Linha clicavel.

8. **Potencial -- a implementar**: grid 2-col de cards tracejados com as 6 features (ver secao 6)

**Dados necessarios:**
- `analytics.totalClicks`, `prevClicks`, `unique`, `prevUnique`, `ctr`, `prevCtr`, `qrShare`
- `analytics.byDay[30]`, `byDayPrev[30]` (series diarias)
- `analytics.bySource[]` (id, clicks, pct)
- `analytics.devices[]`, `browsers[]`, `os[]`, `referrers[]` (k, v)
- `analytics.countries[]` (code, name, v, cities[])
- `analytics.heatmap[7][24]` (intensidade 0-4)
- `analytics.topLinks[]`
- `analytics.insights[]` (tone, icon, text)

---

### 3.5 Detalhe do link -- `/cms/links/[id]`

**Handoff:** `links/detail.jsx` (`LinkDetail`)

**Layout:**

1. **PageHeader:**
   - Breadcrumb: `Social > Links > <titulo>`
   - Titulo (Fraunces 29px)
   - Badges inline: status dot (Ativo verde / Pausado amber) + badge da origem (colorido) + slug mono + `HealthBadge`
   - Acoes: Copiar URL (ghost) | QR (ghost) | Pausar/Reativar (ghost) | Editar (primary)

2. **Card Destino:** eyebrow "Destino" + URL accent clicavel + icone external

3. **4 StatTiles** (grid auto-fit minmax 200px):
   - Cliques totais (icone links, coral)
   - Ultimos 30 dias (verde)
   - Visitantes unicos (cyan)
   - QR scans (amber)

4. **Grid 1.4fr 1fr:**
   - **Card Detalhes:** lista key-value (Redirect 301/302, Click IDs on/off badge, Origem badge, Criado mono, Saude HealthBadge)
   - **Card QR promo:** card hover clicavel, preview QR placeholder, texto "Gere um cartao de QR no canvas", botao "Abrir editor de QR"

5. **Accordion Analytics completo:**
   - Botao toggle com chevron animado
   - Conteudo: `LinkAnalytics` -- versao compacta do dashboard (tiles + barras + donut + paises + referrer + heatmap)
   - Range tabs proprio (7d/30d/90d/1ano)

**Dados necessarios:**
- Todos os campos do `TrackedLink` + metricas derivadas (clicks, last30, unique, scans, health)
- Spark[14] para mini-tendencia
- Dados de analytics per-link (reutiliza queries da aba Analytics filtradas por linkId)

**Arquivo atual:** `apps/web/src/app/cms/(authed)/links/[id]/_detail.tsx` -- sera reescrito.

---

### 3.6 Editor da Linktree (fullscreen)

**Handoff:** `links/linktree.jsx` (`LinktreeEditor`)

**Layout:** Overlay fullscreen (fixed inset 0, z-120)

1. **Toolbar (56px):**
   - Breadcrumb: `Links > Linktree > Editar`
   - Badge amber "porta de entrada"
   - URL mono
   - Botoes: Cancelar (ghost) + Salvar (primary com check)

2. **Body 2-col:**
   - **Esquerda (form, max-width 720px, scroll):**
     - Secao "Geral":
       - Tagline PT (input) + Tagline EN (input) -- badges de idioma inline
       - Descricao do Blog PT (textarea) + EN (textarea)
     - Highlight Card: toggle on/off com descricao
     - Secao "Shared Links - N/10":
       - Cada link: handle de drag + botao "Trocar icone" com **popover grid de icones** (6-col, 16 icones do set SIP) + labels PT/EN (2-col) + URL (mono) + botao deletar
       - Botao "Adicionar link" (soft, max 10)
   - **Direita (preview, 400px fixo, bg `--bg-side`):**
     - Eyebrow "Preview ao vivo" + botoes refresh/external
     - `LinktreePreview` (320px) -- atualiza em tempo real conforme tagline e icones mudam

**Componentes existentes a reutilizar:**
- `apps/web/src/app/cms/(authed)/linktree/_components/icon-picker.tsx` -- ja existe, adaptar
- `apps/web/src/app/cms/(authed)/linktree/_components/shared-links-section.tsx` -- ja existe
- `apps/web/src/app/cms/(authed)/linktree/_components/editor-preview.tsx` -- ja existe
- `apps/web/src/app/cms/(authed)/linktree/_components/general-section.tsx` -- ja existe
- `apps/web/src/app/cms/(authed)/linktree/_components/highlight-section.tsx` -- ja existe

**Migracao:** Mover estes componentes de `linktree/` para `links/_components/linktree/` e adaptar.

**Icones disponiveis no popover:**
```
links, authors, contacts, mail, blog, youtube, posts, media,
courses, megaphone, pin, globe, heart, bolt, playlist, audio
```

**Estado:**
- `shared[]` -- array de sharedLinks
- `highlight` -- boolean
- `iconPickFor` -- id do link com popover aberto (null = fechado)
- `tagPt`, `tagEn` -- strings controladas

---

### 3.7 Editor de QR (canvas fullscreen)

**Handoff:** `social/canvas.jsx` (`CanvasEditor`) + `links/data.js` (`QR_TEMPLATES`, `qrCardDesign`)

**Reutilizacao:** Mesmo `CanvasEditor` do Social Studio. A diferenca sao os **templates proprios de QR** e o **design inicial** (QR Card editorial).

**Templates QR** (de `data.js`):
| id | Nome | Ratio | Descricao | Tag |
|----|------|-------|-----------|-----|
| `qr_news` | Newsletter Card | story | QR + chamada editorial (impressao) | popular |
| `qr_business` | Cartao de visita | landscape | 85x55mm, QR + handle + nome | print |
| `qr_sticker` | Adesivo redondo | square | QR central + "aponte a camera" | -- |
| `qr_tent` | Cavalete de mesa | portrait | QR grande pra balcao/evento | print |
| `qr_poster` | Poster A4 | portrait | QR + titulo grande pra parede | -- |
| `qr_story` | Story | story | QR pra divulgar no Instagram | -- |

**Design inicial (`qrCardDesign`):**
- Background: `#F7F1E8` solid
- Elementos: frame editorial + kicker mono + titulo Fraunces 84px + placeholder QR + chamada + carimbo TF

**Integracoes:**
- O `CanvasEditor` recebe `templates={QR_TEMPLATES}` e `initial={qrCardDesign()}`
- Breadcrumb: `Links > <slug> > QR Card`
- Botao "Usar no post" salva a composicao e associa ao link
- Exportar: PNG na resolucao nativa do ratio

**Componentes existentes:** `apps/web/src/app/cms/(authed)/links/[id]/qr/client.tsx` (atualmente QR basico) -- sera substituido pelo CanvasEditor.

---

### 3.8 Modal Novo link

**Handoff:** `links/app.jsx` (`CreateLinkModal`)

**Layout:** Overlay modal (520px max, backdrop blur)

**Campos:**
1. **Destino (URL)** -- input, placeholder "https://bythiagofigueiredo.com/..."
2. **Titulo** -- input, placeholder "Ex: Lancamento do curso"
3. **Grid 2-col:**
   - **Origem** -- chips das primeiras 4 fontes (Newsletter, Social, Blog, QR). Chip selecionado: borda da cor + bg 22% opacidade
   - **Slug** -- auto-gerado (7 chars, base36), botao refresh para regenerar
4. **Nota informativa:** "Click IDs ligados - redirect 301 - QR gerado automaticamente"
5. **Footer:** Cancelar (ghost) + Criar link (primary, disabled se dest vazio)

**Acao:** Server action cria o link, gera QR automatico, fecha modal, exibe toast "Link criado - QR gerado", navega para aba Short links.

**Arquivo atual:** `apps/web/src/app/cms/(authed)/links/new/_form.tsx` -- simplificar para modal sobre o hub.

---

## 4. Modelo de Dados

### 4.1 Tabelas existentes

| Tabela | Descricao | Migracoes |
|--------|-----------|-----------|
| `tracked_links` | Links rastreados | `20260507000001`, `20260518000003` |
| `link_clicks` | Eventos de clique (particionada) | `20260507000001` |
| `link_daily_metrics` | Metricas diarias agregadas | `20260507000001` |
| `link_in_bio_config` | Config da linktree (1 por site) | `20260518000001`, `20260519000006` |
| `link_in_bio_items` | Blocos da arvore (com position) | `20260518000001`, `20260518000006` |
| `linktree_block_clicks` | Cliques por bloco da arvore | `20260520000002` |
| `qr_card_compositions` | Composicoes QR salvas | `20260508100000` |

### 4.2 Campos do schema do handoff vs. modelo existente

**`TrackedLink` (existente em `packages/links/src/types.ts`) vs. handoff `link`:**

| Handoff | Existente | Nota |
|---------|-----------|------|
| `id` | `id` | OK |
| `title` | `title` | OK |
| `slug` | `code` / `slug` | Handoff usa `slug` como display; codebase tem `code` (imutavel) + `slug` (custom) |
| `source` | `source_type` (em `links-admin`) | Renomear p/ `source` no display; DB e `source_type` |
| `badge` | Derivado de `source` | Computed no frontend |
| `dest` | `destinationUrl` / `destination_url` | OK |
| `status` | `status` | Handoff adiciona "paused"; codebase ja tem `paused` em `LinkStatus` |
| `clicks` | `totalClicks` | OK |
| `last30` | Computado de `link_daily_metrics` | Query sum(clicks) where date >= now-30d |
| `unique` | `uniqueClicks` | OK |
| `scans` | **Novo** | Precisa coluna ou query (clicks where referrer_category = 'qr') |
| `ctr` | Computado | clicks / pageviews (pageviews do linktree ou do destino) |
| `health` | `healthStatus` | Mapping: healthy->ok, unhealthy->broken, timeout->warn |
| `redirect` | `redirect_type` (301/302) | OK |
| `clickIds` | `passClickIds` | OK |
| `spark[14]` | Computado de `link_daily_metrics` | Ultimos 14 dias, array de clicks |

### 4.3 Novas colunas / views necessarias

**1. View `link_summary_v2`** -- view materializada ou query para o hub:

```sql
create or replace view link_summary_v2 as
select
  tl.id, tl.site_id, tl.code, tl.slug, tl.title,
  tl.destination_url, tl.source_type, tl.status,
  tl.total_clicks, tl.unique_clicks,
  tl.health_status, tl.health_checked_at,
  tl.redirect_type, tl.pass_click_ids,
  tl.qr_code_url, tl.created_at, tl.expires_at,
  -- last 30 days
  coalesce(m30.clicks, 0) as last30_clicks,
  coalesce(m30.unique_visitors, 0) as last30_unique,
  -- QR scans (approximate via referrer_category)
  coalesce(qr.scans, 0) as qr_scans,
  -- spark: ultimos 14 dias como jsonb array
  coalesce(spark.days, '[]'::jsonb) as spark_14d
from tracked_links tl
left join lateral (...) m30 on true
left join lateral (...) qr on true
left join lateral (...) spark on true;
```

**2. Coluna `source_type` na `tracked_links`** -- se ainda nao existir como enum, verificar se precisa de migration. Valores do handoff: `newsletter`, `social`, `blog`, `qr`, `campaign`, `manual`.

**3. View `analytics_aggregate_v2`** -- query para a aba Analytics:

Agrega dados de todos os links de um site para o periodo selecionado, incluindo:
- `byDay` / `byDayPrev` (series diarias com periodo anterior)
- `bySource` (agrupado por source_type)
- `devices`, `browsers`, `os` (de `link_clicks`)
- `referrers` (top 5)
- `countries` + `cities` (de `link_clicks`)
- `heatmap` 7x24 (de `link_daily_metrics.hourly_clicks` ou `link_clicks.clicked_at`)

**4. Tabela `linktree_block_metrics`** (se nao existir):
```sql
create table if not exists linktree_block_metrics (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id),
  block_id text not null,
  date date not null,
  clicks integer default 0,
  unique_visitors integer default 0,
  constraint uq_block_date unique (site_id, block_id, date)
);
```

### 4.4 Schemas do handoff (referencia canonica)

De `links/data.js`:

```typescript
// SOURCES -- cores por origem nos graficos
interface Source {
  id: 'newsletter' | 'social' | 'blog' | 'qr' | 'campaign' | 'manual'
  label: string
  color: string // hex
}

// Cores canonicas:
// newsletter=#A77CE8, social=#3FA9C0, blog=#46B17E,
// qr=#E0A23C, campaign=#5B7FD6, manual=#8A8F98

// LINK (para tabela e hub)
interface LinkDisplay {
  id: string
  title: string
  slug: string           // ex: "/x5qdwDR"
  source: Source['id']
  badge: string          // label da source
  dest: string           // URL de destino (truncada)
  status: 'active' | 'paused' | 'expired'
  clicks: number
  last30: number
  unique: number
  scans: number          // QR scans
  topCountry: string
  ctr: number            // %
  created: string        // "09 mai 2026"
  health: 'ok' | 'warn' | 'broken'
  redirect: 301 | 302
  clickIds: boolean
  spark: number[]        // 14 pontos
}

// LINKTREE
interface LinktreeDisplay {
  url: string
  pageviews: number
  last30: number
  unique: number
  engagement: number     // % CTR global
  topCountry: string
  spark: number[]        // 30 pontos
  blocks: Array<{
    id: string
    label: string
    section: string      // "English" | "Portugues" | "Geral"
    clicks: number
    ctr: number          // %
  }>
  sharedLinks: Array<{
    id: string
    icon: string         // nome do icone SIP
    labelPt: string
    labelEn: string
    url: string
  }>
}

// ANALYTICS AGREGADO
interface AnalyticsDisplay {
  totalClicks: number
  prevClicks: number
  unique: number
  prevUnique: number
  ctr: number
  prevCtr: number
  qrShare: number        // % via QR
  byDay: number[]        // 30 pontos
  byDayPrev: number[]    // 30 pontos (periodo anterior)
  bySource: Array<{ id: Source['id']; clicks: number; pct: number }>
  devices: Array<{ k: string; v: number; color: string }>
  browsers: Array<{ k: string; v: number }>
  os: Array<{ k: string; v: number }>
  referrers: Array<{ k: string; v: number }>
  countries: Array<{
    code: string
    name: string
    v: number
    cities: string[]
  }>
  heatmap: number[][]    // [7][24], intensidade 0-4
  topLinks: LinkDisplay[]
  insights: Array<{
    tone: 'up' | 'accent' | 'amber' | 'red'
    icon: string
    text: string
  }>
}

// QR_TEMPLATES
interface QrTemplate {
  id: string
  name: string
  ratio: 'story' | 'landscape' | 'square' | 'portrait'
  desc: string
  bg: string
  paper?: boolean
  tag?: string
}
```

---

## 5. Inventario de Componentes

### 5.1 Componentes de graficos (SVG/CSS nativos)

Todos baseados em `links/charts.jsx`. Recriar em `packages/links-admin/src/components/charts/`.

| Componente | Fonte | Descricao | Props | Reuso |
|-----------|-------|-----------|-------|-------|
| `Spark` | `charts.jsx` | Sparkline SVG area+linha | `data[], color, w, h, fill?` | Hub tiles, tabela, detalhe |
| `Delta` | `charts.jsx` | Badge de variacao % | `cur, prev, suffix?, invert?` | Analytics tiles |
| `StatTile` | `charts.jsx` | Card KPI com icone + delta + spark | `label, value, sub?, icon, iconTint, delta?, spark?, sparkColor?` | Hub, Analytics, Detalhe |
| `BarChart` | `charts.jsx` | Barras verticais com comparacao | `data[], prev?[], labels?[], height, color` | Analytics "cliques por dia" |
| `Donut` | `charts.jsx` | Donut SVG com legenda | `segments[], size, thickness, centerLabel?, centerSub?` | Analytics "dispositivo" |
| `HBars` | `charts.jsx` | Barras horizontais com label | `rows[], color, suffix?` | Browser, OS, Referrer |
| `Heatmap` | `charts.jsx` | Grid 7x24 com intensidade | `grid[][]` | Analytics "horarios de pico" |
| `CountryList` | `charts.jsx` | Lista de paises com flag + barra | `countries[]` | Analytics "paises" |
| `Panel` | `charts.jsx` | Wrapper padrao para graficos | `title, icon?, right?, children` | Todos os paineis |

### 5.2 Componentes de UI

| Componente | Localizacao | Novo/Existente | Notas |
|-----------|-------------|----------------|-------|
| `TabBar` | `links/_components/tab-bar.tsx` | Novo | 3 tabs com underline coral animado |
| `FilterGroup` | `links/_components/filter-group.tsx` | Novo | Chips selecionaveis para filtros |
| `StatusDot` | `links/_components/status-dot.tsx` | Novo | Dot + label colorido por status |
| `HealthBadge` | `links/_components/health-badge.tsx` | Novo | Badge com tone por health |
| `LinktreePreview` | `links/_components/linktree/preview.tsx` | Migrado de `linktree/` | Preview compacto da arvore |
| `LinktreeEditor` | `links/_components/linktree/editor.tsx` | Migrado | Editor fullscreen |
| `IconPicker` | `links/_components/linktree/icon-picker.tsx` | Migrado | Grid de 16 icones em popover |
| `SharedLinksSection` | `links/_components/linktree/shared-links.tsx` | Migrado | Lista DnD de shared links |
| `CreateLinkModal` | `links/_components/create-link-modal.tsx` | Novo | Modal de criacao rapida |
| `SourceBars` | `links/_components/source-bars.tsx` | Novo | Barras por origem com cores |
| `TopLinksTable` | `links/_components/top-links-table.tsx` | Novo | Ranking clicavel |
| `InsightsPanel` | `links/_components/insights-panel.tsx` | Novo | Narrativas Cowork |
| `PotentialPanel` | `links/_components/potential-panel.tsx` | Novo | Cards tracejados do roadmap |
| `RangeTabs` | `links/_components/range-tabs.tsx` | Novo | Tabs de periodo (7d/30d/90d/1a) |

### 5.3 Componentes compartilhados (Social)

| Componente | Fonte | Notas |
|-----------|-------|-------|
| `CanvasEditor` | `social/canvas.jsx` | Reutilizar implementacao do Social Studio |
| `Artboard` | `social/canvas.jsx` | Drag + resize de elementos |
| `LeftRail` | `social/canvas.jsx` | Formato, adicionar, fundo, camadas |
| `RightRail` | `social/canvas.jsx` | Propriedades do elemento selecionado |
| `TemplatePicker` | `social/canvas.jsx` | Grid de templates em modal |

Estes componentes ja devem estar implementados como parte do Social Studio. Se nao, implementar e compartilhar.

### 5.4 Componentes existentes a modificar

| Componente | Arquivo | Mudanca |
|-----------|---------|--------|
| `LinksDashboard` | `packages/links-admin/src/client.ts` | Substituir pelo novo `LinksHub` |
| `AnalyticsOverview` | `packages/links-admin/src/components/analytics-overview.tsx` | Substituir pelo novo `AnalyticsView` rico |
| `QrComposer` | `packages/links-admin/src/components/qr-composer.tsx` | Substituir pelo `CanvasEditor` |
| `LinkDetail` | `apps/web/.../links/[id]/_detail.tsx` | Reescrever com novo layout |
| `LinksHub` | `apps/web/.../links/_hub.tsx` | Reescrever com 3 abas |

---

## 6. Analytics Avancado (Potencial)

As 6 features "Potencial" do handoff. Implementar todas.

### 6.1 Metas & Conversao

**Descricao:** Marcar destinos como meta e medir conversao por link/origem.

**Requisitos de dados:**
- Nova tabela `link_goals`: `{id, site_id, link_id, goal_type (pageview|event|time), goal_url_pattern, created_at}`
- Coluna `converted` em `link_clicks` (boolean, default false)
- Logica de matching: quando o click.destination_url matches um goal_url_pattern

**Abordagem:**
- UI: modal de configuracao de metas no detalhe do link
- Dashboard: card com taxa de conversao por link e por origem
- Query: `sum(converted) / count(*)` agrupado

### 6.2 Atribuicao UTM

**Descricao:** Quebrar analytics por source / medium / campaign automaticamente.

**Requisitos de dados:**
- Colunas ja existem em `tracked_links` e `link_clicks` (utmSource, utmMedium, etc.)
- Parser existente: `packages/links/src/core/utm-parser.ts`
- Normalizer existente: `packages/links/src/core/utm-normalizer.ts`

**Abordagem:**
- Novo painel no Analytics: "Atribuicao UTM" com barras agrupadas por source, medium, campaign
- Filtro por UTM params no hub
- Query: `group by utm_source, utm_medium, utm_campaign`

### 6.3 Novos vs. Recorrentes

**Descricao:** Separar visitantes novos de quem ja clicou antes.

**Requisitos de dados:**
- Visitor ID ja existe: `packages/links/src/core/visitor-id.ts` (SHA-256 daily-rotating)
- Para diferenciar novo vs recorrente: lookup se `visitor_id` ja apareceu antes em `link_clicks`
- Ou: coluna `is_returning` em `link_clicks` (set no momento do click, via lookup)

**Abordagem:**
- Adicionar `is_returning boolean default false` na `link_clicks`
- No `ClickRecorder`: antes de inserir, fazer `exists(select 1 from link_clicks where visitor_id = $1 and link_id = $2)`
- Dashboard: donut novo vs. recorrente + trend line separado

### 6.4 Mapa Geografico

**Descricao:** Mapa-mundi com cidades e calor por regiao.

**Requisitos de dados:**
- Dados de country/city ja existem em `link_clicks` (via geo resolver)
- Precisa agregacao: `group by country, city` com coordenadas

**Abordagem:**
- SVG world map (topojson simplificado, <50KB) renderizado client-side
- Circulos proporcionais por pais
- Tooltip com breakdown de cidades
- Alternativa mais simples: lista ranked (ja existe como `CountryList`)

### 6.5 Filtro de Bots

**Descricao:** Excluir trafego automatizado das metricas.

**Requisitos de dados:**
- Deteccao ja existe: `packages/links/src/core/bot-filter.ts` (`isBot`, `getBotName`)
- Coluna `is_bot` ja existe em `link_clicks`
- Metricas `bots` ja existem em `DailyMetric`

**Abordagem:**
- Toggle "Excluir bots" nos analytics (padrao: on)
- Filtro aplicado nas queries: `where is_bot = false`
- Card de resumo: "X% do trafego e bot" com breakdown por bot name
- Recalcular todas as metricas com/sem bots

### 6.6 Funil QR -> Pagina -> Acao

**Descricao:** Acompanhar do scan ate a conversao final.

**Requisitos de dados:**
- Etapa 1 (QR scan): click com `referrer_category = 'qr'`
- Etapa 2 (pageview): destino visitado (necessita tracking no destino)
- Etapa 3 (acao): conversao (ver 6.1 Metas)

**Abordagem:**
- Visualizacao de funil com 3 barras decrescentes
- Etapa 1 = count clicks QR, Etapa 2 = pageviews destino (se tracking ativo), Etapa 3 = conversoes
- Necessita integracao com analytics do destino (ou pixel proprio)
- Implementacao incremental: comecar com etapas 1+2, adicionar 3 quando metas existirem

---

## 7. Integracao Cowork (Insights)

### 7.1 Arquitetura atual

O sistema de insights ja existe em `apps/web/src/lib/links/insights.ts`:
- 6 regras heuristicas (spike, geo concentration, best time, device, growth, low engagement)
- Resultado cacheado por 1h via `unstable_cache`
- Output: array de strings

### 7.2 Evolucao para Cowork

**Fase 1 (MVP):** Manter as regras heuristicas, mas formatar como o handoff espera:
```typescript
interface Insight {
  tone: 'up' | 'accent' | 'amber' | 'red'
  icon: string    // nome do icone SIP
  text: string    // narrativa
}
```

Mapping das regras existentes:
| Regra | Tone | Icone |
|-------|------|-------|
| `ruleSpikeDetection` | `up` | `trendingUp` |
| `ruleGeoConcentration` | `accent` | `globe` |
| `ruleBestTime` | `amber` | `clock` |
| `ruleDeviceInsight` | `accent` | `media` |
| `ruleGrowthTrend` | `up` (crescimento) / `red` (queda) | `trendingUp` / `warn` |
| `ruleLowEngagement` | `red` | `warn` |

**Fase 2 (Cowork IA):** Integrar com o pipeline Cowork para gerar narrativas mais ricas:
- Endpoint pipeline: `POST /api/pipeline/links/insights`
- Input: metricas agregadas do periodo (byDay, bySource, devices, countries, etc.)
- Output: array de `Insight` com narrativas geradas pelo Cowork
- Badge "auto" (cowork) no painel de Insights

**Fase 3:** Insights interativos (clicaveis) que levam a actions no CMS (ex: "Pause este link" ou "Agende compartilhamento as 18h").

### 7.3 UI do Insights Panel

De `links/analytics.jsx` (`InsightsPanel`):
- Panel com titulo "Insights" + icone `sparkles` + badge cowork "auto"
- Lista vertical de insights (gap 11px)
- Cada insight: icone 26x26 em circulo com bg da tone (22% opacidade) + texto 12.5px ink-dim

---

## 8. Gestao de Estado

### 8.1 Estado por tela (do handoff README State Management)

**App (hub router):**
```typescript
// Query param-driven, nao useState
tab: 'tree' | 'links' | 'analytics'  // via searchParams
// Modais controlados por estado local:
treeOpen: boolean        // editor fullscreen da linktree
qrOpen: boolean          // editor de QR canvas
createOpen: boolean      // modal novo link
toast: string | null     // toast message temporario
```

**ShortLinksTab:**
```typescript
src: string              // filtro de origem ('all' | source.id)
status: string           // filtro de status ('all' | 'active' | 'paused')
q: string                // busca textual
```

**LinktreeEditor:**
```typescript
shared: SharedLink[]     // lista editavel de shared links
highlight: boolean       // toggle highlight card
iconPickFor: string | null // id do link com popover aberto
tagPt: string            // tagline PT
tagEn: string            // tagline EN
```

**CanvasEditor (compartilhado):**
```typescript
design: {
  bg: string
  bgKind: 'solid' | 'image' | 'video' | 'gradient'
  elements: CanvasElement[]
}
ratio: AspectRatio
selId: string | null     // elemento selecionado
zoom: number             // 40-160
frames: Frame[]          // story frames
```

### 8.2 Data fetching

| Tela | Estrategia | Cache |
|------|-----------|-------|
| Hub (todas as abas) | Server component carrega; client renderiza | `unstable_cache` com `revalidate: 300` |
| Detalhe | Server component por `[id]` | `unstable_cache` com tag por linkId |
| Analytics agregado | Server + Suspense boundaries | `revalidate: 900` (15min) |
| Insights | `getAiInsightsForLink` ja cacheado 1h | Manter |
| Linktree config | Server component | `revalidate: 60` |

### 8.3 Server Actions

| Action | Arquivo | Funcao |
|--------|---------|--------|
| `createLink` | `links/actions.ts` | Criar link + gerar QR |
| `deleteLink` | `links/actions.ts` | Soft delete (status -> deleted) |
| `toggleLinkActive` | `links/actions.ts` | Toggle active/paused |
| `revalidateHealth` | `links/actions.ts` | Fire health check para todos links |
| `saveLinktree` | `links/actions.ts` | Salvar config + shared links da linktree |
| `exportCsv` | `links/actions.ts` | Gerar CSV de analytics |

---

## 9. Estrategia de Testes

### 9.1 Testes unitarios (`vitest`)

**`packages/links/`** (core domain -- ja existem ~20 testes):
- `bot-filter.test.ts` -- deteccao de bots
- `click-recorder.test.ts` -- gravacao de cliques
- `device-classifier.test.ts` -- classificacao de dispositivos
- `utm-parser.test.ts` / `utm-normalizer.test.ts` -- UTM
- `referrer-classifier.test.ts` -- referrer
- `link-service.test.ts` -- CRUD de links
- `redirect-resolver.test.ts` -- resolucao de redirect

**Novos testes no `packages/links/`:**
- `analytics/aggregator.test.ts` -- aggregateMetrics com periodo anterior
- `analytics/comparator.test.ts` -- comparePeriods delta
- Testes para as 6 features Potencial conforme implementadas

**`packages/links-admin/`:**
- **Novos:**
  - `charts/spark.test.tsx` -- renderiza sparkline com dados
  - `charts/bar-chart.test.tsx` -- barras com/sem comparacao
  - `charts/donut.test.tsx` -- segmentos e labels
  - `charts/heatmap.test.tsx` -- grid 7x24
  - `charts/hbars.test.tsx` -- barras horizontais
  - `charts/country-list.test.tsx` -- paises com flags
  - `components/filter-group.test.tsx` -- selecao de chips
  - `components/status-dot.test.tsx` -- cores por status
  - `components/health-badge.test.tsx` -- tones por health
  - `components/range-tabs.test.tsx` -- selecao de periodo
  - `components/create-link-modal.test.tsx` -- validacao de form

### 9.2 Testes de integracao (`apps/web/test/`)

- Hub: renderiza 3 abas, navega entre elas
- Short links: filtros de origem e status funcionam
- Detalhe: exibe todos os KPIs e accordion de analytics
- Linktree editor: edita tagline, preview atualiza ao vivo
- Create modal: cria link e redireciona

### 9.3 TDD para graficos

Seguir o padrao do AB Lab (que ja testou `BayesCurves`, `Gauge`, `RadarChart` etc.):
- Cada grafico: `describe('Spark')` com cenarios para dados vazios, dados normais, dados edge case
- Testar que SVG paths sao gerados corretamente
- Testar responsividade (props w/h)

### 9.4 Cobertura minima

| Area | Cobertura alvo |
|------|----------------|
| Charts (SVG/CSS) | 90%+ (logica de calculo) |
| Filtros/busca | 85%+ |
| Server actions | 80%+ (com mocks de DB) |
| Insights rules | 100% (ja existem) |
| Analytics agregacao | 85%+ |

---

## 10. Plano de Migracao

### 10.1 Fases

**Fase 1 -- Infraestrutura (sem mudanca visual):**
1. Criar migrations para novas views/colunas necessarias
2. Migrar componentes de `linktree/` para `links/_components/linktree/`
3. Implementar `TabBar` e estado de abas via query params
4. Atualizar sidebar: remover "Link in Bio"
5. Adicionar redirects (link-in-bio -> links?tab=tree)

**Fase 2 -- Graficos (TDD):**
1. Implementar todos os 8 componentes de graficos em `packages/links-admin/`
2. Testes para cada componente
3. `StatTile`, `Spark`, `Delta`, `BarChart`, `Donut`, `HBars`, `Heatmap`, `CountryList`

**Fase 3 -- Telas principais:**
1. Reescrever hub com 3 abas (Linktree, Short links, Analytics)
2. Reescrever detalhe do link
3. Implementar modal de criacao
4. Integrar graficos nas telas

**Fase 4 -- Editors:**
1. Migrar editor da Linktree para novo path
2. Integrar CanvasEditor para QR (reutilizar do Social)
3. Implementar templates QR proprios

**Fase 5 -- Analytics avancado:**
1. Implementar as 6 features Potencial (ordem: UTM > Bots > New/Returning > Goals > Geo Map > QR Funnel)
2. Integrar Cowork para Insights
3. Export CSV

### 10.2 Backward compatibility

- Redirects 308 garantem que bookmarks antigos continuam funcionando
- `packages/links-admin` mantem exports publicos compativeis (mesmo que internals mudem)
- Server actions mantem a mesma interface (novos campos sao opcionais)
- `link_clicks` particionada nao muda -- apenas queries novas

### 10.3 Cleanup pos-migracao

- Deletar `apps/web/src/app/cms/(authed)/linktree/` (todo o diretorio)
- Deletar `apps/web/src/app/cms/(authed)/links/_components/linktree-hero-card.tsx` (substituido)
- Deletar `apps/web/src/app/cms/(authed)/links/_components/source-breakdown.tsx` (substituido por SourceBars)
- Remover entry "Link in Bio" de `cms-sections.ts`
- Remover componentes antigos de `packages/links-admin` (`LinksDashboard`, `AnalyticsOverview` antigo)

### 10.4 Riscos e mitigacoes

| Risco | Mitigacao |
|-------|----------|
| Queries de analytics lentas com muitos dados | Usar views materializadas + indice em (site_id, date) |
| Canvas editor nao implementado no Social ainda | Implementar standalone primeiro; compartilhar depois |
| Break nos testes existentes ao mover linktree | Mover + atualizar imports no mesmo commit |
| Heatmap com dados reais pode ter lacunas | Default 0 para horas sem dados; UI degrada gracefully |
| Insights Cowork depende de pipeline | Fase 1 usa regras heuristicas (ja existem); Cowork e fase 2 |

### 10.5 Arquivos afetados

**Novos:**
- `apps/web/src/app/cms/(authed)/links/_components/tab-bar.tsx`
- `apps/web/src/app/cms/(authed)/links/_components/filter-group.tsx`
- `apps/web/src/app/cms/(authed)/links/_components/status-dot.tsx`
- `apps/web/src/app/cms/(authed)/links/_components/health-badge.tsx`
- `apps/web/src/app/cms/(authed)/links/_components/create-link-modal.tsx`
- `apps/web/src/app/cms/(authed)/links/_components/source-bars.tsx`
- `apps/web/src/app/cms/(authed)/links/_components/top-links-table.tsx`
- `apps/web/src/app/cms/(authed)/links/_components/insights-panel.tsx`
- `apps/web/src/app/cms/(authed)/links/_components/potential-panel.tsx`
- `apps/web/src/app/cms/(authed)/links/_components/range-tabs.tsx`
- `packages/links-admin/src/components/charts/spark.tsx`
- `packages/links-admin/src/components/charts/delta.tsx`
- `packages/links-admin/src/components/charts/stat-tile.tsx`
- `packages/links-admin/src/components/charts/bar-chart.tsx`
- `packages/links-admin/src/components/charts/donut.tsx`
- `packages/links-admin/src/components/charts/hbars.tsx`
- `packages/links-admin/src/components/charts/heatmap.tsx`
- `packages/links-admin/src/components/charts/country-list.tsx`
- `packages/links-admin/src/components/charts/panel.tsx`
- `packages/links-admin/src/components/charts/index.ts`
- Testes correspondentes para todos os acima

**Migrados (de linktree/ para links/):**
- `linktree/_components/*.tsx` -> `links/_components/linktree/*.tsx`
- `linktree/actions.ts` -> merge com `links/actions.ts`

**Reescritos:**
- `apps/web/src/app/cms/(authed)/links/_hub.tsx`
- `apps/web/src/app/cms/(authed)/links/page.tsx`
- `apps/web/src/app/cms/(authed)/links/[id]/_detail.tsx`
- `apps/web/src/app/cms/(authed)/links/[id]/qr/client.tsx`

**Modificados:**
- `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts` (remover Link in Bio)
- `apps/web/src/lib/links/insights.ts` (formatar output como Insight com tone/icon)
- `packages/links-admin/src/index.ts` (novos exports)
- `packages/links-admin/src/client.ts` (novos exports client)
- `packages/links-admin/src/types.ts` (novos tipos)

**Deletados (pos-migracao):**
- `apps/web/src/app/cms/(authed)/linktree/` (diretorio inteiro)
- `apps/web/src/app/cms/(authed)/links/_components/linktree-hero-card.tsx`
- `apps/web/src/app/cms/(authed)/links/_components/source-breakdown.tsx`
- `apps/web/src/app/cms/(authed)/links/_components/social-summary-bar.tsx` (absorvido)

### 10.6 Design tokens (referencia)

Do handoff, usar equivalentes do codebase:
```
--bg #0C0B09          -> bg-background
--surface #161410     -> bg-card
--surface-2 #1E1B16   -> bg-muted
--line rgba(...0.08)  -> border
--ink #ECE6DA         -> text-foreground
--ink-dim #A39C8E     -> text-muted-foreground
--ink-faint #6E685D   -> text-muted-foreground/50
--accent #F2683C      -> text-primary (coral)
--green #46B17E       -> text-green-400
--amber #E0A23C       -> text-amber-400
--red #D9614A         -> text-red-400
--cowork #6E63F2      -> text-violet-400
raio 14px             -> rounded-[14px] / rounded-xl
```

Cores por origem (graficos) -- definir como constantes:
```typescript
export const SOURCE_COLORS = {
  newsletter: '#A77CE8',
  social: '#3FA9C0',
  blog: '#46B17E',
  qr: '#E0A23C',
  campaign: '#5B7FD6',
  manual: '#8A8F98',
} as const
```

Tipografia: **Fraunces** (titulos, `font-serif`), **Inter** (UI, `font-sans`), **JetBrains Mono** (eyebrows/numeros/slug, `font-mono`). Laranja em no maximo 10% da area.

Estados de saude: ok=verde, warn=amber, broken=vermelho.
