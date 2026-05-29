'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { VariantMetadata } from '@/lib/youtube/ab-types'

interface WizardVariantCardProps {
  label: string
  metadata: VariantMetadata
  titleText: string
  onTitleChange: (title: string) => void
  descriptionText?: string
  onDescriptionChange?: (desc: string) => void
  color: 'green' | 'blue' | 'amber'
}

const BORDER_COLORS = {
  green: 'border-t-green-500',
  blue: 'border-t-blue-500',
  amber: 'border-t-amber-500',
} as const

const BADGE_COLORS = {
  green: 'bg-green-500/20 text-green-400',
  blue: 'bg-blue-500/20 text-blue-400',
  amber: 'bg-amber-500/20 text-amber-400',
} as const
async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copiado!`)
  } catch {
    toast.error('Falha ao copiar')
  }
}

export function WizardVariantCard({
  label,
  metadata,
  titleText,
  onTitleChange,
  descriptionText,
  onDescriptionChange,
  color,
}: WizardVariantCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const synopsisText = metadata.synergy?.division ?? metadata.rationale ?? ''
  const synopsis = synopsisText.length > 80 ? `${synopsisText.slice(0, 80)}...` : synopsisText

  return (
    <div className={`rounded-lg border border-cms-border border-t-3 ${BORDER_COLORS[color]} bg-cms-surface p-3 space-y-2`}>
      <div className="flex items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-bold ${BADGE_COLORS[color]}`}>{label}</span>
        {metadata.score?.combo !== undefined && (
          <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-bold text-indigo-400">
            {metadata.score.combo}
          </span>
        )}
        {metadata.classification && (
          <span className="text-muted-foreground text-xs">{metadata.classification}</span>
        )}
      </div>

      {metadata.ai_image_prompt && (
        <div className="flex items-center gap-2">
          <div className="flex h-[68px] w-[120px] shrink-0 items-center justify-center rounded border border-dashed border-cms-border text-muted-foreground text-xs">
            Thumb
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(metadata.ai_image_prompt!, 'Image prompt')}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            aria-label={`Copiar Image Prompt da variante ${label}`}
          >
            Copiar Image Prompt
          </button>
        </div>
      )}

      <input
        type="text"
        value={titleText}
        onChange={(e) => onTitleChange(e.target.value)}
        aria-label={`Título da variante ${label}`}
        className="bg-transparent border-b border-cms-border text-sm w-full px-1 py-0.5 focus:border-indigo-500 outline-none"
      />

      {onDescriptionChange && (
        <textarea
          value={descriptionText ?? ''}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={2}
          aria-label={`Descrição da variante ${label}`}
          className="bg-transparent border-b border-cms-border text-sm w-full px-1 py-0.5 focus:border-indigo-500 outline-none resize-none"
        />
      )}

      {synopsisText && (
        <details
          open={detailsOpen}
          onToggle={(e) => setDetailsOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary
            className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors truncate"
            aria-expanded={detailsOpen}
          >
            {synopsis}
          </summary>
          <div className="mt-1 space-y-1 text-xs text-muted-foreground">
            {metadata.composition && <div className="space-x-2">
              {Object.entries(metadata.composition).map(([k, v]) => v ? <span key={k}><strong>{k}:</strong> {v}</span> : null)}
            </div>}
            {metadata.expression && <p><strong>Expression:</strong> {metadata.expression}</p>}
            {metadata.rationale && <p>{metadata.rationale}</p>}
          </div>
        </details>
      )}

      {metadata.palette && metadata.palette.length > 0 && (
        <div className="flex gap-1.5 pt-1">
          {metadata.palette.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.role}
              aria-label={`Copiar cor ${c.hex}`}
              onClick={() => copyToClipboard(c.hex, c.hex)}
              className="h-4 w-4 rounded-full border border-cms-border transition-transform hover:scale-125"
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
