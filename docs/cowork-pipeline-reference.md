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

## Section: `ideia` (shared)

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

## Section: `roteiro` (per-lang)

```json
{
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
      "number": 1,
      "label": "Hook — Abrir com vulnerabilidade",
      "text": "[DIRECTION: calmo, próximo da câmera, sem drama]\n> \"Eu morei quatro anos no Canadá e nunca me senti em casa.\"\n[PAUSE 0.8s]\n- Olhar direto para câmera\n- Não gesticular\n[VISUAL: Close-up, profundidade rasa, luz natural suave]",
      "status": "DRAFT"
    }
  ]
}
```

**Nota:** O campo `text` dos beats usa um parser próprio (`parseScriptTags`) — NÃO usa Tiptap. Não enviar markdown rich text nos beats; usar a tag syntax abaixo.

### Tag Syntax (inline no campo `text` dos beats)

| Tag | Uso |
|-----|-----|
| `[DIRECTION: desc]` | Direção de performance (postura, energia, olhar, pacing) |
| `[VISUAL: desc]` | Instrução de câmera/enquadramento |
| `[B-ROLL: desc]` | Referência a footage de B-Roll |
| `[CORTE: desc]` | Instrução de corte/edit point |
| `[OVERLAY: desc]` | Text overlay ou lower third |
| `[TRANS: desc]` | Transição entre cenas/beats |
| `[SFX: desc]` | Efeito sonoro |
| `[PAUSE Xs]` ou `[PAUSA Xs]` | Pausa cronometrada |

### Formatação dentro de beats

- **Narração falada**: Use blockquote `> "Texto que será falado"`
- **Itens de ação**: Use bullets `- Ação específica`
- **NÃO** usar markdown bold `**texto**` ao redor de tags
- **NÃO** inventar tags fora da lista acima
- Tags são sempre MAIÚSCULAS e em inglês (exceto PAUSA como alias de PAUSE)

