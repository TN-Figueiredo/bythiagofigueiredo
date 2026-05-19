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
      // Image backgrounds: render solid fallback first; async image download
      // layered on top via renderImageBackground() in the main render function.
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
// Image background rendering (async — downloads and composites the image)
// ---------------------------------------------------------------------------

async function renderImageBackground(
  layer: InstanceType<typeof Konva.Layer>,
  bg: Background & { type: 'image' },
  width: number,
  height: number,
): Promise<void> {
  if (!bg.url) return
  try {
    const response = await fetch(bg.url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const arrayBuffer = await response.arrayBuffer()
    const { Image } = await import('canvas')
    const img = new Image()
    img.src = Buffer.from(arrayBuffer)
    const konvaImage = new Konva.Image({
      image: img as unknown as HTMLImageElement,
      x: 0,
      y: 0,
      width,
      height,
    })
    layer.add(konvaImage)
    const blurRadius = bg.blur ?? 0
    if (blurRadius > 0) {
      konvaImage.filters([Konva.Filters.Blur])
      konvaImage.blurRadius(blurRadius)
      konvaImage.cache()
    }
  } catch {
    // Fallback solid rect already rendered by renderBackground — no-op here
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

  // Don't pass height to Konva.Text — the editor stores a minimal bounding box
  // height (often smaller than a single line), but the client-side canvas auto-
  // expands text visually. Omitting height lets server-side text wrap within
  // `width` and flow downward naturally, matching the editor's visual output.
  const text = new Konva.Text({
    x: el.x * scaleX,
    y: el.y * scaleY,
    width: el.width * scaleX,
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
  })
  layer.add(text)
}

async function renderImageElement(
  layer: InstanceType<typeof Konva.Layer>,
  el: ImageElement,
  context: TemplateContext,
  scaleX: number,
  scaleY: number,
): Promise<void> {
  // Resolve placeholder tokens to actual URLs from context
  let src = el.src as string | undefined
  if (src === '{{cover_image}}' && context.cover_image) src = context.cover_image
  else if (src === '{{logo}}' && context.logo) src = context.logo

  // If src is still a placeholder or empty, render a gray fallback rect
  if (!src || src.startsWith('{{')) {
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
    return
  }

  try {
    const response = await fetch(src)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const arrayBuffer = await response.arrayBuffer()
    const { Image } = await import('canvas')
    const img = new Image()
    img.src = Buffer.from(arrayBuffer)
    const konvaImage = new Konva.Image({
      // canvas.Image is compatible at runtime — cast to satisfy TS types
      image: img as unknown as HTMLImageElement,
      x: el.x * scaleX,
      y: el.y * scaleY,
      width: el.width * scaleX,
      height: el.height * scaleY,
      rotation: el.rotation ?? 0,
      opacity: el.opacity ?? 1,
      cornerRadius: el.borderRadius * Math.min(scaleX, scaleY),
    })
    layer.add(konvaImage)
  } catch {
    // Fallback: render gray placeholder rect when image download fails
    const rect = new Konva.Rect({
      x: el.x * scaleX,
      y: el.y * scaleY,
      width: el.width * scaleX,
      height: el.height * scaleY,
      fill: '#333333',
      opacity: (el.opacity ?? 1) * 0.3,
      cornerRadius: el.borderRadius * Math.min(scaleX, scaleY),
      rotation: el.rotation ?? 0,
    })
    layer.add(rect)
  }
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

    // If the background is an image type, attempt async image download on top
    if (background.type === 'image') {
      await renderImageBackground(layer, background, size.width, size.height)
    }

    for (const el of elements) {
      switch (el.type) {
        case 'text':
          renderTextElement(layer, el, context, scaleX, scaleY)
          break
        case 'image':
          await renderImageElement(layer, el, context, scaleX, scaleY)
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
    const buffer = (canvasElement as unknown as { toBuffer: (mime: string, options?: { quality: number }) => Buffer }).toBuffer('image/jpeg', { quality: 0.92 })

    return buffer
  } finally {
    stage.destroy()
  }
}
