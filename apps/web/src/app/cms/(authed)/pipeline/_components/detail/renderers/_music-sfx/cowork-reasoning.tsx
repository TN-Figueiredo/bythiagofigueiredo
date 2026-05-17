interface CoworkReasoningProps {
  text: string
}

export function CoworkReasoning({ text }: CoworkReasoningProps) {
  return (
    <div
      className="text-[10px] italic leading-snug px-2 py-1 rounded"
      style={{ background: 'rgba(16,185,129,0.03)', borderLeft: '2px solid rgba(16,185,129,0.15)', color: '#a3b1bf' }}
    >
      {text}
    </div>
  )
}
