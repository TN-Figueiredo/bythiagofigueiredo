'use client'

interface AiBadgeProps {
  source?: string | null
  edited?: boolean
  className?: string
  title?: string
}

function SparkleIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  )
}

export function AiBadge({ source, edited, className, title }: AiBadgeProps) {
  if (!source || !source.startsWith('cowork')) return null

  const isEdited = edited === true
  const colorClasses = isEdited
    ? 'bg-amber-500/15 text-amber-400'
    : 'bg-indigo-500/15 text-indigo-400'
  const tooltip = title ?? (isEdited ? 'Conteúdo gerado por IA e editado manualmente' : 'Conteúdo gerado via Cowork')

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 font-medium ${colorClasses} ${className ?? ''}`}
      title={tooltip}
    >
      {isEdited ? <PencilIcon /> : <SparkleIcon />}
      {isEdited ? 'editado' : 'via Cowork'}
    </span>
  )
}
