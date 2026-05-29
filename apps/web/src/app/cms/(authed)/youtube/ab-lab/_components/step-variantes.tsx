'use client'

import { useId } from 'react'
import { Lock, Plus, Trash2, Sparkles } from 'lucide-react'
import type { TestType, DisplayLabel } from '@/lib/youtube/ab-types'
import { VChip, Badge } from './ab-primitives'
import { VARIANT_COLORS } from './ab-constants'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface VariantData {
  label: DisplayLabel
  isOriginal: boolean
  thumbUrl: string | null
  titleText: string
  descriptionText: string
  isCoworkGenerated?: boolean
}

export interface StepVariantesProps {
  type: TestType
  variants: VariantData[]
  originalThumbUrl: string | null
  onUpdateVariant: (index: number, data: Partial<VariantData>) => void
  onAddVariant: () => void
  onRemoveVariant: (index: number) => void
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const TITLE_MAX = 100

const showsThumbnail = (type: TestType) => type === 'thumbnail' || type === 'combo'
const showsDescription = (type: TestType) => type === 'description' || type === 'combo'

const MAX_CHALLENGERS = 3 // B, C, D

/* ------------------------------------------------------------------ */
/*  Thumbnail slot                                                     */
/* ------------------------------------------------------------------ */

interface ThumbSlotProps {
  url: string | null
  locked?: boolean
  label: DisplayLabel
}

function ThumbSlot({ url, locked, label }: ThumbSlotProps) {
  if (url) {
    return (
      <div className="relative w-[120px] h-[68px] rounded-[var(--cms-radius)] overflow-hidden shrink-0 border border-cms-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={`Thumbnail for variant ${label}`}
          className="w-full h-full object-cover"
        />
        {locked && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <Lock className="w-4 h-4 text-white/70" />
          </div>
        )}
      </div>
    )
  }

  if (locked) {
    return (
      <div className="w-[120px] h-[68px] rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface flex items-center justify-center shrink-0">
        <span className="text-[10px] text-cms-text-dim">Sem thumb</span>
      </div>
    )
  }

