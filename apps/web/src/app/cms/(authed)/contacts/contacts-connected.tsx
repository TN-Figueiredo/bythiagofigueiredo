'use client'

import {
  useState,
  useCallback,
  useEffect,
  useTransition,
  useRef,
  type FormEvent,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { KpiCard } from '@tn-figueiredo/cms-ui/client'
import {
  markReplied,
  undoMarkReplied,
  anonymizeSubmission,
  bulkAnonymize,
  sendReply,
  exportContacts,
} from './actions'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface ContactSubmission {
  id: string
  name: string
  email: string
  message: string
  submitted_at: string
  replied_at: string | null
  anonymized_at: string | null
  ip: string | null
  user_agent: string | null
  consent_processing: boolean
  consent_marketing: boolean
}

export interface ContactKpis {
  total: number
  totalDelta30d: number
  pending: number
  oldestPendingDays: number | null
  replied: number
  replyRate: number
  avgResponseHours: number | null
}

interface Props {
  submissions: ContactSubmission[]
  kpis: ContactKpis
  readOnly?: boolean
  page: number
  totalPages: number
}

type TabId = 'all' | 'pending' | 'replied' | 'anonymized'

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pendentes' },
  { id: 'replied', label: 'Respondidos' },
  { id: 'anonymized', label: 'Anonymized' },
]

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getStatus(sub: ContactSubmission): 'pending' | 'replied' | 'anonymized' {
  if (sub.anonymized_at) return 'anonymized'
  if (sub.replied_at) return 'replied'
  return 'pending'
}

function formatDate(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16)
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '...'
}

/* ------------------------------------------------------------------ */
/*  Toast                                                             */
/* ------------------------------------------------------------------ */

function useUndoToast() {
  const [toast, setToast] = useState<{
    message: string
    undoAction: () => void
  } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(
    (message: string, undoAction: () => void) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      setToast({ message, undoAction })
      timerRef.current = setTimeout(() => {
        setToast(null)
        timerRef.current = null
      }, 5000)
    },
    [],
  )

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(null)
  }, [])

  return { toast, show, dismiss }
}

