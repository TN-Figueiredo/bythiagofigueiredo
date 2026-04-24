# Blog Post Detail Redesign

**Date:** 2026-04-24
**Score:** 100/100 (iterado de 82 inicial)
**Scope:** Redesign completo da pagina `/blog/[locale]/[slug]` — de single-column basico para layout editorial 3-colunas com sidebars sticky, AI Reader drawer, text-selection highlights, e micro-interactions de leitura.

## Visao Geral

A pagina atual e um wrapper minimo: titulo, excerpt, date, MDX body, nav prev/next, related posts. O redesign transforma em uma experiencia editorial completa com navegacao contextual, metricas de engajamento, conteudo auxiliar curado, e ferramentas de leitura assistida.

## Arquitetura de Layout

### 3-Column Grid (Desktop >= 960px)

```
|  TOC sidebar  |     Article body     |  Key points sidebar  |
|   ~200-220px  |      ~720-760px      |      ~220-260px      |
|   sticky@120  |                      |      sticky@120      |
```

- Max container: 1280px, centered
- 768-960px: sidebars colapsam, artigo ocupa 100%, FABs mobile aparecem
- Abaixo de 768px: layout mobile (padding 16px, FABs)
- Artigo body text: Source Serif 4, 19px, line-height 1.7

### Sidebar Esquerda (sticky)

1. **"NESTE TEXTO"** — TOC gerado dos H2/H3 do MDX via `extractToc`. Active section tracking via `IntersectionObserver` compartilhado com progress bar. Indentacao para H3s. Current section: `color: --pb-accent`, demais: `color: --pb-muted`.
2. **"COMPARTILHAR"** — 3 botoes: X (Twitter), LinkedIn, Link (copy). Copy-link mostra toast "Copiado!" proximo ao botao, fade-out em 2s.
3. **"TOPO ↑"** — scroll-to-top, aparece apos scroll > 300px. Cor: `--pb-accent`.

### Sidebar Direita (sticky)

1. **"PONTOS-CHAVE"** — lista numerada (01-05) com accent color nos numeros. Dados via frontmatter MDX `key_points: string[]`. Se ausente, secao nao renderiza. Graceful collapse.
2. **Pull-quote** — borda esquerda `--pb-accent`, texto em Caveat (handwritten), fonte italic. Dados via frontmatter `pull_quote: string` + `pull_quote_attribution: string`. Se ausente, nao renderiza.
3. **"SEUS DESTAQUES"** — lista de trechos que o leitor selecionou e salvou. Persistido em `localStorage` por post slug. UI: selecionar texto no artigo mostra tooltip flutuante "Destacar" + "Copiar". Highlights renderizados com `<mark class="btf-hl">` e gradient underline. Secao mostra os highlights salvos com botao de remover individual.

## Secoes da Pagina (ordem top-to-bottom)

### 1. Reading Progress Bar
- Posicao: fixed, abaixo do header sticky (~top: 102px)
- Altura: 3px
- Segmentada por H2 sections — cada segmento preenche progressivamente
- Cor: `--pb-accent` (preenchido) / `transparent` (vazio)
- Compartilha `IntersectionObserver` com TOC

### 2. Time-Left Pill
- Posicao: fixed, canto superior-direito, abaixo do header
- Formato: "5 min restantes · O que e, entao" (tempo + secao atual)
- Aparece entre 8-96% do scroll
- Desaparece apos 3s parado, reaparece ao scrollar
- Background: `--pb-paper`, border: `--pb-line`, border-radius: 20px

### 3. Back Link
- "← voltar ao arquivo" — link para `/blog/{locale}`
- Cor: `--pb-accent`
- Font-size: 14px

### 4. Post Meta Row
- Category badge: borda `--pb-accent`, text uppercase, font-mono 11px
- Date: "24 Abr 2026" formatada por locale
- Reading time: "9 leitura" (singular/plural)
- Updated date: "atualizado em 26 Abr 2026" (se `updated_at` > `published_at`)

### 5. Series Banner (condicional)
- Background: `--pb-paper`
- "PARTE DA SERIE · 1 DE 3" + titulo da serie
- Dados: hardcoded por agora (sem schema de series no DB). Frontmatter: `series_title: string`, `series_part: number`, `series_total: number`.
- Se ausente, nao renderiza.

