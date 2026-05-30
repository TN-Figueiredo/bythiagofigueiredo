'use client'
import { useMemo, useState, useCallback } from 'react'
import { Copy, Lock, Trash2, QrCode, RotateCcw, Circle } from 'lucide-react'
import type { QrElement, QrDotStyle } from '@tn-figueiredo/links/qr'
import { QR_DOT_STYLES } from '@tn-figueiredo/links/qr'
import { ColorPicker } from './color-picker'
import { SliderField } from './inspector-field'
import { generateStyledQrSvg } from './qr-styled-svg'

interface QrInspectorProps {
  element: QrElement
  shortUrl: string
  linkCode: string
  onUpdate: (patch: Partial<QrElement>) => void
  onDuplicate?: () => void
  onDelete?: () => void
}

const STYLE_LABELS: Record<QrDotStyle, string> = {
  square: 'Quadrado',
  dots: 'Pontos',
  rounded: 'Arredondado',
  classy: 'Classico',
}

/* ── Shared styles (matches text-inspector pattern) ── */

const actionBtnStyle: React.CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 5, padding: '7px 0', borderRadius: 7,
  border: '1px solid var(--line-strong)', background: 'var(--surface-2)',
  color: 'var(--ink-dim)', fontSize: 11, cursor: 'pointer',
}

/* ── Position input (X / Y) ── */

function PositionInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginBottom: 4 }}>{label}</div>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line-strong)',
        borderRadius: 7, padding: '0 6px 0 8px',
        display: 'flex', alignItems: 'center',
      }}>
        <input
          type="number"
          value={Math.round(value)}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            flex: 1, fontFamily: 'var(--font-mono, monospace)', fontSize: 12,
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--ink)', padding: '6px 0', width: 0,
          }}
        />
        <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>px</span>
      </div>
    </div>
  )
}

