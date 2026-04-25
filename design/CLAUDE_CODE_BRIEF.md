# Brief para Claude Code — Página de Post (`bythiagofigueiredo`)

> **O que entregar:** uma página `/posts/[slug]` no projeto, fiel ao protótipo
> em React + HTML estático que está nos links abaixo. Não recriar a partir
> de screenshots: **leia o código-fonte primeiro**, replique a estrutura,
> tipografia, copy e comportamento descritos aqui.

---

## 0. Arquivos de referência (lê na íntegra antes de começar)

Baixa cada um destes URLs e usa como **fonte da verdade** para markup,
estilos, copy e lógica. Se algo aqui contradisser o código, o código vence.

| Arquivo | URL | O que tem |
|---|---|---|
| `post.html` | https://1b724620-1071-4eb8-97dd-a0ab1c551dec.claudeusercontent.com/v1/design/projects/1b724620-1071-4eb8-97dd-a0ab1c551dec/serve/post.html | Shell HTML, fontes, montagem React, painel de Tweaks |
| `post.jsx` | https://1b724620-1071-4eb8-97dd-a0ab1c551dec.claudeusercontent.com/v1/design/projects/1b724620-1071-4eb8-97dd-a0ab1c551dec/serve/post.jsx | Componente `PostPage` — toda a página |
| `shared.jsx` | https://1b724620-1071-4eb8-97dd-a0ab1c551dec.claudeusercontent.com/v1/design/projects/1b724620-1071-4eb8-97dd-a0ab1c551dec/serve/shared.jsx | Theme tokens, `Brand` (logo Marginalia), `PageHeader`, `Paper`, `Tape`, kit Pinboard |
| `ads.jsx` | https://1b724620-1071-4eb8-97dd-a0ab1c551dec.claudeusercontent.com/v1/design/projects/1b724620-1071-4eb8-97dd-a0ab1c551dec/serve/ads.jsx | **Os 7 slots de ad** — Marginalia, Anchor, Bookmark, Coda, Doorman, Bowtie, Sidekick |
| `ads-content.js` | https://1b724620-1071-4eb8-97dd-a0ab1c551dec.claudeusercontent.com/v1/design/projects/1b724620-1071-4eb8-97dd-a0ab1c551dec/serve/ads-content.js | `sponsors` (3) + `houseAds` (3 tipos: post/vídeo/newsletter) |
| `content.js` | https://1b724620-1071-4eb8-97dd-a0ab1c551dec.claudeusercontent.com/v1/design/projects/1b724620-1071-4eb8-97dd-a0ab1c551dec/serve/content.js | Posts, traduções (PT/EN), categorias, séries |
| `ai-reader.jsx` | https://1b724620-1071-4eb8-97dd-a0ab1c551dec.claudeusercontent.com/v1/design/projects/1b724620-1071-4eb8-97dd-a0ab1c551dec/serve/ai-reader.jsx | Drawer do "Ler com IA" |
| `hero-illustrations.jsx` | https://1b724620-1071-4eb8-97dd-a0ab1c551dec.claudeusercontent.com/v1/design/projects/1b724620-1071-4eb8-97dd-a0ab1c551dec/serve/hero-illustrations.jsx | Ilustrações de capa por categoria |

> ⚠️ **Não pule esta etapa.** O protótipo tem ~1500 linhas de comportamento
> que screenshots não capturam (dismissals, frequency caps, breakpoints,
> deep links, etc.). Lê o código.

---

## 1. Stack alvo

- Next.js 14 App Router (a menos que o repo já use outra coisa — segue o que existe).
- TypeScript.
- Componentes em React server + client conforme necessário (interatividade
  é cliente; markup estático pode ser server).
- Persistência: `localStorage` (mesmas chaves do protótipo, listadas abaixo).
- Sem CSS framework novo — o protótipo usa **inline styles + tokens de tema**.
  Pode portar pra CSS Modules ou Tailwind, mas mantém os mesmos valores
  exatos (cores hex, font-size, spacing, transforms).

---

## 2. Layout (3 colunas, responsivo)

