'use client'

import { CheckCircle } from 'lucide-react'
import type { TestType, DisplayLabel } from '@/lib/youtube/ab-types'
import type { WizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import { Badge, VChip } from './ab-primitives'
import { VARIANT_COLORS, TYPE_META, formatPercent } from './ab-constants'
import { ClickMoment } from './click-moment'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ReviewVariant {
  label: DisplayLabel
  thumbUrl: string | null
  title: string
  isOriginal: boolean
}

export interface StepRevisarProps {
  type: TestType
  variants: ReviewVariant[]
  config: WizardConfig
  videoTitle: string
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const ROTATION_LABELS: Record<WizardConfig['rotation'], string> = {
  abba:        'ABBA',
  round_robin: 'sequencial',
  random:      'aleatória',
}

const TYPE_LABELS_PT: Record<TestType, string> = {
  thumbnail:   'thumbnail',
  title:       'título',
  description: 'descrição',
  combo:       'combo',
}

/** Build the one-liner summary for the success banner */
function buildSummaryText(
  variants: ReviewVariant[],
  type: TestType,
  config: WizardConfig,
): string {
  const parts: string[] = [
    `${variants.length} variantes ${TYPE_LABELS_PT[type]}`,
    `rotação ${ROTATION_LABELS[config.rotation]}`,
    `${config.duration} dias`,
    `confiança ${formatPercent(config.confidence, 0)}`,
    config.playoff ? 'playoff on' : 'playoff off',
  ]
  return parts.join(' · ')
}

function buildClickMomentVariants(variants: ReviewVariant[]) {
  const baseCtr = 4.2
  return variants.map((v, i) => ({
    label: v.label,
    color: VARIANT_COLORS[v.label],
    ctr: i === 0 ? baseCtr : +(baseCtr + (i * 1.1)).toFixed(1),
    thumbUrl: v.thumbUrl,
  }))
}

/* ------------------------------------------------------------------ */
/*  Variant mini-card                                                  */
/* ------------------------------------------------------------------ */

interface VariantMiniCardProps {
  variant: ReviewVariant
}

function VariantMiniCard({ variant }: VariantMiniCardProps) {
  const color = VARIANT_COLORS[variant.label]
  const hasThumb = Boolean(variant.thumbUrl)
  const hasTitle = Boolean(variant.title)

  return (
    <div
      className="rounded-lg border border-cms-border bg-cms-surface overflow-hidden"
      style={{ borderTopWidth: 3, borderTopColor: color }}
    >
      {/* Thumbnail */}
      {hasThumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={variant.thumbUrl!}
          alt={`Thumbnail da variante ${variant.label}`}
          referrerPolicy="no-referrer"
          className="w-full aspect-video object-cover"
        />
      ) : (
        <div
          className="w-full aspect-video"
          style={{
            background: `linear-gradient(135deg, ${color}22 0%, ${color}44 100%)`,
          }}
          aria-label={`Sem thumbnail para variante ${variant.label}`}
        />
      )}

      {/* Footer */}
      <div className="px-2 py-1.5 flex items-center gap-1.5">
        <VChip label={variant.label} size={18} />
        <span
          className={[
            'text-[10px] leading-snug truncate flex-1',
            hasTitle ? 'text-cms-text' : 'text-cms-text-dim italic',
          ].join(' ')}
        >
          {hasTitle ? variant.title : 'Sem título'}
        </span>
        {variant.isOriginal && (
          <Badge tone="neutral">Original</Badge>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  StepRevisar                                                        */
/* ------------------------------------------------------------------ */

export function StepRevisar({ type, variants, config, videoTitle }: StepRevisarProps) {
  const summaryText = buildSummaryText(variants, type, config)
  const clickMomentVariants = buildClickMomentVariants(variants)
  const winnerLabel = variants.length > 1 ? variants[variants.length - 1]!.label : 'A'
  const winnerColor = VARIANT_COLORS[winnerLabel as DisplayLabel] ?? VARIANT_COLORS.A

  return (
    <div className="space-y-5">

      {/* Success banner — green-soft, rounded-12px */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{
          borderRadius: 12,
          background: 'rgba(34,197,94,0.08)',
        }}
      >
        <CheckCircle className="w-5 h-5 shrink-0" style={{ color: '#22c55e' }} aria-hidden="true" />
        <p className="text-[13px] leading-snug text-cms-text m-0">
          <strong className="font-semibold" style={{ color: '#4ade80' }}>Tudo pronto.</strong>{' '}
          <span className="text-cms-text-muted">{summaryText}</span>
        </p>
      </div>

      {/* Variant preview grid — 2x2 */}
      <div>
        <h3 className="text-sm font-semibold text-cms-text mb-2">Variantes</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {variants.map(variant => (
            <VariantMiniCard key={variant.label} variant={variant} />
          ))}
        </div>
      </div>

      {/* ClickMoment preview — only when 2+ variants */}
      {variants.length >= 2 && (
        <ClickMoment
          videoTitle={videoTitle}
          winnerLabel={winnerLabel as DisplayLabel}
          winnerColor={winnerColor}
          variants={clickMomentVariants}
        />
      )}

      {/* Bottom note */}
      <p className="text-[11px] text-cms-text-dim text-center leading-snug px-2">
        Clique em <strong className="text-cms-text-muted">Ativar teste</strong> para iniciar.{' '}
        As variantes começarão a rotacionar imediatamente.
      </p>

    </div>
  )
}
