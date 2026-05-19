import type { CardComposition, TextElement, ImageElement } from '@tn-figueiredo/links/qr'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateStyle = 'gradient' | 'overlay' | 'bold'

export interface SlideCompositionInput {
  title: string
  excerpt: string
  coverImageUrl: string | null
  logoUrl: string | null
  primaryColor: string
  slideCount: number
  /** Visual template style. Defaults to 'gradient'. */
  style?: TemplateStyle
  /** BCP-47 locale for CTA text. Defaults to 'pt-BR'. */
  locale?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORY_WIDTH = 1080
const STORY_HEIGHT = 1920
const STORY_ASPECT_RATIO = '9:16'
const MAX_SLIDE_COUNT = 10
const PADDING_X = 80
const CONTENT_WIDTH = STORY_WIDTH - PADDING_X * 2

const BOLD_PALETTE = ['#FF6B35', '#004E98', '#1A936F', '#C84B31'] as const

function boldColor(primaryColor: string): string {
  const idx = primaryColor.charCodeAt(1) % BOLD_PALETTE.length
  return BOLD_PALETTE[idx as 0 | 1 | 2 | 3]
}

interface CtaStrings {
  readMore: string
  swipeUp: string
  learnMore: string
}

const DEFAULT_LOCALE = 'pt-BR'

const CTA_TEXT: { [locale: string]: CtaStrings | undefined } = {
  'pt-BR': { readMore: 'Leia Mais', swipeUp: 'Arraste para cima', learnMore: 'Saiba Mais' },
  'en': { readMore: 'Read More', swipeUp: 'Swipe Up', learnMore: 'Learn More' },
  'es': { readMore: 'Leer Más', swipeUp: 'Desliza hacia arriba', learnMore: 'Saber Más' },
}

const DEFAULT_CTA: CtaStrings = { readMore: 'Leia Mais', swipeUp: 'Arraste para cima', learnMore: 'Saiba Mais' }

function getCta(locale: string): CtaStrings {
  return CTA_TEXT[locale] ?? DEFAULT_CTA
}

// ---------------------------------------------------------------------------
// Element factories
// ---------------------------------------------------------------------------

function makeTextElement(
  overrides: Partial<TextElement> & Pick<TextElement, 'id' | 'x' | 'y' | 'width' | 'height' | 'content'>,
): TextElement {
  return {
    type: 'text',
    rotation: 0,
    opacity: 1,
    locked: false,
    fontFamily: 'Inter',
    fontSize: 36,
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: '0',
    align: 'left',
    color: '#ffffff',
    backgroundColor: null,
    backgroundPadding: 0,
    backgroundRadius: 0,
    uppercase: false,
    ...overrides,
  }
}

function makeImageElement(
  overrides: Partial<ImageElement> & Pick<ImageElement, 'id' | 'x' | 'y' | 'width' | 'height' | 'src'>,
): ImageElement {
  return {
    type: 'image',
    rotation: 0,
    opacity: 1,
    locked: false,
    objectFit: 'cover',
    borderRadius: 0,
    borderColor: '#000000',
    borderWidth: 0,
    maintainAspectRatio: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Slide builders
// ---------------------------------------------------------------------------

/**
 * Cover slide: background image or gradient, title text, optional logo.
 */
function buildCoverSlide(input: SlideCompositionInput): CardComposition {
  const { title, coverImageUrl, logoUrl, primaryColor, style = 'gradient' } = input

  let background: CardComposition['background']

  if (style === 'overlay') {
    // Semi-transparent dark overlay on cover image if available, otherwise solid dark
    background = coverImageUrl
      ? { type: 'image', url: coverImageUrl, fallbackColor: '#0a0a0a' }
      : { type: 'solid', color: '#0a0a0a' }
  } else if (style === 'bold') {
    // Pick a bold solid color from palette based on primary color hash
    background = { type: 'solid', color: boldColor(primaryColor) }
  } else {
    // gradient (default)
    background = coverImageUrl
      ? { type: 'image', url: coverImageUrl, fallbackColor: primaryColor }
      : {
          type: 'gradient',
          angle: 160,
          stops: [
            { color: primaryColor, position: 0 },
            { color: '#0a0a0a', position: 1 },
          ],
        }
  }

  const elements: CardComposition['elements'] = []

  // Overlay gradient at bottom so text is readable
  elements.push(
    makeTextElement({
      id: crypto.randomUUID(),
      content: title,
      x: PADDING_X,
      y: 1200,
      width: CONTENT_WIDTH,
      height: 400,
      fontSize: 64,
      fontWeight: 700,
      lineHeight: 1.2,
      align: 'center',
      color: '#ffffff',
    }),
  )

  if (logoUrl) {
    elements.push(
      makeImageElement({
        id: crypto.randomUUID(),
        src: logoUrl,
        x: PADDING_X,
        y: 120,
        width: 120,
        height: 120,
        objectFit: 'contain',
        maintainAspectRatio: true,
        borderRadius: 16,
      }),
    )
  }

  return {
    version: 1,
    canvas: { width: STORY_WIDTH, height: STORY_HEIGHT, aspectRatio: STORY_ASPECT_RATIO },
    background,
    elements,
  }
}

/**
 * Excerpt / content slide: dark background, accent line, text content.
 */
function buildContentSlide(
  content: string,
  primaryColor: string,
  slideIndex: number,
  style: TemplateStyle = 'gradient',
): CardComposition {
  let accentColor = primaryColor
  let background: CardComposition['background'] = { type: 'solid', color: '#0a0a0a' }

  if (style === 'bold') {
    background = { type: 'solid', color: boldColor(primaryColor) }
    accentColor = '#ffffff'
  }

  const elements: CardComposition['elements'] = [
    // Accent top bar
    makeTextElement({
      id: crypto.randomUUID(),
      content: `${slideIndex + 1}`,
      x: PADDING_X,
      y: 300,
      width: 60,
      height: 60,
      fontSize: 28,
      fontWeight: 700,
      align: 'center',
      color: accentColor,
    }),
    // Content text
    makeTextElement({
      id: crypto.randomUUID(),
      content,
      x: PADDING_X,
      y: 420,
      width: CONTENT_WIDTH,
      height: 900,
      fontSize: 44,
      fontWeight: 400,
      lineHeight: 1.5,
      align: 'left',
      color: '#f4f4f5',
    }),
  ]

  return {
    version: 1,
    canvas: { width: STORY_WIDTH, height: STORY_HEIGHT, aspectRatio: STORY_ASPECT_RATIO },
    background,
    elements,
  }
}

/**
 * CTA slide: locale-aware read-more + short_url placeholder + swipe-up hint.
 */
function buildCtaSlide(
  primaryColor: string,
  style: TemplateStyle = 'gradient',
  locale: string = DEFAULT_LOCALE,
): CardComposition {
  const cta = getCta(locale)

  let background: CardComposition['background']
  if (style === 'bold') {
    background = { type: 'solid', color: boldColor(primaryColor) }
  } else if (style === 'overlay') {
    background = { type: 'solid', color: '#0a0a0a' }
  } else {
    background = {
      type: 'gradient',
      angle: 135,
      stops: [
        { color: '#0a0a0a', position: 0 },
        { color: primaryColor, position: 1 },
      ],
    }
  }

  const elements: CardComposition['elements'] = [
    makeTextElement({
      id: crypto.randomUUID(),
      content: cta.readMore,
      x: PADDING_X,
      y: 700,
      width: CONTENT_WIDTH,
      height: 120,
      fontSize: 72,
      fontWeight: 700,
      align: 'center',
      color: '#ffffff',
    }),
    makeTextElement({
      id: crypto.randomUUID(),
      content: '{{short_url}}',
      x: PADDING_X,
      y: 870,
      width: CONTENT_WIDTH,
      height: 80,
      fontSize: 32,
      fontWeight: 400,
      fontFamily: 'monospace',
      align: 'center',
      color: primaryColor,
    }),
    makeTextElement({
      id: crypto.randomUUID(),
      content: cta.swipeUp,
      x: PADDING_X,
      y: 1000,
      width: CONTENT_WIDTH,
      height: 80,
      fontSize: 36,
      fontWeight: 600,
      align: 'center',
      color: '#a1a1aa',
    }),
  ]

  return {
    version: 1,
    canvas: { width: STORY_WIDTH, height: STORY_HEIGHT, aspectRatio: STORY_ASPECT_RATIO },
    background,
    elements,
  }
}

// ---------------------------------------------------------------------------
// Content chunking
// ---------------------------------------------------------------------------

/**
 * Splits excerpt into N roughly equal chunks.
 */
function chunkExcerpt(excerpt: string, chunkCount: number): string[] {
  if (chunkCount <= 0) return []
  if (chunkCount === 1) return [excerpt]

  // Try to split on sentence boundaries first
  const sentences = excerpt.split(/(?<=[.!?])\s+/).filter(Boolean)

  if (sentences.length <= 1) {
    // Fallback: split by word count
    const words = excerpt.split(/\s+/)
    const wordsPerChunk = Math.ceil(words.length / chunkCount)
    const chunks: string[] = []
    for (let i = 0; i < chunkCount; i++) {
      const chunk = words.slice(i * wordsPerChunk, (i + 1) * wordsPerChunk).join(' ')
      if (chunk) chunks.push(chunk)
    }
    return chunks
  }

  // Distribute sentences across chunks
  const sentencesPerChunk = Math.ceil(sentences.length / chunkCount)
  const chunks: string[] = []
  for (let i = 0; i < chunkCount; i++) {
    const chunk = sentences.slice(i * sentencesPerChunk, (i + 1) * sentencesPerChunk).join(' ')
    if (chunk) chunks.push(chunk)
  }

  // Pad with last chunk if not enough sentences
  while (chunks.length < chunkCount) {
    chunks.push(chunks[chunks.length - 1] ?? excerpt)
  }

  return chunks.slice(0, chunkCount)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates an array of CardCompositions for Instagram Stories multi-slide.
 *
 * Layout by slideCount:
 * - 1: cover only
 * - 2: cover + CTA
 * - 3: cover + excerpt + CTA
 * - N: cover + (N-2) content slides + CTA
 *
 * Max 10 slides.
 */
export function generateSlideCompositions(input: SlideCompositionInput): CardComposition[] {
  const clampedCount = Math.min(input.slideCount, MAX_SLIDE_COUNT)
  const style: TemplateStyle = input.style ?? 'gradient'
  const locale = input.locale ?? DEFAULT_LOCALE

  if (clampedCount <= 1) {
    return [buildCoverSlide(input)]
  }

  const slides: CardComposition[] = []

  // Always start with cover
  slides.push(buildCoverSlide(input))

  const contentSlideCount = clampedCount - 2 // exclude cover and CTA
  if (contentSlideCount > 0) {
    const chunks = chunkExcerpt(input.excerpt, contentSlideCount)
    for (let i = 0; i < contentSlideCount; i++) {
      const chunk = chunks[i] ?? input.excerpt
      slides.push(buildContentSlide(chunk, input.primaryColor, i, style))
    }
  }

  // Always end with CTA
  slides.push(buildCtaSlide(input.primaryColor, style, locale))

  return slides
}
