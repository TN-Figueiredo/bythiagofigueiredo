'use client'

import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

interface QrCardItem {
  id: string
  name: string
  previewUrl: string | null
  createdAt: string
}

interface QrCardsStripProps {
  linkId: string
  cards: QrCardItem[]
}

export function QrCardsStrip({ linkId, cards }: QrCardsStripProps) {
  const router = useRouter()

  return (
    <div style={{
      background: 'var(--surface-2)',
      borderRadius: 'var(--r)',
      padding: 18,
    }}>
      <div style={{
        marginBottom: 12, fontSize: '10.5px', fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'var(--ink-faint)',
      }}>
        QR Cards · {cards.length}
      </div>

      <div style={{
        display: 'flex', gap: 12,
        overflowX: 'auto',
        paddingBottom: 4,
      }}>
        {cards.map((card) => (
          <div
            key={card.id}
            onClick={() => router.push(`/cms/links/${linkId}/qr?card=${card.id}`)}
            style={{
              width: 130, minWidth: 130, height: 150,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: 12,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 8,
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: 8,
              background: '#fff', padding: 5, flexShrink: 0,
            }}>
              {card.previewUrl ? (
                <img
                  src={card.previewUrl}
                  alt={card.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 4 }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  background: 'repeating-conic-gradient(#111 0% 25%, #fff 0% 50%) 0 center / 10px 10px',
                }} />
              )}
            </div>

            <span style={{
              fontSize: 11, fontWeight: 600, color: 'var(--ink)',
              textAlign: 'center',
              overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', width: '100%',
            }}>
              {card.name}
            </span>

            <span style={{
              fontSize: '10.5px', color: 'var(--accent)', fontWeight: 600,
            }}>
              Editar
            </span>
          </div>
        ))}

        <div
          onClick={() => router.push(`/cms/links/${linkId}/qr`)}
          style={{
            width: 130, minWidth: 130, height: 150,
            border: '1px dashed var(--line-strong, var(--line))',
            borderRadius: 12,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 8, cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
        >
          <Plus size={20} strokeWidth={1.7} style={{ color: 'var(--ink-faint)' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-dim)', textAlign: 'center' }}>
            Novo QR Card
          </span>
        </div>
      </div>
    </div>
  )
}
