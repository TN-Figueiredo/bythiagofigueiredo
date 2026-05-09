'use client'

import Link from 'next/link'

interface ListItem {
  id: string
  code: string
  title_pt: string | null
  title_en: string | null
  format: string
  stage: string
  priority: number
  updated_at: string
}

export function PipelineListTable({ items }: { items: ListItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 text-left">
            <th className="pb-2 text-slate-400 font-medium">Code</th>
            <th className="pb-2 text-slate-400 font-medium">Title</th>
            <th className="pb-2 text-slate-400 font-medium">Format</th>
            <th className="pb-2 text-slate-400 font-medium">Stage</th>
            <th className="pb-2 text-slate-400 font-medium">Priority</th>
            <th className="pb-2 text-slate-400 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-slate-800 hover:bg-slate-800/50">
              <td className="py-2">
                <Link href={`/cms/pipeline/items/${item.id}`} className="text-indigo-400 hover:underline font-mono text-xs">
                  {item.code}
                </Link>
              </td>
              <td className="py-2 text-slate-200">{item.title_pt || item.title_en || '—'}</td>
              <td className="py-2 text-slate-400">{item.format}</td>
              <td className="py-2"><span className="px-1.5 py-0.5 rounded text-xs bg-slate-700 text-slate-300">{item.stage}</span></td>
              <td className="py-2 text-slate-400">{item.priority}</td>
              <td className="py-2 text-slate-500 text-xs">{new Date(item.updated_at).toLocaleDateString()}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={6} className="py-8 text-center text-slate-500">No items found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
