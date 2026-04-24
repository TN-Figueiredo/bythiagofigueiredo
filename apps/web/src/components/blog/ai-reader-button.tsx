'use client'

type Props = { onClick: () => void }

export function AiReaderButton({ onClick }: Props) {
  return (
    <button onClick={onClick} className="ai-reader-pill" aria-label="Open AI Reader">
      <span className="text-lg">✨</span>
      <span className="font-jetbrains text-[11px] tracking-wide text-pb-muted">AI Reader</span>
    </button>
  )
}
