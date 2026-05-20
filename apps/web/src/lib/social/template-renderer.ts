import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  renderTemplate as renderKonva,
  type TemplateContext,
} from './konva-renderer'
import {
  CANONICAL_SIZES,
  type TemplateAspectRatio,
  type SocialTemplate,
} from './template-schemas'
import type { CardComposition } from '@tn-figueiredo/links/qr'

// ---------------------------------------------------------------------------
// Default fallback composition (simple dark card)
// ---------------------------------------------------------------------------

const DEFAULT_COMPOSITION: CardComposition = {
  canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
  version: 1 as const,
  background: { type: 'solid', color: '#0a0a0a' },
  elements: [
    {
      id: 'title',
      type: 'text' as const,
      content: '{{title}}',
      x: 80,
      y: 700,
      width: 920,
      height: 300,
      fontFamily: 'Inter',
      fontSize: 48,
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: '0',
      align: 'center' as const,
      color: '#fafafa',
      opacity: 1,
      rotation: 0,
      locked: false,
      backgroundColor: null,
      backgroundPadding: 0,
      backgroundRadius: 0,
      uppercase: false,
    },
    {
      id: 'url',
      type: 'text' as const,
      content: '{{short_url}}',
      x: 80,
      y: 1600,
      width: 920,
      height: 60,
      fontFamily: 'monospace',
      fontSize: 24,
      fontWeight: 400,
      lineHeight: 1.4,
      letterSpacing: '0',
      align: 'center' as const,
      color: '#a1a1aa',
      opacity: 1,
      rotation: 0,
      locked: false,
      backgroundColor: null,
      backgroundPadding: 0,
      backgroundRadius: 0,
      uppercase: false,
    },
  ],
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RenderTemplateOptions {
  templateId?: string
  aspectRatio?: TemplateAspectRatio
  data: TemplateContext
}

export async function renderTemplate(
  opts: RenderTemplateOptions,
): Promise<Buffer> {
  const aspectRatio = opts.aspectRatio ?? '9:16'
  const size = CANONICAL_SIZES[aspectRatio]

  let composition: CardComposition = DEFAULT_COMPOSITION

  if (opts.templateId) {
    const supabase = getSupabaseServiceClient()
    const { data: row } = await supabase
      .from('social_templates')
      .select('composition')
      .eq('id', opts.templateId)
      .single()

    if (row?.composition) {
      composition = row.composition as unknown as CardComposition
    }
  }

  return renderKonva(composition, opts.data, size)
}

// ---------------------------------------------------------------------------
// Multi-slide rendering
// ---------------------------------------------------------------------------

/**
 * Renders an array of CardCompositions into JPEG Buffers in order.
 * Each slide is rendered independently at its own canvas dimensions.
 */
export async function renderMultiSlide(
  slides: CardComposition[],
  context: TemplateContext,
): Promise<Buffer[]> {
  const results = await Promise.allSettled(
    slides.map((slide) => {
      const size = { width: slide.canvas.width, height: slide.canvas.height }
      return renderKonva(slide, context, size)
    }),
  )
  const buffers: Buffer[] = []
  for (let idx = 0; idx < results.length; idx++) {
    const r = results[idx]!
    if (r.status === 'fulfilled') {
      buffers.push(r.value)
    } else {
      Sentry.captureException(r.reason, {
        tags: { component: 'template-renderer', action: 'renderMultiSlide', slideIndex: idx },
      })
    }
  }
  return buffers
}
