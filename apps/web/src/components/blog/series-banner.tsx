type Props = {
  title: string | undefined
  part?: number
  total?: number
}

export function SeriesBanner({ title, part, total }: Props) {
  if (!title) return null
  return (
    <div className="bg-[--pb-paper] rounded-lg px-5 py-3.5 mb-6">
      <div className="font-jetbrains text-[11px] tracking-[2px] uppercase text-pb-muted mb-1">
        PARTE DA SERIE {part && total ? `· ${part} DE ${total}` : ''}
      </div>
      <div className="text-[15px] text-pb-ink">{title}</div>
    </div>
  )
}
