# Pipeline Renderer — PT-BR Parser Expansion + Publicação Visual Hierarchy

## Summary

Two focused improvements to the pipeline CMS renderers:

1. **Roteiro Parser Expansion** — Extend the script tag parser to handle PT-BR tags (`[DIRECTION:]`, `[PAUSA]`), strip markdown wrapping (`**[TAG]**`), parse blockquote narration (`> text`), and render bullet lists. Eliminates raw asterisks and unrecognized tags in PT-BR scripts.

2. **Publicação Visual Hierarchy** — Upgrade the publish renderer with YouTube-optimized char counts, inline token detection (hashtags, handles, timestamps, URLs), timeline cards, structured end screen, and phase-based strategy timeline.

Both changes are render-only — no API or data model changes. Backward compatibility with existing EN scripts is mandatory.

---

## 1. Roteiro Parser Expansion

### 1.1 Tag Vocabulary

Current tags recognized by `parse-script-tags.ts`:

| Tag | Status |
|-----|--------|
| `VISUAL` | Existing |
| `TOM` | Existing |
| `B-ROLL` | Existing |
| `CORTE` | Existing |
| `OVERLAY` | Existing (special-cased from VISUAL) |
| `TRANS` | Existing (in type, not in regex) |

New tags to add:

| Tag | Purpose | Color |
|-----|---------|-------|
| `DIRECTION` | Directorial guidance — posture, energy, gaze, pacing | Rose `#fb7185` / `#fda4af` |
| `SFX` | Sound effect cues | Amber `#d97706` / `#fde68a` |

PT-BR aliases (mapped transparently in regex):

| Alias | Maps to |
|-------|---------|
| `[PAUSA Xs]` | `{ type: 'pause', duration: 'Xs' }` |
| `[DIREÇÃO: ...]` | `{ type: 'tag', tag: 'DIRECTION', content: '...' }` |

### 1.2 Pre-processing Pipeline

Strict execution order:

```
Input beat text
  │
  ▼
Step 1: stripMarkdownTagWrapping(text)
  Regex: /\*\*(\[[A-ZÇÃ\-]+[:\s][\s\S]*?\])\*\*/g → $1
  Effect: **[DIRECTION: calmo]** → [DIRECTION: calmo]
          **[PAUSA 0.5s]** → [PAUSA 0.5s]
  │
  ▼
Step 2: collectMatches(text) — existing function, expanded regexes
  TAG_RE: /\[(VISUAL|TOM|B-ROLL|CORTE|DIRECTION|SFX|DIREÇÃO):\s*(.+?)\]/g
  PAUSE_RE: /\[PAUS[EA]\s+([\d.]+s)\]/g
  SECTION_RE, META_RE: unchanged
  │
  ▼
Step 3: Assemble segments from matches + gap text
  Gap text parsed by expanded parseGapText():
    > lines    → { type: 'blockquote', content }
    - bullets  → { type: 'bullet-list', items: string[] }
    "quoted"   → { type: 'narration', content }
    plain text → { type: 'text', content }
```

### 1.3 New Segment Types

```ts
export type ScriptSegment =
  | { type: 'tag'; tag: 'VISUAL' | 'TOM' | 'B-ROLL' | 'CORTE' | 'OVERLAY' | 'TRANS' | 'DIRECTION' | 'SFX'; content: string }
  | { type: 'narration'; content: string }
  | { type: 'pause'; duration: string }
  | { type: 'section'; label: string; content: string }
  | { type: 'meta'; key: string; value: string }
  | { type: 'text'; content: string }
  | { type: 'blockquote'; content: string }
  | { type: 'bullet-list'; items: string[] }
```

### 1.4 tokenizeText Expansion

Add bold token pattern to existing `parse-tokens.tsx`:

- Pattern: `/\*\*(.+?)\*\*/g`
- Render: `<strong style={{ color: 'var(--gem-text)' }}>{content}</strong>`
- Priority: after timestamp/dB/negation tokens (bold wraps content, not structural tokens)

Effect: `**importante**` renders as bold text instead of raw `**importante**`.

### 1.5 SegmentRenderer New Cases

**blockquote:**
```tsx
case 'blockquote':
  return (
    <div className="narration text-[13px] leading-[1.85] py-2.5 px-3.5 my-1.5 rounded-r italic"
      style={{
        color: 'var(--gem-text)',
        background: 'linear-gradient(90deg, var(--gem-well), transparent 80%)',
        borderLeft: '2px solid var(--gem-dim)',
      }}>
      {tokenizeText(segment.content)}
    </div>
  )
```

**bullet-list:**
```tsx
case 'bullet-list':
  return (
    <ul className="pl-4 my-1 space-y-0.5">
      {segment.items.map((item, i) => (
        <li key={i} className="text-[11.5px] leading-relaxed list-disc"
          style={{ color: 'var(--gem-muted)' }}>
          {tokenizeText(item)}
        </li>
      ))}
    </ul>
  )
```

