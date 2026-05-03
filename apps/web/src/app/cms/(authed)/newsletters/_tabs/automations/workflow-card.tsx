'use client'

import { ToggleLeft, ToggleRight } from 'lucide-react'
import type { WorkflowData } from '../../_hub/hub-types'
import type { NewsletterHubStrings } from '../../_i18n/types'

interface WorkflowCardProps {
  workflow: WorkflowData
  onToggle?: (id: string, enabled: boolean) => void
  strings?: NewsletterHubStrings
}

export function WorkflowCard({ workflow, onToggle, strings }: WorkflowCardProps) {
  const s = strings?.automations
  return (
    <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[11px] font-semibold text-gray-200">{workflow.name}</h4>
          <span className={`text-[9px] ${workflow.enabled ? 'text-green-400' : 'text-gray-500'}`}>
            {workflow.enabled ? (s?.active ?? 'Active') : (s?.disabled ?? 'Disabled')}
          </span>
        </div>
        <button
          onClick={() => onToggle?.(workflow.id, !workflow.enabled)}
          className="text-gray-400 hover:text-gray-200"
          aria-label={workflow.enabled ? 'Disable workflow' : 'Enable workflow'}
        >
          {workflow.enabled ? <ToggleRight className="h-5 w-5 text-green-400" /> : <ToggleLeft className="h-5 w-5" />}
        </button>
      </div>
      <div className="mt-3 flex gap-4">
        {Object.entries(workflow.stats).map(([key, val]) => (
          <div key={key}>
            <span className="text-[9px] text-gray-500 capitalize">{key}</span>
            <div className="text-sm font-bold tabular-nums text-gray-200">{val}</div>
          </div>
        ))}
      </div>
      {workflow.pipelineCounts && (
        <div className="mt-2 flex gap-2">
          {Object.entries(workflow.pipelineCounts).map(([key, val]) => (
            <span key={key} className="rounded bg-gray-800 px-1.5 py-0.5 text-[8px] text-gray-400">
              {key}: {val}
            </span>
          ))}
        </div>
      )}
      {workflow.incident && (
        <div className="mt-2 rounded border border-amber-500/20 bg-amber-950/10 px-2 py-1 text-[9px] text-amber-400">
          {workflow.incident.description}
        </div>
      )}
    </div>
  )
}
