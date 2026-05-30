'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { DestId } from '@/lib/social/destinations'
import { DESTINATIONS } from '@/lib/social/destinations'

type FlowStep = 'post' | 'short_link' | 'prepare' | 'deliver'

interface DeliveryResult {
  id: string
  provider: string
  status: 'published' | 'failed' | 'pending'
  error?: string
}

interface PublishFlowProps {
  postId: string
  activeDests: DestId[]
  onClose: () => void
}

const STEPS: { id: FlowStep; label: string }[] = [
  { id: 'post', label: 'Criar post' },
  { id: 'short_link', label: 'Short link' },
  { id: 'prepare', label: 'Preparar destinos' },
  { id: 'deliver', label: 'Entregar' },
]

export function PublishFlow({ postId, activeDests, onClose }: PublishFlowProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [deliveries, setDeliveries] = useState<DeliveryResult[]>([])

  // Simulate step progression (in production, this would use Supabase Realtime)
  useEffect(() => {
    if (!postId) return
    const timers = [
      setTimeout(() => setCurrentStep(1), 800),
      setTimeout(() => setCurrentStep(2), 1600),
      setTimeout(() => {
        setCurrentStep(3)
        setDeliveries(
          activeDests.map(destId => ({
            id: `del-${destId}`,
            provider: DESTINATIONS[destId].provider,
            status: 'published' as const,
          }))
        )
      }, 2800),
    ]
    return () => timers.forEach(clearTimeout)
  }, [postId, activeDests])

  const allDone = deliveries.length > 0 && deliveries.every(d =>
    d.status === 'published' || d.status === 'failed'
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-2xl bg-cms-surface p-6 shadow-2xl" role="dialog" aria-modal="true" aria-label="Publicando post">
        {/* Steps progress */}
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex-1">
              <div
                className={`h-1 rounded-full transition-all duration-500 ${
                  i <= currentStep ? 'bg-green-500' : 'bg-cms-border'
                }`}
                style={{ transitionDelay: `${i * 200}ms` }}
              />
              <p className={`mt-1 text-xs ${
                i <= currentStep ? 'text-cms-text' : 'text-cms-text-dim'
              }`}>{step.label}</p>
            </div>
          ))}
        </div>

        {/* Loading state */}
        {!allDone && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cms-border border-t-green-500" />
            <p className="text-sm text-cms-text-muted">
              {STEPS[currentStep]?.label ?? 'Processando'}...
            </p>
          </div>
        )}

        {/* Results per destination */}
        {allDone && (
          <div className="space-y-3 animate-[ab-fade-up_300ms_ease-out]">
            {deliveries.map(del => {
              const dest = activeDests.find(id => DESTINATIONS[id].provider === del.provider)
              const destConfig = dest ? DESTINATIONS[dest] : null

              return (
                <div key={del.id} className="flex items-center gap-3 rounded-lg border border-cms-border bg-cms-bg p-3">
                  {destConfig && (
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ backgroundColor: destConfig.tint }}
                    >
                      {destConfig.sublabel.slice(0, 2)}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-cms-text">{destConfig?.label ?? del.provider} {destConfig?.sublabel ?? ''}</p>
                  </div>
                  {del.status === 'published' ? (
                    <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">No ar</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">Erro</span>
                      {del.error && <span className="text-xs text-cms-text-dim">{del.error}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-cms-border px-4 py-2 text-sm text-cms-text hover:bg-cms-bg transition-colors"
          >
            Fechar
          </button>
          {allDone && (
            <button
              type="button"
              onClick={() => { onClose(); router.push('/cms/social?tab=feed') }}
              className="rounded-lg bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover transition-colors"
            >
              Ver no feed
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