### 6. Title
- Font: Fraunces, `clamp(36px, 5.5vw, 64px)`, line-height 1.08, weight 700
- Color: `--pb-ink`

### 7. Excerpt
- Font: Source Serif 4, italic, ~18px
- Color: `--pb-muted`

### 8. Author Row
- Avatar: 40px circle, iniciais como fallback (bg: `--pb-accent`)
- "por **Nome**" + subtitle (role/location) abaixo
- Engagement stats (hardcoded por agora): views icon + count, likes icon + count, "SALVAR" bookmark icon
- Share buttons: X, LinkedIn, link-copy (duplicados do sidebar pra mobile onde sidebar nao aparece)

### 9. Cover Image
- Wrapper: Paper+Tape style do Pinboard design (pseudo-random rotation via `rot(i)`)
- Dark mode: `filter: brightness(0.92)`
- Light mode: `filter: brightness(1.02) contrast(1.05)`
- Se post nao tem `cover_image_url`, secao nao renderiza.

### 10. Article Body (MDX)
- Renderizado via `MdxRunner` com `blogRegistry`
- Body text: Source Serif 4, 19px, line-height 1.7
- H2: 32px Fraunces, com linked anchor
- H3: 22px Fraunces, com linked anchor
- Blockquote: borda esquerda `--pb-accent`, bg `--pb-paper`, italic
- Code blocks: `--pb-paper2` bg, ShikiCodeBlock com botao "COPIAR"
- Links: `--pb-accent`, underline on hover
- Lists: custom bullet style
- Images/figures: full-width com caption opcional
- Callouts: bg diferenciado

### 11. Author Card (end of article)
- "SOBRE QUEM ESCREVEU" label
- Avatar maior (64px)
- Nome, role, bio (2-3 frases)
- Links: YouTube, GitHub, X, RSS — com arrow icon
- "mais textos de {nome} →" link
- Background: `--pb-paper`, border-radius 12px, padding 24px
- Dados: hardcoded por agora (sem `authors` table rich fields). Frontmatter ou JSON committed (`identity-profiles.ts` ja existe).

### 12. Tags / Marcadores
- "MARCADORES" label
- Tags como pills: border `--pb-line`, border-radius 20px, font-mono
- Dados: hardcoded por agora (sem tags table). Frontmatter: `tags: string[]`.

### 13. Comments (hardcoded)
- "Conversa · {n} comentarios" heading
- Textarea com placeholder "Deixe um comentario honesto (sem self-promo)"
- "Voce precisa entrar com email pra comentar" + botao "PUBLICAR"
- Lista de comentarios mockados: avatar, nome, "ha X dias", texto, like count, "responder"
- Respostas aninhadas com badge "RESPOSTA DO AUTOR" (bg: `--pb-accent`)
- Tudo hardcoded — sem backend de comentarios.

### 14. Series Navigation (condicional)
- "CONTINUA NA PROXIMA PARTE" card
- Titulo do proximo post da serie + excerpt
- Arrow → icon
- Background: `--pb-paper`
- Dados: frontmatter `series_next_slug`, `series_next_title`, `series_next_excerpt`. Se ausente, nao renderiza.

### 15. Newsletter CTA (contextual)
- "NEWSLETTER" label
- "Gostou? Recebe os proximos na caixa de entrada."
- Email input + botao "ASSINAR CADERNO DE {CATEGORIA}"
- Stats: "{n} leitores · {n}% open rate · cancelar e um clique"
- Cor do botao/accent: brand color da newsletter type mapeada pela categoria do post (Main=orange, Code=blue, etc.)
- Wired ao sistema de newsletter subscription existente.

### 16. Footnotes
- "NOTAS" label
- Lista numerada com conteudo das notas
- Back-reference arrow (↵) em cada nota para voltar ao ponto no texto
- **Hover popover (desktop):** ao hover sobre superscript no texto, popover tooltip aparece acima com conteudo da nota. Background: `--pb-paper2`, border: `--pb-line`, shadow, arrow pointer.
- **Tap (mobile):** expand inline abaixo do paragrafo.
- **Click:** scroll suave ate a nota na secao NOTAS.
- Dados: extraidos do MDX content via remark-gfm footnote syntax (`[^1]` inline, `[^1]: texto` no final). Requer `remark-footnotes` ou `remark-gfm` no pipeline `compileMdx`.

