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
        "Search Artlist: Mood: Introspective | Genre: Lo-fi | BPM: 70-80 | Duration: 2+ min"
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
| MUSIC | `search artlist`, `search artist`, `mood:`, `genre:`, `bpm:`, `track change`, `new track` |
| STYLE | começa com `style:`, `needs to feel`, `think "` |
| ENTRY | começa com `entry:` |
| VISUAL | `montage`, `ken burns`, `b-roll`, `photo` |
| TIMING | começa com `00:00` timestamp, `fade in`, `fade out` |
| FLOW | `continues`, `don't change`, `same track` |
| NOTE | default (nenhum match) |

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

Para referência completa da API de playlists (CRUD, edges, auto-layout, workflows), consulte a referência `playlist-graph-api` no contexto do pipeline:

```
GET /api/pipeline/context/playlist-graph-api
```

Resumo dos endpoints disponíveis:
- `GET/POST /api/pipeline/playlists` — listar / criar
- `GET/PATCH/DELETE /api/pipeline/playlists/:id` — detalhe / atualizar / deletar
- `POST /playlists/:id/items`, `/items/bulk`, `DELETE /items/:itemId` — gerenciar items
- `POST /playlists/:id/edges`, `/edges/bulk`, `DELETE /edges/:edgeId` — gerenciar edges
- `POST /playlists/:id/reorder` — reordenar items
- `POST /playlists/:id/auto-layout` — auto-posicionar nós

---

## Research Library

Auth: `X-Pipeline-Key` header (write permission para mutações). **NÃO use `Authorization: Bearer`.**

### POST /api/pipeline/research — Create/upsert research item

Claude pushes research via this endpoint. Duplicate title+topic = upsert (updates content, resets status to 'new').

```bash
curl -X POST https://bythiagofigueiredo.com/api/pipeline/research \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "WYD Ongame Era — Early MMORPG History",
    "topic_slug": "gaming-history/wyd",
    "content_md": "# WYD Research\n\n...",
    "summary": "Research about WYD Online during the Ongame era (2003-2008)",
    "sources": [
      { "url": "https://example.com/article", "title": "Source Article" }
    ]
  }'
```

Response includes `version` (use in PATCH). Status `201` = created, `200` = upserted.

**topic_slug convention:** Use kebab-case path segments. Auto-creates missing topics.
- `"estrategia"` → root topic (depth 0)
- `"gaming-history/wyd"` → parent + child (depth 0 + 1)
- `"cursos/ai-dev/prompt"` → 3 levels (depth 0 + 1 + 2)
- Max 3 levels. `"a/b/c/d"` → 400 error.

### GET /api/pipeline/research — List research items

Default: lightweight (no body content). Use `?include=content` for full content_md.

```
GET /api/pipeline/research?topic_slug=gaming-history&include=content
GET /api/pipeline/research?pipeline_item_id=<uuid>&include=content
GET /api/pipeline/research?status=new,reviewed&search=wyd
```

### GET /api/pipeline/research/:id — Full item detail

Returns both `content_md` and `content_json`, plus `linked_items` array.

### PATCH /api/pipeline/research/:id — Update research item

Requires `X-Expected-Version` header (use `version` from POST/GET response). Supports partial updates.

```bash
curl -X PATCH https://bythiagofigueiredo.com/api/pipeline/research/<uuid> \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -H "X-Expected-Version: 1" \
  -d '{ "status": "archived" }'
```

Updatable fields: `title`, `content_md`, `summary`, `sources`, `status` (`new`, `reviewed`, `starred`, `archived`).
Returns 409 on version conflict.

### DELETE /api/pipeline/research/:id — Delete research item

```bash
curl -X DELETE https://bythiagofigueiredo.com/api/pipeline/research/<uuid> \
  -H "X-Pipeline-Key: $KEY"
```

### POST /api/pipeline/research/import — Bulk import

```json
{
  "items": [
    { "title": "...", "topic_slug": "...", "content_md": "..." },
    { "title": "...", "topic_slug": "...", "content_md": "..." }
  ]
}
```

Max 50 items. Each processed independently; partial failures don't block others.

---

## Audio Library

Auth: `X-Pipeline-Key` header (read for queries, write for mutations). **NÃO use `Authorization: Bearer`.**

The Audio Library stores music and SFX assets with rich metadata (tags, mood, energy, BPM, instruments, reuse scenarios). A 2-phase resolver algorithm (SQL narrowing → TypeScript scoring) finds the best matches for any content production context.

### Key concepts

