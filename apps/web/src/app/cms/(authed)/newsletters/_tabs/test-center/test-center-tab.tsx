'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import type { NewsletterHubStrings } from '../../_i18n/types'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'
import { TemplateSelector, TEMPLATE_LABELS, type TemplateName } from './template-selector'
import { EditionControls } from './edition-controls'
import { TestSendCard } from './test-send-card'
import { PageStateLinks } from './page-state-links'
import { renderTestTemplate, sendTestTemplate } from '../../actions-test-center'

interface TestCenterTabProps {
  strings: NewsletterHubStrings
  locale: 'en' | 'pt-BR'
  userEmail: string
  types: Array<{ id: string; name: string; color: string }>
  editions: Array<{ id: string; subject: string; status: string; typeId: string | null }>
}

export function TestCenterTab({ strings, locale, userEmail, types, editions: allEditions }: TestCenterTabProps) {
  const [template, setTemplate] = useState<TemplateName>('confirm')
  const [emailLocale, setEmailLocale] = useState<'pt-BR' | 'en'>(locale)
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [selectedEditionId, setSelectedEditionId] = useState<string | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [sizeBytes, setSizeBytes] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [width, setWidth] = useState<'desktop' | 'mobile'>('desktop')

  const generationRef = useRef(0)
  const tc = strings.testCenter

  const filteredEditions = useMemo(
    () => selectedTypeId ? allEditions.filter((e) => e.typeId === selectedTypeId) : allEditions,
    [allEditions, selectedTypeId],
  )

  const loadPreview = useCallback(async () => {
    const gen = ++generationRef.current
    setLoading(true)
    setError(null)
    try {
      const result = await renderTestTemplate(template, emailLocale, {
        editionId: selectedEditionId ?? undefined,
      })
      if (gen !== generationRef.current) return
      if (result.ok) {
        setHtml(result.html)
        setSizeBytes(result.sizeBytes)
      } else {
        setError(result.error)
        setHtml(null)
        setSizeBytes(null)
      }
    } catch {
      if (gen !== generationRef.current) return
      setError(tc.renderFailed)
      setHtml(null)
      setSizeBytes(null)
    } finally {
      if (gen === generationRef.current) {
        setLoading(false)
      }
    }
  }, [template, emailLocale, selectedEditionId, tc.renderFailed])

  useEffect(() => {
    loadPreview()
  }, [loadPreview])

  const handleSend = useCallback(async () => {
    return sendTestTemplate(template, emailLocale, {
      editionId: selectedEditionId ?? undefined,
    })
  }, [template, emailLocale, selectedEditionId])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <SectionErrorBoundary sectionName="Test center controls">
          <div className="flex flex-col gap-4">
            <TemplateSelector selected={template} onChange={setTemplate} strings={tc} hasEditions={allEditions.length > 0} />

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-2">
                {tc.locale}
              </label>
              <div role="radiogroup" aria-label="Email locale" className="flex gap-1.5">
                {(['pt-BR', 'en'] as const).map((loc) => (
                  <button
                    key={loc}
                    role="radio"
                    aria-checked={emailLocale === loc}
                    onClick={() => setEmailLocale(loc)}
                    className={`flex-1 rounded-md border px-3 py-2 text-xs text-center transition-colors ${
                      emailLocale === loc
                        ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400 font-medium'
                        : 'bg-[#0a0f1a] border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            <EditionControls
              types={types}
              selectedTypeId={selectedTypeId}
              selectedEditionId={selectedEditionId}
              onTypeChange={setSelectedTypeId}
              onEditionChange={setSelectedEditionId}
              editions={filteredEditions}
              strings={tc}
              disabled={template !== 'edition'}
            />

            <TestSendCard
              userEmail={userEmail}
              onSend={handleSend}
              strings={tc}
            />

            <PageStateLinks strings={tc} />
          </div>
        </SectionErrorBoundary>

        <SectionErrorBoundary sectionName="Email preview">
        <div className="rounded-[10px] border border-gray-800 bg-gray-900 overflow-hidden flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {TEMPLATE_LABELS[template]}
                {sizeBytes != null && ` · ${tc.emailSize}: ${(sizeBytes / 1024).toFixed(1)} KB`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div role="radiogroup" aria-label="Preview viewport" className="flex gap-1">
                <button
                  role="radio"
                  aria-checked={width === 'desktop'}
                  onClick={() => setWidth('desktop')}
                  className={`px-2 py-1 text-xs rounded ${width === 'desktop' ? 'bg-indigo-500/15 text-indigo-400 font-medium' : 'text-gray-500'}`}
                >
                  {tc.viewportDesktop}
                </button>
                <button
                  role="radio"
                  aria-checked={width === 'mobile'}
                  onClick={() => setWidth('mobile')}
                  className={`px-2 py-1 text-xs rounded ${width === 'mobile' ? 'bg-indigo-500/15 text-indigo-400 font-medium' : 'text-gray-500'}`}
                >
                  {tc.viewportMobile}
                </button>
              </div>
              <button
                onClick={loadPreview}
                disabled={loading}
                className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                {tc.refresh}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-[#111827] p-4 flex justify-center" role="region" aria-label="Email preview">
            {error && (
              <div className="text-center py-8">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            {loading && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">{tc.renderingPreview}</p>
              </div>
            )}
            {html && !error && !loading && (
              <iframe
                srcDoc={html}
                title="Email preview"
                className="bg-white shadow-md rounded border-0"
                style={{
                  width: width === 'desktop' ? '600px' : '375px',
                  height: '100%',
                  minHeight: '500px',
                  transition: 'width 0.2s ease',
                }}
                sandbox="allow-same-origin"
              />
            )}
          </div>
        </div>
        </SectionErrorBoundary>
      </div>

      <div className="sticky bottom-0 flex items-center border-t border-gray-800 bg-gray-900 px-6 py-2">
        <span className="text-[11px] text-gray-400">{tc.summaryStats}</span>
      </div>
    </div>
  )
}