### 1.6 TAG_COLORS Additions

```ts
DIRECTION: { pill: { bg: '#f4364520', color: '#fb7185', border: '#f4364530' }, text: '#fda4af' },
SFX:       { pill: { bg: '#d9770620', color: '#fbbf24', border: '#d9770630' }, text: '#fde68a' },
```

### 1.7 DIREÇÃO → DIRECTION Alias

In `collectMatches()`, when a tag match has `m[1] === 'DIREÇÃO'`, remap to `'DIRECTION'` before creating the segment. Same pattern as existing `B-ROLLi` → `B-ROLL` remapping.

### 1.8 Backward Compatibility

- All existing EN tag patterns remain in regex (prepended, not replaced)
- PAUSE_RE expanded with character class `[EA]` to match both PAUSE and PAUSA
- Gap text additions (blockquote, bullets) only activate on lines starting with `> ` or `- ` — existing quote detection (`"text"`) runs first
- No existing segment types modified
- Existing test cases must pass unchanged

---

## 2. Publicação Visual Hierarchy

### 2.1 Title Section

- Font: 14px `font-semibold` (up from 13px)
- YouTube char count indicator with 3 tiers:
  - `≤70`: green chip — "ideal para busca"
  - `71–100`: yellow chip — "pode truncar na busca"
  - `>100`: red chip — "truncado"
- Alternatives: numbered circle badges (①②③), text in `--gem-muted`
- Editing: existing contentEditable, no new interactions

### 2.2 Description Section

New `tokenizeDescription()` function detecting inline tokens. Priority order (first match wins at each position):

| Priority | Pattern | Regex | Render |
|----------|---------|-------|--------|
| 1 | URL | `/https?:\/\/\S+/g` | Dim underline (longest match first) |
| 2 | Hashtag | `/#\w[\w]*/g` | Accent pill inline |
| 3 | Handle | `/@\w+/g` | Cyan chip |
| 4 | Timestamp | `/\d{2}:\d{2}/g` | TimestampChip (existing) |
| 5 | Plain text | remainder | Text node |

Char count with YouTube context:
- Show count badge
- If >200 chars: dim label "200 chars — visível sem expandir"

### 2.3 Tags Section

Minor polish:
- Add tag count badge: "12 tags"
- Existing purple pills unchanged

### 2.4 Cards Section

Timeline enhancement:
- Add 5px accent dots on left margin with vertical connecting line
- Keep current card layout (works in narrow panel)
- Type badge color coding:
  - `question` / `poll` → blue `#60a5fa`
  - `video` / `clip` → green `#4ade80`
  - default → cyan `#22d3ee` (existing)

### 2.5 End Screen Section

Two render paths based on data shape:

**String:** Current text block, no change.

**Object `{ type, video_suggestion }`:**
- Type rendered as gem-accent pill badge
- Video suggestion as highlighted text in `--gem-muted`
- Card border: `--gem-border` (stays in gem design system)

### 2.6 Strategy Section

Phase-based timeline:

- Phase detection regex: `/^(D\+\d+|Semana \d+|Hora \d+|Fase \d+)/i`
- Matched prefix → phase chip header (small accent badge) + remaining text
- Not matched → step text only
- Visual: numbered circle on left (`--gem-accent` bg, white number) + connecting line + step text
- Fallback: if zero phases detected, render as current `<ol>` with accent-colored numbers

---

## 3. Cowork Memory Prompt

The following block should be added to the Cowork AI's memory to enforce the standard beat output format:

```markdown
## Roteiro Beat Format

When generating script/roteiro content, ALWAYS structure beats as:

### Tag syntax (inline within beat text)
- [DIRECTION: description] — directorial guidance (posture, energy, gaze, pacing)
- [VISUAL: description] — camera/framing instructions
- [B-ROLL: description] — B-Roll footage reference
- [CORTE: description] — edit/cut point
- [OVERLAY: description] — text overlay or lower third
- [TRANS: description] — transition between scenes
- [SFX: description] — sound effect cue
- [PAUSE Xs] or [PAUSA Xs] — timed pause (e.g., [PAUSE 0.8s])

### Narration (spoken text)
Use blockquote for text to be spoken:
> "Texto que será falado pelo apresentador."

### Action items
Use bullets for directorial action items:
- Olhar direto para câmera
- Manter tom calmo

### Rules
- Do NOT wrap tags in markdown bold: ~~**[TAG: ...]**~~ → use [TAG: ...]
- Do NOT use markdown formatting (bold, italic) inside beat text
- Do NOT invent new tag types beyond the list above
- Each beat must have: number, label, text, optional status

### Example beat
{
  "number": 1,
  "label": "Hook — Abrir com vulnerabilidade",
  "text": "[DIRECTION: calmo, próximo da câmera, sem drama]\n> \"Eu morei quatro anos no Canadá e nunca me senti em casa.\"\n[PAUSA 0.8s]\n- Olhar direto para câmera\n- Não gesticular",
  "status": "DRAFT"
}
```