| Concept | Description |
|---------|-------------|
| `type` | `"music"` or `"sfx"` — every asset has exactly one |
| `status` | `"downloaded"` (ready to use), `"pending"` (needs download), `"retired"` (soft-deleted) |
| `asset_id` | Unique vendor ID (e.g. Artlist ID). Used for dedup on import. |
| `energy` | 1–5 scale. 1 = calm/ambient, 5 = intense/epic |
| `resolve_status` | Result quality: `LOCAL` (score ≥ 8, downloaded), `PENDING_MATCH` (score ≥ 8, pending download), `PARTIAL_MATCH` (score ≥ 4), `NO_MATCH` (score < 4) |
| `usage` | Links an asset to a pipeline item (scene_number, usage_type: background/sfx/transition/intro/outro) |

### POST /api/pipeline/audio-library/resolve — Smart audio matching

**This is the primary endpoint for Cowork.** Use it during post-production to find the best audio for each scene/segment.

```bash
curl -X POST https://bythiagofigueiredo.com/api/pipeline/audio-library/resolve \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "music",
    "category": "cinematic",
    "tags": ["epic", "motivational"],
    "mood": ["inspiring", "determined"],
    "energy": 4,
    "bpm_range": { "min": 100, "max": 140 },
    "duration_range": { "min": 60, "max": 180 },
    "instruments": ["piano", "strings"],
    "reuse_scenarios": ["intro", "highlight"],
    "description": "background music for tech tutorial intro",
    "limit": 5
  }'
```

**Response:**

```json
{
  "data": {
    "matches": [
      {
        "asset": { "id": "uuid", "asset_id": "artlist-12345", "original_filename": "Epic Rise.mp3", "type": "music", "category": "cinematic", "energy": 4, "bpm": 120, "tags": ["epic", "motivational"], "mood": ["inspiring"], "status": "downloaded", "..." : "..." },
        "score": 18,
        "breakdown": { "category": 5, "tags": 4, "mood": 2, "energy": 3, "bpm_in_range": 3, "duration_in_range": 0, "reuse_scenarios": 0, "instruments": 1, "description": 0 },
        "resolve_status": "LOCAL"
      }
    ],
    "query_time_ms": 12
  }
}
```

**Scoring algorithm (max ~36 points):**

| Criterion | Max points | Logic |
|-----------|-----------|-------|
| `category` | 5 | Exact match |
| `tags` | 8 | 2 pts per matching tag (capped at 8) |
| `mood` | 6 | 2 pts per matching mood (capped at 6) |
| `energy` | 3 | ±1 tolerance from query value |
| `bpm_in_range` | 3 | Within min–max range |
| `duration_in_range` | 2 | Within min–max range |
| `reuse_scenarios` | 4 | Any overlap = 4 points |
| `instruments` | 3 | 1 pt per matching instrument (capped at 3) |
| `description` | 2 | Full-text search match |

**Resolve status thresholds:**
- `LOCAL` — score ≥ 8 AND status = `downloaded` (ready to use immediately)
- `PENDING_MATCH` — score ≥ 8 AND status = `pending` (good match but needs download)
- `PARTIAL_MATCH` — score ≥ 4 (decent match, review recommended)
- `NO_MATCH` — score < 4 (poor match)

**Query fields (all optional except `type`):**

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"music"` \| `"sfx"` | **Required.** Asset type to search |
| `category` | string | Exact category match (e.g. "cinematic", "electronic") |
| `subcategory` | string | Sub-category filter |
| `tags` | string[] | Tag overlap filter |
| `mood` | string[] | Mood overlap filter |
| `energy` | 1–5 | Target energy level (±1 tolerance) |
| `bpm_range` | `{ min, max }` | BPM range filter |
| `duration_range` | `{ min, max }` | Duration in seconds |
| `instruments` | string[] | Instrument overlap filter |
| `reuse_scenarios` | string[] | Reuse context (e.g. "intro", "highlight", "review") |
| `description` | string | Free-text search (uses PostgreSQL websearch) |
| `limit` | 1–20 | Max results (default: 5) |

### GET /api/pipeline/audio-library — List assets

Paginated listing with filtering. Cursor-based pagination.

```
GET /api/pipeline/audio-library?type=music&status=downloaded&limit=50
GET /api/pipeline/audio-library?tags=epic,cinematic&energy_min=3&energy_max=5
GET /api/pipeline/audio-library?category=electronic&bpm_min=120&bpm_max=140
GET /api/pipeline/audio-library?q=ambient+piano&limit=20
GET /api/pipeline/audio-library?cursor=<last-item-uuid>&limit=50
```

**Query params:** `type`, `status`, `category`, `tags` (comma-separated), `mood` (comma-separated), `energy_min`, `energy_max`, `bpm_min`, `bpm_max`, `q` (full-text search), `cursor`, `limit` (1–200, default 50).

**Response includes:** `data` (array), `meta: { total, has_next, next_cursor, limit }`.

### POST /api/pipeline/audio-library — Create single asset

```bash
curl -X POST https://bythiagofigueiredo.com/api/pipeline/audio-library \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_id": "artlist-67890",
    "original_filename": "Calm Waters.mp3",
    "type": "music",
    "source": "artlist",
    "category": "ambient",
    "energy": 2,
    "bpm": 80,
    "tags": ["calm", "ambient", "nature"],
    "mood": ["peaceful", "reflective"],
    "instruments": ["piano", "synth pad"],
    "reuse_scenarios": ["background", "outro"],
    "reusable": true,
    "status": "downloaded"
  }'
