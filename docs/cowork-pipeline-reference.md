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

## Section: `postprod` (per-lang) — DaVinci Timeline View

This is the **timeline-native** format that powers the DaVinci Resolve-like timeline UI. It describes clips on named tracks (V1-V7 video, A1-A6 audio) with start/end times in seconds, organized per beat.

**IMPORTANT:** This section MUST be written alongside or after `postprod_scenes`. While `postprod_scenes` captures editorial intent (music choice, SFX placement, narrative), `postprod` maps that intent onto a concrete multi-track timeline. Both sections should be consistent.

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

Assets are keyed by beat index (as string). Each beat can have `music[]`, `sfx[]`, `visual[]`, `ambience[]`, `soundDesign[]`. These populate the "ASSETS" collapsible panel below each beat's timeline. See existing `MusicAsset`, `SfxAsset`, etc. types for field details.

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

**Scoring algorithm (max 34 points):**

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

Total: **34 points**. The `description` field in the resolver response is for internal full-text ranking only — do NOT include it in `score_breakdown` for the UI. `score_max` is always `34`.

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
    "status": "downloaded",
    "metadata": {
      "waveform": { "peaks": [0.1, 0.3, 0.6, 0.9, 0.7, 0.5, 0.2] },
      "mix_notes": "Gentle piano intro, builds with strings at 0:45"
    }
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

### Metadata fields (JSONB `metadata` column)

The `metadata` column stores structured data that enriches the CMS UI. Include these in imports and PATCH updates. Fields are nested inside the `metadata` object.

| Field path | Type | Description | Example |
|-----------|------|-------------|---------|
| `waveform.peaks` | `number[]` (0–1, max 200 values) | Normalized amplitude peaks for visual waveform display. Generate from audio analysis. Values 0.0 (silence) to 1.0 (max amplitude). 40–80 samples ideal for card display, 60–120 for detail. | `[0.1, 0.35, 0.8, 0.6, ...]` |
| `pairs_well_with` | `string[]` | `asset_id`s of complementary tracks (shown in detail panel "Compatibility" section) | `["artlist-123", "artlist-456"]` |
| `avoid_with` | `string[]` | `asset_id`s that clash with this track | `["artlist-789"]` |
| `mix_notes` | `string` | Free-text mixing/usage notes (shown in detail panel) | `"Starts quiet, builds at 0:45. Good for layering under voiceover."` |
| `audio.loudness_lufs` | `number` | Measured loudness in LUFS | `-14.2` |
| `audio.sample_rate` | `number` | Sample rate in Hz | `44100` |
| `audio.bit_depth` | `number` | Bit depth | `24` |
| `audio.channels` | `number` | Channel count (1=mono, 2=stereo) | `2` |
| `video_mapping` | `object` | Scene-to-timestamp mapping for video editors | `{ "intro": "0:00-0:15", "build": "0:15-0:45" }` |
| `entry_style` | `string` | How the track should enter (fade, cut, crossfade) | `"fade"` |
| `duration_hint` | `string` | Recommended usage duration | `"30s-2min"` |

**Waveform peaks generation:**

When importing or updating assets, include waveform peaks for visual display in the CMS grid/table/detail views. Without peaks, the UI shows a shimmer placeholder.

Example in import payload:
```json
{
  "schema_version": "6.1.0",
  "music": [
    {
      "asset_id": "artlist-12345",
      "original_filename": "Epic Rise.mp3",
      "category": "cinematic",
      "energy": 4,
      "waveform": {
        "peaks": [0.12, 0.25, 0.48, 0.72, 0.85, 0.93, 0.78, 0.62, 0.45, 0.3]
      },
      "pairs_well_with": ["artlist-67890"],
      "mix_notes": "Dramatic build starting at 0:30. Layer under voiceover for first 30 seconds."
    }
  ]
}
```

Example PATCH to add waveform data to existing asset:
```bash
curl -X PATCH https://bythiagofigueiredo.com/api/pipeline/audio-library/<uuid> \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "metadata": {
      "waveform": {
        "peaks": [0.12, 0.25, 0.48, 0.72, 0.85, 0.93, 0.78, 0.62, 0.45, 0.3]
      },
      "pairs_well_with": ["artlist-67890"],
      "mix_notes": "Dramatic build starting at 0:30"
    }
  }'
```

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
      { "asset_id": "artlist-100", "original_filename": "Track A.mp3", "category": "cinematic", "tags": ["epic"], "energy": 4, "waveform": { "peaks": [0.1, 0.3, 0.5, 0.8, 0.6, 0.4, 0.2] } },
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
