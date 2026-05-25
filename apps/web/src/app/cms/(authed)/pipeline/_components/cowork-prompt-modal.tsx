'use client'

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react'
import { toast } from 'sonner'
import { API_REGISTRY, DOMAIN_LABELS } from '@/lib/pipeline/api-registry'
import { pipelinePaths } from '@/lib/pipeline/api-paths'
import { COWORK_SKILLS } from '@/lib/pipeline/reference-groups'
import type { CoworkSkillId } from '@/lib/pipeline/reference-groups'
import { useFocusTrap } from '@/lib/hooks/use-focus-trap'


const DOMAINS = API_REGISTRY.capabilities.map((c) => ({
  id: c.domain,
  label: DOMAIN_LABELS[c.domain] ?? c.name,
  fullName: c.name,
  endpoint_count: c.endpoint_count,
}))

const CPW_VARS = {
  '--cpw-border': '#222d40',
  '--cpw-text-muted': '#7a8ba3',
  '--cpw-hover-bg': '#1a2236',
  '--cpw-text': '#edf2f7',
  '--cpw-border-inactive': '#334155',
  '--cpw-bg': '#161d2d',
  '--cpw-bg-code': '#0c1222',
  '--cpw-accent': '#6366f1',
  '--cpw-accent-hover': '#4f46e5',
  '--cpw-code-url': '#a5b4fc',
  '--cpw-code-method': '#86efac',
  '--cpw-code-comment': '#8a9ab3',
  '--cpw-code-dim': '#6b7a8f',
} as Record<string, string>

interface CoworkPromptModalProps {
  onClose: () => void
  baseUrl: string
}

const PromptPreview = memo(function PromptPreview({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="max-h-56 overflow-y-auto rounded-lg border border-[var(--cpw-border)] bg-[var(--cpw-bg-code)] p-3 font-mono text-[11px] leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i}>{' '}</div>

        const stepMatch = line.match(/^(\d+\.\s+)(GET|POST|PATCH|PUT|DELETE)(\s+)(.+)$/)
        if (stepMatch) {
          const [, num, method, , url] = stepMatch
          return (
            <div key={i}>
              <span style={{ color: 'var(--cpw-text-muted)' }}>{num}</span>
              <span style={{ color: 'var(--cpw-code-method)', fontWeight: 700 }}>{method}</span>
              <span>{' '}</span>
              <span style={{ color: 'var(--cpw-code-url)' }}>{url}</span>
            </div>
          )
        }

        if (line.match(/^\s+#/)) {
          return <div key={i} style={{ color: 'var(--cpw-code-comment)' }}>{line}</div>
        }

        if (line.startsWith('#')) {
          return <div key={i} style={{ color: 'var(--cpw-code-dim)' }}>{line}</div>
        }

        return <div key={i} style={{ color: 'var(--cpw-text-muted)' }}>{line}</div>
      })}
    </div>
  )
})

