interface EmptySectionProps {
  sectionLabel: string
  onRequestCowork: () => void
}

export function EmptySection({ sectionLabel, onRequestCowork }: EmptySectionProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="text-3xl mb-2.5 opacity-30">📝</div>
      <div className="text-sm font-medium mb-1" style={{ color: 'var(--gem-muted)' }}>
        {sectionLabel} ainda não tem conteúdo
      </div>
      <div className="text-[11px] mb-4 max-w-xs" style={{ color: 'var(--gem-dim)' }}>
        Use o Cowork para gerar o conteúdo inicial ou comece a editar manualmente.
      </div>
      <button
        onClick={onRequestCowork}
        className="px-3 py-1.5 text-[11px] rounded font-medium transition-colors"
        style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}
      >
        🤖 Gerar com Cowork
      </button>
    </div>
  )
}
