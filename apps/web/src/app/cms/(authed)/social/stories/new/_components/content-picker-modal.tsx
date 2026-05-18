'use client'

import { useState, useCallback, useTransition } from 'react'
import { Search, FileText, Mail, Megaphone, X } from 'lucide-react'
import type { SourceContentResult } from '@/lib/social/actions/stories'

type ContentTab = 'blog' | 'newsletter' | 'campaign'

interface ContentPickerModalProps {
  siteId: string
  onSelect: (item: SourceContentResult) => void
  onClose: () => void
  onSearch: (siteId: string, type: string, search: string) => Promise<{ ok: boolean; data?: SourceContentResult[]; error?: string }>
}

const TABS: Array<{ id: ContentTab; label: string; icon: React.ReactNode }> = [
  { id: 'blog', label: 'Blog', icon: <FileText className="h-4 w-4" /> },
  { id: 'newsletter', label: 'Newsletter', icon: <Mail className="h-4 w-4" /> },
  { id: 'campaign', label: 'Campanha', icon: <Megaphone className="h-4 w-4" /> },
]

export function ContentPickerModal({
  siteId,
  onSelect,
  onClose,
  onSearch,
}: ContentPickerModalProps) {
  const [activeTab, setActiveTab] = useState<ContentTab>('blog')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SourceContentResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSearch = useCallback(
    (tab: ContentTab, q: string) => {
      startTransition(async () => {
        setError(null)
        const res = await onSearch(siteId, tab, q)
        setHasSearched(true)
        if (res.ok) {
          setResults(res.data ?? [])
        } else {
          setError(res.error ?? 'Erro ao buscar conteúdo')
          setResults([])
        }
      })
    },
    [siteId, onSearch],
  )

  const handleTabChange = (tab: ContentTab) => {
    setActiveTab(tab)
    setHasSearched(false)
    setResults([])
    setError(null)
    if (query.length >= 2) {
      handleSearch(tab, query)
    }
  }

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    if (q.length >= 2) {
      handleSearch(activeTab, q)
    } else {
      setResults([])
      setHasSearched(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Escolher conteúdo do CMS"
    >
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <h2 className="text-base font-semibold text-neutral-100">Escolher conteúdo</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800 px-5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-neutral-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              value={query}
              onChange={handleQueryChange}
              placeholder={`Buscar ${TABS.find(t => t.id === activeTab)?.label.toLowerCase()}...`}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-5">
          {isPending && (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
          )}

          {!isPending && error && (
            <p className="text-sm text-red-400 text-center py-4">{error}</p>
          )}

          {!isPending && !error && hasSearched && results.length === 0 && (
            <p className="text-sm text-neutral-500 text-center py-4">
              Nenhum resultado encontrado.
            </p>
          )}

          {!isPending && !error && !hasSearched && (
            <p className="text-sm text-neutral-500 text-center py-4">
              Digite ao menos 2 caracteres para buscar.
            </p>
          )}

          {!isPending && results.length > 0 && (
            <ul className="space-y-2">
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    className="w-full text-left px-4 py-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-500 transition-colors"
                  >
                    <p className="text-sm font-medium text-neutral-100 line-clamp-2">{item.title}</p>
                    <p className="text-xs text-neutral-500 mt-1 truncate">{item.url}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