/* ------------------------------------------------------------------ */
/*  Status badge                                                      */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: 'pending' | 'replied' | 'anonymized' }) {
  const styles: Record<string, string> = {
    pending:
      'bg-amber-900/50 text-amber-400 border border-amber-700/50',
    replied:
      'bg-emerald-900/50 text-emerald-400 border border-emerald-700/50',
    anonymized:
      'bg-slate-700/50 text-slate-400 border border-slate-600/50',
  }
  const labels: Record<string, string> = {
    pending: 'Pendente',
    replied: 'Respondido',
    anonymized: 'Anonymized',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Detail Panel                                                      */
/* ------------------------------------------------------------------ */

function DetailPanel({
  submission,
  onClose,
  onMarkReplied,
  onUndo,
  onAnonymize,
  onSendReply,
  readOnly,
  isPending,
}: {
  submission: ContactSubmission
  onClose: () => void
  onMarkReplied: (id: string) => void
  onUndo: (id: string) => void
  onAnonymize: (id: string) => void
  onSendReply: (id: string, subject: string, body: string) => void
  readOnly: boolean
  isPending: boolean
}) {
  const status = getStatus(submission)
  const isAnonymized = status === 'anonymized'
  const [replyOpen, setReplyOpen] = useState(false)
  const [replySubject, setReplySubject] = useState(
    `Re: Your contact message`,
  )
  const [replyBody, setReplyBody] = useState('')
  const [confirmAnonymize, setConfirmAnonymize] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panelRef.current?.focus()
  }, [submission.id])

  const handleReplySubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!replySubject.trim() || !replyBody.trim()) return
    onSendReply(submission.id, replySubject, replyBody)
    setReplyOpen(false)
    setReplyBody('')
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 md:bg-transparent"
        onClick={onClose}
        data-testid="detail-backdrop"
      />
      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Contact detail"
        data-testid="detail-panel"
        className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto border-l border-slate-700 bg-[#0f172a] p-6 shadow-2xl md:w-[380px]"
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Contact Detail</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Profile */}
        <div className="space-y-4 mb-6">
          <div>
            <span className="block text-xs font-medium uppercase tracking-wider text-slate-500">Name</span>
            <span className={`text-sm ${isAnonymized ? 'italic text-slate-500' : 'text-slate-200'}`}>
              {submission.name}
            </span>
          </div>
          <div>
            <span className="block text-xs font-medium uppercase tracking-wider text-slate-500">Email</span>
            <span className={`text-sm ${isAnonymized ? 'italic text-slate-500' : 'text-slate-200'}`}>
              {isAnonymized ? (
                submission.email
              ) : (
                <a href={`mailto:${submission.email}`} className="text-indigo-400 hover:underline">
                  {submission.email}
                </a>
              )}
            </span>
          </div>
          <div>
            <span className="block text-xs font-medium uppercase tracking-wider text-slate-500">Message</span>
            <p className={`mt-1 whitespace-pre-wrap rounded-md border border-slate-700 bg-slate-800/50 p-3 text-sm ${isAnonymized ? 'italic text-slate-500' : 'text-slate-300'}`}>
              {submission.message}
            </p>
          </div>
          <div className="flex gap-4">
            <div>
              <span className="block text-xs font-medium uppercase tracking-wider text-slate-500">Date</span>
              <span className="text-sm text-slate-300">{formatDate(submission.submitted_at)}</span>
            </div>
            <div>
              <span className="block text-xs font-medium uppercase tracking-wider text-slate-500">Status</span>
              <StatusBadge status={status} />
            </div>
          </div>
          {submission.ip && !isAnonymized && (
            <div>
              <span className="block text-xs font-medium uppercase tracking-wider text-slate-500">IP</span>
              <span className="font-mono text-xs text-slate-400">{submission.ip}</span>
            </div>
          )}
          <div className="flex gap-4">
            <div>
              <span className="block text-xs font-medium uppercase tracking-wider text-slate-500">Processing consent</span>
              <span className="text-sm text-slate-300">{submission.consent_processing ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span className="block text-xs font-medium uppercase tracking-wider text-slate-500">Marketing consent</span>
              <span className="text-sm text-slate-300">{submission.consent_marketing ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {!readOnly && !isAnonymized && (
          <div className="space-y-3 border-t border-slate-700 pt-4">
            {/* Reply */}
            {!replyOpen ? (
              <button
                type="button"
                onClick={() => setReplyOpen(true)}
                className="w-full rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
                data-testid="reply-btn"
              >
                Reply
              </button>
            ) : (
              <form onSubmit={handleReplySubmit} className="space-y-3">
                <div>
                  <label htmlFor="reply-subject" className="block text-xs font-medium text-slate-400 mb-1">
                    Subject
                  </label>
                  <input
                    id="reply-subject"
                    type="text"
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value)}
                    className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="reply-body" className="block text-xs font-medium text-slate-400 mb-1">
                    Message
                  </label>
                  <textarea
                    id="reply-body"
                    rows={5}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Type your reply..."
                    className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    data-testid="reply-body"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isPending || !replyBody.trim()}
                    className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
                    data-testid="send-reply-btn"
                  >
                    {isPending ? 'Sending...' : 'Send'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplyOpen(false)}
                    className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Mark replied / Undo */}
            {status === 'pending' ? (
              <button
                type="button"
                onClick={() => onMarkReplied(submission.id)}
                disabled={isPending}
                className="w-full rounded-md border border-emerald-700/50 bg-emerald-900/30 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-900/50 disabled:opacity-50"
                data-testid="mark-replied-btn"
              >
                Mark Replied
              </button>
            ) : status === 'replied' ? (
              <button
                type="button"
                onClick={() => onUndo(submission.id)}
                disabled={isPending}
                className="w-full rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                data-testid="undo-replied-btn"
              >
                Undo Replied
              </button>
            ) : null}

            {/* Anonymize */}
            {!confirmAnonymize ? (
              <button
                type="button"
                onClick={() => setConfirmAnonymize(true)}
                className="w-full rounded-md border border-red-800/50 px-4 py-2 text-sm text-red-400 hover:bg-red-950/30"
                data-testid="anonymize-btn"
              >
                Anonymize (LGPD)
              </button>
            ) : (
              <div className="rounded-md border border-red-800/50 bg-red-950/20 p-3 space-y-2">
                <p className="text-sm text-red-400">
                  This will permanently anonymize this submission. This action cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onAnonymize(submission.id)
                      setConfirmAnonymize(false)
                    }}
                    disabled={isPending}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500 disabled:opacity-50"
                    data-testid="confirm-anonymize-btn"
                  >
                    Confirm Anonymize
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmAnonymize(false)}
                    className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Export Dialog                                                      */
/* ------------------------------------------------------------------ */

function ExportDialog({
  onClose,
  onExport,
  isPending,
}: {
  onClose: () => void
  onExport: (period: string, status: string) => void
  isPending: boolean
}) {
  const [period, setPeriod] = useState('30d')
  const [status, setStatus] = useState('all')

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Export contacts"
        data-testid="export-dialog"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Export Contacts (CSV)</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="export-period" className="block text-sm font-medium text-slate-300 mb-1">
              Period
            </label>
            <select
              id="export-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="365d">Last year</option>
              <option value="all">All time</option>
            </select>
          </div>
          <div>
            <label htmlFor="export-status" className="block text-sm font-medium text-slate-300 mb-1">
              Status
            </label>
            <select
              id="export-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="replied">Replied</option>
              <option value="anonymized">Anonymized</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onExport(period, status)}
              disabled={isPending}
              className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
              data-testid="export-submit-btn"
            >
              {isPending ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export function ContactsConnected({
  submissions: initialSubmissions,
  kpis,
  readOnly = false,
  page,
  totalPages,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Local state for optimistic updates
  const [submissions, setSubmissions] = useState(initialSubmissions)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedSubmission, setSelectedSubmission] = useState<ContactSubmission | null>(null)
  const [showExport, setShowExport] = useState(false)
  const { toast, show: showToast, dismiss: dismissToast } = useUndoToast()

  // Sync with server data when props change
  useEffect(() => {
    setSubmissions(initialSubmissions)
  }, [initialSubmissions])

  // Current tab
  const activeTab = (searchParams.get('status') as TabId) || 'all'
  const searchQuery = searchParams.get('q') || ''

  // Active row index for keyboard navigation
  const [activeRowIndex, setActiveRowIndex] = useState(-1)

  // Filter submissions based on tab + search
  const filtered = submissions.filter((sub) => {
    const status = getStatus(sub)
    if (activeTab !== 'all' && status !== activeTab) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        sub.name.toLowerCase().includes(q) ||
        sub.email.toLowerCase().includes(q) ||
        sub.message.toLowerCase().includes(q)
      )
    }
    return true
  })

  // URL update helpers
  const setTab = useCallback(
    (tab: TabId) => {
      const params = new URLSearchParams(searchParams.toString())
      if (tab === 'all') {
        params.delete('status')
      } else {
        params.set('status', tab)
      }
      params.delete('page')
      router.push(`?${params.toString()}`)
    },
    [router, searchParams],
  )

  const setSearch = useCallback(
    (q: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (q) {
        params.set('q', q)
      } else {
        params.delete('q')
      }
      params.delete('page')
      router.push(`?${params.toString()}`)
    },
    [router, searchParams],
  )

  // Actions
  const handleMarkReplied = useCallback(
    (id: string) => {
      // Optimistic update
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, replied_at: new Date().toISOString() } : s,
        ),
      )
      if (selectedSubmission?.id === id) {
        setSelectedSubmission((prev) =>
          prev ? { ...prev, replied_at: new Date().toISOString() } : prev,
        )
      }

      startTransition(async () => {
        const res = await markReplied(id)
        if (!res.ok) {
          // Revert on failure
          setSubmissions((prev) =>
            prev.map((s) =>
              s.id === id ? { ...s, replied_at: null } : s,
            ),
          )
          return
        }
        showToast('Marked as replied', () => handleUndoReplied(id))
      })
    },
    [selectedSubmission, showToast],
  )

  const handleUndoReplied = useCallback(
    (id: string) => {
      dismissToast()
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, replied_at: null } : s,
        ),
      )
      if (selectedSubmission?.id === id) {
        setSelectedSubmission((prev) =>
          prev ? { ...prev, replied_at: null } : prev,
        )
      }
      startTransition(async () => {
        await undoMarkReplied(id)
      })
    },
    [selectedSubmission, dismissToast],
  )

  const handleAnonymize = useCallback(
    (id: string) => {
      startTransition(async () => {
        const res = await anonymizeSubmission(id)
        if (res.ok) {
          setSubmissions((prev) =>
            prev.map((s) =>
              s.id === id
                ? {
                    ...s,
                    anonymized_at: new Date().toISOString(),
                    name: 'Anonymous',
                    email: '[anonymized]',
                    message: '[anonymized per LGPD request]',
                    ip: null,
                    user_agent: null,
                  }
                : s,
            ),
          )
          if (selectedSubmission?.id === id) {
            setSelectedSubmission(null)
          }
        }
      })
    },
    [selectedSubmission],
  )

  const handleBulkAnonymize = useCallback(() => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Anonymize ${selectedIds.size} submission(s)? This cannot be undone.`)) return
    const ids = Array.from(selectedIds)
    startTransition(async () => {
      const res = await bulkAnonymize(ids)
      if (res.ok) {
        setSubmissions((prev) =>
          prev.map((s) =>
            ids.includes(s.id)
              ? {
                  ...s,
                  anonymized_at: new Date().toISOString(),
                  name: 'Anonymous',
                  email: '[anonymized]',
                  message: '[anonymized per LGPD request]',
                  ip: null,
                  user_agent: null,
                }
              : s,
          ),
        )
        setSelectedIds(new Set())
      }
    })
  }, [selectedIds])

  const handleSendReply = useCallback(
    (id: string, subject: string, body: string) => {
      startTransition(async () => {
        const res = await sendReply(id, { subject, body })
        if (res.ok) {
          setSubmissions((prev) =>
            prev.map((s) =>
              s.id === id ? { ...s, replied_at: new Date().toISOString() } : s,
            ),
          )
          if (selectedSubmission?.id === id) {
            setSelectedSubmission((prev) =>
              prev ? { ...prev, replied_at: new Date().toISOString() } : prev,
            )
          }
        }
      })
    },
    [selectedSubmission],
  )

  const handleExport = useCallback(
    (period: string, status: string) => {
      startTransition(async () => {
        const res = await exportContacts(period, status)
        if (res.ok) {
          // Trigger download
          const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = res.filename
          a.click()
          URL.revokeObjectURL(url)
          setShowExport(false)
        }
      })
    },
    [],
  )

  // Selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    const selectableIds = filtered.filter((s) => !s.anonymized_at).map((s) => s.id)
    setSelectedIds((prev) => {
      if (prev.size === selectableIds.length) return new Set()
      return new Set(selectableIds)
    })
  }, [filtered])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (isInput) {
        if (e.key === 'Escape') {
          ;(document.activeElement as HTMLElement)?.blur?.()
        }
        return
      }

      if (e.key === 'Escape') {
        if (selectedSubmission) {
          setSelectedSubmission(null)
          return
        }
      }

      if (e.key === '/') {
        e.preventDefault()
        const searchInput = document.querySelector<HTMLInputElement>(
          '[data-testid="search-input"]',
        )
        searchInput?.focus()
        return
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveRowIndex((prev) => Math.min(prev + 1, filtered.length - 1))
        return
      }

      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveRowIndex((prev) => Math.max(prev - 1, 0))
        return
      }

      if (e.key === 'Enter' && activeRowIndex >= 0 && activeRowIndex < filtered.length) {
        setSelectedSubmission(filtered[activeRowIndex] ?? null)
        return
      }

      if (e.key === 'r' && selectedSubmission && !readOnly) {
        const replyBtn = document.querySelector<HTMLButtonElement>(
          '[data-testid="reply-btn"]',
        )
        replyBtn?.click()
        return
      }

      if (e.key === 'm' && selectedSubmission && !readOnly) {
        const status = getStatus(selectedSubmission)
        if (status === 'pending') {
          handleMarkReplied(selectedSubmission.id)
        }
        return
      }

      if (e.key === 'z' && toast) {
        toast.undoAction()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    filtered,
    activeRowIndex,
    selectedSubmission,
    readOnly,
    toast,
    handleMarkReplied,
  ])

  // Pagination
  const goToPage = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', String(p))
      router.push(`?${params.toString()}`)
    },
    [router, searchParams],
  )

  const selectableFiltered = filtered.filter((s) => !s.anonymized_at)

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0f172a] p-4 md:p-6">
      {/* KPI Strip */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4" data-testid="kpi-strip">
        <KpiCard
          label="Total"
          value={kpis.total}
          trend={
            kpis.totalDelta30d !== 0
              ? {
                  direction: kpis.totalDelta30d > 0 ? 'up' : 'down',
                  label: `${kpis.totalDelta30d > 0 ? '+' : ''}${kpis.totalDelta30d} (30d)`,
                }
              : undefined
          }
          trendPositive="up"
        />
        <KpiCard
          label="Pending"
          value={kpis.pending}
          trend={
            kpis.oldestPendingDays != null
              ? {
                  direction: kpis.oldestPendingDays > 3 ? 'up' : 'flat',
                  label: `oldest: ${kpis.oldestPendingDays}d`,
                }
              : undefined
          }
          trendPositive="down"
          color={kpis.pending > 0 ? 'amber' : 'default'}
        />
        <KpiCard
          label="Replied"
          value={kpis.replied}
          trend={{
            direction: kpis.replyRate >= 80 ? 'up' : kpis.replyRate >= 50 ? 'flat' : 'down',
            label: `${kpis.replyRate.toFixed(0)}% rate`,
          }}
          trendPositive="up"
          color={kpis.replyRate >= 80 ? 'green' : 'default'}
        />
        <KpiCard
          label="Avg Response"
          value={kpis.avgResponseHours != null ? `${kpis.avgResponseHours.toFixed(0)}h` : '--'}
          trend={
            kpis.avgResponseHours != null
              ? {
                  direction: kpis.avgResponseHours <= 24 ? 'down' : 'up',
                  label: kpis.avgResponseHours <= 24 ? 'fast' : 'slow',
                }
              : undefined
          }
          trendPositive="down"
          color={
            kpis.avgResponseHours != null && kpis.avgResponseHours <= 24
              ? 'green'
              : kpis.avgResponseHours != null && kpis.avgResponseHours > 48
                ? 'red'
                : 'default'
          }
        />
      </div>

      {/* Filters + Search */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-1" role="tablist" aria-label="Contact status filter">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setTab(tab.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 md:w-64 md:flex-none">
            <input
              type="search"
              placeholder="Search contacts... (press /)"
              value={searchQuery}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="search-input"
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 pl-9 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setShowExport(true)}
              className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
              data-testid="export-btn"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-800/50 py-16" data-testid="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" className="mb-4 h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-sm text-slate-400">No contacts found</p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mt-2 text-sm text-indigo-400 hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800/50">
          <table className="w-full text-sm" data-testid="contacts-table">
            <thead>
              <tr className="border-b border-slate-700">
                {!readOnly && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === selectableFiltered.length && selectableFiltered.length > 0}
                      onChange={toggleSelectAll}
                      className="accent-indigo-500"
                      aria-label="Select all"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Name
                </th>
                <th className="hidden px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500 md:table-cell">
                  Email
                </th>
                <th className="hidden px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500 lg:table-cell">
                  Preview
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sub, index) => {
                const status = getStatus(sub)
                const isActive = index === activeRowIndex
                const isAnonymized = status === 'anonymized'

                return (
                  <tr
                    key={sub.id}
                    data-testid={`contact-row-${sub.id}`}
                    onClick={() => setSelectedSubmission(sub)}
                    className={`cursor-pointer border-b border-slate-700/50 transition-colors ${
                      isActive ? 'bg-indigo-500/10' : 'hover:bg-slate-800/80'
                    } ${
                      status === 'pending'
                        ? 'font-medium'
                        : isAnonymized
                          ? 'italic opacity-60'
                          : ''
                    }`}
                  >
                    {!readOnly && (
                      <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(sub.id)}
                          onChange={() => toggleSelect(sub.id)}
                          disabled={isAnonymized}
                          className="accent-indigo-500 disabled:opacity-30"
                          aria-label={`Select ${sub.name}`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {status === 'pending' && (
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-400"
                            aria-label="Pending"
                            data-testid="pending-dot"
                          />
                        )}
                        <span className={isAnonymized ? 'text-slate-500' : 'text-slate-200'}>
                          {sub.name}
                        </span>
                      </div>
                    </td>
                    <td className={`hidden px-4 py-3 md:table-cell ${isAnonymized ? 'text-slate-500' : 'text-slate-300'}`}>
                      {sub.email}
                    </td>
                    <td className={`hidden px-4 py-3 lg:table-cell ${isAnonymized ? 'text-slate-500' : 'text-slate-400'}`}>
                      {truncate(sub.message, 80)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {sub.submitted_at.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2" data-testid="pagination">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-slate-400">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Bulk actions bar */}
      {!readOnly && selectedIds.size > 0 && (
        <div
          className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 shadow-2xl"
          data-testid="bulk-actions"
        >
          <span className="text-sm text-slate-300">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            onClick={handleBulkAnonymize}
            disabled={isPending}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            Anonymize Selected
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Clear
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-4 right-4 z-40 flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 shadow-2xl"
          data-testid="undo-toast"
          role="status"
        >
          <span className="text-sm text-slate-300">{toast.message}</span>
          <button
            type="button"
            onClick={toast.undoAction}
            className="text-sm font-medium text-indigo-400 hover:text-indigo-300"
          >
            Undo (Z)
          </button>
        </div>
      )}

      {/* Detail panel */}
      {selectedSubmission && (
        <DetailPanel
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          onMarkReplied={handleMarkReplied}
          onUndo={handleUndoReplied}
          onAnonymize={handleAnonymize}
          onSendReply={handleSendReply}
          readOnly={readOnly}
          isPending={isPending}
        />
      )}

      {/* Export dialog */}
      {showExport && (
        <ExportDialog
          onClose={() => setShowExport(false)}
          onExport={handleExport}
          isPending={isPending}
        />
      )}
    </div>
  )
}
