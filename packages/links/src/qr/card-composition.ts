import { z } from 'zod'

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6,8}$/)

const BaseElementSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().min(0).max(360).default(0),
  opacity: z.number().min(0).max(1).default(1),
  locked: z.boolean().default(false),
})

const QrElementSchema = BaseElementSchema.extend({
  type: z.literal('qr'),
  foregroundColor: HexColor.default('#000000'),
  backgroundColor: HexColor.default('#ffffff'),
  errorCorrection: z.enum(['L', 'M', 'Q', 'H']).default('M'),
  cornerRadius: z.number().min(0).max(20).default(0),
  maintainAspectRatio: z.literal(true).default(true),
})

const TextElementSchema = BaseElementSchema.extend({
  type: z.literal('text'),
  content: z.string(),
  fontFamily: z.string().default('Inter'),
  fontSize: z.number().min(8).max(400).default(24),
  fontWeight: z.number().min(100).max(900).default(400),
  lineHeight: z.number().min(0.5).max(3).default(1.2),
  letterSpacing: z.string().default('0em'),
  align: z.enum(['left', 'center', 'right']).default('left'),
  color: HexColor.default('#000000'),
  uppercase: z.boolean().default(false),
})

const ImageElementSchema = BaseElementSchema.extend({
  type: z.literal('image'),
  src: z.string().min(1),
  objectFit: z.enum(['fill', 'cover', 'contain', 'stretch']).default('cover'),
  borderRadius: z.number().min(0).max(100).default(0),
  borderColor: HexColor.default('#000000'),
  borderWidth: z.number().min(0).max(20).default(0),
  maintainAspectRatio: z.boolean().default(true),
})

const CardElementSchema = z.discriminatedUnion('type', [
  QrElementSchema,
  TextElementSchema,
  ImageElementSchema,
])

const SolidBackgroundSchema = z.object({
  type: z.literal('solid'),
  color: HexColor,
})

const ImageBackgroundSchema = z.object({
  type: z.literal('image'),
  url: z.string().min(1),
  fallbackColor: HexColor,
})

const GradientStopSchema = z.object({
  color: HexColor,
  position: z.number().min(0).max(1),
})

const GradientBackgroundSchema = z.object({
  type: z.literal('gradient'),
  angle: z.number().min(0).max(360),
  stops: z.array(GradientStopSchema).min(2),
})

const BackgroundSchema = z.discriminatedUnion('type', [
  SolidBackgroundSchema,
  ImageBackgroundSchema,
  GradientBackgroundSchema,
])

const CanvasSchema = z.object({
  width: z.number().min(200).max(4096),
  height: z.number().min(200).max(4096),
  aspectRatio: z.string(),
})

export const CardCompositionSchema = z.object({
  version: z.literal(1),
  canvas: CanvasSchema,
  background: BackgroundSchema,
  elements: z.array(CardElementSchema).max(20),
})

export type CardComposition = z.infer<typeof CardCompositionSchema>
export type CardElement = z.infer<typeof CardElementSchema>
export type QrElement = z.infer<typeof QrElementSchema>
export type TextElement = z.infer<typeof TextElementSchema>
export type ImageElement = z.infer<typeof ImageElementSchema>
export type Background = z.infer<typeof BackgroundSchema>
export type GradientStop = z.infer<typeof GradientStopSchema>
export type Canvas = z.infer<typeof CanvasSchema>

export interface AspectRatioPreset {
  name: string
  label: string
  width: number
  height: number
}

export const ASPECT_RATIO_PRESETS: AspectRatioPreset[] = [
  { name: '9:16', label: 'Story', width: 1080, height: 1920 },
  { name: '1:1', label: 'Square', width: 1080, height: 1080 },
  { name: '16:9', label: 'Landscape', width: 1920, height: 1080 },
  { name: '4:5', label: 'Portrait', width: 1080, height: 1350 },
  { name: '1200:630', label: 'Wide (OG)', width: 1200, height: 630 },
  { name: 'custom', label: 'Custom', width: 1080, height: 1080 },
]

export const AVAILABLE_FONTS = [
  'Inter',
  'Fraunces',
  'JetBrains Mono',
  'Source Serif Pro',
  'Caveat',
] as const

export const MAX_ELEMENTS = 20
export const MAX_HISTORY = 50
export const MIN_CANVAS = 200
export const MAX_CANVAS = 4096

export function createDefaultComposition(
  preset: AspectRatioPreset = ASPECT_RATIO_PRESETS[1]!,
): CardComposition {
  return {
    version: 1,
    canvas: {
      width: preset.width,
      height: preset.height,
      aspectRatio: preset.name,
    },
    background: { type: 'solid', color: '#ffffff' },
    elements: [],
  }
}

export function createQrElement(
  id: string,
  canvasWidth: number,
  canvasHeight: number,
): QrElement {
  const size = Math.min(canvasWidth, canvasHeight) * 0.4
  return {
    id,
    type: 'qr',
    x: (canvasWidth - size) / 2,
    y: (canvasHeight - size) / 2,
    width: size,
    height: size,
    rotation: 0,
    opacity: 1,
    locked: false,
    foregroundColor: '#000000',
    backgroundColor: '#ffffff',
    errorCorrection: 'M',
    cornerRadius: 0,
    maintainAspectRatio: true,
  }
}

export function createTextElement(
  id: string,
  canvasWidth: number,
  canvasHeight: number,
): TextElement {
  return {
    id,
    type: 'text',
    x: canvasWidth * 0.1,
    y: canvasHeight * 0.8,
    width: canvasWidth * 0.8,
    height: 40,
    rotation: 0,
    opacity: 1,
    locked: false,
    content: 'Your text here',
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: '0em',
    align: 'center',
    color: '#000000',
    uppercase: false,
  }
}

export function createImageElement(
  id: string,
  src: string,
  canvasWidth: number,
  canvasHeight: number,
): ImageElement {
  const size = Math.min(canvasWidth, canvasHeight) * 0.3
  return {
    id,
    type: 'image',
    x: (canvasWidth - size) / 2,
    y: canvasHeight * 0.1,
    width: size,
    height: size,
    rotation: 0,
    opacity: 1,
    locked: false,
    src,
    objectFit: 'cover',
    borderRadius: 0,
    borderColor: '#000000',
    borderWidth: 0,
    maintainAspectRatio: true,
  }
}

export function migrateLegacyQrConfig(
  legacyConfig: { foreground?: string; background?: string; error_correction?: string; size?: number },
  canvasWidth = 1080,
  canvasHeight = 1080,
): CardComposition {
  const comp = createDefaultComposition(ASPECT_RATIO_PRESETS[1]!)
  comp.canvas.width = canvasWidth
  comp.canvas.height = canvasHeight
  comp.background = {
    type: 'solid',
    color: legacyConfig.background ?? '#ffffff',
  }
  const qr = createQrElement('qr-migrated', canvasWidth, canvasHeight)
  qr.foregroundColor = legacyConfig.foreground ?? '#000000'
  qr.backgroundColor = legacyConfig.background ?? '#ffffff'
  qr.errorCorrection = (legacyConfig.error_correction as 'L' | 'M' | 'Q' | 'H') ?? 'M'
  comp.elements = [qr]
  return comp
}
