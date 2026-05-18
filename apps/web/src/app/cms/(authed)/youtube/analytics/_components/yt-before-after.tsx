interface BeforeAfterData {
  oldThumbnailUrl: string | null
  newThumbnailUrl: string | null
  oldTitle: string | null
  newTitle: string | null
  ctrBefore: number
  ctrAfter: number
  gradeBefore: string
  gradeAfter: string
  daysSinceApplied: number
  extraClicks: number
}

interface Props {
  data: BeforeAfterData
}

export function YtBeforeAfter({ data }: Props) {
  const ctrLift = data.ctrBefore > 0 ? ((data.ctrAfter - data.ctrBefore) / data.ctrBefore) * 100 : 0

  return (
    <div className="rounded border border-cms-border bg-cms-surface">
      <div className="flex items-center justify-between border-b border-cms-border px-3 py-2">
        <span className="text-xs font-medium text-cms-text">Antes / Depois</span>
        <span className="text-[10px] text-cms-text-muted">
          Há {data.daysSinceApplied} dias desde mudança
        </span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-cms-border">
        {/* Before */}
        <div className="p-3 space-y-2">
          {data.oldThumbnailUrl && (
            <img src={data.oldThumbnailUrl} alt="Thumbnail anterior" className="w-full rounded-sm aspect-video object-cover" />
          )}
          {data.oldTitle && data.oldTitle !== data.newTitle && (
            <p className="text-[10px] text-cms-text-muted line-through">{data.oldTitle}</p>
          )}
          <div className="space-y-0.5 text-[10px]">
            <p className="text-cms-text-muted">CTR: {data.ctrBefore.toFixed(1)}%</p>
            <p className="text-cms-text-muted">Grade: {data.gradeBefore}</p>
          </div>
        </div>
        {/* After */}
        <div className="p-3 space-y-2">
          {data.newThumbnailUrl && (
            <img src={data.newThumbnailUrl} alt="Thumbnail nova" className="w-full rounded-sm aspect-video object-cover" />
          )}
          {data.newTitle && data.oldTitle !== data.newTitle && (
            <p className="text-[10px] text-cms-text">{data.newTitle}</p>
          )}
          <div className="space-y-0.5 text-[10px]">
            <p className="text-[#34d399]">CTR: {data.ctrAfter.toFixed(1)}% ({ctrLift > 0 ? '+' : ''}{ctrLift.toFixed(0)}%)</p>
            <p className="text-cms-text">Grade: {data.gradeAfter}</p>
          </div>
        </div>
      </div>
      {data.extraClicks > 0 && (
        <div className="border-t border-cms-border px-3 py-2">
          <p className="text-[10px] text-[#34d399]">
            Estimativa: +{data.extraClicks.toLocaleString('pt-BR')} cliques extras desde a mudança
          </p>
        </div>
      )}
    </div>
  )
}
