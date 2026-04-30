'use client'

import { Shield } from 'lucide-react'
import type { AudienceTabData } from '../../_hub/hub-types'

interface LgpdConsentPanelProps {
  consent: AudienceTabData['lgpdConsent']
  totalSubscribers: number
}

export function LgpdConsentPanel({ consent, totalSubscribers }: LgpdConsentPanelProps) {
  const consentRate = totalSubscribers > 0 ? (consent.newsletter / totalSubscribers) * 100 : 0

  return (
    <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Shield className="h-3.5 w-3.5 text-blue-400" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">LGPD Consent</h3>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400">Newsletter consent</span>
          <span className="text-[10px] tabular-nums text-gray-300">{consent.newsletter}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400">Analytics consent</span>
          <span className="text-[10px] tabular-nums text-gray-300">{consent.analytics}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400">Anonymized</span>
          <span className="text-[10px] tabular-nums text-gray-300">{consent.anonymized}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-800">
          <div className="h-full rounded-full bg-blue-500" style={{ width: `${consentRate}%` }} />
        </div>
        <span className="text-[9px] text-gray-600">{consentRate.toFixed(0)}% consent rate</span>
      </div>
    </div>
  )
}
