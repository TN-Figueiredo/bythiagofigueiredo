import { z } from 'zod'

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6,8}$/)

const BaseElementSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().min(0).max(360).default(0),
  opacity: z.number().min(0).max(1).default(1),
  locked: z.boolean().default(false),
})

export const QR_DOT_STYLES = ['square', 'dots', 'rounded', 'classy'] as const
export type QrDotStyle = typeof QR_DOT_STYLES[number]

const QrElementSchema = BaseElementSchema.extend({
  type: z.literal('qr'),
  foregroundColor: HexColor.default('#000000'),
  backgroundColor: HexColor.default('#ffffff'),
  errorCorrection: z.enum(['L', 'M', 'Q', 'H']).default('M'),
  dotStyle: z.enum(QR_DOT_STYLES).default('square'),
  cornerRadius: z.number().min(0).max(50).default(0),
  padding: z.number().min(0).max(40).default(0),
  showLogo: z.boolean().default(false),
  logoPadTop: z.number().min(0).max(60).default(10),
  logoPadRight: z.number().min(0).max(60).default(8),
  logoPadBottom: z.number().min(0).max(60).default(14),
  logoPadLeft: z.number().min(0).max(60).default(12),
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
  backgroundColor: z.string().nullable().default(null),
  backgroundPadding: z.number().min(0).max(40).default(8),
  backgroundRadius: z.number().min(0).max(30).default(4),
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

const VideoElementSchema = BaseElementSchema.extend({
  type: z.literal('video'),
  src: z.string().min(1),
  borderRadius: z.number().min(0).max(100).default(0),
  borderColor: HexColor.default('#000000'),
  borderWidth: z.number().min(0).max(20).default(0),
  maintainAspectRatio: z.boolean().default(true),
  muted: z.boolean().default(true),
  loop: z.boolean().default(true),
  startTime: z.number().min(0).default(0),
  endTime: z.number().min(0).nullable().default(null),
})

const CardElementSchema = z.discriminatedUnion('type', [
  QrElementSchema,
  TextElementSchema,
  ImageElementSchema,
  VideoElementSchema,
])

const SolidBackgroundSchema = z.object({
  type: z.literal('solid'),
  color: HexColor,
})

const ImageBackgroundSchema = z.object({
  type: z.literal('image'),
  url: z.string().min(1),
  fallbackColor: HexColor,
  blur: z.number().min(0).max(100).optional(),
  offsetY: z.number().optional(),
  mediaType: z.enum(['image', 'video']).default('image'),
  startTime: z.number().min(0).optional(),
  endTime: z.number().min(0).nullable().optional(),
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
export type VideoElement = z.infer<typeof VideoElementSchema>
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
  { name: 'vertical', label: 'Vertical', width: 350, height: 960 },
  { name: 'horizontal', label: 'Horizontal', width: 960, height: 350 },
  { name: 'square', label: 'Quadrado', width: 1080, height: 1080 },
  { name: 'custom', label: 'Personalizado', width: 1080, height: 1080 },
]

export const PRESET_HINTS: Record<string, string> = {
  vertical: 'Story · pôster · cavalete de mesa',
  horizontal: 'Banner · outdoor · assinatura de e-mail',
  square: 'Feed · adesivo · cartão',
  custom: '',
}

export const BG_PALETTE = ['#1F1B17', '#F7F1E8', '#F2683C', '#9A6B3F', '#46B17E', '#5B7FD6'] as const

export const AVAILABLE_FONTS = [
  // Sans-serif
  'Inter',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Poppins',
  'Raleway',
  'Nunito',
  'Lato',
  'Work Sans',
  'DM Sans',
  // Serif
  'Playfair Display',
  'Merriweather',
  'Lora',
  'Source Serif Pro',
  'Fraunces',
  'Cormorant Garamond',
  'Libre Baskerville',
  // Display
  'Bebas Neue',
  'Oswald',
  'Anton',
  'Righteous',
  'Permanent Marker',
  'Alfa Slab One',
  // Handwriting
  'Caveat',
  'Dancing Script',
  'Pacifico',
  'Great Vibes',
  'Sacramento',
  // Monospace
  'JetBrains Mono',
  'Fira Code',
  'Source Code Pro',
  'Space Mono',
] as const

export type FontCategory = 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace'

export const FONT_CATEGORIES: Record<FontCategory, readonly string[]> = {
  'sans-serif': ['Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins', 'Raleway', 'Nunito', 'Lato', 'Work Sans', 'DM Sans'],
  'serif': ['Playfair Display', 'Merriweather', 'Lora', 'Source Serif Pro', 'Fraunces', 'Cormorant Garamond', 'Libre Baskerville'],
  'display': ['Bebas Neue', 'Oswald', 'Anton', 'Righteous', 'Permanent Marker', 'Alfa Slab One'],
  'handwriting': ['Caveat', 'Dancing Script', 'Pacifico', 'Great Vibes', 'Sacramento'],
  'monospace': ['JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Space Mono'],
} as const

export function nextElementName(elements: CardElement[], type: 'qr' | 'text' | 'image' | 'video'): string {
  const labels: Record<string, string> = { qr: 'QR Code', text: 'Texto', image: 'Imagem', video: 'Vídeo' }
  const base = labels[type]!
  const count = elements.filter(e => e.type === type).length
  return count === 0 ? base : `${base} ${count + 1}`
}

export const MAX_ELEMENTS = 20
export const MAX_HISTORY = 50
export const MIN_CANVAS = 200
export const MAX_CANVAS = 4096

export function createDefaultComposition(
  preset: AspectRatioPreset = ASPECT_RATIO_PRESETS[2]!,  // default: Quadrado 1080x1080
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
  name?: string,
): QrElement {
  const size = Math.min(canvasWidth, canvasHeight) * 0.4
  return {
    id,
    name,
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
    dotStyle: 'square',
    cornerRadius: 0,
    padding: 0,
    showLogo: false,
    logoPadTop: 10,
    logoPadRight: 8,
    logoPadBottom: 14,
    logoPadLeft: 12,
    maintainAspectRatio: true,
  }
}

export function createTextElement(
  id: string,
  canvasWidth: number,
  canvasHeight: number,
  name?: string,
): TextElement {
  return {
    id,
    name,
    type: 'text',
    x: canvasWidth * 0.1,
    y: canvasHeight * 0.8,
    width: canvasWidth * 0.8,
    height: 40,
    rotation: 0,
    opacity: 1,
    locked: false,
    content: 'Seu texto aqui',
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: '0em',
    align: 'center',
    color: '#000000',
    backgroundColor: null,
    backgroundPadding: 8,
    backgroundRadius: 4,
    uppercase: false,
  }
}

export function createImageElement(
  id: string,
  src: string,
  canvasWidth: number,
  canvasHeight: number,
  naturalWidth?: number,
  naturalHeight?: number,
  name?: string,
): ImageElement {
  let w: number
  let h: number

  if (naturalWidth && naturalHeight && naturalWidth > 0 && naturalHeight > 0) {
    const imgRatio = naturalWidth / naturalHeight
    const canvasRatio = canvasWidth / canvasHeight

    if (imgRatio > canvasRatio) {
      w = canvasWidth
      h = canvasWidth / imgRatio
    } else {
      h = canvasHeight
      w = canvasHeight * imgRatio
    }
  } else {
    w = canvasWidth
    h = canvasHeight
  }

  return {
    id,
    name,
    type: 'image',
    x: (canvasWidth - w) / 2,
    y: (canvasHeight - h) / 2,
    width: w,
    height: h,
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

export function createVideoElement(
  id: string,
  src: string,
  canvasWidth: number,
  canvasHeight: number,
  naturalWidth?: number,
  naturalHeight?: number,
  name?: string,
): VideoElement {
  let w: number
  let h: number

  if (naturalWidth && naturalHeight && naturalWidth > 0 && naturalHeight > 0) {
    const vidRatio = naturalWidth / naturalHeight
    const canvasRatio = canvasWidth / canvasHeight

    if (vidRatio > canvasRatio) {
      w = canvasWidth
      h = canvasWidth / vidRatio
    } else {
      h = canvasHeight
      w = canvasHeight * vidRatio
    }
  } else {
    w = canvasWidth
    h = canvasHeight
  }

  return {
    id,
    name,
    type: 'video',
    x: (canvasWidth - w) / 2,
    y: (canvasHeight - h) / 2,
    width: w,
    height: h,
    rotation: 0,
    opacity: 1,
    locked: false,
    src,
    borderRadius: 0,
    borderColor: '#000000',
    borderWidth: 0,
    maintainAspectRatio: true,
    muted: true,
    loop: true,
    startTime: 0,
    endTime: null,
  }
}

export function migrateLegacyQrConfig(
  legacyConfig: { foreground?: string; background?: string; error_correction?: string; size?: number },
  canvasWidth = 1080,
  canvasHeight = 1080,
): CardComposition {
  const comp = createDefaultComposition(ASPECT_RATIO_PRESETS[2]!)
  comp.canvas.width = canvasWidth
  comp.canvas.height = canvasHeight
  comp.background = {
    type: 'solid',
    color: legacyConfig.background ?? '#ffffff',
  }
  const qr = createQrElement('qr-migrated', canvasWidth, canvasHeight)
  qr.foregroundColor = legacyConfig.foreground ?? '#000000'
  qr.backgroundColor = legacyConfig.background ?? '#ffffff'
  const validEc = ['L', 'M', 'Q', 'H'] as const
  const rawEc = legacyConfig.error_correction
  qr.errorCorrection = validEc.includes(rawEc as typeof validEc[number]) ? (rawEc as 'L' | 'M' | 'Q' | 'H') : 'M'
  comp.elements = [qr]
  return comp
}
