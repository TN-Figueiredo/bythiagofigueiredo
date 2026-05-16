interface CoworkReasoningProps {
  text: string
  variant?: 'default' | 'no-match' | 'local' | 'pending'
}

const VARIANT_STYLES = {
  default: { bg: 'rgba(16,185,129,0.03)', border: 'rgba(16,185,129,0.15)', color: '#a3b1bf' },
  local: { bg: 'rgba(16,185,129,0.03)', border: 'rgba(16,185,129,0.15)', color: '#a3b1bf' },
  pending: { bg: 'rgba(245,158,11,0.03)', border: 'rgba(245,158,11,0.15)', color: '#a3b1bf' },
  'no-match': { bg: 'rgba(192,132,252,0.03)', border: 'rgba(192,132,252,0.15)', color: '#a3b1bf' },
}

export function CoworkReasoning({ text, variant = 'default' }: CoworkReasoningProps) {
  const styles = VARIANT_STYLES[variant]

  return (
    <div
      className="text-[10px] italic leading-snug px-2 py-1 rounded"
      style={{ background: styles.bg, borderLeft: `2px solid ${styles.border}`, color: styles.color }}
    >
      {text}
    </div>
  )
}
