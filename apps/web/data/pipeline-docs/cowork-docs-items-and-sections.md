# Pipeline Section Content Reference — Cowork AI

Reference for Claude Cowork when generating or updating pipeline section content.
All content is delivered as JSON via the batch-sections or individual section PATCH API.

---

## API Contract

### Version header (IMPORTANT)

Use `X-Expected-Version` for optimistic locking. **Do NOT use `If-Match`** — Vercel's CDN
intercepts `If-Match` as a standard HTTP conditional request header and returns its own 412
before the request reaches the API.

```
X-Expected-Version: <number>   ← from GET response meta.item_version
```

### Section update payload

Each section update sends:
```json
{
  "item_id": "uuid",
  "section": "section_key_lang",    // e.g. "roteiro_pt", "publish_en", "ideia_shared"
  "lang": "pt" | "en",
  "content": { ... },               // Section-specific JSON below
  "source": "cowork",
  "modified_by": "cowork-claude"
}
```

Shared sections (`ideia`, `brolls`, `images`) use key suffix `_shared`.
Language-specific sections use `_pt` or `_en`.

### Concurrency & validation (IMPORTANT)

| Operation | Endpoint | Version control | Body requirements |
|-----------|----------|-----------------|-------------------|
| Item PATCH | `PATCH /items/:id` | `X-Expected-Version: <item.version>` header (409 on mismatch) | full-object replace for `format_metadata` |
| Single-section PATCH | `PATCH /items/:id/sections/:section` | `X-Expected-Version: <item.version>` header **AND** section `rev` in the body | `{ content, rev, source?, modified_by? }` — 409 on mismatch of either |
| Batch sections | `POST /items/batch-sections` | **no version header** | `{ updates: [{ item_id, section, lang, content, source }] }` (1–50 updates) |

**Section content is NOT validated by the API.** The API stores whatever JSON you send. The shapes documented in this file (e.g. `IdeiaSectionSchema`, `RoteiroContentV3`, `PosBriefSchema`, `ABDraftSchema`) are the **contract** — emit them exactly. A malformed shape will not 4xx; it will simply render wrong (or be silently migrated/ignored) in the CMS.

### Leia ANTES de escrever (obrigatório)

**Todo PATCH precisa da versão atual do item.** Todo PATCH de **seção única** precisa, além disso, do `rev` da seção. Esses números mudam a cada escrita — **Cowork DEVE fazer um GET imediatamente antes de cada PATCH** e copiar os valores de lá. Sem isso, a primeira escrita leva 409/412.

**De onde vem cada valor:**

| GET | Retorna | Usar como |
|-----|---------|-----------|
| `GET /items/:id/sections/:section?lang=pt` | `meta.item_version` | header `X-Expected-Version` |
| `GET /items/:id/sections/:section?lang=pt` | `data.rev` | body `rev` |
| `GET /items/:id` | `meta.version` | header `X-Expected-Version` (para PATCH de item / `format_metadata` / `stage`) |

> **Atenção à chave:** o GET de **item** expõe a versão como `meta.version`; o GET de **seção** expõe a mesma versão como `meta.item_version` (mesmo valor, chave diferente). Use `meta.item_version` ao escrever uma seção e `meta.version` ao escrever o item.

**Exemplo completo (PATCH de uma seção):**

1. `GET /items/<id>/sections/roteiro?lang=pt` → resposta `{ "data": { "rev": 4, ... }, "meta": { "item_version": 12, ... } }`
2. Extraia `item_version = 12` e `rev = 4`.
3. `PATCH /items/<id>/sections/roteiro?lang=pt` com header `X-Expected-Version: 12` e body:
   ```json
   { "content": { ... }, "rev": 4, "source": "cowork", "modified_by": "cowork-claude" }
   ```

> **Seção nova que nunca existiu:** o GET retorna `data: null` (ou `meta.exists: false`). Nesse caso o `rev` do body é **`0`** (`rev: 0`). A primeira escrita cria a seção com `rev: 1`.

---

## Formatação Rich Text (Tiptap)

Todas as seções de texto renderizam conteúdo via editor Tiptap. Envie **markdown** no campo string — ele é convertido automaticamente para rich text (`marked.parse()` → Tiptap HTML → JSONContent).

### Preset `full` (usado por: `draft`)

| Markdown | Renderização |
|----------|-------------|
| `## Título` | H2 — com borda-esquerda accent e fundo gradiente |
| `### Subtítulo` | H3 — mesmo estilo, menor |
| `#### Seção` | H4 — uppercase, tracking, cor dim |
| `**negrito**` | Texto bold com cor destaque |
| `*itálico*` | Texto itálico |
| `~~tachado~~` | Texto riscado |
| `- item` | Lista com bullet |
| `1. item` | Lista numerada |
| `- [ ] task` | Checklist interativa |
| `> citação` | Blockquote com borda accent e fundo gradiente |
| `` `código` `` | Inline code com fundo accent |
| ` ```bloco``` ` | Code block com fundo escuro e borda |
| `[texto](url)` | Link com cor accent e underline |
| `---` | Divisor horizontal |

| `![alt](url)` | Imagem responsiva com lazy loading |

Extensões adicionais (sem sintaxe markdown — disponíveis via toolbar na UI): underline, text align, highlight, callout, toggle, tabela (3×3 com header), colunas (layout 1:1), embeds (YouTube, Twitter, Instagram, CodeSandbox, CodePen, GitHub).

**Embeds:** cada provider tem botão dedicado na toolbar. O nó insere com URL vazia e exibe input inline para o usuário colar o link. Ao gerar conteúdo com embeds, recomende ao criador usar o botão correspondente na toolbar — não há sintaxe markdown para embeds.

### Preset `compact` (usado por: `ideia.body`, seções genéricas de texto)

| Markdown | Renderização |
|----------|-------------|
| `### Subtítulo` | H3 |
| `#### Seção` | H4 |
| `**negrito**` | Bold |
| `*itálico*` | Itálico |
| `~~tachado~~` | Strikethrough |
| `- item` | Lista com bullet |
| `1. item` | Lista numerada |
| `> citação` | Blockquote |
| `` `código` `` | Inline code |
| ` ```bloco``` ` | Code block |
| `[texto](url)` | Link |
| `---` | Divisor horizontal |

Sem H2, sem underline, sem task lists, sem callout/toggle, sem text align, sem highlight.

### Recomendação para geração de conteúdo

- Use markdown nos campos `body` (ideia), `draft`, e `content` (newsletter) — será renderizado como rich text
- Em `draft` (full): estruture com `##`, `###`, `####` para criar hierarquia visual com headings estilizados
- Em `ideia.body`, `content` (newsletter) e genéricos (compact): use `###`, `####` — H2 não é suportado no preset compact
- Use blockquotes para citações ou destaques
- Use listas para pontos-chave
- Quando o conteúdo já foi salvo como JSONContent (Tiptap AST), envie JSONContent — não reconverta para markdown

---

## Section: `ideia` (sharedness depends on format)

> **Per-format sharedness (IMPORTANT — drives the section key):**
> - **video** → ideia is **PER-LANGUAGE**. `FORMAT_SHARED_SECTIONS.video` is empty, so the key is `ideia_pt` / `ideia_en` (one per language). The video shape is `IdeiaSectionSchema` (`.strict()`) documented immediately below — it is NOT the `{premise, body, …}` shape.
> - **blog_post / newsletter / course / campaign** → ideia is **SHARED** → key is `ideia_shared`. These use the `{premise, body, angle, vvs, cross_refs}` shape documented further below.
>
> Pick the shape by the item's `format`. Sending the blog `{premise,…}` shape to a video ideia will be **rejected by `.strict()`** (unknown keys), and vice-versa.

### VIDEO ideia (`ideia_pt` / `ideia_en`) — `IdeiaSectionSchema` (`.strict()`)

```json
{
  "title": "Por que saí do Canadá depois de 4 anos",
  "direction": "Ensaio confessional em primeira pessoa. Abrir com a virada emocional (nunca me senti em casa), depois reconstruir a linha do tempo até a decisão de voltar. Tom íntimo, sem dramatização.",
  "siblings": [
    "Investigação fria: dados de custo de vida + impostos que tornaram a permanência insustentável.",
    "Carta para quem está saindo do Brasil: o que eu queria ter sabido antes de emigrar."
  ],
  "logline": "Um relato honesto sobre por que 4 anos no exterior terminaram numa passagem de volta — e o que isso ensina sobre pertencimento.",
  "angles": "Frontal + B-Roll",
  "framework": "Hook → Conflito → Reviravolta → CTA"
}
```

| Campo | Tipo | Notas |
|-------|------|-------|
| `title` | string ≤500 | Título de trabalho da ideia |
| `direction` | string ≤4000 | **A direção criativa ATIVA** — a abordagem atualmente escolhida para o vídeo |
| `siblings` | string[] ≤20 (cada ≤500) | **As direções ALTERNATIVAS** — o editor pode trocar uma delas para o campo `direction` |
| `logline` | string ≤1000 | Frase-resumo do vídeo |
| `angles` | string ≤200 | Enquadramentos/ângulos planejados |
| `framework` | string ≤200 | Estrutura narrativa (Hook → … → CTA) |

> Produção (pilar, faixa de duração, data de gravação) **NÃO** vive aqui — vive em `format_metadata` (ver "Video — format_metadata").

#### Direction-swap (como dar "3 novas direções" ou trocar a ativa)

- **"Me dá 3 novas direções"** → escreva 3 strings em `siblings` (pode manter `direction` como está, ou esvaziá-la se ainda não há uma ativa).
- **"Use a direção 2"** / definir a direção ativa → mova o texto escolhido para `direction` **e** mova a `direction` anterior de volta para `siblings` (nada se perde). `siblings` = pool de alternativas; `direction` = a escolhida.

Exemplo de swap (promover sibling[0] e arquivar a antiga):
```json
{
  "title": "Por que saí do Canadá depois de 4 anos",
  "direction": "Investigação fria: dados de custo de vida + impostos que tornaram a permanência insustentável.",
  "siblings": [
    "Ensaio confessional em primeira pessoa. Abrir com a virada emocional, depois reconstruir a linha do tempo.",
    "Carta para quem está saindo do Brasil: o que eu queria ter sabido antes de emigrar."
  ],
  "logline": "Um relato honesto sobre por que 4 anos no exterior terminaram numa passagem de volta.",
  "angles": "Frontal + B-Roll",
  "framework": "Hook → Conflito → Reviravolta → CTA"
}
```

---

### BLOG / NEWSLETTER / COURSE / CAMPAIGN ideia (`ideia_shared`)

```json
{
  "premise": "Uma frase que resume a ideia do conteúdo",
  "body": "Descrição expandida com contexto, motivação e proposta de valor.\n\n### Contexto\n\nTexto com **destaques** e [links](https://example.com).\n\n- Ponto A\n- Ponto B",
  "angle": "Ângulo editorial ou gancho estratégico",
  "vvs": 85,
  "cross_refs": [
    { "code": "VID-042", "title": "Vídeo relacionado", "note": "Conexão temática" }
  ]
}
```

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `premise` | string | sim | Frase-chave da ideia (contentEditable, sem markdown) |
| `body` | string (markdown) | sim | Renderizado via Tiptap preset `compact` — use markdown |
| `angle` | string | não | Ângulo editorial |
| `vvs` | number 0-100 | não | Score de viabilidade |
| `validated_at` | ISO datetime | não | Preenchido quando validada |
| `cross_refs` | CrossRef[] | não | Referências cruzadas |

---

## Section: `draft` (per-lang) — Rascunho

Renderer dedicado: `DraftRenderer` com `PipelineEditor preset="full"`.

Formato preferido — markdown puro como string:
```json
"## Introdução\n\nParágrafo inicial com **destaque** e contexto.\n\n### Desenvolvimento\n\nTexto expandido com:\n\n- Argumento 1\n- Argumento 2\n\n> Citação relevante para o tema.\n\n### Conclusão\n\nFechamento com call-to-action."
```

Formato alternativo — wrapper object (quando há SEO legado):
```json
{
  "body": "## Introdução\n\nParágrafo inicial..."
}
```

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `body` | string (markdown) | sim | Conteúdo principal — renderizado via Tiptap `full` preset |
| `seo` | object \| null | não | Se presente, exibe warning pedindo migração para aba SEO |

**Formatos aceitos para `content`:**
- String markdown → convertido automaticamente para rich text
- JSONContent (`{ type: "doc", content: [...] }`) → renderizado direto pelo Tiptap
- Object com `{ body, seo }` → `body` renderizado, `seo` gera warning

**Dica:** Use a formatação completa do preset `full` (H2-H4, listas, blockquotes, code blocks, checklist, imagens, tabelas). O DraftRenderer exibe um outline de seções quando há 2+ headings no conteúdo. Para embeds e colunas, oriente o criador a usar os botões dedicados na toolbar.

### Placeholders de imagem no draft

Ao gerar o draft, insira placeholders de imagem usando markdown padrão com o `ref_id` como prefixo do alt text. Esses placeholders são detectados automaticamente pelo editor e exibidos como cards interativos com botões "Upload" e "Buscar", permitindo ao criador substituir pela imagem real.

**Formato do placeholder:**
```markdown
![img-cover: Descrição da imagem de capa](https://placehold.co/1200x675/1a1a2e/e2e8f0?text=COVER)
```

