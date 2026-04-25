'use client'

import { useState, useEffect } from 'react'
import { SparkIcon } from './ai-reader-button'

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
        <div
          className="fixed inset-0 z-[94]"
          role="presentation"
          onClick={onClose}
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
        />
      )}
      <div className={`ai-reader-drawer ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="Leitura assistida">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-[--pb-line] flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: 'var(--pb-accent)', color: 'var(--pb-paper)' }}
              >
                <SparkIcon size={16} color="var(--pb-paper)" />
              </div>
              <span className="font-jetbrains text-[10px] tracking-[0.16em] uppercase text-pb-muted font-semibold">
                Leitura assistida
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="text-pb-muted hover:text-pb-ink text-lg bg-transparent border-none cursor-pointer p-1 -mt-0.5"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[--pb-line] px-4" style={{ background: 'var(--pb-paper2)' }}>
          {(['tldr', 'explain', 'chat'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="bg-transparent border-none cursor-pointer transition-colors"
              style={{
                padding: '12px 16px',
                borderBottom: `2px solid ${activeTab === tab ? 'var(--pb-accent)' : 'transparent'}`,
                color: activeTab === tab ? 'var(--pb-ink)' : 'var(--pb-muted)',
                fontFamily: '"Inter", var(--font-sans), sans-serif',
                fontSize: 13,
                fontWeight: activeTab === tab ? 600 : 500,
                letterSpacing: '0.01em',
                marginBottom: -1,
              }}
            >
              {tab === 'tldr' ? 'TL;DR' : tab === 'explain' ? 'Explicar' : 'Conversar'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'tldr' && <TldrTab />}
          {activeTab === 'explain' && <ExplainTab />}
          {activeTab === 'chat' && <ChatTab />}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-2.5 border-t border-[--pb-line] font-jetbrains text-[10px] tracking-[0.04em] text-pb-muted"
          style={{ background: 'var(--pb-paper2)', textWrap: 'balance' }}
        >
          Respostas geradas por IA. Pode errar — o original e o que vale.
        </div>
      </div>
    </>
  )
}

function TldrTab() {
  return (
    <div>
      <div className="text-sm text-pb-muted mb-4 leading-relaxed">
        Gerar um resumo em tres paragrafos deste texto:
      </div>
      <button
        className="inline-flex items-center gap-2 px-[18px] py-2.5 bg-pb-accent border-none rounded-full cursor-pointer"
        style={{
          color: 'var(--pb-paper)',
          fontFamily: '"Inter", var(--font-sans), sans-serif',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <SparkIcon size={14} color="var(--pb-paper)" />
        Gerar resumo
      </button>
    </div>
  )
}

function ExplainTab() {
  const [level, setLevel] = useState(1)
  const levels = ['ELI5', 'Iniciante', 'Intermediario']

  return (
    <div>
      <div className="text-sm text-pb-muted mb-3.5 leading-relaxed">
        Explicar em linguagem mais simples. Quer com qual nivel de profundidade?
      </div>
      <div className="flex gap-1.5 p-1 rounded-full w-fit mb-4" style={{ background: 'var(--pb-paper2)' }}>
        {levels.map((lbl, i) => (
          <button
            key={lbl}
            onClick={() => setLevel(i)}
            className="border-none rounded-full cursor-pointer transition-all"
            style={{
              padding: '6px 14px',
              background: level === i ? 'var(--pb-ink)' : 'transparent',
              color: level === i ? 'var(--pb-paper)' : 'var(--pb-muted)',
              fontFamily: '"Inter", var(--font-sans), sans-serif',
              fontSize: 12,
              fontWeight: level === i ? 600 : 500,
            }}
          >
            {lbl}
          </button>
        ))}
      </div>
      <button
        className="inline-flex items-center gap-2 px-[18px] py-2.5 bg-pb-accent border-none rounded-full cursor-pointer"
        style={{
          color: 'var(--pb-paper)',
          fontFamily: '"Inter", var(--font-sans), sans-serif',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <SparkIcon size={14} color="var(--pb-paper)" />
        Explicar
      </button>
    </div>
  )
}

function ChatTab() {
  const suggestions = [
    'Qual e a ideia principal?',
    'Por que ele escolheu construir o proprio CMS?',
    'Explica a promessa 3',
  ]

  return (
    <div>
      <div className="text-sm text-pb-muted mb-4 leading-relaxed">
        Faca uma pergunta sobre o texto. Eu respondo com base so no que esta escrito aqui.
      </div>
      <div className="font-jetbrains text-[10px] tracking-[0.12em] uppercase text-pb-muted mb-2.5 font-semibold">
        Sugestoes
      </div>
      {suggestions.map((s) => (
        <button
          key={s}
          className="block w-full text-left mb-2 border rounded-[10px] cursor-pointer transition-all"
          style={{
            padding: '12px 14px',
            background: 'var(--pb-paper2)',
            borderColor: 'var(--pb-line)',
            fontFamily: 'var(--font-source-serif), Georgia, serif',
            fontSize: 14,
            color: 'var(--pb-ink)',
          }}
        >
          {s}
        </button>
      ))}
    </div>
  )
}