```
┌───────────────────────────────────────────────────────────┐
│ Top strip (lang toggle PT/EN, 44px sticky)                │
├───────────────────────────────────────────────────────────┤
│ PageHeader (Brand "Marginalia" + nav + CTA newsletter)    │
├───────────────────────────────────────────────────────────┤
│ Reading progress bar (fixed, 3px, fill = accent color)    │
├───────────┬─────────────────────────────────┬─────────────┤
│  TOC      │  Article (max 720px, fonte      │  Key points │
│  sticky   │  Fraunces 21px serif)           │  + Anchor   │
│  ──       │  • Hero image (Paper + Tape)    │  ad sticky  │
│  Marginalia│  • Body blocks                  │  ──         │
│  ad       │  • Bookmark ad (mid-article)    │  Highlights │
│  (left)   │  • Bowtie / newsletter inline   │  panel      │
│           │  • Author card                  │             │
│           │  • Coda ad (after body)         │             │
│           │  • Series nav + related         │             │
│           │  • Comments mock                │             │
└───────────┴─────────────────────────────────┴─────────────┘
```

### Breakpoints (CSS — copie de `post.html`)

- `>= 1440px`: rails 220 / 760 / 260
- `>= 1080px`: rails 200 / 720 / 220
- `< 1080px`: 1 coluna, **rails escondidos**
- `< 960px`: idem, mas surge um Anchor inline mid-article

---

## 3. Sistema de Ads — leitura obrigatória de `ads.jsx`

Existem **7 tipos de slot**. Cada um tem um *trigger* (quando aparece),
uma posição e regras de dismissal. **Não invente novos slots; não mude as
posições.** A configuração default está em `post.jsx`:

```js
const adsCfg = {
  enabled: true,
  slots: {
    marginalia: true,
    anchor:     true,
    bookmark:   true,
    coda:       true,
    bowtie:     true,
    doorman:    false,   // off por default
  }
};
```

Cada flag corresponde a um Tweak no painel (vê seção 6).

### 3.1 Marginalia — barra esquerda
- **Posição:** dentro do `<aside>` esquerdo, **abaixo do TOC sticky**, separada por `border-top: 1px dashed`.
- **Conteúdo:** sempre **HOUSE** (rotaciona entre `houseAds.newsletter`, `houseAds.youtube`, `houseAds.relatedPost` por hash do slug — `pickHouse(2)`).
- **Comportamento:** click no `<a>` leva à `ad.url`. Tem botão `×` que esconde permanentemente (vê 3.8).
- **Trigger de exibição:** sempre que `slot.marginalia === true` E `adsConfig.enabled === true` E rails visíveis (≥ 1080px).
- **Visual:** label pill mono (`DA CASA · NEWSLETTER` etc.) na cor da marca, headline em Fraunces 13px medium, body em Source Serif 11px (primeira sentença apenas), CTA mono 10px na cor da marca, footer com `brand · tagline`.

### 3.2 Anchor — barra direita sticky
- **Posição:** dentro do `<aside>` direito, **abaixo do bloco "Pontos-chave"**, dentro do mesmo wrapper sticky (`position: sticky; top: 120px;`).
- **Conteúdo:** **SPONSOR** (rotaciona via `pickSponsor(1)`).
- **Mobile fallback:** quando rails colapsam (<960px), o **mesmo sponsor** aparece **inline no body** depois do penúltimo `h2` (índice `mobileInlineAfterIdx`). Esse fallback é controlado por `className="mobile-only-ad"` + media query — só visível < 960px.
- **Trigger:** `slot.anchor === true`.
- **Visual:** label pill cor-da-marca, mark SVG + brand + tagline, headline Fraunces 17px, body Source Serif 13px, CTA mono cor-da-marca com `border-top: 1px dashed`. Não tem CTA-button — o card todo é clicável.

### 3.3 Bookmark — papel colado mid-article
- **Posição:** **inline no fluxo do body**, exatamente *antes* do **2º `<h2>`** (transição entre seções, momento de pausa). Lógica em `post.jsx` ~linha 213:
  ```js
  const h2Indices = body.map((b,i) => b.type === 'h2' ? i : -1).filter(i => i >= 0);
  bookmarkAfterIdx = h2Indices.length >= 2 ? h2Indices[1] - 1
                    : h2Indices.length === 1 ? h2Indices[0] - 1
                    : Math.floor(body.length * 0.55);
  ```
  Renderiza o `<Bookmark/>` *imediatamente após* o bloco no índice `bookmarkAfterIdx`.