**Para imagens no corpo:**
```markdown
![img-1: Descrição da primeira imagem](https://placehold.co/800x450/1a1a2e/e2e8f0?text=IMG-1)
![img-2: Descrição da segunda imagem](https://placehold.co/800x450/1a1a2e/e2e8f0?text=IMG-2)
```

**Regras:**
- O prefixo DEVE seguir o formato `img-<ref_id>:` (e.g., `img-cover:`, `img-1:`, `img-2:`)
- O `ref_id` DEVE corresponder ao `ref_id` definido na seção `images_shared` (`body_images[].ref_id`)
- A URL placeholder DEVE usar `placehold.co` — o editor detecta este domínio como placeholder
- A descrição após o `:` é exibida no card de placeholder para contexto do criador
- Quando o criador seleciona uma imagem real, a URL do placeholder é substituída automaticamente
- Placeholders de cover usam `1200x675` (16:9), body images usam `800x450`

**Posicionamento:** Coloque os placeholders no local exato onde a imagem deve aparecer no conteúdo final. O `placement` na seção `images_shared` documenta a posição semântica, mas a posição real é definida pelo placeholder no draft.

---

## Section: `roteiro` (per-lang) — `RoteiroContentV3`

**Modelo CANÔNICO = v3.** Roteiros v1/v2 antigos são auto-migrados na leitura (`readRoteiro`), mas **Cowork DEVE emitir v3 nativamente** — nunca o `{number,label,text+tags,status}` v2 nem a "Tag Syntax" antiga. Não existem mais os statuses `DRAFT`/`REVIEW`/`APPROVED`; status de beat é apenas `PENDING` | `DONE`.

```json
{
  "version": 3,
  "meta": {
    "canal": "YouTube",
    "formato": "Vlog / Ensaio",
    "angulos": "Frontal + B-Roll",
    "duracao": "12-15 min",
    "framework": "Hook → Problema → Solução → CTA",
    "fonte_vvs": "VID-042"
  },
  "beats": [
    {
      "idx": 0,
      "name": "Hook — Abrir com vulnerabilidade",
      "status": "PENDING",
      "duration": 24,
      "tone": "Calmo, próximo da câmera, sem drama",
      "script": [
        { "type": "line", "text": "Eu morei quatro anos no Canadá e nunca me senti em casa.", "key": true },
        { "type": "pause", "duration": 0.8 },
        { "type": "line", "text": "E demorei pra admitir o porquê." },
        { "type": "vis", "text": "Close-up, profundidade rasa, luz natural suave; montagem de fotos do apartamento vazio" },
        { "type": "ed", "text": "Mic lav/fone + anti-vento · power bank · 30GB+ livres no cartão" }
      ]
    }
  ]
}
```

### Estrutura

| Campo | Tipo | Notas |
|-------|------|-------|
| `version` | literal `3` | **Obrigatório** — marca v3 |
| `meta.canal` | string? | Canal (ex. "YouTube") |
| `meta.formato` | string? | Formato editorial |
| `meta.angulos` | string? | Ângulos/enquadramentos |
| `meta.duracao` | string? | Duração-alvo textual (ex. "12-15 min") |
| `meta.framework` | string? | Estrutura narrativa |
| `meta.fonte_vvs` | string? | Origem da ideia |
| `beats[].idx` | int ≥0 | Índice 0-based, sequencial |
| `beats[].name` | string (min 1) | Nome do beat |
| `beats[].kind` | `fala` \| `acao` \| `prep` \| `editor` (opcional, ASCII `acao` — **nunca** `ação`) | **Define o que o talento FAZ com o beat na gravação** e em qual "pista" ele renderiza: `fala`=falas no teleprompter (fluxo de leitura do ator); `acao`=ações on-camera em **checklist** (entrevistas, captações — o ator vê e marca); `prep`=logística pré-gravação (kit, timeline de captação, must-gets) → colapsa na faixa **"Antes de gravar"**, **ESCONDIDA do fluxo de leitura do performer** e **fora do contador de fala**; `editor`=cobertura dirigida ao editor (shot-list de b-roll, planos visuais) → roteado para o **editor (Pós)** e **escondido do performer**. **Ausente → inferido pelo NOME do beat** (heurística de fallback). **Explícito SEMPRE vence** → ao escrever via API, **defina `kind` explicitamente** e não dependa do nome. |
| `beats[].status` | `PENDING` \| `DONE` | Default `PENDING` |
| `beats[].duration` | int ≥0 (s)? | Duração-alvo do beat em segundos |
| `beats[].tone` | string? | Direção de performance/tom do beat inteiro |
| `beats[].script` | ScriptLine[] | Linhas do beat (união discriminada por `type`) |

### `script[]` — união discriminada por `type`

| `type` | Forma | Significado |
|--------|-------|-------------|
| `line` | `{ "type":"line", "text": string, "key"?: boolean }` | **FALADO para a câmera** — o teleprompter; exatamente o que o host lê em voz alta. `key:true` marca um momento-âncora/chave. Só conta no relógio de fala dentro de um beat `kind:'fala'`. |
| `action` | `{ "type":"action", "text": string, "key"?: boolean }` | **AÇÃO on-camera que o talento EXECUTA** (não lê) — prompt de entrevista, algo a captar, "abordar o atendente", "filmar o painel de preços". Renderizado como item de **checklist** dentro de um beat `kind:'acao'` (o performer vê e marca). **NÃO conta como tempo de fala.** `key:true` marca uma ação-âncora. |
| `pause` | `{ "type":"pause", "duration": number }` | Pausa/respiro cronometrado, em segundos (0–30). |
| `vis` | `{ "type":"vis", "text": string }` | **Cue de B-roll / visual** — mostrado ao editor, **NÃO é falado**. |
| `ed` | `{ "type":"ed", "text": string }` | **Nota só do editor** — escondida atrás do toggle "Notas do editor". **NÃO é falada, NÃO aparece no teleprompter.** |
| `dir` | `{ "type":"dir", "text": string }` | Direção de performance (forward-compat — **não renderiza nada no editor hoje**; escreva o tom em `beat.tone`). |

> **Cadência de leitura ≈ 2.1 palavras/seg.** Estimativa de duração de um beat ≈ `ceil(palavras_em_lines / 2.1 + soma(pause.duration))`. Só linhas `line` (dentro de um beat `kind:'fala'`) contam palavras.

> **Freeze:** `PATCH /sections/roteiro` retorna **HTTP 403** quando o stage do vídeo está em ≥ `scheduled`/`published` (`ideia`/`roteiro`/`postprod`/`publish` ficam read-only). Para consertar um roteiro já publicado, dê **`POST /items/:id/retreat`** primeiro — ou edite antes de publicar. (Detalhe em **Published-freeze**, abaixo.)

### REGRA: Como consertar um roteiro poluído (via API) — **é BEAT-LEVEL**

**O mecanismo-chave.** O roteiro é o palco do ATOR: o que Thiago **fala** e **faz** diante da câmera. Logística e cobertura de editor não devem competir com as falas. Quem decide em que pista um beat renderiza é **`beat.kind`** — não os tipos dos itens dentro dele. Para consertar um roteiro onde a logística aparece como fala, **mude o `kind` do BEAT**:

| Conteúdo do beat | `kind` a definir | O que mais fazer nos itens |
|------------------|------------------|----------------------------|
| KIT / equipamento / timeline / cronograma / must-gets | `'prep'` | passe a logística para `{type:'ed'}` |
| b-roll / shot-list / cobertura / planos visuais | `'editor'` | cues visuais como `{type:'vis'}` / `{type:'ed'}` |
| entrevista / captação / abordagem / prompts on-camera | `'acao'` | **converta os prompts de `{type:'line'}` para `{type:'action'}`** |
| beat genuinamente falado | `'fala'` (ou deixe ausente) | as falas ficam em `{type:'line'}` |

> ⚠️ **Só re-tipar os itens `line→ed` dentro de um beat NÃO basta** — se o beat continuar sem `kind`, ele permanece no fluxo do ator e ainda polui o contador de fala. **Mude o `kind` do BEAT.** O `kind` explícito sempre vence a inferência pelo nome; ao escrever via API, nunca confie na heurística do nome — declare `kind`.

### REGRA: "Falado vs Notas do editor" (ainda válida DENTRO de um beat `fala`)

O teleprompter mostra **apenas** as linhas `line`. Tudo que não é a fala literal do host tem um tipo próprio:

- **`line`** — SOMENTE as palavras exatas que o host diz para a câmera.
- **`ed`** — equipamento / kit / logística / timeline de captação / planejamento de shots. Nunca é falado.
- **`vis`** — cue de b-roll / visual (o que o editor deve mostrar).
- **`beat.tone`** — performance / tom / energia / postura (**canal primário** — escreva o tom aqui, no campo `tone` do beat, para ele aparecer no editor). `dir` dentro de `script[]` existe por forward-compat e **não renderiza nada no editor hoje** — prefira `beat.tone`.
- **`pause`** — silêncios cronometrados.

#### Teste rápido (SMELL TEST) — por item de `script[]`:

> **"O host abriria a boca e diria isto, palavra por palavra, pra câmera?"**
> - **Sim** → `line`.
> - **Não** (equipamento, horário, GB, arquivo, cartão, bateria, timecode, ou qualquer "mostrar/montagem/close/tela") → **NUNCA** `line` — vai pra `ed` (logística/kit) ou `vis` (visual).

**Exemplos de reclassificação (texto realista):**

```json
{ "type": "ed",   "text": "Mic lav/fone + anti-vento · power bank · 30GB+ livres no cartão" }
```
→ é kit/equipamento, logística → `ed` (nunca `line`).

```json
{ "type": "ed",   "text": "6:15 chega → grava HOOK | 6:30–7:50 entrevistas | 8:00 b-roll da praça" }
```
→ é uma timeline de captação/planejamento → `ed`.

```json
{ "type": "line", "text": "Eu morei quatro anos no Canadá e nunca me senti em casa.", "key": true }
```
→ é uma frase de hook realmente falada para a câmera → `line` com `key:true`.

```json
{ "type": "vis",  "text": "Montagem de fotos do apartamento vazio, Ken Burns lento" }
```
→ é o que o editor deve mostrar, não algo dito → `vis`.

#### Beat sem `line` depois de separar as notas → ESCREVA a fala que faltava

**Se o beat ficou sem nenhuma `line` depois de separar as notas, ESCREVA a fala que faltava.** Um beat existe pra ser falado; as notas (`ed`/`vis`/`dir`) são suporte, não substituem a fala. Só deixe um beat sem `line` se ele for genuinamente 100% B-roll sem narração (raro). Na dúvida, escreva a fala — **"conserte este roteiro" = transformar notas em fala, não só re-etiquetar.**

#### Exemplo completo BEFORE → AFTER (note-blob → falas + notas tipadas)

**ANTES (errado — bloco de notas todo enfiado como `line`):** o beat virou uma pilha de logística e lembretes marcados como fala, e a única intenção de fala ("abrir falando da mudança") ficou perdida como mais uma nota.

```json
{
  "idx": 0,
  "name": "Hook",
  "status": "PENDING",
  "script": [
    { "type": "line", "text": "Mic lav/fone + anti-vento · power bank · 30GB+ livres no cartão" },
    { "type": "line", "text": "6:15 chega → grava HOOK | 6:30 entrevistas | 8:00 b-roll" },
    { "type": "line", "text": "abrir falando da mudança" },
    { "type": "line", "text": "montagem de fotos do apartamento vazio" }
  ]
}
```

**DEPOIS (certo — logística vira `ed`, visual vira `vis`, tom vai pra `beat.tone`, e a intenção "abrir falando da mudança" vira uma `line` ESCRITA, com `key:true`):**

```json
{
  "idx": 0,
  "name": "Hook",
  "status": "PENDING",
  "tone": "Calmo, próximo da câmera, sem drama",
  "script": [
    { "type": "ed",   "text": "Mic lav/fone + anti-vento · power bank · 30GB+ livres no cartão" },
    { "type": "ed",   "text": "6:15 chega → grava HOOK | 6:30 entrevistas | 8:00 b-roll" },
    { "type": "line", "text": "Há quatro anos eu fiz uma mudança que mudou tudo — e quase não contei pra ninguém.", "key": true },
    { "type": "vis",  "text": "Montagem de fotos do apartamento vazio, Ken Burns lento" }
  ]
}
```

Repare que `"abrir falando da mudança"` **não** virou um `ed` — era uma instrução para ESCREVER a fala, então virou uma `line` autoral de verdade. A logística (`Mic…`, `6:15…`) virou `ed`; a `montagem de fotos` virou `vis`; o tom virou `beat.tone`.

**Reclassificação obrigatória:** um beat que é "quase só notas e quase nenhuma fala" está modelado errado — separe: o equipamento/logística/timeline vira `ed`, os cues visuais viram `vis`, o tom vira `beat.tone`, e **as frases ditas para a câmera viram `line`s** (escrevendo a fala se ela não existia). Não enfie fala dentro de `ed`/`vis`, nem deixe um beat falável sem `line`.

#### Exemplo via API — beat KIT: BEFORE → AFTER (mude o `kind` do BEAT)

