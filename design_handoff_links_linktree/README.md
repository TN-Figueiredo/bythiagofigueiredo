# Handoff: Links + Linktree

## Overview
Redesenho da seção **Links** do CMS do ByThiagoFigueiredo (`/cms/links` + `/cms/link-in-bio`). O CMS atual sofre de dois problemas: (1) **dois itens de menu** confusos ("Links" e "Link in Bio") e (2) telas que parecem **mortas** (tudo zerado, pouca informação). Este redesenho unifica e enriquece tudo.

**Decisão de produto central — unificar a navegação.** Não se justifica ter dois itens de nav. Vira **um único "Links"** com 3 abas: **Linktree** (a porta de entrada / link-in-bio) · **Short links** (links rastreados) · **Analytics**. O item "Link in Bio" some do menu lateral (uma nota no produto explica a fusão). O public Linktree (a página `go.bythiagofigueiredo.com` que o visitante vê) **não muda** — já está bom; o que muda é a experiência de gestão dentro do CMS.

## About the Design Files
Os arquivos deste bundle são **referências de design feitas em HTML/React (Babel no navegador)** — protótipos de aparência e comportamento, **não** código de produção. A tarefa é **recriar estes designs no codebase real do CMS**, reaproveitando os componentes e o design system já existentes lá. Onde o codebase tiver primitivos equivalentes (botões, cards, badges, ícones, sidebar, gráficos), **use os do codebase**.

Os módulos em `social/` (ui.jsx, canvas.jsx, data.js, image-slot.js) são **compartilhados** com a sessão de Posts (Social Studio) — o editor de canvas e os primitivos de UI são os mesmos. Se você já implementou o handoff de Posts, **reaproveite o que construiu lá** (especialmente o editor de canvas e os primitivos).

## Fidelity
**Alta fidelidade (hifi).** Cores, tipografia, espaçamento, estados e gráficos finalizados; recriar fielmente respeitando os tokens (abaixo). Preferir tokens/componentes do codebase quando houver conflito.

---

## Arquitetura de navegação

```
Links (hub)  ──tabs──>  Linktree · Short links · Analytics
   │  "Novo link" (modal) / "QR Card"
   ├─ Linktree ──> Editor da Linktree (fullscreen, preview ao vivo)
   ├─ Short links ──> Detalhe do link ──> Editor de QR (canvas, fullscreen)
   └─ Analytics (rico)
```
- Item de menu único **"Links"** ativo; **"Link in Bio" removido** (mergeado).
- Breadcrumb consistente: **`Social › Links › …`**. Crumbs clicáveis.
- Editor da Linktree, Editor de QR e modal de Novo Link são overlays fullscreen/modais.
- Painel **Tweaks** (canto inf-dir) é só navegação de protótipo — **descartável**.

---

## Screens / Views

### 1. Links Hub — `/cms/links`
`PageHeader`: breadcrumb `Social › Links`, título "Links" (Fraunces), subtítulo, ações `QR Card` (ghost) + `Novo link` (primary). Barra de tabs (Linktree / Short links / Analytics, sublinhado coral no ativo).

### 2. Aba Linktree (porta de entrada)
- **Nota de fusão**: banner accent "Link in Bio agora vive aqui" explicando a unificação.
- **Card de preview** (esq, 340px): badge "porta de entrada" + URL `go.bythiagofigueiredo.com` + **preview público compacto da árvore** (TF stamp, nome, tagline, último post, seções English/Português, links compartilhados) + botões `Editar` / `Abrir`.
- **Stats** (dir): Pageviews, Últimos 30d, Únicos, Engajamento.
- **Desempenho por bloco**: qual link da árvore mais converte — lista com barras de CTR (clicks ÷ views) por bloco, agrupado por seção. Botão `Analytics`.

### 3. Aba Short links
- **4 tiles** com sparkline: Total de links, Cliques totais (+spark), Links ativos, Top performer (slug + spark).
- **Painel "Saúde dos links"**: surfacing de links com problema — chips clicáveis (`/oldgear` destino quebrado = vermelho; `/qrcard` a expirar = âmbar) + `Revalidar`. Só aparece se houver links unhealthy.
- **Busca** + `Novo link`.
- **Filtros**: Origem (Tudo + 6 fontes) e Status (Tudo/Ativos/Pausados) como chips.
- **Tabela**: colunas Link (título + slug + dot da origem), Destino, Tendência (mini-sparkline), Cliques, Status (dot colorido), ações (QR + abrir). Linha clicável → detalhe.