- **Conteúdo:** **SPONSOR** (`pickSponsor(2)`).
- **Visual:** scrap de papel `#F2EBDB`/`#FFFCEE` rotacionado `-0.2deg`, com **fita de masking tape** centralizada no topo. Label pill cor-da-marca prominente. Brand mark + brand line. Headline Fraunces 19px. CTA preto sólido `#1A140C`.
- **Frequency cap:** **1 Bookmark por post**. Se houver mobile-inline anchor no mesmo índice, o anchor é suprimido.

### 3.4 Coda — depois do corpo do artigo
- **Posição:** *depois* do `</article>` body, **antes** do author card final.
- **Conteúdo:** **HOUSE** (`pickHouse(0)`).
- **Visual:** card grande com `border: 2px solid line` + `border-top: 4px solid brandColor`. Mark à esquerda, headline Fraunces 26px medium, CTA-button cor-da-marca.
- **Trigger:** `slot.coda === true`.

### 3.5 Doorman — banner topo (OFF por default)
- **Posição:** **acima** do `<article>` hero. Banner full-width na cor da marca.
- **Conteúdo:** HOUSE (`pickHouse(0)`).
- **Comportamento de entrada:** mounta hidden (`opacity: 0; translateY(-10px)`), faz fade-in **300ms após mount**. Respeita `prefers-reduced-motion: reduce` (sem delay).
- **Trigger:** `slot.doorman === true`. **Default false** — só liga via Tweaks.

### 3.6 Bowtie — newsletter inline
- **Posição:** **substitui** o card "Newsletter" inline padrão depois do body, antes do Coda.
- **Conteúdo:** **sempre** `houseAds.newsletter` (não rotaciona).
- **Comportamento:** form com input email + submit. Submit intercepta `e.preventDefault()` e mostra estado "submitted" (mock). Tem `×` dismiss.
- **Visual:** card cor-da-marca sólido, rotacionado `-0.25deg`, com fita de masking tape no topo-esquerda.
- **Fallback:** se Bowtie estiver `false`, renderiza o card "Newsletter" hardcoded (vê `post.jsx` ~linha 880).

### 3.7 Sidekick (alias de Anchor)
- Componente exportado como alias para uso na home, **não usar no post.html**.

### 3.8 Dismissal (todos os slots)

```js
// localStorage key
"btf_ads_dismissed" → { "m_house-newsletter": 1729...,
                         "a_railway-ghost":   1729...,
                         "b_obsidian":        1729...,
                         "c_house-newsletter":1729...,
                         "d_...":             ...,
                         "bw_house-newsletter":...,
                       }
```

Prefixos: `m_` Marginalia, `a_` Anchor, `b_` Bookmark, `c_` Coda, `d_` Doorman, `bw_` Bowtie.

Hook `useDismissable(id)` retorna `[dismissed, dismiss]`. Se `dismissed === true`, o componente retorna `null`.

**Não há TTL** — uma vez dismissed, fica dismissed. (Pode adicionar reset depois; por enquanto persistente.)

### 3.9 Seleção determinística por slug

```js
let adH = 0;
for (let i = 0; i < post.slug.length; i++)
  adH = (adH * 31 + post.slug.charCodeAt(i)) | 0;
const pickSponsor = (offset = 0) =>
  sponsors[Math.abs(adH + offset) % sponsors.length];
const pickHouse = (offset = 0) =>
  house[Math.abs(adH + offset) % house.length];
```

**Por quê:** mesmo post sempre mostra os mesmos ads → reduz percepção de "rotação aleatória" e dá ao autor controle previsível (mexer offset = mexer todos os posts).

### 3.10 House ad rotation (Marginalia)

Após esta atualização, `houseAds` tem **3 itens**:
- `newsletter` → label `DA CASA · NEWSLETTER`, kind `newsletter`
- `youtube` → label `DA CASA · VÍDEO`, kind `video`
- `relatedPost` → label `DA CASA · POST`, kind `post` (ensaio relacionado)

