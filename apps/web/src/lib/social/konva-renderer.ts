// Import canvas-backend first for side effects — it mutates the shared Konva
// singleton to use node-canvas for rendering (createCanvasElement, createImageElement).
import 'konva/canvas-backend'
// Then import the full Konva (with all shapes: Rect, Text, etc.) which shares
// the same underlying singleton that canvas-backend already patched.
import Konva from 'konva'
import type { CardComposition, TextElement, ImageElement, Background } from '@tn-figueiredo/links/qr'

// Force server-side mode — the canvas-backend import wires node-canvas but
// Konva's own detectBrowser() can still return true if a DOM shim (happy-dom,
// jsdom) provides `window`. This must be set before any Stage is created.
Konva.isBrowser = false

export interface TemplateContext {
  title?: string
  description?: string
  cover_image?: string
  short_url?: string
  logo?: string
}

// ---------------------------------------------------------------------------
// Placeholder resolution
// ---------------------------------------------------------------------------

const PLACEHOLDER_RE = /\{\{(title|description|short_url|cover_image|logo)\}\}/g

export function resolvePlaceholders(text: string, ctx: TemplateContext): string {
  return text.replace(PLACEHOLDER_RE, (_, key: string) => {
    const value = ctx[key as keyof TemplateContext]
    return value ?? ''
  })
}

// ---------------------------------------------------------------------------
// Background rendering
// ---------------------------------------------------------------------------

function renderBackground(
  layer: InstanceType<typeof Konva.Layer>,
  bg: Background,
  width: number,
  height: number,
): void {
  switch (bg.type) {
    case 'solid': {
      const rect = new Konva.Rect({
        x: 0,
        y: 0,
        width,
        height,
        fill: bg.color,
      })
      layer.add(rect)
      break
    }
    case 'gradient': {
      // Convert angle to start/end points
      const angleRad = ((bg.angle - 90) * Math.PI) / 180
      const cx = width / 2
      const cy = height / 2
      const len = Math.max(width, height)
      const dx = Math.cos(angleRad) * len
      const dy = Math.sin(angleRad) * len

      const colorStops: (string | number)[] = []
      for (const stop of bg.stops) {
        colorStops.push(stop.position, stop.color)
      }

      const rect = new Konva.Rect({
        x: 0,
        y: 0,
        width,
        height,
        fillLinearGradientStartPoint: { x: cx - dx / 2, y: cy - dy / 2 },
        fillLinearGradientEndPoint: { x: cx + dx / 2, y: cy + dy / 2 },
        fillLinearGradientColorStops: colorStops,
      })
      layer.add(rect)
      break
    }
    case 'image': {
      // Image backgrounds are handled as a solid fallback on server
      // (downloading the image would add latency; can be extended later)
      const rect = new Konva.Rect({
        x: 0,
        y: 0,
        width,
        height,
        fill: bg.fallbackColor,
      })
      layer.add(rect)
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Element rendering
// ---------------------------------------------------------------------------

function renderTextElement(
  layer: InstanceType<typeof Konva.Layer>,
  el: TextElement,
  ctx: TemplateContext,
  scaleX: number,
  scaleY: number,
): void {
  const resolvedContent = resolvePlaceholders(el.content, ctx)
  if (!resolvedContent) return // Hide empty placeholders

  const text = new Konva.Text({
    x: el.x * scaleX,
    y: el.y * scaleY,
    width: el.width * scaleX,
    height: el.height * scaleY,
    text: el.uppercase ? resolvedContent.toUpperCase() : resolvedContent,
    fontFamily: el.fontFamily,
    fontSize: el.fontSize * Math.min(scaleX, scaleY),
    fontStyle: el.fontWeight >= 700 ? 'bold' : 'normal',
    lineHeight: el.lineHeight,
    letterSpacing: parseFloat(el.letterSpacing) * el.fontSize * Math.min(scaleX, scaleY),
    align: el.align,
    fill: el.color,
    opacity: el.opacity,
    rotation: el.rotation,
    wrap: 'word',
    ellipsis: true,
  })
  layer.add(text)
}

function renderImagePlaceholder(
  layer: InstanceType<typeof Konva.Layer>,
  el: ImageElement,
  scaleX: number,
  scaleY: number,
): void {
  // On server, image elements with placeholder src ({{cover_image}}, {{logo}})
  // are rendered as a semi-transparent rect. Full image download for concrete
  // URLs can be added in a future iteration.
  const rect = new Konva.Rect({
    x: el.x * scaleX,
    y: el.y * scaleY,
    width: el.width * scaleX,
    height: el.height * scaleY,
    fill: '#333333',
    opacity: el.opacity * 0.3,
    cornerRadius: el.borderRadius * Math.min(scaleX, scaleY),
    rotation: el.rotation,
  })
  layer.add(rect)
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

export async function renderTemplate(
  composition: CardComposition,
  context: TemplateContext,
  size: { width: number; height: number },
): Promise<Buffer> {
  const { canvas: canvasSpec, background, elements } = composition

  // Scale factors from composition canvas to output size
  const scaleX = size.width / canvasSpec.width
  const scaleY = size.height / canvasSpec.height

  const stage = new Konva.Stage({
    width: size.width,
    height: size.height,
    // Server-side Konva needs a container-less stage
    container: undefined as unknown as string,
  })

  const layer = new Konva.Layer()
  stage.add(layer)

  try {
    renderBackground(layer, background, size.width, size.height)

    for (const el of elements) {
      switch (el.type) {
        case 'text':
          renderTextElement(layer, el, context, scaleX, scaleY)
          break
        case 'image':
          renderImagePlaceholder(layer, el, scaleX, scaleY)
          break
        case 'qr':
          break
      }
    }

    layer.draw()

    const canvasElement = stage.toCanvas({
      width: size.width,
      height: size.height,
    })
    const buffer = (canvasElement as unknown as { toBuffer: (mime: string) => Buffer }).toBuffer('image/png')

    return buffer
  } finally {
    stage.destroy()
  }
}
