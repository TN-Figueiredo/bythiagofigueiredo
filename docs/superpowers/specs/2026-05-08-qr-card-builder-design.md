# QR Card Builder — Design Spec

**Date:** 2026-05-08
**Status:** Approved
**Route:** `/cms/links/[id]/qr` (replaces current QR form)

## 1. Overview

The QR Card Builder replaces the current bare form in `packages/links-admin/src/components/qr-composer.tsx` with a full visual canvas editor. Users compose layered cards — background images, positioned QR codes, overlaid text and images — then export the result as PNG or SVG.

Key decisions:

- **react-konva** (Konva.js) for the drag-and-drop canvas — Canvas2D-based, handles transforms, z-ordering, and pixel-level export natively.
- **Client-side rendering + export** — no server-side canvas rendering. `stage.toBlob()` for PNG, manual SVG composition for vector output.
- **Vercel Blob** for exported card images (same storage as the media system).
- **CardComposition** — a versioned JSON structure that fully describes a card's layout, persisted to DB.

## 2. Architecture

```
┌──────────────────────────────────────────────────────┐
│  Browser (CMS Admin)                                 │
│                                                      │
│  ┌────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │ Left Panel  │  │ Konva Stage   │  │ Inspector   │ │
│  │ (controls)  │  │ (canvas)      │  │ (properties)│ │
│  └────────────┘  └───────────────┘  └─────────────┘ │
│         │               │                  │         │
│         └───────┬───────┘──────────────────┘         │
│                 ▼                                    │
│      useCardComposition (state + history)            │
│                 │                                    │
│         ┌───────┴───────┐                            │
│         ▼               ▼                            │
│  stage.toBlob()   compositionToSvg()                 │
│    (PNG export)     (SVG export)                     │
└─────────┬───────────────┬────────────────────────────┘
          ▼               ▼
   Vercel Blob       Download
   (optional)        (browser)
```

### Canvas Engine

react-konva wraps Konva.js in React components. Each `CardElement` maps to a Konva node (`<Image>`, `<Text>`, `<Group>`). The render order of children in the `<Layer>` determines z-order — last child renders on top.

### QR Generation Pipeline

1. `qrcode` npm library generates an SVG string from the link URL
2. SVG string → Blob URL via `new Blob([svgString], { type: 'image/svg+xml' })`
3. Blob URL → `HTMLImageElement` (via `new Image()` + `onload`)
4. `HTMLImageElement` → Konva `<Image>` node on the canvas

Regeneration triggers when the link URL or QR settings (colors, error correction) change.

### State Persistence

- **Composition JSON** → stored in the `links` table as a JSONB column (`qr_card_composition`)
- **Exported images** → Vercel Blob via `@vercel/blob`
- **Templates** → stored as CardComposition JSON in a `link_qr_templates` table

## 3. CardComposition Type

The central data model. Version field enables future schema migrations.

```typescript
type CardComposition = {
  version: 1
  canvas: {
    width: number   // px, 200–4096
    height: number  // px, 200–4096
    aspectRatio: string // e.g. "9:16", "1:1", "custom"
  }
  background:
    | { type: 'solid'; color: string }
    | { type: 'image'; url: string; fallbackColor: string }
    | { type: 'gradient'; angle: number; stops: Array<{ color: string; position: number }> }
  elements: CardElement[]  // order = z-order (first = bottom, last = top)
}

type CardElement = QrElement | TextElement | ImageElement

type BaseElement = {
  id: string       // nanoid
  x: number        // px from top-left
  y: number
  width: number
  height: number
  rotation: number // degrees, 0–360
  opacity: number  // 0–1
  locked: boolean
}

type QrElement = BaseElement & {
  type: 'qr'
  foregroundColor: string
  backgroundColor: string
  errorCorrection: 'L' | 'M' | 'Q' | 'H'
  cornerRadius: number // px
  maintainAspectRatio: true // always square
}

type TextElement = BaseElement & {
  type: 'text'
  content: string
  fontFamily: string
  fontSize: number    // px
  fontWeight: number  // 100–900
  lineHeight: number  // unitless multiplier
  letterSpacing: string // e.g. "0.08em"
  align: 'left' | 'center' | 'right'
  color: string
  uppercase: boolean
}

type ImageElement = BaseElement & {
  type: 'image'
  src: string // Vercel Blob URL or data URL during upload
  objectFit: 'fill' | 'cover' | 'contain' | 'stretch'
  borderRadius: number
  borderColor: string
  borderWidth: number
  maintainAspectRatio: boolean
}
```

