type FootnoteData = {
  id: string
  content: string
}

type Props = {
  footnotes: FootnoteData[]
}

export function PostFootnotes({ footnotes }: Props) {
  if (footnotes.length === 0) return null
  return (
    <div className="my-8">
      <div className="blog-sidebar-label">NOTAS</div>
      {footnotes.map((fn) => (
        <div key={fn.id} className="flex gap-2.5 mb-3.5 text-sm text-pb-ink leading-relaxed">
          <span className="font-jetbrains text-xs font-bold text-pb-accent min-w-5 shrink-0 pt-0.5">
            {fn.id}.
          </span>
          <span>
            {fn.content}{' '}
            <a href={`#fnref-${fn.id}`} className="text-pb-accent no-underline text-[13px]">
              ↩
            </a>
          </span>
        </div>
      ))}
    </div>
  )
}