```

Returns 201 with full asset. Returns 409 on duplicate `asset_id` or `sha256`.

### GET /api/pipeline/audio-library/:id — Asset detail with usage history

Returns full asset data plus `usage` array showing which pipeline items used this asset.

```json
{
  "data": {
    "id": "uuid", "asset_id": "artlist-12345", "...",
    "usage": [
      {
        "id": "uuid",
        "pipeline_item_id": "uuid",
        "scene_number": 3,
        "usage_type": "background",
        "notes": "Used during tech demo section",
        "content_pipeline": { "code": "EP042", "title_pt": "Como criar um agente AI", "format": "youtube_video" }
      }
    ]
  }
}
```

### PATCH /api/pipeline/audio-library/:id — Update asset

Requires `version` field for optimistic locking (from GET response). Returns 409 on version conflict.

```bash
curl -X PATCH https://bythiagofigueiredo.com/api/pipeline/audio-library/<uuid> \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "tags": ["epic", "motivational", "cinematic"],
    "energy": 5,
    "reuse_scenarios": ["intro", "highlight", "review"]
  }'
```

Updatable fields: all except `asset_id` and `type`. Always include `version`.

### DELETE /api/pipeline/audio-library/:id — Soft-delete (retire) asset

Sets status to `retired`. Asset remains in DB but excluded from resolve queries and exports.

```bash
curl -X DELETE https://bythiagofigueiredo.com/api/pipeline/audio-library/<uuid> \
  -H "X-Pipeline-Key: $KEY"
```

### POST /api/pipeline/audio-library/import — Bulk import

Import multiple assets at once. Supports `dry_run` mode for preview.

```bash
curl -X POST https://bythiagofigueiredo.com/api/pipeline/audio-library/import \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dry_run": false,
    "schema_version": "1.0",
    "music": [
      { "asset_id": "artlist-100", "original_filename": "Track A.mp3", "category": "cinematic", "tags": ["epic"], "energy": 4 },
      { "asset_id": "artlist-101", "original_filename": "Track B.mp3", "category": "electronic", "tags": ["upbeat"], "energy": 3 }
    ],
    "sfx": [
      { "asset_id": "sfx-200", "original_filename": "Whoosh.wav", "category": "transition" }
    ]
  }'
```

**Response (dry_run: true):**
```json
{ "data": { "dry_run": true, "preview": { "to_create": 2, "to_update": 1, "to_skip": 0, "errors": [] } } }
```

**Response (dry_run: false):**
```json
{ "data": { "dry_run": false, "import_log_id": "uuid", "created": 2, "updated": 1, "skipped": 0, "errors": [] } }
```

Max 500 items per type (1000 total). Upserts on `site_id + asset_id`. Each item processed independently; partial failures don't block others. Classification: `create` (new), `update` (exists with changes), `skip` (identical).

### GET /api/pipeline/audio-library/stats — Library statistics

```json
{
  "data": {
    "total": 245,
    "by_type": { "music": 180, "sfx": 65 },
    "by_status": { "downloaded": 200, "pending": 40, "retired": 5 },
    "by_category": { "cinematic": 50, "electronic": 40, "ambient": 30, "..." : "..." },
    "recently_added": 12,
    "needs_download": 40,
    "unused": 85
  }
}
```

### GET /api/pipeline/audio-library/export — Full library export

Downloads all non-retired assets as JSON (Content-Disposition: attachment). Use for backup or cross-system sync.

```bash
curl https://bythiagofigueiredo.com/api/pipeline/audio-library/export \
  -H "X-Pipeline-Key: $KEY" \
  -o audio-library-export.json
```