export function QrInspector({ element, shortUrl, linkCode, onUpdate, onDuplicate, onDelete }: QrInspectorProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(shortUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [shortUrl])

  const stylePreviews = useMemo(() => {
    const previews: Record<string, string> = {}
    for (const s of QR_DOT_STYLES) {
      const svg = generateStyledQrSvg(shortUrl, element.foregroundColor, element.backgroundColor, element.errorCorrection, s, 64)
      previews[s] = `data:image/svg+xml,${encodeURIComponent(svg)}`
    }
    return previews
  }, [shortUrl, element.foregroundColor, element.backgroundColor, element.errorCorrection])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: -2 }}>
        <QrCode size={14} strokeWidth={2} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          QR Code
        </span>
      </div>

      {/* ── Action buttons row ── */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" style={actionBtnStyle} onClick={() => onDuplicate?.()}>
          <Copy size={13} strokeWidth={1.8} /> Duplicar
        </button>
        <button
          type="button"
          style={actionBtnStyle}
          onClick={() => onUpdate({ locked: !element.locked })}
        >
          <Lock size={13} strokeWidth={1.8} /> Travar
        </button>
        <button
          type="button"
          style={{ ...actionBtnStyle, flex: '0 0 38px' }}
          onClick={() => onDelete?.()}
        >
          <Trash2 size={13} strokeWidth={1.8} />
        </button>
      </div>

      {/* ── URL codificada ── */}
      <div>
        <div style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--ink-dim)', marginBottom: 8,
        }}>
          URL codificada
        </div>
        <div className="rounded px-2 py-1.5 flex items-center gap-1.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
          <span className="flex-1 text-[11px] font-mono truncate" style={{ color: 'var(--ink)' }}>{shortUrl}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="p-0.5 hover:opacity-80"
            style={{ color: 'var(--ink-dim)' }}
            title="Copiar URL"
          >
            <Copy size={12} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px]" style={{ color: 'var(--ink-dim)' }}>Do link: {linkCode}</span>
          {copied && <span className="text-[9px]" style={{ color: 'var(--accent)' }}>Copiado!</span>}
        </div>
      </div>

      {/* ── Transformar ── */}
      <div style={{
        borderTop: '1px solid var(--line)',
        marginTop: 2, paddingTop: 16,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--ink-dim)', marginBottom: 12,
        }}>
          Transformar
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <PositionInput label="X" value={element.x} onChange={v => onUpdate({ x: v })} />
          <PositionInput label="Y" value={element.y} onChange={v => onUpdate({ y: v })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <PositionInput label="L" value={element.width} onChange={v => onUpdate({ width: v, height: v })} />
          <PositionInput label="A" value={element.height} onChange={v => onUpdate({ width: v, height: v })} />
        </div>
      </div>

      {/* ── Aparencia do QR ── */}
      <div style={{
        borderTop: '1px solid var(--line)',
        marginTop: 2, paddingTop: 16,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--ink-dim)', marginBottom: 12,
        }}>
          Aparencia do QR
        </div>
        <ColorPicker label="Frente" value={element.foregroundColor} onChange={c => onUpdate({ foregroundColor: c })} />
        <ColorPicker label="Fundo" value={element.backgroundColor} onChange={c => onUpdate({ backgroundColor: c })} />
        <div>
          <span className="text-[10px]" style={{ color: 'var(--ink-dim)' }}>Correcao de erro</span>
          <select
            value={element.errorCorrection}
            onChange={e => onUpdate({ errorCorrection: e.target.value as 'L' | 'M' | 'Q' | 'H' })}
            className="w-full mt-0.5 rounded px-1.5 py-1 text-[11px]"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          >
            <option value="L">L (7%)</option>
            <option value="M">M (15%)</option>
            <option value="Q">Q (25%)</option>
            <option value="H">H (30%)</option>
          </select>
          {element.showLogo && element.errorCorrection !== 'H' && (
            <p className="text-[9px] mt-0.5" style={{ color: 'var(--amber)' }}>Elevado automaticamente para H para visibilidade do logo</p>
          )}
        </div>
        <div className="mt-2">
          <span className="text-[10px]" style={{ color: 'var(--ink-dim)' }}>Estilo dos pontos</span>
          <div className="grid grid-cols-4 gap-1.5 mt-1">
            {QR_DOT_STYLES.map(s => {
              const isActive = (element.dotStyle ?? 'square') === s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onUpdate({ dotStyle: s })}
                  className="flex flex-col items-center gap-1 p-1.5 rounded"
                  style={{
                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--line)'}`,
                    background: isActive ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  <img src={stylePreviews[s]} alt={s} className="w-8 h-8 rounded-sm" />
                  <span className="text-[9px]" style={{ color: isActive ? 'var(--accent)' : 'var(--ink-dim)' }}>
                    {STYLE_LABELS[s]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="mt-2">
          <SliderField label="Raio do canto" value={element.cornerRadius} onChange={v => onUpdate({ cornerRadius: v })} min={0} max={50} format={v => `${v}px`} />
        </div>
        <SliderField label="Espacamento" value={element.padding} onChange={v => onUpdate({ padding: v })} min={0} max={40} format={v => `${v}px`} />
      </div>

      {/* ── LOGO ── */}
      <div style={{
        borderTop: '1px solid var(--line)',
        marginTop: 2, paddingTop: 16,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--ink-dim)', marginBottom: 12,
        }}>
          Logo
        </div>
        <label className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--ink)' }}>
          <input
            type="checkbox"
            checked={element.showLogo}
            onChange={e => onUpdate({ showLogo: e.target.checked })}
            className="rounded"
          />
          Mostrar logo do site
        </label>
        {element.showLogo && (
          <>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              <SliderField label="Topo" value={element.logoPadTop ?? 10} onChange={v => onUpdate({ logoPadTop: v })} min={0} max={60} format={v => `${v}px`} />
              <SliderField label="Base" value={element.logoPadBottom ?? 14} onChange={v => onUpdate({ logoPadBottom: v })} min={0} max={60} format={v => `${v}px`} />
              <SliderField label="Esquerda" value={element.logoPadLeft ?? 12} onChange={v => onUpdate({ logoPadLeft: v })} min={0} max={60} format={v => `${v}px`} />
              <SliderField label="Direita" value={element.logoPadRight ?? 8} onChange={v => onUpdate({ logoPadRight: v })} min={0} max={60} format={v => `${v}px`} />
            </div>
            <button
              type="button"
              onClick={() => onUpdate({ logoPadTop: 10, logoPadRight: 8, logoPadBottom: 14, logoPadLeft: 12 })}
              className="text-[9px] underline hover:opacity-80 mt-1"
              style={{ color: 'var(--ink-dim)' }}
            >
              Resetar espacamento
            </button>
          </>
        )}
      </div>

      {/* ── EXIBICAO ── */}
      <div style={{
        borderTop: '1px solid var(--line)',
        marginTop: 2, paddingTop: 16,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--ink-dim)', marginBottom: 12,
        }}>
          Exibicao
        </div>

        {/* ── Rotacao ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RotateCcw size={13} strokeWidth={1.7} style={{ color: 'var(--ink-dim)' }} />
              <span style={{ fontSize: '11.5px', color: 'var(--ink-dim)' }}>Rotacao</span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--ink)' }}>
              {element.rotation}deg
            </span>
          </div>
          <input
            type="range" min={0} max={360}
            value={element.rotation}
            onChange={e => onUpdate({ rotation: Number(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>

        {/* ── Opacidade ── */}
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
            type="range" min={0} max={100}
            value={Math.round(element.opacity * 100)}
            onChange={e => onUpdate({ opacity: Number(e.target.value) / 100 })}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* ── OPCOES ── */}
      <div style={{
        borderTop: '1px solid var(--line)',
        marginTop: 2, paddingTop: 16,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--ink-dim)', marginBottom: 12,
        }}>
          Opcoes
        </div>
        <label className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--ink)' }}>
          <input type="checkbox" checked={element.locked} onChange={e => onUpdate({ locked: e.target.checked })} className="rounded" />
          Travar posicao
        </label>
      </div>
    </div>
  )
}
