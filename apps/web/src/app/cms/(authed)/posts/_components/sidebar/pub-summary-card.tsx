'use client'

import type { SocialConfig } from '@/lib/social/types'

interface PubSummaryCardProps {
  scheduledAt: string | null
  socialConfig: SocialConfig | null
  includeInNewsletter: boolean
  status: string
}

export function PubSummaryCard({ scheduledAt, socialConfig, includeInNewsletter, status }: PubSummaryCardProps) {
  const platformCount = socialConfig?.enabled ? socialConfig.platforms.length : 0
  const isPublished = status === 'published'

  return (
    <div
      className="rounded-lg border p-3"
      style={{ background: 'var(--gem-surface, #0d1118)', borderColor: 'var(--gem-border, #1a2030)' }}
    >
      <h3 className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--gem-dim, #3d4654)' }}>
        Publicação
      </h3>
      <div className="space-y-1.5">
        <SummaryRow label="Agendamento" value={scheduledAt ? new Date(scheduledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Não definido'} ok={!!scheduledAt} />
        <SummaryRow label="Social" value={platformCount > 0 ? `${platformCount} plataforma${platformCount > 1 ? 's' : ''}` : 'Não configurado'} ok={platformCount > 0} />
        <SummaryRow label="Newsletter" value={includeInNewsletter ? 'Incluído' : 'Não incluído'} ok={includeInNewsletter} />
        <SummaryRow label="Status" value={isPublished ? 'Publicado' : 'Rascunho'} ok={isPublished} />
      </div>
    </div>
  )
}

function SummaryRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-[10px]">
      <span style={{ color: 'var(--gem-dim, #3d4654)' }}>{label}</span>
      <span className="flex items-center gap-1">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: ok ? 'var(--gem-done, #22c55e)' : 'var(--gem-dim, #3d4654)' }}
        />
        <span style={{ color: ok ? 'var(--gem-muted, #8b949e)' : 'var(--gem-dim, #3d4654)' }}>{value}</span>
      </span>
    </div>
  )
}
