type Props = { points: string[] | undefined }

export function PostKeyPoints({ points }: Props) {
  if (!points || points.length === 0) return null
  return (
    <div>
      <div className="blog-sidebar-label">Pontos-chave</div>
      {points.map((point, i) => (
        <div key={i} className="flex gap-2.5 items-start mb-3">
          <span className="font-jetbrains text-xs font-bold text-pb-accent min-w-5">
            {String(i + 1).padStart(2, '0')}
          </span>
          <span className="text-[13px] text-pb-ink leading-snug">{point}</span>
        </div>
      ))}
    </div>
  )
}
