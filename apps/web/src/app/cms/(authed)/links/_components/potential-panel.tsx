'use client'

import { Sparkles } from 'lucide-react'

interface PotentialFeature {
  id: string
  label: string
  desc: string
}

interface PotentialPanelProps {
  features: PotentialFeature[]
}

export function PotentialPanel({ features }: PotentialPanelProps) {
  return (
    <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-400" />
        <span className="text-[13px] font-semibold text-foreground">Potencial</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {features.map((f) => (
          <div key={f.id} className="flex items-start gap-2.5 rounded-lg px-2 py-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
            <div>
              <div className="text-xs font-semibold text-foreground">{f.label}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
