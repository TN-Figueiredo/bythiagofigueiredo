'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import type { OverviewTabData } from '../../_hub/hub-types'

interface Props {
  data: OverviewTabData['deliverability']
}

export function DeliverabilityPanel({ data }: Props) {
  const checks = [
    { label: 'SPF', pass: data.spf },
    { label: 'DKIM', pass: data.dkim },
    { label: 'DMARC', pass: data.dmarc },
  ]

  return (
    <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Deliverability</h3>
      <div className="flex gap-6">
        <div className="space-y-2">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2">
              {c.pass ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
              <span className="text-[11px] text-gray-300">{c.label}</span>
              <span className={`text-[9px] ${c.pass ? 'text-green-400' : 'text-red-400'}`}>{c.pass ? 'Verified' : 'Failed'}</span>
            </div>
          ))}
          <div className="mt-2 inline-flex rounded border border-gray-700 bg-gray-800 px-2 py-0.5 text-[9px] text-gray-400">
            {data.provider}
          </div>
        </div>
        <div className="space-y-2">
          <div>
            <span className="text-[10px] text-gray-400">Bounce Rate</span>
            <div className="mt-1 h-2 w-32 overflow-hidden rounded-full bg-gray-800">
              <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${Math.min(100, (data.bounceRate / 5) * 100)}%` }} />
            </div>
            <span className="text-[9px] tabular-nums text-gray-400">{data.bounceRate.toFixed(1)}% (threshold: 5%)</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400">Complaint Rate</span>
            <div className="mt-1 h-2 w-32 overflow-hidden rounded-full bg-gray-800">
              <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${Math.min(100, (data.complaintRate / 0.1) * 100)}%` }} />
            </div>
            <span className="text-[9px] tabular-nums text-gray-400">{data.complaintRate.toFixed(2)}% (threshold: 0.1%)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
