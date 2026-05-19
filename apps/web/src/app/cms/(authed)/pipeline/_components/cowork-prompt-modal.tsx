'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { API_REGISTRY } from '@/lib/pipeline/api-registry'

const SKILLS = [
  { id: 'ideator', label: 'Ideator' },
  { id: 'writer', label: 'Writer' },
  { id: 'producer', label: 'Producer' },
  { id: 'product_eval', label: 'Product Eval' },
  { id: 'perf_review', label: 'Perf Review' },
  { id: 'curator', label: 'Curator' },
  { id: 'architect', label: 'Architect' },
] as const

const DOMAIN_LABELS: Record<string, string> = {
  'items-and-sections': 'Items',
  playlists: 'Playlists',
  libraries: 'Libraries',
  research: 'Research',
  youtube: 'YouTube',
  utilities: 'Utilities',
}

const DOMAINS = API_REGISTRY.capabilities.map((c) => ({
  id: c.domain,
  label: DOMAIN_LABELS[c.domain] ?? c.name,
  fullName: c.name,
  endpoint_count: c.endpoint_count,
}))

interface CoworkPromptModalProps {
  onClose: () => void
  baseUrl: string
}

function PromptPreview({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="max-h-56 overflow-y-auto rounded-lg border border-[#222d40] bg-[#0c1222] p-3 font-mono text-[11px] leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i}>{' '}</div>

        const stepMatch = line.match(/^(\d+\.\s+)(GET|POST|PATCH|PUT|DELETE)(\s+)(.+)$/)
        if (stepMatch) {
          const [, num, method, , url] = stepMatch
          return (
            <div key={i}>
              <span style={{ color: '#5a6b7f' }}>{num}</span>
              <span style={{ color: '#86efac', fontWeight: 700 }}>{method}</span>
              <span>{' '}</span>
              <span style={{ color: '#a5b4fc' }}>{url}</span>
            </div>
          )
        }

        if (line.match(/^\s+#/)) {
          return <div key={i} style={{ color: '#4a5568' }}>{line}</div>
        }

        if (line.startsWith('#')) {
          return <div key={i} style={{ color: '#6b7a8f' }}>{line}</div>
        }

        return <div key={i} style={{ color: '#7a8ba3' }}>{line}</div>
      })}
    </div>
  )
}

