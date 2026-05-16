interface CoworkReasoningProps {
  text: string
  variant?: 'default' | 'no-match'
}

export function CoworkReasoning({ text, variant = 'default' }: CoworkReasoningProps) {
  const bgColor = variant === 'no-match'
    ? 'rgba(192,132,252,0.06)'
    : 'rgba(129,140,248,0.06)'
  const borderColor = variant === 'no-match'
    ? 'rgba(192,132,252,0.2)'
    : 'rgba(129,140,248,0.15)'
  const textColor = variant === 'no-match' ? '#c084fc' : '#a5b4fc'

  return (
    <div
      className="text-[10px] italic leading-snug px-2 py-1.5 rounded"
      style={{ background: bgColor, borderLeft: `2px solid ${borderColor}`, color: textColor }}
    >
      {text}
    </div>
  )
}
