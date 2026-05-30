# Canvas Editor Left Panel Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the canvas editor left panel to match the design spec — simplified format presets (Vertical/Horizontal/Quadrado/Custom), expanded element grid (7 types: Texto, Imagem, GIF, Sticker, QR, Carimbo, Enquete), background section with 4 tabs (Sólido/Imagem/Vídeo/Degradê) + color palette, and format-specific contextual hint.

**Architecture:** The left panel lives in `packages/links-admin/src/components/qr-card-builder/left-panel.tsx`. Format presets come from `packages/links/src/qr/card-composition.ts`. New element types (GIF, Sticker, Carimbo, Enquete) are initially placeholders — GIF/Sticker add as `image` type elements, Carimbo adds as `text` type, Enquete adds as `image` type with a placeholder. The composition schema already supports `image`, `text`, and `video` types which cover all cases. Background gets a new "Vídeo" tab using the existing `ImageBackgroundSchema` with `mediaType: 'video'`.

**Tech Stack:** React 19, TypeScript, Lucide icons, Zod, CSS design tokens

---

## File Structure

### Modified files
- `packages/links/src/qr/card-composition.ts` — Update presets to Vertical/Horizontal/Quadrado/Custom, add context hints
- `packages/links-admin/src/components/qr-card-builder/left-panel.tsx` — Full redesign matching design spec

### Test files
- `packages/links/src/qr/card-composition.test.ts` — Update preset tests

---

## Phase 1: FORMAT PRESETS

### Task 1: Update aspect ratio presets to Vertical/Horizontal/Quadrado/Custom

- [ ] Step 1: Update presets in `card-composition.ts`

Edit: `packages/links/src/qr/card-composition.ts` — Replace `ASPECT_RATIO_PRESETS`:

```typescript
export const ASPECT_RATIO_PRESETS: AspectRatioPreset[] = [
  { name: 'vertical', label: 'Vertical', width: 1080, height: 1920 },
  { name: 'horizontal', label: 'Horizontal', width: 1920, height: 1080 },
  { name: 'square', label: 'Quadrado', width: 1080, height: 1080 },
  { name: 'custom', label: 'Custom', width: 1080, height: 1080 },
]
```

Also add contextual hints:

```typescript
export const PRESET_HINTS: Record<string, string> = {
  vertical: 'Story · pôster · cavalete de mesa',
  horizontal: 'Banner · outdoor · assinatura de e-mail',
  square: 'Feed · adesivo · cartão',
  custom: '',
}
```

Export `PRESET_HINTS` from the package's `index.ts`.

- [ ] Step 2: Update `nextElementName` to support all element type labels

```typescript
export function nextElementName(elements: CardElement[], type: 'qr' | 'text' | 'image' | 'video'): string {
  const labels: Record<string, string> = { qr: 'QR Code', text: 'Texto', image: 'Imagem', video: 'Vídeo' }
  const base = labels[type]!
  const count = elements.filter(e => e.type === type).length
  return count === 0 ? base : `${base} ${count + 1}`
}
```

- [ ] Step 3: Update preset tests

- [ ] Step 4: Run tests

```bash
npx vitest run packages/links/src/qr/card-composition.test.ts
```

- [ ] Step 5: Rebuild packages

```bash
npm run build:packages
```

- [ ] Step 6: Commit

```
feat(canvas): simplify presets to Vertical/Horizontal/Quadrado/Custom with hints
```

---

## Phase 2: LEFT PANEL REDESIGN

### Task 2: Rewrite left panel matching design spec

The design spec HTML shows:
1. **Formato** — 4-column grid (Vertical 1080×1920, Horizontal 1920×1080, Quadrado 1080×1080, Custom livre) with active state using `--accent-soft`/`--accent` and contextual hint below
2. **Adicionar** — 3×3 grid with 7 element types: Texto, Imagem, GIF, Sticker, QR, Carimbo, Enquete — each with an icon and label
3. **Fundo** — Segmented control (Sólido/Imagem/Vídeo/Degradê) with color palette swatches below
4. **Camadas** — Already done (LayersPanel component)

- [ ] Step 1: Rewrite left-panel.tsx

Full file rewrite of `packages/links-admin/src/components/qr-card-builder/left-panel.tsx`:

Key changes:
- **Formato section**: 4-button grid (was 6), contextual hint line with info icon below, Custom shows WxH inputs
- **Adicionar section**: 3-column grid with 7 buttons: Texto (`AlignLeft`), Imagem (`Image`), GIF (`FileVideo2`), Sticker (`Sticker`), QR (`QrCode`), Carimbo (`Type`), Enquete (`BarChart3`)
- **Fundo section**: Pill toggle bar (Sólido/Imagem/Vídeo/Degradê) + 6-color palette row below
- **All Portuguese labels** matching design

Element handlers:
- **Texto** → `addElement(createTextElement(...))` — works now
- **Imagem** → file picker → upload → `addElement(createImageElement(...))` — works now
- **GIF** → file picker (accept `image/gif`) → upload as image element with name "GIF"
- **Sticker** → file picker (accept `image/png,image/webp`) → upload as image with name "Sticker"
- **QR** → `addElement(createQrElement(...))` — works now
- **Carimbo** → `addElement(createTextElement(...))` with custom defaults (name "Carimbo TF", fontFamily "Fraunces", fontSize 14, uppercase true)
- **Enquete** → `addElement(createTextElement(...))` with name "Enquete" and placeholder content "Opção A vs B"

Background tabs:
- **Sólido** — ColorPicker + 6-color palette: `#1F1B17`, `#F7F1E8`, `#F2683C`, `#9A6B3F`, `#46B17E`, `#5B7FD6`
- **Imagem** — Upload button + preview
- **Vídeo** — Upload button (accept `video/*`) + preview → stores as `ImageBackgroundSchema` with `mediaType: 'video'`
- **Degradê** — Gradient preview + angle slider + stop color pickers

- [ ] Step 2: Rebuild packages

```bash
npm run build:packages
```

- [ ] Step 3: Run tests

```bash
npx vitest run packages/links/src/qr/card-composition.test.ts
npx vitest run apps/web/test/cms/links/qr/
```

- [ ] Step 4: Commit

```
feat(canvas): left panel redesign — 7 element types, 4 bg tabs, format hints
```

---

## Summary

| Phase | Tasks | Files | Est. |
|-------|-------|-------|------|
| 1. Format Presets | 1 | 2 modified | 20min |
| 2. Left Panel | 1 | 1 rewritten | 45min |
| **Total** | **2** | **3 files** | **~1h** |