A Marginalia rotaciona pelos 3, deterministicamente por slug. Não escolhas um único e fixe — **a rotação é a feature**: a barra lateral surfa diferentes tipos de conteúdo nosso.

---

## 4. Logo / Brand

Já está exportado como SVG no diretório `brand/` do protótipo. Para o repo
de produção, traz os arquivos:

- `brand/wordmark-light-bg.svg` — fundo claro
- `brand/wordmark-dark-bg.svg` — fundo escuro
- `brand/symbol-warm.svg`, `symbol-deep.svg` — só o asterisco
- `brand/monogram-light-bg.svg`, `monogram-dark-bg.svg` — selo TF
- `brand/favicon.svg`

O componente React `Brand` em `shared.jsx` é a versão *inline* (sem
dependência de SVG externo). Use ele no `<PageHeader>`. **Não usa
`<img src="logo.svg">`** — é JSX puro com `<svg>` inline pra que o
asterisco herde a cor de acento do tema (light/dark).

> Carrega Source Serif 4 nas paginas que usam `Brand`:
> ```html
> <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,300..700;1,300..700&display=swap" rel="stylesheet">
> ```

---

## 5. Tema (light/dark)

Tokens exatos em `shared.jsx → makePinboardTheme(dark)`:

```js
{
  bg:     dark ? "#14110B" : "#E9E1CE",
  paper:  dark ? "#2A241A" : "#FBF6E8",
  paper2: dark ? "#312A1E" : "#F5EDD6",
  ink:    dark ? "#EFE6D2" : "#161208",
  muted:  dark ? "#958A75" : "#6A5F48",
  faint:  dark ? "#6B634F" : "#9C9178",
  line:   dark ? "#2E2718" : "#CEBFA0",
  accent: dark ? "#FF8240" : "#C14513",
  yt:     "#FF3333",
  marker: "#FFE37A",
}
```

**Não inventes outras cores.** Se precisar de variação, deriva via `oklch()`
ou opacidade. A paleta é deliberadamente quente/papel.

---

## 6. Painel de Tweaks (modo dev/preview)

`post.html` expõe um painel de configuração via mensagens postMessage. **Em
produção isso provavelmente não vai pra deploy** — é ferramenta de
preview/QA. Implementa apenas se o repo já tiver mecanismo equivalente.

Configuração persiste em `localStorage` chave `btf_post`:
```json
{
  "lang": "pt" | "en",
  "theme": "light" | "dark",
  "ads": true,
  "ads_marginalia": true,
  "ads_anchor": true,
  "ads_bookmark": true,
  "ads_coda": true,
  "ads_doorman": false,
  "ads_bowtie": true
}
```

`PostPage` aceita prop `adsConfig` — se passada, sobrescreve defaults.

---

## 7. Comportamentos interativos (não pula nenhum)

### Reading progress bar
- Fixed `top: 102px`, height 3px, fill `accent`.
- Calcula via `scrollY / (article.scrollHeight - viewport)` clamp 0..1.
- **`time-left`** badge aparece quando rolagem > 10% — calcula minutos restantes baseado em `wordsPerMinute = 220`. Esconde quando rolagem > 95%.

### TOC ativa
- Cada `<h2>` e `<h3>` no body recebe `id` slugified.
- Ao rolar, marca o heading **mais próximo de `top: 200px`** como `activeH`.
- TOC entry com `activeH` ganha `border-left: 2px solid accent` e `font-weight: 600`.

### Texto selecionável → highlight + share
- `mouseup`/`touchend` no `#article-body` detecta seleção ≥ 4 chars.
- Mostra um mini-toolbar flutuante com 3 botões: **Highlight** (cor `marker`), **Compartilhar trecho** (copia `URL?q=<encoded>`), **Discutir** (abre AI drawer com query pré-preenchida).
- Highlights persistem em `localStorage` chave `btf_highlights_<slug>`. Renderizam como `<mark class="btf-hl">` no body. Click no mark abre menu pra remover.

### Share menu
- Botão `Compartilhar`. Abre dropdown com Twitter, LinkedIn, copiar link.
- "Copiar link" copia URL canônica e mostra toast 2s ("Copiado").

