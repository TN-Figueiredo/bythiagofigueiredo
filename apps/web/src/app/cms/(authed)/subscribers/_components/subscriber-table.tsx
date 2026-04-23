'use client'

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ChangeEvent,
} from 'react'
import { EngagementDots, type DotStatus } from './engagement-dots'

export type SubscriberStatus =
  | 'confirmed'
  | 'pending'
  | 'bounced'
  | 'unsubscribed'
  | 'complained'

export interface SubscriberRow {
  id: string
  email: string
  status: SubscriberStatus
  newsletter_type_name: string
  newsletter_type_color: string | null
  engagement_dots: DotStatus[]
  tracking_consent: boolean
  subscribed_at: string
  confirmed_at: string | null
  is_anonymized: boolean
}

interface SubscriberTableProps {
  initialRows: SubscriberRow[]
  totalCount: number
  page: number
  perPage: number
  newsletterTypes: { id: string; name: string; color: string | null }[]
  onPageChange: (page: number) => void
  onSearch: (query: string) => void
  onStatusFilter: (status: string) => void
  onTypeFilter: (typeId: string) => void
  currentSearch: string
  currentStatus: string
  currentType: string
}

const STATUS_LABELS: Record<SubscriberStatus, string> = {
  confirmed: 'Confirmado',
  pending: 'Pendente',
  bounced: 'Bounce',
  unsubscribed: 'Cancelado',
  complained: 'Reclamação',
}

const STATUS_COLORS: Record<SubscriberStatus, string> = {
  confirmed: '#22c55e',
  pending: '#f59e0b',
  bounced: '#ef4444',
  unsubscribed: '#6b7280',
  complained: '#f43f5e',
}

