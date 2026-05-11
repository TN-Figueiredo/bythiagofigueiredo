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

## Section: `ideia` (shared)

```json
{
  "premise": "Uma frase que resume a ideia do conteúdo",
  "body": "Descrição expandida com contexto, motivação e proposta de valor",
  "angle": "Ângulo editorial ou gancho estratégico",
  "vvs": 85,
  "cross_refs": [
    { "code": "VID-042", "title": "Vídeo relacionado", "note": "Conexão temática" }
  ]
}
```

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `premise` | string | sim | Frase-chave da ideia |
| `body` | string | sim | Descrição detalhada |
| `angle` | string | não | Ângulo editorial |
| `vvs` | number 0-100 | não | Score de viabilidade |
| `validated_at` | ISO datetime | não | Preenchido quando validada |
| `cross_refs` | CrossRef[] | não | Referências cruzadas |

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

## Sections sem renderer especializado (usam GenericRenderer)

Os seguintes tipos de seção usam renderização genérica (JSON pretty-print ou texto plano):

| Section | Formato | Notas |
|---------|---------|-------|
| `draft` (blog_post) | string ou object | Rascunho do blog post |
| `seo` (blog_post) | object | Meta tags, keywords, slug |
| `images` (blog_post, shared) | object | Referências de imagens |
| `content` (newsletter) | string ou object | Corpo da newsletter |
| `layout` (newsletter) | object | Config de layout |
| `audience` (newsletter) | object | Segmentação |
| `send` (newsletter) | object | Config de envio |
| `curriculum` (course) | object | Grade curricular |
| `lessons` (course) | object | Aulas individuais |
| `material` (course) | object | Material de apoio |
| `briefing` (campaign) | object | Brief do cliente |
| `assets` (campaign) | object | Assets da campanha |
| `metrics` (campaign) | object | KPIs e métricas |

Para esses, qualquer estrutura JSON válida é aceita. Será renderizada como JSON formatado.

---

## Regras gerais

1. **Sempre enviar JSON estruturado**, nunca texto plano — os renderers especializados dependem dos campos tipados
2. **Campos opcionais**: omitir ao invés de enviar `null` ou string vazia
3. **Status values**: usar MAIÚSCULAS (`DRAFT`, `PENDING`, `DONE`, `ON_TRACK`, etc.)
4. **Timestamps**: formato `MM:SS` para display, formato SRT `HH:MM:SS,mmm --> HH:MM:SS,mmm` para cross-ref
5. **Idioma**: conteúdo no idioma da seção (`_pt` = PT-BR, `_en` = EN). Tags de script são sempre em inglês.
6. **`source`**: sempre `"cowork"` quando gerado por AI
7. **`modified_by`**: sempre `"cowork-claude"` para rastreabilidade