### "Ler com IA" drawer
- Botão sticky bottom-right. Abre drawer 380px à direita com chat.
- Usa `window.claude.complete(...)` (nosso protótipo). Em produção, troca por chamada real à API que o repo já usa.
- Estado em `localStorage` chave `btf_ai_<slug>`.

### Series nav
- Se `post.series` existe, mostra card "PARTE DA SÉRIE · X DE Y" com link pro post anterior/próximo.

### Footnotes
- `<sup class="fn" data-fn="...">` no body. Click expande footnote inline (não modal).

---

## 8. Conteúdo & i18n

`content.js → window.CONTENT`:
- `posts: { [slug]: post }` — cada post tem `title_pt`, `title_en`, `body_pt`, `body_en` (array de blocks), `cat`, `series`, `tags`, `cover`, `author`.
- `categories`, `series`, `ui` (traduções de UI).

A página atual lê `?slug=...` via `URLSearchParams`. **Para Next**, usa o
param dinâmico do route `app/posts/[slug]/page.tsx`.

---

## 9. Acessibilidade (não negociável)

- Focus rings: `outline: 2px solid accent; outline-offset: 3px`.
- Todos os botões e links navegáveis por teclado.
- AI drawer: `role="dialog"`, `aria-label`, esc fecha.
- Highlights: `role="mark"`.
- Reduce motion: nenhuma animação > 50ms se `prefers-reduced-motion: reduce`.
- Print styles (`@media print`) — copy de `post.html` linha ~165.

---

## 10. Checklist de aceite

Antes de PR, verifica todos:

- [ ] Header mostra "by Thiago Figueiredo *" (logo Marginalia)
- [ ] Lang toggle PT/EN funciona e persiste em `btf_post`
- [ ] Light/dark toggle funciona e persiste
- [ ] Reading progress bar enche com scroll, time-left aparece > 10%
- [ ] TOC sticky no left rail, item ativo destacado
- [ ] **Marginalia** ad aparece no left rail abaixo do TOC, mostra `DA CASA · NEWSLETTER` (ou VÍDEO/POST conforme slug)
- [ ] **Anchor** ad aparece no right rail, sticky abaixo de "Pontos-chave"
- [ ] **Bookmark** aparece exatamente *antes* do 2º h2 do post, com fita de masking tape
- [ ] **Bowtie** substitui o card de newsletter padrão, form com submit mock
- [ ] **Coda** aparece depois do body, antes do author card
- [ ] Doorman **OFF** por default, liga via tweaks e faz fade-in
- [ ] `×` em qualquer ad esconde permanentemente (testa F5)
- [ ] Mobile (<960px): rails colapsam, Anchor aparece inline no body
- [ ] Texto selecionado mostra mini-toolbar com 3 ações
- [ ] Highlights persistem após F5
- [ ] AI drawer abre/fecha, esc funciona
- [ ] Series nav se post tem `series`
- [ ] `prefers-reduced-motion` desliga as animações de entrada
- [ ] Print preview esconde TOC, AI drawer, ads → fica limpo pra PDF

---

## 11. O que NÃO fazer

- ❌ Não recriar a partir de screenshots — lê o código.
- ❌ Não inventar slots novos de ad — são exatamente 7.
- ❌ Não trocar a paleta — os hex estão lá em `shared.jsx`.
- ❌ Não usar `Inter` para títulos do body — é **Fraunces** serif.
- ❌ Não animar o Bookmark com hover transforms grandes — é discreto.
- ❌ Não esquece o `localStorage` — sem persistência, dismiss é inútil.
- ❌ Não esquece o mobile-inline anchor — sem ele, mobile fica sem ad principal.

---

## 12. Ordem sugerida de implementação

1. Theme tokens + Brand (logo) + PageHeader.
2. Layout 3-col + breakpoints + sticky TOC + progress bar.
3. Render do body (blocks → componentes).
4. Lang toggle + theme toggle + persistence.
5. Os 7 ad slots, um de cada vez, com dismissal funcionando.
6. Texto selecionável → highlight + share + AI.
7. Series nav, related, comments mock, author card, colophon.
8. Print styles + reduce-motion.
9. Smoke test no checklist.

Boa sorte.
