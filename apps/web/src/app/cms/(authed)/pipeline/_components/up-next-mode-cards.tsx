'use client'

import Link from 'next/link'
import { Pencil, Video, Sparkles, type LucideIcon } from 'lucide-react'
import { getFormatIcon } from '@/lib/pipeline/gem-design'

export interface ModeCardItem {
  id: string
  code: string
  title_pt: string | null
  format: string
  stage: string
  priority: number
  playlistName: string | null
  playlistProgress: string | null
}

interface UpNextModeCardsProps {
  escrever: ModeCardItem | null
  gravar: ModeCardItem | null
  posProducao: ModeCardItem | null
}

interface ModeConfig {
  label: string
  Icon: LucideIcon
  accentColor: string
  actionLabel: string
  gapMessage: string
}

const STAGE_LABELS: Record<string, string> = {
  idea: 'ideia',
  outline: 'outline',
  draft: 'rascunho',
  roteiro: 'roteiro',
  gravacao: 'gravação',
  edicao: 'edição',
  pos_producao: 'pós-produção',
  review: 'revisão',
  approved: 'aprovado',
  ready: 'pronto',
}

const MODE_CONFIGS = {
  escrever: {
    label: 'Escrever',
    Icon: Pencil,
    accentColor: 'var(--gem-accent)',
    actionLabel: 'Continuar',
    gapMessage: 'Nenhum conteúdo em escrita. Hora de começar uma nova ideia.',
  },
  gravar: {
    label: 'Gravar',
    Icon: Video,
    accentColor: 'var(--gem-sky)',
    actionLabel: 'Ver roteiro',
    gapMessage: 'Nenhum roteiro pronto para gravar. Considere finalizar um dos rascunhos.',
  },
  posProducao: {
    label: 'Pós-Produção',
    Icon: Sparkles,
    accentColor: 'var(--gem-done)',
    actionLabel: 'Revisar',
    gapMessage: 'Nenhuma gravação pendente de edição. Hora de gravar algo novo.',
  },
} as const satisfies Record<string, ModeConfig>

function ModeCard({
  item,
  config,
}: {
  item: ModeCardItem | null
  config: ModeConfig
}) {
  const formatInfo = item ? getFormatIcon(item.format) : null
  const IconComponent = config.Icon

  return (
    <div
      className="flex flex-col rounded-lg border p-4 transition-all duration-150 hover:scale-[1.02]"
      style={{
        background: 'var(--gem-surface)',
        borderColor: item ? config.accentColor : 'var(--gem-border)',
        borderWidth: item ? '1.5px' : '1px',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: config.accentColor }}>
          <IconComponent size={18} />
        </span>
        <span
          className="text-sm font-semibold"
          style={{ color: 'var(--gem-text)' }}
        >
          {config.label}
        </span>
      </div>

      {item ? (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base leading-none">{formatInfo?.icon}</span>
            <span
              className="text-xs font-medium line-clamp-2"
              style={{ color: 'var(--gem-text)' }}
            >
              {item.title_pt || item.code}
            </span>
          </div>

          {item.playlistName && (
            <p
              className="text-[11px] mb-1.5"
              style={{ color: 'var(--gem-muted)' }}
            >
              {item.playlistName}
              {item.playlistProgress ? ` ${item.playlistProgress}` : ''}
            </p>
          )}

          <div className="mb-3">
            <span
              className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{
                background: `color-mix(in srgb, ${config.accentColor} 15%, transparent)`,
                color: config.accentColor,
              }}
            >
              {STAGE_LABELS[item.stage] ?? item.stage}
            </span>
          </div>

          <div className="mt-auto">
            <Link
              href={`/cms/pipeline/items/${item.id}`}
              className="inline-flex items-center justify-center w-full rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: `color-mix(in srgb, ${config.accentColor} 15%, transparent)`,
                color: config.accentColor,
                border: `1px solid color-mix(in srgb, ${config.accentColor} 25%, transparent)`,
              }}
            >
              {config.actionLabel}
            </Link>
          </div>
        </>
      ) : (
        <p
          className="text-[11px] leading-relaxed mt-1"
          style={{ color: 'var(--gem-dim)' }}
        >
          {config.gapMessage}
        </p>
      )}
    </div>
  )
}

export function UpNextModeCards({ escrever, gravar, posProducao }: UpNextModeCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <ModeCard item={escrever} config={MODE_CONFIGS.escrever} />
      <ModeCard item={gravar} config={MODE_CONFIGS.gravar} />
      <ModeCard item={posProducao} config={MODE_CONFIGS.posProducao} />
    </div>
  )
}
