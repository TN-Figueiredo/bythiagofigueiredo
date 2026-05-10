'use client'

import Link from 'next/link'
import { getFormatColor, getPlaylistColor } from '@/lib/pipeline/colors'

interface MemberItem {
  position: number
  role: string | null
  content_pipeline: {
    id: string
    code: string
    title_pt: string | null
    title_en: string | null
    format: string
    stage: string
    priority: number
    tags: string[]
    language: string
  } | null
}

interface CollectionData {
  id: string
  code: string
  name: string | null
  title_pt: string | null
  title_en: string | null
  type: string
  parent_id: string | null
  metadata: Record<string, unknown>
}

const ROLE_LABELS: Record<string, string> = {
  'arc-1': 'Arco 1 — Fundação',
  'arc-2': 'Arco 2 — Império',
  'arc-3': 'Arco 3 — Mercado',
  'text': 'Artigos',
  'idea-bank': 'Banco de Ideias',
}

function groupByRole(members: MemberItem[]): Array<{ role: string | null; label: string; items: MemberItem[] }> {
  const groups: Record<string, MemberItem[]> = {}

  for (const m of members) {
    const key = m.role || 'video'
    if (!groups[key]) groups[key] = []
    groups[key].push(m)
  }

  const order = ['video', 'arc-1', 'arc-2', 'arc-3', 'text', 'idea-bank']
  return order
    .filter((k) => groups[k] !== undefined)
    .map((k) => ({
      role: k === 'video' ? null : k,
      label: k === 'video' ? 'Vídeos' : ROLE_LABELS[k] || k,
      items: groups[k]!,
    }))
}

export function CollectionDetail({ collection, members }: { collection: CollectionData; members: MemberItem[] }) {
  const validMembers = members.filter((m) => m.content_pipeline)
  const groups = groupByRole(validMembers)
  const playlistColors = getPlaylistColor(collection.code)

  const totalVideos = validMembers.filter((m) => !m.role || m.role.startsWith('arc')).length
  const totalText = validMembers.filter((m) => m.role === 'text' || m.role === 'idea-bank').length

  return (
    <div className="space-y-6">
      <div
        className="flex items-center gap-3 px-3 py-2 rounded-lg"
        style={{ backgroundColor: playlistColors.bg, borderLeft: `3px solid ${playlistColors.accent}` }}
      >
        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: playlistColors.border, color: playlistColors.text }}>
          {collection.type}
        </span>
        <span className="text-xs font-mono" style={{ color: playlistColors.text, opacity: 0.7 }}>{collection.code}</span>
      </div>

      <div className="flex gap-4 text-sm text-slate-400">
        <span>{totalVideos} vídeos</span>
        {totalText > 0 && <span>{totalText} textos</span>}
        <span className="text-slate-600">|</span>
        <span>{validMembers.length} total</span>
      </div>

      {groups.map((group) => (
        <div key={group.label} className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 border-b border-slate-800 pb-1">
            {group.label}
            <span className="ml-2 text-slate-600">{group.items.length}</span>
          </h3>
          {group.items.map((m) => {
            const item = m.content_pipeline!
            const colors = getFormatColor(item.format)
            return (
              <Link
                key={item.id}
                href={`/cms/pipeline/items/${item.id}`}
                className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 p-3 hover:border-indigo-500 transition-colors"
              >
                <div
                  className="w-1 h-8 rounded-full flex-shrink-0"
                  style={{ backgroundColor: colors.accent }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono text-slate-500">{item.code}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: colors.bg, color: colors.text }}
                    >
                      {item.format.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                      {item.stage}
                    </span>
                    {item.language !== 'pt-br' && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-indigo-900/50 text-indigo-300">
                        {item.language === 'both' ? 'PT+EN' : 'EN'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-200 truncate">{item.title_pt || item.title_en || 'Untitled'}</p>
                </div>
                {item.priority > 0 && (
                  <span className="text-xs text-amber-400">P{item.priority}</span>
                )}
              </Link>
            )
          })}
        </div>
      ))}
      {validMembers.length === 0 && (
        <p className="text-slate-500 text-sm">No items in this collection</p>
      )}
    </div>
  )
}
