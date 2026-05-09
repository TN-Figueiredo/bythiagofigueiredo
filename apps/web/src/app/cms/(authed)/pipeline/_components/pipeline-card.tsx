'use client'

import Link from 'next/link'

interface PipelineCardProps {
  id: string
  code: string
  title: string
  priority: number
  language: string
  tags: string[]
  checklist: Array<{ label: string; done: boolean }>
  version: number
}

const PRIORITY_COLORS: Record<number, string> = {
  5: 'bg-red-500',
  4: 'bg-orange-500',
  3: 'bg-yellow-500',
  2: 'bg-blue-500',
  1: 'bg-gray-400',
  0: 'bg-transparent',
}

export function PipelineCard({ id, code, title, priority, language, tags, checklist, version }: PipelineCardProps) {
  const doneCount = checklist.filter((c) => c.done).length
  const totalCount = checklist.length
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  return (
    <Link
      href={`/cms/pipeline/items/${id}`}
      className="block rounded-lg border border-slate-700 bg-slate-800 p-3 hover:border-indigo-500 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        {priority > 0 && <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[priority]}`} />}
        <span className="text-xs text-slate-400 font-mono">{code}</span>
        {language === 'both' && <span className="text-xs bg-indigo-900 text-indigo-300 px-1 rounded">PT+EN</span>}
      </div>
      <p className="text-sm text-slate-100 font-medium truncate">{title}</p>
      {tags.length > 0 && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{tag}</span>
          ))}
          {tags.length > 2 && <span className="text-xs text-slate-500">+{tags.length - 2}</span>}
        </div>
      )}
      {totalCount > 0 && (
        <div className="mt-2">
          <div className="h-1 rounded-full bg-slate-700 overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-xs text-slate-500 mt-0.5">{doneCount}/{totalCount}</span>
        </div>
      )}
    </Link>
  )
}
