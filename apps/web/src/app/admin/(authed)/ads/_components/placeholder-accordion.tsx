'use client'

import { useState, useCallback } from 'react'
import { AD_AREAS, getSlotsByArea, type AdSlotDefinition } from '@app/shared'
import { SlotForm } from './slot-form'
import { SlotPreview } from './slot-preview'

interface PlaceholderRow {
  slot_id: string
  is_enabled: boolean
  headline: string | null
  body: string | null
  cta_text: string | null
  cta_url: string | null
  image_url: string | null
  brand_color: string | null
  logo_url: string | null
  dismiss_after_ms: number | null
  updated_at: string | null
}

interface SlotConfigRow {
  slot_key: string
  zone: string
  iab_size: string | null
  mobile_behavior: string
  accepted_types: string[]
  label: string
}

interface PlaceholderAccordionProps {
  placeholders: PlaceholderRow[]
  slotConfigs: SlotConfigRow[]
  onSave: (slotId: string, data: Record<string, unknown>) => Promise<void>
}

const ZONE_COLORS: Record<string, string> = {
  banner: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  rail: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  inline: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  block: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
}

const MOBILE_LABELS: Record<string, string> = {
  keep: 'mobile: mantém',
  hide: 'mobile: oculta',
  stack: 'mobile: empilha',
}

function Badge({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className ?? 'bg-muted text-muted-foreground'}`}>
      {text}
    </span>
  )
}

export function PlaceholderAccordion({ placeholders, slotConfigs, onSave }: PlaceholderAccordionProps) {
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const area of AD_AREAS) {
      if (getSlotsByArea(area.key).length > 0) {
        initial.add(area.key)
      }
    }
    return initial
  })
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(new Set())
  const [previewState, setPreviewState] = useState<Record<string, {
    headline: string
    body: string
    ctaText: string
    ctaUrl: string
    brandColor: string
    logoUrl: string | null
    imageUrl: string | null
  }>>({})

  const placeholderMap = new Map(placeholders.map((p) => [p.slot_id, p]))
  const configMap = new Map(slotConfigs.map((c) => [c.slot_key, c]))

  const toggleArea = useCallback((key: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleSlot = useCallback((key: string) => {
    setExpandedSlots((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  function getPreviewData(slot: AdSlotDefinition) {
    const cached = previewState[slot.key]
    if (cached) return cached
    const ph = placeholderMap.get(slot.key)
    return {
      headline: ph?.headline ?? 'Anuncie aqui',
      body: ph?.body ?? 'Alcance nossos leitores.',
      ctaText: ph?.cta_text ?? 'Saiba mais',
      ctaUrl: ph?.cta_url ?? '/anuncie',
      brandColor: ph?.brand_color ?? '#6B7280',
      logoUrl: ph?.logo_url ?? null,
      imageUrl: ph?.image_url ?? null,
    }
  }

  const areasWithSlots = AD_AREAS.filter((a) => getSlotsByArea(a.key).length > 0)
  const futureAreas = AD_AREAS.filter((a) => getSlotsByArea(a.key).length === 0)

  return (
    <div className="space-y-4">
      {areasWithSlots.map((area) => {
        const slots = getSlotsByArea(area.key)
        const isExpanded = expandedAreas.has(area.key)

        return (
          <div key={area.key} className="overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              role="button"
              aria-expanded={isExpanded}
              onClick={() => toggleArea(area.key)}
              className="flex w-full items-center justify-between bg-muted/50 px-4 py-3 text-left transition-colors hover:bg-muted"
              tabIndex={0}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{area.label}</span>
                <Badge text={`${slots.length} slots`} />
                <Badge text={`${area.key}:*`} className="bg-primary/10 text-primary" />
                <span className="text-xs text-muted-foreground">{area.route}</span>
              </div>
              <svg
                className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div role="region" aria-label={`${area.label} slots`} className="divide-y divide-border">
                {slots.map((slot) => {
                  const ph = placeholderMap.get(slot.key)
                  const cfg = configMap.get(slot.key)
                  const isSlotExpanded = expandedSlots.has(slot.key)
                  const isEnabled = ph?.is_enabled ?? false

                  return (
                    <div key={slot.key}>
                      <button
                        type="button"
                        role="button"
                        aria-expanded={isSlotExpanded}
                        onClick={() => toggleSlot(slot.key)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/30"
                        tabIndex={0}
                      >
                        <span className={`h-2 w-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="min-w-[200px] font-mono text-xs">{slot.key}</span>
                        <Badge text={slot.zone} className={ZONE_COLORS[slot.zone]} />
                        {slot.iabSize && <Badge text={slot.iabSize} />}
                        <Badge
                          text={slot.acceptedAdTypes.join(', ')}
                          className="bg-muted text-muted-foreground"
                        />
                        <Badge
                          text={MOBILE_LABELS[slot.mobileBehavior] ?? slot.mobileBehavior}
                          className={
                            slot.mobileBehavior === 'hide'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : slot.mobileBehavior === 'stack'
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : 'bg-muted text-muted-foreground'
                          }
                        />
                        {ph?.updated_at && (
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {new Date(ph.updated_at).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                        <svg
                          className={`ml-2 h-3 w-3 text-muted-foreground transition-transform ${isSlotExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {isSlotExpanded && (
                        <div className="grid grid-cols-2 gap-6 border-t border-border bg-background px-4 py-4">
                          <SlotForm
                            slotKey={slot.key}
                            initial={{
                              isEnabled: ph?.is_enabled ?? false,
                              headline: ph?.headline ?? '',
                              body: ph?.body ?? '',
                              ctaText: ph?.cta_text ?? '',
                              ctaUrl: ph?.cta_url ?? '',
                              imageUrl: ph?.image_url ?? '',
                              brandColor: ph?.brand_color ?? '#6B7280',
                              logoUrl: ph?.logo_url ?? '',
                              dismissAfterMs: ph?.dismiss_after_ms ?? 0,
                            }}
                            onSave={onSave}
                            onChange={(data) => {
                              setPreviewState((prev) => ({
                                ...prev,
                                [slot.key]: {
                                  headline: data.headline,
                                  body: data.body,
                                  ctaText: data.ctaText,
                                  ctaUrl: data.ctaUrl,
                                  brandColor: data.brandColor,
                                  logoUrl: data.logoUrl || null,
                                  imageUrl: data.imageUrl || null,
                                },
                              }))
                            }}
                          />
                          <SlotPreview
                            slotKey={slot.key}
                            data={getPreviewData(slot)}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {futureAreas.map((area) => (
        <div
          key={area.key}
          className="flex items-center justify-between rounded-lg border-2 border-dashed border-border px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">{area.label}</span>
            <Badge text="0 slots" />
            <span className="text-xs text-muted-foreground">{area.route}</span>
          </div>
          <button
            type="button"
            disabled
            className="cursor-not-allowed text-xs text-muted-foreground/50"
          >
            + Adicionar slot
          </button>
        </div>
      ))}
    </div>
  )
}
