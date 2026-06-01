'use client'

import { useState } from 'react'
import { Sparkles, Info, ExternalLink, Image, BarChart3, FlaskConical, Lightbulb, Check, Loader2 } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface StepIdeiasProps {
  hypothesis: string
  onHypothesisChange: (text: string) => void
  onCoworkClick?: () => Promise<void>
}

/* ------------------------------------------------------------------ */
/*  Pill badge data                                                    */
/* ------------------------------------------------------------------ */

const COWORK_RECEIVES = [
  { icon: Image,        label: 'Video + thumbnail' },
  { icon: BarChart3,    label: 'Métricas' },
  { icon: FlaskConical, label: '11 testes anteriores' },
  { icon: Lightbulb,    label: 'Hipótese' },
] as const

/* ------------------------------------------------------------------ */
/*  StepIdeias                                                         */
/* ------------------------------------------------------------------ */

export function StepIdeias({ hypothesis, onHypothesisChange, onCoworkClick }: StepIdeiasProps) {
  const [coworkState, setCoworkState] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle')
  const [coworkError, setCoworkError] = useState<string | null>(null)

  async function handleCoworkClick() {
    if (!onCoworkClick || coworkState === 'loading') return
    setCoworkState('loading')
    setCoworkError(null)
    try {
      await onCoworkClick()
      setCoworkState('copied')
      setTimeout(() => setCoworkState('idle'), 3000)
    } catch (err) {
      setCoworkError((err as Error).message ?? 'Erro ao gerar briefing')
      setCoworkState('error')
      setTimeout(() => setCoworkState('idle'), 4000)
    }
  }

  return (
    <div className="space-y-[20px]">
      {/* --- 1. Cowork banner --- */}
      <div
        className="flex items-start gap-[14px] p-[18px]"
        style={{
          background: 'var(--accent-soft, rgba(255,130,64,0.08))',
          borderRadius: 12,
        }}
      >
        <Sparkles
          size={20}
          className="shrink-0 mt-[1px]"
          style={{ color: 'var(--cms-accent)' }}
          aria-hidden="true"
        />
        <div>
          <p className="text-[14.5px] font-semibold text-cms-text m-0 leading-snug">
            Brainstorm com o Cowork
          </p>
          <p className="text-[12.5px] text-cms-text-dim m-0 mt-[4px] leading-relaxed">
            O Cowork analisa o vídeo, métricas e testes passados para sugerir variantes. Conecte via MCP no Claude Desktop.
          </p>
        </div>
      </div>

      {/* --- 2. Hypothesis textarea --- */}
      <div>
        <div className="flex items-baseline gap-[8px] mb-[6px]">
          <span className="text-[10.5px] font-semibold text-cms-text-dim uppercase tracking-[0.06em]">
            Sua hipótese
          </span>
          <span className="text-[10.5px] text-cms-text-dim">
            · opcional
          </span>
        </div>
        <p className="text-[12px] text-cms-text-dim m-0 mb-[10px] leading-relaxed">
          Descreva o que você acha que pode melhorar o CTR. O Cowork usa essa hipótese como ponto de partida.
        </p>
        <textarea
          value={hypothesis}
          onChange={e => onHypothesisChange(e.target.value)}
          placeholder="Ex: Acho que thumbnails com close no rosto performam melhor que paisagem..."
          rows={3}
          aria-label="Sua hipótese"
          className="w-full text-[13.5px] text-cms-text placeholder:text-cms-text-dim leading-relaxed resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-cms-accent"
          style={{
            background: 'var(--surface-2, var(--cms-surface-hover))',
            border: '1px solid var(--line-strong, var(--cms-border))',
            borderRadius: 10,
            padding: '12px 14px',
          }}
        />
      </div>

      {/* --- 3. "O Cowork recebe" info box --- */}
      <div
        style={{
          background: 'var(--surface-2, var(--cms-surface-hover))',
          border: '1px solid var(--cms-border, #332D25)',
          borderRadius: 12,
          padding: '18px',
        }}
      >
        <p className="text-[10.5px] font-semibold text-cms-text-dim uppercase tracking-[0.06em] m-0 mb-[12px]">
          O Cowork recebe
        </p>

        {/* Pill badges */}
        <div className="flex flex-wrap gap-[8px] mb-[16px]">
          {COWORK_RECEIVES.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-[6px] text-[12px] font-medium text-cms-text"
              style={{
                background: 'var(--cms-surface, #1A1510)',
                border: '1px solid var(--cms-border, #332D25)',
                borderRadius: 8,
                padding: '6px 12px',
              }}
            >
              <Icon size={14} className="text-cms-text-dim shrink-0" aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>

        {/* "Abrir no Cowork" button */}
        <button
          type="button"
          disabled={!onCoworkClick || coworkState === 'loading'}
          onClick={handleCoworkClick}
          className="inline-flex items-center gap-[8px] text-[13px] font-semibold transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            color: coworkState === 'copied' ? 'var(--cms-green, #4ade80)' : coworkState === 'error' ? 'var(--cms-red, #f87171)' : 'var(--cms-cowork, #9B93F6)',
            background: 'var(--cms-cowork-subtle, rgba(110,99,242,.15))',
            border: '1px solid color-mix(in srgb, var(--cms-cowork, #9B93F6) 30%, transparent)',
            borderRadius: 9,
            padding: '9px 16px',
          }}
        >
          {coworkState === 'loading' ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : coworkState === 'copied' ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <ExternalLink size={14} aria-hidden="true" />
          )}
          {coworkState === 'loading'
            ? 'Gerando briefing...'
            : coworkState === 'copied'
              ? 'Copiado!'
              : coworkState === 'error'
                ? (coworkError ?? 'Erro')
                : 'Copiar briefing Cowork'}
        </button>
      </div>

      {/* --- 4. Info hint --- */}
      <div className="flex items-start gap-[10px]">
        <Info
          size={16}
          className="shrink-0 mt-[1px] text-cms-text-dim"
          aria-hidden="true"
        />
        <p className="text-[12.5px] text-cms-text-dim m-0 leading-relaxed">
          Sem ideia agora? Pule esta etapa e crie as variantes manualmente no próximo passo.
        </p>
      </div>
    </div>
  )
}