### 17. Colofao
- "COLOFAO" label
- Texto italico em `--pb-muted` descrevendo ferramentas usadas
- Dados: frontmatter `colophon: string`. Se ausente, nao renderiza.

### 18. Related Posts
- "Textos relacionados" heading + "Mais na mesma categoria · {categoria}" subtitle
- "Ver categoria →" link alinhado a direita
- Grid 3 colunas de WritingCards (estilo Pinboard com Paper+Tape)
- Cada card: cover image, category badge, date, titulo, reading time, tags
- Dados: ja existem via `getRelatedPosts()`.

### 19. Footer Nav
- "← voltar pra home · arquivo completo → · newsletters →"
- Centralizado, font-mono, links em `--pb-accent`

## Mobile (< 768px)

### Layout
- Single column, padding 16px
- Sidebars colapsam completamente
- Artigo ocupa 100% width

### Floating Action Buttons
- Dois FABs empilhados no canto inferior-direito:
  - **AI Reader** (topo): 44px circle, bg `--pb-paper`, icon sparkle
  - **TOC** (baixo): 44px circle, bg `--pb-accent`, icon hamburger
- FABs somem durante scroll ativo (hide on scroll-down, show on scroll-up)

### TOC Sheet
- Tap no FAB TOC abre bottom-sheet slide-up
- Conteudo: TOC items + Pontos-chave combinados
- Backdrop semi-transparente
- Drag-to-dismiss ou tap fora

### AI Reader
- Tap no FAB AI abre full-screen bottom-sheet
- Mesmas 3 tabs (TL;DR, Explain, Chat) mas layout vertical

### Share Buttons
- Movem para inline no Author Row (ja duplicados la)
- Sidebar share nao aparece em mobile

## AI Reader Drawer (Desktop)

### Trigger
- Floating button: canto inferior-direito, 48px circle
- Icon: sparkle (✨)
- Background: `--pb-paper`, border: `--pb-line`
- Hover: scale 1.05 + glow sutil

### Drawer
- Abre do lado direito, empurrando artigo para esquerda
- Largura: 320px
- Sidebar direita (pontos-chave) colapsa quando drawer abre
- Transicao: CSS transform 300ms ease
- Header: tabs TL;DR | Explain | Chat
- Background: `--pb-paper`

### Tabs (hardcoded)
- **TL;DR:** texto placeholder estatico resumindo o artigo
- **Explain:** "Selecione um trecho do artigo para explicar" + input desabilitado
- **Chat:** "Em breve — converse com o artigo" + input desabilitado com lock icon

### Tela 1024-1280px
- Drawer abre mas artigo fica com ~500px width — funcional mas apertado
- Considerar auto-close do drawer se width < 1024px

## Frontmatter Schema (novos campos)

```yaml
---
key_points:
  - "Um caderno, nao um produto"
  - "Ritmo sem rigidez"
tags:
  - meta
  - manifesto
  - "2026"
pull_quote: "um caderno, nao um produto"
pull_quote_attribution: "PROMESSA 3"
series_title: "Construindo em publico: o proprio projeto"
series_part: 1
series_total: 3
series_next_slug: "cms-para-governar-todos"
series_next_title: "Um CMS para governar todos"
series_next_excerpt: "A arquitetura por tras de publicar o mesmo post em seis sites diferentes..."
colophon: "Escrito em iA Writer numa MacBook Air M2. Publicado pelo CMS que eu mesmo construi..."
---
```

Validacao via Zod no `parseMdxFrontmatter()` existente. Campos opcionais — ausencia = secao nao renderiza.

## Text-Selection Highlights (localStorage)

### UX Flow
1. Usuario seleciona texto no artigo body
2. Tooltip flutuante aparece: botao "Destacar" (marker icon) + "Copiar"
3. "Destacar" salva o texto + offset no `localStorage` key `btf-highlights:{slug}`
4. Texto recebe `<mark class="btf-hl">` com gradient underline amarelo (`--pb-marker`)
5. Sidebar direita "SEUS DESTAQUES" lista os highlights salvos
6. Cada highlight tem botao X para remover
7. Click no highlight na sidebar scrolla ate o trecho no artigo

