'use client'

import { useState, useRef, useCallback } from 'react'
import { Plus, Search, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import { YtPortal } from '../../_components/yt-portal'
import { useModalFocusTrap } from '../../../_shared/editor/use-modal-focus-trap'
import { fmtC } from '@/lib/youtube/format'
import { addCompetitorChannel } from '../actions'

interface SearchResult {
  channelId: string
  name: string
  thumbnail: string | null
  description: string
  handle: string | null
  subscriberCount: number | null
}

interface AddChannelModalProps {
  open: boolean
  onClose: () => void
  existingChannelIds: string[]
  slotsRemaining: number
}

export function AddChannelModal({ open, onClose, existingChannelIds, slotsRemaining }: AddChannelModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [addingId, setAddingId] = useState<string | null>(null)

  const handleClose = useCallback(() => {
    setSearchQuery('')
    setSearchResults([])
    setAddedIds(new Set())
    setAddingId(null)
    onClose()
  }, [onClose])

  useModalFocusTrap(modalRef, open, handleClose)

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length < 2) { setSearchResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/youtube/search-channels?q=${encodeURIComponent(value)}`)
        const data = await res.json()
        setSearchResults(data.results ?? [])
      } catch {
        setSearchResults([])
      }
      setSearching(false)
    }, 500)
  }

  const handleAdd = async (channelId: string) => {
    setAddingId(channelId)
    const result = await addCompetitorChannel(channelId)
    if (result.ok) {
      toast.success('Canal adicionado com sucesso.')
      setAddedIds(prev => new Set(prev).add(channelId))
    } else {
      toast.error(result.error ?? 'Erro ao adicionar canal.')
    }
    setAddingId(null)
  }

  if (!open) return null

  const isAlreadyAdded = (channelId: string) =>
    existingChannelIds.includes(channelId) || addedIds.has(channelId)

  return (
    <YtPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      >
        <div className="absolute inset-0" onClick={handleClose} aria-hidden="true" />
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label="Adicionar canal pra monitorar"
          className="om-modal"
        >
          {/* ── Head ── */}
          <div className="om-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Plus
                style={{ width: 16, height: 16, color: 'var(--accent)', strokeWidth: 2.2 }}
                aria-hidden="true"
              />
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                Adicionar canal pra monitorar
              </span>
            </div>
            <button className="ic-btn" onClick={handleClose} aria-label="Fechar">
              <X style={{ width: 15, height: 15 }} />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="om-body">
            {/* Search input */}
            <div className="search-wrap relative" style={{ width: '100%' }}>
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ width: 14, height: 14, color: 'var(--text-dim)' }}
                aria-hidden="true"
              />
              <input
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Buscar por nome do canal no YouTube..."
                className="w-full rounded-[9px] py-2 pl-9 pr-3 text-xs"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
                autoFocus
              />
            </div>

            {/* Result count + slots */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                margin: '12px 2px 0',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {searching
                  ? 'Buscando...'
                  : searchResults.length > 0
                    ? `${searchResults.length} resultado${searchResults.length !== 1 ? 's' : ''}`
                    : searchQuery.length >= 2
                      ? 'Nenhum resultado'
                      : ' '}
              </span>
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                {slotsRemaining - addedIds.size} vaga{slotsRemaining - addedIds.size !== 1 ? 's' : ''} restante{slotsRemaining - addedIds.size !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Results list */}
            {searchResults.length > 0 && (
              <div className="om-results">
                {searchResults.map(result => {
                  const added = isAlreadyAdded(result.channelId)
                  const isAdding = addingId === result.channelId
                  const noSlots = slotsRemaining - addedIds.size <= 0

                  return (
                    <div key={result.channelId} className="om-result">
                      {/* Avatar */}
                      {result.thumbnail ? (
                        <img
                          src={result.thumbnail}
                          alt=""
                          referrerPolicy="no-referrer"
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            objectFit: 'cover',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            flexShrink: 0,
                            background: 'linear-gradient(135deg, var(--surface-3), var(--surface-2))',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                          }}
                        >
                          {result.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      {/* Channel info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {result.name}
                        </div>
                        {result.subscriberCount != null && (
                          <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                            {fmtC(result.subscriberCount)} inscritos
                          </div>
                        )}
                        {result.description && (
                          <div style={{
                            fontSize: 11.5,
                            color: 'var(--text-dim)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginTop: 1,
                          }}>
                            {result.description}
                          </div>
                        )}
                      </div>

                      {/* Add / Added button */}
                      {added ? (
                        <span
                          className="btn sm"
                          style={{
                            background: 'var(--surface-2)',
                            color: 'var(--text-dim)',
                            borderColor: 'transparent',
                            cursor: 'default',
                            pointerEvents: 'none',
                            flexShrink: 0,
                          }}
                        >
                          <Check style={{ width: 13, height: 13 }} aria-hidden="true" />
                          Adicionado
                        </span>
                      ) : (
                        <button
                          className="btn primary sm"
                          onClick={() => handleAdd(result.channelId)}
                          disabled={isAdding || noSlots}
                          style={{ flexShrink: 0 }}
                        >
                          <Plus style={{ width: 13, height: 13 }} aria-hidden="true" />
                          {isAdding ? 'Adicionando...' : 'Adicionar'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Foot ── */}
          <div className="om-foot">
            <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
              Canais novos sincronizam no proximo ciclo.
            </span>
            <button className="btn primary" onClick={handleClose}>
              Concluir
            </button>
          </div>
        </div>
      </div>
    </YtPortal>
  )
}
