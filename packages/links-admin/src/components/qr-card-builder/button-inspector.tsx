'use client'
import { AlertTriangle, Copy, FileText, Lock, Trash2, RotateCcw, Circle, Move } from 'lucide-react'
import type { TextElement } from '@tn-figueiredo/links/qr'
import { PositionInput } from './inspector-field'
import { actionBtnStyle, hintStyle, labelStyle, sectionDivider, sectionLabel } from './inspector-styles'

export function isButtonElement(el: { type: string; name?: string }): boolean {
  return el.type === 'text' && (el.name?.startsWith('__button:') ?? false)
}

const QUICK_PICKS = [
  'Link na bio',
  'Link nos comentários',
  'Arrasta ↑',
  'Saiba mais',
  'Ler o post',
]

interface ButtonInspectorProps {
  element: TextElement
  onUpdate: (patch: Partial<TextElement>) => void
  onDuplicate?: () => void
  onDelete?: () => void
}

export function ButtonInspector({ element, onUpdate, onDuplicate, onDelete }: ButtonInspectorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: -2 }}>
        <FileText size={14} strokeWidth={2} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          Botão / CTA
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" style={actionBtnStyle} onClick={() => onDuplicate?.()}>
          <Copy size={13} strokeWidth={1.8} /> Duplicar
        </button>
        <button type="button" style={actionBtnStyle} onClick={() => onUpdate({ locked: !element.locked })}>
          <Lock size={13} strokeWidth={1.8} /> Travar
        </button>
        <button type="button" style={{ ...actionBtnStyle, flex: '0 0 38px' }} onClick={() => onDelete?.()} aria-label="Excluir">
          <Trash2 size={13} strokeWidth={1.8} />
        </button>
      </div>

      {/* Texto do botão */}
      <div>
        <div style={labelStyle}>
          Texto do botão
        </div>
        <input
          type="text"
          value={element.content}
          onChange={e => onUpdate({ content: e.target.value })}
          style={{
            width: '100%',
            background: 'var(--surface)',
            border: '1px solid var(--line-strong)',
            borderRadius: 8,
            padding: '9px 11px',
            color: 'var(--ink)',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          {QUICK_PICKS.map(text => (
            <button
              key={text}
              type="button"
              onClick={() => onUpdate({ content: text })}
              style={{
                fontSize: 10.5,
                padding: '4px 8px',
                borderRadius: 999,
                border: '1px solid var(--line-strong)',
                background: 'var(--surface-2)',
                color: 'var(--ink-dim)',
                cursor: 'pointer',
              }}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {/* Warning callout */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'var(--amber-soft)', borderRadius: 8 }}>
        <AlertTriangle size={15} strokeWidth={1.8} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 11.5, lineHeight: 1.55, color: 'var(--ink-dim)' }}>
          Na imagem do post a arte <b style={{ color: 'var(--ink)' }}>não é clicável</b> — é um
          lembrete visual. O link real vive na <b style={{ color: 'var(--ink)' }}>bio</b>, num{' '}
          <b style={{ color: 'var(--ink)' }}>comentário fixado</b> ou no sticker de link nativo.
        </span>
      </div>

      {/* Transformar */}
      <div style={sectionDivider}>
        <div style={sectionLabel}>Transformar</div>

        {/* X / Y */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <PositionInput label="X" value={element.x} onChange={v => onUpdate({ x: v })} />
          </div>
          <div style={{ flex: 1 }}>
            <PositionInput label="Y" value={element.y} onChange={v => onUpdate({ y: v })} />
          </div>
        </div>

        {/* Rotação */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RotateCcw size={13} strokeWidth={1.7} style={{ color: 'var(--ink-dim)' }} />
              <span style={{ fontSize: '11.5px', color: 'var(--ink-dim)' }}>Rotação</span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--ink)' }}>
              {element.rotation}&deg;
            </span>
          </div>
          <input
            type="range" min={-180} max={180}
            value={element.rotation}
            onChange={e => onUpdate({ rotation: Number(e.target.value) })}
            style={{ width: '100%' }}
            aria-label="Rotação"
          />
        </div>

        {/* Opacidade */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Circle size={13} strokeWidth={1.7} style={{ color: 'var(--ink-dim)' }} />
              <span style={{ fontSize: '11.5px', color: 'var(--ink-dim)' }}>Opacidade</span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--ink)' }}>
              {Math.round(element.opacity * 100)}%
            </span>
          </div>
          <input
            type="range" min={10} max={100}
            value={Math.round(element.opacity * 100)}
            onChange={e => onUpdate({ opacity: Number(e.target.value) / 100 })}
            style={{ width: '100%' }}
            aria-label="Opacidade"
          />
        </div>
      </div>

      {/* Hint */}
      <div style={hintStyle}>
        <Move size={13} strokeWidth={1.7} style={{ flexShrink: 0 }} />
        Arraste no canvas pra mover &middot; alça laranja pra redimensionar
      </div>
    </div>
  )
}