Um beat de KIT/equipamento renderizado como fala. O conserto **não** é só re-tipar os itens — é declarar **`"kind":"prep"`** no beat (ele sai do fluxo do ator, colapsa em "Antes de gravar" e some do contador de fala) e passar a logística para `ed`.

**ANTES (errado — sem `kind`, logística como `line` → polui o teleprompter e o contador):**

```json
{
  "idx": 2,
  "name": "KIT de gravação",
  "status": "PENDING",
  "script": [
    { "type": "line", "text": "Mic lav/fone + anti-vento · power bank · 30GB+ livres no cartão" },
    { "type": "line", "text": "6:15 chega → grava HOOK | 6:30 entrevistas | 8:00 b-roll" },
    { "type": "line", "text": "Must-gets: fachada, fila, painel de preços" }
  ]
}
```

**DEPOIS (certo — `"kind":"prep"` no BEAT + logística como `ed`):**

```json
{
  "idx": 2,
  "name": "KIT de gravação",
  "status": "PENDING",
  "kind": "prep",
  "script": [
    { "type": "ed", "text": "Mic lav/fone + anti-vento · power bank · 30GB+ livres no cartão" },
    { "type": "ed", "text": "6:15 chega → grava HOOK | 6:30 entrevistas | 8:00 b-roll" },
    { "type": "ed", "text": "Must-gets: fachada, fila, painel de preços" }
  ]
}
```

#### Mini-exemplo via API — beat de ENTREVISTA → `"kind":"acao"` com `{type:"action"}`

Beat de captação/entrevista: os prompts não são lidos, são **executados** → `"kind":"acao"` no beat e prompts como `{type:"action"}` (viram checklist; não contam tempo de fala).

```json
{
  "idx": 4,
  "name": "Entrevistas na feira",
  "status": "PENDING",
  "kind": "acao",
  "script": [
    { "type": "action", "text": "Abordar 3 feirantes — perguntar há quanto tempo trabalham ali", "key": true },
    { "type": "action", "text": "Captar a reação de um cliente ao preço" },
    { "type": "vis", "text": "Inserts da movimentação da feira ao fundo" }
  ]
}
```

> **Por que isso importa:** o teleprompter mostra só `line`. Além disso, **só `line` conta no contador "X/Y faladas" e na estimativa de tempo de fala** — uma nota tipada como `line` infla esses números e quebra o progresso de leitura. E o tom escrito em `dir` dentro de `script[]` não renderiza no editor hoje (use `beat.tone`), senão a direção de tom simplesmente some.

---

## Section: `brolls` (shared)

```json
{
  "items": [
    {
      "description": "Montagem de fotos da família no parque",
      "clip_name": "familia-parque-01",
      "beat": "3",
      "type": "footage",
      "timestamp": "02:30",
      "priority": "high",
      "note": "Usar filtro warm",
      "effect": "ken-burns slow zoom",
      "captured": false
    }
  ],
  "thumbnail_concepts": [
    { "label": "Opção A — Close face + texto", "layout": "Face centered, bold text overlay top-right" }
  ],
  "style_guide": {
    "color_grade": "Warm, desaturated",
    "transitions": "Dissolve + jump cut mix"
  },
  "source_docs": "Referência: pasta Drive /Projeto-X/B-Rolls"
}
```

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `items[].description` | string | sim | O que o clip mostra |
| `items[].captured` | boolean | sim | Se já foi gravado/coletado |
| `items[].type` | string | não | `footage`, `photo`, `screen_recording`, `stock` |
| `items[].priority` | string | não | `high`, `medium`, `low` |
| `thumbnail_concepts` | array | não | Conceitos de thumbnail |
| `style_guide` | Record | não | Chave-valor livre |

### Formato alternativo: `shots[]` (compatível)

O renderer também aceita `shots[].items[]` agrupados por beat — são convertidos
automaticamente para `items[]` flat com `captured: false`. Preferir `items[]` canônico
para controle individual de `captured`.

```json
{
  "shots": [
    {
      "beat": "1",
      "timeline": "00:00-00:45",
      "items": [
        { "description": "Close-up rosto", "priority": "high" },
        { "description": "B-Roll parque", "effect": "ken-burns" }
      ]
    }
  ]
}
```

---

## Section: `postprod` (per-lang) — `PosBriefSchema` (CANONICAL: `kind:'brief'`)

The canonical `postprod` shape is a **lightweight brief for the editor** — `PosBriefSchema` (`.strict()`). It is NOT a multi-track timeline. Cowork writes a `kind:'brief'` object:

```json
{
  "kind": "brief",
  "deliverables": {
    "editor": "Equipe externa / você mesmo",
    "deadline": "2026-07-10",
    "turnaround": "5 dias úteis",
    "drive": "/Projeto-Canada/EDIT",
    "energy": "Íntima na abertura, sobe no meio, calma no CTA",
    "references": [
      "https://youtu.be/exemplo-ritmo",
      "Color grade quente, levemente dessaturado"
    ]
  },
  "style": [
    { "k": "Color grade", "v": "Warm, levemente dessaturado" },
    { "k": "Transições", "v": "Dissolve + jump cut mix" },
    { "k": "Legendas", "v": "Estilo Fusion, fundo translúcido" }
  ],
  "ctas": {
    "note": "Inscreva-se + sino; pin comment com pergunta engajadora",
    "rows": [
      { "k": "Card aos 02:30", "pt": "Por que você decidiu voltar?", "en": "Why did you decide to come back?" },
      { "k": "End screen", "pt": "Assista: Custo de vida no Canadá", "en": "Watch: Cost of living in Canada" }
    ],
    "display": "Inscreva-se · Comente sua experiência morando fora"
  }
}
```

### Como o Cowork gera o brief de Pós

O brief de Pós é **derivado do roteiro** e é um conjunto de **SUGESTÕES** que o editor ajusta — não é verdade fixa.

#### REGRA: o brief de Pós é escrito EM INGLÊS ⚠️

> **O editor de vídeo é estrangeiro e NÃO fala português.** Por isso, escreva TODO o conteúdo do brief de Pós **em inglês**, mesmo quando o vídeo é PT-BR: `style` & ritmo, `deliverables.energy`, `deliverables.notes`/escopo de entrega e os cues de B-roll. A **ÚNICA** exceção é o **texto literal de CTA na tela** — `ctas.rows[].pt` fica em português (texto na tela em PT) e `ctas.rows[].en` em inglês (texto na tela em EN). Tudo o mais que o editor precisa ler para editar (logística, estilo, energia, escopo) vai em inglês.

1. **Leia o roteiro primeiro:** `GET /api/pipeline/items/:id/sections/roteiro?lang=` no idioma alvo.
2. **Derive `style` & ritmo (`deliverables.energy`)** do **tom dos beats**: leia o arco do roteiro (abertura íntima → meio que sobe → CTA calmo, etc.) e traduza em color grade, transições, legendas e na nota de energia.
3. **Derive `ctas`** dos **beats de hook/CTA**: a `ctas.note`, as linhas `ctas.rows` (cards/end screen) e o `ctas.display` saem dos ganchos e chamadas-à-ação já escritos no roteiro.

> O editor revisa e ajusta tudo. Cowork **propõe**, não decide.

#### Regra do QR de Newsletter — POR IDIOMA ⚠️

> **O QR do newsletter é DIFERENTE por idioma.** `ctas.rows` **DEVE** incluir uma linha **"Newsletter QR"** cujos campos `pt` e `en` **diferem** entre si — cada idioma aponta para o QR de newsletter daquele idioma. Nunca repita o mesmo valor em `pt` e `en` para a linha de QR.

```json
{ "k": "Newsletter QR", "pt": "QR newsletter PT (assine em português)", "en": "Newsletter QR EN (subscribe in English)" }
```

### Estrutura — `PosBriefSchema` (`.strict()`)

| Campo | Tipo | Notas |
|-------|------|-------|
| `kind` | literal `"brief"` | **Obrigatório** |
| `deliverables` | object? (todos os campos opcionais) | `editor`, `deadline`, `turnaround`, `drive`, `energy` (strings) + `references` (string[]) |
| `style` | `{ k, v }[]` | Lista chave-valor de diretrizes de estilo (color grade, transições, legendas…) |
| `ctas.note` | string | Nota geral de CTA |
| `ctas.rows` | `{ k, pt, en }[]` | Linhas de CTA bilíngues (card/end screen/lower third) |
| `ctas.display` | string | Texto de CTA exibido |

> **IMPORTANTE — "Momentos-chave & b-roll" são DERIVADOS do roteiro, não armazenados aqui.** Os cards de momentos-chave (linhas `line` com `key:true`) e os cues de b-roll (`vis`) são lidos diretamente dos **beats do roteiro**. Para mudá-los, Cowork edita a seção `roteiro` (marca `key:true` numa `line`, ou ajusta as linhas `vis`) — **NÃO** o `postprod`. O `postprod` carrega só o brief (deliverables/style/ctas).

---

### Legacy — `postprod` timeline (V1–A6) + `postprod_scenes`/`postprod_crossref`/`postprod_speedramps`

> **SUPERSEDED por `kind:'brief'`.** O modelo de timeline multi-track (clips V1–V7/A1–A6, `assets`, `score_breakdown`, `crossRef`, `speedRamps`) e as seções `postprod_scenes` / `postprod_crossref` / `postprod_speedramps` abaixo são legados. Itens antigos ainda podem conter esses dados, mas **Cowork deve escrever a forma canônica `kind:'brief'`** acima e NÃO gerar novos dados de timeline. A documentação a seguir é mantida apenas para leitura/compat.

### Track IDs and their roles

| Track | Name | Purpose |
|-------|------|---------|
| `V1` | Main Footage | Talking head, A-roll principal |
| `V2` | Background Layer | Content behind speaker (Fusion Magic Mask) |
| `V3` | B-Roll | Cutaways, insert shots, Ken Burns photos |
| `V4` | Lower Thirds | Name, location, chapter titles |
| `V5` | Graphics + QR | QR codes, subscribe CTA, logos, infographics |
| `V6` | Subtitles | Styled captions (Text+ ou Fusion) |
| `V7` | Overlays + End Screen | End screen, cards, visual transitions, vignettes |
| `A1` | Voice | Narration, talking head audio |
| `A2` | Music | Music bed (ducked under voice) |
| `A3` | SFX Punctuation | Impacts, bass drops, risers |
| `A4` | SFX Textures | Whooshes, shimmers, transitions |
| `A5` | Ambience | Room tone, ambient sound |
| `A6` | Sound Design | Branded sounds, notifications, stingers |

### Content schema

```json
{
  "beats": [
    {
      "idx": 0,
      "label": "Hook",
      "name": "Hook — Revelação pessoal",
      "duration": 24,
      "absStart": 0,
      "status": "PENDING",
      "difficulty": "EASY",
      "clips": {
        "V1": [{ "s": 0, "e": 24, "label": "DJI_20001180_0067_D.MP4" }],
        "V3": [
          { "s": 2, "e": 8, "label": "Fotos Canadá (Ken Burns)" },
          { "s": 9, "e": 14, "label": "Fotos Brasil (Ken Burns)" },
          { "s": 15, "e": 20, "label": "Fotos Asia (Ken Burns)" }
        ],
        "V6": [{ "s": 0, "e": 24, "label": "Subtitle Track — 42 clips" }],
        "A1": [{ "s": 0, "e": 24, "label": "DJI_20001180_0067.wav" }],
        "A2": [{ "s": 0, "e": 24, "label": "Ocean Depth — v5 smooth duck.wav" }],
        "A3": [
          { "s": 5, "e": 6, "label": "Impact Live — B..." },
          { "s": 14, "e": 16, "label": "Riser Sutil 2s" },
          { "s": 20, "e": 21, "label": "Bass Drop — De..." }
        ],
        "A4": [
          { "s": 8, "e": 9, "label": "Whoosh transition" },
          { "s": 12, "e": 13, "label": "Shimmer light" }
        ]
      }
    },
    {
      "idx": 1,
      "label": "O Capítulo Canadá",
      "name": "Beat 1 — O Capítulo Canadá",
      "duration": 93,
      "absStart": 24,
      "status": "PENDING",
      "difficulty": "MEDIUM",
      "clips": {
        "V1": [
          { "s": 0, "e": 20, "label": "DJI_20001180_0068_D.MP4" },
          { "s": 20, "e": 40, "label": "DJI_20001180_0069_D.MP4" },
          { "s": 40, "e": 60, "label": "DJI_20001180_0070_D.MP4" },
          { "s": 60, "e": 80, "label": "DJI_20001180_0071_D.MP4" },
          { "s": 80, "e": 93, "label": "DJI_20001180_0072_D.MP4" }
        ],
        "V2": [{ "s": 0, "e": 93, "label": "Background Layer — Magic Mask" }],
        "V3": [
          { "s": 5, "e": 15, "label": "B-roll: Toronto..." },
          { "s": 25, "e": 38, "label": "B-roll: Winter ca..." },
          { "s": 55, "e": 68, "label": "B-roll: Apartm..." },
          { "s": 75, "e": 88, "label": "B-roll: Downto..." }
        ],
        "V4": [
          { "s": 3, "e": 8, "label": "LT: \"A...\"" },
          { "s": 50, "e": 55, "label": "LT: \"T...\"" }
        ],
        "V6": [{ "s": 0, "e": 93, "label": "Subtitle Track — 186 clips" }],
        "A1": [{ "s": 0, "e": 93, "label": "Voice narration" }],
        "A2": [{ "s": 0, "e": 93, "label": "Ocean Depth — v5 smooth duck.wav" }]
      }
    }
  ],
  "assets": {
    "0": {
      "music": [
        {
          "id": "uuid-ocean-depth",
          "name": "Ocean Depth",
          "artist": "Veaceslav Draganov",
          "genre": "cinematic",
          "bpm": 90,
          "dur": "3:42",
          "match": 26,
          "local": true,
          "selected": true,
          "confirmed": true,
          "tags": ["dark", "ambient", "piano"],
          "note": "Dark ambient pads — intimate confessional tone"
        }
      ],
      "sfx": [
        {
          "tc": "00:05",
          "type": "IMPACT",
          "typeColor": "#E67E22",
          "desc": "Impact leve — marca entrada do talking head",
          "file": { "name": "Impact Live.wav", "local": true, "match": 30 }
        },
        {
          "tc": "00:14",
          "type": "RISER",
          "typeColor": "#E67E22",
          "desc": "Riser sutil 2s antes da transição",
          "file": { "name": "Riser Sutil 2s.wav", "local": true, "match": 28 }
        }
      ]
    }
  }
}
```

