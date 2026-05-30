'use client'

import { CheckCircle } from 'lucide-react'
import type { TestType, DisplayLabel } from '@/lib/youtube/ab-types'
import type { WizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import { Badge, SectionLabel, VChip } from './ab-primitives'
import { VARIANT_COLORS, TYPE_META, formatPercent } from './ab-constants'

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
  round_robin: 'Sequential',
  random:      'Random',
}

interface SummaryRowProps {
  label: string
  value: React.ReactNode
}

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-cms-border last:border-0">
      <span className="text-xs text-cms-text-muted">{label}</span>
      <span className="text-xs font-medium text-cms-text text-right">{value}</span>
    </div>
  )
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
          alt={`Thumbnail for variant ${variant.label}`}
          className="w-full aspect-video object-cover"
        />
      ) : (
        <div
          className="w-full aspect-video"
          style={{
            background: `linear-gradient(135deg, ${color}22 0%, ${color}44 100%)`,
          }}
          aria-label={`No thumbnail for variant ${variant.label}`}
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
          {hasTitle ? variant.title : 'Untitled'}
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
  const typeMeta = TYPE_META[type]

  return (
    <div className="space-y-5">

      {/* Success banner */}
      <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-green-300">Ready to launch</p>
          <p className="text-[11px] text-green-400/80 mt-0.5 leading-snug">
            Review your configuration below, then click Launch to start the test.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-1">
        <SectionLabel as="h3">Summary</SectionLabel>

        <dl className="divide-y divide-cms-border">
          <SummaryRow
            label="Video"
            value={
              <span className="max-w-[200px] truncate block" title={videoTitle}>
                {videoTitle}
              </span>
            }
          />
          <SummaryRow
            label="Test type"
            value={typeMeta.label}
          />
          <SummaryRow
            label="Variants"
            value={`${variants.length} (A + ${variants.length - 1} challenger${variants.length - 1 !== 1 ? 's' : ''})`}
          />
          <SummaryRow
            label="Rotation"
            value={ROTATION_LABELS[config.rotation]}
          />
          <SummaryRow
            label="Duration"
            value={`${config.duration} days max`}
          />
          <SummaryRow
            label="Confidence target"
            value={formatPercent(config.confidence, 0)}
          />
          <SummaryRow
            label="Burn-in"
            value={config.burnIn === 0 ? 'None' : `${config.burnIn} day${config.burnIn !== 1 ? 's' : ''}`}
          />
          <SummaryRow
            label="Auto-apply winner"
            value={config.autoApply ? 'Yes' : 'No'}
          />
          <SummaryRow
            label="Playoff mode"
            value={
              config.playoff
                ? <Badge tone="accent">Enabled</Badge>
                : <span className="text-cms-text-muted">Disabled</span>
            }
          />
        </dl>
      </div>

      {/* Variant preview grid */}
      <div>
        <SectionLabel as="h3">Variants</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {variants.map(variant => (
            <VariantMiniCard key={variant.label} variant={variant} />
          ))}
        </div>
      </div>

      {/* ClickMoment slot — wired by wizard shell */}
      <div data-click-moment-slot />

      {/* Bottom note */}
      <p className="text-[11px] text-cms-text-dim text-center leading-snug px-2">
        Click <strong className="text-cms-text-muted">Launch</strong> to start the test.{' '}
        Variants will begin rotating immediately.
      </p>

    </div>
  )
}
