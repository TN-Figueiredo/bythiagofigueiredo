type Props = {
  variant?: 'tape' | 'tape2' | 'tapeR'
  className?: string
  rotate?: number
}

export function Tape({ className = '' }: Props) {
  return <div aria-hidden="true" className={className} />
}