## 4. Aspect Ratio Presets

| Name | Dimensions | Use Case |
|------|-----------|----------|
| Story | 1080 × 1920 | Instagram/TikTok stories |
| Square | 1080 × 1080 | Instagram posts |
| Landscape | 1920 × 1080 | YouTube thumbnails |
| Portrait | 1080 × 1350 | Instagram portrait posts |
| Wide (OG) | 1200 × 630 | Open Graph / link previews |
| Custom | User-defined | Any dimensions, 200–4096 px per side |

Custom dimensions show inline W × H inputs with a lock-proportions toggle and quick presets (1920×1080, 1200×675, 800×600, A4, A5).

## 5. UI Layout — Three-Panel Editor

### Left Panel (252px)

1. **Aspect Ratio** — 3×2 grid of presets + Custom. Selected preset highlights with accent border.
2. **Add to Canvas** — Three buttons: QR Code, Text, Image. Each adds a centered, default-sized element.
3. **Background** — Tab bar (Image / Solid / Gradient):
   - Image: preview thumbnail, upload/replace, fallback color
   - Solid: color picker
   - Gradient: direction picker, gradient bar with draggable stops, stop list, custom angle slider
4. **Layers** — Ordered list of all elements. Drag handles (`⋮⋮`) for reorder. Click to select. Eye icon toggles visibility. Lock icon on locked/background elements. Element count shown in section header.

### Center Area

- **Top Toolbar**: breadcrumb (Links → slug → QR Card), undo/redo buttons, zoom controls (−, percentage display, +, fit-to-view), snap guides toggle, grid toggle, save status indicator, Template button, Export button.
- **Canvas Viewport**: rulers (horizontal + vertical with pixel markings), checkerboard transparency background, the card canvas centered in the viewport with box shadow.
- **Status Bar** (22px): canvas dimensions, aspect ratio name, selected element info, cursor coordinates.

### Right Panel (244px)

Context-sensitive inspector that changes based on the selected element type. See section 7.

### Responsive

Desktop only (≥960px). Viewports below 960px show a full-screen overlay message: "This editor requires a desktop viewport (960px+)."

## 6. Canvas Behaviors

### Overflow

Elements can be positioned outside the canvas bounds. In the editor, overflow is visible so users can see the full element while dragging. On export, `stage.toBlob()` renders only the Stage area — pixels outside are automatically clipped. This enables effects like half-circles, cropped photos, and text bleeding off edges.

### Snap Guides

Orange alignment lines appear during drag:
- Center-to-center (horizontal and vertical)
- Edge-to-edge between elements
- Element-to-canvas-center

Toggled with ⌘G. Snapping threshold: 5px.

### Selection

- Click to select an element. Click empty canvas to deselect.
- Shift+click to add/remove from multi-selection.
- Drag on empty canvas to draw a selection rectangle.
- 8-point resize handles on selected elements (corners + edge midpoints).
- Bottom-right corner handle: aspect-ratio-constrained resize when `maintainAspectRatio` is true.

### Right-Click Context Menu

