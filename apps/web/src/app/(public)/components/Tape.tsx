type TapeVariant = 'tape' | 'tape2' | 'tapeR'

type Props = {
  variant?: TapeVariant
  className?: string
  rotate?: number
}

export function Tape({ variant = 'tape', className = '', rotate = -8 }: Props) {
  return (
    <div
      aria-hidden="true"
      className={`hidden md:block pb-tape absolute w-14 h-5 opacity-90 ${className}`}
      style={{
        backgroundColor: `var(--pb-${variant})`,
        transform: `rotate(${rotate}deg)`,
        borderRadius: '1px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
      }}
    />
  )
}