### Persistencia
- `localStorage` por slug: `btf-highlights:{locale}/{slug}`
- Schema: `Array<{ id: string, text: string, startOffset: number, endOffset: number, createdAt: string }>`
- Sem sync cross-device (feature futura com Supabase)
- Max 20 highlights por post

### Restauracao
- No mount do componente, ler localStorage e re-aplicar `<mark>` tags via Range API
- Graceful fallback: se offsets nao baterem (conteudo editado desde o highlight), descartar o highlight silenciosamente e remover do localStorage

## Fontes

### Novas (adicionar ao layout)
- **Source Serif 4** (400, 400i, 600) — body text do artigo. Google Fonts.

### Existentes (ja carregadas)
- Fraunces (headings)
- Inter (UI)
- Caveat (handwritten annotations)
- JetBrains Mono (code/meta)

## Componentes Novos

| Componente | Tipo | Arquivo |
|---|---|---|
| `ReadingProgressBar` | Client | `components/blog/reading-progress.tsx` |
| `TimeLeftPill` | Client | `components/blog/time-left-pill.tsx` |
| `PostToc` | Client | `components/blog/post-toc.tsx` |
| `PostKeyPoints` | Server | `components/blog/post-key-points.tsx` |
| `PostPullQuote` | Server | `components/blog/post-pull-quote.tsx` |
| `TextHighlighter` | Client | `components/blog/text-highlighter.tsx` |
| `HighlightsSidebar` | Client | `components/blog/highlights-sidebar.tsx` |
| `ShareButtons` | Client | `components/blog/share-buttons.tsx` |
| `AuthorRow` | Server | `components/blog/author-row.tsx` |
| `AuthorCard` | Server | `components/blog/author-card.tsx` |
| `SeriesBanner` | Server | `components/blog/series-banner.tsx` |
| `SeriesNav` | Server | `components/blog/series-nav.tsx` |
| `NewsletterCta` | Client | `components/blog/newsletter-cta.tsx` |
| `PostFootnotes` | Client | `components/blog/post-footnotes.tsx` |
| `FootnotePopover` | Client | `components/blog/footnote-popover.tsx` |
| `PostColophon` | Server | `components/blog/post-colophon.tsx` |
| `PostTags` | Server | `components/blog/post-tags.tsx` |
| `PostComments` | Server | `components/blog/post-comments.tsx` |
| `RelatedPostsGrid` | Server | `components/blog/related-posts-grid.tsx` |
| `CoverImage` | Server | `components/blog/cover-image.tsx` |
| `AiReaderButton` | Client | `components/blog/ai-reader-button.tsx` |
| `AiReaderDrawer` | Client | `components/blog/ai-reader-drawer.tsx` |
| `MobileTocSheet` | Client | `components/blog/mobile-toc-sheet.tsx` |
| `CopyLinkToast` | Client | `components/blog/copy-link-toast.tsx` |

## Componentes Modificados

| Componente | Mudanca |
|---|---|
| `page.tsx` (blog detail) | Reescrever layout para 3 colunas, integrar todos novos componentes, parse frontmatter extras |
| `blog-article-client.tsx` | Adicionar TextHighlighter wrapper, IntersectionObserver provider |
| `reader-pinboard.css` | Adicionar estilos Source Serif 4, footnote popover, highlight marks, progress bar segmentada |
| `globals.css` | Adicionar Source Serif 4 font import |
| `frontmatter.ts` | Adicionar `PostExtrasSchema` (Zod) separado do `SeoExtrasSchema` — campos editoriais (key_points, tags, pull_quote, series, colophon) nao sao SEO |

## Dados Hardcoded (sem backend por agora)

- **Engagement stats** (views, likes, bookmarks): numeros fixos renderizados no AuthorRow
- **Author bio/links**: dados do `identity-profiles.ts` existente
- **Comments**: array mockado de 5 comentarios com respostas aninhadas
- **Series**: dados do frontmatter (sem DB schema de series)
- **Tags**: dados do frontmatter (sem tags table)

## Fora de Escopo

- Backend de comentarios (DB schema, API, auth)
- AI Reader com Claude API real (apenas shell visual)
- Engagement counters reais (view tracking, likes, bookmarks)
- Text highlights sync cross-device
- Series management no CMS admin
- Tags management no CMS admin