### 4. Aba Analytics (rica — foco do pedido)
- Range tabs (7d/30d/90d/1ano) + nota de comparação + export CSV.
- **4 StatTiles** com delta vs. período anterior + sparkline: Cliques, Visitantes únicos, Engajamento (CTR), Via QR/impresso.
- **Cliques por dia**: barras (atual coral) **com barras do período anterior atrás** (cinza) — comparação. Legenda atual/anterior.
- **Insights** (painel cowork "auto"): 4 narrativas geradas (tendência, QR, horário de pico, saúde). **Ponto de integração de IA** — hoje é texto fixo.
- **Por origem** (barras coloridas por fonte) · **Dispositivo** (donut com total no centro).
- **Navegador / Sistema / Referrer** (HBars).
- **Países** (lista com bandeira + cidades + barra) · **Horários de pico** (heatmap 7×24).
- **Top links · 30 dias** (leaderboard clicável).
- **Potencial — a implementar** (cards tracejados, roadmap explícito p/ Claude Code): metas & conversão, atribuição UTM, novos vs. recorrentes, mapa geográfico, filtro de bots, funil QR→página→ação.

### 5. Detalhe do link — `/cms/links/:id`
Breadcrumb `Social › Links › <título>`. Header: título, status (Ativo/Pausado dot), badge da origem, slug, **badge de saúde** (saudável/a expirar/quebrado). Ações: Copiar URL, QR, Pausar/Reativar, Editar. Card de Destino. 4 tiles (Cliques totais, Últimos 30d, Únicos, **QR scans**). Card Detalhes (Redirect 301/302, Click IDs on/off, Origem, Criado, Saúde). Accordion **Analytics completo** (versão por-link do dashboard). Card promo do **QR Card** abrindo o canvas.

### 6. Editor da Linktree (fullscreen)
Breadcrumb `Links › Linktree › Editar` + badge "porta de entrada" + URL. Esq (form): Tagline PT/EN, Descrição do Blog PT/EN (todos **bilíngues**), toggle Highlight Card, **Shared Links** (cada um: handle de arraste, botão "Trocar ícone" com **popover de grid de ícones**, Label PT/EN, URL, deletar) + Adicionar link (máx 10). Dir (400px): **Preview ao vivo** — reflete em tempo real a tagline e os ícones escolhidos.

### 7. Editor de QR (canvas reaproveitável, fullscreen)
Mesmo `CanvasEditor` do Social, com **templates próprios de QR**: Newsletter Card, Cartão de visita (85×55mm), Adesivo redondo, Cavalete de mesa, Pôster A4, Story. Toolbar (zoom, Templates, Exportar, Usar no post), rail de Formato/Adicionar/Fundo/Camadas, artboard com **drag + resize reais**, rail de propriedades. Design inicial = o QR Card editorial (kicker + título Fraunces + QR + chamada + carimbo).

### 8. Modal Novo link
Destino (URL), Título, Origem (chips), Slug (auto-gerado, regenerável), nota "Click IDs ligados · 301 · QR automático". `Criar link`.

---

## Interactions & Behavior
- **Tabela → detalhe**: clicar linha navega; botão QR (stopPropagation) abre o canvas.
- **Saúde**: chips abrem o detalhe do link afetado; Revalidar dispara toast.
- **Editor Linktree**: tagline e ícones são estado controlado → preview atualiza ao vivo; popover de ícone fecha ao escolher.
- **Canvas QR**: drag (pointerdown→move→up, % do artboard, clamp 1–99), resize (alça laranja; texto=fonte, imagem=w/h, sticker/logo=scale).
- **Analytics**: range tabs trocam o período (no protótipo os dados são fixos); export = toast.
- **Toasts**: ações secundárias usam `window.__linksToast`.
- **Responsivo**: grids 2-col colapsam <1080px; sidebar some <760px; tabela usa colunas fixas (no codebase, considerar virar cards no mobile).

