'use client'

import { useState, useTransition } from 'react'
import { Lock, Sliders, Rss, CheckCheck } from 'lucide-react'

export interface LockedStageProps {
  stageLabel: 'Pós' | 'Publicação' | string
  itemId: string
  version: number
  /** Server action: advanceToRecorded(id, version). Reporter → 403 from the action (UX hides only). */
  onUnlock: (id: string, version: number) => Promise<{ ok: boolean; error?: string }>
}

const STAGE_META: Record<string, { Icon: React.ElementType; title: string; sub: string }> = {
  'Pós': {
    Icon: Sliders,
    title: 'A pós entra depois de gravar',
    sub: 'O brief pro editor — b-roll, estilo, CTAs — abre quando o vídeo é gravado. Por enquanto, o roteiro é o foco.',
  },
  'Publicação': {
    Icon: Rss,
    title: 'A publicação abre quando o vídeo estiver pronto',
    sub: 'Os 4 testes A/B (thumbnail + título) entram quando o vídeo é gravado e editado.',
  },
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

  const meta = STAGE_META[stageLabel]
  const StageIcon = meta?.Icon ?? Sliders
  const title = meta?.title ?? `${stageLabel} fica disponível depois da gravação`
  const sub = meta?.sub ?? 'Marque o vídeo como gravado para desbloquear as abas de edição avançada.'

  return (
    <div className="locked-stage fade-in" role="region" aria-label={`${stageLabel} bloqueado até a gravação`}>
      <div className="ls-ico">
        <Lock size={22} />
        <span className="ls-badge">
          <StageIcon size={12} />
        </span>
      </div>
      <h3 className="ls-title">{title}</h3>
      <p className="ls-sub">{sub}</p>
      <button className="btn primary" type="button" onClick={handleUnlock} disabled={pending}>
        {pending ? 'Marcando…' : <><CheckCheck size={15} /> Marcar como gravado</>}
      </button>
      <div className="ls-hint">Libera Pós e Publicação.</div>
      {error && <p className="ls-error" role="alert">{error}</p>}
    </div>
  )
}