---

## 4. Data Shape Examples

### 4.1 PT-BR Script Beat

```json
{
  "number": 1,
  "label": "Hook — Abrir com vulnerabilidade",
  "text": "[DIRECTION: calmo, próximo da câmera, sem drama]\n> \"Eu morei quatro anos no Canadá e nunca me senti em casa.\"\n[PAUSA 0.8s]\n- Olhar direto para câmera\n- Não gesticular\n[VISUAL: Close-up, profundidade rasa, luz natural suave]",
  "status": "DRAFT"
}
```

Expected parse output:
```
tag(DIRECTION) → "calmo, próximo da câmera, sem drama"
blockquote    → "Eu morei quatro anos no Canadá e nunca me senti em casa."
pause         → "0.8s"
bullet-list   → ["Olhar direto para câmera", "Não gesticular"]
tag(VISUAL)   → "Close-up, profundidade rasa, luz natural suave"
```

### 4.2 Publish Content

```json
{
  "title": {
    "chosen": "Por que saí do Canadá depois de 4 anos",
    "alternatives": ["4 anos no Canadá: não era pra mim", "A verdade sobre morar fora"]
  },
  "description": "Neste vídeo conto por que voltei ao Brasil depois de 4 anos morando no Canadá.\n\n#expatriado #canada #voltarbrasil\n\n00:00 Intro\n02:30 A decisão\n05:00 O retorno\n\nMe siga: @thiago.fig",
  "tags": ["expatriado", "canada", "voltarbrasil", "morarnofora", "vidanocanda"],
  "cards": [
    { "timestamp": "02:30", "text": "Por que você decidiu voltar?", "type": "question" },
    { "timestamp": "05:00", "text": "Como foi o processo de volta?", "type": "question" },
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

---

## 5. Testing Requirements

### 5.1 Parser Tests (`parse-script-tags.test.ts`)

1. EN script with existing tags → unchanged output (regression)
2. `[DIRECTION: calmo, próximo]` → `{ type: 'tag', tag: 'DIRECTION', content: 'calmo, próximo' }`
3. `[DIREÇÃO: calmo]` → maps to DIRECTION
4. `[PAUSA 0.8s]` → `{ type: 'pause', duration: '0.8s' }`
5. `[SFX: porta batendo]` → `{ type: 'tag', tag: 'SFX', content: 'porta batendo' }`
6. `**[DIRECTION: calmo]**` → stripped to `[DIRECTION: calmo]`, parsed normally
7. `> "Eu morei quatro anos..."` → `{ type: 'blockquote', content: '"Eu morei quatro anos..."' }`
8. `- Item 1\n- Item 2` → `{ type: 'bullet-list', items: ['Item 1', 'Item 2'] }`
9. Mixed beat with all segment types → correct ordering
10. Empty text → `[]`

### 5.2 Token Tests (`parse-tokens.test.ts`)

1. `**bold text**` → bold token rendered
2. Existing tokens (timestamp, dB, negation) → unchanged (regression)
3. `**bold** and 02:30` → both tokenized correctly

### 5.3 Publish Renderer Tests

1. Title char count: 50 chars → green, 75 → yellow, 110 → red
2. Description with `#hashtag @handle 02:30 https://url` → all tokenized
3. Cards with type `question` → blue badge, `video` → green badge
4. End screen as string → text block
5. End screen as object → structured card
6. Strategy with `D+0:` prefix → phase chip extracted
7. Strategy without phase prefix → numbered list fallback
8. Empty/missing fields → no crash, empty state

---

## 6. Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `renderers/parse-script-tags.ts` | Modify | Expand TAG_RE, PAUSE_RE, add blockquote/bullet parsing, markdown stripping |
| `renderers/parse-tokens.tsx` | Modify | Add bold token pattern `**text**` |
| `renderers/tokens.tsx` | Modify | Add DIRECTION + SFX to TAG_COLORS |
| `renderers/script-renderer.tsx` | Modify | Add blockquote + bullet-list segment renderer cases |
| `renderers/publish-renderer.tsx` | Modify | Visual hierarchy: title char count, description tokenizer, timeline cards, end screen, strategy |
| `test/renderers/parse-script-tags.test.ts` | Create | Parser unit tests |
| `test/renderers/parse-tokens.test.ts` | Create | Token unit tests (bold) |
| `test/renderers/publish-renderer.test.ts` | Create | Publish renderer unit tests |

---

## 7. Out of Scope

- API/data model changes
- Cowork AI prompt engineering (prompt provided as reference only — user applies manually)
- Interactive editing features (click-to-swap title, copy-to-clipboard)
- Markdown parser library integration (we handle specific patterns inline)
- Fuzzy tag matching for typos