### Field reference — `beats[]`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `idx` | number | **Yes** | 0-based index, must be sequential |
| `label` | string | **Yes** | Short beat label (shown in progress bar, e.g. "Hook", "O Capítulo Canadá") |
| `name` | string | **Yes** | Full beat name (shown in accordion header) |
| `duration` | number | **Yes** | Duration in seconds (determines ruler width) |
| `absStart` | number | **Yes** | Absolute start time: `sum of all previous beat durations` |
| `status` | string | **Yes** | `PENDING` \| `IN_PROGRESS` \| `DONE` |
| `difficulty` | string | **Yes** | `EASY` \| `MEDIUM` \| `HARD` — affects badge color |
| `clips` | Record | **Yes** | Track ID → array of clips. Only include tracks that have clips — empty tracks are auto-rendered as empty lanes |
| `script` | array | No | Optional script lines from roteiro (auto-populated by UI) |

### Field reference — `clips[trackId][]`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `s` | number | **Yes** | Start time in seconds (relative to beat start, 0 = beat start) |
| `e` | number | **Yes** | End time in seconds (relative to beat start, must be ≤ beat duration) |
| `label` | string | **Yes** | Clip label displayed on the timeline bar. Use the actual filename, description, or SFX name |

### Field reference — `assets{}`

Assets are keyed by beat index as string (e.g. `"0"`, `"1"`). Each beat has optional arrays: `music[]`, `sfx[]`, `visual[]`, `ambience[]`, `soundDesign[]`. These populate the "ASSETS" collapsible panel below each beat's timeline.

#### `assets[N].music[]` — MusicAsset

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | **Yes** | Unique identifier (UUID from audio library or generated) |
| `name` | string | **Yes** | Track name (e.g. "Ocean Depth") |
| `artist` | string | **Yes** | Artist name |
| `genre` | string | **Yes** | Genre/category (e.g. "cinematic", "ambient", "electronic") |
| `bpm` | number | No | Beats per minute |
| `dur` | string | No | Duration string (e.g. "3:42") |
| `match` | number | **Yes** | Match score (0-100) from resolver |
| `local` | boolean | **Yes** | `true` if file is in local audio library |
| `selected` | boolean | **Yes** | `true` if this is the chosen track for the beat |
| `confirmed` | boolean | No | `true` if user confirmed the selection |
| `tags` | string[] | No | Descriptive tags (e.g. ["dark", "ambient", "piano"]) |
| `note` | string | No | Editorial note explaining why this track fits |

#### `assets[N].sfx[]` — SfxAsset

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tc` | string | **Yes** | Timestamp within the beat (e.g. "00:05") |
| `type` | string | **Yes** | SFX category: `IMPACT` \| `RISER` \| `DROP` \| `TRANSITION` \| `AMBIENT` \| `FOLEY` |
| `typeColor` | string | **Yes** | Hex color for type badge. Use: IMPACT/DROP `#E67E22`, RISER `#E67E22`, TRANSITION `#F0B27A`, AMBIENT `#7D8B5E`, FOLEY `#8E44AD` |
| `desc` | string | **Yes** | Description of the effect |
| `file` | object\|null | No | `{ "name": string, "local": boolean, "match": number }` — resolved file info, null if unresolved |
| `tags` | string[] | No | Descriptive tags |
| `altCount` | number | No | Number of alternative SFX options available |

#### `assets[N].visual[]` — VisualAsset

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tc` | string | **Yes** | Timestamp |
| `desc` | string | **Yes** | Description of the visual element |
| `status` | string | **Yes** | `pending` \| `resolved` |
| `file` | string | No | Resolved filename |
| `search` | string[] | No | Search terms for finding the asset |

#### `assets[N].ambience[]` — AmbienceAsset

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **Yes** | Ambience name (e.g. "Room Tone Quiet") |
| `local` | boolean | **Yes** | `true` if in local library |
| `match` | number | **Yes** | Match score (0-100) |
| `tags` | string[] | No | Descriptive tags |

#### `assets[N].soundDesign[]` — SoundDesignAsset

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tc` | string | **Yes** | Timestamp |
| `name` | string | **Yes** | Sound design element name |
| `status` | string | **Yes** | `pending` \| `done` |
| `tags` | string[] | No | Descriptive tags |

### Field reference — `crossRef` (inline in `postprod`)

The CrossRef data can be embedded directly in the `postprod` section alongside `beats` and `assets`:

```json
{
  "beats": [...],
  "assets": {...},
  "crossRef": {
    "summary": "Duração total estimada: 5:00. 1 beat com divergência.",
    "beats": [
      {
        "name": "Hook",
        "srt": "00:00:00",
        "dur": "24s",
        "estRot": "20s",
        "status": "ON_TRACK",
        "statusColor": "#27AE60",
        "note": null
      },
      {
        "name": "O Capítulo Canadá",
        "srt": "00:00:24",
        "dur": "1m33s",
        "estRot": "1m20s",
        "status": "OVER",
        "statusColor": "#E74C3C",
        "note": "13s acima do estimado — considerar cortes"
      }
    ],
    "divergences": ["Beat 2 está 13s acima do estimado"]
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `summary` | string | **Yes** | One-line analysis summary |
| `beats[].name` | string | **Yes** | Beat label |
| `beats[].srt` | string | **Yes** | SRT timestamp (e.g. "00:00:24") |
| `beats[].dur` | string | **Yes** | Actual duration |
| `beats[].estRot` | string | **Yes** | Estimated duration from roteiro |
| `beats[].status` | string | **Yes** | `ON_TRACK` \| `OVER` \| `UNDER` \| `CUT` |
| `beats[].statusColor` | string | **Yes** | Hex color for badge: ON_TRACK `#27AE60`, OVER `#E74C3C`, UNDER `#E67E22`, CUT `#95A5A6` |
| `beats[].note` | string | No | Optional note about divergence |
| `divergences` | string[] | **Yes** | List of significant divergences (can be empty array) |

### Field reference — `speedRamps` (inline in `postprod`)

```json
{
  "beats": [...],
  "speedRamps": {
    "summary": "Ritmo editorial padrão com slow-mo em momentos-chave",
    "base": "1.0x (24fps playback)",
    "sections": [
      {
        "name": "Hook — abertura rápida",
        "srt": "00:00-00:05",
        "vel": "1.2x",
        "velColor": "#E67E22",
        "racional": "Ritmo acelerado para captar atenção"
      },
      {
        "name": "Capítulo Canadá — slow-mo montage",
        "srt": "00:30-00:38",
        "vel": "0.6x",
        "velColor": "#3498DB",
        "racional": "Slow-mo para impacto dramático nas fotos"
      }
    ]
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `summary` | string | **Yes** | One-line editorial pacing summary |
| `base` | string | **Yes** | Baseline playback speed (e.g. "1.0x (24fps playback)") |
| `sections[].name` | string | **Yes** | Section description |
| `sections[].srt` | string | **Yes** | Timecode range (e.g. "00:00-00:05") |
| `sections[].vel` | string | **Yes** | Speed multiplier (e.g. "1.2x", "0.6x") |
| `sections[].velColor` | string | **Yes** | Hex color for badge: fast (>1x) `#E67E22`, normal (1x) `#27AE60`, slow (<1x) `#3498DB` |
| `sections[].racional` | string | **Yes** | Editorial rationale for this speed choice |

### Mapping from `postprod_scenes` to `postprod`

When writing `postprod`, transform the semantic `postprod_scenes` data into timeline clips:

| `postprod_scenes` source | → `postprod` target track |
|--------------------------|---------------------------|
| Scene timestamps | `absStart` + `duration` |
| Scene's main footage reference | `V1` clips |
| Scene's B-roll items | `V3` clips |
| Scene's overlays/lower thirds | `V4` / `V7` clips |
| Scene subtitle reference | `V6` clip (one per beat, spanning full duration) |
| Scene music track | `A2` clip (usually spans full beat) |
| Scene's voice/narration | `A1` clip (usually spans full beat) |
| Scene's SFX (IMPACT, RISER, DROP) | `A3` clips (short, at specific timestamps) |
| Scene's SFX (WHOOSH, SHIMMER, TRANSITION) | `A4` clips |
| Scene's ambience reference | `A5` clip |

**Rules:**
1. Clip times are **relative to beat start** (s=0 means beat start, NOT absolute timeline position)
2. `absStart` for beat N = sum of durations of beats 0..N-1
3. Every beat SHOULD have at least `V1` and `A1` clips (main footage + voice)
4. If a music track continues from the previous beat, still include a full-duration `A2` clip with the track name + " (continues)"
5. Subtitle track (`V6`) is one clip per beat — label as "Subtitle Track — N clips" where N is approximate word count ÷ 3
6. SFX clips are short (0.3-3s). Place them at the exact timestamp from the scene's sfx array, converted to beat-relative time
7. B-roll clips should have descriptive labels matching the brolls section's clip names

---

## Section: `postprod_scenes` (per-lang) — Cena × Cena

```json
{
  "scenes": [
    {
      "number": 1,
      "label": "Hook — Revelação pessoal",
      "beat_ref": "1",
      "timestamps": "00:00-00:45",
      "duration": "45s",
      "status": "PENDING",
      "difficulty": "MEDIUM",
      "narrative": "Estabelecer conexão emocional com o espectador",
      "edit_notes": [
        "[VISUAL: Close-up, profundidade rasa]",
        "00:30-00:45 montage of photos — Ken Burns slow zoom"
      ],
      "music": {
        "track": "Ocean Depth",
        "artist": "Veaceslav Draganov",
        "entry_cue": "Fade in at 00:15",
        "style": "Minimal piano + textura lo-fi, intimate and introspective",
        "search_terms": "lo-fi ambient introspective",
        "reasoning": "Dark ambient pads match the cinematic tone for the hook. Low energy complements intimate confessional delivery.",
        "continuation": null,
        "flow_to": "Cena 2",
        "original_filename": "Veaceslav Draganov - Ocean Depth.wav",
        "audio_asset_id": "uuid-from-resolver",
        "resolve_status": "LOCAL",
        "score": 26,
        "artlist_url": null,
        "recommendations": [
          {
            "track": "Ocean Depth",
            "artist": "Veaceslav Draganov",
            "original_filename": "Veaceslav Draganov - Ocean Depth.wav",
            "audio_asset_id": "uuid-from-resolver",
            "resolve_status": "LOCAL",
            "score": 26,
            "score_max": 34,
            "score_breakdown": {
              "category": { "score": 5, "max": 5 },
              "tags": { "score": 6, "max": 8 },
              "mood": { "score": 4, "max": 6 },
              "energy": { "score": 3, "max": 3 },
              "bpm_in_range": { "score": 3, "max": 3 },
              "duration_in_range": { "score": 2, "max": 2 },
              "reuse_scenarios": { "score": 0, "max": 4 },
              "instruments": { "score": 3, "max": 3 }
            },
            "reasoning": "Dark ambient pads match the cinematic tone for the hook. Low energy complements intimate confessional delivery.",
            "energy": 2,
            "bpm": 90,
            "key": "E3",
            "duration": "3:42",
            "category": "cinematic",
            "artlist_url": "https://artlist.io/song/ocean-depth"
          },
          {
            "track": "Fission",
            "artist": "Phillip Gross",
            "original_filename": "Phillip Gross - Fission.wav",
            "audio_asset_id": "uuid-fission",
            "resolve_status": "LOCAL",
            "score": 18,
            "score_max": 34,
            "score_breakdown": {
              "category": { "score": 5, "max": 5 },
              "tags": { "score": 4, "max": 8 },
              "mood": { "score": 2, "max": 6 },
              "energy": { "score": 3, "max": 3 },
              "bpm_in_range": { "score": 0, "max": 3 },
              "duration_in_range": { "score": 2, "max": 2 },
              "reuse_scenarios": { "score": 0, "max": 4 },
              "instruments": { "score": 2, "max": 3 }
            },
            "reasoning": "Similar dark tone but more electronic. Higher energy may clash with confessional pacing.",
            "delta_vs_favorite": { "tags": -2, "mood": -2, "reuse_scenarios": 0, "instruments": -1 },
            "energy": 3,
            "bpm": 110,
            "key": "Am",
            "duration": "4:15",
            "category": "electronic"
          }
        ],
        "favorite_index": 0
      },
      "sfx": [
        {
          "timestamp": "00:05",
          "description": "Room tone fade in",
          "cue_text": "Vida estável",
          "search_terms": "room ambience quiet",
          "audio_asset_id": "uuid-if-resolved",
          "resolve_status": "LOCAL",
          "sfx_category": "AMBIENT",
          "original_filename": "Room Tone Quiet.wav",
          "score": 28,
          "score_max": 34
        },
        {
          "timestamp": "00:06",
          "description": "Impact leve — marca entrada do talking head",
          "cue_text": "Vida estável",
          "sfx_category": "IMPACT",
          "resolve_status": "LOCAL",
          "original_filename": "Deep Low Impact.wav",
          "score": 30,
          "score_max": 34,
          "search_terms": "subtle impact low"
        }
      ],
      "overlays": [
        { "timestamp": "00:10", "instruction": "Lower third: nome + localização" }
      ],
      "mix": [
        { "parameter": "Voice", "value": "-3dB" },
        { "parameter": "Music", "value": "-12dB" }
      ],
      "transition": { "type": "Dissolve", "reasoning": "Transição suave para beat emocional" },
      "decide_items": ["Usar foto A ou B no montage?"]
    }
  ]
}
```

