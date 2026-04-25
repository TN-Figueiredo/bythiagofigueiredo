'use client'

import { useState, useEffect } from 'react'

type Tab = 'tldr' | 'explain' | 'chat'

type Props = {
  open: boolean
  onClose: () => void
}

export function AiReaderDrawer({ open, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('tldr')

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[94]" role="presentation" onClick={onClose} />
      )}
      <div className={`ai-reader-drawer ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="Leitor IA">
        <div className="p-4 border-b border-[--pb-line] flex items-center justify-between">
          <div className="flex gap-0">
            {(['tldr', 'explain', 'chat'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 font-jetbrains text-xs uppercase tracking-wider border-none cursor-pointer transition-colors rounded ${
                  activeTab === tab
                    ? 'bg-pb-accent/15 text-pb-accent'
                    : 'bg-transparent text-pb-muted hover:text-pb-ink'
                }`}
              >
                {tab === 'tldr' ? 'TL;DR' : tab === 'explain' ? 'Explain' : 'Chat'}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="text-pb-muted hover:text-pb-ink text-lg bg-transparent border-none cursor-pointer"
          >
            ×
          </button>
        </div>
        <div className="p-5">
          {activeTab === 'tldr' && (
            <div className="text-sm text-pb-muted leading-relaxed">
              <p className="font-jetbrains text-[10px] tracking-[2px] uppercase text-pb-faint mb-3">resumo automatico</p>
              <p style={{ fontFamily: 'var(--font-source-serif), Georgia, serif' }}>
                Este texto e um manifesto sobre o proposito do site bythiagofigueiredo. O autor explica que nao e um portfolio, feed ou blog corporativo — e um caderno aberto. Faz tres promessas: escrever mesmo quando for ruim, nunca rodar anuncio, e nao transformar em startup. Apresenta o CMS proprio que permite publicar uma vez e distribuir para multiplos destinos.
              </p>
            </div>
          )}
          {activeTab === 'explain' && (
            <div className="text-sm text-pb-faint text-center py-10">
              <p className="mb-2">Selecione um trecho do artigo para explicar.</p>
              <input
                disabled
                placeholder="Selecione texto primeiro..."
                className="w-full bg-[--pb-bg] border border-[--pb-line] text-pb-faint px-3 py-2 rounded text-sm opacity-50 mt-4"
              />
            </div>
          )}
          {activeTab === 'chat' && (
            <div className="text-sm text-pb-faint text-center py-10">
              <p className="mb-2">Em breve — converse com o artigo.</p>
              <input
                disabled
                placeholder="Desabilitado por agora..."
                className="w-full bg-[--pb-bg] border border-[--pb-line] text-pb-faint px-3 py-2 rounded text-sm opacity-50 mt-4"
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
