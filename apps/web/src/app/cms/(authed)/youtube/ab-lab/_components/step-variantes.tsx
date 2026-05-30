'use client'

import { useState, useId } from 'react'
import { Lock, Plus, Trash2, Sparkles, Video, ImageIcon, ChevronDown, Link2 } from 'lucide-react'
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
  briefing?: string
  tags?: string[]
  classification?: 'hero' | 'challenger' | 'safety'
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

const VARIANT_ROLE_LABELS: Record<string, string> = {
  hero: 'Hero',
  challenger: 'Challenger',
  safety: 'Safety',
}

/* ------------------------------------------------------------------ */
/*  Thumbnail slot (design: 260px wide, 16:9, inside grid left col)    */
/* ------------------------------------------------------------------ */

interface ThumbSlotProps {
  url: string | null
  locked?: boolean
  label: DisplayLabel
}

function ThumbSlot({ url, locked, label }: ThumbSlotProps) {
  if (url) {
    return (
      <div
        className="relative w-full overflow-hidden shrink-0"
        style={{ aspectRatio: '16/9', borderRadius: 10, outline: '1px solid var(--cms-border, #332D25)' }}
      >
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
      <div
        className="w-full flex items-center justify-center shrink-0"
        style={{
          aspectRatio: '16/9',
          borderRadius: 10,
          border: '1px solid var(--cms-border, #332D25)',
          background: 'var(--cms-surface)',
        }}
      >
        <span className="text-[10px] text-cms-text-dim">Sem thumb</span>
      </div>
    )
  }

  // Editable drop zone — matches design: dashed border, centered icon + text
  return (
    <div
      className="w-full flex flex-col items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-colors"
      style={{
        aspectRatio: '16/9',
        borderRadius: 10,
        border: '1.5px dashed var(--cms-border-strong, rgba(245,239,230,.15))',
        color: 'var(--cms-text-dim)',
        fontSize: 12,
      }}
      role="button"
      tabIndex={0}
      aria-label={`Upload thumbnail variante ${label}`}
    >
      <ImageIcon size={24} strokeWidth={1.5} />
      <span style={{ fontWeight: 600, fontSize: 12 }}>Solte a thumb {label}</span>
      <span className="text-[11px]" style={{ color: 'var(--cms-text-dim)' }}>
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
    <span
      className={`text-[11px] font-mono tabular-nums text-right ${overLimit ? 'text-red-400 font-semibold' : ''}`}
      style={overLimit ? undefined : { color: 'var(--cms-text-dim)' }}
    >
      {length}/{TITLE_MAX}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Briefing box (design: surface bg, Sparkles eyebrow, tags)          */
/* ------------------------------------------------------------------ */

interface BriefingBoxProps {
  briefing?: string
  tags?: string[]
}

function BriefingBox({ briefing, tags }: BriefingBoxProps) {
  if (!briefing && (!tags || tags.length === 0)) return null

  return (
    <div
      style={{
        marginTop: 12,
        padding: '10px 12px',
        background: 'var(--cms-surface)',
        border: '1px solid var(--cms-border, #332D25)',
        borderRadius: 10,
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <span
          className="inline-flex items-center gap-1 font-semibold uppercase tracking-[0.14em]"
          style={{ fontSize: 10, color: 'var(--cms-text-dim)' }}
        >
          <Sparkles size={10} />
          BRIEFING DA THUMB
        </span>
        <a
          href="#"
          className="transition-colors hover:underline"
          style={{ fontSize: '10.5px', color: 'var(--cms-accent)', textDecoration: 'none' }}
          onClick={e => e.preventDefault()}
        >
          regerar
        </a>
      </div>
      {briefing && (
        <p style={{ fontSize: '11.5px', lineHeight: 1.5, color: 'var(--cms-text-dim)', margin: 0 }}>
          {briefing}
        </p>
      )}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-[5px]" style={{ marginTop: 8 }}>
          {tags.map(tag => (
            <span
              key={tag}
              style={{
                fontSize: '9.5px',
                padding: '2px 7px',
                borderRadius: 5,
                background: 'var(--cms-surface-3, var(--cms-surface-hover))',
                color: 'var(--cms-text-dim)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Variant card (design: var-row with header + grid body)             */
/* ------------------------------------------------------------------ */

interface VariantCardProps {
  variant: VariantData
  index: number
  type: TestType
  onUpdate: (data: Partial<VariantData>) => void
  onRemove?: () => void
}

function VariantCard({ variant, index, type, onUpdate, onRemove }: VariantCardProps) {
  const titleId = useId()
  const descId = useId()
  const isLocked = variant.isOriginal

  // Determine role label
  const roleLabel = isLocked
    ? 'Original'
    : variant.classification
      ? VARIANT_ROLE_LABELS[variant.classification] ?? 'Challenger'
      : `Challenger`

  // Colored border for challengers (color at 0.267 opacity)
  const variantColor = VARIANT_COLORS[variant.label]

  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${isLocked ? 'var(--cms-border, #332D25)' : `${variantColor}44`}`,
        background: 'var(--cms-surface-2, #272219)',
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-[9px] flex-wrap"
        style={{
          padding: '11px 16px',
          borderBottom: '1px solid var(--cms-border, #332D25)',
        }}
      >
        <VChip label={variant.label} size={22} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cms-text)' }}>
          {roleLabel}
        </span>

        {isLocked && (
          <Badge tone="neutral">
            <Lock size={10} aria-hidden="true" />
            Travado
          </Badge>
        )}

        {variant.isCoworkGenerated && (
          <Badge tone="cowork">
            <Sparkles size={10} aria-hidden="true" />
            GERADO PELO COWORK
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

      {/* Body — grid: 260px | 1fr */}
      <div
        className="var-body"
        style={{
          display: 'grid',
          gridTemplateColumns: showsThumbnail(type) ? '260px 1fr' : '1fr',
          gap: 18,
          padding: 16,
        }}
      >
        {/* Left: Thumbnail slot */}
        {showsThumbnail(type) && (
          <ThumbSlot
            url={variant.thumbUrl}
            locked={isLocked}
            label={variant.label}
          />
        )}

        {/* Right: Text fields */}
        <div className="min-w-0">
          {/* Title input — shown for thumbnail, title, and combo types */}
          {type !== 'description' && (
            <div>
              {isLocked ? (
                <>
                  <div
                    style={{
                      fontSize: '13.5px',
                      color: 'var(--cms-text-dim)',
                      fontStyle: 'italic',
                      padding: '10px 14px',
                      border: '1px solid var(--cms-border, #332D25)',
                      borderRadius: 10,
                      background: 'var(--cms-surface)',
                    }}
                  >
                    {variant.titleText || 'No title'}
                  </div>
                  <p style={{ fontSize: '10.5px', color: 'var(--cms-text-dim)', marginTop: 6, margin: '6px 0 0 0' }}>
                    Titulo mantido — so a thumbnail esta sendo testada.
                  </p>
                </>
              ) : (
                <>
                  <input
                    id={titleId}
                    type="text"
                    value={variant.titleText}
                    onChange={e => onUpdate({ titleText: e.target.value })}
                    placeholder={`Title for variant ${variant.label}...`}
                    aria-label={`Title for variant ${variant.label}`}
                    maxLength={100}
                    className="w-full transition-colors"
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid var(--cms-border-strong, rgba(245,239,230,.15))',
                      background: 'var(--cms-surface)',
                      color: 'var(--cms-text)',
                      fontSize: '13.5px',
                      fontFamily: 'inherit',
                      lineHeight: 1.5,
                      outline: 'none',
                    }}
                  />
                  <div style={{ marginTop: 4 }} className="text-right">
                    <CharCounter length={variant.titleText.length} />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Description textarea — shown for description and combo types */}
          {showsDescription(type) && (
            <div style={{ marginTop: type !== 'description' ? 12 : 0 }}>
              <label
                htmlFor={descId}
                className="font-medium uppercase tracking-[0.14em] block"
                style={{ fontSize: 10, color: 'var(--cms-text-dim)', marginBottom: 4 }}
              >
                Descricao
              </label>
              {isLocked ? (
                <p className="text-xs line-clamp-2" style={{ color: 'var(--cms-text-dim)' }}>
                  {variant.descriptionText || 'No description'}
                </p>
              ) : (
                <textarea
                  id={descId}
                  value={variant.descriptionText}
                  onChange={e => onUpdate({ descriptionText: e.target.value })}
                  placeholder={`Description for variant ${variant.label}...`}
                  aria-label={`Description for variant ${variant.label}`}
                  rows={3}
                  className="w-full resize-none transition-colors"
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--cms-border-strong, rgba(245,239,230,.15))',
                    background: 'var(--cms-surface)',
                    color: 'var(--cms-text)',
                    fontSize: '13.5px',
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                    outline: 'none',
                  }}
                />
              )}
            </div>
          )}

          {/* Briefing box — only for non-original challengers */}
          {!isLocked && (
            <BriefingBox briefing={variant.briefing} tags={variant.tags} />
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Takes strip (video frame thumbnails)                               */
/* ------------------------------------------------------------------ */

const PLACEHOLDER_TAKES = [
  { time: '0:14', bg: 'linear-gradient(135deg,#3a2f28 40%,#2a2018)' },
  { time: '1:42', bg: 'linear-gradient(135deg,#3a3020 40%,#2a2418)' },
  { time: '4:08', bg: 'linear-gradient(135deg,#2a3028 40%,#1a2418)' },
  { time: '8:31', bg: 'linear-gradient(135deg,#382a20 40%,#281a10)' },
  { time: '11:55', bg: 'linear-gradient(135deg,#302830 40%,#201820)' },
]

function TakesStrip() {
  return (
    <div
      style={{
        padding: 14,
        background: 'var(--cms-surface-2, #272219)',
        borderRadius: 'var(--cms-radius, 10px)',
        marginBottom: 16,
        border: '1px solid var(--cms-border, #332D25)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span
          className="inline-flex items-center gap-[5px] font-semibold uppercase tracking-[0.14em]"
          style={{ fontSize: 10, color: 'var(--cms-text-dim)' }}
        >
          <Video size={12} />
          TAKES DO VIDEO . BASE PRAS THUMBS
        </span>
        <span style={{ fontSize: '10.5px', color: 'var(--cms-text-dim)' }}>
          frames extraidos automaticamente
        </span>
      </div>

      {/* 5-col grid of frame placeholders */}
      <div
        className="takes-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 8,
        }}
      >
        {PLACEHOLDER_TAKES.map(take => (
          <div
            key={take.time}
            style={{
              aspectRatio: '16/9',
              borderRadius: 7,
              background: take.bg,
              outline: '1px solid var(--cms-border, #332D25)',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'repeating-linear-gradient(45deg,rgba(255,255,255,.02) 0 1px,transparent 1px 8px)',
              }}
            />
            <span
              className="font-mono"
              style={{
                position: 'absolute',
                right: 4,
                bottom: 4,
                fontSize: 8,
                color: 'var(--cms-text-dim)',
              }}
            >
              {take.time}
            </span>
          </div>
        ))}
      </div>

      {/* Info text */}
      <p style={{ fontSize: '10.5px', color: 'var(--cms-text-dim)', marginTop: 8, margin: '8px 0 0 0' }}>
        O Cowork usa estes frames + os briefings pra gerar variantes. Voce pode trocar qualquer thumb depois.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Description accordion (collapsible)                                */
/* ------------------------------------------------------------------ */

function DescriptionAccordion() {
  const [open, setOpen] = useState(false)

  return (
    <div
      style={{
        marginTop: 16,
        border: '1px solid var(--cms-border, #332D25)',
        borderRadius: 'var(--cms-radius, 10px)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 transition-colors"
        style={{
          padding: '12px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--cms-text)',
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        <ChevronDown
          size={14}
          style={{
            color: 'var(--cms-text-dim)',
            transition: 'transform 0.2s',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        />
        <Link2 size={14} style={{ color: 'var(--cms-text-dim)' }} />
        Avancado . variacoes de descricao
        <Badge tone="neutral" className="ml-1">OPCIONAL</Badge>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', color: 'var(--cms-text-dim)', fontSize: '12px' }}>
          <p>Configure descricoes alternativas para cada variante. Funciona como um complemento ao teste principal.</p>
        </div>
      )}
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
    <div>
      {/* Section header — design: text + badge in row */}
      <div className="flex items-center justify-between gap-2" style={{ marginBottom: 14 }}>
        <div>
          <h3 className="text-sm font-semibold text-cms-text" style={{ margin: 0 }}>Variantes</h3>
          <p style={{ fontSize: '13.5px', color: 'var(--cms-text-dim)', maxWidth: 520, marginTop: 2, margin: '2px 0 0 0' }}>
            Monte ate 3 desafiantes. A original (A) fica travada como referencia.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-cms-text-dim font-mono tabular-nums">
            {challengers.length}/{MAX_CHALLENGERS} desafiantes
          </span>
          <Badge tone="neutral">MAX. 4 VARIANTES</Badge>
        </div>
      </div>

      {/* Takes strip — video frame thumbnails */}
      {showsThumbnail(type) && <TakesStrip />}

      {/* Variant cards */}
      {variants.map((variant, index) => (
        <VariantCard
          key={variant.label}
          variant={variant}
          index={index}
          type={type}
          onUpdate={data => onUpdateVariant(index, data)}
          onRemove={variant.isOriginal ? undefined : () => onRemoveVariant(index)}
        />
      ))}

      {/* Add variant button */}
      {canAdd && (
        <button
          type="button"
          onClick={onAddVariant}
          className="w-full flex items-center justify-center gap-1.5 text-xs transition-colors"
          style={{
            borderRadius: 14,
            border: '1px dashed var(--cms-border, #332D25)',
            background: 'transparent',
            padding: '14px 0',
            color: 'var(--cms-text-dim)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar variante
        </button>
      )}

      {/* Hint when no challengers */}
      {challengers.length === 0 && (
        <div
          className="text-center"
          style={{
            borderRadius: 10,
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            padding: '10px 14px',
            marginTop: 12,
          }}
        >
          <p style={{ fontSize: 10, color: '#f59e0b', margin: 0 }}>
            Adicione pelo menos uma variante desafiante para continuar.
          </p>
        </div>
      )}

      {/* Description accordion — collapsible advanced section */}
      {showsDescription(type) && <DescriptionAccordion />}
    </div>
  )
}