### music object fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `track` | string\|null | No | Track name from resolver or Artlist |
| `artist` | string\|null | No | Artist name |
| `entry_cue` | string | **Yes** | When the music should enter (e.g., "after narrator says X", "on cut to B-roll", "Fade in at 00:15") |
| `style` | string | **Yes** | Musical style description (e.g., "Minimal piano + textura", "Dark ambient pads") |
| `search_terms` | string | **Yes** | Search intent keywords (space-separated for music). Always keep, even for LOCAL — used for re-search |
| `reasoning` | string | **Yes** | Cowork's editorial reasoning — WHY this track fits this scene's mood and pacing |
| `continuation` | string\|null | No | If this scene continues music from a previous scene, the source scene label (e.g., "Cena 2", "Continues from Beat 1") |
| `flow_to` | string\|null | No | If this track should flow into the next scene, target scene label (e.g., "Cena 3") |
| `original_filename` | string | No | Filename from audio library (ONLY from resolver response, never invented) |
| `audio_asset_id` | uuid | No | UUID of matched asset in Audio Library |
| `resolve_status` | enum | No | `LOCAL` \| `PENDING_MATCH` \| `PARTIAL_MATCH` \| `NO_MATCH` — from resolver |
| `score` | number | No | Resolver match score (0-34, `score_max` always 34) |
| `artlist_url` | url | No | Pre-computed Artlist search URL (when resolve_status is NO_MATCH or PARTIAL_MATCH) |
| `recommendations` | array | **Yes** | Ranked track alternatives from resolver (see transformation guide below). **REQUIRED for rich UI rendering** — without this, scene falls back to flat legacy display |
| `favorite_index` | number | No | Index of starred favorite in recommendations (default 0) |
| `score_breakdown` | object | No | Per-category scores (deprecated at top-level — prefer inside each recommendation) |

#### Music-related content MUST live in the music object

All music-related information MUST be placed in the `music` object fields above — **NEVER in `edit_notes`**. The following categories of notes are absorbed into the music object:

| Old category (edit_notes) | Now lives in | Music field |
|---------------------------|-------------|-------------|
| MUSIC (`search artlist`, `mood:`, `genre:`, `bpm:`) | music object | `search_terms` |
| STYLE (`style:`, `needs to feel`, `think "`) | music object | `style` |
| ENTRY (`entry:`, timestamp-based music entry) | music object | `entry_cue` |
| FLOW (`continues`, `don't change`, `same track`) | music object | `continuation` or `flow_to` |

`edit_notes` should contain ONLY non-music notes (VISUAL, TIMING, OVERLAY, NOTE categories).

#### recommendations[] items

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `track` | string | Yes | Track name |
| `artist` | string | Yes | Artist name |
| `original_filename` | string | No | Local filename (from resolver `asset.original_filename`) |
| `audio_asset_id` | string | No | UUID from audio_assets (from resolver `asset.id`) |
| `resolve_status` | enum | Yes | `LOCAL` \| `PENDING_MATCH` \| `PARTIAL_MATCH` \| `NO_MATCH` |
| `score` | number | Yes | Resolver score (0-34) |
| `score_max` | number | Yes | Always `34` |
| `score_breakdown` | object | **Yes** | Per-category scores as `{ key: { score: N, max: N } }` — see transformation below |
| `reasoning` | string | Yes | One-liner editorial reasoning for this recommendation |
| `delta_vs_favorite` | object | No | Score difference per category vs favorite (only for non-favorite items) |
| `category` | string | No | e.g. cinematic, ambient (from `asset.category`) |
| `energy` | number | No | 1-5 (from `asset.energy`) |
| `bpm` | number | No | Beats per minute (from `asset.bpm`) |
| `key` | string | No | Musical key (from `asset.music_key`) |
| `duration` | string | No | Formatted duration e.g. "3:42" (from `asset.duration_seconds`) |
| `artlist_url` | string | No | Direct Artlist URL (from `asset.artlist_url`, or build for NO_MATCH/PENDING_MATCH) |

#### score_breakdown — REQUIRED transformation

The resolver returns a **flat** breakdown object with raw numbers:
```json
// Resolver response (DO NOT use this format directly)
"breakdown": { "category": 5, "tags": 4, "mood": 2, "energy": 3, "bpm_in_range": 3, "duration_in_range": 0, "reuse_scenarios": 0, "instruments": 1, "description": 0 }
```

The CMS UI requires `{ score, max }` objects per category. **You MUST transform** using this max-values map:

```json
{
  "category":         { "score": <from_breakdown>, "max": 5 },
  "tags":             { "score": <from_breakdown>, "max": 8 },
  "mood":             { "score": <from_breakdown>, "max": 6 },
  "energy":           { "score": <from_breakdown>, "max": 3 },
  "bpm_in_range":     { "score": <from_breakdown>, "max": 3 },
  "duration_in_range":{ "score": <from_breakdown>, "max": 2 },
  "reuse_scenarios":  { "score": <from_breakdown>, "max": 4 },
  "instruments":      { "score": <from_breakdown>, "max": 3 }
}
```

**Max values constant:** `category=5, tags=8, mood=6, energy=3, bpm_in_range=3, duration_in_range=2, reuse_scenarios=4, instruments=3` (total: 34)

Omit `description` from the breakdown — the UI does not render it.

**Complete transformed example:**
```json
"score_breakdown": {
  "category": { "score": 5, "max": 5 },
  "tags": { "score": 4, "max": 8 },
  "mood": { "score": 2, "max": 6 },
  "energy": { "score": 3, "max": 3 },
  "bpm_in_range": { "score": 3, "max": 3 },
  "duration_in_range": { "score": 0, "max": 2 },
  "reuse_scenarios": { "score": 0, "max": 4 },
  "instruments": { "score": 1, "max": 3 }
}
```

#### delta_vs_favorite computation

For each non-favorite recommendation, compute the per-category score difference vs the favorite:

```json
"delta_vs_favorite": {
  "tags": -2,       // this.breakdown.tags - favorite.breakdown.tags
  "mood": -2,       // this.breakdown.mood - favorite.breakdown.mood  
  "reuse_scenarios": -4
}
```

Only include categories with non-zero difference. The UI renders these as colored pills showing where the alternative is weaker/stronger than the favorite.

### sfx object fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | string | Yes | Timecode (e.g. "00:05") |
| `description` | string | Yes | What the SFX is/does (one-liner, can include `—` separator for intent) |
| `cue_text` | string | **Yes** | The exact word(s) from the script that trigger this SFX. Rendered as `"…cue_text" → CATEGORY` in the UI. E.g. `"vida estável"` for an impact that fires on those words. Keep short (1-5 words). |
| `search_terms` | string | **Yes** | **Comma-separated** search phrases. Each comma-delimited term renders as a clickable Artlist chip in the UI. E.g. `"bass drop,impact hit low"` → 2 chips |
| `audio_asset_id` | uuid | No | UUID of matched asset in Audio Library |
| `resolve_status` | enum | **Yes** | `LOCAL` \| `PENDING_MATCH` \| `PARTIAL_MATCH` \| `NO_MATCH` — from resolver |
| `sfx_category` | enum | **Yes** | `IMPACT` \| `RISER` \| `DROP` \| `TRANSITION` \| `AMBIENT` \| `FOLEY` — determines pill color |
| `original_filename` | string | No | Matched file name (required for LOCAL/PARTIAL_MATCH) |
| `score` | number | No | Resolver score (0-34, required for LOCAL/PARTIAL_MATCH) |
| `score_max` | number | No | Always `34` (include whenever score is present) |
| `artlist_url` | string | No | Direct SFX search URL (auto-generated by UI from search_terms) |

### Continuation tracks

When a scene continues the previous scene's track, use this convention:

```json
{
  "music": {
    "track": "Ocean Depth (continues)",
    "artist": "Veaceslav Draganov",
    "entry_cue": "Continues from Hook, no break.",
    "style": "Volume -20dB constante, maintaining intimate tone",
    "search_terms": "Continues from Beat 0",
    "reasoning": "Same track continues to maintain emotional coherence across the narrative arc.",
    "continuation": "Cena 1",
    "flow_to": null,
    "resolve_status": null
  }
}
```

- `entry_cue` (REQUIRED) — describe how the continuation enters (e.g., "Continues from Hook, no break.")
- `style` (REQUIRED) — describe the continuation style (e.g., volume change, filter, same as parent)
- `search_terms` (REQUIRED) — use "Continues from Beat N" or equivalent
- `reasoning` (REQUIRED) — explain why the continuation serves the narrative
- `continuation` — the source scene label (e.g., "Cena 1") — indicates this track is inherited
- `flow_to: null` — continuations don't flow further (or set to next scene label if they do)
- `resolve_status: null` — not resolved independently (inherits from parent scene)
- No `audio_asset_id` — inherits from parent
- No `artlist_url` — nothing to search
- No `recommendations` — continuations inherit from parent; no resolver call needed
- The CMS detects continuation tracks by matching `^Continues\b` or `(continues)` / `(continua)` at end of track name. Real track names like "The Journey Continues" are NOT treated as continuations.

### Resolver integration workflow — Populating Rich Recommendations

When creating or updating `postprod_scenes`, populate **`recommendations[]`** for EVERY scene with music. This is REQUIRED — the UI renders recommendation cards only when `recommendations` is present and non-empty. Scenes without recommendations fall back to a flat legacy display.

#### Step-by-step for each scene's music:

**1. Build resolver query from scene context:**
```json
POST /api/pipeline/audio-library/resolve
{
  "type": "music",
  "category": "<from scene mood/style>",
  "tags": ["<from scene keywords>"],
  "mood": ["<from scene emotional tone>"],
  "energy": <1-5 from scene intensity>,
  "bpm_range": { "min": <scene tempo low>, "max": <scene tempo high> },
  "duration_range": { "min": <scene_duration_sec * 0.8>, "max": <scene_duration_sec * 2> },
  "instruments": ["<desired instruments>"],
  "reuse_scenarios": ["<background|intro|outro|highlight|transition>"],
  "description": "<free-text scene description>",
  "limit": 3
}
```

**2. Transform each match into a recommendation:**

For each item in `response.data.matches[]`:
```
asset  = match.asset
score  = match.score
status = match.resolve_status
bdown  = match.breakdown
```

Map to recommendation:
```json
{
  "track": asset.track_name,
  "artist": asset.artist,
  "original_filename": asset.original_filename,
  "audio_asset_id": asset.id,
  "resolve_status": status,
  "score": score,
  "score_max": 34,
  "score_breakdown": {
    "category":          { "score": bdown.category,          "max": 5 },
    "tags":              { "score": bdown.tags,              "max": 8 },
    "mood":              { "score": bdown.mood,              "max": 6 },
    "energy":            { "score": bdown.energy,            "max": 3 },
    "bpm_in_range":      { "score": bdown.bpm_in_range,     "max": 3 },
    "duration_in_range": { "score": bdown.duration_in_range, "max": 2 },
    "reuse_scenarios":   { "score": bdown.reuse_scenarios,   "max": 4 },
    "instruments":       { "score": bdown.instruments,       "max": 3 }
  },
  "reasoning": "<your editorial reasoning — WHY this track fits this scene>",
  "category": asset.category,
  "energy": asset.energy,
  "bpm": asset.bpm,
  "key": asset.music_key,
  "duration": formatDuration(asset.duration_seconds),
  "artlist_url": asset.artlist_url
}
```

**3. Choose favorite and compute deltas:**
- Set `favorite_index` to the best recommendation (usually index 0 = highest score)
- For each non-favorite, compute `delta_vs_favorite`:
  ```
  delta_vs_favorite[key] = this.breakdown[key] - favorite.breakdown[key]
  ```
  Only include keys with non-zero difference.

