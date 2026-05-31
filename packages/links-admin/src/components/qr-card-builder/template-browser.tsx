'use client'
import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Bookmark, Trash2 } from 'lucide-react'
import type { CardComposition } from '@tn-figueiredo/links/qr'
import { createDefaultComposition } from '@tn-figueiredo/links/qr'

/* ── types ── */

export interface QrTemplate {
  id: string
  name: string
  composition: CardComposition
  thumbnailUrl: string | null
  createdAt: string
}

interface TemplateBrowserProps {
  templates: QrTemplate[]
  onLoad: (composition: CardComposition) => void
  onSave: (name: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

/* ── built-in template definitions ── */

interface BuiltinTemplate {
  id: string
  name: string
  aspect: string       // CSS aspect-ratio value
  gradient: string     // background gradient
  badge?: string       // optional badge label
  description: string
  titleColor: string   // color for wireframe title bars
  pillBg: string       // CTA pill background
  pillText: string     // CTA pill text color
}

const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: 'newsletter-card',
    name: 'Newsletter Card',
    aspect: '9/16',
    gradient: 'linear-gradient(145deg, #F5E6D3, #E8D5C0)',
    badge: 'popular',
    description: 'QR + chamada editorial (impressao)',
    titleColor: '#3D2E1F',
    pillBg: '#3D2E1F',
    pillText: '#F5E6D3',
  },
  {
    id: 'cartao-visita',
    name: 'Cartao de visita',
    aspect: '16/9',
    gradient: 'linear-gradient(145deg, #1A1816, #2A2622)',
    badge: 'print',
    description: '85x55mm · QR + handle + nome',
    titleColor: '#ECE6DA',
    pillBg: '#ECE6DA',
    pillText: '#1A1816',
  },
  {
    id: 'adesivo-redondo',
    name: 'Adesivo redondo',
    aspect: '1/1',
    gradient: 'linear-gradient(145deg, #F5E6D3, #E8D5C0)',
    description: "QR central + 'aponte a camera'",
    titleColor: '#3D2E1F',
    pillBg: '#3D2E1F',
    pillText: '#F5E6D3',
  },
  {
    id: 'cavalete-mesa',
    name: 'Cavalete de mesa',
    aspect: '3/4',
    gradient: 'linear-gradient(145deg, #F5E6D3, #E8D5C0)',
    badge: 'print',
    description: 'QR grande pra balcao/evento',
    titleColor: '#3D2E1F',
    pillBg: '#3D2E1F',
    pillText: '#F5E6D3',
  },
  {
    id: 'poster-a4',
    name: 'Poster A4',
    aspect: '3/4',
    gradient: 'linear-gradient(145deg, #1A1816, #2A2622)',
    description: 'QR + titulo grande pra parede',
    titleColor: '#ECE6DA',
    pillBg: '#ECE6DA',
    pillText: '#1A1816',
  },
  {
    id: 'story',
    name: 'Story',
    aspect: '9/16',
    gradient: 'linear-gradient(145deg, #F2683C, #E85D30)',
    description: 'QR pra divulgar no Instagram',
    titleColor: '#fff',
    pillBg: '#fff',
    pillText: '#F2683C',
  },
]

/* ── eyebrow label ── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 600,
        color: 'var(--ink-dim)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  )
}

/* ── mini wireframe preview ── */

function WireframePreview({ tpl }: { tpl: BuiltinTemplate }) {
  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: tpl.aspect,
        height: '100%',
        maxWidth: '100%',
        margin: '0 auto',
        borderRadius: 6,
        background: tpl.gradient,
        boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        overflow: 'hidden',
      }}
    >
      {/* Title bars */}
      <div
        style={{
          position: 'absolute',
          top: '11%',
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <div
          style={{
            width: '48%',
            height: 5,
            borderRadius: 3,
            background: tpl.titleColor,
            opacity: 0.88,
          }}
        />
        <div
          style={{
            width: '32%',
            height: 3,
            borderRadius: 3,
            background: tpl.titleColor,
            opacity: 0.42,
          }}
        />
      </div>
      {/* QR placeholder */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            background: '#fff',
            padding: 6,
            borderRadius: 9,
            boxShadow: '0 4px 14px rgba(0,0,0,0.16)',
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              background:
                'repeating-conic-gradient(#1F1B17 0% 25%, #fff 0% 50%) 0 center / 8px 8px',
            }}
          />
        </div>
      </div>
      {/* CTA pill */}
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 11px',
            borderRadius: 99,
            background: tpl.pillBg,
          }}
        >
          <div
            style={{
              width: 22,
              height: 3,
              borderRadius: 2,
              background: tpl.pillText,
              opacity: 0.92,
            }}
          />
          <span style={{ fontSize: 7, fontWeight: 800, color: tpl.pillText }}>
            {'→'}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── badge pill ── */

