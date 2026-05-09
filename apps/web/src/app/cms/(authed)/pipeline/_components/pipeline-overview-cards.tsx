'use client'

import Link from 'next/link'

interface FormatStats {
  format: string
  total: number
  byStage: Record<string, number>
}

const FORMAT_ICONS: Record<string, string> = {
  video: '🎬', blog_post: '✍️', newsletter: '📧', course: '🎓', campaign: '📣',
}
const FORMAT_LABELS: Record<string, string> = {
  video: 'Video', blog_post: 'Blog', newsletter: 'Newsletter', course: 'Course', campaign: 'Campaign',
}

export function PipelineOverviewCards({ stats }: { stats: FormatStats[] }) {
  const totalItems = stats.reduce((sum, s) => sum + s.total, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((s) => (
          <Link
            key={s.format}
            href={`/cms/pipeline/${s.format}`}
            className="block rounded-lg border border-slate-700 bg-slate-800 p-4 hover:border-indigo-500 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{FORMAT_ICONS[s.format]}</span>
              <span className="text-sm font-medium text-slate-200">{FORMAT_LABELS[s.format]}</span>
            </div>
            <p className="text-2xl font-bold text-white">{s.total}</p>
            <p className="text-xs text-slate-400 mt-1">items in pipeline</p>
          </Link>
        ))}
      </div>
      <div className="text-sm text-slate-400">
        Total: {totalItems} items across all formats
      </div>
    </div>
  )
}
