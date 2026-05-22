import type { CardComposition } from '@tn-figueiredo/links/qr'

export interface SlideMetadata {
  title: string
  coverImageUrl: string | undefined
}

const EMPTY: Readonly<SlideMetadata> = Object.freeze({ title: '', coverImageUrl: undefined })

function isHttpUrl(v: unknown): v is string {
  return typeof v === 'string' && (v.startsWith('https://') || v.startsWith('http://'))
}

export function extractSlideMetadata(slides: unknown[]): SlideMetadata {
  const first = slides[0]
  if (!first || typeof first !== 'object') return EMPTY

  const slide = first as Partial<CardComposition>

  let title = ''
  let coverImageUrl: string | undefined

  const bg = slide.background as Record<string, unknown> | undefined
  if (bg?.type === 'image' && isHttpUrl(bg.url)) {
    coverImageUrl = bg.url
  }

  const elements = slide.elements
  if (!Array.isArray(elements)) return { title, coverImageUrl }

  if (!coverImageUrl) {
    for (const el of elements) {
      if (el.type === 'image' && 'src' in el && isHttpUrl(el.src)) {
        coverImageUrl = el.src
        break
      }
    }
  }

  let maxFontSize = 0
  for (const el of elements) {
    if (
      el.type === 'text' &&
      'content' in el &&
      typeof el.content === 'string' &&
      'fontSize' in el &&
      typeof el.fontSize === 'number' &&
      el.fontSize > maxFontSize &&
      !el.content.startsWith('{{')
    ) {
      maxFontSize = el.fontSize
      title = el.content
    }
  }

  return { title, coverImageUrl }
}
