'use client'

interface FreshnessDotProps {
  lastUpdated: string | null
  label: string
}

export function FreshnessDot({ lastUpdated, label }: FreshnessDotProps) {
  if (!lastUpdated) return null
  const elapsed = Date.now() - new Date(lastUpdated).getTime()
  const minutes = Math.floor(elapsed / 60_000)
  const hours = Math.floor(elapsed / 3_600_000)

  const color = minutes < 5 ? 'bg-green-400' : hours < 24 ? 'bg-amber-400' : 'bg-zinc-500'
  const text = minutes < 60
    ? `${minutes} min atrás`
    : hours < 48
      ? `${hours}h atrás`
      : `${Math.floor(hours / 24)}d atrás`

  return (
    <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}: {text}
    </span>
  )
}
