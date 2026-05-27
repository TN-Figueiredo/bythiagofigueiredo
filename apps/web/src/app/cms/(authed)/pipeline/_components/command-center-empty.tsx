'use client'

import Link from 'next/link'
import { gemMix } from '@/lib/pipeline/gem-design'

interface CommandCenterEmptyProps {
  variant: 'first-run' | 'rest-day' | 'all-done'
  nextActionDay?: string
}

const VARIANTS = {
  'first-run': {
    title: 'Command Center vazio',
    description: 'Configure seus canais do YouTube e cadência do blog para começar.',
    cta: { href: '/cms/settings/youtube', label: 'Configurar YouTube' },
  },
  'rest-day': {
    title: 'Dia de descanso',
    description: 'Nenhum slot programado para hoje. Aproveite!',
    cta: null,
  },
  'all-done': {
    title: 'Tudo pronto!',
    description: 'Nada pendente esta semana. Hora de novas ideias.',
    cta: { href: '/cms/pipeline/items/new', label: 'Nova ideia' },
  },
} as const

export function CommandCenterEmpty({ variant, nextActionDay }: CommandCenterEmptyProps) {
  const config = VARIANTS[variant]

  return (
    <div
      className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-lg border"
      style={{
        background: 'var(--gem-surface)',
        borderColor: 'var(--gem-border)',
      }}
    >
      <h2
        className="text-lg font-semibold mb-2"
        style={{ color: 'var(--gem-text)' }}
      >
        {config.title}
      </h2>
      <p
        className="text-sm mb-4 max-w-xs"
        style={{ color: 'var(--gem-muted)' }}
      >
        {config.description}
        {nextActionDay && variant === 'rest-day' && (
          <> Próximo slot: {nextActionDay}.</>
        )}
      </p>
      {config.cta && (
        <Link
          href={config.cta.href}
          className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
          style={{
            background: gemMix('--gem-accent', 15),
            color: 'var(--gem-accent)',
            border: `1px solid ${gemMix('--gem-accent', 25)}`,
          }}
        >
          {config.cta.label}
        </Link>
      )}
    </div>
  )
}
