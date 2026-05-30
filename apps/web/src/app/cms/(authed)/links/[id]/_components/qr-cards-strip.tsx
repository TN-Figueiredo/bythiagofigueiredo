'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, QrCode } from 'lucide-react'
import type { QrCardSummary } from '../qr/card-actions'

interface QrCardsStripProps {
  linkId: string
  cards: QrCardSummary[]
}

const STRIP_ID = 'qr-cards-strip'

const SUGGESTIONS = [
  'YouTube',
  'Newsletter',
  'Site',
  'Instagram',
  'Print',
  'Evento',
]

export function QrCardsStrip({ linkId, cards }: QrCardsStripProps) {
  const router = useRouter()
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  const hasCards = cards.length > 0

  function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    setNaming(false)
    setName('')
    router.push(`/cms/links/${linkId}/qr?name=${encodeURIComponent(trimmed)}`)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--surface)',
    border: '1px solid var(--line-strong)',
    borderRadius: 9,
    padding: '9px 12px',
    color: 'var(--ink)',
    fontSize: '13px',
    outline: 'none',
  }

  return (
    <div style={{
      background: 'var(--surface-2)',
      borderRadius: 'var(--r)',
      padding: 18,
    }}>
      <style>{`
        #${STRIP_ID}-scroll::-webkit-scrollbar {
          height: 6px;
        }
        #${STRIP_ID}-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        #${STRIP_ID}-scroll::-webkit-scrollbar-thumb {
          background: var(--line);
          border-radius: 3px;
        }
        .${STRIP_ID}-card {
          border: 1px solid var(--line);
          background: var(--surface);
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .${STRIP_ID}-card:hover {
          border-color: var(--accent);
        }
        .${STRIP_ID}-card:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px var(--accent);
          border-color: var(--accent);
        }
        .${STRIP_ID}-create {
          border: 1px dashed var(--line-strong, var(--line));
          background: transparent;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .${STRIP_ID}-create:hover {
          border-color: var(--accent);
          background: var(--surface);
        }
        .${STRIP_ID}-create:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px var(--accent);
          border-color: var(--accent);
        }
        .${STRIP_ID}-pill {
          padding: 5px 11px;
          border-radius: 99px;
          border: 1px solid var(--line);
          background: var(--surface);
          color: var(--ink-dim);
          font: inherit;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
        }
        .${STRIP_ID}-pill:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
      `}</style>

      <div style={{
        marginBottom: 12, fontSize: '10.5px', fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'var(--ink-faint)',
      }}>
        QR Cards{hasCards ? ` · ${cards.length}` : ''}
      </div>

      {/* ── Name prompt modal ─────────────────────────────── */}
      {naming && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
          }}
          onClick={() => { setNaming(false); setName('') }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(420px, 92vw)',
              background: 'var(--surface)',
              border: '1px solid var(--line-strong)',
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            <div style={{
              padding: '18px 22px',
              borderBottom: '1px solid var(--line)',
            }}>
              <h3 style={{
                margin: 0, fontSize: 17, fontWeight: 600,
                fontFamily: 'Fraunces, serif', color: 'var(--ink)',
              }}>
                Novo QR Card
              </h3>
              <p style={{
                margin: '6px 0 0', fontSize: 12.5, color: 'var(--ink-dim)',
                lineHeight: 1.4,
              }}>
                Para qual canal ou uso é este QR?
              </p>
            </div>

            <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SUGGESTIONS.filter(s => !cards.some(c => c.name === s)).map(s => (
                  <button
                    key={s}
                    type="button"
                    className={`${STRIP_ID}-pill`}
                    onClick={() => setName(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Ex: YouTube Canal 2, Adesivo vitrine..."
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                autoFocus
                style={inputStyle}
              />
            </div>

            <div style={{
              padding: '14px 22px',
              borderTop: '1px solid var(--line)',
              display: 'flex', justifyContent: 'flex-end', gap: 10,
              background: 'var(--bg-side, var(--surface))',
            }}>
              <button
                type="button"
                onClick={() => { setNaming(false); setName('') }}
                style={{
                  padding: '8px 14px', fontSize: 13, fontWeight: 600,
                  borderRadius: 9, border: '1px solid var(--line-strong)',
                  background: 'transparent', color: 'var(--ink-dim)',
                  cursor: 'pointer', font: 'inherit',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!name.trim()}
                style={{
                  padding: '8px 14px', fontSize: 13, fontWeight: 600,
                  borderRadius: 9, border: '1px solid var(--accent)',
                  background: 'var(--accent)', color: 'var(--pb-ink-on-accent, #1A140C)',
                  cursor: 'pointer', font: 'inherit',
                  opacity: name.trim() ? 1 : 0.4,
                }}
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cards list ────────────────────────────────────── */}
      {hasCards ? (
        <ul
          role="list"
          id={`${STRIP_ID}-scroll`}
          style={{
            display: 'flex', gap: 12,
            overflowX: 'auto',
            paddingBottom: 4,
            margin: 0, padding: 0,
            paddingBlockEnd: 4,
            listStyle: 'none',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'thin',
          }}
        >
          {cards.map((card) => (
            <li key={card.id} role="listitem" style={{ scrollSnapAlign: 'start' }}>
              <button
                type="button"
                className={`${STRIP_ID}-card`}
                aria-label={`Editar QR Card: ${card.name}`}
                onClick={() => router.push(`/cms/links/${linkId}/qr?card=${card.id}`)}
                style={{
                  width: 140, minWidth: 140, height: 180,
                  borderRadius: 12,
                  padding: 10,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 6,
                  font: 'inherit',
                  color: 'inherit',
                }}
              >
                <div style={{
                  width: '100%', height: 100, borderRadius: 8,
                  background: card.previewUrl ? 'var(--surface-2)' : '#fff',
                  flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                }}>
                  {card.previewUrl ? (
                    <img
                      src={card.previewUrl}
                      alt={`Preview do QR Card: ${card.name}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }}
                    />
                  ) : (
                    <QrCode size={36} strokeWidth={1.3} style={{ color: 'var(--ink-faint)' }} />
                  )}
                </div>

                <span style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--ink)',
                  textAlign: 'center',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', width: '100%',
                  marginTop: 2,
                }}>
                  {card.name}
                </span>

                <span style={{
                  fontSize: '10.5px', color: 'var(--accent)', fontWeight: 600,
                }}>
                  Editar
                </span>
              </button>
            </li>
          ))}

          <li role="listitem" style={{ scrollSnapAlign: 'start' }}>
            <button
              type="button"
              className={`${STRIP_ID}-create`}
              aria-label="Criar novo QR Card"
              onClick={() => setNaming(true)}
              style={{
                width: 140, minWidth: 140, height: 180,
                borderRadius: 12,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 8,
                font: 'inherit',
                color: 'inherit',
                padding: 12,
              }}
            >
              <Plus size={20} strokeWidth={1.7} style={{ color: 'var(--ink-faint)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-dim)', textAlign: 'center' }}>
                Novo QR Card
              </span>
            </button>
          </li>
        </ul>
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 12, padding: '24px 16px',
        }}>
          <QrCode size={32} strokeWidth={1.4} style={{ color: 'var(--ink-faint)' }} />
          <span style={{
            fontSize: 12, color: 'var(--ink-dim)', fontWeight: 500,
          }}>
            Nenhum QR Card criado
          </span>
          <button
            type="button"
            className={`${STRIP_ID}-create`}
            aria-label="Criar novo QR Card"
            onClick={() => setNaming(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              font: 'inherit',
              color: 'var(--ink-dim)',
              cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
            }}
          >
            <Plus size={14} strokeWidth={2} />
            Novo QR Card
          </button>
        </div>
      )}
    </div>
  )
}