  // Editable drop zone placeholder
  return (
    <div className="w-[120px] h-[68px] rounded-[var(--cms-radius)] border-2 border-dashed border-cms-border bg-cms-surface/50 flex flex-col items-center justify-center gap-1 shrink-0 cursor-pointer hover:border-cms-accent/50 transition-colors">
      <span className="text-[9px] text-cms-text-dim text-center leading-tight px-1">
        Arraste ou clique para enviar
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Character counter                                                  */
/* ------------------------------------------------------------------ */

function CharCounter({ length }: { length: number }) {
  const overLimit = length > TITLE_MAX
  return (
    <span className={`text-[10px] font-mono tabular-nums ${overLimit ? 'text-red-400 font-semibold' : 'text-cms-text-dim'}`}>
      {length}/{TITLE_MAX}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Variant row                                                        */
/* ------------------------------------------------------------------ */

interface VariantRowProps {
  variant: VariantData
  index: number
  type: TestType
  onUpdate: (data: Partial<VariantData>) => void
  onRemove?: () => void
}

function VariantRow({ variant, index, type, onUpdate, onRemove }: VariantRowProps) {
  const titleId = useId()
  const descId = useId()
  const isLocked = variant.isOriginal

  return (
    <div
      className={[
        'rounded-[var(--cms-radius)] border p-3 space-y-2.5',
        isLocked
          ? 'border-cms-border bg-cms-surface/60'
          : 'border-cms-border bg-cms-surface',
      ].join(' ')}
      style={!isLocked ? { borderLeftWidth: 3, borderLeftColor: VARIANT_COLORS[variant.label] } : undefined}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <VChip label={variant.label} size={20} />
        <span className="text-xs font-semibold text-cms-text">
          {isLocked ? 'Original' : `Variante ${variant.label}`}
        </span>

        {isLocked && (
          <Badge tone="neutral">
            <Lock className="w-2.5 h-2.5 mr-0.5" aria-hidden="true" />
            Travado
          </Badge>
        )}

        {variant.isCoworkGenerated && (
          <Badge tone="cowork">
            <Sparkles className="w-2.5 h-2.5 mr-0.5" aria-hidden="true" />
            Cowork
          </Badge>
        )}

        {/* Remove button — only for non-original, pushed right */}
        {!isLocked && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove variant ${variant.label}`}
            className="ml-auto p-1 rounded text-cms-text-dim hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex gap-3 items-start">
        {/* Thumbnail slot — thumbnail & combo types */}
        {showsThumbnail(type) && (
          <ThumbSlot
            url={variant.thumbUrl}
            locked={isLocked}
            label={variant.label}
          />
        )}

        {/* Text fields */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title input — shown for thumbnail, title, and combo types */}
          {type !== 'description' && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label htmlFor={titleId} className="text-[10px] font-medium text-cms-text-muted uppercase tracking-wide">
                  Título
                </label>
                {!isLocked && <CharCounter length={variant.titleText.length} />}
              </div>
              {isLocked ? (
                <p className="text-xs text-cms-text-muted truncate">{variant.titleText || 'No title'}</p>
              ) : (
                <input
                  id={titleId}
                  type="text"
                  value={variant.titleText}
                  onChange={e => onUpdate({ titleText: e.target.value })}
                  placeholder={`Title for variant ${variant.label}...`}
                  aria-label={`Title for variant ${variant.label}`}
                  className="w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg px-2.5 py-1.5 text-sm text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent focus:ring-offset-1"
                />
              )}
            </div>
          )}

          {/* Description textarea — shown for description and combo types */}
          {showsDescription(type) && (
            <div>
              <label htmlFor={descId} className="text-[10px] font-medium text-cms-text-muted uppercase tracking-wide mb-1 block">
                Descrição
              </label>
              {isLocked ? (
                <p className="text-xs text-cms-text-muted line-clamp-2">{variant.descriptionText || 'No description'}</p>
              ) : (
                <textarea
                  id={descId}
                  value={variant.descriptionText}
                  onChange={e => onUpdate({ descriptionText: e.target.value })}
                  placeholder={`Description for variant ${variant.label}...`}
                  aria-label={`Description for variant ${variant.label}`}
                  rows={3}
                  className="w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg px-2.5 py-1.5 text-sm text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent focus:ring-offset-1 resize-none"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  StepVariantes (main export)                                        */
/* ------------------------------------------------------------------ */

export function StepVariantes({
  type,
  variants,
  originalThumbUrl,
  onUpdateVariant,
  onAddVariant,
  onRemoveVariant,
}: StepVariantesProps) {
  const challengers = variants.filter(v => !v.isOriginal)
  const canAdd = challengers.length < MAX_CHALLENGERS

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-cms-text">Variantes</h3>
          <p className="text-[10px] text-cms-text-dim mt-0.5">
            Edite as variantes do teste. A variante A (original) fica travada.
          </p>
        </div>
        <span className="text-[10px] text-cms-text-dim font-mono tabular-nums">
          {challengers.length}/{MAX_CHALLENGERS} desafiantes
        </span>
      </div>

      {/* Variant rows */}
      <div className="space-y-2">
        {variants.map((variant, index) => (
          <VariantRow
            key={variant.label}
            variant={variant}
            index={index}
            type={type}
            onUpdate={data => onUpdateVariant(index, data)}
            onRemove={variant.isOriginal ? undefined : () => onRemoveVariant(index)}
          />
        ))}
      </div>

      {/* Add variant button */}
      {canAdd && (
        <button
          type="button"
          onClick={onAddVariant}
          className="w-full rounded-[var(--cms-radius)] border border-dashed border-cms-border bg-transparent py-2.5 flex items-center justify-center gap-1.5 text-xs text-cms-text-muted hover:border-cms-accent/50 hover:text-cms-accent transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar variante
        </button>
      )}

      {/* Hint when no challengers */}
      {challengers.length === 0 && (
        <div className="rounded-[var(--cms-radius)] bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-center">
          <p className="text-[10px] text-amber-400">
            Adicione pelo menos uma variante desafiante para continuar.
          </p>
        </div>
      )}
    </div>
  )
}
