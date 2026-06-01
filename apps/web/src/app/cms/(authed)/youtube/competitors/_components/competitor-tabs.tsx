'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const TABS = [
  { key: 'canais', label: 'Canais' },
  { key: 'mudancas', label: 'Mudanças' },
  { key: 'outliers', label: 'Outliers' },
  { key: 'insights', label: 'Insights' },
] as const

export type CompetitorTab = (typeof TABS)[number]['key']

export function CompetitorTabs({ activeTab }: { activeTab: CompetitorTab }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function setTab(tab: CompetitorTab) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push(`/cms/youtube/competitors?${params.toString()}`)
  }

  return (
    <nav className="flex gap-1 border-b border-cms-border mb-6" aria-label="Competitor sections">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setTab(tab.key)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            tab.key === activeTab
              ? 'border-b-2 border-cms-accent text-cms-accent'
              : 'text-cms-text-muted hover:text-cms-text'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
