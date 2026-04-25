'use client'

type Props = { onClick: () => void; hidden?: boolean }

function SparkIcon({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 L13.5 9 L19.5 10.5 L13.5 12 L12 18 L10.5 12 L4.5 10.5 L10.5 9 Z" fill={color} />
      <path d="M18 15 L18.75 17.25 L21 18 L18.75 18.75 L18 21 L17.25 18.75 L15 18 L17.25 17.25 Z" fill={color} opacity={0.7} />
    </svg>
  )
}

export { SparkIcon }

export function AiReaderButton({ onClick, hidden }: Props) {
  if (hidden) return null
  return (
    <button
      onClick={onClick}
      className="fixed right-6 bottom-6 z-[90] flex items-center gap-2.5 px-[18px] py-3 pl-3.5 bg-pb-accent border-none rounded-full cursor-pointer"
      style={{
        color: 'var(--pb-paper)',
        fontFamily: '"Inter", var(--font-sans), sans-serif',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.01em',
        boxShadow: '0 10px 30px rgba(199,112,46,0.35), 0 2px 6px rgba(0,0,0,0.15)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      aria-label="Abrir leitor IA"
    >
      <SparkIcon />
      <span className="flex flex-col items-start" style={{ lineHeight: 1.1 }}>
        <span>Ler com IA</span>
        <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.85, letterSpacing: '0.02em' }}>
          Resumo, explicacao, conversa
        </span>
      </span>
    </button>
  )
}
