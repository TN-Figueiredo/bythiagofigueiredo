'use client'
import { Trash2, Lock, Move, Circle } from 'lucide-react'
import type { CardElement } from '@tn-figueiredo/links/qr'
import { labelStyle, actionBtnStyle, sectionDivider, sectionLabel, hintStyle } from './inspector-styles'

const alignBtnStyle: React.CSSProperties = {
  padding: '6px 0', borderRadius: 7,
  border: '1px solid var(--line-strong)', background: 'var(--surface-2)',
  color: 'var(--ink-dim)', fontSize: 9, fontWeight: 500,
  cursor: 'pointer', textAlign: 'center',
}

/* ── Props ── */

interface MultiInspectorProps {
  elements: CardElement[]
  onUpdateAll: (patch: Partial<CardElement>) => void
  onDeleteAll: () => void
  onLockAll: () => void
  onAlign: (alignment: string) => void
}

/* ── Component ── */

export function MultiInspector({ elements, onUpdateAll, onDeleteAll, onLockAll, onAlign }: MultiInspectorProps) {
  const opacities = elements.map(e => e.opacity)
  const allSame = opacities.every(o => o === opacities[0])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: -2 }}>
        <span style={{
          fontSize: 10, fontWeight: 600,
          padding: '2px 8px', borderRadius: 99,
          background: 'var(--accent-soft)', color: 'var(--accent)',
        }}>
          {elements.length}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          elementos selecionados
        </span>
      </div>

      {/* ── Alinhamento ── */}
      <div>
        <div style={sectionLabel}>Alinhamento</div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4,
        }}>
          {[
            { key: 'left', label: 'Esq' },
            { key: 'center-h', label: 'Centro' },
            { key: 'right', label: 'Dir' },
            { key: 'top', label: 'Topo' },
            { key: 'middle', label: 'Meio' },
            { key: 'bottom', label: 'Base' },
            { key: 'distribute-h', label: 'Dist H' },
            { key: 'distribute-v', label: 'Dist V' },
          ].map(a => (
            <button
              key={a.key}
              type="button"
              onClick={() => onAlign(a.key)}
              style={alignBtnStyle}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Propriedades ── */}
      <div style={sectionDivider}>
        <div style={sectionLabel}>Propriedades</div>

        {/* ── Opacidade ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Circle size={13} strokeWidth={1.7} style={{ color: 'var(--ink-dim)' }} />
              <span style={labelStyle}>Opacidade</span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--ink)' }}>
              {allSame ? `${Math.round((opacities[0] ?? 1) * 100)}%` : 'Misto'}
            </span>
          </div>
          <input
            type="range" min={10} max={100}
            value={allSame ? Math.round((opacities[0] ?? 1) * 100) : 50}
            onChange={e => onUpdateAll({ opacity: Number(e.target.value) / 100 })}
            aria-label="Opacidade"
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* ── Acoes ── */}
      <div style={sectionDivider}>
        <div style={sectionLabel}>Ações</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={actionBtnStyle} onClick={onLockAll}>
            <Lock size={13} strokeWidth={1.8} /> Travar todos
          </button>
          <button
            type="button"
            style={{ ...actionBtnStyle, borderColor: 'var(--red)', color: 'var(--red)' }}
            onClick={onDeleteAll}
          >
            <Trash2 size={13} strokeWidth={1.8} /> Excluir todos
          </button>
        </div>
      </div>

      {/* ── Hint ── */}
      <div style={hintStyle}>
        <Move size={13} strokeWidth={1.7} style={{ flexShrink: 0 }} />
        Arraste no canvas pra mover &middot; alça laranja pra redimensionar
      </div>
    </div>
  )
}
