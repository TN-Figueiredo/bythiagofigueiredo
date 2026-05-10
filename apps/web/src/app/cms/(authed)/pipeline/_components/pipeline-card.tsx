'use client'

import Link from 'next/link'
import { getPlaylistColor } from '@/lib/pipeline/colors'

interface PipelineCardProps {
  id: string
  code: string
  title: string
  priority: number
  language: string
  tags: string[]
  checklist: Array<{ label: string; done: boolean }>
  version: number
  collectionCode: string | null
  collectionName: string | null
  membershipRole: string | null
}

const PRIORITY_COLORS: Record<number, string> = {
  5: 'bg-red-500',
  4: 'bg-orange-500',
  3: 'bg-yellow-500',
  2: 'bg-blue-500',
  1: 'bg-gray-400',
  0: 'bg-transparent',
}

const ROLE_LABELS: Record<string, string> = {
  'text': 'artigo',
  'idea-bank': 'idea-bank',
  'arc-1': 'arco 1',
  'arc-2': 'arco 2',
  'arc-3': 'arco 3',
}

export function PipelineCard({
  id, code, title, priority, language, tags, checklist, version,
  collectionCode, collectionName, membershipRole,
}: PipelineCardProps) {
  const doneCount = checklist.filter((c) => c.done).length
  const totalCount = checklist.length
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const collectionColors = collectionCode ? getPlaylistColor(collectionCode) : null
  const letter = collectionCode?.replace('playlist-', '').toUpperCase() ?? ''
  const roleLabel = membershipRole ? ROLE_LABELS[membershipRole] ?? membershipRole : null

  return (
    <Link
      href={`/cms/pipeline/items/${id}`}
      className="block rounded-lg border p-3 transition-colors hover:brightness-110"
      style={{
        borderColor: collectionColors?.border ?? '#334155',
        backgroundColor: collectionColors ? `${collectionColors.bg}` : '#1e293b',
        borderLeftWidth: '3px',
        borderLeftColor: collectionColors?.accent ?? '#334155',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        {priority > 0 && <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[priority]}`} />}
        <span className="text-xs text-slate-400 font-mono">{code}</span>
        {language === 'both' && <span className="text-xs bg-indigo-900 text-indigo-300 px-1 rounded">PT+EN</span>}
      </div>
      <p className="text-sm text-slate-100 font-medium truncate">{title}</p>
      {collectionCode && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: collectionColors?.border, color: collectionColors?.text }}
          >
            {letter}
          </span>
          {roleLabel && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">
              {roleLabel}
            </span>
          )}
          {tags.length > 2 && <span className="text-xs text-slate-500">+{tags.length - 2}</span>}
        </div>
      )}
      {!collectionCode && tags.length > 0 && (
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
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progressPct}%`,
                backgroundColor: collectionColors?.accent ?? '#6366f1',
              }}
            />
          </div>
          <span className="text-xs text-slate-500 mt-0.5">{doneCount}/{totalCount}</span>
        </div>
      )}
    </Link>
  )
}