export function CoworkPromptModal({ onClose, baseUrl }: CoworkPromptModalProps) {
  const [selectedSkill, setSelectedSkill] = useState<CoworkSkillId | null>('ideator')
  const [allSkills, setAllSkills] = useState(false)
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const [pipelineKey, setPipelineKey] = useState('')
  const [showKey, setShowKey] = useState(false)

  const copyRef = useRef<() => void>(() => {})
  const dialogRef = useRef<HTMLDivElement>(null)
  const skillRadioGroupRef = useRef<HTMLDivElement>(null)
  const handleTrapKeyDown = useFocusTrap(dialogRef)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cowork-pipeline-key')
      if (saved) setPipelineKey(saved)
    } catch { /* SSR/test */ }
  }, [])

  useEffect(() => {
    try {
      if (pipelineKey) {
        localStorage.setItem('cowork-pipeline-key', pipelineKey)
      } else {
        localStorage.removeItem('cowork-pipeline-key')
      }
    } catch { /* SSR/test */ }
  }, [pipelineKey])

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

  const selectSkill = useCallback((id: CoworkSkillId) => {
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
      '# Você é um assistente de produção de conteúdo. Antes de responder, carregue meu contexto:',
      pipelineKey
        ? `# Auth: X-Pipeline-Key: ${pipelineKey}`
        : `# Auth: X-Pipeline-Key: [sua key]  ← PREENCHA COM SUA KEY`,
      '# Inclua o header X-Pipeline-Key em TODAS as requisições.',
      '',
    ]

    let step = 1

    lines.push(`${step}. GET ${baseUrl}${pipelinePaths.catalog()}`)
    lines.push('   # Catálogo completo + directives do sistema')
    lines.push('')
    step++

    if (allSkills) {
      lines.push(`${step}. GET ${baseUrl}${pipelinePaths.context.all()}`)
      lines.push('   # Todas as referências (todas as skills)')
    } else if (selectedSkill) {
      const skill = COWORK_SKILLS.find((s) => s.id === selectedSkill)
      lines.push(`${step}. GET ${baseUrl}${pipelinePaths.context.withSkill(selectedSkill)}`)
      lines.push(`   # Referências da skill ${skill?.label ?? selectedSkill}`)
    }
    lines.push('')
    step++

    for (const domain of selectedDomains) {
      const cap = API_REGISTRY.capabilities.find((c) => c.domain === domain)
      lines.push(`${step}. GET ${baseUrl}${pipelinePaths.docs.domain(domain)}`)
      lines.push(`   # Documentação do domínio ${cap?.name ?? domain}`)
      lines.push('')
      step++
    }

    lines.push('Após carregar, confirme prontidão e liste as capabilities disponíveis.')
    lines.push('Se qualquer GET retornar erro, reporte o status e NÃO prossiga.')
    lines.push(`# Base: ${baseUrl}`)

    return lines.join('\n')
  }, [selectedSkill, allSkills, selectedDomains, baseUrl, pipelineKey])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      if (!pipelineKey) {
        toast.success('Prompt copiado! ⚠️ Lembre de preencher a Pipeline Key no prompt.')
      } else {
        toast.success('Prompt copiado!')
      }
      setTimeout(() => onClose(), 600)
    } catch {
      toast.error('Falha ao copiar')
    }
  }, [prompt, onClose, pipelineKey])

  copyRef.current = handleCopy

  const handleSkillRadioKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const isArrow = e.key === 'ArrowDown' || e.key === 'ArrowRight' ||
                    e.key === 'ArrowUp' || e.key === 'ArrowLeft'
    if (!isArrow) return

    e.preventDefault()
    const group = skillRadioGroupRef.current
    if (!group) return

    const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'))
    if (radios.length === 0) return

    const currentIndex = radios.findIndex((r) => r === document.activeElement)
    let nextIndex: number

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      nextIndex = currentIndex < radios.length - 1 ? currentIndex + 1 : 0
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : radios.length - 1
    }

    const nextRadio = radios[nextIndex]
    if (!nextRadio) return
    nextRadio.focus()
    nextRadio.click()
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Gerar Prompt pro Cowork"
        className="w-full max-w-lg rounded-xl border border-[var(--cpw-border)] bg-[var(--cpw-bg)] shadow-2xl motion-reduce:!animate-none"
        style={{ animation: 'cowork-modal-in 0.15s ease-out', ...CPW_VARS }}
        onKeyDown={handleTrapKeyDown}
      >
        {/* Accent line */}
        <div className="h-0.5 rounded-t-xl bg-gradient-to-r from-indigo-500 to-purple-500" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--cpw-border)] px-5 py-3.5">
          <h2 className="text-sm font-semibold text-[var(--cpw-text)]">
            Gerar Prompt pro Cowork
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded p-1 text-[var(--cpw-text-muted)] transition-colors motion-reduce:transition-none hover:bg-[var(--cpw-hover-bg)] hover:text-[var(--cpw-text)]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-5 py-4">
          {/* Pipeline Key input */}
          <div>
            <div className="mb-2 text-xs font-medium text-[var(--cpw-text-muted)]">
              Pipeline Key
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={pipelineKey}
                onChange={(e) => setPipelineKey(e.target.value)}
                placeholder="Cole sua X-Pipeline-Key aqui..."
                aria-label="Pipeline API Key"
                className="w-full rounded-md border border-[var(--cpw-border)] bg-[var(--cpw-bg-code)] px-3 py-2 pr-16 text-xs text-[var(--cpw-text)] placeholder:text-[var(--cpw-text-muted)] focus:border-[var(--cpw-accent)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[10px] text-[var(--cpw-text-muted)] hover:text-[var(--cpw-text)] transition-colors"
                aria-label={showKey ? 'Ocultar key' : 'Mostrar key'}
              >
                {showKey ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <div className="mt-1 text-[10px] text-[var(--cpw-text-muted)]">
              Encontre em .env.local → PIPELINE_COWORK_KEY
            </div>
            <div className="mt-0.5 text-[10px] text-amber-500/80">
              ⚠ O prompt gerado conterá sua key. Compartilhe apenas com sessões de IA confiáveis.
            </div>
          </div>

          {/* Skill selector */}
          <div
            ref={skillRadioGroupRef}
            role="radiogroup"
            aria-label="Skill do Cowork"
            onKeyDown={handleSkillRadioKeyDown}
          >
            <div className="mb-2 text-xs font-medium text-[var(--cpw-text-muted)]">Qual skill vai usar?</div>
            <div className="flex flex-wrap gap-2">
              {COWORK_SKILLS.map((skill) => {
                const isActive = selectedSkill === skill.id && !allSkills
                return (
                  <button
                    key={skill.id}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => selectSkill(skill.id)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors motion-reduce:transition-none ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                        : 'border-[var(--cpw-border)] bg-[var(--cpw-hover-bg)] text-[var(--cpw-text-muted)] hover:border-[var(--cpw-border-inactive)] hover:text-[var(--cpw-text)]'
                    }`}
                  >
                    {skill.label}
                  </button>
                )
              })}
              <button
                type="button"
                role="radio"
                aria-checked={allSkills}
                tabIndex={allSkills ? 0 : -1}
                onClick={selectAll}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors motion-reduce:transition-none ${
                  allSkills
                    ? 'border-emerald-600 bg-emerald-600/15 text-emerald-400'
                    : 'border-[var(--cpw-border)] bg-[var(--cpw-hover-bg)] text-[var(--cpw-text-muted)] hover:border-[var(--cpw-border-inactive)] hover:text-[var(--cpw-text)]'
                }`}
              >
                Todas
              </button>
            </div>
          </div>

          {/* Domain docs selector */}
          <div role="group" aria-label="Docs de domínio">
            <div className="mb-2 text-xs font-medium text-[var(--cpw-text-muted)]">
              Incluir docs de domínio? <span className="font-normal text-[var(--cpw-text-muted)]">(opcional)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DOMAINS.map((domain) => {
                const isActive = selectedDomains.has(domain.id)
                return (
                  <button
                    key={domain.id}
                    type="button"
                    aria-pressed={isActive}
                    aria-label={domain.fullName}
                    onClick={() => toggleDomain(domain.id)}
                    className={`rounded border px-2.5 py-1 text-[11px] transition-colors motion-reduce:transition-none ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-500/12 text-indigo-300'
                        : 'border-[var(--cpw-border)] bg-[var(--cpw-hover-bg)] text-[var(--cpw-text-muted)] hover:border-[var(--cpw-border-inactive)] hover:text-[var(--cpw-text-muted)]'
                    }`}
                  >
                    {domain.label}
                  </button>
                )
              })}
              <button
                type="button"
                aria-pressed={allDomainsSelected}
                onClick={toggleAllDomains}
                className={`rounded border px-2.5 py-1 text-[11px] font-medium transition-colors motion-reduce:transition-none ${
                  allDomainsSelected
                    ? 'border-emerald-600 bg-emerald-600/15 text-emerald-400'
                    : 'border-[var(--cpw-border)] bg-[var(--cpw-hover-bg)] text-[var(--cpw-text-muted)] hover:border-[var(--cpw-border-inactive)] hover:text-[var(--cpw-text-muted)]'
                }`}
              >
                Todas
              </button>
            </div>
          </div>

          {/* Prompt preview */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--cpw-text-muted)]">
              <span>Preview do prompt</span>
              <span aria-live="polite" className="rounded-full bg-[var(--cpw-hover-bg)] px-2 py-0.5 text-[10px] text-[var(--cpw-text-muted)]">
                {stepCount} {stepCount === 1 ? 'step' : 'steps'}
              </span>
            </div>
            <PromptPreview text={prompt} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--cpw-border)] px-5 py-3.5">
          <span className="mr-auto font-mono text-[10px] text-[var(--cpw-text-muted)]">⌘⏎ copiar</span>
          <button
            type="button"
            onClick={toggleMaxContext}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors motion-reduce:transition-none ${
              isMaxContext
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                : 'border-[var(--cpw-border)] text-[var(--cpw-text-muted)] hover:border-[var(--cpw-border-inactive)] hover:text-[var(--cpw-text-muted)]'
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
            className="rounded-md px-3 py-1.5 text-xs text-[var(--cpw-text-muted)] transition-colors motion-reduce:transition-none hover:bg-[var(--cpw-hover-bg)] hover:text-[var(--cpw-text)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={copied}
            className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-medium text-white transition-all motion-reduce:transition-none ${
              copied
                ? 'bg-emerald-600'
                : 'bg-[var(--cpw-accent)] hover:bg-[var(--cpw-accent-hover)]'
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
