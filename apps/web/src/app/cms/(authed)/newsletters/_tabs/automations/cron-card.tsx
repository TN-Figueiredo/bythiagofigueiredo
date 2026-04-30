'use client'

import { Shield } from 'lucide-react'
import type { CronJobData } from '../../_hub/hub-types'

interface CronCardProps {
  cron: CronJobData
}

export function CronCard({ cron }: CronCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-gray-200">{cron.name}</span>
          {cron.lgpd && <Shield className="h-3 w-3 text-blue-400" aria-label="LGPD compliance cron" />}
        </div>
        <div className="mt-0.5 text-[9px] text-gray-500">{cron.frequency} · <code className="text-gray-600">{cron.expression}</code></div>
      </div>
      <div className="flex gap-1">
        {cron.lastRuns.slice(0, 5).map((r, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full ${r.success ? 'bg-green-500' : 'bg-red-500'}`}
            title={`${r.date}: ${r.success ? 'OK' : 'Failed'}`}
          />
        ))}
        {cron.lastRuns.length === 0 && <span className="text-[9px] text-gray-600">No runs</span>}
      </div>
    </div>
  )
}
