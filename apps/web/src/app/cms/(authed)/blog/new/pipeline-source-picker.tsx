'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PipelineSearchInput } from '@/app/cms/(authed)/blog/_shared/pipeline-search-input'
import { getFormatIcon } from '@/lib/pipeline/gem-design'
import type { PipelineSearchResult } from '@/app/cms/(authed)/blog/actions'

const PIPELINE_LANG_TO_LOCALE: Record<string, string> = {
  'pt-br': 'pt-BR',
  en: 'en',
}

const LOCALE_FLAGS: Record<string, string> = {
  'pt-BR': '\u{1F1E7}\u{1F1F7}',
  en: '\u{1F1FA}\u{1F1F8}',
}

const LOCALE_NAMES: Record<string, string> = {
  'pt-BR': 'Português',
  en: 'English',
}

interface PipelineSourcePickerProps {
  siteId: string
  supportedLocales: string[]
  defaultLocale: string
  onSearch: (query: string) => Promise<PipelineSearchResult[]>
  onCreate: (
    siteId: string,
    itemId: string,
    locale: string,
  ) => Promise<{ ok: true; postId: string } | { ok: false; error: string }>
}

type Source = 'blank' | 'pipeline'

export function PipelineSourcePicker({
  siteId,
  supportedLocales,
  defaultLocale,
  onSearch,
  onCreate,
}: PipelineSourcePickerProps) {
  const router = useRouter()
  const [source, setSource] = useState<Source>('blank')
  const [selectedItem, setSelectedItem] = useState<PipelineSearchResult | null>(null)
  const [selectedLocale, setSelectedLocale] = useState<string>(defaultLocale)
  const [isCreating, setIsCreating] = useState(false)

  function handleSelectSource(s: Source) {
    setSource(s)
    if (s === 'blank') {
      setSelectedItem(null)
      setSelectedLocale(defaultLocale)
    }
  }

  function handleSelectItem(item: PipelineSearchResult) {
    setSelectedItem(item)
    // Pre-select locale based on pipeline item language
    const suggested = PIPELINE_LANG_TO_LOCALE[item.language.toLowerCase()] ?? defaultLocale
    const validLocale = supportedLocales.includes(suggested) ? suggested : defaultLocale
    setSelectedLocale(validLocale)
  }

  function handleDeselect() {
    setSelectedItem(null)
    setSelectedLocale(defaultLocale)
  }

  async function handleCreate() {
    if (!selectedItem) return
    setIsCreating(true)
    try {
      const result = await onCreate(siteId, selectedItem.id, selectedLocale)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.push(`/cms/blog/${result.postId}/editor`)
    } catch {
      toast.error('Erro ao criar post a partir do pipeline')
    } finally {
      setIsCreating(false)
    }
  }

  const fmtConfig = selectedItem
    ? getFormatIcon(selectedItem.format as Parameters<typeof getFormatIcon>[0])
    : null

  return (
    <div className="mb-8">
      {/* Source selector cards */}
      <div className="flex gap-3 mb-4">
        <button
          type="button"
          onClick={() => handleSelectSource('blank')}
          className={[
            'flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all',
            source === 'blank'
              ? 'border-[#6366f1] bg-[#6366f1]/10 text-[#edf2f7]'
              : 'border-[#222d40] bg-[#0c1222] text-[#7a8ba3] hover:border-[#3a4760] hover:text-[#edf2f7]',
          ].join(' ')}
        >
          <span className="text-base">✏️</span>
          Em branco
        </button>

        <button
          type="button"
          onClick={() => handleSelectSource('pipeline')}
          className={[
            'flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all',
            source === 'pipeline'
              ? 'border-[#6366f1] bg-[#6366f1]/10 text-[#edf2f7]'
              : 'border-[#222d40] bg-[#0c1222] text-[#7a8ba3] hover:border-[#3a4760] hover:text-[#edf2f7]',
          ].join(' ')}
        >
          <span className="text-base">📋</span>
          Do Pipeline
        </button>
      </div>

      {/* Pipeline panel */}
      {source === 'pipeline' && (
        <div className="rounded-xl border border-[#222d40] bg-[#0c1222] p-5 space-y-4">
          {/* Search or selected item */}
          {!selectedItem ? (
            <div>
              <p className="text-xs text-[#7a8ba3] mb-2">
                Busque um item do pipeline para usar como base do post
              </p>
              <PipelineSearchInput
                onSearch={onSearch}
                onSelect={handleSelectItem}
                mode="select"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-[#6366f1]/30 bg-[#6366f1]/5 p-4">
              {/* Item header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  {fmtConfig && (
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded text-sm ${fmtConfig.bgClass}`}
                    >
                      {fmtConfig.icon}
                    </span>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[#6366f1]">{selectedItem.code}</span>
                      <span className="text-[10px] font-mono px-1.5 py-px rounded bg-[#06b6d4]/10 border border-[#06b6d4]/25 text-[#06b6d4]">
                        {selectedItem.stage}
                      </span>
                    </div>
                    <p className="text-sm text-[#edf2f7] mt-0.5 leading-snug">{selectedItem.title}</p>
                    {selectedItem.hook && (
                      <p className="text-xs text-[#5a6b7f] mt-0.5 line-clamp-2">{selectedItem.hook}</p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDeselect}
                  className="shrink-0 text-xs text-[#7a8ba3] hover:text-[#edf2f7] border border-[#222d40] hover:border-[#3a4760] rounded px-2 py-1 transition-colors"
                >
                  ✕ trocar
                </button>
              </div>

              {/* "Será copiado:" list */}
              <div className="rounded-md border border-[#222d40] bg-[#161d2d] px-3 py-2 mb-4">
                <p className="text-[10px] text-[#5a6b7f] uppercase tracking-wider mb-1.5">
                  Será copiado:
                </p>
                <ul className="space-y-0.5">
                  {[
                    { from: 'título', to: 'title' },
                    { from: 'hook', to: 'excerpt' },
                    { from: 'body', to: 'content_mdx' },
                    { from: 'pipeline link', to: 'pipeline link' },
                  ].map((row) => (
                    <li key={row.from} className="flex items-center gap-2 text-xs">
                      <span className="text-[#5a6b7f]">{row.from}</span>
                      <span className="text-[#2a3650]">→</span>
                      <span className="font-mono text-[#7a8ba3]">{row.to}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Locale picker */}
              <div className="mb-4">
                <p className="text-[10px] text-[#5a6b7f] uppercase tracking-wider mb-2">
                  Idioma do post
                </p>
                <div className="flex flex-wrap gap-2">
                  {supportedLocales.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setSelectedLocale(loc)}
                      className={[
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all',
                        selectedLocale === loc
                          ? 'border-[#6366f1] bg-[#6366f1]/10 text-[#edf2f7]'
                          : 'border-[#222d40] bg-[#161d2d] text-[#7a8ba3] hover:border-[#3a4760] hover:text-[#edf2f7]',
                      ].join(' ')}
                    >
                      <span>{LOCALE_FLAGS[loc] ?? loc}</span>
                      <span>{LOCALE_NAMES[loc] ?? loc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6366f1] hover:bg-[#5558e3] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                >
                  {isCreating ? (
                    <>
                      <span className="animate-spin text-xs">⟳</span>
                      Criando...
                    </>
                  ) : (
                    <>Criar post a partir de {selectedItem.code}</>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSource('blank')}
                  disabled={isCreating}
                  className="px-3 py-2 rounded-lg border border-[#222d40] text-[#7a8ba3] hover:text-[#edf2f7] hover:border-[#3a4760] text-sm transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
