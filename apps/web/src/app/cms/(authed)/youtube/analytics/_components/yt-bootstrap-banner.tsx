interface Props {
  weeksSinceFirstGrade: number
}

export function YtBootstrapBanner({ weeksSinceFirstGrade }: Props) {
  if (weeksSinceFirstGrade >= 2) return null

  const progress = Math.min(100, (weeksSinceFirstGrade / 2) * 100)

  return (
    <div className="rounded border border-[#60a5fa]/30 bg-[#60a5fa]/5 px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="text-sm">i</span>
        <div className="flex-1">
          <p className="text-xs font-medium text-[#60a5fa]">
            Primeira avaliação — tendências disponíveis após 2 semanas de coleta.
          </p>
          <p className="mt-1 text-[10px] text-cms-text-muted">
            Os scores atuais são baseados em métricas cumulativas. Grades se tornarão mais precisos com o tempo.
          </p>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-cms-border">
            <div
              className="h-full rounded-full bg-[#60a5fa] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-[9px] text-cms-text-dim">
            {weeksSinceFirstGrade === 0 ? 'Dia 0 — coletando dados...' : 'Semana 1 — mais 1 semana para tendências'}
          </p>
        </div>
      </div>
    </div>
  )
}
