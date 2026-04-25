type Props = {
  title: string | undefined
  part?: number
  total?: number
}

export function SeriesBanner({ title, part, total }: Props) {
  if (!title) return null
  return (
    <div
      className="px-4 py-3 mb-6"
      style={{
        background: 'var(--pb-paper2)',
        borderLeft: '3px solid var(--pb-accent)',
      }}
    >
      <div
        className="uppercase"
        style={{
          fontFamily: 'var(--font-jetbrains), monospace',
          fontSize: 10,
          letterSpacing: '0.14em',
          color: '#958a75',
        }}
      >
        PARTE DA SERIE {part && total ? `· ${part} DE ${total}` : ''}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-fraunces), serif',
          fontSize: 17,
          fontWeight: 500,
          color: '#efe6d2',
          lineHeight: 1.4,
        }}
      >
        {title}
      </div>
    </div>
  )
}
