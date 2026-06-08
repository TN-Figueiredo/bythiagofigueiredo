'use client'

import { useState, useTransition } from 'react'

export interface LockedStageProps {
  stageLabel: string
  itemId: string
  version: number
  /** Server action: advanceToRecorded(id, version). Reporter → 403 from the action (UX hides only). */
  onUnlock: (id: string, version: number) => Promise<{ ok: boolean; error?: string }>
}

/**
 * Clickable locked stage (§5.5): Pós/Publicação below `gravacao` render this with per-stage copy
 * and a "Marcar como gravado" CTA that calls advanceToRecorded, unlocking both stages.
 */
export function LockedStage({ stageLabel, itemId, version, onUnlock }: LockedStageProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleUnlock() {
    setError(null)
    startTransition(async () => {
      const res = await onUnlock(itemId, version)
      if (!res.ok) setError(res.error ?? 'Falha ao marcar como gravado')
    })
  }

  return (
    <section className="locked-stage" role="region" aria-label={`${stageLabel} bloqueado até a gravação`} aria-disabled>
      <h2 className="ls-title">{stageLabel} fica disponível depois da gravação</h2>
      <p className="ls-copy">Marque o vídeo como gravado para desbloquear as abas de edição avançada.</p>
      <button type="button" className="ls-cta" onClick={handleUnlock} disabled={pending}>
        {pending ? 'Marcando…' : 'Marcar como gravado'}
      </button>
      {error && <p className="ls-error" role="alert">{error}</p>}
    </section>
  )
}