## State Management
React `useState` por componente, sem store global.
- **App**: `route` (hub|detail), `tab` (tree|links|analytics), `curLink`, `treeOpen`, `qrOpen`, `createOpen`, `toast`.
- **ShortLinksTab**: `src`, `status`, `q` (filtros/busca).
- **LinktreeEditor**: `shared[]`, `highlight`, `iconPickFor`, `tagPt`, `tagEn`.
- **CanvasEditor**: `design {bg,bgKind,elements[]}`, `ratio`, `selId`, `zoom`, `frames`.
- **Dados/fetch reais a plugar**: lista de short links (+ clicks/unique/scans/health/spark/source), config + métricas da linktree (pageviews, CTR por bloco), agregados de analytics (byDay + período anterior, bySource, device/browser/os/referrer, countries+cities, heatmap, topLinks), eventos de clique brutos, verificação de saúde (HTTP do destino), geração de short slug, geração/preview de QR.

## Esquema de dados (ver `links/data.js`)
- **link**: `{id, title, slug, source, badge, dest, status: active|paused|expired, clicks, last30, unique, scans, topCountry, ctr, created, health: ok|warn|broken, redirect, clickIds, spark[14]}`
- **source**: `{id, label, color}` (newsletter, social, blog, qr, campaign, manual)
- **linktree**: `{url, pageviews, last30, unique, engagement, topCountry, spark[30], blocks[], sharedLinks[]}`; **block**: `{id, label, section, clicks, ctr}`; **sharedLink**: `{id, icon, labelPt, labelEn, url}`
- **analytics**: `{totalClicks, prevClicks, unique, prevUnique, ctr, prevCtr, qrShare, byDay[30], byDayPrev[30], bySource[], devices[], browsers[], os[], referrers[], countries[{code,name,v,cities[]}], heatmap[7][24], topLinks[], insights[{tone,icon,text}]}`
- **QR_TEMPLATES**: `{id, name, ratio, desc, bg, paper?, tag?}`

## Design Tokens
Mesmos do CMS (warm near-black + coral). Usar equivalentes do codebase.
```
--bg #0C0B09  --bg-side #100E0B  --surface #161410  --surface-2 #1E1B16  --surface-3 #262219
--line rgba(245,239,230,0.08)  --line-strong rgba(245,239,230,0.15)
--ink #ECE6DA  --ink-dim #A39C8E  --ink-faint #6E685D
--accent #F2683C  --accent-deep #D24E22  --accent-soft rgba(242,104,60,0.13)
--cowork #6E63F2  --green #46B17E  --amber #E0A23C  --red #D9614A
raio --r 14 / --r-sm 9 · sombra 0 24px 60px -20px rgba(0,0,0,.6)
```
Cores por origem (gráficos): newsletter `#A77CE8` · social `#3FA9C0` · blog `#46B17E` · qr `#E0A23C` · campaign `#5B7FD6` · manual `#8A8F98`.
Tipografia: **Fraunces** (títulos), **Inter** (UI), **JetBrains Mono** (eyebrows/números/slug). Laranja em **≤10% da área**.
Estados de saúde: ok=verde, warn=âmbar, broken=vermelho.

## Assets
- Ícones: set stroke 24×24 (`SIP` em `social/ui.jsx`). Substituir pelo set do codebase.
- `social/image-slot.js`: web component de drop de imagem (canvas). Trocar pelo uploader real.
- Gráficos: SVG/CSS leves feitos à mão em `links/charts.jsx` (Spark, BarChart, Donut, HBars, Heatmap, CountryList). Pode trocar por uma lib de charts do codebase, mantendo o visual.
- Bandeiras: emoji (BR/PT/US/ES). QR: placeholder CSS — gerar QR real no backend.
- Carimbo TF: desenho CSS — usar asset de marca real.

## Files
- `Links Studio.html` — host (tokens, fontes, ordem de scripts). Abra no navegador; Tweaks pula entre cenas.
- `links/data.js` — dados mock + esquema + `QR_TEMPLATES` + `qrCardDesign()`.
- `links/charts.jsx` — mini-gráficos (Spark, Delta, StatTile, BarChart, Donut, HBars, Heatmap, CountryList, Panel).
- `links/analytics.jsx` — `AnalyticsView` (seção) + `LinkAnalytics` (por link) + Insights + Potencial.
- `links/linktree.jsx` — `LinktreePreview` (público compacto) + `LinktreeEditor`.
- `links/detail.jsx` — `LinkDetail`.
- `links/hub.jsx` — `LinksHub` (3 abas) + tabela + saúde dos links.
- `links/app.jsx` — router + tweaks + modal Novo link (descartável o tweaks).
- `social/ui.jsx`, `social/canvas.jsx`, `social/data.js`, `social/image-slot.js` — **compartilhados** com Posts (primitivos + editor de canvas + RATIOS). Reaproveite a implementação de Posts.