function StatusBadge({ status }: { status: SubscriberStatus }) {
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded font-medium"
      style={{
        background: STATUS_COLORS[status] + '22',
        color: STATUS_COLORS[status],
        border: `1px solid ${STATUS_COLORS[status]}44`,
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

function TypeBadge({ name, color }: { name: string; color: string | null }) {
  const c = color ?? '#6b7280'
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded font-medium"
      style={{
        background: c + '22',
        color: c,
        border: `1px solid ${c}44`,
      }}
    >
      {name}
    </span>
  )
}

function LgpdLockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-label="Dados anonimizados (LGPD)"
      role="img"
    >
      <rect x="1" y="5" width="10" height="7" rx="1.5" fill="#6b7280" />
      <path
        d="M3 5V3.5a3 3 0 016 0V5"
        stroke="#6b7280"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ConsentIcon({ consent }: { consent: boolean }) {
  return consent ? (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-label="Tracking consentido" role="img">
      <circle cx="6" cy="6" r="5" fill="#22c55e22" stroke="#22c55e" strokeWidth="1" />
      <path d="M3.5 6l2 2 3-3" stroke="#22c55e" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-label="Sem consentimento de tracking" role="img">
      <circle cx="6" cy="6" r="5" fill="#6b728022" stroke="#6b7280" strokeWidth="1" />
      <path d="M4 4l4 4M8 4l-4 4" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function ActionMenu({
  row,
  disabled,
}: {
  row: SubscriberRow
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (disabled) {
    return (
      <span
        className="text-xs px-2 py-1 rounded cursor-not-allowed"
        style={{ color: 'var(--text-dim)' }}
        title="PII anonimizado por LGPD"
      >
        ⋯
      </span>
    )
  }

  const items: { label: string; danger?: boolean; action: string }[] = []
  if (row.status === 'confirmed') {
    items.push(
      { label: 'Ver detalhes', action: 'view' },
      { label: 'Histórico de engajamento', action: 'history' },
      { label: 'Reenviar boas-vindas', action: 'resend_welcome' },
      { label: 'Copiar email', action: 'copy' },
      { label: 'Cancelar assinatura', action: 'unsubscribe', danger: true },
    )
  } else if (row.status === 'pending') {
    items.push(
      { label: 'Ver detalhes', action: 'view' },
      { label: 'Reenviar confirmação', action: 'resend_confirm' },
      { label: 'Copiar email', action: 'copy' },
      { label: 'Remover expirado', action: 'delete', danger: true },
    )
  } else if (row.status === 'bounced') {
    items.push(
      { label: 'Ver detalhes', action: 'view' },
      { label: 'Detalhes do bounce', action: 'bounce_details' },
      { label: 'Tentar reativar', action: 'retry' },
      { label: 'Remover', action: 'delete', danger: true },
    )
  } else {
    items.push({ label: 'Ver detalhes', action: 'view' })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs px-2 py-1 rounded transition-colors"
        style={{ color: 'var(--text-dim)' }}
        aria-label="Ações"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        ⋯
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 rounded-lg border shadow-lg z-10 py-1 min-w-[180px]"
          role="menu"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {items.map((item) => (
            <button
              key={item.action}
              role="menuitem"
              onClick={() => {
                setOpen(false)
                if (item.action === 'copy') {
                  navigator.clipboard.writeText(row.email).catch(() => {})
                }
              }}
              className="w-full text-left text-xs px-3 py-1.5 transition-colors"
              style={{
                color: item.danger ? '#ef4444' : 'var(--text)',
                background: 'transparent',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background =
                  'var(--surface-hover)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MobileCard({ row }: { row: SubscriberRow }) {
  return (
    <div
      className="rounded-lg border p-3 mb-2"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          {row.is_anonymized ? (
            <span
              className="font-mono text-xs italic"
              style={{ color: 'var(--text-dim)' }}
            >
              {row.email}
            </span>
          ) : (
            <span
              className="font-mono text-xs truncate block"
              style={{ color: 'var(--text)' }}
            >
              {row.email}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {row.is_anonymized && <LgpdLockIcon />}
          <StatusBadge status={row.status} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TypeBadge
            name={row.newsletter_type_name}
            color={row.newsletter_type_color}
          />
          <EngagementDots
            dots={
              row.is_anonymized
                ? (['none', 'none', 'none', 'none', 'none'] as DotStatus[])
                : row.engagement_dots
            }
            ariaLabel="Engajamento nos últimos 5 envios"
          />
        </div>
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
          {new Date(row.subscribed_at).toLocaleDateString('pt-BR')}
        </span>
      </div>
    </div>
  )
}

export function SubscriberTable({
  initialRows,
  totalCount,
  page,
  perPage,
  newsletterTypes,
  onPageChange,
  onSearch,
  onStatusFilter,
  onTypeFilter,
  currentSearch,
  currentStatus,
  currentType,
}: SubscriberTableProps) {
  const [searchInput, setSearchInput] = useState(currentSearch)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const totalPages = Math.ceil(totalCount / perPage)
  const startRow = (page - 1) * perPage + 1
  const endRow = Math.min(page * perPage, totalCount)

  const handleSearchChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setSearchInput(val)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onSearch(val)
      }, 300)
    },
    [onSearch],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const allIds = initialRows
    .filter((r) => !r.is_anonymized)
    .map((r) => r.id)
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selectedIds.has(id))

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allIds))
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section aria-label="Lista de assinantes">
      {/* Filter bar */}
      <div
        className="rounded-lg border p-3 mb-4 flex flex-wrap gap-2 items-center"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <input
          type="search"
          value={searchInput}
          onChange={handleSearchChange}
          placeholder="Buscar por email…"
          aria-label="Buscar assinante"
          className="flex-1 min-w-[180px] text-sm rounded-md px-3 py-1.5 border outline-none"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface-hover)',
            color: 'var(--text)',
          }}
        />
        <select
          value={currentType}
          onChange={(e) => onTypeFilter(e.target.value)}
          aria-label="Filtrar por newsletter"
          className="text-sm rounded-md px-2 py-1.5 border outline-none"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface-hover)',
            color: 'var(--text)',
          }}
        >
          <option value="">Todas as newsletters</option>
          {newsletterTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <div className="flex gap-1 flex-wrap">
          {(['', 'confirmed', 'pending', 'bounced', 'unsubscribed'] as const).map(
            (s) => (
              <button
                key={s}
                onClick={() => onStatusFilter(s)}
                className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                style={
                  currentStatus === s
                    ? {
                        background: 'var(--text)',
                        color: 'var(--surface)',
                        borderColor: 'var(--text)',
                      }
                    : {
                        background: 'transparent',
                        color: 'var(--text-dim)',
                        borderColor: 'var(--border)',
                      }
                }
                aria-pressed={currentStatus === s}
              >
                {s === '' ? 'Todos' : STATUS_LABELS[s as SubscriberStatus]}
              </button>
            ),
          )}
        </div>
        {selectedIds.size > 0 && (
          <span
            className="ml-auto text-xs px-2.5 py-1 rounded-full"
            style={{ background: 'var(--surface-hover)', color: 'var(--text-dim)' }}
          >
            {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table
          className="w-full text-sm border-collapse"
          data-testid="subscriber-table"
        >
          <thead>
            <tr
              className="text-left text-xs uppercase"
              style={{ color: 'var(--text-dim)', letterSpacing: '0.06em' }}
            >
              <th className="pb-2 pr-3 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Selecionar todos"
                  className="rounded"
                />
              </th>
              <th className="pb-2 pr-4">Email</th>
              <th className="pb-2 pr-4">Newsletter</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Engajamento</th>
              <th className="pb-2 pr-4 hidden lg:table-cell">Consent</th>
              <th className="pb-2 pr-4">Inscrito em</th>
              <th className="pb-2 w-12" />
            </tr>
          </thead>
          <tbody>
            {initialRows.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="py-12 text-center text-sm"
                  style={{ color: 'var(--text-dim)' }}
                >
                  Nenhum assinante encontrado.
                </td>
              </tr>
            )}
            {initialRows.map((row) => (
              <tr
                key={row.id}
                className="border-t transition-colors"
                style={{ borderColor: 'var(--border-subtle)' }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLTableRowElement).style.background =
                    'var(--surface-hover)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                }}
              >
                <td className="py-2.5 pr-3">
                  <input
                    type="checkbox"
                    disabled={row.is_anonymized}
                    checked={selectedIds.has(row.id)}
                    onChange={() => toggleRow(row.id)}
                    aria-label={`Selecionar ${row.email}`}
                    className="rounded disabled:opacity-30"
                  />
                </td>
                <td className="py-2.5 pr-4 max-w-[220px]">
                  {row.is_anonymized ? (
                    <span
                      className="font-mono text-xs italic truncate block"
                      style={{ color: 'var(--text-dim)' }}
                    >
                      {row.email}
                    </span>
                  ) : (
                    <span
                      className="font-mono text-xs truncate block"
                      style={{ color: 'var(--text)' }}
                    >
                      {row.email}
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-4">
                  <TypeBadge
                    name={row.newsletter_type_name}
                    color={row.newsletter_type_color}
                  />
                </td>
                <td className="py-2.5 pr-4">
                  <StatusBadge status={row.status} />
                </td>
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-1.5">
                    {row.is_anonymized && <LgpdLockIcon />}
                    <EngagementDots
                      dots={
                        row.is_anonymized
                          ? (['none', 'none', 'none', 'none', 'none'] as DotStatus[])
                          : row.engagement_dots
                      }
                      ariaLabel="Engajamento nos últimos 5 envios"
                    />
                  </div>
                </td>
                <td className="py-2.5 pr-4 hidden lg:table-cell">
                  <ConsentIcon consent={row.tracking_consent} />
                </td>
                <td
                  className="py-2.5 pr-4 text-xs whitespace-nowrap"
                  style={{ color: 'var(--text-dim)' }}
                >
                  {new Date(row.subscribed_at).toLocaleDateString('pt-BR')}
                </td>
                <td className="py-2.5 text-right">
                  <ActionMenu row={row} disabled={row.is_anonymized} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {initialRows.length === 0 && (
          <p
            className="text-center py-10 text-sm"
            style={{ color: 'var(--text-dim)' }}
          >
            Nenhum assinante encontrado.
          </p>
        )}
        {initialRows.map((row) => (
          <MobileCard key={row.id} row={row} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          className="flex items-center justify-between mt-4 pt-4 border-t text-sm"
          style={{ borderColor: 'var(--border)' }}
          aria-label="Paginação"
        >
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {totalCount === 0
              ? 'Sem resultados'
              : `Mostrando ${startRow}–${endRow} de ${totalCount}`}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded border text-xs disabled:opacity-40 transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              ← Anterior
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const mid = Math.min(Math.max(page, 4), totalPages - 3)
              const pageNum =
                totalPages <= 7
                  ? i + 1
                  : i === 0
                    ? 1
                    : i === 6
                      ? totalPages
                      : mid - 3 + i
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className="px-3 py-1.5 rounded border text-xs transition-colors"
                  style={
                    pageNum === page
                      ? {
                          background: 'var(--text)',
                          color: 'var(--surface)',
                          borderColor: 'var(--text)',
                        }
                      : { borderColor: 'var(--border)', color: 'var(--text)' }
                  }
                  aria-current={pageNum === page ? 'page' : undefined}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded border text-xs disabled:opacity-40 transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              Próxima →
            </button>
          </div>
        </nav>
      )}
    </section>
  )
}
