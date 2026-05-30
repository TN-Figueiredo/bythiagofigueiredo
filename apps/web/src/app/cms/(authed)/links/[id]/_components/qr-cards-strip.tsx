'use client'

import { useRouter } from 'next/navigation'
import { Plus, QrCode } from 'lucide-react'
import type { QrCardSummary } from '../qr/card-actions'

interface QrCardsStripProps {
  linkId: string
  cards: QrCardSummary[]
}

const STRIP_ID = 'qr-cards-strip'

export function QrCardsStrip({ linkId, cards }: QrCardsStripProps) {
  const router = useRouter()

  const hasCards = cards.length > 0

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
      `}</style>

      <div style={{
        marginBottom: 12, fontSize: '10.5px', fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'var(--ink-faint)',
      }}>
        QR Cards{hasCards ? ` · ${cards.length}` : ''}
      </div>

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
              onClick={() => router.push(`/cms/links/${linkId}/qr`)}
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
            onClick={() => router.push(`/cms/links/${linkId}/qr`)}
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
