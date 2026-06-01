'use client'

import { useState } from 'react'

interface ConflictBannerProps {
  onKeepLocal: () => void
  onAcceptRemote: () => void
  localContent: unknown
  remoteContent: unknown
}

export function ConflictBanner({ onKeepLocal, onAcceptRemote, localContent, remoteContent }: ConflictBannerProps) {
  const [showDiff, setShowDiff] = useState(false)

  const localStr = typeof localContent === 'string' ? localContent : JSON.stringify(localContent, null, 2)
  const remoteStr = typeof remoteContent === 'string' ? remoteContent : JSON.stringify(remoteContent, null, 2)
  const localLines = localStr.split('\n')
  const remoteLines = remoteStr.split('\n')

  return (
    <>
      <div role="alert" className="px-4 py-2 flex items-center justify-between flex-wrap gap-1.5 text-xs" style={{ background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
        <span className="flex items-center gap-1.5" style={{ color: 'var(--gem-warn)' }}>
          ⚠️ Cowork atualizou esta seção. Você tem edições locais não salvas.
        </span>
        <span className="flex gap-1">
          <button onClick={() => setShowDiff(prev => !prev)} className="px-2 py-0.5 text-[10px] rounded" style={{ border: '1px solid var(--gem-border)', color: 'var(--gem-muted)' }}>Ver diff</button>
          <button onClick={onKeepLocal} className="px-2 py-0.5 text-[10px] rounded font-semibold" style={{ background: 'var(--gem-accent)', border: '1px solid var(--gem-accent)', color: 'white' }}>Manter minha versão</button>
          <button onClick={onAcceptRemote} className="px-2 py-0.5 text-[10px] rounded" style={{ border: '1px solid var(--gem-border)', color: 'var(--gem-muted)' }}>Aceitar Cowork</button>
        </span>
      </div>
      {showDiff && (
        <div className="px-4 py-3 max-h-48 overflow-y-auto text-xs font-mono" style={{ background: 'var(--gem-well)', borderBottom: '1px solid var(--gem-border)' }}>
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--gem-dim)' }}>
            <span>Diff: sua versão vs Cowork</span>
            <button onClick={() => setShowDiff(false)} className="px-1.5 text-[10px] rounded" style={{ border: '1px solid var(--gem-border)', color: 'var(--gem-dim)' }}>✕</button>
          </div>
          {localLines.map((line, i) => {
            const remoteLine = remoteLines[i]
            if (line === remoteLine) return <div key={i} className="px-2 py-px" style={{ color: 'var(--gem-dim)' }}>  {line}</div>
            return (
              <div key={i}>
                <div className="px-2 py-px rounded" style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', textDecoration: 'line-through' }}>- {line}</div>
                {remoteLine && <div className="px-2 py-px rounded" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7' }}>+ {remoteLine}</div>}
              </div>
            )
          })}
          {remoteLines.slice(localLines.length).map((line, i) => (
            <div key={`extra-${i}`} className="px-2 py-px rounded" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7' }}>+ {line}</div>
          ))}
        </div>
      )}
    </>
  )
}
