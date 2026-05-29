'use client'

export function CharCount({ current, max, id }: { current: number; max: number; id?: string }) {
  return (
    <span id={id} className={`text-[10px] ${current > max ? 'text-red-400' : 'text-muted-foreground'}`}>
      {current}/{max}
    </span>
  )
}

export function LangBadge({ lang }: { lang: 'PT' | 'EN' }) {
  const colors = lang === 'PT' ? 'bg-green-500/10 text-green-400' : 'bg-cyan-500/10 text-cyan-400'
  return <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${colors}`}>{lang}</span>
}
