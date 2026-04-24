type Props = { quote: string | undefined; attribution?: string }

export function PostPullQuote({ quote, attribution }: Props) {
  if (!quote) return null
  return (
    <blockquote className="border-l-[3px] border-pb-accent pl-3.5 my-6">
      <p className="font-caveat text-lg text-pb-accent italic leading-snug mb-1.5">
        &ldquo;{quote}&rdquo;
      </p>
      {attribution && (
        <span className="font-jetbrains text-[10px] text-pb-muted tracking-widest uppercase">
          — {attribution}
        </span>
      )}
    </blockquote>
  )
}