Available actions (with keyboard shortcuts):
- Bring Forward (⌘])
- Send Backward (⌘[)
- Bring to Front (⌘⇧])
- Send to Back (⌘⇧[)
- ─ separator ─
- Duplicate (⌘D)
- Lock (⌘L)
- ─ separator ─
- Delete (⌫)

Element-specific additions:
- QR elements: "Regenerate QR", "Edit QR Colors"
- Image elements: "Replace Image", "Reset Size"
- Text elements: "Edit Text" (focuses content input in inspector)

### Multi-Select

When multiple elements are selected:
- A dashed bounding box wraps all selected elements
- Inspector switches to multi-select mode (see section 7.4)
- Drag moves all selected elements together
- Delete removes all selected elements

## 7. Inspector Panels

### 7.1 QR Inspector

| Section | Controls |
|---------|----------|
| Encoded URL | Read-only URL bar showing the link's short URL, copy button. Source: parent Link record. |
| Transform | X, Y, W, H inputs (px units shown) |
| QR Appearance | Foreground color swatch, Background color swatch, Error correction dropdown (L/M/Q/H), Corner radius slider (0–20px) |
| Display | Rotation slider (0–360°), Opacity slider (0–100%) |
| Options | Lock position toggle, Maintain aspect ratio toggle (always on for QR) |

### 7.2 Text Inspector

| Section | Controls |
|---------|----------|
| Content | Textarea for text content |
| Transform | X, Y, W, Auto-width inputs |
| Typography | Font family dropdown (Inter, Fraunces, JetBrains Mono, Source Serif Pro, Caveat), Size (px), Weight (400–900), Line height, Letter spacing (em), Alignment buttons (left/center/right), Uppercase toggle |
| Color | Text color swatch + picker |
| Display | Rotation, Opacity sliders |
| Options | Lock position toggle |

### 7.3 Image Inspector

| Section | Controls |
|---------|----------|
| Source | Preview thumbnail (filename, dimensions, file size), Replace image upload button |
| Transform | X, Y, W, H inputs |
| Object Fit | Segmented control: Fill / Cover / Contain / Stretch |
| Appearance | Border radius slider (0–100px), Border color swatch, Border width slider (0–20px) |
| Display | Rotation, Opacity sliders |
| Options | Lock position toggle, Maintain aspect ratio toggle |

### 7.4 Multi-Select Inspector

| Section | Controls |
|---------|----------|
| Header | Badge showing selected count, "Elements Selected" label |
| Alignment | 4×2 grid of alignment actions: Left, Center, Right, Top, Middle, Bottom, Distribute Horizontal, Distribute Vertical |
| Shared Properties | Opacity (shows "Mixed" if values differ, editable to set all), Rotation slider |
| Group Actions | Group (⌘G), Lock All, Delete All buttons |

## 8. Color Picker

Opens as a popover anchored to any color swatch in the inspector.

Components (top to bottom):
1. **Saturation/brightness gradient** — 2D area, crosshair cursor. Horizontal = saturation, vertical = brightness.
2. **Hue slider** — rainbow horizontal bar with draggable thumb.
3. **Alpha slider** — gradient from transparent to the selected color, checkerboard background underneath.
4. **Input fields** — Hex, R, G, B, A (percentage). All editable, all synced.
5. **Card palette** — row of swatches auto-extracted from all colors currently used in the composition. Clicking a preset selects it.

## 9. Background Controls

Three modes selectable via a tab bar at the top of the Background section.

### Image Mode

- Preview thumbnail (full width, 56px tall) showing the current background image with filename, dimensions, and file size overlay.
- Fallback color swatch + hex value (used if image fails to load).
- Upload/replace button (dashed border, upload icon).

### Solid Mode

- Single color picker (same component as section 8).

### Gradient Mode

- Preview bar showing the current gradient (full width, 48px).
- Direction picker — 5 preset angle buttons (↑, ↗, →, ↘, ↓) plus active highlight. Custom angle via slider (0–360°).
- Gradient bar — horizontal bar showing the gradient with draggable color stop thumbs. Click the bar to add a new stop.
- Stop list — each stop shows: color swatch (clickable to open picker), hex value, position percentage, delete button (×).
- "Add color stop" button at the bottom.

## 10. Templates

### Template Browser

- Grid layout of saved templates (auto-fill, minmax 190px columns).
- Each card shows: composition thumbnail (auto-generated from `stage.toDataURL()`), aspect ratio badge, element count, save date.
- "Blank Canvas" option always available.
- "Save current canvas" dashed card to save the active composition as a new template.

### Storage

Templates stored in a `link_qr_templates` table:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| site_id | uuid | FK to sites |
| name | text | User-provided name |
| composition | jsonb | Full CardComposition JSON |
| thumbnail_url | text | Vercel Blob URL of auto-generated thumbnail |
| created_at | timestamptz | |

### Behavior

- Load: replaces current canvas entirely (with undo history reset).
- Save: prompts for name, auto-generates thumbnail from current stage, saves composition JSON + thumbnail.
- Templates are scoped to the site (shared across all links within a site).

## 11. Export

### Modal Overlay

Export opens as a **modal overlay** on top of the editor (backdrop blur, centered dialog). The editor remains visible but dimmed behind it. Esc or clicking outside closes the modal.

### Layout

- **Left**: card preview (scaled down) with dimensions label.
- **Right**: export options.

### Options

| Setting | Choices |
|---------|---------|
| Format | PNG (raster, social/web) or SVG (vector, print) |
| Scale (PNG only) | 1× (native), 2× (recommended), 3× (high-res). Each shows output dimensions. |
| Storage | Toggle: "Save copy to Vercel Blob" (saves alongside download) |

Download button label is dynamic: "Download PNG · 2× · ~560 KB" — format, scale, and estimated size update in real time.

### Export Pipeline

**PNG:**
1. Wait for `document.fonts.ready` to resolve
2. Call `stage.toBlob({ pixelRatio })` where pixelRatio matches the selected scale
3. If Vercel Blob toggle is on: upload blob via server action
4. Trigger browser download via `URL.createObjectURL()` + `<a>` click

**SVG:**
1. Call `compositionToSvg(composition)` — a pure function that builds an SVG DOM string from the serialized CardComposition state
2. Embed QR as inline SVG paths, text as `<text>` elements, images as `<image>` with data URLs
3. If Vercel Blob toggle is on: upload SVG string as blob
4. Trigger browser download

### Progress States (inside modal)

1. ✓ Rendering canvas at Nx resolution
2. ✓ Encoding [format] ([dimensions])
3. ⟳ Uploading to Vercel Blob... (if enabled)
4. ○ Saving to browser downloads

### Completion State

- Green checkmark icon
- "Card exported successfully"
- File details: filename, size
- Blob URL with "Copy URL" link (if uploaded)
- Buttons: "Back to Editor", "Export Another Format"

## 12. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘Z | Undo |
| ⌘⇧Z | Redo |
| Del / ⌫ | Delete selected element(s) |
| Tab | Cycle to next element |
| ⌘G | Toggle snap guides |
| ⌘S | Save as template |
| ⌘0 | Fit canvas to view |
| ⌘⇧E | Open export modal |
| ⌘D | Duplicate selected element(s) |
| ⌘L | Lock / unlock selected element |
| ⌘] | Bring forward |
| ⌘[ | Send backward |
| ⌘⇧] | Bring to front |
| ⌘⇧[ | Send to back |

All shortcuts are shown in a persistent bottom bar in the editor and in the right-click context menu.

## 13. Undo / Redo

State history modeled as a stack:

```typescript
type HistoryState = {
  past: CardComposition[]     // max 50 entries
  present: CardComposition
  future: CardComposition[]
}
```

- Every composition-mutating action (add/remove/move/resize/reorder/edit property) pushes the current `present` to `past` and sets the new state as `present`. `future` is cleared.
- **Undo**: pop `past` → set as `present`, push old `present` → `future`.
- **Redo**: pop `future` → set as `present`, push old `present` → `past`.
- History is capped at 50 entries. Oldest entries are discarded when the cap is exceeded.
- Non-mutating actions (select, zoom, toggle guides) do not affect history.

## 14. State Management

Two custom hooks, no external state library.

### `useCardComposition(initialComposition)`

Manages the composition data and history. Returns:
- `composition` — current CardComposition
- `updateElement(id, patch)` — partial update to an element
- `addElement(element)` — append new element
- `removeElement(id)` — delete element
- `reorderElements(fromIndex, toIndex)` — z-order change
- `setBackground(background)` — update background
- `setCanvas(canvas)` — update canvas dimensions
- `undo()`, `redo()`, `canUndo`, `canRedo`

Internally uses `useReducer` with the history stack.

### `useCanvasInteraction(composition)`

Manages transient UI state that does not belong in the composition. Returns:
- `selectedIds` — Set of selected element IDs
- `select(id)`, `multiSelect(id)`, `deselectAll()`
- `dragState` — current drag offset (null when not dragging)
- `snapGuides` — array of active snap guide positions
- `zoom`, `setZoom`, `fitToView()`
- `guidesVisible`, `gridVisible`, `toggleGuides()`, `toggleGrid()`

## 15. File Structure

### `packages/links-admin/src/components/qr-card-builder/`

| File | Purpose |
|------|---------|
| `index.tsx` | Main editor component, composes all panels |
| `canvas-editor.tsx` | Konva Stage, viewport, rulers, snap guides |
| `left-panel.tsx` | Aspect ratios, add elements, background, layers |
| `right-panel.tsx` | Inspector router — dispatches to element-specific panels |
| `qr-inspector.tsx` | QR element property panel |
| `text-inspector.tsx` | Text element property panel |
| `image-inspector.tsx` | Image element property panel |
| `multi-inspector.tsx` | Multi-select alignment + shared properties |
| `toolbar.tsx` | Top toolbar: breadcrumb, undo/redo, zoom, actions |
| `layers-panel.tsx` | Layer list with drag-to-reorder |
| `color-picker.tsx` | Popover color picker (HSV + inputs + presets) |
| `export-modal.tsx` | Export dialog with progress states |
| `template-browser.tsx` | Template grid with save/load |
| `context-menu.tsx` | Right-click menu |
| `use-card-composition.ts` | Composition state + history hook |
| `use-canvas-interaction.ts` | Selection, drag, zoom, guides hook |

### `packages/links/src/qr/`

| File | Purpose |
|------|---------|
| `card-composition.ts` | CardComposition types + Zod validation schema |
| `svg-export.ts` | `compositionToSvg()` pure function |

### `apps/web/`

| File | Purpose |
|------|---------|
| `src/app/cms/(authed)/links/[id]/qr/page.tsx` | Page component — loads composition, renders QR Card Builder |
| `src/app/cms/(authed)/links/[id]/qr/client.tsx` | Client wrapper bridging server actions to QrCardBuilder props |
| `src/app/cms/(authed)/links/[id]/qr/actions.ts` | Server actions for save/load/export |

## 16. Server Actions

```typescript
// Save composition JSON to the link record
async function saveQrCard(linkId: string, composition: CardComposition): Promise<void>

// Load saved composition (returns null if none exists)
async function loadQrCard(linkId: string): Promise<CardComposition | null>

// Save a reusable template
async function saveQrTemplate(
  siteId: string,
  name: string,
  composition: CardComposition,
  thumbnailBlob: Blob
): Promise<{ id: string }>

// List templates for a site
async function listQrTemplates(siteId: string): Promise<QrTemplate[]>

// Delete a template
async function deleteQrTemplate(templateId: string): Promise<void>

// Upload exported card image to Vercel Blob
async function exportQrCard(
  linkId: string,
  imageBlob: Blob,
  metadata: { format: 'png' | 'svg'; scale: number; width: number; height: number }
): Promise<{ url: string }>
```

All write actions must call `requireSiteAdmin(linkId)` at the top per CLAUDE.md security requirements.

## 17. Legacy Migration

The current `QrComposer` component stores a flat config object:

```typescript
{ foreground: string, background: string, errorCorrection: string, size: number, format: string, logo?: string }
```

Migration strategy:

1. On first load of the new builder, check if `qr_card_composition` is null but old QR config exists.
2. If so, auto-generate a default CardComposition:
   - Canvas: 1080×1080 (Square)
   - Background: solid color matching old `background`
   - Elements: single QR element centered, using old `foreground`, `background`, `errorCorrection`
3. Save the generated composition automatically.
4. Old `qr-composer.tsx` is kept but deprecated — the route always renders the new builder.

## 18. Testing Strategy

### Unit Tests

- `CardComposition` Zod schema validation (valid/invalid inputs)
- `compositionToSvg()` output correctness (snapshot tests for known compositions)
- History stack behavior (undo/redo/cap at 50/clear future on new action)
- Snap guide calculation (center alignment, edge alignment, threshold)
- Aspect ratio dimension computation

### Component Tests

- Toolbar button enabled/disabled states based on history
- Inspector renders correct panel for each element type
- Aspect ratio grid selection updates canvas dimensions
- Layer reorder updates element array order
- Export modal format/scale selection updates download label

### Not Tested

- Konva canvas rendering (requires real Canvas2D, not available in jsdom)
- Drag-and-drop interactions (test manually)
- Visual export output (test manually)

## 19. Accessibility

- Canvas container: `role="application"` with `aria-label="QR Card canvas editor"`
- Toolbar buttons: `aria-label` and `title` attributes on every button
- Inspector inputs: associated `<label>` elements or `aria-label`
- Keyboard navigation: Tab cycles through canvas elements, Enter to select/confirm
- Export modal: focus trap (focus stays within modal while open), Esc to close
- Screen reader: selected element type and position announced via `aria-live="polite"` region
- Color picker: color values readable as text (hex input), not reliant on visual color alone
- Layers panel: drag-to-reorder has keyboard alternative (arrow keys when layer is focused)

## 20. Constraints

| Constraint | Value |
|-----------|-------|
| Minimum viewport | 960px (desktop only) |
| Max elements per composition | 20 |
| Max image upload size | 5 MB |
| Canvas dimension range | 200–4096 px per side |
| History stack depth | 50 entries |
| Available fonts | Inter, Fraunces, JetBrains Mono, Source Serif Pro, Caveat |
| Font loading | `document.fonts.ready` must resolve before export |
| Collaboration | Single user only (no real-time sync) |
| QR aspect ratio | Always 1:1 (enforced) |
