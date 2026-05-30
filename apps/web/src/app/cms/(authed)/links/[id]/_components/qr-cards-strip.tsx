'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, QrCode, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import type { QrCardSummary } from '../qr/card-actions'
import { updateQrCard, deleteQrCard } from '../qr/card-actions'

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
  const [isPending, startTransition] = useTransition()

  // Create modal
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  // Context menu
  const [menuCardId, setMenuCardId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Rename modal
  const [renaming, setRenaming] = useState<{ id: string; current: string } | null>(null)
  const [renameTo, setRenameTo] = useState('')

  // Delete confirm
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null)

  const hasCards = cards.length > 0

  // Close context menu on outside click
  useEffect(() => {
    if (!menuCardId) return
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuCardId(null)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuCardId])

  function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    setNaming(false)
    setName('')
    router.push(`/cms/links/${linkId}/qr?name=${encodeURIComponent(trimmed)}`)
  }

  async function handleRename() {
    if (!renaming || !renameTo.trim()) return
    await updateQrCard(renaming.id, linkId, { name: renameTo.trim() })
    setRenaming(null)
    setRenameTo('')
    startTransition(() => router.refresh())
  }

  async function handleDelete() {
    if (!deleting) return
    await deleteQrCard(deleting.id, linkId)
    setDeleting(null)
    startTransition(() => router.refresh())
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
      opacity: isPending ? 0.6 : 1,
      transition: 'opacity 0.2s',
    }}>
      <style>{`
        #${STRIP_ID}-scroll::-webkit-scrollbar { height: 6px; }
        #${STRIP_ID}-scroll::-webkit-scrollbar-track { background: transparent; }
        #${STRIP_ID}-scroll::-webkit-scrollbar-thumb { background: var(--line); border-radius: 3px; }
        .${STRIP_ID}-card {
          border: 1px solid var(--line);
          background: var(--surface);
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .${STRIP_ID}-card:hover { border-color: var(--accent); }
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
        .${STRIP_ID}-create:hover { border-color: var(--accent); background: var(--surface); }
        .${STRIP_ID}-create:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px var(--accent);
          border-color: var(--accent);
        }
        .${STRIP_ID}-pill {
          padding: 5px 11px; border-radius: 99px;
          border: 1px solid var(--line); background: var(--surface);
          color: var(--ink-dim); font: inherit; font-size: 11.5px; font-weight: 600;
          cursor: pointer; transition: border-color 0.15s, background 0.15s;
        }
        .${STRIP_ID}-pill:hover { border-color: var(--accent); color: var(--accent); }
        .${STRIP_ID}-menu-item {
          width: 100%; display: flex; align-items: center; gap: 10px;
          padding: 9px 14px; border: none; background: transparent;
          font: inherit; font-size: 13px; font-weight: 500;
          color: var(--ink-dim); cursor: pointer; border-radius: 7px;
          transition: background 0.1s; white-space: nowrap;
        }
        .${STRIP_ID}-menu-item:hover { background: var(--surface-2); color: var(--ink); }
        .${STRIP_ID}-menu-item.danger { color: var(--red); }
        .${STRIP_ID}-menu-item.danger:hover { background: rgba(217,97,74,0.08); }
      `}</style>

      <div style={{
        marginBottom: 12, fontSize: '10.5px', fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'var(--ink-faint)',
      }}>
        QR Cards{hasCards ? ` · ${cards.length}` : ''}
      </div>

      {/* ── Modals ────────────────────────────────────────── */}
      {(naming || renaming || deleting) && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
          }}
          onClick={() => { setNaming(false); setName(''); setRenaming(null); setDeleting(null) }}
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
            {/* ── Create modal ── */}
            {naming && (
              <>
                <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, fontFamily: 'Fraunces, serif', color: 'var(--ink)' }}>
                    Novo QR Card
                  </h3>
                  <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--ink-dim)', lineHeight: 1.4 }}>
                    Para qual canal ou uso é este QR?
                  </p>
                </div>
                <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {SUGGESTIONS.filter(s => !cards.some(c => c.name === s)).map(s => (
                      <button key={s} type="button" className={`${STRIP_ID}-pill`} onClick={() => setName(s)}>
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
                  padding: '14px 22px', borderTop: '1px solid var(--line)',
                  display: 'flex', justifyContent: 'flex-end', gap: 10,
                  background: 'var(--bg-side, var(--surface))',
                }}>
                  <button type="button" onClick={() => { setNaming(false); setName('') }}
                    style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 9, border: '1px solid var(--line-strong)', background: 'transparent', color: 'var(--ink-dim)', cursor: 'pointer', font: 'inherit' }}>
                    Cancelar
                  </button>
                  <button type="button" onClick={handleCreate} disabled={!name.trim()}
                    style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 9, border: '1px solid var(--accent)', background: 'var(--accent)', color: 'var(--pb-ink-on-accent, #1A140C)', cursor: 'pointer', font: 'inherit', opacity: name.trim() ? 1 : 0.4 }}>
                    Criar
                  </button>
                </div>
              </>
            )}

            {/* ── Rename modal ── */}
            {renaming && (
              <>
                <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, fontFamily: 'Fraunces, serif', color: 'var(--ink)' }}>
                    Renomear QR Card
                  </h3>
                </div>
                <div style={{ padding: '16px 22px' }}>
                  <input
                    type="text"
                    value={renameTo}
                    onChange={e => setRenameTo(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename() }}
                    autoFocus
                    style={inputStyle}
                  />
                </div>
                <div style={{
                  padding: '14px 22px', borderTop: '1px solid var(--line)',
                  display: 'flex', justifyContent: 'flex-end', gap: 10,
                  background: 'var(--bg-side, var(--surface))',
                }}>
                  <button type="button" onClick={() => setRenaming(null)}
                    style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 9, border: '1px solid var(--line-strong)', background: 'transparent', color: 'var(--ink-dim)', cursor: 'pointer', font: 'inherit' }}>
                    Cancelar
                  </button>
                  <button type="button" onClick={handleRename} disabled={!renameTo.trim()}
                    style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 9, border: '1px solid var(--accent)', background: 'var(--accent)', color: 'var(--pb-ink-on-accent, #1A140C)', cursor: 'pointer', font: 'inherit', opacity: renameTo.trim() ? 1 : 0.4 }}>
                    Salvar
                  </button>
                </div>
              </>
            )}

            {/* ── Delete confirm modal ── */}
            {deleting && (
              <>
                <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, fontFamily: 'Fraunces, serif', color: 'var(--ink)' }}>
                    Excluir QR Card
                  </h3>
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
                    Tem certeza que deseja excluir <strong style={{ color: 'var(--ink)' }}>{deleting.name}</strong>? Esta ação não pode ser desfeita.
                  </p>
                </div>
                <div style={{
                  padding: '14px 22px', borderTop: '1px solid var(--line)',
                  display: 'flex', justifyContent: 'flex-end', gap: 10,
                  background: 'var(--bg-side, var(--surface))',
                }}>
                  <button type="button" onClick={() => setDeleting(null)}
                    style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 9, border: '1px solid var(--line-strong)', background: 'transparent', color: 'var(--ink-dim)', cursor: 'pointer', font: 'inherit' }}>
                    Cancelar
                  </button>
                  <button type="button" onClick={handleDelete}
                    style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 9, border: '1px solid rgba(217,97,74,0.5)', background: 'rgba(217,97,74,0.1)', color: 'var(--red)', cursor: 'pointer', font: 'inherit' }}>
                    Excluir
                  </button>
                </div>
              </>
            )}
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
            overflowX: menuCardId ? 'visible' : 'auto',
            margin: 0, padding: 0,
            paddingBlockEnd: 4,
            listStyle: 'none',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'thin',
          }}
        >
          {cards.map((card) => (
            <li key={card.id} role="listitem" style={{ scrollSnapAlign: 'start', position: 'relative', zIndex: menuCardId === card.id ? 100 : 'auto' }}>
              <button
                type="button"
                className={`${STRIP_ID}-card`}
                aria-label={`Editar QR Card: ${card.name}`}
                onClick={() => router.push(`/cms/links/${linkId}/qr?card=${card.id}`)}
                style={{
                  width: 140, minWidth: 140, height: 180,
                  borderRadius: 12, padding: 10,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 6,
                  font: 'inherit', color: 'inherit',
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
                  textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', width: '100%', marginTop: 2,
                }}>
                  {card.name}
                </span>
                <span style={{ fontSize: '10.5px', color: 'var(--accent)', fontWeight: 600 }}>
                  Editar
                </span>
              </button>

              {/* ── 3-dot menu ── */}
              <button
                type="button"
                aria-label={`Opções para ${card.name}`}
                onClick={e => { e.stopPropagation(); setMenuCardId(menuCardId === card.id ? null : card.id) }}
                style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 24, height: 24, borderRadius: 6,
                  border: 'none', background: 'rgba(0,0,0,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', opacity: 0.7, transition: 'opacity 0.15s',
                  padding: 0,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.7' }}
              >
                <MoreVertical size={14} strokeWidth={2} style={{ color: '#fff' }} />
              </button>

              {menuCardId === card.id && (
                <div
                  ref={menuRef}
                  style={{
                    position: 'absolute', top: 34, right: 4, zIndex: 9999,
                    width: 170, padding: 4,
                    background: 'var(--surface)',
                    border: '1px solid var(--line-strong)',
                    borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                  }}
                >
                  <button
                    type="button"
                    className={`${STRIP_ID}-menu-item`}
                    onClick={e => {
                      e.stopPropagation()
                      setMenuCardId(null)
                      setRenameTo(card.name)
                      setRenaming({ id: card.id, current: card.name })
                    }}
                  >
                    <Pencil size={14} strokeWidth={1.7} />
                    Renomear
                  </button>
                  <button
                    type="button"
                    className={`${STRIP_ID}-menu-item danger`}
                    onClick={e => {
                      e.stopPropagation()
                      setMenuCardId(null)
                      setDeleting({ id: card.id, name: card.name })
                    }}
                  >
                    <Trash2 size={14} strokeWidth={1.7} />
                    Excluir
                  </button>
                </div>
              )}
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
                gap: 8, font: 'inherit', color: 'inherit', padding: 12,
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
          <span style={{ fontSize: 12, color: 'var(--ink-dim)', fontWeight: 500 }}>
            Nenhum QR Card criado
          </span>
          <button
            type="button"
            className={`${STRIP_ID}-create`}
            aria-label="Criar novo QR Card"
            onClick={() => setNaming(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8, font: 'inherit',
              color: 'var(--ink-dim)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
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