**4. Set top-level music fields from favorite + required editorial fields:**
```json
{
  "track": recommendations[favorite_index].track,
  "artist": recommendations[favorite_index].artist,
  "entry_cue": "<REQUIRED — when/how music enters this scene>",
  "style": "<REQUIRED — musical style description>",
  "search_terms": "<REQUIRED — original search intent, keep always>",
  "reasoning": "<REQUIRED — editorial summary of why this track fits>",
  "continuation": null,
  "flow_to": "<scene label if track should flow into next scene, else null>",
  "original_filename": recommendations[favorite_index].original_filename,
  "audio_asset_id": recommendations[favorite_index].audio_asset_id,
  "resolve_status": recommendations[favorite_index].resolve_status,
  "score": recommendations[favorite_index].score,
  "recommendations": [...],
  "favorite_index": 0
}
```

**5. Handle edge cases:**
- **No resolver matches (0 results):** Set `resolve_status: "NO_MATCH"`, keep all REQUIRED fields (`entry_cue`, `style`, `search_terms`, `reasoning`), build `artlist_url` from search terms
- **Continuation scenes:** Set `continuation: "Cena N"` (source scene), all 4 REQUIRED fields still apply, no resolver call, no recommendations
- **Score = 0 everywhere:** Still create a recommendation with `resolve_status: "NO_MATCH"` so the UI shows the search chips

#### Step-by-step for each SFX item:

**1. Query resolver:**
```json
POST /api/pipeline/audio-library/resolve
{ "type": "sfx", "category": "<sfx_category>", "tags": ["<sfx keywords>"], "description": "<what the SFX does>", "limit": 1 }
```

**2. Populate SFX fields:**
```json
{
  "timestamp": "00:06",
  "description": "Impact leve — marca entrada do talking head",
  "cue_text": "vida estável",
  "sfx_category": "IMPACT",
  "search_terms": "subtle impact,low hit,deep bass impact",
  "resolve_status": "<from resolver>",
  "original_filename": "<from top match asset.original_filename if LOCAL/PARTIAL>",
  "audio_asset_id": "<from top match asset.id>",
  "score": <from top match>,
  "score_max": 34
}
```

**IMPORTANT:** `search_terms` MUST be **comma-separated phrases** (not space-separated). Each comma-delimited term becomes a separate clickable Artlist search chip in the UI. Example: `"bass drop,impact hit low"` → renders 2 chips: [bass drop] [impact hit low].

#### SFX category assignment rules:

| Category | Use for |
|----------|---------|
| `IMPACT` | Hits, punches, emphasis marks, logo stings |
| `RISER` | Build-ups, tension builders, ascending tones |
| `DROP` | Bass drops, release moments, energy releases |
| `TRANSITION` | Whooshes, swooshes, swipes between scenes |
| `AMBIENT` | Room tone, wind, rain, crowd, atmosphere loops |
| `FOLEY` | Footsteps, cloth, typing, object interactions |

### UI Feature → Required Fields mapping

The Scene Guide CMS renders rich audio UI components. Each feature requires specific fields to activate:

| UI Feature | Component | Required Fields |
|-----------|-----------|-----------------|
| **Score Gauge** (SVG donut on favorite card) | `ScoreGauge` | `score`, `score_max` |
| **Score Bar** (thin progress on alternatives) | `ScoreBar` | `score`, `score_max` |
| **Score Breakdown pills** (per-category colored pills) | expand panel | `score_breakdown: { key: { score, max } }` |
| **Energy indicator** (gradient dots ⚡ N/5) | `EnergyIndicator` | `energy` (1-5) |
| **Category chip** (e.g. "cinematic") | inline pill | `category` |
| **BPM / Key metadata** | expand panel | `bpm`, `key` |
| **Duration** | expand panel | `duration` (formatted string) |
| **Favorite star + accent border** | `MusicRecommendationCard` | `favorite_index` on parent music + ≥1 recommendation |
| **Delta vs favorite pills** | `MusicAlternativeRow` | `delta_vs_favorite: { key: number }` |
| **Cowork reasoning** (status-tinted text) | `CoworkReasoning` | `reasoning` (string) |
| **Artlist download CTA** (amber button) | favorite card | `artlist_url` + `resolve_status: "PENDING_MATCH"` |
| **SFX cue text** (`"…word" → IMPACT`) | `SFXItemCard` | `cue_text` (1-5 words from script) |
| **SFX search chips** (individual clickable pills) | `SFXItemCard` | `search_terms` (comma-separated) + `resolve_status: "NO_MATCH"` |
| **SFX category pill** (colored badge) | `SFXItemCard` | `sfx_category` |
| **Continuation card** (dashed border, dim text) | scene renderer | `continuation` matching `/^Continues\b|\(continues?\)$|\(continua\)$/i` |
| **Audio Resolver summary** (dashboard header) | `AudioSummaryV2` | Any scene with `music.resolve_status` or `sfx[].resolve_status` |
| **Waveform visualization** (Audio Library cards) | `WaveformDisplay` | `metadata.waveform.peaks` on audio asset (40-80 normalized 0-1 values) |

**Minimum for rich rendering:** `recommendations[]` with at least: `track`, `artist`, `resolve_status`, `score`, `score_max`, `score_breakdown`, `reasoning`.

**Maximum impact fields:** All of the above + `energy`, `category`, `bpm`, `key`, `duration`, `delta_vs_favorite`, `artlist_url`.

---

### edit_notes categorization rules

O renderer categoriza `edit_notes` automaticamente:

| Categoria | Trigger (case-insensitive) | Status |
|-----------|---------------------------|--------|
| OVERLAY | `text overlay`, `lower third` | Active |
| MUSIC | `search artlist`, `search artist`, `mood:`, `genre:`, `bpm:`, `track change`, `new track` | **DEPRECATED** — use `music.search_terms` |
| STYLE | começa com `style:`, `needs to feel`, `think "` | **DEPRECATED** — use `music.style` |
| ENTRY | começa com `entry:` | **DEPRECATED** — use `music.entry_cue` |
| VISUAL | `montage`, `ken burns`, `b-roll`, `photo` | Active |
| SFX | contains `sfx` (case-insensitive) | **ABSORBED** — filtered from edit_notes when scene has `sfx[]` data |
| TIMING | começa com `00:00` timestamp, `fade in`, `fade out` | Active |
| FLOW | `continues`, `don't change`, `same track` | **DEPRECATED** — use `music.continuation` / `music.flow_to` |
| NOTE | default (nenhum match) | Active |

**IMPORTANT:** MUSIC, STYLE, ENTRY, FLOW, and SFX categories are absorbed from `edit_notes`. Music-related info MUST be in the `music` object; SFX-related info MUST be in the `sfx[]` array. The renderer filters these categories automatically when the corresponding data exists on the scene. New content MUST NOT duplicate them in `edit_notes`.

Notas com timestamps `00:00` ou `00:00-00:00` são agrupadas numa timeline visual.
Prefixo `optional` marca nota como opcional.

### Artlist search format (auto-linked by CMS)

edit_notes entries matching this format are auto-linked to Artlist music search:

```
Search Artlist: Mood: {moods} | Genre: {genres} | BPM: {bpm_range} | Duration: {duration}
```

Fields (all optional, pipe-separated, case-insensitive). The CMS auto-links up to **4 filter IDs** with priority: Genre (max 2) → Mood (max 2) → Instrument (max 1) → Theme → backfill from remaining.

- **Mood:** comma-separated — Mysterious, Dark, Peaceful, Energetic, Melancholic, Uplifting, Powerful, Happy, Carefree, Love, Serious, Dramatic, Angry, Tense, Sad, Playful, Hopeful, Scary, Groovy, Funny, Exciting, Epic
- **Genre:** comma-separated — Ambient, Blues, Soul-RnB, Country, Jazz, Cinematic, World, Electronic, Acoustic, Indie, Rock, Pop, Singer-Songwriter, Folk, Classical, Hip-Hop, Funk, Latin, Lofi-Chill-Beats
- **Instrument:** comma-separated — Piano, Acoustic-Guitar, Electric-Guitar, Strings, Acoustic-Drums, Electronic-Drums, Percussion, Bells, Synth, Keys, Orchestra, Brass, Pads, Bass
- **Theme:** comma-separated — Documentary, Travel, Trailer, Vlog, Shorts
- **BPM:** single value (90) or range (90-100)
- **Duration:** minimum duration — 2+ min, 3:30+ min, 90+ sec
- **Track:** suggestion for the editor, NOT used as search filter
- **Style:** description, NOT used as filter

**Synonym mappings (auto-resolved):** Determined→Uplifting, Building→Uplifting, Motivational→Uplifting, Focused→Serious, Reflective→Peaceful, Warm→Peaceful, Contemplative→Peaceful, Emotional→Sad, Nostalgic→Sad, Inspiring→Hopeful, Adventurous→Exciting, Suspenseful→Tense, Triumphant→Epic, Lo-fi/Lofi→Lofi-Chill-Beats, Orchestral→Orchestra (instrument).

SFX references using `Artlist "Track Name"` in edit_notes or sfx.description are also auto-linked to Artlist SFX search.

**Canonical format:** Always use `Search Artlist:` (not `Search Artist:`). The renderer supports both for backward compatibility.

---

## Section: `postprod_crossref` (per-lang) — Cross-Reference

```json
{
  "rows": [
    {
      "beat": "1",
      "srt_timestamp": "00:00:00,000 --> 00:00:45,000",
      "duration": "45s",
      "script_estimate": "40s",
      "status": "ON_TRACK"
    }
  ],
  "divergences": [
    "Beat 3 está 20s acima do estimado — considerar cortes"
  ],
  "summary": "Duração total estimada: 12:30. 2 beats com divergência significativa.",
  "source": "SRT analysis v1"
}
```

| Campo | Tipo | Notas |
|-------|------|-------|
| `rows[].beat` | string | Referência ao beat do roteiro |
| `rows[].srt_timestamp` | string | Formato SRT: `HH:MM:SS,mmm --> HH:MM:SS,mmm` |
| `rows[].status` | string | `ON_TRACK`, `OVER`, `UNDER`, `CUT` |
| `divergences` | string[] | Lista de divergências significativas |
| `summary` | string | Resumo da análise |

---

## Section: `postprod_speedramps` (per-lang) — Speed Ramps

```json
{
  "rows": [
    {
      "section": "Intro montage",
      "srt_range": "00:00:45,000 --> 00:01:30,000",
      "timeline": "00:45-01:30",
      "speed": "1.5x",
      "rationale": "Montage de fotos — ritmo acelerado mantém energia"
    }
  ],
  "est_final": "11:45",
  "edit_style": "Dynamic — mix of real-time and accelerated",
  "base_acceleration": "1.0x",
  "source": "Cross-ref analysis"
}
```

| Campo | Tipo | Notas |
|-------|------|-------|
| `rows[].speed` | string | `0.5x`, `1.0x`, `1.5x`, `2.0x`, `CUT`, `CORTE` |
| `est_final` | string | Duração final estimada após speed ramps |
| `edit_style` | string | Descrição do estilo de edição |

---

## Section: `publish` (per-lang, VIDEO) — `ABDraftSchema` (A/B title + thumbnail brief)

Para **vídeo**, a seção `publish` é um **rascunho de teste A/B** — `ABDraftSchema` (`.strict()` + `.refine`). São **exatamente 4 variantes** A/B/C/D, cada uma com um título e um **briefing de thumbnail** (texto descrevendo o que a thumb comunica). **Não existe "original":** na estreia as 4 são **challengers do zero** — não há incumbente. O único distintivo de partida é `firstOnAir` (qual capa entra **primeiro** no ar). Uma `winner` só existe **depois** que o teste resolve.

```json
{
  "firstOnAir": "A",
  "variants": [
    {
      "id": "A",
      "role": "challenger",
      "title": "Por que saí do Canadá depois de 4 anos",
      "brief": "Rosto pensativo em primeiro plano, mala ao fundo desfocada. Texto curto 'POR QUÊ?' em amarelo. Comunica decisão pessoal difícil."
    },
    {
      "id": "B",
      "role": "challenger",
      "title": "4 anos no Canadá: nunca foi pra mim",
      "brief": "Close no olhar, luz fria de janela. Sem texto grande — deixa o rosto carregar a emoção. Comunica vulnerabilidade (ângulo emocional)."
    },
    {
      "id": "C",
      "role": "challenger",
      "title": "O custo real de morar fora (e por que voltei)",
      "brief": "Split: passaporte/boletos de um lado, paisagem brasileira do outro. Número em destaque. Comunica análise racional (ângulo de dados)."
    },
    {
      "id": "D",
      "role": "challenger",
      "title": "A verdade que ninguém conta sobre emigrar",
      "brief": "Expressão de surpresa, seta apontando pra fora do frame. Comunica revelação (ângulo de curiosidade/promessa)."
    }
  ]
}
```

### Como o Cowork gera o rascunho A/B

O rascunho A/B é **derivado do roteiro + ideia** e é um conjunto de **4 propostas testáveis** que o editor ajusta — não é verdade fixa.