function Badge({ label }: { label: string }) {
  return (
    <span
      style={{
        marginLeft: 'auto',
        padding: '2px 7px',
        borderRadius: 99,
        fontSize: 9.5,
        fontWeight: 600,
        fontFamily: 'monospace',
        background: 'var(--surface)',
        color: 'var(--ink-dim)',
        border: '1px solid var(--line)',
        lineHeight: '14px',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}

/* ── component ── */

export function TemplateBrowser({
  templates,
  onLoad,
  onSave,
  onDelete,
  onClose,
}: TemplateBrowserProps) {
  const [saveName, setSaveName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [hoverDelete, setHoverDelete] = useState<string | null>(null)
  const [hoverCard, setHoverCard] = useState<string | null>(null)

  /* Escape key */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleBlank = useCallback(() => {
    onLoad(createDefaultComposition())
    onClose()
  }, [onLoad, onClose])

  const handleSave = useCallback(() => {
    if (saveName.trim()) {
      onSave(saveName.trim())
      setShowSaveInput(false)
      setSaveName('')
    }
  }, [saveName, onSave])

  const handleBuiltinClick = useCallback(() => {
    // Built-in templates are visual-only for now; they call onBlank
    onLoad(createDefaultComposition())
    onClose()
  }, [onLoad, onClose])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      {/* backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)',
        }}
      />

      {/* dialog */}
      <div
        style={{
          position: 'relative',
          width: 'min(780px, 100%)',
          maxHeight: '84vh',
          overflow: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--line-strong)',
          borderRadius: 16,
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Templates"
      >
        {/* ── sticky header ── */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            background: 'var(--surface)',
            zIndex: 1,
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: 'Fraunces, serif',
              fontSize: 20,
              fontWeight: 600,
              color: 'var(--ink)',
            }}
          >
            Templates
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: 'var(--ink-dim)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* ── body ── */}
        <div style={{ padding: 24 }}>
          {/* ── Section 1: Comecar ── */}
          <Eyebrow>Comecar</Eyebrow>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
              marginBottom: 26,
            }}
          >
            {/* Blank canvas button */}
            <button
              type="button"
              onClick={handleBlank}
              style={{
                minHeight: 156,
                border: '1.5px dashed var(--line-strong)',
                borderRadius: 12,
                background: 'var(--surface-2)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: 16,
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: 'var(--accent-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Plus size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    marginBottom: 4,
                  }}
                >
                  Comecar do zero
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-faint)',
                    maxWidth: 150,
                    margin: '0 auto',
                    lineHeight: '15px',
                  }}
                >
                  Tela em branco neste formato
                </div>
              </div>
            </button>

            {/* Save current button */}
            <div
              style={{
                minHeight: 156,
                border: '1.5px solid var(--line-strong)',
                borderRadius: 12,
                background: 'var(--surface-2)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: 16,
                position: 'relative',
              }}
            >
              {showSaveInput ? (
                <div
                  style={{
                    width: '100%',
                    maxWidth: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave()
                    }}
                    placeholder="Nome do template"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line-strong)',
                      background: 'var(--surface)',
                      color: 'var(--ink)',
                      fontSize: 12,
                      outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSaveInput(false)
                        setSaveName('')
                      }}
                      style={{
                        flex: 1,
                        padding: '7px 0',
                        borderRadius: 7,
                        border: '1px solid var(--line)',
                        background: 'none',
                        color: 'var(--ink-dim)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      style={{
                        flex: 1,
                        padding: '7px 0',
                        borderRadius: 7,
                        border: 'none',
                        background: 'var(--accent)',
                        color: 'rgb(26,18,12)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSaveInput(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 10,
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      background: 'var(--accent-soft)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Bookmark size={18} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--ink)',
                        marginBottom: 4,
                      }}
                    >
                      Salvar atual
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--ink-faint)',
                        maxWidth: 150,
                        margin: '0 auto',
                        lineHeight: '15px',
                      }}
                    >
                      Guarda o design de agora como template
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* ── Section 2: Modelos pra este formato ── */}
          <Eyebrow>Modelos pra este formato</Eyebrow>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 14,
            }}
          >
            {BUILTIN_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={handleBuiltinClick}
                style={{
                  padding: 0,
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Preview area */}
                <div
                  style={{
                    height: 188,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--surface)',
                    borderBottom: '1px solid var(--line)',
                    padding: 14,
                    overflow: 'hidden',
                  }}
                >
                  <WireframePreview tpl={tpl} />
                </div>
                {/* Info area */}
                <div style={{ padding: '11px 13px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: 'var(--ink)',
                      }}
                    >
                      {tpl.name}
                    </span>
                    {tpl.badge && <Badge label={tpl.badge} />}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--ink-dim)',
                      marginTop: 3,
                      lineHeight: '14px',
                    }}
                  >
                    {tpl.description}
                  </div>
                </div>
              </button>
            ))}

            {/* ── User-saved templates ── */}
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                onMouseEnter={() => setHoverCard(tpl.id)}
                onMouseLeave={() => setHoverCard(null)}
                style={{
                  position: 'relative',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onLoad(tpl.composition)
                    onClose()
                  }}
                  style={{
                    width: '100%',
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Preview area */}
                  <div
                    style={{
                      height: 188,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--surface)',
                      borderBottom: '1px solid var(--line)',
                      padding: 14,
                      overflow: 'hidden',
                    }}
                  >
                    {tpl.thumbnailUrl ? (
                      <img
                        src={tpl.thumbnailUrl}
                        alt={tpl.name}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                          borderRadius: 6,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          color: 'var(--ink-faint)',
                        }}
                      >
                        Sem preview
                      </div>
                    )}
                  </div>
                  {/* Info area */}
                  <div style={{ padding: '11px 13px' }}>
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: 'var(--ink)',
                      }}
                    >
                      {tpl.name}
                    </span>
                  </div>
                </button>
                {/* Delete button — appears on hover */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(tpl.id)
                  }}
                  onMouseEnter={() => setHoverDelete(tpl.id)}
                  onMouseLeave={() => setHoverDelete(null)}
                  aria-label={`Deletar template ${tpl.name}`}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color:
                      hoverDelete === tpl.id
                        ? 'var(--red)'
                        : 'var(--ink-faint)',
                    opacity: hoverCard === tpl.id ? 1 : 0,
                    transition: 'opacity 150ms, color 150ms',
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