export function CoworkPromptModal({ onClose, baseUrl }: CoworkPromptModalProps) {
  const [selectedSkill, setSelectedSkill] = useState<string | null>('ideator')
  const [allSkills, setAllSkills] = useState(false)
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)

  const copyRef = useRef<() => void>(() => {})

  useEffect(() => {
    function handleKeys(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        copyRef.current()
      }
    }
    document.addEventListener('keydown', handleKeys)
    return () => document.removeEventListener('keydown', handleKeys)
  }, [onClose])

  const toggleDomain = useCallback((domain: string) => {
    setSelectedDomains((prev) => {
      const next = new Set(prev)
      if (next.has(domain)) next.delete(domain)
      else next.add(domain)
      return next
    })
  }, [])

  const allDomainsSelected = selectedDomains.size === DOMAINS.length

  const toggleAllDomains = useCallback(() => {
    if (allDomainsSelected) {
      setSelectedDomains(new Set())
    } else {
      setSelectedDomains(new Set(DOMAINS.map((d) => d.id)))
    }
  }, [allDomainsSelected])

  const selectSkill = useCallback((id: string) => {
    setSelectedSkill(id)
    setAllSkills(false)
  }, [])

  const selectAll = useCallback(() => {
    setSelectedSkill(null)
    setAllSkills(true)
  }, [])

  const isMaxContext = allSkills && selectedDomains.size === DOMAINS.length

  const toggleMaxContext = useCallback(() => {
    if (isMaxContext) {
      setSelectedSkill('ideator')
      setAllSkills(false)
      setSelectedDomains(new Set())
    } else {
      setSelectedSkill(null)
      setAllSkills(true)
      setSelectedDomains(new Set(DOMAINS.map((d) => d.id)))
    }
  }, [isMaxContext])

  const stepCount = useMemo(() => {
    let count = 1
    if (allSkills || selectedSkill) count++
    count += selectedDomains.size
    return count
  }, [allSkills, selectedSkill, selectedDomains])

  const prompt = useMemo(() => {
    const lines: string[] = [
      '# Antes de responder, carregue meu contexto:',
      '',
    ]

    let step = 1

    lines.push(`${step}. GET ${baseUrl}/api/pipeline/`)
    lines.push('   # Catálogo completo + directives do sistema')
    lines.push('')
    step++

    if (allSkills) {
      lines.push(`${step}. GET ${baseUrl}/api/pipeline/context?format=md`)
      lines.push('   # Todas as referências (todas as skills)')
    } else if (selectedSkill) {
      const skill = SKILLS.find((s) => s.id === selectedSkill)
      lines.push(`${step}. GET ${baseUrl}/api/pipeline/context?skill=${selectedSkill}&format=md`)
      lines.push(`   # Referências da skill ${skill?.label ?? selectedSkill}`)
    }
    lines.push('')
    step++

    for (const domain of selectedDomains) {
      const cap = API_REGISTRY.capabilities.find((c) => c.domain === domain)
      lines.push(`${step}. GET ${baseUrl}/api/pipeline/docs/${domain}`)
      lines.push(`   # Documentação do domínio ${cap?.name ?? domain}`)
      lines.push('')
      step++
    }

    lines.push(`# Auth: X-Pipeline-Key: [sua key]`)
    lines.push(`# Base: ${baseUrl}`)

    return lines.join('\n')
  }, [selectedSkill, allSkills, selectedDomains, baseUrl])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      toast.success('Prompt copiado!')
      setTimeout(() => onClose(), 600)
    } catch {
      toast.error('Falha ao copiar')
    }
  }, [prompt, onClose])

  copyRef.current = handleCopy

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Gerar Prompt pro Cowork"
        className="w-full max-w-lg rounded-xl border border-[#222d40] bg-[#161d2d] shadow-2xl"
        style={{ animation: 'cowork-modal-in 0.15s ease-out' }}
      >
        {/* Accent line */}
        <div className="h-0.5 rounded-t-xl bg-gradient-to-r from-indigo-500 to-purple-500" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222d40] px-5 py-3.5">
          <h2 className="text-sm font-semibold text-[#edf2f7]">
            Gerar Prompt pro Cowork
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#5a6b7f] transition-colors hover:bg-[#1a2236] hover:text-[#edf2f7]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-5 py-4">
          {/* Skill selector */}
          <div>
            <div className="mb-2 text-xs font-medium text-[#7a8ba3]">Qual skill vai usar?</div>
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((skill) => {
                const isActive = selectedSkill === skill.id && !allSkills
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => selectSkill(skill.id)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                        : 'border-[#222d40] bg-[#1a2236] text-[#7a8ba3] hover:border-[#334155] hover:text-[#edf2f7]'
                    }`}
                  >
                    {skill.label}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={selectAll}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  allSkills
                    ? 'border-emerald-600 bg-emerald-600/15 text-emerald-400'
                    : 'border-[#222d40] bg-[#1a2236] text-[#7a8ba3] hover:border-[#334155] hover:text-[#edf2f7]'
                }`}
              >
                Todas
              </button>
            </div>
          </div>

          {/* Domain docs selector */}
          <div>
            <div className="mb-2 text-xs font-medium text-[#7a8ba3]">
              Incluir docs de domínio? <span className="font-normal text-[#5a6b7f]">(opcional)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DOMAINS.map((domain) => {
                const isActive = selectedDomains.has(domain.id)
                return (
                  <button
                    key={domain.id}
                    type="button"
                    title={domain.fullName}
                    onClick={() => toggleDomain(domain.id)}
                    className={`rounded border px-2.5 py-1 text-[11px] transition-colors ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-500/12 text-indigo-300'
                        : 'border-[#222d40] bg-[#1a2236] text-[#5a6b7f] hover:border-[#334155] hover:text-[#7a8ba3]'
                    }`}
                  >
                    {domain.label}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={toggleAllDomains}
                className={`rounded border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  allDomainsSelected
                    ? 'border-emerald-600 bg-emerald-600/15 text-emerald-400'
                    : 'border-[#222d40] bg-[#1a2236] text-[#5a6b7f] hover:border-[#334155] hover:text-[#7a8ba3]'
                }`}
              >
                Todas
              </button>
            </div>
          </div>

          {/* Prompt preview */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#7a8ba3]">
              <span>Preview do prompt</span>
              <span className="rounded-full bg-[#1a2236] px-2 py-0.5 text-[10px] text-[#5a6b7f]">
                {stepCount} {stepCount === 1 ? 'step' : 'steps'}
              </span>
            </div>
            <PromptPreview text={prompt} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[#222d40] px-5 py-3.5">
          <span className="mr-auto font-mono text-[10px] text-[#3a4a5f]">⌘⏎ copiar</span>
          <button
            type="button"
            onClick={toggleMaxContext}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors ${
              isMaxContext
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                : 'border-[#222d40] text-[#5a6b7f] hover:border-[#334155] hover:text-[#7a8ba3]'
            }`}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 4L6 2l4 2v4l-4 2-4-2z" />
              <path d="M6 6v4" />
              <path d="M2 4l4 2 4-2" />
            </svg>
            Max Context
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs text-[#7a8ba3] transition-colors hover:bg-[#1a2236] hover:text-[#edf2f7]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={copied}
            className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-medium text-white transition-all ${
              copied
                ? 'bg-emerald-600'
                : 'bg-[#6366f1] hover:bg-[#4f46e5]'
            }`}
          >
            {copied ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Copiado!
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                Copiar Prompt
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