### Beat statuses válidos
`DRAFT`, `REVIEW`, `APPROVED`, `DONE`

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
        "Style: needs to feel intimate, think \"Casey Neistat confessional\"",
        "00:15 entry: fade in música ambiente",
        "00:30-00:45 montage of photos — Ken Burns slow zoom",
        "Search artist: Lo-fi ambient, mood: introspective, BPM: 70-80"
      ],
      "music": {
        "search_terms": "lo-fi ambient introspective",
        "style": "Minimal piano + textura",
        "entry_cue": "Fade in at 00:15",
        "continuation": "Continues into scene 2"
      },
      "sfx": [
        { "timestamp": "00:05", "description": "Room tone fade in", "search_terms": "room ambience quiet" }
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

### edit_notes categorization rules

O renderer categoriza `edit_notes` automaticamente:

| Categoria | Trigger (case-insensitive) |
|-----------|---------------------------|
| OVERLAY | `text overlay`, `lower third` |
| MUSIC | `search artist`, `mood:`, `genre:`, `bpm:`, `track change`, `new track` |
| STYLE | começa com `style:`, `needs to feel`, `think "` |
| ENTRY | começa com `entry:` |
| VISUAL | `montage`, `ken burns`, `b-roll`, `photo` |
| TIMING | começa com `00:00` timestamp, `fade in`, `fade out` |
| FLOW | `continues`, `don't change`, `same track` |
| NOTE | default (nenhum match) |

Notas com timestamps `00:00` ou `00:00-00:00` são agrupadas numa timeline visual.
Prefixo `optional` marca nota como opcional.

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

## Section: `publish` (per-lang)

```json
{
  "title": {
    "chosen": "Por que saí do Canadá depois de 4 anos",
    "alternatives": [
      "4 anos no Canadá: não era pra mim",
      "A verdade sobre morar fora"
    ]
  },
  "description": "Neste vídeo conto por que voltei ao Brasil...\n\n#expatriado #canada #voltarbrasil\n\n00:00 Intro\n02:30 A decisão\n05:00 O retorno\n\nMe siga: @thiago.fig",
  "tags": ["expatriado", "canada", "voltarbrasil", "morarnofora"],
  "cards": [
    { "timestamp": "02:30", "text": "Por que você decidiu voltar?", "type": "question" },
    { "timestamp": "08:15", "text": "Assista: Custo de vida no Canadá", "type": "video" }
  ],
  "end_screen": {
    "type": "Video + Subscribe",
    "video_suggestion": "Quanto custa morar no Canadá em 2026"
  },
  "strategy": [
    "D+0: Publicar às 18h BRT (pico de audiência)",
    "D+0: Compartilhar stories + comunidade",
    "D+1: Pin comment com pergunta engajadora",
    "Semana 1: Cross-post no LinkedIn com adaptação"
  ]
}
```

### Title
- `chosen`: Título principal (YouTube recomenda ≤70 chars para busca)
- `alternatives`: 2-3 opções alternativas

### Description
- Incluir hashtags com `#`
- Incluir timestamps no formato `00:00 Label`
- Incluir handles com `@`
- Primeiros 200 chars são visíveis sem expandir no YouTube

### Cards
- `type`: `question`, `poll`, `video`, `clip`
- `timestamp`: quando o card aparece no formato `MM:SS`

### Strategy
- Prefixar steps com fase temporal: `D+0:`, `D+1:`, `Semana 1:`, `Fase 1:`
- O renderer destaca automaticamente esses prefixos como chips visuais

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
| `curriculum` (course) | object | JSON pretty-print |
| `lessons` (course) | object | JSON pretty-print |
| `material` (course) | object | JSON pretty-print |
| `briefing` (campaign) | object | JSON pretty-print |
| `assets` (campaign) | object | JSON pretty-print |
| `metrics` (campaign) | object | JSON pretty-print |

---

## Campos do item (PATCH)

Além das seções, o pipeline item tem campos no nível do item que podem ser atualizados via PATCH:

| Campo | Tipo | Notas |
|-------|------|-------|
| `category` | `"stories"` \| `"building"` \| `"control"` \| `"bts"` \| `null` | Só relevante para format `blog_post`. Transferido na graduação (default: `building`). Nota: `"money"` renomeado para `"control"` em 2026-05-12 — cobre finanças, fitness, livros, relacionamentos, rotina. |
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

Playlists organizam conteúdo (blog posts, newsletters, pipeline items) em sequências visuais via um editor de grafos no CMS. Cowork pode adicionar itens graduados automaticamente a playlists relevantes.

### Locale

Playlists usam campos denormalizados para i18n (igual a youtube_categories):

| Campo | Tipo | Notas |
|-------|------|-------|
| `name_en` | TEXT NOT NULL | Nome em inglês (obrigatório, idioma primário) |
| `name_pt` | TEXT NOT NULL | Nome em português (default: vazio) |
| `description_pt` | TEXT | Descrição em português |
| `description_en` | TEXT | Descrição em inglês |
| `slug` | TEXT | Slug único por site (single, não per-locale) |

### API Endpoints

```
GET  /api/pipeline/playlists        → Lista todas as playlists do site
GET  /api/pipeline/playlists/:id    → Retorna playlist com items e edges (grafo completo)
```

Ambos usam a mesma autenticação do pipeline (`X-Pipeline-Key` ou session).

**Resposta `GET /api/pipeline/playlists`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name_pt": "Começando com TypeScript",
      "name_en": "Getting Started with TypeScript",
      "slug": "comecando-com-typescript",
      "status": "draft",
      "category": "TypeScript",
      "description_pt": "Série para quem está começando com TypeScript",
      "description_en": "Series for those getting started with TypeScript",
      "cover_image_url": null,
      "item_count": 5,
      "created_at": "2026-05-14T...",
      "updated_at": "2026-05-14T..."
    }
  ]
}
```

**Resposta `GET /api/pipeline/playlists/:id`:**
```json
{
  "data": {
    "playlist": { "id": "...", "name_pt": "...", "name_en": "...", "slug": "...", "status": "...", "category": "...", "description_pt": "...", "description_en": "...", "cover_image_url": null, "created_at": "...", "updated_at": "..." },
    "items": [
      {
        "id": "uuid",
        "title": "Resolved title from blog/newsletter/pipeline",
        "content_type": "blog_post|newsletter|pipeline|null",
        "status": "published",
        "category": "building",
        "position_x": 200, "position_y": 100,
        "sort_order": 1000,
        "is_ghost": false,
        "other_playlist_count": 1
      }
    ],
    "edges": [
      { "id": "uuid", "source_item_id": "...", "target_item_id": "...", "edge_type": "sequence", "label": null }
    ]
  }
}
```

### Server Actions disponíveis

| Action | Parâmetros | Retorno |
|--------|-----------|---------|
| `addItemToPlaylist(siteId, input)` | `{ playlistId, blogPostId?, newsletterEditionId?, pipelineId?, sortOrder?, positionX?, positionY? }` | `ActionResult<{ id: string }>` |
| `removeItemFromPlaylist(playlistItemId, siteId)` | — | `ActionResult<void>` |
| `createEdge(siteId, input)` | `{ playlistId, sourceItemId, targetItemId, edgeType, label? }` | `ActionResult<{ id: string }>` |
| `deleteEdge(edgeId, siteId)` | — | `ActionResult<void>` |
| `reorderPlaylistItems(siteId, playlistId, itemIds)` | `itemIds` em ordem desejada | `ActionResult<void>` |
| `getPlaylistWithItems(playlistId, siteId)` | — | `ActionResult<PlaylistGraph>` |

### Edge types

| Type | Semântica | Uso |
|------|----------|-----|
| `sequence` | Ordem de leitura linear | Seta azul, define sort_order visual |
| `related` | "Veja também" | Linha cinza tracejada, sem seta |
| `prerequisite` | "Leia antes" | Seta amarela tracejada |
| `continuation` | Continuação direta | Seta verde |

### Integração com graduação

Quando um pipeline item é graduado (ex: blog_post → blog_posts), o item pode ser adicionado a uma playlist existente:

1. Buscar playlists do site via `GET /api/pipeline/playlists` para encontrar playlists relevantes (por category ou conteúdo relacionado)
2. Usar `addItemToPlaylist` com o `blogPostId` (ou `newsletterEditionId`) do conteúdo graduado
3. Opcionalmente criar `sequence` edge conectando ao último item da playlist

### TipTap Embed

Playlists podem ser embeddadas em blog posts e newsletters via TipTap custom node:

- Slash command: `/playlist` no editor
- HTML output: `<div data-playlist-embed data-playlist-id="..." data-playlist-name="..." data-playlist-slug="..." data-item-count="...">`
- O node armazena `playlistId`, `playlistName`, `playlistSlug`, `itemCount` como atributos

### Regras

1. Cada conteúdo aparece **no máximo uma vez** por playlist (constraint único no DB)
2. Não criar edges de self-loop (source === target) — o DB rejeita com constraint
3. Sequence edges não podem criar ciclos — o DB tem trigger `prevent_sequence_cycle` que rejeita
4. `sortOrder` usa incrementos de 1000 (ex: 1000, 2000, 3000) para permitir inserções intermediárias
5. Posições no canvas (`positionX`, `positionY`) são opcionais — se omitidas, default (0,0) e o editor oferece auto-layout
6. `name_en` é obrigatório (idioma primário); `name_pt` pode ser vazio — sempre exibir `name_en` como fallback. Slug é gerado a partir do `name_en`
