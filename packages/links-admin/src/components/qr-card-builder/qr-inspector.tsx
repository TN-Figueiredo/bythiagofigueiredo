'use client'
import { useMemo, useState, useCallback } from 'react'
import { Copy, Lock, Trash2, QrCode, RotateCcw, Circle, Move } from 'lucide-react'
import type { QrElement, QrDotStyle } from '@tn-figueiredo/links/qr'
import { QR_DOT_STYLES } from '@tn-figueiredo/links/qr'
import { ToggleSwitch, PositionInput } from './inspector-field'
import { labelStyle, actionBtnStyle, pillBar, pillBtn, hintStyle, sectionDivider, sectionLabel } from './inspector-styles'
import { generateStyledQrSvg } from './qr-styled-svg'

/* ── QR-specific color presets ── */

const QR_FG_COLORS = ['#1F1B17', '#000000', '#F2683C', '#6E63F2', '#46B17E']
const QR_BG_COLORS = ['#FFFFFF', '#F7F1E8', '#0C0B09', '#FBF6E8']

const STYLE_OPTIONS: { key: QrDotStyle; label: string }[] = [
  { key: 'square', label: 'Quadrado' },
  { key: 'dots', label: 'Pontos' },
  { key: 'rounded', label: 'Arredondado' },
  { key: 'classy', label: 'Elegante' },
]

const EC_LEVELS = [
  { key: 'L' as const, pct: 7 },
  { key: 'M' as const, pct: 15 },
  { key: 'Q' as const, pct: 25 },
  { key: 'H' as const, pct: 30 },
]

/* ── Props ── */

interface QrInspectorProps {
  element: QrElement
  shortUrl: string
  linkCode: string
  onUpdate: (patch: Partial<QrElement>) => void
  onDuplicate?: () => void
  onDelete?: () => void
}

/* ── Component ── */

