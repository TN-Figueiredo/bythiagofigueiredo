'use client'

import { AlertTriangle, CheckCircle, CircleHelp } from 'lucide-react'
import type { TestType, DisplayLabel } from '@/lib/youtube/ab-types'
import type { WizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import { tetoPadrao } from '@/lib/youtube/ab-gravacao/decisao-v2'
import { Badge, VChip } from './ab-primitives'
import { NOTA_ATIVAR, tituloDoBanner, type AvisoOriginal, type EstadoAviso } from '@/lib/youtube/ab-original-resolucao'
import { VARIANT_COLORS, TYPE_META, ROTULO_TIPO_DESCONHECIDO_CURTO } from './ab-constants'
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
  /** D12: estado da leitura da resolução da original (undefined = não se aplica). */
  avisoOriginal?: EstadoAviso
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
  combo:       'título + thumbnail',
}

/** Build the one-liner summary for the success banner */
function buildSummaryText(
  variants: ReviewVariant[],
  type: TestType,
  config: WizardConfig,
): string {
  const parts: string[] = [
    `${variants.length} variantes ${TYPE_LABELS_PT[type as TestType] ?? ROTULO_TIPO_DESCONHECIDO_CURTO}`,
    `rotação ${ROTATION_LABELS[config.rotation]}`,
    `${config.durationTouched ? config.duration : tetoPadrao(variants.length)} dias`,
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
/*  AvisoResolucao (D12)                                               */
/* ------------------------------------------------------------------ */

type AvisoComSelo = Exclude<AvisoOriginal, { kind: 'indisponivel' }>

function AvisoResolucao({ aviso }: { aviso: AvisoComSelo }) {
  const baixa = aviso.kind === 'baixa'
  return (
    <div
      role="status"
      className="grid justify-items-start gap-2 rounded-lg border border-cms-border bg-cms-surface px-4 py-3 text-[12.5px] leading-[1.55] text-cms-text"
    >
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-px text-[12px] font-semibold leading-5 ${baixa ? '' : 'bg-cms-surface-3 text-cms-text-muted'}`}
        style={baixa
          ? { color: 'var(--cms-amber-text)', borderColor: 'var(--cms-amber-line)', background: 'var(--cms-amber-soft)' }
          : { border: '1px dashed var(--theme-cms-text-dim)' }}
      >
        {baixa
          ? <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
          : <CircleHelp className="w-3.5 h-3.5" aria-hidden="true" />}
        {aviso.selo}
      </span>
      <p className="m-0 max-w-[78ch]">{aviso.texto}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  StepRevisar                                                        */
/* ------------------------------------------------------------------ */

export function StepRevisar({ type, variants, config, videoTitle, avisoOriginal }: StepRevisarProps) {
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
          background: 'var(--cms-ban-bg)',
          border: '1px solid var(--cms-ban-bd)',
        }}
      >
        <CheckCircle
          className={`w-5 h-5 shrink-0 ${avisoOriginal === 'pendente' ? 'text-cms-text-muted' : 'text-[var(--cms-green-icon)]'}`}
          aria-hidden="true"
        />
        <p className="text-[13px] leading-snug text-cms-text m-0">
          <strong className={`font-semibold ${avisoOriginal === 'pendente' ? 'text-cms-text' : 'text-[var(--cms-green-text)]'}`}>{tituloDoBanner(avisoOriginal)}</strong>{' '}
          <span className="text-cms-text">{summaryText}</span>
        </p>
      </div>

      {avisoOriginal === 'pendente' ? (
        <div aria-busy="true" aria-label="Lendo a resolução da original">
          <span className="block h-5 w-3/5 rounded bg-cms-surface-3 motion-safe:animate-pulse" />
        </div>
      ) : avisoOriginal ? (
        avisoOriginal.kind === 'indisponivel' ? (
          <p role="status" className="m-0 text-[12.5px] text-cms-text-muted">{avisoOriginal.texto}</p>
        ) : (
          <AvisoResolucao aviso={avisoOriginal} />
        )
      ) : null}

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
          semCtr
          semVencedor
        />
      )}

      {/* Bottom note */}
      <p className="text-[11px] text-cms-text-dim text-center leading-snug px-2">
        {NOTA_ATIVAR.split('Ativar teste')[0]}
        <strong className="text-cms-text-muted">Ativar teste</strong>
        {NOTA_ATIVAR.split('Ativar teste')[1]}
      </p>

    </div>
  )
}