1. **Leia o roteiro primeiro** (`GET /api/pipeline/items/:id/sections/roteiro?lang=`) e a `ideia` no idioma alvo — o título/gancho central e os beats dão a matéria-prima.
2. **Gere EXATAMENTE 4 variantes A–D**, cada uma um **ângulo distinto e testável**: emocional, dados, curiosidade, promessa (não 4 variações do mesmo título).
3. **`brief` = o que a thumbnail comunica** — só texto descritivo (composição, expressão, texto-na-tela, o que o olhar capta). **Nunca** dados de imagem nem URLs.
4. **`firstOnAir`** = qual capa você sugere que entre **primeiro** no ar (a aposta de abertura). Não é um "vencedor" — só a primeira a rodar.
5. **Todas as 4 entram como `role:"challenger"`.** Não escreva `role:"winner"` — o vencedor só é definido **depois** que o teste roda (no máximo um).

> O editor revisa e ajusta tudo. Cowork **propõe** 4 ângulos, não decide o vencedor.

### Estrutura — `ABDraftSchema`

| Campo | Tipo | Notas |
|-------|------|-------|
| `firstOnAir` | `"A"` \| `"B"` \| `"C"` \| `"D"` | Qual capa entra **primeiro** no ar (aposta de abertura — não é vencedor) |
| `variants` | array de **exatamente 4** | Uma por id A/B/C/D |
| `variants[].id` | `"A"`\|`"B"`\|`"C"`\|`"D"` | Identificador da variante |
| `variants[].role` | `"challenger"` \| `"winner"` | Na estreia **todas** são `"challenger"`. No máximo **uma** pode ser `"winner"` — e só depois do teste (invariante do `.refine`) |
| `variants[].title` | string ≤500 | Variação de **TÍTULO** A/B |
| `variants[].brief` | string ≤1000 | **Briefing da thumbnail** — texto descrevendo o que a thumb deve comunicar |

### Fronteiras CRÍTICAS

- **Thumbnails NÃO são geradas aqui.** Cowork escreve apenas `title` + `brief` (texto). As imagens de thumbnail são sugestões produzidas depois pela ferramenta de design da Claude AI. Cowork **nunca** escreve dados de imagem / URLs de thumb nesta seção.
- **Sem "original" / incumbente.** As 4 capas nascem do zero como challengers. Cowork **não** escreve `role:"winner"` — só `"challenger"`. O `firstOnAir` é apenas a primeira capa a ir ao ar; o vencedor é definido depois pelo teste.
- **Cowork apenas RASCUNHA.** O teste A/B é materializado pela ação de **publicação** (RBAC modo-publish). Cowork **não** inicia o teste no ab-lab — só deixa o rascunho pronto.
- **Published-freeze:** uma vez que o item está em `published`/`scheduled` (stage ≥ published), `publish` (junto com `ideia`/`roteiro`/`postprod`) fica READ-ONLY e o PATCH retorna HTTP 403 (`"Section is read-only while published"`) — deixe o rascunho A/B pronto **antes** de publicar, ou dê `retreat` primeiro.

---

## Section: `images` (shared) — Prompts Visuais e Image Management

```json
{
  "cover": {
    "prompts": [
      {
        "rank": 1,
        "prompt": "developer at minimalist desk, laptop with code editor, warm golden hour light --ar 16:9 --v 6.1",
        "rationale": "Recomendada: composição clássica, luz quente, preserva anonimato",
        "alt_text_pt": "Desenvolvedor trabalhando em laptop com editor de código, luz dourada",
        "alt_text_en": "Developer working on laptop with code editor, golden light"
      },
      { "rank": 2, "prompt": "...", "rationale": "Variação criativa", "alt_text_pt": "...", "alt_text_en": "..." },
      { "rank": 3, "prompt": "...", "rationale": "Approach diferente", "alt_text_pt": "...", "alt_text_en": "..." }
    ],
    "chosen": null,
    "image_url": null,
    "fallback_search": "developer workspace golden hour - Unsplash",
    "status": "prompt_ready"
  },
  "body_images": [
    {
      "ref_id": "img-1",
      "placement": "after_h2:1",
      "intent": "concept_illustration",
      "description": "Timeline visual das 4 fases da trajetória",
      "prompts": [
        { "rank": 1, "prompt": "...", "rationale": "...", "alt_text_pt": "...", "alt_text_en": "..." },
        { "rank": 2, "prompt": "...", "rationale": "...", "alt_text_pt": "...", "alt_text_en": "..." },
        { "rank": 3, "prompt": "...", "rationale": "...", "alt_text_pt": "...", "alt_text_en": "..." }
      ],
      "chosen": null,
      "image_url": null,
      "fallback_search": "career timeline infographic - Unsplash",
      "status": "prompt_ready"
    }
  ]
}
```

### Cover

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `cover.prompts` | Prompt[] | sim | 3 prompts rankeados (1=recomendada, 2=variação, 3=approach diferente) |
| `cover.prompts[].rank` | number 1-3 | sim | Ordem de recomendação |
| `cover.prompts[].prompt` | string | sim | Prompt Midjourney completo (com --ar e --v) |
| `cover.prompts[].rationale` | string | sim | Por que esta opção |
| `cover.prompts[].alt_text_pt` | string | sim | Texto alternativo PT para SEO/accessibility |
| `cover.prompts[].alt_text_en` | string | sim | Texto alternativo EN |
| `cover.chosen` | number 1-3 \| null | não | Preenchido quando criador escolhe |
| `cover.image_url` | URL \| null | não | Preenchido após upload |
| `cover.fallback_search` | string | não | Termos de busca Unsplash/Pexels se Midjourney falhar |
| `cover.status` | string | não | `prompt_ready` → `generating` → `generated` → `uploaded` |

### Body images

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `body_images[].ref_id` | string | sim | Vincula ao placeholder no draft: `![ref_id: desc](placeholder_url)` |
| `body_images[].placement` | string | sim | Posição no draft: `after_h2:N`, `after_paragraph:N`, `before_cta` |
| `body_images[].intent` | string | sim | `concept_illustration`, `data_visualization`, `emotional_break`, `process_diagram`, `screenshot` |
| `body_images[].description` | string | sim | O que a imagem mostra |
| `body_images[].prompts` | Prompt[] | sim | Mesma estrutura do cover (3 rankeados) |
| `body_images[].chosen` | number \| null | não | Índice escolhido |
| `body_images[].image_url` | URL \| null | não | URL final após upload |
| `body_images[].fallback_search` | string | não | Termos Unsplash |
| `body_images[].status` | string | não | Mesmo workflow do cover |

### Prompts Midjourney — regras

- **Cover:** sempre `--ar 16:9` (hero 1200×675)
- **Body images:** `--ar 16:9` ou `--ar 3:2`
- **Versão:** `--v 6.1` (ou mais recente)
- **Estilo:** cinematic, warm tones, natural light, sem stock-photo-feel
- **Evitar:** pessoas com rosto visível (Midjourney distorce), texto na imagem, logos
- **Structure:** [subject] + [setting] + [lighting] + [camera/lens] + [mood] + [parameters]

### Placeholders no draft

Quando a skill gera imagens no `images_shared`, inserir placeholders correspondentes no draft body. O editor detecta automaticamente placeholders `placehold.co` e imagens com prefixo `img-*:` no alt text, exibindo um card interativo com botões "Upload" e "Buscar existente".

```markdown
![img-cover: Descrição da imagem de capa](https://placehold.co/1200x675/1a1a2e/e2e8f0?text=COVER)
![img-1: Descrição da imagem](https://placehold.co/800x450/1a1a2e/e2e8f0?text=IMG-1)
```

**Regras:**
- O `ref_id` do placeholder DEVE corresponder ao `ref_id` no `body_images[]`
- O prefixo do alt text DEVE ser `img-<ref_id>:` seguido de descrição
- A URL DEVE usar domínio `placehold.co` para detecção automática
- Quando o criador seleciona uma imagem real via o card, a URL placeholder é substituída automaticamente no draft
- Se o campo `image_url` no `body_images[]` for preenchido via API, substituir também a URL placeholder no draft

### Otimização de imagem

Conversão para WebP, responsive sizes (400w/800w/1200w) e lazy loading são responsabilidade do CMS na graduação. Skills não gerenciam otimização — basta que `image_url` aponte para a imagem original.

---

## Sections sem renderer especializado (usam GenericRenderer)

Seções sem renderer dedicado usam `GenericRenderer`:

- **String ou JSONContent** → renderizado via `PipelineEditor preset="compact"` (rich text com formatação limitada — sem H2, sem task list, sem callout)
- **Object estruturado (JSON)** → renderizado como JSON pretty-print / textarea para edição

| Section | Formato | Renderização |
|---------|---------|-------------|
| `seo` (blog_post) | object | JSON pretty-print |
| `images` (blog_post, shared) | object | JSON pretty-print |
| `content` (newsletter) | string ou object | Rich text (compact) se string; JSON se object |
| `layout` (newsletter) | object | JSON pretty-print |
| `audience` (newsletter) | object | JSON pretty-print |
| `send` (newsletter) | object | JSON pretty-print |
| `curriculum` (course, shared) | object | CurriculumContentSchema — see Course domain docs |
| `lessons` (course, per-lang) | object | Record<lesson_id, LessonScript> — see Course domain docs |
| `material` (course, per-lang) | object | Record<lesson_id, MaterialItem[]> — see Course domain docs |
| `launch` (course, shared) | object | LaunchContentSchema (PLF) — see Course domain docs |
| `publish` (course, per-lang) | object | Sales page content — see Course domain docs |
| `briefing` (campaign) | object | JSON pretty-print |
| `assets` (campaign) | object | JSON pretty-print |
| `metrics` (campaign) | object | JSON pretty-print |

---

## Video — lifecycle & kanban control

O formato **video** tem **7 stages** (DB) que se dobram em **4 colunas** no hub:

| Stage (DB) | Posição | Coluna do hub |
|------------|---------|---------------|
| `idea` | 1 | **Ideia** |
| `roteiro` | 2 | **Roteiro** |
| `gravacao` | 3 | **Gravação** |
| `edicao` | 4 | **Gravação** |
| `pos_producao` | 5 | **Gravação** |
| `scheduled` | 6 | **Publicado** |
| `published` | 7 | **Publicado** |

A coluna **Gravação** agrupa `gravacao` + `edicao` + `pos_producao`; a coluna **Publicado** agrupa `scheduled` + `published`. As abas de seção abrem assim: coluna `idea`→aba Ideia, `roteiro`→Roteiro, `gravacao`(=gravacao/edicao/pos_producao)→Pós, `published`(=scheduled/published)→Publicação. Pós/Publicação destravam quando o stage atinge posição ≥ `gravacao` (≥3).

**Como Cowork move um card:**

- `POST /items/:id/advance` — avança **um** stage (idea→roteiro→gravacao→…).
- `POST /items/:id/retreat` — recua **um** stage.
- `PATCH /items/:id` com `{ "stage": "<stage>" }` + header `X-Expected-Version: <item.version>` — **salto** direto para qualquer stage válido.
- `POST /items/bulk` — operações em lote em vários itens. Body usa o wrapper `operations[]`:
  ```json
  {
    "operations": [
      { "op": "advance", "id": "<uuid>" },
      { "op": "retreat", "id": "<uuid>" }
    ]
  }
  ```
  `op` ∈ `advance` \| `retreat` \| `archive` \| `restore` \| `tag` \| `update`; máximo **50** operações. `update` também exige `version` (e `data`); `tag` usa `data: { add: [], remove: [] }`.

**Não há gate de VVS para vídeo** — o card pode avançar livremente pelos stages (diferente de fluxos que exigem score de viabilidade).

> **Published-freeze:** quando o stage do item atinge posição ≥ `published`/`scheduled`, as seções `ideia`/`roteiro`/`postprod`/`publish` ficam **READ-ONLY** e qualquer PATCH retorna HTTP 403 (`"Section is read-only while published"`) — edite-as antes de publicar, ou dê `retreat` no card primeiro.

---

## Video — `format_metadata`

`format_metadata` é **nível-de-item** (não é uma seção): atualizado via `PATCH /items/:id` (com `X-Expected-Version`), e é **substituição de objeto inteiro** — envie sempre o objeto completo, não um patch parcial. Schema = `VideoMetadataSchema` (`.strict()`).

Campos que Cowork usa:

| Campo | Tipo | Notas |
|-------|------|-------|
| `pillar` | enum `viagem` \| `ia` \| `codigo` \| `games` \| `nas` | Pilar do conteúdo — alimenta o **trilho de pilar** do hub |
| `duration_range` | string ≤40 (ex. `"10-12 min"`) | **Faixa de duração planejada** mostrada no card do hub — distinta da duração real do YouTube |
| `recorded_at` | string ≤40 (ex. `"23 abr 2026"` \| `"—"`) | Data de gravação (texto livre) |

Outros campos opcionais do schema: `playlist_letter`, `episode_number`, `duration_estimate_min`, `thumbnail_concept`, `recording_location`, `equipment_notes`.

Exemplo (PATCH `/items/:id`, objeto completo):
```json
{
  "format_metadata": {
    "pillar": "viagem",
    "duration_range": "10-12 min",
    "recorded_at": "23 abr 2026"
  }
}
```

### Criar um vídeo (`POST /items`)

`POST /items` usa o **wrapper `items[]`** (mesmo para criar um só):
```json
{
  "items": [
    {
      "format": "video",
      "title_pt": "Por que saí do Canadá depois de 4 anos",
      "title_en": "Why I left Canada after 4 years",
      "format_metadata": { "pillar": "viagem", "duration_range": "10-12 min" }
    }
  ]
}
```