export function QrInspector({ element, shortUrl, linkCode, onUpdate, onDuplicate, onDelete }: QrInspectorProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(shortUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [shortUrl])

  const qrPreviewSrc = useMemo(() => {
    const svg = generateStyledQrSvg(
      shortUrl, element.foregroundColor, element.backgroundColor,
      element.errorCorrection, element.dotStyle ?? 'square', 120,
    )
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
  }, [shortUrl, element.foregroundColor, element.backgroundColor, element.errorCorrection, element.dotStyle])

  const stylePreviews = useMemo(() => {
    const previews: Record<string, string> = {}
    for (const s of QR_DOT_STYLES) {
      const svg = generateStyledQrSvg(shortUrl, element.foregroundColor, element.backgroundColor, element.errorCorrection, s, 22)
      previews[s] = `data:image/svg+xml,${encodeURIComponent(svg)}`
    }
    return previews
  }, [shortUrl, element.foregroundColor, element.backgroundColor, element.errorCorrection])

  const ecLevel = EC_LEVELS.find(l => l.key === element.errorCorrection) ?? EC_LEVELS[1]!

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: -2 }}>
        <QrCode size={14} strokeWidth={2} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          QR Code
        </span>
      </div>

      {/* ── Action buttons ── */}
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

      {/* ── QR Preview ── */}
      <div style={{
        display: 'flex', justifyContent: 'center', padding: 12,
        background: 'var(--surface)', borderRadius: 10,
        border: '1px solid var(--line)',
      }}>
        <img src={qrPreviewSrc} alt="QR preview" width={120} height={120} style={{ display: 'block' }} />
      </div>

      {/* ── URL codificada ── */}
      <div>
        <div style={labelStyle}>URL codificada</div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--surface)', border: '1px solid var(--line-strong)',
          borderRadius: 8, padding: '8px 10px',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono, monospace)', fontSize: 11,
            color: 'var(--accent)', flex: 1, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {shortUrl}
          </span>
          <button type="button" onClick={handleCopy} aria-label="Copiar URL" style={{
            padding: 0, border: 'none', background: 'transparent',
            cursor: 'pointer', color: 'var(--ink-faint)', flexShrink: 0,
          }}>
            <Copy size={13} strokeWidth={1.7} />
          </button>
        </div>
        <div style={{ fontSize: '10.5px', color: 'var(--ink-faint)', marginTop: 5 }}>
          Herda do link &middot; {linkCode}
          {copied && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>Copiado!</span>}
        </div>
      </div>

      {/* ── Estilo dos módulos ── */}
      <div>
        <div style={labelStyle}>Estilo dos módulos</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {STYLE_OPTIONS.map(s => {
            const isActive = (element.dotStyle ?? 'square') === s.key
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onUpdate({ dotStyle: s.key })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 9px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--line-strong)'}`,
                  background: isActive ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: isActive ? 'var(--accent)' : 'var(--ink-dim)',
                }}
              >
                <span style={{ flexShrink: 0 }}>
                  <img src={stylePreviews[s.key]} alt={s.label} width={22} height={22} style={{ display: 'block', borderRadius: 2 }} />
                </span>
                <span style={{ fontSize: 11 }}>{s.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Cor dos módulos ── */}
      <div>
        <div style={labelStyle}>Cor dos módulos</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {QR_FG_COLORS.map(c => {
            const isActive = element.foregroundColor.toLowerCase() === c.toLowerCase()
            return (
              <button
                key={c}
                type="button"
                onClick={() => onUpdate({ foregroundColor: c })}
                aria-label={`Cor ${c}`}
                style={{
                  width: 26, height: 26, borderRadius: 7, padding: 0,
                  background: c, cursor: 'pointer',
                  border: isActive ? '2px solid var(--accent)' : '1px solid var(--line-strong)',
                }}
              />
            )
          })}
        </div>
      </div>

      {/* ── Fundo ── */}
      <div>
        <div style={labelStyle}>Fundo</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {QR_BG_COLORS.map(c => {
            const isActive = element.backgroundColor.toLowerCase() === c.toLowerCase()
            return (
              <button
                key={c}
                type="button"
                onClick={() => onUpdate({ backgroundColor: c })}
                aria-label={`Cor ${c}`}
                style={{
                  width: 26, height: 26, borderRadius: 7, padding: 0,
                  background: c, cursor: 'pointer',
                  border: isActive ? '2px solid var(--accent)' : '1px solid var(--line-strong)',
                }}
              />
            )
          })}
        </div>
      </div>

      {/* ── Correção de erro ── */}
      <div>
        <div style={labelStyle}>Correção de erro</div>
        <div style={pillBar}>
          {EC_LEVELS.map(l => (
            <button
              key={l.key}
              type="button"
              onClick={() => onUpdate({ errorCorrection: l.key })}
              style={pillBtn(element.errorCorrection === l.key)}
            >
              {l.key}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '10.5px', color: 'var(--ink-faint)', marginTop: 5 }}>
          {ecLevel.key} &middot; {ecLevel.pct}% de recuperação &middot; maior = QR mais denso
        </div>
      </div>

      {/* ── Cantos / arredondamento ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '11.5px', color: 'var(--ink-dim)' }}>Cantos / arredondamento</span>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--ink)' }}>
            {Math.round((element.cornerRadius / 50) * 100)}%
          </span>
        </div>
        <input
          type="range" min={0} max={100}
          value={Math.round((element.cornerRadius / 50) * 100)}
          onChange={e => onUpdate({ cornerRadius: Math.round(Number(e.target.value) / 100 * 50) })}
          aria-label="Cantos / arredondamento"
          style={{ width: '100%' }}
        />
      </div>

      {/* ── Margem (quiet zone) ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '11.5px', color: 'var(--ink-dim)' }}>Margem (quiet zone)</span>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--ink)' }}>
            {element.padding}%
          </span>
        </div>
        <input
          type="range" min={0} max={24}
          value={element.padding}
          onChange={e => onUpdate({ padding: Number(e.target.value) })}
          aria-label="Margem"
          style={{ width: '100%' }}
        />
      </div>

      {/* ── Carimbo TF no centro ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 4,
      }}>
        <div>
          <div style={{ fontSize: '12.5px', color: 'var(--ink)' }}>
            Carimbo TF no centro
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--ink-faint)', marginTop: 2 }}>
            Logo na máscara central
          </div>
        </div>
        <ToggleSwitch checked={element.showLogo} onChange={v => onUpdate({ showLogo: v })} />
      </div>

      {/* ── Transformar ── */}
      <div style={sectionDivider}>
        <div style={sectionLabel}>
          Transformar
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          <PositionInput label="X" value={element.x} onChange={v => onUpdate({ x: v })} />
          <PositionInput label="Y" value={element.y} onChange={v => onUpdate({ y: v })} />
          <PositionInput label="L" value={element.width} onChange={v => onUpdate({ width: v, height: v })} />
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
            aria-label="Rotação"
            style={{ width: '100%' }}
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
            aria-label="Opacidade"
            style={{ width: '100%' }}
          />
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