Pelo menos um título (`title_pt` ou `title_en`) é obrigatório. O item nasce no stage inicial `idea`.

**GET-OR-CREATE (uma história = um id).** `POST /items` (e o `create_item` do MCP) é idempotente por título: se já existe um item NÃO-arquivado com esse `title_pt`/`title_en` (case-insensitive, no mesmo site + `format`), a chamada retorna o item existente em vez de criar outro — sem erro, sem duplicata. Vídeo e blog_post podem ter o mesmo título (escopo por `format`). Para mexer numa história existente, edite o id dela (`update_item`/`manage_sections`); não chame `create_item` de novo esperando id novo ou uma 'versão'. Na dúvida, busque antes com `search_content`.

---

## Campos do item (PATCH)

Além das seções, o pipeline item tem campos no nível do item que podem ser atualizados via PATCH:

| Campo | Tipo | Notas |
|-------|------|-------|
| `category` | `"stories"` \| `"building"` \| `"money"` \| `"bts"` \| `null` | Só relevante para format `blog_post`. Transferido na graduação (default: `building`). A categoria `money` cobre finanças, fitness, livros, relacionamentos, rotina. |
| `cover_image_url` | URL string \| `null` | Imagem de capa. Crop 16:9, max 1200×675. Transferida na graduação para `blog_posts.cover_image_url`. |

Estes campos são gerenciados pela UI (dropdown de categoria, galeria de mídia). Cowork não precisa atualizá-los diretamente — mas pode referenciar `category` ao gerar conteúdo que mencione a categoria do post.

---

## Regras gerais

1. **Seções estruturadas** (`roteiro`, `brolls`, `postprod_*`, `publish`, `seo`, `images`, etc.): enviar JSON estruturado com os campos tipados documentados acima
2. **Seções de texto** (`draft`, `ideia.body`, `content`): enviar **markdown como string** — será convertido automaticamente para rich text via Tiptap. Use headings, listas, blockquotes, bold, links.
3. **Campos opcionais**: omitir ao invés de enviar `null` ou string vazia
4. **Status values**: usar MAIÚSCULAS (`DRAFT`, `PENDING`, `DONE`, `ON_TRACK`, etc.)
5. **Timestamps**: formato `MM:SS` para display, formato SRT `HH:MM:SS,mmm --> HH:MM:SS,mmm` para cross-ref
6. **Idioma**: conteúdo no idioma da seção (`_pt` = PT-BR, `_en` = EN). Tags de script são sempre em inglês.
7. **`source`**: sempre `"cowork"` quando gerado por AI
8. **`modified_by`**: sempre `"cowork-claude"` para rastreabilidade

---

## Playlists

Para referência completa da API de playlists (CRUD, edges, auto-layout, workflows), consulte a documentação de playlists:

```
GET /api/pipeline/docs/playlists
```

Resumo dos endpoints disponíveis:
- `GET/POST /api/pipeline/playlists` — listar / criar
- `GET/PATCH/DELETE /api/pipeline/playlists/:id` — detalhe / atualizar / deletar
- `POST /playlists/:id/items`, `/items/bulk`, `DELETE /items/:itemId` — gerenciar items
- `POST /playlists/:id/edges`, `/edges/bulk`, `DELETE /edges/:edgeId` — gerenciar edges
- `POST /playlists/:id/reorder` — reordenar items
- `POST /playlists/:id/auto-layout` — auto-posicionar nós

---

## Blog Post Draft Section Schema

When format is `blog_post`, the `draft_{locale}` section content has this expanded shape:

```json
{
  "body": "<TipTap JSONContent>",
  "title": "string",
  "slug": "string (URL-friendly, auto-generated from title if empty)",
  "excerpt": "string (2-3 sentence summary)",
  "key_points": ["string", "string"],
  "pull_quote": "string (featured quote from post)",
  "notes": ["string (internal notes)"],
  "colophon": "string (credits/attributions)",
  "tag_id": "uuid (FK to blog_tags)",
  "hashtag_ids": ["uuid (FK to hashtags)"],
  "cover_image_url": "string (URL from Media Gallery)"
}
```

When updating a blog draft section via PATCH, include ALL fields you want to set.
The `body` field accepts TipTap JSONContent with the blog preset extensions:
StarterKit (H1-H4), MergeTag, CTAButton, PlaylistEmbed, SocialEmbed, SlashCommand,
Callout, Toggle, Columns, Table, TaskList.

## Blog Post SEO Section Schema

The `seo_{locale}` section content:

```json
{
  "meta_title": "string (ideal: 60 chars, max: 70)",
  "meta_description": "string (ideal: 155 chars, max: 170)",
  "slug": "string (mirrors draft slug)",
  "keywords": ["string"],
  "og_image_url": "string (1200x630)"
}
```

---

## Recording Status (per-beat, per-lang) — "Gravação por beat"

Video items track **what is already in the can** per recording unit, per language. The
unit of durable status is the **beat** (a `fala` beat ≈ one take). Status keys on
`(pipeline_id, lang, beat_id)` and lives in a dedicated `video_recording_status` table —
**NOT** inside the roteiro JSONB. Therefore:

- It **never** bumps `content_pipeline.version` (no `X-Expected-Version` here).
- It is **NOT frozen by publish.** The creator records before publishing and may flag
  `refazer` after. Roteiro content has a published-readonly guard; recording status does not.

### 3-state status

| status     | meaning                                          |
|------------|--------------------------------------------------|
| `pendente` | not yet recorded (default)                       |
| `gravada`  | recorded — in the can                            |
| `refazer`  | recorded but needs a retake (optional note ≤500) |

`retake_note` is only meaningful when `status = refazer`; it is cleared on any other status.

### Reconciliation contract (read time)

Every GET re-derives the current `fala` beats from the live roteiro of the requested lang,
stamps stable beat ids in-memory, computes each beat's `content_hash`, and matches the
stored rows by `beat_id`:

| situation                                  | result                                                 |
|--------------------------------------------|--------------------------------------------------------|
| same `beat_id` + same `content_hash`       | carry `status` / `retake_note` verbatim, `stale: false`|
| same `beat_id`, **different** `content_hash` | carry `status` / `retake_note`, **`stale: true`** ("roteiro mudou desde a gravação") |
| beat with no stored row                    | `status: pendente`, `stale: false`                     |
| stored row whose `beat_id` is gone         | **orphan** (surfaced, never auto-deleted)              |

A changed beat is **never** shown as a silent `✓ gravada` — `stale: true` is loud and
visible so a remote shoot does not skip a beat whose text was rewritten.

> ⚠️ **CONTRACT RULE #1 — `content_hash` is REQUIRED for stale detection.**
> Reconcile flags `stale: true` **only when the stored row's `content_hash` is non-null**
> *and* differs from the live beat hash. If a writer (PUT / PATCH batch / MCP `set`) marks a
> beat `gravada` or `refazer` **without** sending `content_hash`, the row is stored with
> `content_hash = null`, and that beat can then **NEVER** be flagged "roteiro mudou desde a
> gravação." It will show a permanent, silent `✓ gravada` even after the script text is
> fully rewritten — exactly the take-skipped-on-set failure this ledger exists to prevent.
>
> **Therefore: any writer marking a beat `gravada`/`refazer` MUST echo back the
> `content_hash` it received from the GET reconcile for that same beat_id.** Omitting it
> silently forfeits stale detection for that beat forever (until it is re-recorded with a
> hash). This is the single most important rule of this surface — never write a recorded
> status without its `content_hash`.

### Endpoints

```
GET    /api/pipeline/items/:id/recording?lang=pt          (auth: read)
PUT    /api/pipeline/items/:id/recording?lang=pt          (auth: write)
PATCH  /api/pipeline/items/:id/recording/batch?lang=pt    (auth: write)
DELETE /api/pipeline/items/:id/recording/orphans?lang=pt  (auth: write)
```

`lang` is `pt` (default) or `en`. The roteiro for that lang must exist for beats to be
derived; otherwise the response carries `roteiro_present: false` and empty `beats`.

#### GET — derive + reconcile

> **GET returns ONLY performer (`fala`) beats.** The reconcile derives status exclusively
> for `fala` beats (one `fala` beat ≈ one take). `acao` / `prep` / `editor` beats are *not*
> recording units and are skipped entirely. **Consequence:** if a writer sends a status for
> a beat_id that is not a `fala` beat, that row will never match the live roteiro and will
> reconcile as a permanent **orphan**. So always **read GET first and only set statuses for
> the `beat_id`s it returns in `beats[]`** — never invent ids or reuse ids from a roteiro
> dump that include non-`fala` beats.

Response:
```json
{
  "data": {
    "beats": [
      {
        "beat_id": "string (stable beat id)",
        "beat_name": "HOOK",
        "status": "pendente | gravada | refazer",
        "retake_note": "string | null",
        "content_hash": "string (current beat text hash — pass this back on write)",
        "updated_at": "ISO datetime | null (the stored row's updated_at — pass as if_unmodified_since on write; null when no row yet)",
        "stale": false
      }
    ],
    "orphans": [
      { "beat_id": "...", "status": "gravada", "retake_note": null, "beat_name": "...", "content_hash": "..." }
    ],
    "roteiro_present": true
  },
  "meta": { "item_version": 7 }
}
```

The `beats[]` array is exactly the set of `fala` beats in roteiro order. A `beat_id` you do
not see here is either non-`fala` (won't be tracked) or absent from the roteiro (would be an
orphan) — do not write to it.

#### PUT — upsert one beat

Body:
```json
{
  "beat_id": "string (required — from GET)",
  "status": "gravada",
  "retake_note": "string (≤500, only kept when status=refazer)",
  "beat_name": "string (optional, display + reconciliation)",
  "content_hash": "string (STRONGLY RECOMMENDED — pass the value from GET; omitting it forfeits stale detection forever, see Contract Rule #1)",
  "source": "cowork | user (optional; defaults cowork for API-key callers)",
  "if_unmodified_since": "ISO datetime (optional — per-row concurrency; the updated_at you read from GET for this beat)"
}
```

**`content_hash`:** schema-optional, contract-required for any `gravada`/`refazer` write.
Send the exact `content_hash` GET returned for this `beat_id`. Omitting it stores a null
hash and permanently disables "roteiro mudou desde a gravação" for the beat (Contract
Rule #1 above).

**`if_unmodified_since` source:** it is the **`updated_at` of the beat's stored row**. You
get it two ways:
- from the **GET reconcile payload** — each `beats[]` entry now carries `updated_at` (null
  when no row exists yet, in which case omit `if_unmodified_since`);
- echoed back in a **412** rejection at `error.details.current.updated_at`.

If `if_unmodified_since` is supplied and the existing row's `updated_at` is **newer**, the
write is rejected with **412 PRECONDITION_FAILED** and the current row in
`error.details.current` (which includes the live `updated_at`, `status`, `content_hash`,
etc.). **412 means: the row changed since you read it.** Recovery: **re-GET** the recording
view, take the fresh `status` / `content_hash` / `updated_at` for that beat, decide whether
your write still applies, and **retry** with the new `if_unmodified_since`. Response on
success: `{ "data": { "row": { ... } } }`.

#### PATCH /batch — multi-row upsert

Body `{ "updates": [ { beat_id, status, retake_note?, beat_name?, content_hash? }, ... ] (max 100), "source": "cowork" }`.
Response: `{ "data": { "rows": [...], "updated": <n> } }`.

Same Contract Rule #1 applies per update: every `gravada`/`refazer` entry **must** carry the
`content_hash` from GET, or that beat loses stale detection. The batch endpoint has **no**
`if_unmodified_since` (no per-row precondition) — use single PUT when you need optimistic
concurrency. Only set `beat_id`s that GET returned in `beats[]` (the `fala` set); any other
id becomes a permanent orphan.

#### DELETE /orphans — purge

Recomputes orphans **server-side** (rows whose `beat_id` is absent from the current
roteiro content) and deletes them. Response: `{ "data": { "purged": <n>, "orphan_beat_ids": [...] } }`.
Never deletes a beat that still exists.

### MCP — `manage_recording`

The same surface via MCP (uses the permanent `PIPELINE_COWORK_KEY` path; never creates or
revokes keys). Actions:

| action          | maps to             | notes                                       |
|-----------------|---------------------|---------------------------------------------|
| `read`          | GET                 | reconciled beats + orphans                  |
| `set`           | PUT                 | one beat; honors `if_unmodified_since`      |
| `batch`         | PATCH /batch        | up to 100 updates                           |
| `purge-orphans` | DELETE /orphans     | recomputed server-side                      |

Write actions (`set`, `batch`, `purge-orphans`) preview with `dry_run: true` (default) and
execute with `dry_run: false`.

**Driving `manage_recording` without silent failures — the loop:**
1. `read` first. Keep each beat's `beat_id`, `content_hash`, and `updated_at`.
2. To mark a take, `set` (or `batch`) with **the same `content_hash`** you read — never omit
   it on a `gravada`/`refazer` write (Contract Rule #1), or stale detection is lost forever.
3. For `set`, pass `if_unmodified_since` = the beat's `updated_at` from step 1. On **412**,
   `read` again and retry with the fresh values.
4. Only target `beat_id`s that `read` returned; non-`fala` / unknown ids become orphans.

Recording status is **NOT** published-frozen: `set`/`batch` succeed on a published item by
design (record before publish, `refazer` after).
